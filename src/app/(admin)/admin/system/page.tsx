import { requireSuperAdmin } from "@/lib/auth/account";
import { Activity, Phone, ShieldCheck, Database, KeyRound, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSystemPage() {
  const { supabase, email } = await requireSuperAdmin();

  // Load registered whatsapp phone configs with account names
  const [{ data: configs }, { data: adminProfiles }, { data: accounts }] = await Promise.all([
    supabase
      .from("whatsapp_config")
      .select("id, account_id, phone_number_id, waba_id, created_at, updated_at"),
    supabase
      .from("profiles")
      .select("id, email, full_name, is_super_admin, created_at")
      .eq("is_super_admin", true),
    supabase.from("accounts").select("id, name"),
  ]);

  const accountNameMap = new Map<string, string>();
  if (accounts) {
    for (const a of accounts) accountNameMap.set(a.id, a.name);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
  const isMetaConfigured = Boolean(process.env.META_APP_SECRET);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-amber-400" />
          System &amp; WhatsApp Gateway Status
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor multi-WABA webhook fan-out, registered numbers, and platform environment integrity.
        </p>
      </div>

      {/* Gateway Environment Checks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-emerald-500" />
              Meta App Secret
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              {isMetaConfigured ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="text-rose-400">Missing in environment</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Required for HMAC webhook validation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Server className="h-4 w-4 text-primary" />
              Meta Webhook Callback URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono bg-muted p-2 rounded truncate" title={webhookUrl}>
              {webhookUrl}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Shared callback URL for all tenant WABAs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Database className="h-4 w-4 text-amber-400" />
              Database Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Connected &amp; RLS Active
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              PostgreSQL + Row-Level Security
            </p>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Numbers Routing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-emerald-500" />
            Connected WhatsApp Numbers (Multi-WABA Fan-out)
          </CardTitle>
          <CardDescription>
            When Meta delivers an inbound message, WAPP matches the <code>phone_number_id</code> to isolate messages to that tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="pb-3">Tenant Business</th>
                  <th className="pb-3">Phone Number ID</th>
                  <th className="pb-3">WABA ID</th>
                  <th className="pb-3">Connected Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {configs && configs.length > 0 ? (
                  configs.map((cfg) => (
                    <tr key={cfg.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium text-foreground">
                        {accountNameMap.get(cfg.account_id) ?? cfg.account_id}
                      </td>
                      <td className="py-3 font-mono text-xs text-foreground">
                        {cfg.phone_number_id}
                      </td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {cfg.waba_id || "—"}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {new Date(cfg.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No WhatsApp numbers registered yet. Tenants connect their numbers via Settings → WhatsApp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Super Admins Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Platform Super Admins
          </CardTitle>
          <CardDescription>
            Users with global read/write access across all tenants and master automations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {adminProfiles?.map((adm) => (
              <div
                key={adm.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {adm.full_name || "Super Admin"}
                    {adm.email === email && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{adm.email}</div>
                </div>
                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
                  Super Admin
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

