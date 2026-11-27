-- ============================================================
-- 083_member_phone_and_notify_node.sql
--
-- 1. Add `phone` (E.164) to `profiles` and `account_invitations`
--    so team members / owners can receive internal WhatsApp
--    notifications from Flows.
-- 2. Expand `flow_nodes.node_type` CHECK constraint to include
--    'notify_member'.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE account_invitations
  ADD COLUMN IF NOT EXISTS phone TEXT;

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
    'notify_member'
  ));
