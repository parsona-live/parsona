import { NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    await requireSuperAdmin();

    const adminClient = createAdminClient();

    const { data: account, error } = await adminClient
      .from("accounts")
      .select("id, name, negotiated_price_inr, billing_cycle_day, billing_status, billing_notes, internal_notes")
      .eq("id", tenantId)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const adminCtx = await requireSuperAdmin();

    const body = await request.json();
    const {
      negotiated_price_inr,
      billing_cycle_day,
      billing_status,
      billing_notes,
      internal_notes,
    } = body;

    const adminClient = createAdminClient();

    const updatePayload: Record<string, unknown> = {};
    if (negotiated_price_inr !== undefined) updatePayload.negotiated_price_inr = Number(negotiated_price_inr);
    if (billing_cycle_day !== undefined) updatePayload.billing_cycle_day = Number(billing_cycle_day);
    if (billing_status !== undefined) updatePayload.billing_status = billing_status;
    if (billing_notes !== undefined) updatePayload.billing_notes = billing_notes;
    if (internal_notes !== undefined) updatePayload.internal_notes = internal_notes;

    const { data: updated, error: updateErr } = await adminClient
      .from("accounts")
      .update(updatePayload)
      .eq("id", tenantId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Optional: write to admin_audit_logs if table exists
    try {
      await adminClient.from("admin_audit_logs").insert({
        actor_id: adminCtx.profile.id,
        actor_email: adminCtx.email || "admin@wapp.internal",
        action: "update_tenant_billing",
        tenant_id: tenantId,
        details: updatePayload,
      });
    } catch {
      // Audit log non-blocking
    }

    return NextResponse.json({
      success: true,
      account: updated,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
