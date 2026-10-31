import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/account";

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireSuperAdmin();
    const body = await request.json();
    const { templateFlowId, targetAccountId } = body;

    if (!templateFlowId || !targetAccountId) {
      return NextResponse.json(
        { error: "templateFlowId and targetAccountId are required" },
        { status: 400 }
      );
    }

    const { data: newFlowId, error } = await supabase.rpc("clone_template_to_account", {
      template_flow_id: templateFlowId,
      target_account_id: targetAccountId,
    });

    if (error) {
      console.error("[clone_template_to_account] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, flowId: newFlowId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

