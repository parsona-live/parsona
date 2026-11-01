import { NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetAdminId } = await params;
    const adminCtx = await requireSuperAdmin();

    // Guard: Prevent revoking yourself
    if (adminCtx.profile.id === targetAdminId || adminCtx.userId === targetAdminId) {
      return NextResponse.json(
        { error: "You cannot revoke your own administrator account." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check how many super admins exist
    const { count } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_super_admin", true);

    if (count !== null && count <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last platform Super Admin." },
        { status: 400 }
      );
    }

    // Revoke super admin status
    const { error } = await adminClient
      .from("profiles")
      .update({ is_super_admin: false, admin_role: null })
      .eq("id", targetAdminId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    try {
      await adminClient.from("admin_audit_logs").insert({
        actor_id: adminCtx.profile.id,
        actor_email: adminCtx.email || "admin@wapp.internal",
        action: "revoke_super_admin",
        details: { targetAdminId },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

