-- ============================================================
-- 072_contact_channel_linking.sql
--
-- Non-destructive omnichannel contact linking.
-- Allows linking WhatsApp, Instagram, and Facebook contacts
-- without deleting or losing individual conversations.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS linked_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_linked_contact_id
  ON contacts (linked_contact_id)
  WHERE linked_contact_id IS NOT NULL;

