import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/account";
import {
  Building2,
  Phone,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const { supabase } = await requireSuperAdmin();

  // Load KPI counts in parallel
  const [
    { count: totalAccounts },
    { count: activeAccounts },
    { count: suspendedAccounts },
    { count: totalNumbers },
    { count: totalTemplates },
    { data: recentAccounts },
  ] = await Promise.all([
    supabase.from("accounts").select("*", { count: "exact", head: true }),
    supabase.from("accounts").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("accounts").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("whatsapp_config").select("*", { count: "exact", head: true }),
    supabase.from("flows").select("*", { count: "exact", head: true }).eq("is_template", true),
    supabase
      .from("accounts")
      .select("id, name, status, plan_tier, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Platform Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central management for all multi-tenant businesses, automated flows, and WhatsApp routing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/automations"
            className={buttonVariants({ variant: "outline" })}
          >
            <Workflow className="h-4 w-4 mr-2" />
            Master Flows
          </Link>
          <Link
            href="/admin/tenants"
            className={buttonVariants({ variant: "default" })}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Manage Tenants
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Businesses
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccounts ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="text-emerald-500 font-medium flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-0.5 inline" />
                {activeAccounts ?? 0} active
              </span>
              <span>•</span>
              <span className="text-rose-400 font-medium flex items-center">
                <AlertTriangle className="h-3 w-3 mr-0.5 inline" />
                {suspendedAccounts ?? 0} suspended
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              WhatsApp Numbers
            </CardTitle>
            <Phone className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNumbers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active WABA phone connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Master Templates
            </CardTitle>
            <Workflow className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTemplates ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Automations ready for assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Super Admin Mode
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">Active</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cross-tenant RLS bypass enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tenants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recently Registered Businesses</CardTitle>
            <CardDescription>Latest client workspaces created on WAPP</CardDescription>
          </div>
          <Link
            href="/admin/tenants"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex items-center gap-1 text-xs")}
          >
            View All <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="pb-3">Business Name</th>
                  <th className="pb-3">Plan Tier</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentAccounts && recentAccounts.length > 0 ? (
                  recentAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 font-medium text-foreground">{acc.name}</td>
                      <td className="py-3">
                        <span className="capitalize px-2 py-0.5 rounded text-xs bg-muted border border-border">
                          {acc.plan_tier || "starter"}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            acc.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {acc.status || "active"}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {new Date(acc.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/admin/tenants?search=${encodeURIComponent(acc.name)}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No businesses found.
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
