"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ShieldCheck,
  History,
  Loader2,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface PaymentTransaction {
  id: string;
  razorpay_payment_id: string;
  amount_inr: number;
  status: string;
  created_at: string;
}

interface AccountBillingInfo {
  negotiated_price_inr?: number;
  billing_cycle_day?: number;
  billing_status?: string;
  billing_notes?: string | null;
  status?: string;
  name?: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

export function BillingPanel() {
  const { account, accountId, canEditSettings } = useAuth();
  const [billingInfo, setBillingInfo] = useState<AccountBillingInfo | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [{ data: accData }, { data: paymentsData }] = await Promise.all([
        supabase
          .from("accounts")
          .select("name, negotiated_price_inr, billing_cycle_day, billing_status, billing_notes, status")
          .eq("id", accountId ?? "")
          .maybeSingle(),
        supabase
          .from("payment_transactions")
          .select("id, razorpay_payment_id, amount_inr, status, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (accData) {
        setBillingInfo({
          ...accData,
          negotiated_price_inr: accData.negotiated_price_inr ? Number(accData.negotiated_price_inr) : 0,
        });
      }
      if (paymentsData) setPayments(paymentsData);
    } catch (err) {
      console.error("Failed to load billing details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) loadData();
  }, [accountId]);

  // Load Razorpay Script dynamically
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle Monthly Payment Checkout
  const handlePayMonthlyBill = async () => {
    if (!canEditSettings) {
      alert("Only account Admins or Owners can make billing payments.");
      return;
    }

    try {
      setPaying(true);
      setErrorMsg(null);

      // 1. Create order on server for custom negotiated price
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMonthlyPayment: true }),
      });

      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || "Failed to initiate payment");

      // 2. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Could not load Razorpay checkout SDK. Check your internet connection.");

      // 3. Launch Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "WAPP Automation CRM",
        description: `Monthly Subscription for ${billingInfo?.name || "your account"}`,
        order_id: orderData.orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            setPaying(true);
            const verifyRes = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: "custom",
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

            setPaymentSuccess("Payment successful! Your monthly subscription is active.");
            await loadData();
          } catch (vErr) {
            setErrorMsg(vErr instanceof Error ? vErr.message : "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        theme: {
          color: "#059669", // Emerald brand color
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to open payment gateway");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </Card>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </Card>
      </div>
    );
  }

  const monthlyPrice = billingInfo?.negotiated_price_inr ?? 0;
  const isConfigured = monthlyPrice > 0;
  const cycleDay = billingInfo?.billing_cycle_day ?? 1;
  const status = billingInfo?.billing_status || "active";

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {paymentSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Subscription Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-500" />
                Monthly Subscription &amp; Agreement
              </CardTitle>
              <CardDescription className="text-xs">
                Your custom commercial terms negotiated with your account administrator
              </CardDescription>
            </div>
            <div>
              {status === "active" ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Subscription Active
                </span>
              ) : status === "payment_due" ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Clock className="h-3.5 w-3.5" />
                  Payment Due
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Overdue
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isConfigured ? (
            <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Negotiated Monthly Charge
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl font-extrabold text-foreground tracking-tight">
                      ₹{monthlyPrice.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">/ month</span>
                  </div>
                </div>

                <Button
                  onClick={handlePayMonthlyBill}
                  disabled={paying}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md px-6 h-11"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Opening Gateway...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay Monthly Bill (₹{monthlyPrice.toLocaleString("en-IN")})
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>
                    Billed on the <strong>{cycleDay}th</strong> of every calendar month.
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Secured by Razorpay with instant GST invoice generation.</span>
                </div>
              </div>

              {billingInfo?.billing_notes && (
                <div className="p-3.5 rounded-lg border border-border/80 bg-background text-xs space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Included Plan Scope:
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {billingInfo.billing_notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm">Custom Commercial Terms Pending</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Your platform administrator is currently finalizing your custom monthly rate. You will be able to make payments directly from this screen as soon as your rate is confirmed.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Payment History &amp; Receipts
          </CardTitle>
          <CardDescription className="text-xs">
            Review past monthly subscription charges and payment transaction IDs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payment ID</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length > 0 ? (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-foreground font-medium">
                        {p.razorpay_payment_id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        ₹{Number(p.amount_inr).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No payment history recorded yet.
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
