import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { verifyRazorpaySignature } from "@/lib/billing/razorpay";

export async function POST(request: NextRequest) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return NextResponse.json({ error: "Missing required payment fields" }, { status: 400 });
    }

    // Verify HMAC SHA-256 signature
    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Load plan details to update account limits
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Record payment transaction
    await supabase.from("payment_transactions").insert({
      account_id: accountId,
      plan_id: planId,
      razorpay_payment_id,
      razorpay_order_id,
      amount_inr: plan.price_inr,
      currency: "INR",
      status: "captured",
    });

    // Record / Update subscription
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await supabase.from("account_subscriptions").insert({
      account_id: accountId,
      plan_id: planId,
      status: "active",
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
    });

    // Update account status and limits
    await supabase
      .from("accounts")
      .update({
        plan_tier: planId,
        status: "active",
        max_contacts: plan.max_contacts,
        max_broadcasts_per_month: plan.max_broadcasts_per_month,
        max_agents: plan.max_agents,
        ai_enabled: plan.ai_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    return NextResponse.json({ success: true, plan: plan.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

