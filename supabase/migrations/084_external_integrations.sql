-- ============================================================
-- 084_external_integrations.sql
--
-- 1. Create `account_integrations` table for encrypted third-party
--    credentials & non-secret config per account.
-- 2. Create `custom_integration_actions` table for user-defined
--    Custom REST API endpoints.
-- 3. Expand `flow_nodes.node_type` CHECK constraint to include
--    'integration_action'.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS account_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL DEFAULT '',
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_integrations_account_id
  ON account_integrations(account_id);

CREATE INDEX IF NOT EXISTS idx_account_integrations_provider
  ON account_integrations(account_id, provider_key);

ALTER TABLE account_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_integrations_select" ON account_integrations;
CREATE POLICY "account_integrations_select"
  ON account_integrations FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "account_integrations_insert" ON account_integrations;
CREATE POLICY "account_integrations_insert"
  ON account_integrations FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "account_integrations_update" ON account_integrations;
CREATE POLICY "account_integrations_update"
  ON account_integrations FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "account_integrations_delete" ON account_integrations;
CREATE POLICY "account_integrations_delete"
  ON account_integrations FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ------------------------------------------------------------
-- Custom REST API actions
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS custom_integration_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES account_integrations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  path_template TEXT NOT NULL,
  headers_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_template JSONB,
  input_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_custom_integration_actions_integration_id
  ON custom_integration_actions(integration_id);

ALTER TABLE custom_integration_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_integration_actions_select" ON custom_integration_actions;
CREATE POLICY "custom_integration_actions_select"
  ON custom_integration_actions FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "custom_integration_actions_insert" ON custom_integration_actions;
CREATE POLICY "custom_integration_actions_insert"
  ON custom_integration_actions FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "custom_integration_actions_update" ON custom_integration_actions;
CREATE POLICY "custom_integration_actions_update"
  ON custom_integration_actions FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "custom_integration_actions_delete" ON custom_integration_actions;
CREATE POLICY "custom_integration_actions_delete"
  ON custom_integration_actions FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ------------------------------------------------------------
-- Expand flow_nodes.node_type CHECK constraint
-- ------------------------------------------------------------

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
    'crm_mutate',
    'notify_member',
    'integration_action'
  ));
