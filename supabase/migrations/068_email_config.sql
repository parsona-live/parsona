-- ============================================================
-- 068_email_config.sql
-- Dedicated Workspace Centralized Email Configuration (Brevo API & Custom SMTP)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'brevo' CHECK (provider IN ('brevo', 'smtp')),
  -- Brevo API fields
  brevo_api_key TEXT,
  -- Custom SMTP fields
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT DEFAULT 'tls' CHECK (smtp_encryption IN ('tls', 'ssl', 'none')),
  -- Common sender fields
  from_name TEXT,
  from_email TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_configs_select ON email_configs;
CREATE POLICY email_configs_select ON email_configs FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS email_configs_insert ON email_configs;
CREATE POLICY email_configs_insert ON email_configs FOR INSERT
  WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS email_configs_update ON email_configs;
CREATE POLICY email_configs_update ON email_configs FOR UPDATE
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS email_configs_delete ON email_configs;
CREATE POLICY email_configs_delete ON email_configs FOR DELETE
  USING (is_account_member(account_id));

-- Trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_email_configs_updated_at ON email_configs;
CREATE TRIGGER set_email_configs_updated_at
  BEFORE UPDATE ON email_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
