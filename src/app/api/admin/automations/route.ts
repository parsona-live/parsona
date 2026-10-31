import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/account";

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSuperAdmin();
    const body = await request.json();
    const { name, description, triggerType, category } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const validTriggers = ["keyword", "first_inbound_message", "manual"];
    const trigger = validTriggers.includes(triggerType) ? triggerType : "keyword";

    // 1. Create master flow template
    const { data: newFlow, error: flowErr } = await supabase
      .from("flows")
      .insert({
        name,
        description: description ?? null,
        trigger_type: trigger,
        status: "draft",
        is_template: true,
        template_category: category ?? "General",
        account_id: null,
        user_id: userId,
        fallback_policy: {
          on_unknown_reply: "reprompt",
          max_reprompts: 2,
          on_timeout_hours: 24,
          on_exhaust: "handoff",
        },
      })
      .select()
      .single();

    if (flowErr || !newFlow) {
      console.error("[create master flow] error:", flowErr);
      return NextResponse.json({ error: flowErr?.message || "Failed to create flow" }, { status: 500 });
    }

    // 2. Insert initial start node
    await supabase.from("flow_nodes").insert({
      flow_id: newFlow.id,
      node_key: "start",
      node_type: "start",
      config: {},
      position_x: 250,
      position_y: 100,
    });

    return NextResponse.json({ success: true, flow: newFlow });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

