-- ============================================================
-- 063_negotiated_pricing_and_admin_ops.sql
-- Custom Negotiated Pricing, Multi-Admin Roles, and Audit Logs
-- ============================================================

-- 1. Add Negotiated Pricing & Operations Columns to accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS negotiated_price_inr NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS billing_cycle_day INT DEFAULT 1 CHECK (billing_cycle_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'active' CHECK (billing_status IN ('active', 'pending_setup', 'payment_due', 'overdue', 'cancelled')),
  ADD COLUMN IF NOT EXISTS billing_notes TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. Add Admin Role to profiles (default 'super_admin' when is_super_admin is true)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT 'super_admin'
  CHECK (admin_role IN ('super_admin', 'operations_admin', 'billing_admin', 'support_admin'));

-- 3. Platform Admin Audit Logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  tenant_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON admin_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- Enable RLS on audit logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins can view audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can insert audit logs"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

