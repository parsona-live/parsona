-- ============================================================
-- 082_dynamic_crm.sql
--
-- Dynamic CRM Platform:
-- 1. `crm_collections`: User-defined collections/tables per account.
-- 2. `crm_fields`: Typed field schema definitions per collection.
-- 3. `crm_records`: Schema-validated JSONB records with GIN index,
--    contact linking, and idempotency support.
-- 4. Expand `flow_nodes.node_type` CHECK constraint to include
--    'crm_fetch' and 'crm_mutate'.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. CRM Collections
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'table',
  include_in_ai_context BOOLEAN NOT NULL DEFAULT true,
  ai_context_limit INT NOT NULL DEFAULT 5 CHECK (ai_context_limit >= 0 AND ai_context_limit <= 50),
  unique_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_crm_collections_slug UNIQUE (account_id, slug),
  CONSTRAINT chk_crm_collections_slug CHECK (slug ~ '^[a-z][a-z0-9_]{1,62}$')
);

CREATE INDEX IF NOT EXISTS idx_crm_collections_account
  ON crm_collections (account_id, created_at ASC);

ALTER TABLE crm_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view crm collections" ON crm_collections;
CREATE POLICY "Account members view crm collections"
  ON crm_collections FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account admins manage crm collections" ON crm_collections;
CREATE POLICY "Account admins manage crm collections"
  ON crm_collections FOR ALL
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));


-- ============================================================
-- 2. CRM Fields
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES crm_collections(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (
    field_type IN (
      'text', 'number', 'boolean', 'date', 'datetime',
      'select', 'email', 'phone', 'url', 'relation', 'json'
    )
  ),
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_unique BOOLEAN NOT NULL DEFAULT false,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  relation_collection_id UUID REFERENCES crm_collections(id) ON DELETE SET NULL,
  default_value JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  show_in_table BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_crm_fields_key UNIQUE (collection_id, key),
  CONSTRAINT chk_crm_fields_key CHECK (key ~ '^[a-z][a-z0-9_]{0,62}$')
);

CREATE INDEX IF NOT EXISTS idx_crm_fields_collection
  ON crm_fields (collection_id, sort_order ASC, created_at ASC);

ALTER TABLE crm_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view crm fields" ON crm_fields;
CREATE POLICY "Account members view crm fields"
  ON crm_fields FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account admins manage crm fields" ON crm_fields;
CREATE POLICY "Account admins manage crm fields"
  ON crm_fields FOR ALL
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));


-- ============================================================
-- 3. CRM Records
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES crm_collections(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_type TEXT NOT NULL DEFAULT 'user' CHECK (created_by_type IN ('user', 'flow', 'api', 'ai', 'mcp')),
  created_by_ref TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_crm_records_idempotency UNIQUE (account_id, collection_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_records_collection_created
  ON crm_records (account_id, collection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_records_contact
  ON crm_records (account_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_data_gin
  ON crm_records USING GIN (data jsonb_path_ops);

ALTER TABLE crm_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members view crm records" ON crm_records;
CREATE POLICY "Account members view crm records"
  ON crm_records FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Account agents manage crm records" ON crm_records;
CREATE POLICY "Account agents manage crm records"
  ON crm_records FOR ALL
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));


-- ============================================================
-- 4. Expand flow_nodes.node_type CHECK constraint
-- ============================================================
ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'trigger',
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'send_carousel',
    'send_location',
    'send_contact',
    'request_address',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'agent_handover',
    'http_fetch',
    'end',
    'add_to_group',
    'remove_from_group',
    'update_contact',
    'assign_label',
    'send_email',
    'delay',
    'webhook',
    'book_appointment',
    'ai_response',
    'whatsapp_payment',
    'catalog',
    'input_flow',
    'whatsapp_form',
    'create_deal',
    'close_conversation',
    'ai_message',
    'ai_extract',
    'ai_decision',
    'ai_summarize',
    'trigger_flow',
    'crm_fetch',
    'crm_mutate'
  ));
