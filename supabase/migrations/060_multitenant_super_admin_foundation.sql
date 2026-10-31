-- ============================================================
-- 060_multitenant_super_admin_foundation.sql
--
-- Multi-Tenant Super Admin & Template Assignment Foundation
--
-- What this migration does:
--   1. Adds `is_super_admin` to `profiles` with a fast partial index.
--   2. Adds `is_super_admin()` SECURITY DEFINER helper function.
--   3. Updates `is_account_member()` so Super Admins bypass tenant
--      boundaries across all existing RLS-protected tables.
--   4. Adds tenant lifecycle status and quotas to `accounts`
--      (status, plan_tier, max_contacts, max_broadcasts_per_month,
--      max_agents, ai_enabled).
--   5. Allows global master flow templates in `flows` (`account_id DROP NOT NULL`,
--      `is_template`, `template_category`, `origin_template_id`).
--   6. Grants Super Admins INSERT and DELETE on `accounts`.
--   7. Updates RLS policies on `flows` and `flow_nodes` to support
--      global templates (where account_id IS NULL).
--   8. Adds transactional RPC `clone_template_to_account` for 1-click
--      master automation assignment.
--   9. Adds `toggle_account_status` and `bootstrap_super_admin` RPCs.
--
-- Rollback file:
--   supabase/migrations/revert/060_multitenant_super_admin_foundation_down.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profiles: is_super_admin column & helper
-- ------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_super_admin
  ON profiles(is_super_admin)
  WHERE is_super_admin = TRUE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE user_id = auth.uid()),
    FALSE
  );
$$;

ALTER FUNCTION is_super_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Upgrade is_account_member to grant Super Admin access
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Super admins bypass tenant boundaries across all domain tables
    WHEN (SELECT is_super_admin FROM profiles WHERE user_id = auth.uid()) IS TRUE THEN TRUE
    ELSE EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_id = target_account_id
        AND CASE p.account_role
              WHEN 'owner'  THEN 4
              WHEN 'admin'  THEN 3
              WHEN 'agent'  THEN 2
              WHEN 'viewer' THEN 1
            END
          >=
            CASE min_role
              WHEN 'owner'  THEN 4
              WHEN 'admin'  THEN 3
              WHEN 'agent'  THEN 2
              WHEN 'viewer' THEN 1
            END
    )
  END;
$$;

ALTER FUNCTION is_account_member(UUID, account_role_enum) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_account_member(UUID, account_role_enum) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Accounts: Tenant status, plan tiers, and quotas
-- ------------------------------------------------------------
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS max_contacts INTEGER NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS max_broadcasts_per_month INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS max_agents INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Add constraints safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_status_check'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_status_check
      CHECK (status IN ('active', 'suspended', 'trialing', 'past_due'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_plan_tier_check'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_plan_tier_check
      CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise'));
  END IF;
END $$;

-- Super admins can create and delete tenant accounts
DROP POLICY IF EXISTS accounts_insert ON accounts;
CREATE POLICY accounts_insert ON accounts FOR INSERT
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS accounts_delete ON accounts;
CREATE POLICY accounts_delete ON accounts FOR DELETE
  USING (is_super_admin());

-- ------------------------------------------------------------
-- 4. Flows: Master template support & RLS update
-- ------------------------------------------------------------
ALTER TABLE flows
  ALTER COLUMN account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS template_category TEXT,
  ADD COLUMN IF NOT EXISTS origin_template_id UUID REFERENCES flows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flows_template
  ON flows(is_template)
  WHERE is_template = TRUE;

CREATE INDEX IF NOT EXISTS idx_flows_origin_template
  ON flows(origin_template_id)
  WHERE origin_template_id IS NOT NULL;

-- Allow reading flows if member of account OR if viewing global templates
DROP POLICY IF EXISTS flows_select ON flows;
CREATE POLICY flows_select ON flows FOR SELECT USING (
  (account_id IS NOT NULL AND is_account_member(account_id))
  OR (account_id IS NULL AND (is_super_admin() OR is_template = TRUE))
);

-- Manage flows: tenants manage their own; super admins manage all including templates
DROP POLICY IF EXISTS flows_insert ON flows;
CREATE POLICY flows_insert ON flows FOR INSERT WITH CHECK (
  (account_id IS NOT NULL AND is_account_member(account_id, 'agent'))
  OR (account_id IS NULL AND is_super_admin())
);

DROP POLICY IF EXISTS flows_update ON flows;
CREATE POLICY flows_update ON flows FOR UPDATE USING (
  (account_id IS NOT NULL AND is_account_member(account_id, 'agent'))
  OR (account_id IS NULL AND is_super_admin())
);

DROP POLICY IF EXISTS flows_delete ON flows;
CREATE POLICY flows_delete ON flows FOR DELETE USING (
  (account_id IS NOT NULL AND is_account_member(account_id, 'agent'))
  OR (account_id IS NULL AND is_super_admin())
);

-- Flow nodes RLS update for templates
DROP POLICY IF EXISTS flow_nodes_select ON flow_nodes;
CREATE POLICY flow_nodes_select ON flow_nodes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND (
        (f.account_id IS NOT NULL AND is_account_member(f.account_id))
        OR (f.account_id IS NULL AND (is_super_admin() OR f.is_template = TRUE))
      )
  )
);

