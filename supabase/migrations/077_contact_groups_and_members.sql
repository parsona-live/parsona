-- ============================================================
-- 077_contact_groups_and_members.sql
--
-- Dedicated Contact Groups & Membership Architecture
-- 1. `contact_groups`: Group/list management for segmentation & broadcast campaigns.
-- 2. `contact_group_members`: Multi-tenant contact group associations.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Contact Groups Table
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_contact_groups_account_name UNIQUE (account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_groups_account
  ON contact_groups (account_id);

ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view contact groups" ON contact_groups;
CREATE POLICY "Account members view contact groups"
  ON contact_groups FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage contact groups" ON contact_groups;
CREATE POLICY "Account members manage contact groups"
  ON contact_groups FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));


-- ============================================================
-- 2. Contact Group Members Table
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_contact_group_members UNIQUE (group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_group_members_group
  ON contact_group_members (account_id, group_id);

CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact
  ON contact_group_members (account_id, contact_id);

ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view contact group members" ON contact_group_members;
CREATE POLICY "Account members view contact group members"
  ON contact_group_members FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage contact group members" ON contact_group_members;
CREATE POLICY "Account members manage contact group members"
  ON contact_group_members FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));
