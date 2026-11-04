import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/flows/library/clone
 *
 * Clones a master template into the caller's account workspace.
 * Requires minimum role 'agent'.
 *
 * Body: { templateId: string, customName?: string }
 */
export async function POST(request: Request) {
  try {
    await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single()

  const accountId = profile?.account_id as string | undefined
  if (!accountId) {
    return NextResponse.json({ error: 'Profile not linked to an account' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    templateId?: string
    customName?: string
  } | null

  if (!body?.templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // 1. Verify template exists
  const { data: template, error: tmplErr } = await admin
    .from('flows')
    .select('*')
    .eq('id', body.templateId)
    .eq('is_template', true)
    .single()

  if (tmplErr || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // 2. Clone using the RPC or fallback deep-copy
  let newFlowId: string | null = null

  try {
    const { data: rpcFlowId, error: rpcErr } = await admin.rpc('clone_template_to_account', {
      template_flow_id: body.templateId,
      target_account_id: accountId,
    })

    if (!rpcErr && rpcFlowId) {
      newFlowId = rpcFlowId as string
    } else if (rpcErr) {
      console.warn('[clone_template_to_account RPC warning, using fallback]:', rpcErr.message)
    }
  } catch (err) {
    console.warn('[clone_template_to_account RPC caught exception, using fallback]:', err)
  }

  // 3. Robust fallback if RPC didn't return an ID
  if (!newFlowId) {
    const { data: newFlow, error: insertErr } = await admin
      .from('flows')
      .insert({
        account_id: accountId,
        user_id: user.id,
        name: body.customName?.trim() || template.name,
        description: template.description,
        status: 'draft',
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_config ?? { keywords: [] },
        entry_node_id: template.entry_node_id,
        fallback_policy: template.fallback_policy,
        is_template: false,
        origin_template_id: template.id,
      })
      .select('id')
      .single()

    if (insertErr || !newFlow) {
      return NextResponse.json(
        { error: insertErr?.message || 'Failed to clone flow' },
        { status: 500 }
      )
    }

    newFlowId = newFlow.id

    // Clone all nodes
    const { data: sourceNodes } = await admin
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', template.id)

    if (sourceNodes && sourceNodes.length > 0) {
      const nodesToInsert = sourceNodes.map((n) => ({
        flow_id: newFlowId,
        node_key: n.node_key,
        node_type: n.node_type,
        config: n.config,
        position_x: n.position_x,
        position_y: n.position_y,
      }))

      const { error: nodesErr } = await admin.from('flow_nodes').insert(nodesToInsert)
      if (nodesErr) {
        await admin.from('flows').delete().eq('id', newFlowId)
        return NextResponse.json({ error: nodesErr.message }, { status: 500 })
      }
    }
  } else {
    // If cloned via RPC, ensure customName and user_id are set properly
    const updates: Record<string, unknown> = { user_id: user.id }
    if (body.customName?.trim()) {
      updates.name = body.customName.trim()
    }
    await admin.from('flows').update(updates).eq('id', newFlowId)
  }

  return NextResponse.json({ success: true, flowId: newFlowId }, { status: 201 })
}

