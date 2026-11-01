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

    const { data: config, error } = await adminClient
      .from("ai_configs")
      .select("id, provider, model, is_enabled, system_prompt, max_tokens, temperature, created_at, updated_at")
      .eq("account_id", tenantId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: config || null });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    await requireSuperAdmin();

    const body = await request.json();
    const { provider, model, apiKey, systemPrompt, isEnabled } = body;

    const adminClient = createAdminClient();

    const payload: Record<string, unknown> = {
      account_id: tenantId,
      updated_at: new Date().toISOString(),
    };

    if (provider !== undefined) payload.provider = provider;
    if (model !== undefined) payload.model = model;
    if (apiKey !== undefined && apiKey.trim() !== "") payload.api_key = apiKey;
    if (systemPrompt !== undefined) payload.system_prompt = systemPrompt;
    if (isEnabled !== undefined) payload.is_enabled = Boolean(isEnabled);

    // Check if row exists
    const { data: existing } = await adminClient
      .from("ai_configs")
      .select("id")
      .eq("account_id", tenantId)
      .maybeSingle();

    let result;
    if (existing) {
      result = await adminClient
        .from("ai_configs")
        .update(payload)
        .eq("account_id", tenantId)
        .select()
        .single();
    } else {
      result = await adminClient
        .from("ai_configs")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: result.data,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

