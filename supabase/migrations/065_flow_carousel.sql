-- ============================================================
-- 065_flow_carousel.sql
--
-- Adds support for interactive carousel nodes in conversational flows:
-- New 'send_carousel' value on `flow_nodes.node_type` CHECK constraint.
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
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end'
  ));

