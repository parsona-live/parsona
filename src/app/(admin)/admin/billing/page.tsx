import { requireSuperAdmin } from "@/lib/auth/account";
import { CreditCard, ArrowUpRight, TrendingUp, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminBillingPage() {
  const { supabase } = await requireSuperAdmin();

  // Load plans, subscriptions, transactions and accounts in parallel
  const [
    { data: plans },
    { data: subscriptions },
    { data: transactions },
    { data: accounts },
  ] = await Promise.all([
    supabase.from("subscription_plans").select("*").order("price_inr", { ascending: true }),
    supabase.from("account_subscriptions").select("*"),
    supabase
      .from("payment_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("accounts").select("id, name"),
  ]);

  const accountNameMap = new Map<string, string>();
  if (accounts) {
    for (const a of accounts) accountNameMap.set(a.id, a.name);
  }

  // Calculate MRR from active subscriptions
  const planPriceMap = new Map<string, number>();
  if (plans) {
    for (const p of plans) planPriceMap.set(p.id, p.price_inr);
  }

  let mrr = 0;
  let activeSubCount = 0;
  if (subscriptions) {
    for (const sub of subscriptions) {
      if (sub.status === "active") {
        activeSubCount++;
        mrr += planPriceMap.get(sub.plan_id) ?? 0;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-amber-400" />
          Subscription Billing &amp; Revenue (Razorpay)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor recurring subscriptions, monthly recurring revenue, and payment transactions across all tenants.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Monthly Recurring Revenue (MRR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{mrr.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From active recurring business plans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tenants on paid subscription plans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-amber-400" />
              Payment Gateway
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Razorpay Ready
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              UPI Autopay, Cards, &amp; Invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Subscription Tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Active SaaS Plan Tiers</CardTitle>
          <CardDescription>Configured plans available to clients during onboarding and upgrade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans?.map((plan) => (
              <div key={plan.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{plan.name}</div>
                  <Badge variant="outline" className="text-xs capitalize font-semibold">
                    {plan.id}
                  </Badge>
                </div>
                <div className="text-xl font-extrabold text-foreground">
                  ₹{plan.price_inr} <span className="text-xs font-normal text-muted-foreground">/ month</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 border-t border-border/60 pt-2">
                  <div>• Max Contacts: <strong>{plan.max_contacts.toLocaleString()}</strong></div>
                  <div>• Broadcasts / mo: <strong>{plan.max_broadcasts_per_month.toLocaleString()}</strong></div>
                  <div>• Agents: <strong>{plan.max_agents}</strong></div>
                  <div>• AI &amp; OpenRouter: <strong>{plan.ai_enabled ? "Enabled" : "Disabled"}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Cross-Tenant Transactions</CardTitle>
          <CardDescription>Live payment ledger captured via Razorpay</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="pb-3">Business</th>
                  <th className="pb-3">Payment ID</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions && transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors text-xs">
                      <td className="py-3 font-medium text-foreground">
                        {accountNameMap.get(tx.account_id) ?? tx.account_id}
                      </td>
                      <td className="py-3 font-mono text-muted-foreground">{tx.razorpay_payment_id}</td>
                      <td className="py-3 font-bold text-foreground">₹{tx.amount_inr}</td>
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
                    <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      No payments captured yet.
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

