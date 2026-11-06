-- 070_ai_usage_cost_down.sql - revert cost column in ai_usage_log
ALTER TABLE ai_usage_log
  DROP COLUMN IF EXISTS cost;

