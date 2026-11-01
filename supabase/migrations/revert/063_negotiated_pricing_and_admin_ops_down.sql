-- ============================================================
-- 063_negotiated_pricing_and_admin_ops_down.sql
-- Revert Custom Negotiated Pricing, Multi-Admin Roles, and Audit Logs
-- ============================================================

DROP TABLE IF EXISTS admin_audit_logs CASCADE;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS admin_role;

ALTER TABLE accounts
  DROP COLUMN IF EXISTS negotiated_price_inr,
  DROP COLUMN IF EXISTS billing_cycle_day,
  DROP COLUMN IF EXISTS billing_status,
  DROP COLUMN IF EXISTS billing_notes,
  DROP COLUMN IF EXISTS internal_notes;

