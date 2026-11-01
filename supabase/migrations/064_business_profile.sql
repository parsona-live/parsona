-- ============================================================
-- 064_business_profile.sql
-- Dedicated Business Profile & Knowledge Grounding
-- ============================================================

CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  business_name TEXT,
  tagline TEXT,
  category TEXT,
  description TEXT,
  website_url TEXT,
  support_email TEXT,
  support_phone TEXT,
  operating_hours TEXT,
  address TEXT,
  booking_url TEXT,
  sync_to_ai BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_profiles_select ON business_profiles;
CREATE POLICY business_profiles_select ON business_profiles FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS business_profiles_insert ON business_profiles;
CREATE POLICY business_profiles_insert ON business_profiles FOR INSERT
  WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS business_profiles_update ON business_profiles;
CREATE POLICY business_profiles_update ON business_profiles FOR UPDATE
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS business_profiles_delete ON business_profiles;
CREATE POLICY business_profiles_delete ON business_profiles FOR DELETE
  USING (is_account_member(account_id));

-- Trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_business_profiles_updated_at ON business_profiles;
CREATE TRIGGER set_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
