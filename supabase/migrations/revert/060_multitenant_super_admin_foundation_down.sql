-- ============================================================
-- 060_multitenant_super_admin_foundation_down.sql
--
-- Revert script for migration 060.
-- Running this script completely restores the database to its
-- previous state before migration 060 was applied.
-- ============================================================

-- 1. Drop RPC functions
DROP FUNCTION IF EXISTS bootstrap_super_admin(TEXT);
DROP FUNCTION IF EXISTS toggle_account_status(UUID, TEXT);
DROP FUNCTION IF EXISTS clone_template_to_account(UUID, UUID);

-- 2. Restore flow_nodes policies to pre-060 state
DROP POLICY IF EXISTS flow_nodes_select ON flow_nodes;
DROP POLICY IF EXISTS flow_nodes_modify ON flow_nodes;

CREATE POLICY flow_nodes_select ON flow_nodes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND is_account_member(f.account_id)
  )
);

CREATE POLICY flow_nodes_modify ON flow_nodes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND is_account_member(f.account_id, 'agent')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND is_account_member(f.account_id, 'agent')
  )
);

-- 3. Restore flows policies to pre-060 state
DROP POLICY IF EXISTS flows_select ON flows;
DROP POLICY IF EXISTS flows_insert ON flows;
DROP POLICY IF EXISTS flows_update ON flows;
DROP POLICY IF EXISTS flows_delete ON flows;

CREATE POLICY flows_select ON flows FOR SELECT USING (is_account_member(account_id));
CREATE POLICY flows_insert ON flows FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY flows_update ON flows FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY flows_delete ON flows FOR DELETE USING (is_account_member(account_id, 'agent'));

-- Remove flow template columns & indexes
DROP INDEX IF EXISTS idx_flows_origin_template;
DROP INDEX IF EXISTS idx_flows_template;

-- If any template flows had NULL account_id, remove them before setting NOT NULL
DELETE FROM flows WHERE account_id IS NULL;

ALTER TABLE flows
  ALTER COLUMN account_id SET NOT NULL,
  DROP COLUMN IF EXISTS origin_template_id,
  DROP COLUMN IF EXISTS template_category,
  DROP COLUMN IF EXISTS is_template;

-- 4. Restore accounts policies and columns
DROP POLICY IF EXISTS accounts_insert ON accounts;
DROP POLICY IF EXISTS accounts_delete ON accounts;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_tier_check,
  DROP CONSTRAINT IF EXISTS accounts_status_check,
  DROP COLUMN IF EXISTS ai_enabled,
  DROP COLUMN IF EXISTS max_agents,
  DROP COLUMN IF EXISTS max_broadcasts_per_month,
  DROP COLUMN IF EXISTS max_contacts,
  DROP COLUMN IF EXISTS plan_tier,
  DROP COLUMN IF EXISTS status;

-- 5. Restore original is_account_member (without super admin bypass)
CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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
  );
$$;

ALTER FUNCTION is_account_member(UUID, account_role_enum) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_account_member(UUID, account_role_enum) TO authenticated, service_role;

-- 6. Drop is_super_admin helper & profile column
DROP FUNCTION IF EXISTS is_super_admin();

DROP INDEX IF EXISTS idx_profiles_super_admin;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS is_super_admin;

