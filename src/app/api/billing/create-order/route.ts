import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/account";
import { createRazorpayOrder } from "@/lib/billing/razorpay";

export async function POST(request: NextRequest) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Load plan details
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("id, name, price_inr")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }

    const order = await createRazorpayOrder({
      amountInr: plan.price_inr,
      accountId,
      planId: plan.id,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
      planName: plan.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

