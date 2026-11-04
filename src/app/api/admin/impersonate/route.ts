import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATOR_COOKIE_NAME,
  IS_IMPERSONATING_COOKIE_NAME,
  IMPERSONATED_ACCOUNT_ID_COOKIE,
  IMPERSONATED_TENANT_NAME_COOKIE,
  IMPERSONATED_USER_EMAIL_COOKIE,
  IMPERSONATED_USER_ROLE_COOKIE,
  IMPERSONATION_MAX_AGE_SECONDS,
} from "@/lib/admin/impersonation";

const isProd = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdmin();
    const body = await request.json().catch(() => ({}));
    const { accountId, userId } = body;

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Verify tenant account exists
    const { data: account, error: accErr } = await adminClient
      .from("accounts")
      .select("id, name, owner_user_id")
      .eq("id", accountId)
      .maybeSingle();

    if (accErr || !account) {
      return NextResponse.json({ error: "Tenant account not found" }, { status: 404 });
    }

    // 2. Identify target user to impersonate
    let targetProfile: {
      id: string;
      user_id: string;
      email: string;
      full_name: string | null;
      account_role: string | null;
    } | null = null;

    if (userId && typeof userId === "string") {
      const { data, error } = await adminClient
        .from("profiles")
        .select("id, user_id, email, full_name, account_role")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        targetProfile = data;
      }
    }

    // Fall back to tenant owner if userId was not provided or not found
    if (!targetProfile) {
      const { data: ownerProfile } = await adminClient
        .from("profiles")
        .select("id, user_id, email, full_name, account_role")
        .eq("account_id", accountId)
        .eq("account_role", "owner")
        .maybeSingle();

      if (ownerProfile) {
        targetProfile = ownerProfile;
      } else {
        // Fall back to any member in this account
        const { data: anyMember } = await adminClient
          .from("profiles")
          .select("id, user_id, email, full_name, account_role")
          .eq("account_id", accountId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        targetProfile = anyMember ?? null;
      }
    }

    if (!targetProfile || !targetProfile.email) {
      return NextResponse.json(
        {
          error:
            "This tenant account has no active users to impersonate. Please invite or onboard a user first.",
        },
        { status: 404 },
      );
    }

    // 3. Generate single-use Supabase Auth magiclink for target user
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("[impersonate] generateLink error:", linkErr);
      return NextResponse.json(
        { error: "Failed to generate impersonation session token" },
        { status: 500 },
      );
    }

    // 4. Create encrypted Super Admin return token
    const now = Date.now();
    const encryptedToken = createImpersonationToken({
      adminUserId: superAdmin.userId,
      adminProfileId: superAdmin.profile.id,
      adminEmail: superAdmin.email,
      adminName: superAdmin.profile.fullName || "Super Admin",
      tenantAccountId: account.id,
      tenantUserId: targetProfile.user_id,
      tenantEmail: targetProfile.email,
      tenantRole: targetProfile.account_role || "owner",
      createdAt: now,
      expiresAt: now + IMPERSONATION_MAX_AGE_SECONDS * 1000,
    });

    // 5. Audit log: impersonation started
    try {
      await adminClient.from("admin_audit_logs").insert({
        actor_id: superAdmin.profile.id,
        actor_email: superAdmin.email,
        action: "impersonation_started",
        tenant_id: account.id,
        details: {
          targetUserId: targetProfile.user_id,
          targetUserEmail: targetProfile.email,
          targetRole: targetProfile.account_role,
        },
      });
    } catch (auditErr) {
      console.warn("[impersonate] Failed to record audit log:", auditErr);
    }

    // 6. Set impersonation tracking cookies
    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATOR_COOKIE_NAME, encryptedToken, {
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: true,
      secure: isProd,
    });

    cookieStore.set(IS_IMPERSONATING_COOKIE_NAME, "true", {
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false,
      secure: isProd,
    });

    cookieStore.set(IMPERSONATED_ACCOUNT_ID_COOKIE, account.id, {
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false,
      secure: isProd,
    });

    cookieStore.set(IMPERSONATED_TENANT_NAME_COOKIE, encodeURIComponent(account.name), {
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false,
      secure: isProd,
    });

    cookieStore.set(IMPERSONATED_USER_EMAIL_COOKIE, encodeURIComponent(targetProfile.email), {
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false,
      secure: isProd,
    });

    cookieStore.set(IMPERSONATED_USER_ROLE_COOKIE, targetProfile.account_role || "owner", {
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false,
      secure: isProd,
    });

    const redirectUrl = `/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/dashboard`;

    return NextResponse.json({
      success: true,
      account,
      targetUser: {
        id: targetProfile.user_id,
        email: targetProfile.email,
        role: targetProfile.account_role,
      },
      redirectUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to impersonate";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const impersonatorCookie = cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value;

    const clearCookies = () => {
      cookieStore.delete(IMPERSONATOR_COOKIE_NAME);
      cookieStore.delete(IS_IMPERSONATING_COOKIE_NAME);
      cookieStore.delete(IMPERSONATED_ACCOUNT_ID_COOKIE);
      cookieStore.delete(IMPERSONATED_TENANT_NAME_COOKIE);
      cookieStore.delete(IMPERSONATED_USER_EMAIL_COOKIE);
      cookieStore.delete(IMPERSONATED_USER_ROLE_COOKIE);
    };

    if (!impersonatorCookie) {
      clearCookies();
      return NextResponse.json({ success: true, redirectUrl: "/admin/tenants" });
    }

    const tokenPayload = verifyImpersonationToken(impersonatorCookie);
    if (!tokenPayload) {
      clearCookies();
      return NextResponse.json({
        success: false,
        error: "Impersonation session has expired. Please sign in again as admin.",
        redirectUrl: "/login",
      });
    }

    const adminClient = createAdminClient();

    // Verify admin is still a platform super admin
    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("id, user_id, email, is_super_admin")
      .eq("user_id", tokenPayload.adminUserId)
      .maybeSingle();

    if (!adminProfile || !adminProfile.is_super_admin) {
      clearCookies();
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate magic link to restore Super Admin session
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: tokenPayload.adminEmail,
    });

    // Record audit log for impersonation ended
    try {
      await adminClient.from("admin_audit_logs").insert({
        actor_id: tokenPayload.adminProfileId,
        actor_email: tokenPayload.adminEmail,
        action: "impersonation_ended",
        tenant_id: tokenPayload.tenantAccountId,
        details: {
          durationMs: Date.now() - tokenPayload.createdAt,
          targetUserId: tokenPayload.tenantUserId,
          targetUserEmail: tokenPayload.tenantEmail,
        },
      });
    } catch (auditErr) {
      console.warn("[impersonate] Failed to record audit log on exit:", auditErr);
    }

    clearCookies();

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.warn("[impersonate] Failed to generate admin restoration link, redirecting to login:", linkErr);
      return NextResponse.json({ success: true, redirectUrl: "/login" });
    }

    const redirectUrl = `/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/admin/tenants`;

    return NextResponse.json({ success: true, redirectUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exit impersonation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
