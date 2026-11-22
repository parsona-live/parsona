-- ============================================================
-- 076_customer_context_engine_core.sql
--
-- Production-Grade Customer Context Engine Core Data Model
-- 1. `contact_identities`: External channel identities mapping to canonical contacts.
-- 2. `contact_events`: Deterministic, typed business events (bookings, payments, quotes, inquiries).
-- 3. `contact_memories`: Structured, provenance-backed, editable customer memory.
-- 4. `contact_intelligence_snapshots`: Versioned snapshots of customer intent, signals, and objections.
-- 5. `conversation_summaries`: Incremental rolling summaries of conversations.
-- 6. `context_traces`: Observability and audit trail of AI context assembly.
-- 7. `contacts` cache columns for low-latency dashboard querying.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Contact Identities (Multi-channel identity mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'facebook', 'web', 'other')),
  external_id TEXT NOT NULL,
  external_username TEXT,
  display_name TEXT,
  phone TEXT,
  email TEXT,
  identity_status TEXT NOT NULL DEFAULT 'verified' CHECK (identity_status IN ('verified', 'unverified', 'pending_review', 'unlinked')),
  verification_method TEXT NOT NULL DEFAULT 'platform_id' CHECK (verification_method IN ('platform_id', 'verified_phone', 'verified_email', 'manual_link')),
  verified_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_contact_identities_channel UNIQUE (account_id, channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_identities_contact
  ON contact_identities (account_id, contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_identities_lookup
  ON contact_identities (account_id, channel, external_id);

ALTER TABLE contact_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view contact identities" ON contact_identities;
CREATE POLICY "Account members view contact identities"
  ON contact_identities FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage contact identities" ON contact_identities;
CREATE POLICY "Account members manage contact identities"
  ON contact_identities FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 2. Contact Events (Deterministic, typed business events)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  source_reference TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  idempotency_key TEXT,
  CONSTRAINT uq_contact_events_idempotency UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_contact_events_contact_timeline
  ON contact_events (contact_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_events_type
  ON contact_events (account_id, event_type);

ALTER TABLE contact_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view contact events" ON contact_events;
CREATE POLICY "Account members view contact events"
  ON contact_events FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members insert contact events" ON contact_events;
CREATE POLICY "Account members insert contact events"
  ON contact_events FOR INSERT
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 3. Contact Memories (Structured, provenance-backed memory)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date')),
  source_type TEXT NOT NULL CHECK (source_type IN ('customer_explicit', 'verified_system', 'human_business_edit', 'ai_extracted', 'ai_inferred')),
  source_channel TEXT CHECK (source_channel IN ('whatsapp', 'instagram', 'facebook', 'system', 'web', 'other')),
  source_message_id TEXT,
  source_reference TEXT,
  confidence NUMERIC(3, 2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  authority TEXT NOT NULL DEFAULT 'customer_explicit' CHECK (authority IN ('human_business_edit', 'verified_system', 'customer_explicit', 'ai_extracted', 'ai_inferred')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'expired', 'deleted')),
  first_observed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_confirmed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ,
  supersedes_memory_id UUID REFERENCES contact_memories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_memories_contact_active
  ON contact_memories (contact_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_contact_memories_key
  ON contact_memories (account_id, contact_id, memory_key);

ALTER TABLE contact_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view contact memories" ON contact_memories;
CREATE POLICY "Account members view contact memories"
  ON contact_memories FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage contact memories" ON contact_memories;
CREATE POLICY "Account members manage contact memories"
  ON contact_memories FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 4. Contact Intelligence Snapshots (Versioned evaluation)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  intent_category TEXT CHECK (intent_category IN ('new_inquiry', 'information_seeking', 'purchase_evaluation', 'ready_to_convert', 'customer_active', 'support_needed', 'inactive', 'unknown')),
  intent_score INTEGER CHECK (intent_score >= 0 AND intent_score <= 100),
  intent_summary TEXT,
  signals JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'skeptical', 'frustrated', 'interested')),
  response_behavior JSONB DEFAULT '{}'::jsonb,
  next_best_action TEXT,
  confidence NUMERIC(3, 2) DEFAULT 0.85 CHECK (confidence >= 0 AND confidence <= 1),
  source_window JSONB DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  model_id TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intelligence_snapshots_contact
  ON contact_intelligence_snapshots (contact_id, evaluated_at DESC);

ALTER TABLE contact_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view intelligence snapshots" ON contact_intelligence_snapshots;
CREATE POLICY "Account members view intelligence snapshots"
  ON contact_intelligence_snapshots FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage intelligence snapshots" ON contact_intelligence_snapshots;
CREATE POLICY "Account members manage intelligence snapshots"
  ON contact_intelligence_snapshots FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 5. Conversation Summaries (Rolling derived summaries)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  conversation_purpose TEXT,
  customer_needs TEXT,
  known_facts JSONB DEFAULT '[]'::jsonb,
  decisions JSONB DEFAULT '[]'::jsonb,
  requirements JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  unresolved_questions JSONB DEFAULT '[]'::jsonb,
  business_promises JSONB DEFAULT '[]'::jsonb,
  current_status TEXT,
  last_summarized_message_id TEXT,
  last_summarized_sequence INTEGER DEFAULT 0,
  summary_version INTEGER DEFAULT 1,
  summarized_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  model_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_conversation_summaries_conv UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_contact
  ON conversation_summaries (contact_id, summarized_at DESC);

ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view conversation summaries" ON conversation_summaries;
CREATE POLICY "Account members view conversation summaries"
  ON conversation_summaries FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage conversation summaries" ON conversation_summaries;
CREATE POLICY "Account members manage conversation summaries"
  ON conversation_summaries FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 6. Context Traces (Observability & Context Assembly Audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS context_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  context_version TEXT NOT NULL DEFAULT 'v1',
  included_memory_ids UUID[] DEFAULT '{}',
  included_event_ids UUID[] DEFAULT '{}',
  included_summary_ids UUID[] DEFAULT '{}',
  intelligence_snapshot_id UUID REFERENCES contact_intelligence_snapshots(id) ON DELETE SET NULL,
  retrieval_reasons JSONB DEFAULT '{}'::jsonb,
  model_id TEXT,
  prompt_version TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  context_tokens INTEGER,
  retrieval_latency INTEGER,
  llm_latency INTEGER,
  total_latency INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_traces_lookup
  ON context_traces (account_id, contact_id, created_at DESC);

ALTER TABLE context_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view context traces" ON context_traces;
CREATE POLICY "Account members view context traces"
  ON context_traces FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members insert context traces" ON context_traces;
CREATE POLICY "Account members insert context traces"
  ON context_traces FOR INSERT
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 7. Low-latency Intelligence Cache Columns on Contacts
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS last_business_action TEXT,
  ADD COLUMN IF NOT EXISTS last_business_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intent_category TEXT CHECK (intent_category IN ('new_inquiry', 'information_seeking', 'purchase_evaluation', 'ready_to_convert', 'customer_active', 'support_needed', 'inactive', 'unknown')),
  ADD COLUMN IF NOT EXISTS intent_score INTEGER CHECK (intent_score >= 0 AND intent_score <= 100),
  ADD COLUMN IF NOT EXISTS intent_summary TEXT,
  ADD COLUMN IF NOT EXISTS next_best_action TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'skeptical', 'frustrated', 'interested')),
  ADD COLUMN IF NOT EXISTS intelligence_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_account_intent
  ON contacts (account_id, intent_category);

CREATE INDEX IF NOT EXISTS idx_contacts_account_business_action
  ON contacts (account_id, last_business_action);
