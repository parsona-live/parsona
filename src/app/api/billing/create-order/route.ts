import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { createRazorpayOrder } from "@/lib/billing/razorpay";

export async function POST(request: NextRequest) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const body = await request.json().catch(() => ({}));
    const { planId, isMonthlyPayment } = body;

    let amountInr = 0;
    let targetPlanId: string | null = planId || null;
    let planDisplayName = "Monthly Business Subscription";

    if (isMonthlyPayment || !planId || planId === "custom") {
      // Custom negotiated monthly payment for this tenant
      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .select("id, name, negotiated_price_inr, billing_status")
        .eq("id", accountId)
        .single();

      if (accErr || !account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      const price = Number(account.negotiated_price_inr ?? 0);
      if (price <= 0) {
        return NextResponse.json(
          { error: "No custom monthly price has been set by your platform administrator yet." },
          { status: 400 }
        );
      }

      amountInr = price;
      targetPlanId = "custom";
      planDisplayName = `Custom Business Plan (₹${price.toLocaleString("en-IN")}/mo)`;
    } else {
      // Standard plan lookup
      const { data: plan, error: planErr } = await supabase
        .from("subscription_plans")
        .select("id, name, price_inr")
        .eq("id", planId)
        .eq("is_active", true)
        .single();

      if (planErr || !plan) {
        return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
      }

      amountInr = plan.price_inr;
      targetPlanId = plan.id;
      planDisplayName = plan.name;
    }

    const order = await createRazorpayOrder({
      amountInr,
      accountId,
      planId: targetPlanId || "custom",
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
      planName: planDisplayName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
