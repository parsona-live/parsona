import { requireSuperAdmin } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminsManager, type AdminUser } from "@/components/admin/admins-manager";

export const dynamic = "force-dynamic";

export default async function AdminManagementPage() {
  const adminCtx = await requireSuperAdmin();
  const adminClient = createAdminClient();

  const { data: admins } = await adminClient
    .from("profiles")
    .select("id, email, full_name, admin_role, created_at")
    .eq("is_super_admin", true)
    .order("created_at", { ascending: true });

  const initialAdmins: AdminUser[] = (admins || []).map((a) => ({
    id: a.id,
    email: a.email,
    full_name: a.full_name,
    admin_role: a.admin_role || "super_admin",
    created_at: a.created_at,
  }));

  return (
    <AdminsManager
      initialAdmins={initialAdmins}
      currentAdminEmail={adminCtx.email}
    />
  );
}

