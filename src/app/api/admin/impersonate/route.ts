import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/account";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireSuperAdmin();
    const body = await request.json();
    const { accountId } = body;

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    // Verify account exists
    const { data: account, error } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("id", accountId)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json({ error: "Tenant account not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set("wapp_impersonate_account_id", accountId, {
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
      sameSite: "lax",
      httpOnly: false, // Accessible to client-side components to show impersonation banner
    });

    return NextResponse.json({ success: true, account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to impersonate";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function DELETE() {
  try {
    await requireSuperAdmin();
    const cookieStore = await cookies();
    cookieStore.delete("wapp_impersonate_account_id");
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exit impersonation";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

