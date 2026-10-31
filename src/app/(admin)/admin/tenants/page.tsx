import { requireSuperAdmin } from "@/lib/auth/account";
import { TenantsManager, TenantRow, TemplateFlow } from "@/components/admin/tenants-manager";
import { Building2 } from "lucide-react";

export default async function AdminTenantsPage() {
  const { supabase } = await requireSuperAdmin();

  // Load all accounts with whatsapp config info and templates in parallel
  const [{ data: accounts, error: accErr }, { data: configs }, { data: templates }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, status, plan_tier, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("whatsapp_config").select("account_id, phone_number_id"),
      supabase
        .from("flows")
        .select("id, name, description")
        .eq("is_template", true)
        .order("name", { ascending: true }),
    ]);

  if (accErr) {
    console.error("[AdminTenantsPage] fetch error:", accErr);
  }

  // Map whatsapp config onto accounts
  const configMap = new Map<string, string>();
  if (configs) {
    for (const cfg of configs) {
      if (cfg.account_id && cfg.phone_number_id) {
        configMap.set(cfg.account_id, cfg.phone_number_id);
      }
    }
  }

  const tenantRows: TenantRow[] = (accounts ?? []).map((acc) => ({
    id: acc.id,
    name: acc.name,
    status: acc.status || "active",
    plan_tier: acc.plan_tier || "starter",
    created_at: acc.created_at,
    whatsapp_phone: configMap.get(acc.id) ?? null,
  }));

  const templateFlows: TemplateFlow[] = (templates ?? []).map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Tenants & Businesses
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all client organizations, assign master automations, and impersonate accounts for live support.
        </p>
      </div>

      <TenantsManager initialTenants={tenantRows} templates={templateFlows} />
    </div>
  );
}

