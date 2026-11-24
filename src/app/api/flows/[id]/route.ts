import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { validateFlowForActivation } from '@/lib/flows/validate'
import { MAX_FLOW_TIMEOUT_HOURS } from '@/lib/flows/types'
import { getT } from '@/lib/i18n/translate'

const t = getT('Api')

/**
 * GET   /api/flows/[id]  — fetch one flow with its nodes.
 * PUT   /api/flows/[id]  — replace name/trigger/entry/fallback + the
 *                          full node graph.
 * DELETE /api/flows/[id] — hard delete (RLS+CASCADE clean up nodes,
 *                          runs, events).
 *
 * All three require a signed-in caller who owns the flow. Flows is in
 * soft-GA — the beta gate that previously 404'd non-beta accounts is
 * gone; the "Beta" label in the UI is the only remaining signal.
 */

async function requireOwnership(
  flowId: string,
): Promise<
  | {
      ok: true
      userId: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }
  | { ok: false; status: number; body: { error: string } }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, body: { error: t('common.unauthorized') } }
  }
  // RLS scopes this to the caller — a flow owned by another user
  // returns null (404 below).
  const { data: flow } = await supabase
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .maybeSingle()
  if (!flow) {
    return { ok: false, status: 404, body: { error: t('common.notFound') } }
  }
  return { ok: true, userId: user.id, supabase }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireOwnership(id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })
  const { supabase } = guard

  const [{ data: flow }, { data: nodes }] = await Promise.all([
    supabase.from('flows').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', id)
      .order('created_at', { ascending: true }),
  ])
  if (!flow) {
    return NextResponse.json({ error: t('common.notFound') }, { status: 404 })
  }
  return NextResponse.json({ flow, nodes: nodes ?? [] })
}

