-- ============================================================
-- 061_razorpay_subscriptions.sql
--
-- Razorpay Billing & Subscription Engine for WAPP Multi-Tenant SaaS
--
-- What this migration adds:
--   1. subscription_plans — Available tiers (Starter, Pro, Enterprise)
--   2. account_subscriptions — Recurring active subscriptions linked to accounts
--   3. payment_transactions — Audit log of captured payments and renewals
--   4. RLS policies allowing tenants to see their billing, and
--      super admins to manage all billing data
--   5. Seeds standard INR subscription plans
--
-- Rollback file:
--   supabase/migrations/revert/061_razorpay_subscriptions_down.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Subscription Plans Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_inr INTEGER NOT NULL, -- price in rupees (e.g. 999 = ₹999)
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  max_contacts INTEGER NOT NULL DEFAULT 5000,
  max_broadcasts_per_month INTEGER NOT NULL DEFAULT 2000,
  max_agents INTEGER NOT NULL DEFAULT 5,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active subscription plans
DROP POLICY IF EXISTS subscription_plans_select ON subscription_plans;
CREATE POLICY subscription_plans_select ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = TRUE OR is_super_admin());

DROP POLICY IF EXISTS subscription_plans_manage ON subscription_plans;
CREATE POLICY subscription_plans_manage ON subscription_plans
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ------------------------------------------------------------
-- 2. Account Subscriptions Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account
  ON account_subscriptions(account_id);

ALTER TABLE account_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_subscriptions_select ON account_subscriptions;
CREATE POLICY account_subscriptions_select ON account_subscriptions
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS account_subscriptions_manage ON account_subscriptions;
CREATE POLICY account_subscriptions_manage ON account_subscriptions
  FOR ALL TO authenticated
  USING (is_account_member(account_id, 'admin') OR is_super_admin())
  WITH CHECK (is_account_member(account_id, 'admin') OR is_super_admin());

-- ------------------------------------------------------------
-- 3. Payment Transactions Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES subscription_plans(id),
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  razorpay_order_id TEXT,
  amount_inr NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'captured'
    CHECK (status IN ('captured', 'failed', 'refunded')),
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_account
  ON payment_transactions(account_id, created_at DESC);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_transactions_select ON payment_transactions;
CREATE POLICY payment_transactions_select ON payment_transactions
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS payment_transactions_manage ON payment_transactions;
CREATE POLICY payment_transactions_manage ON payment_transactions
  FOR ALL TO authenticated
  USING (is_account_member(account_id, 'admin') OR is_super_admin())
  WITH CHECK (is_account_member(account_id, 'admin') OR is_super_admin());

-- ------------------------------------------------------------
-- 4. Seed Standard Subscription Plans
-- ------------------------------------------------------------
INSERT INTO subscription_plans (
  id, name, description, price_inr, billing_interval,
  max_contacts, max_broadcasts_per_month, max_agents, ai_enabled, features
) VALUES
(
  'starter',
  'Starter Business',
  'Ideal for small shops and local services getting started on WhatsApp',
  999,
  'monthly',
  1000,
  500,
  2,
  TRUE,
  '["1,000 Contacts", "500 Broadcasts / mo", "2 Team Agents", "Shared Inbox & Kanban", "Basic AI Replies"]'::jsonb
),
(
  'pro',
  'Pro Growth',
  'For growing brands scaling sales funnels and automated campaigns',
  2499,
  'monthly',
  10000,
  5000,
  10,
  TRUE,
  '["10,000 Contacts", "5,000 Broadcasts / mo", "10 Team Agents", "OpenRouter & AI Knowledge Base", "Visual Flow Automations", "Priority Webhooks"]'::jsonb
),
(
  'enterprise',
  'Agency & Enterprise',
  'High-throughput WhatsApp engine with unlimited seats and dedicated support',
  6999,
  'monthly',
  100000,
  50000,
  50,
  TRUE,
  '["100,000 Contacts", "50,000 Broadcasts / mo", "50 Team Agents", "Unlimited OpenRouter AI", "Multi-WABA Support", "Dedicated Webhook Queues"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_inr = EXCLUDED.price_inr,
  max_contacts = EXCLUDED.max_contacts,
  max_broadcasts_per_month = EXCLUDED.max_broadcasts_per_month,
  max_agents = EXCLUDED.max_agents,
  features = EXCLUDED.features;

-- ------------------------------------------------------------
-- 5. Guard new billing tables in redeem_invitation RPC
-- Prevent deleting an account that carries active subscriptions or payment history
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_has_other_members BOOLEAN;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id
  FOR UPDATE OF p, a;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;

  IF v_old_account_id = v_inv.account_id THEN
    RAISE EXCEPTION 'You are already a member of this account'
      USING ERRCODE = '23505';
  END IF;

  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'You are already in a shared account; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE account_id = v_old_account_id
      AND user_id <> v_caller_id
  ) INTO v_has_other_members;

  IF v_has_other_members THEN
    RAISE EXCEPTION 'Your account has other members; remove them or transfer ownership before joining another account'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM contacts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM conversations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM broadcasts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automation_logs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automation_pending_executions WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flows WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flow_runs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM pipelines WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM deals WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM message_templates WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM tags WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM custom_fields WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM contact_notes WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM whatsapp_config WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM api_keys WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM webhook_endpoints WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM quick_replies WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM notifications WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_configs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_knowledge_documents WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_knowledge_chunks WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_usage_log WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM account_subscriptions WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM payment_transactions WHERE account_id = v_old_account_id
    LIMIT 1
  ) INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Your account already contains data; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  UPDATE profiles
  SET account_id = v_inv.account_id,
      account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  DELETE FROM accounts WHERE id = v_old_account_id;

  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
