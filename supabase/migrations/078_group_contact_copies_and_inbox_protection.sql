-- ============================================================
-- 078_group_contact_copies_and_inbox_protection.sql
--
-- 1. Protect Inbox: Prevent contact deletions from wiping conversations.
--    Alters `conversations.contact_id` to DROP NOT NULL and ON DELETE SET NULL.
-- 2. Isolated Group Contacts Architecture ("Proper Copies"):
--    Creates `group_contacts` table so contact groups hold independent copies
--    that can be pruned/deleted without touching master contacts or the inbox.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Protect conversations table from contact deletion cascades
-- ============================================================
ALTER TABLE conversations
  ALTER COLUMN contact_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_contact_id_fkey'
      AND conrelid = 'conversations'::regclass
  ) THEN
    ALTER TABLE conversations
      DROP CONSTRAINT conversations_contact_id_fkey;
  END IF;
END $$;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE SET NULL;


-- ============================================================
-- 2. Dedicated Group Contacts Table (Independent Copies)
-- ============================================================
CREATE TABLE IF NOT EXISTS group_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  source_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_contacts_account_group
  ON group_contacts (account_id, group_id);

CREATE INDEX IF NOT EXISTS idx_group_contacts_account_phone
  ON group_contacts (account_id, phone);

CREATE INDEX IF NOT EXISTS idx_group_contacts_source
  ON group_contacts (source_contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_contacts_unique_source
  ON group_contacts (group_id, source_contact_id)
  WHERE source_contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_contacts_unique_phone
  ON group_contacts (group_id, phone)
  WHERE phone IS NOT NULL AND phone != '';

ALTER TABLE group_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view group contacts" ON group_contacts;
CREATE POLICY "Account members view group contacts"
  ON group_contacts FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account members manage group contacts" ON group_contacts;
CREATE POLICY "Account members manage group contacts"
  ON group_contacts FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));

-- Migrate any existing contact_group_members into group_contacts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_group_members'
  ) THEN
    INSERT INTO group_contacts (account_id, group_id, source_contact_id, name, phone, email, company, created_at)
    SELECT
      cgm.account_id,
      cgm.group_id,
      c.id,
      c.name,
      c.phone,
      c.email,
      c.company,
      cgm.added_at
    FROM contact_group_members cgm
    JOIN contacts c ON c.id = cgm.contact_id
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