interface PutBody {
  name?: string
  description?: string | null
  trigger_type?: 'keyword' | 'first_inbound_message' | 'manual' | 'ai_intent'
  trigger_config?: Record<string, unknown>
  channels?: ('whatsapp' | 'instagram' | 'facebook')[]
  entry_node_id?: string | null
  fallback_policy?: Record<string, unknown>
  nodes?: Array<{
    node_key: string
    node_type: string
    config: Record<string, unknown>
    position_x?: number
    position_y?: number
  }>
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  // Writes require at least `agent` — the RLS flows_update policy demands
  // it, but this route mutates via the service-role client which bypasses
  // RLS, so the role must be enforced here (a viewer passes ownership).
  try {
    await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const guard = await requireOwnership(id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body) {
    return NextResponse.json({ error: t('common.invalidJson') }, { status: 400 })
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json(
      { error: t('flows.nameEmpty') },
      { status: 400 },
    )
  }

  if (!isValidFallbackPolicy(body.fallback_policy)) {
    return NextResponse.json(
      { error: t('flows.timeoutHoursInvalid', { max: MAX_FLOW_TIMEOUT_HOURS }) },
      { status: 400 },
    )
  }

  const admin = supabaseAdmin()

  const activeBlockers = await validateIfActive(admin, id, body)
  if (activeBlockers) {
    return NextResponse.json(
      { error: t('flows.cannotSaveActive'), issues: activeBlockers },
      { status: 422 },
    )
  }

  const flowPatch: Record<string, unknown> = {}
  if (body.name !== undefined) flowPatch.name = body.name.trim()
  if (body.description !== undefined)
    flowPatch.description = body.description
  if (body.trigger_type !== undefined) flowPatch.trigger_type = body.trigger_type
  if (body.trigger_config !== undefined)
    flowPatch.trigger_config = body.trigger_config
  if (body.channels !== undefined)
    flowPatch.channels = body.channels
  if (body.entry_node_id !== undefined)
    flowPatch.entry_node_id = body.entry_node_id
  if (body.fallback_policy !== undefined)
    flowPatch.fallback_policy = body.fallback_policy

  // Sync trigger config from canvas trigger node if present
  const canvasTriggerNode = body.nodes?.find((n) => n.node_type === 'trigger')
  if (canvasTriggerNode?.config) {
    const tc = canvasTriggerNode.config as Record<string, any>
    if (tc.starting_step === 'ai_intent' || tc.intent_name) {
      flowPatch.trigger_type = 'ai_intent'
      flowPatch.trigger_config = {
        ...(typeof flowPatch.trigger_config === 'object' && flowPatch.trigger_config ? flowPatch.trigger_config : {}),
        ...tc,
        starting_step: 'ai_intent',
      }
    } else if (tc.starting_step === 'keyword' || tc.starting_step === 'contact_from_ad') {
      flowPatch.trigger_type = 'keyword'
      flowPatch.trigger_config = {
        ...(typeof flowPatch.trigger_config === 'object' && flowPatch.trigger_config ? flowPatch.trigger_config : {}),
        ...tc,
        keywords: tc.keywords || (flowPatch.trigger_config as any)?.keywords || [],
      }
    } else if (tc.starting_step === 'new_contact') {
      flowPatch.trigger_type = 'first_inbound_message'
      flowPatch.trigger_config = {
        ...(typeof flowPatch.trigger_config === 'object' && flowPatch.trigger_config ? flowPatch.trigger_config : {}),
        ...tc,
      }
    }

    if (!flowPatch.entry_node_id && !body.entry_node_id) {
      flowPatch.entry_node_id = canvasTriggerNode.node_key
    }
  }

  if (body.nodes !== undefined) {
    let nodesToSave = body.nodes.map((n) => ({
      node_key: n.node_key,
      node_type: n.node_type,
      config: n.config,
      position_x: n.position_x ?? 0,
      position_y: n.position_y ?? 0,
    }))

    let rpcRes = await guard.supabase.rpc('replace_flow_graph', {
      p_flow_id: id,
      p_nodes: nodesToSave,
      p_flow: flowPatch,
    })

    // If database check constraint on trigger_type fails (migration 080 not yet executed on DB)
    if (
      rpcRes.error &&
      (rpcRes.error.message.includes('flows_trigger_type_check') ||
        rpcRes.error.message.includes('trigger_type'))
    ) {
      const fallbackPatch = {
        ...flowPatch,
        trigger_type: 'keyword',
      }
      rpcRes = await guard.supabase.rpc('replace_flow_graph', {
        p_flow_id: id,
        p_nodes: nodesToSave,
        p_flow: fallbackPatch,
      })
    }

    // If database check constraint on node_type fails (migration 080 not yet executed on DB)
    if (rpcRes.error && rpcRes.error.message.includes('flow_nodes_node_type_check')) {
      // Map ai_message -> ai_response if ai_message was used
      nodesToSave = nodesToSave.map((n) => {
        if (n.node_type === 'ai_message') {
          return {
            ...n,
            node_type: 'ai_response',
            config: { ...n.config, is_ai_message: true },
          }
        }
        return n
      })
      rpcRes = await guard.supabase.rpc('replace_flow_graph', {
        p_flow_id: id,
        p_nodes: nodesToSave,
        p_flow: flowPatch,
      })
    }

    if (rpcRes.error) {
      return NextResponse.json({ error: rpcRes.error.message }, { status: 500 })
    }
  } else {
    let { error: updErr } = await admin
      .from('flows')
      .update({ ...flowPatch, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (
      updErr &&
      (updErr.message.includes('flows_trigger_type_check') ||
        updErr.message.includes('trigger_type'))
    ) {
      const fallbackPatch = { ...flowPatch, trigger_type: 'keyword' }
      const retry = await admin
        .from('flows')
        .update({ ...fallbackPatch, updated_at: new Date().toISOString() })
        .eq('id', id)
      updErr = retry.error
    }

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  // Re-fetch and return the new state — the editor uses the response
  // to reconcile its local form state.
  const [{ data: flow }, { data: nodes }] = await Promise.all([
    admin.from('flows').select('*').eq('id', id).maybeSingle(),
    admin
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', id)
      .order('created_at', { ascending: true }),
  ])
  return NextResponse.json({ flow, nodes: nodes ?? [] })
}

function isValidFallbackPolicy(policy: unknown): boolean {
  if (policy === undefined) return true
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false
  const hours = (policy as { on_timeout_hours?: unknown }).on_timeout_hours
  if (hours === undefined) return true
  return (
    typeof hours === 'number' &&
    Number.isFinite(hours) &&
    hours > 0 &&
    hours <= MAX_FLOW_TIMEOUT_HOURS
  )
}

async function validateIfActive(
  admin: ReturnType<typeof supabaseAdmin>,
  flowId: string,
  body: PutBody,
): Promise<ReturnType<typeof validateFlowForActivation> | null> {
  const { data: current } = await admin
    .from('flows')
    .select('name, status, trigger_type, trigger_config, entry_node_id')
    .eq('id', flowId)
    .maybeSingle()
  if (!current || current.status !== 'active') return null

  const nodes =
    body.nodes ??
    ((
      await admin
        .from('flow_nodes')
        .select('node_key, node_type, config')
        .eq('flow_id', flowId)
    ).data ?? [])

  const issues = validateFlowForActivation(
    {
      name: body.name !== undefined ? body.name.trim() : current.name,
      trigger_type: body.trigger_type ?? current.trigger_type,
      trigger_config: body.trigger_config ?? current.trigger_config ?? {},
      entry_node_id:
        body.entry_node_id !== undefined
          ? body.entry_node_id
          : current.entry_node_id,
    },
    nodes,
  )
  return issues.some((i) => i.severity === 'error') ? issues : null
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  // Writes require at least `agent` — see the PUT handler note. The
  // service-role client below bypasses the agent-gated flows_delete RLS.
  try {
    await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const guard = await requireOwnership(id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  // CASCADE on flow_nodes / flow_runs / flow_run_events handles the
  // children. Active runs end abruptly — there's no graceful "drain"
  // mechanism in v1, but that's intentional: deleting a flow is a
  // deliberate destructive action and the partial unique index will
  // free up the contact for new triggers immediately.
  const { error } = await supabaseAdmin().from('flows').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

