-- ============================================================
-- 070_ai_usage_cost.sql
--
-- Store actual provider reported cost (e.g. OpenRouter total_cost)
-- directly on ai_usage_log for exact billing & cost visibility.
-- NULL when the provider does not report cost.
-- ============================================================

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS cost numeric(12, 6);

