-- ============================================================
-- 066_flow_additional_nodes.sql
--
-- Adds support for additional rich nodes in conversational flows:
-- 'send_location', 'send_contact', 'request_address' on `flow_nodes.node_type`
-- CHECK constraint, and 'contacts' on `messages.content_type` CHECK constraint.
-- ============================================================

ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
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
    'http_fetch',
    'end'
  ));

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive', 'contacts'
  ));

