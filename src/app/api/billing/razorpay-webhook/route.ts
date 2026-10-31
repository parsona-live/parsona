import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/billing/razorpay";
import { supabaseAdmin } from "@/lib/ai/admin-client";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!verifyRazorpayWebhookSignature({ payload: rawBody, signature })) {
      console.warn("[Razorpay Webhook] Invalid signature rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;

    const supabase = supabaseAdmin();

    switch (eventType) {
      case "payment.captured": {
        const payment = payload.payment.entity;
        const accountId = payment.notes?.accountId;
        const planId = payment.notes?.planId;

        if (accountId && payment.id) {
          const amountInr = payment.amount / 100;
          await supabase.from("payment_transactions").upsert(
            {
              account_id: accountId,
              plan_id: planId,
              razorpay_payment_id: payment.id,
              razorpay_order_id: payment.order_id,
              amount_inr: amountInr,
              currency: payment.currency || "INR",
              status: "captured",
              payment_method: payment.method,
            },
            { onConflict: "razorpay_payment_id" }
          );

          // Extend subscription
          if (planId) {
            await supabase
              .from("accounts")
              .update({ status: "active", plan_tier: planId })
              .eq("id", accountId);
          }
        }
        break;
      }

      case "subscription.halted":
      case "payment.failed": {
        const entity = payload.payment?.entity || payload.subscription?.entity;
        const accountId = entity?.notes?.accountId;
        if (accountId) {
          await supabase
            .from("accounts")
            .update({ status: "past_due" })
            .eq("id", accountId);
        }
        break;
      }

      case "subscription.cancelled": {
        const entity = payload.subscription?.entity;
        const accountId = entity?.notes?.accountId;
        if (accountId) {
          await supabase
            .from("accounts")
            .update({ status: "suspended", plan_tier: "free" })
            .eq("id", accountId);
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Razorpay Webhook] Processing error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
