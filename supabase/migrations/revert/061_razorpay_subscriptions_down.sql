-- ============================================================
-- 061_razorpay_subscriptions_down.sql
--
-- Revert script for migration 061.
-- Drops subscription and payment tables and their policies.
-- ============================================================

DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS account_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;

