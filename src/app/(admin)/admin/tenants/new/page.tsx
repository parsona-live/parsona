import { requireSuperAdmin } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantOnboardingWizard } from "@/components/admin/tenant-onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardNewTenantPage() {
  await requireSuperAdmin();
  const adminClient = createAdminClient();

  // Load available master flow templates to pre-select
  const { data: templates } = await adminClient
    .from("flows")
    .select("id, name, description")
    .eq("is_template", true)
    .order("name", { ascending: true });

  return (
    <TenantOnboardingWizard
      templates={
        templates?.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })) || []
      }
    />
  );
}

