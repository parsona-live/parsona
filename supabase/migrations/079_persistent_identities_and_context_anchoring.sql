-- Migration 079: Persistent Identities and Context Anchoring
-- Adds avatar_url to contact_identities so channel profile pictures persist across chat deletions.
-- Also ensures contact_identities lookup indexes are optimized.

ALTER TABLE contact_identities
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_identities_lookup_fast
  ON contact_identities (account_id, channel, external_id);

CREATE INDEX IF NOT EXISTS idx_contact_identities_contact_channel
  ON contact_identities (account_id, contact_id, channel);
