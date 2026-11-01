import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { verifyRazorpaySignature } from "@/lib/billing/razorpay";

export async function POST(request: NextRequest) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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

    let planName = "Custom Business Plan";
    let amountInr = 0;

    if (!planId || planId === "custom") {
      // Negotiated plan
      const { data: acc } = await supabase
        .from("accounts")
        .select("negotiated_price_inr")
        .eq("id", accountId)
        .single();
      amountInr = Number(acc?.negotiated_price_inr ?? 0);
      planName = `Custom Monthly Plan (₹${amountInr.toLocaleString("en-IN")})`;
    } else {
      // Standard plan
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (plan) {
        amountInr = plan.price_inr;
        planName = plan.name;
      }
    }

    // Record payment transaction
    await supabase.from("payment_transactions").insert({
      account_id: accountId,
      plan_id: planId && planId !== "custom" ? planId : null,
      razorpay_payment_id,
      razorpay_order_id,
      amount_inr: amountInr,
      currency: "INR",
      status: "captured",
    });

    // Record / Update subscription
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await supabase.from("account_subscriptions").insert({
      account_id: accountId,
      plan_id: planId && planId !== "custom" ? planId : null,
      status: "active",
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
    });

    // Update account status to active
    await supabase
      .from("accounts")
      .update({
        status: "active",
        billing_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    return NextResponse.json({ success: true, plan: planName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
