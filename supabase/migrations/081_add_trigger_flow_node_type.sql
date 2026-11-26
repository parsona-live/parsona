-- Migration 081: Add 'trigger_flow' to flow_nodes.node_type CHECK constraint
-- Enables Flow-to-Flow handoff nodes with variable passing.

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
    'trigger_flow'
  ));
