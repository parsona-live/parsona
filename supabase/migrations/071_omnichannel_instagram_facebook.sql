-- ============================================================
-- 071_omnichannel_instagram_facebook.sql
--
-- Adds Omnichannel support for Instagram Direct, Instagram Comments,
-- and Facebook Messenger alongside WhatsApp.
--
-- 1. `meta_channel_connections`: stores connected Pages & Instagram accounts
-- 2. `contacts`: adds `ig_user_id`, `ig_username`, `fb_page_scoped_id`, `fb_name`
-- 3. `conversations`: adds `channel` and `channel_connection_id`
-- 4. `messages`: adds `channel` and `is_human_agent_tag`
-- 5. `comment_to_dm_rules`: automation rules for Instagram/Facebook comments
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Channel Connections (Multi-Page / Multi-Account)
CREATE TABLE IF NOT EXISTS meta_channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'facebook')),
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  instagram_business_id TEXT,
  instagram_username TEXT,
  encrypted_access_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  subscribed_fields TEXT[] DEFAULT ARRAY['messages', 'messaging_postbacks', 'feed'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, channel, page_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_channel_connections_account
  ON meta_channel_connections (account_id);
CREATE INDEX IF NOT EXISTS idx_meta_channel_connections_page_id
  ON meta_channel_connections (page_id);
CREATE INDEX IF NOT EXISTS idx_meta_channel_connections_ig_id
  ON meta_channel_connections (instagram_business_id);

ALTER TABLE meta_channel_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view channel connections" ON meta_channel_connections;
CREATE POLICY "Account members view channel connections"
  ON meta_channel_connections FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Admins manage channel connections" ON meta_channel_connections;
CREATE POLICY "Admins manage channel connections"
  ON meta_channel_connections FOR ALL
  USING (is_account_member(account_id, 'admin'));

-- 2. Contacts Social Identifiers
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ig_user_id TEXT,
  ADD COLUMN IF NOT EXISTS ig_username TEXT,
  ADD COLUMN IF NOT EXISTS fb_page_scoped_id TEXT,
  ADD COLUMN IF NOT EXISTS fb_name TEXT;

COMMENT ON COLUMN contacts.ig_user_id IS 'Instagram-Scoped User ID (IGSID). Unique per Instagram Business Account.';
COMMENT ON COLUMN contacts.ig_username IS 'Instagram username/handle without @.';
COMMENT ON COLUMN contacts.fb_page_scoped_id IS 'Facebook Page-Scoped ID (PSID). Unique per Facebook Page.';
COMMENT ON COLUMN contacts.fb_name IS 'Facebook user display name.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_ig_user_id
  ON contacts (account_id, ig_user_id)
  WHERE ig_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_fb_psid
  ON contacts (account_id, fb_page_scoped_id)
  WHERE fb_page_scoped_id IS NOT NULL;

-- 3. Conversations Channel & Connection
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'instagram', 'facebook')),
  ADD COLUMN IF NOT EXISTS channel_connection_id UUID REFERENCES meta_channel_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_account_channel
  ON conversations (account_id, channel);

CREATE INDEX IF NOT EXISTS idx_conversations_channel_connection
  ON conversations (channel_connection_id);

-- 4. Messages Channel & Human Agent Tag
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'instagram', 'facebook')),
  ADD COLUMN IF NOT EXISTS is_human_agent_tag BOOLEAN DEFAULT FALSE;

-- 5. Comment-to-DM Rules
CREATE TABLE IF NOT EXISTS comment_to_dm_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel_connection_id UUID NOT NULL REFERENCES meta_channel_connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  post_filter_type TEXT NOT NULL DEFAULT 'all_posts' CHECK (post_filter_type IN ('all_posts', 'specific_post')),
  post_id TEXT,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'any')),
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  dm_message_text TEXT NOT NULL,
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  public_replies TEXT[] DEFAULT ARRAY['Sent you a DM! 📩', 'Check your inbox for details! ✨'],
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_to_dm_rules_account
  ON comment_to_dm_rules (account_id);
CREATE INDEX IF NOT EXISTS idx_comment_to_dm_rules_connection
  ON comment_to_dm_rules (channel_connection_id);

ALTER TABLE comment_to_dm_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view comment rules" ON comment_to_dm_rules;
CREATE POLICY "Account members view comment rules"
  ON comment_to_dm_rules FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Admins manage comment rules" ON comment_to_dm_rules;
CREATE POLICY "Admins manage comment rules"
  ON comment_to_dm_rules FOR ALL
  USING (is_account_member(account_id, 'admin'));

-- 6. Guard new omnichannel tables in redeem_invitation RPC
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_has_other_members BOOLEAN;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id
  FOR UPDATE OF p, a;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;

  IF v_old_account_id = v_inv.account_id THEN
    RAISE EXCEPTION 'You are already a member of this account'
      USING ERRCODE = '23505';
  END IF;

  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'You are already in a shared account; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE account_id = v_old_account_id
      AND user_id <> v_caller_id
  ) INTO v_has_other_members;

  IF v_has_other_members THEN
    RAISE EXCEPTION 'Your account has other members; remove them or transfer ownership before joining another account'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM contacts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM conversations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM broadcasts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automation_logs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automation_pending_executions WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flows WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flow_runs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM pipelines WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM deals WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM message_templates WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM tags WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM custom_fields WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM contact_notes WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM whatsapp_config WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM api_keys WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM webhook_endpoints WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM quick_replies WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM notifications WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_configs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_knowledge_documents WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_knowledge_chunks WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_usage_log WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM account_subscriptions WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM payment_transactions WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM meta_channel_connections WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM comment_to_dm_rules WHERE account_id = v_old_account_id
    LIMIT 1
  ) INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Your account already contains data; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  UPDATE profiles
  SET account_id = v_inv.account_id,
      account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  DELETE FROM accounts WHERE id = v_old_account_id;

  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
