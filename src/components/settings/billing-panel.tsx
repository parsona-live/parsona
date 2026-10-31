"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CreditCard, Check, Sparkles, ShieldCheck, Zap, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_inr: number;
  max_contacts: number;
  max_broadcasts_per_month: number;
  max_agents: number;
  ai_enabled: boolean;
  features: string[];
}

interface PaymentTransaction {
  id: string;
  razorpay_payment_id: string;
  amount_inr: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

export function BillingPanel() {
  const { account, accountId, canEditSettings } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [accountPlan, setAccountPlan] = useState<string>("starter");
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load plans, transactions and current account plan
        const [{ data: plansData }, { data: paymentsData }, { data: accData }] =
          await Promise.all([
            supabase
              .from("subscription_plans")
              .select("*")
              .eq("is_active", true)
              .order("price_inr", { ascending: true }),
            supabase
              .from("payment_transactions")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(10),
            supabase.from("accounts").select("plan_tier, status").eq("id", accountId ?? "").single(),
          ]);

        if (plansData) {
          setPlans(
            plansData.map((p) => ({
              ...p,
              features: Array.isArray(p.features) ? p.features : [],
            }))
          );
        }
        if (paymentsData) setPayments(paymentsData);
        if (accData?.plan_tier) setAccountPlan(accData.plan_tier);
      } catch (err) {
        console.error("Failed to load billing details:", err);
      } finally {
        setLoading(false);
      }
    }
    if (accountId) loadData();
  }, [accountId, supabase]);

  // Handle Razorpay Checkout
  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (!canEditSettings) {
      alert("Only account Admins or Owners can manage billing subscriptions.");
      return;
    }

    try {
      setUpgradingId(plan.id);

      // 1. Create order on server
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || "Order creation failed");

      // 2. Load Razorpay script dynamically if not present
      if (!(window as any).Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      // 3. Open Razorpay Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "WAPP CRM Platform",
        description: `Subscription for ${orderData.planName}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          // Verify on backend
          const verifyRes = await fetch("/api/billing/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setAccountPlan(plan.id);
            alert(`Payment successful! Welcome to the ${plan.name} plan.`);
            window.location.reload();
          } else {
            alert(`Verification failed: ${verifyData.error}`);
          }
        },
        theme: {
          color: "#f59e0b",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment initialization failed");
    } finally {
      setUpgradingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
        Loading billing details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Subscription &amp; Plans
              </CardTitle>
              <CardDescription className="mt-1">
                Manage your monthly subscription, payment methods, and plan limits powered by Razorpay.
              </CardDescription>
            </div>
            <Badge variant="outline" className="capitalize text-xs font-semibold px-3 py-1 bg-primary/10 text-primary border-primary/30">
              Active Plan: {accountPlan}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Plans Pricing Grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Choose a Plan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = accountPlan === p.id;
            const isUpgrading = upgradingId === p.id;

            return (
              <Card
                key={p.id}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "border-amber-500/60 shadow-md bg-amber-500/[0.02]"
                    : "border-border hover:border-border/80"
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">{p.name}</CardTitle>
                    {isCurrent && (
                      <Badge className="bg-amber-500 text-black font-semibold text-[10px]">
                        Current
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs min-h-[36px]">{p.description}</CardDescription>
                  <div className="mt-4 flex items-baseline text-2xl font-extrabold text-foreground">
                    ₹{p.price_inr}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">/ month</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 pt-0 text-xs">
                  <div className="border-t border-border pt-3 space-y-2">
                    {p.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    className={`w-full text-xs font-semibold ${
                      isCurrent
                        ? "bg-muted text-muted-foreground hover:bg-muted"
                        : "bg-amber-600 hover:bg-amber-500 text-white"
                    }`}
                    disabled={isCurrent || isUpgrading}
                    onClick={() => handleUpgrade(p)}
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      "Pay with Razorpay"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Recent Invoices &amp; Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="pb-3">Payment ID</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length > 0 ? (
                  payments.map((tx) => (
                    <tr key={tx.id} className="text-xs">
                      <td className="py-3 font-mono text-foreground">{tx.razorpay_payment_id}</td>
                      <td className="py-3 font-semibold">₹{tx.amount_inr}</td>
                      <td className="py-3 capitalize text-muted-foreground">{tx.payment_method || "UPI / Card"}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

