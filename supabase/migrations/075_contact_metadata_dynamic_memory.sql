-- ============================================================
-- 075_contact_metadata_dynamic_memory.sql
--
-- Dynamic Customer Memory:
-- Adds JSONB `metadata` column on `contacts` to persist arbitrary key-value
-- attributes (e.g. preferences, collected flow variables, notes) across channels.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- GIN index for fast JSONB querying and indexing across arbitrary dynamic keys
CREATE INDEX IF NOT EXISTS idx_contacts_metadata_gin
  ON contacts USING gin (metadata);