DROP POLICY IF EXISTS flow_nodes_modify ON flow_nodes;
CREATE POLICY flow_nodes_modify ON flow_nodes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND (
        (f.account_id IS NOT NULL AND is_account_member(f.account_id, 'agent'))
        OR (f.account_id IS NULL AND is_super_admin())
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND (
        (f.account_id IS NOT NULL AND is_account_member(f.account_id, 'agent'))
        OR (f.account_id IS NULL AND is_super_admin())
      )
  )
);

-- ------------------------------------------------------------
-- 5. RPC: clone_template_to_account
-- Deep-copies a master template flow & nodes into a tenant account
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION clone_template_to_account(
  template_flow_id UUID,
  target_account_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_flow_id UUID;
  v_template RECORD;
  v_owner_user_id UUID;
BEGIN
  -- Verify caller is super admin or admin of the target account
  IF NOT (is_super_admin() OR is_account_member(target_account_id, 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only Super Admins or Account Admins can assign templates';
  END IF;

  -- Load template
  SELECT * INTO v_template
  FROM flows
  WHERE id = template_flow_id AND is_template = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template flow % not found', template_flow_id;
  END IF;

  -- Find an owner or admin user_id for the target account
  SELECT owner_user_id INTO v_owner_user_id
  FROM accounts
  WHERE id = target_account_id;

  IF v_owner_user_id IS NULL THEN
    SELECT user_id INTO v_owner_user_id
    FROM profiles
    WHERE account_id = target_account_id
    LIMIT 1;
  END IF;

  -- 1. Insert cloned flow
  INSERT INTO flows (
    account_id,
    user_id,
    name,
    description,
    status,
    trigger_type,
    trigger_config,
    entry_node_id,
    fallback_policy,
    is_template,
    origin_template_id
  ) VALUES (
    target_account_id,
    v_owner_user_id,
    v_template.name,
    v_template.description,
    'draft', -- Clones default to draft until tenant/admin activates
    v_template.trigger_type,
    v_template.trigger_config,
    v_template.entry_node_id,
    v_template.fallback_policy,
    FALSE,
    template_flow_id
  ) RETURNING id INTO v_new_flow_id;

  -- 2. Clone all flow_nodes
  INSERT INTO flow_nodes (
    flow_id,
    node_key,
    node_type,
    config,
    position_x,
    position_y
  )
  SELECT
    v_new_flow_id,
    fn.node_key,
    fn.node_type,
    fn.config,
    fn.position_x,
    fn.position_y
  FROM flow_nodes fn
  WHERE fn.flow_id = template_flow_id;

  RETURN v_new_flow_id;
END;
$$;

ALTER FUNCTION clone_template_to_account(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION clone_template_to_account(UUID, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. RPC: toggle_account_status
-- Super Admin can suspend or reactivate an account
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION toggle_account_status(
  target_account_id UUID,
  new_status TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins can change account status';
  END IF;

  IF new_status NOT IN ('active', 'suspended', 'trialing', 'past_due') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE accounts
  SET status = new_status,
      updated_at = NOW()
  WHERE id = target_account_id;
END;
$$;

ALTER FUNCTION toggle_account_status(UUID, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION toggle_account_status(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 7. RPC: bootstrap_super_admin
-- Promotes a user by email to super admin. Can be called by
-- service_role, existing super admin, OR if no super admin exists yet.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION bootstrap_super_admin(
  target_email TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_admin_count
  FROM profiles
  WHERE is_super_admin = TRUE;

  -- Allowed if caller is super admin OR if zero super admins currently exist
  IF v_admin_count > 0 AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: A Super Admin already exists. Only existing Super Admins can promote others.';
  END IF;

  UPDATE profiles
  SET is_super_admin = TRUE,
      updated_at = NOW()
  WHERE LOWER(email) = LOWER(target_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for email % not found', target_email;
  END IF;

  RETURN TRUE;
END;
$$;

ALTER FUNCTION bootstrap_super_admin(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION bootstrap_super_admin(TEXT) TO authenticated, service_role;

