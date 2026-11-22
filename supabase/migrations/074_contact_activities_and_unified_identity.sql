-- ============================================================
-- 074_contact_activities_and_unified_identity.sql
--
-- Phase 2 Omnichannel Core:
-- 1. `inbound_events`: High-scale staging queue with dedup, SKIP LOCKED claiming,
--    per-contact partitioning, and exponential retry/DLQ.
-- 2. Hot-path denormalization on `contacts`: `last_seen_channel`, `last_action_summary`,
--    `last_action_at`.
-- 3. `contact_activities`: Centralized event-sourced timeline across channels.
-- 4. `claim_inbound_events_batch`: Atomic queue claim with FOR UPDATE SKIP LOCKED.
-- 5. `resolve_or_create_unified_contact`: Concurrency-safe unified contact resolver
--    with transaction-level advisory locking (pg_advisory_xact_lock).
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Inbound Events Queue for High-Scale Webhook Ingestion
-- ============================================================
CREATE TABLE IF NOT EXISTS inbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'facebook')),
  event_key TEXT NOT NULL, -- unique mid/event id for deduplication
  partition_key TEXT,      -- e.g. 'account_id:phone' or 'account_id:social_id' for FIFO
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  retry_after TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbound_events_status_retry
  ON inbound_events (status, retry_after)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_events_dedup
  ON inbound_events (channel, event_key);

CREATE INDEX IF NOT EXISTS idx_inbound_events_partition
  ON inbound_events (partition_key, status);

CREATE INDEX IF NOT EXISTS idx_inbound_events_account_created
  ON inbound_events (account_id, created_at DESC);

-- RLS for inbound_events
ALTER TABLE inbound_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view inbound events" ON inbound_events;
CREATE POLICY "Account members view inbound events"
  ON inbound_events FOR SELECT
  USING (account_id IS NULL OR is_account_member(account_id));

-- ============================================================
-- 2. Hot-Path Denormalization on Contacts Table
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS last_seen_channel TEXT CHECK (last_seen_channel IN ('whatsapp', 'instagram', 'facebook')),
  ADD COLUMN IF NOT EXISTS last_action_summary TEXT,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_account_last_seen
  ON contacts (account_id, last_seen_channel);

-- ============================================================
-- 3. Centralized Contact Activities Timeline (Event-Sourced)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'facebook', 'system')),
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optimized Cursor Pagination Index for single-customer timeline
CREATE INDEX IF NOT EXISTS idx_contact_activities_cursor
  ON contact_activities (contact_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_contact_activities_account_event
  ON contact_activities (account_id, event_type);

-- RLS for contact_activities
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view contact activities" ON contact_activities;
CREATE POLICY "Account members view contact activities"
  ON contact_activities FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members insert contact activities" ON contact_activities;
CREATE POLICY "Account members insert contact activities"
  ON contact_activities FOR INSERT
  WITH CHECK (is_account_member(account_id));

-- ============================================================
-- 4. Atomic Queue Batch Claiming (FOR UPDATE SKIP LOCKED)
-- ============================================================
CREATE OR REPLACE FUNCTION claim_inbound_events_batch(
  p_batch_size INT DEFAULT 10
)
RETURNS SETOF inbound_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM inbound_events
    WHERE status = 'pending'
      AND retry_after <= timezone('utc'::text, now())
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE inbound_events q
  SET status = 'processing',
      attempts = q.attempts + 1
  FROM claimable
  WHERE q.id = claimable.id
  RETURNING q.*;
END;
$$;

-- ============================================================
-- 5. Atomic Identity Resolution & Advisory Locking
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_or_create_unified_contact(
  p_account_id UUID,
  p_user_id UUID,
  p_channel TEXT,
  p_social_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_ig_username TEXT DEFAULT NULL,
  p_fb_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key TEXT;
  v_contact RECORD;
  v_clean_phone TEXT;
BEGIN
  -- Build unique lock key prioritizing phone, then email, then socialId
  v_clean_phone := NULLIF(TRIM(p_phone), '');
  IF v_clean_phone IS NOT NULL THEN
    v_lock_key := p_account_id::text || ':phone:' || v_clean_phone;
  ELSIF p_email IS NOT NULL AND p_email != '' THEN
    v_lock_key := p_account_id::text || ':email:' || LOWER(TRIM(p_email));
  ELSE
    v_lock_key := p_account_id::text || ':' || p_channel || ':' || p_social_id;
  END IF;

  -- Acquire transaction-level advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key));

  -- 1. Try finding by social ID first
  IF p_channel = 'instagram' THEN
    SELECT * INTO v_contact FROM contacts
    WHERE account_id = p_account_id AND ig_user_id = p_social_id
    LIMIT 1;
  ELSIF p_channel = 'facebook' THEN
    SELECT * INTO v_contact FROM contacts
    WHERE account_id = p_account_id AND fb_page_scoped_id = p_social_id
    LIMIT 1;
  END IF;

  -- 2. If not found by social ID, search by phone or email for auto-merge
  IF v_contact.id IS NULL AND v_clean_phone IS NOT NULL THEN
    SELECT * INTO v_contact FROM contacts
    WHERE account_id = p_account_id AND phone = v_clean_phone
    LIMIT 1;
  END IF;

  IF v_contact.id IS NULL AND p_email IS NOT NULL AND p_email != '' THEN
    SELECT * INTO v_contact FROM contacts
    WHERE account_id = p_account_id AND LOWER(email) = LOWER(TRIM(p_email))
    LIMIT 1;
  END IF;

  -- 3. If found, backfill missing social handles and hot path into existing record
  IF v_contact.id IS NOT NULL THEN
    UPDATE contacts
    SET
      ig_user_id = COALESCE(contacts.ig_user_id, CASE WHEN p_channel = 'instagram' THEN p_social_id ELSE NULL END),
      ig_username = COALESCE(contacts.ig_username, p_ig_username),
      fb_page_scoped_id = COALESCE(contacts.fb_page_scoped_id, CASE WHEN p_channel = 'facebook' THEN p_social_id ELSE NULL END),
      fb_name = COALESCE(contacts.fb_name, p_fb_name),
      phone = COALESCE(NULLIF(contacts.phone, ''), v_clean_phone),
      email = COALESCE(contacts.email, NULLIF(TRIM(p_email), '')),
      avatar_url = COALESCE(contacts.avatar_url, p_avatar_url),
      last_seen_channel = p_channel,
      updated_at = NOW()
    WHERE id = v_contact.id
    RETURNING * INTO v_contact;

    RETURN to_jsonb(v_contact);
  END IF;

  -- 4. Not found: create a new unified social contact
  INSERT INTO contacts (
    account_id,
    user_id,
    name,
    phone,
    email,
    avatar_url,
    ig_user_id,
    ig_username,
    fb_page_scoped_id,
    fb_name,
    last_seen_channel
  ) VALUES (
    p_account_id,
    p_user_id,
    COALESCE(p_name, CASE WHEN p_channel = 'instagram' THEN 'Instagram User' ELSE 'Facebook User' END),
    COALESCE(v_clean_phone, ''),
    NULLIF(TRIM(p_email), ''),
    p_avatar_url,
    CASE WHEN p_channel = 'instagram' THEN p_social_id ELSE NULL END,
    p_ig_username,
    CASE WHEN p_channel = 'facebook' THEN p_social_id ELSE NULL END,
    p_fb_name,
    p_channel
  )
  RETURNING * INTO v_contact;

  RETURN to_jsonb(v_contact);
END;
$$;
