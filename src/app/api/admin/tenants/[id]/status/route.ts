import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/account";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["active", "suspended", "trialing", "past_due"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { error } = await supabase.rpc("toggle_account_status", {
      target_account_id: id,
      new_status: status,
    });

    if (error) {
      console.error("[toggle_account_status] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

