import { requireSuperAdmin } from "@/lib/auth/account";
import {
  AutomationsManager,
  MasterTemplate,
  TenantOption,
} from "@/components/admin/automations-manager";
import { Workflow } from "lucide-react";

export default async function AdminAutomationsPage() {
  const { supabase } = await requireSuperAdmin();

  // Load all master templates, accounts, and deployed clones in parallel
  const [
    { data: templates, error: tplErr },
    { data: accounts },
    { data: assignedClones },
  ] = await Promise.all([
    supabase
      .from("flows")
      .select("id, name, description, trigger_type, status, template_category, created_at")
      .eq("is_template", true)
      .order("created_at", { ascending: false }),
    supabase.from("accounts").select("id, name").order("name", { ascending: true }),
    supabase
      .from("flows")
      .select("origin_template_id")
      .not("origin_template_id", "is", null),
  ]);

  if (tplErr) {
    console.error("[AdminAutomationsPage] error:", tplErr);
  }

  // Count assignments per template
  const countsMap = new Map<string, number>();
  if (assignedClones) {
    for (const clone of assignedClones) {
      if (clone.origin_template_id) {
        countsMap.set(
          clone.origin_template_id,
          (countsMap.get(clone.origin_template_id) ?? 0) + 1
        );
      }
    }
  }

  const initialTemplates: MasterTemplate[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    trigger_type: t.trigger_type,
    status: t.status,
    template_category: t.template_category,
    created_at: t.created_at,
    assignedCount: countsMap.get(t.id) ?? 0,
  }));

  const tenantOptions: TenantOption[] = (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Workflow className="h-6 w-6 text-amber-400" />
          Master Automations &amp; Flows
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build global chatbot funnels and automation templates that can be cloned and managed across all client accounts.
        </p>
      </div>

      <AutomationsManager
        initialTemplates={initialTemplates}
        tenants={tenantOptions}
      />
    </div>
  );
}

