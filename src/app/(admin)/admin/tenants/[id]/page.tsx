import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantDetailView, type TenantDetailData } from "@/components/admin/tenant-detail-view";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id: tenantId } = await params;
  const adminClient = createAdminClient();

  // 1. Fetch Account
  const { data: account, error: accErr } = await adminClient
    .from("accounts")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (accErr || !account) {
    notFound();
  }

  // 2. Parallel queries for child resources
  const [
    { data: waData },
    { data: flowsData },
    { data: aiData },
    { data: membersData },
    { data: templatesData },
    { count: contactsCount },
    { count: messagesCount },
  ] = await Promise.all([
    adminClient
      .from("whatsapp_configs")
      .select("phone_number, phone_number_id, waba_id, status")
      .eq("account_id", tenantId)
      .maybeSingle(),
    adminClient
      .from("flows")
      .select("id, name, description, status, trigger_type, created_at, updated_at")
      .eq("account_id", tenantId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("ai_configs")
      .select("provider, model, system_prompt, is_enabled")
      .eq("account_id", tenantId)
      .maybeSingle(),
    adminClient
      .from("profiles")
      .select("id, email, full_name, account_role, created_at")
      .eq("account_id", tenantId)
      .order("created_at", { ascending: true }),
    adminClient
      .from("flows")
      .select("id, name, description")
      .eq("is_template", true)
      .order("name", { ascending: true }),
    adminClient
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("account_id", tenantId),
    adminClient
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("account_id", tenantId),
  ]);

  const initialData: TenantDetailData = {
    account: {
      id: account.id,
      name: account.name,
      status: account.status || "active",
      plan_tier: account.plan_tier || "custom",
      created_at: account.created_at,
      negotiated_price_inr: account.negotiated_price_inr ? Number(account.negotiated_price_inr) : 0,
      billing_cycle_day: account.billing_cycle_day || 1,
      billing_status: account.billing_status || "active",
      billing_notes: account.billing_notes || null,
      internal_notes: account.internal_notes || null,
      max_contacts: account.max_contacts,
      max_broadcasts_per_month: account.max_broadcasts_per_month,
      ai_messages_quota: account.ai_messages_quota,
    },
    whatsappConfig: waData || null,
    flows: flowsData || [],
    aiConfig: aiData || null,
    members: (membersData || []).map((m) => ({
      id: m.id,
      email: m.email,
      full_name: m.full_name,
      account_role: m.account_role || "member",
      created_at: m.created_at,
    })),
    templates: templatesData || [],
    stats: {
      contactsCount: contactsCount || 0,
      messagesCount: messagesCount || 0,
      flowsCount: flowsData?.length || 0,
    },
  };

  return <TenantDetailView initialData={initialData} />;
}

