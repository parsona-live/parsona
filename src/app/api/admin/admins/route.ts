import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

function generateSecurePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return pass;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const adminClient = createAdminClient();

    const { data: admins, error } = await adminClient
      .from("profiles")
      .select("id, email, full_name, is_super_admin, admin_role, created_at")
      .eq("is_super_admin", true)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ admins: admins || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCtx = await requireSuperAdmin();
    const body = await request.json();
    const { email, fullName, role, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const assignedRole = role || "super_admin";
    const finalPassword = password && password.trim().length >= 6 ? password.trim() : generateSecurePassword();

    const adminClient = createAdminClient();

    // 1. Check if user already exists
    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existing = userList?.users.find((u) => u.email?.toLowerCase() === cleanEmail);

    let userId: string;
    let isNewUser = false;

    if (existing) {
      userId = existing.id;
      // Promote existing user to super admin
      await adminClient
        .from("profiles")
        .update({
          is_super_admin: true,
          admin_role: assignedRole,
          full_name: fullName || undefined,
        })
        .eq("id", userId);
    } else {
      // Create new admin user
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || "Platform Administrator",
        },
      });

      if (createErr || !newUser.user) {
        return NextResponse.json({ error: createErr?.message || "Failed to create administrator account" }, { status: 500 });
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Upsert profile
      await adminClient.from("profiles").upsert({
        id: userId,
        user_id: userId,
        email: cleanEmail,
        full_name: fullName || "Platform Administrator",
        is_super_admin: true,
        admin_role: assignedRole,
        account_role: "owner",
      });
    }

    // Audit log
    try {
      await adminClient.from("admin_audit_logs").insert({
        actor_id: adminCtx.profile.id,
        actor_email: adminCtx.email || "admin@wapp.internal",
        action: "add_super_admin",
        details: { targetEmail: cleanEmail, role: assignedRole, isNewUser },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: userId,
        email: cleanEmail,
        fullName: fullName || "Platform Administrator",
        role: assignedRole,
        isNewUser,
        temporaryPassword: isNewUser ? finalPassword : null,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

