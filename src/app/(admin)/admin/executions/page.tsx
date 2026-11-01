import { requireSuperAdmin } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExecutionsMonitor, type ExecutionRow } from "@/components/admin/executions-monitor";

export const dynamic = "force-dynamic";

export default async function AdminExecutionsPage() {
  await requireSuperAdmin();
  const adminClient = createAdminClient();

  // Load latest flow runs across all tenants
  const { data: runs } = await adminClient
    .from("flow_runs")
    .select(`
      id,
      flow_id,
      account_id,
      status,
      started_at,
      completed_at,
      error_message,
      flows (name),
      accounts (name)
    `)
    .order("started_at", { ascending: false })
    .limit(100);

  const initialExecutions: ExecutionRow[] = (runs || []).map((r: any) => ({
    id: r.id,
    flow_id: r.flow_id,
    flow_name: r.flows?.name || "Automated Flow",
    account_id: r.account_id,
    account_name: r.accounts?.name || "Unknown Tenant",
    status: r.status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    error_message: r.error_message,
  }));

  return <ExecutionsMonitor initialExecutions={initialExecutions} />;
}

