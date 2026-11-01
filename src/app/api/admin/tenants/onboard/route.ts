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

export async function POST(request: NextRequest) {
  try {
    const adminCtx = await requireSuperAdmin();
    const body = await request.json();

    const {
      businessName,
      ownerName,
      ownerEmail,
      ownerPhone,
      password: requestedPassword,
      negotiatedPriceInr,
      billingCycleDay,
      billingNotes,
      templateIds,
      aiProvider,
      aiModel,
      aiSystemPrompt,
    } = body;

    if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }
    if (!ownerEmail || typeof ownerEmail !== "string" || !ownerEmail.trim()) {
      return NextResponse.json({ error: "Owner email is required" }, { status: 400 });
    }

    const cleanEmail = ownerEmail.trim().toLowerCase();
    const finalPassword = requestedPassword && requestedPassword.trim().length >= 6
      ? requestedPassword.trim()
      : generateSecurePassword();

    const adminClient = createAdminClient();

    // 1. Create or resolve Auth User
    let userId: string;
    const { data: newUser, error: createAuthErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName || businessName,
        phone: ownerPhone || undefined,
      },
    });

    if (createAuthErr) {
      // If user already exists, find their ID
      if (createAuthErr.message.toLowerCase().includes("already registered") || createAuthErr.status === 422) {
        const { data: userList } = await adminClient.auth.admin.listUsers();
        const existing = userList?.users.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (!existing) {
          return NextResponse.json({ error: "User already exists with this email" }, { status: 400 });
        }
        userId = existing.id;
      } else {
        return NextResponse.json({ error: createAuthErr.message }, { status: 400 });
      }
    } else {
      userId = newUser.user.id;
    }

    // 2. Create the Account with Custom Negotiated Terms
    const { data: newAccount, error: accErr } = await adminClient
      .from("accounts")
      .insert({
        name: businessName.trim(),
        status: "active",
        plan_tier: "custom",
        negotiated_price_inr: Number(negotiatedPriceInr || 0),
        billing_cycle_day: Number(billingCycleDay || 1),
        billing_status: "active",
        billing_notes: billingNotes?.trim() || null,
        max_contacts: 5000,
        max_broadcasts_per_month: 1000,
        ai_messages_quota: 500,
      })
      .select()
      .single();

    if (accErr || !newAccount) {
      return NextResponse.json({ error: accErr?.message || "Failed to create business account" }, { status: 500 });
    }

    // 3. Link profile and member role
    await adminClient.from("profiles").upsert({
      id: userId,
      user_id: userId,
      email: cleanEmail,
      full_name: ownerName?.trim() || businessName.trim(),
      account_id: newAccount.id,
      account_role: "owner",
    });

    try {
      await adminClient.from("account_members").insert({
        account_id: newAccount.id,
        user_id: userId,
        role: "owner",
      });
    } catch {
      // Ignore unique violation if member already linked
    }

    // 4. Clone Master Flow Templates into this new account
    const clonedFlowIds: string[] = [];
    if (Array.isArray(templateIds) && templateIds.length > 0) {
      for (const tplId of templateIds) {
        try {
          const { data: flowId } = await adminClient.rpc("clone_template_to_account", {
            template_id: tplId,
            target_account_id: newAccount.id,
          });
          if (flowId) clonedFlowIds.push(flowId);
        } catch (cloneErr) {
          console.error(`Failed to clone template ${tplId}:`, cloneErr);
        }
      }
    }

    // 5. Pre-configure AI Engine
    try {
      await adminClient.from("ai_configs").insert({
        account_id: newAccount.id,
        provider: aiProvider || "openrouter",
        model: aiModel || "deepseek/deepseek-chat",
        system_prompt: aiSystemPrompt?.trim() || `You are an AI assistant for ${businessName}. Answer customer questions politely and helpfully.`,
        is_enabled: true,
      });
    } catch (aiErr) {
      console.error("Failed to write initial AI config:", aiErr);
    }

    // 6. Write Audit Log
    try {
      await adminClient.from("admin_audit_logs").insert({
        actor_id: adminCtx.profile.id,
        actor_email: adminCtx.email || "admin@wapp.internal",
        action: "onboard_tenant",
        tenant_id: newAccount.id,
        details: {
          businessName,
          ownerEmail: cleanEmail,
          negotiatedPriceInr,
          clonedFlowsCount: clonedFlowIds.length,
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      account: newAccount,
      credentials: {
        email: cleanEmail,
        password: finalPassword,
        businessName: businessName.trim(),
        ownerName: ownerName?.trim() || businessName.trim(),
        loginUrl: "/login",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

