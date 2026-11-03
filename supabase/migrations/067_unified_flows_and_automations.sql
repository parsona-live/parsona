-- ============================================================
-- 067_unified_flows_and_automations.sql
--
-- Consolidates all automation features and rich nodes into the
-- unified flow engine.
--
-- 1. Expands `flow_nodes.node_type` check constraint to support
--    canvas Trigger and all action nodes.
-- 2. Adds `run_once` flag to `flows`.
-- 3. Adds `flow_completed_contacts` table to track completed runs
--    for run-once workflows.
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
    'close_conversation'
  ));

-- Add run_once flag to flows if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flows' AND column_name = 'run_once'
  ) THEN
    ALTER TABLE flows ADD COLUMN run_once BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Table to track contacts who have completed a run-once flow
CREATE TABLE IF NOT EXISTS flow_completed_contacts (
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flow_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_completed_contacts_contact
  ON flow_completed_contacts(contact_id);

ALTER TABLE flow_completed_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_completed_contacts_select" ON flow_completed_contacts;
DROP POLICY IF EXISTS flow_completed_contacts_select ON flow_completed_contacts;
CREATE POLICY flow_completed_contacts_select
  ON flow_completed_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM flows f
      WHERE f.id = flow_completed_contacts.flow_id
        AND (
          (f.account_id IS NOT NULL AND is_account_member(f.account_id))
          OR (f.account_id IS NULL AND is_super_admin())
        )
    )
  );

DROP POLICY IF EXISTS "flow_completed_contacts_all" ON flow_completed_contacts;
DROP POLICY IF EXISTS flow_completed_contacts_modify ON flow_completed_contacts;
CREATE POLICY flow_completed_contacts_modify
  ON flow_completed_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM flows f
      WHERE f.id = flow_completed_contacts.flow_id
        AND (
          (f.account_id IS NOT NULL AND is_account_member(f.account_id, 'agent'))
          OR (f.account_id IS NULL AND is_super_admin())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flows f
      WHERE f.id = flow_completed_contacts.flow_id
        AND (
          (f.account_id IS NOT NULL AND is_account_member(f.account_id, 'agent'))
          OR (f.account_id IS NULL AND is_super_admin())
        )
    )
  );
