import { NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; flowId: string }> }
) {
  try {
    const { id: tenantId, flowId } = await params;
    await requireSuperAdmin();

    const body = await request.json().catch(() => ({}));
    const nextStatus = body.status; // optional explicit status: 'active' | 'draft' | 'archived'

    const adminClient = createAdminClient();

    // Check if flow exists for this tenant
    const { data: flow, error: fetchErr } = await adminClient
      .from("flows")
      .select("id, name, status, account_id")
      .eq("id", flowId)
      .eq("account_id", tenantId)
      .single();

    if (fetchErr || !flow) {
      return NextResponse.json({ error: "Flow not found for this tenant" }, { status: 404 });
    }

    const targetStatus = nextStatus || (flow.status === "active" ? "draft" : "active");

    const { data: updatedFlow, error: updateErr } = await adminClient
      .from("flows")
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq("id", flowId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      flow: updatedFlow,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

