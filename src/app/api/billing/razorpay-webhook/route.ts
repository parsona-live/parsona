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
      case "payment_link.paid":
      case "payment.captured": {
        const paymentEntity = payload.payment?.entity || payload.payment_link?.entity;
        const notes = paymentEntity?.notes || {};
        const flowRunId = notes.flow_run_id;
        const successNodeKey = notes.success_node_key;

        // 1. If triggered by a Flow Automation run, resume and advance the flow
        if (flowRunId) {
          try {
            const { resumeFlowRunOnEvent } = await import("@/lib/flows/engine");
            const paidAmount = (paymentEntity.amount_paid || paymentEntity.amount || 0) / 100;
            await resumeFlowRunOnEvent({
              db: supabase,
              runId: flowRunId,
              targetNodeKey: successNodeKey,
              varsPatch: {
                payment_status: "paid",
                razorpay_payment_id: paymentEntity.id,
                paid_amount: paidAmount,
                payment_currency: paymentEntity.currency || "INR",
              },
              eventPayload: {
                provider: "razorpay",
                payment_id: paymentEntity.id,
                event: eventType,
                amount: paidAmount,
              },
            });
          } catch (flowErr) {
            console.error("[Razorpay Webhook] Flow resumption error:", flowErr);
          }
          break;
        }

        // 2. Otherwise handle SaaS Account Billing Subscriptions
        const payment = payload.payment?.entity;
        const accountId = payment?.notes?.accountId || notes.accountId;
        const planId = payment?.notes?.planId || notes.planId;

        if (accountId && payment?.id) {
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
