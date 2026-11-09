import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireSuperAdmin } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  verifyImpersonationToken,
  IMPERSONATOR_COOKIE_NAME,
} from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/flows/promote
 *
 * Promotes an existing client flow into a global master template.
 * Available to Super Admins and Admins actively impersonating an account.
 *
 * Body: {
 *   sourceFlowId: string
 *   name?: string
 *   description?: string
 *   category?: string
 * }
 */
export async function POST(request: Request) {
  try {
    let userId: string
    let isSuper = false
    let impersonatedAccountId: string | null = null

    try {
      const superCtx = await requireSuperAdmin()
      userId = superCtx.userId
      isSuper = true
    } catch {
      // Check if caller is an admin actively impersonating this account
      const cookieStore = await cookies()
      const impersonatorCookie = cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value
      const tokenPayload = impersonatorCookie ? verifyImpersonationToken(impersonatorCookie) : null

      if (tokenPayload) {
        userId = tokenPayload.adminUserId
        impersonatedAccountId = tokenPayload.tenantAccountId
        isSuper = true
      } else {
        return NextResponse.json(
          { error: 'Forbidden: only super administrators or admin impersonators can publish to the master library' },
          { status: 403 }
        )
      }
    }

    const body = (await request.json().catch(() => null)) as {
      sourceFlowId?: string
      name?: string
      description?: string
      category?: string
    } | null

    if (!body?.sourceFlowId) {
      return NextResponse.json({ error: 'sourceFlowId is required' }, { status: 400 })
    }

    const admin = supabaseAdmin()

    // 1. Fetch source flow
    const { data: sourceFlow, error: sourceErr } = await admin
      .from('flows')
      .select('*')
      .eq('id', body.sourceFlowId)
      .single()

    if (sourceErr || !sourceFlow) {
      return NextResponse.json({ error: 'Source flow not found' }, { status: 404 })
    }

    // If caller is impersonating, ensure they are publishing from the impersonated account
    if (impersonatedAccountId && sourceFlow.account_id !== impersonatedAccountId) {
      return NextResponse.json(
        { error: 'Forbidden: you cannot publish a flow from another account' },
        { status: 403 }
      )
    }

    // 2. Fetch source flow nodes
    const { data: sourceNodes, error: nodesErr } = await admin
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', body.sourceFlowId)

    if (nodesErr) {
      return NextResponse.json({ error: 'Failed to fetch source flow nodes' }, { status: 500 })
    }

    // 3. Create the global master template (account_id = NULL, is_template = TRUE)
    const templateName = body.name?.trim() || `${sourceFlow.name} (Template)`
    const templateDesc =
      body.description !== undefined ? body.description?.trim() : sourceFlow.description
    const category = body.category?.trim() || sourceFlow.template_category || 'General'

    const { data: newTemplate, error: insertErr } = await admin
      .from('flows')
      .insert({
        account_id: null,
        user_id: userId,
        name: templateName,
        description: templateDesc,
        status: 'active', // Published to library by default
        is_template: true,
        template_category: category,
        trigger_type: sourceFlow.trigger_type,
        trigger_config: sourceFlow.trigger_config ?? { keywords: [] },
        entry_node_id: sourceFlow.entry_node_id,
        fallback_policy: sourceFlow.fallback_policy ?? {
          on_unknown_reply: 'reprompt',
          max_reprompts: 2,
          on_timeout_hours: 24,
          on_exhaust: 'handoff',
        },
      })
      .select()
      .single()

    if (insertErr || !newTemplate) {
      return NextResponse.json(
        { error: insertErr?.message || 'Failed to create template' },
        { status: 500 }
      )
    }

    // 4. Duplicate nodes into newTemplate
    if (sourceNodes && sourceNodes.length > 0) {
      const clonedNodes = sourceNodes.map((n) => ({
        flow_id: newTemplate.id,
        node_key: n.node_key,
        node_type: n.node_type,
        config: n.config,
        position_x: n.position_x,
        position_y: n.position_y,
      }))

      const { error: insertNodesErr } = await admin.from('flow_nodes').insert(clonedNodes)
      if (insertNodesErr) {
        // Rollback template if node insertion fails
        await admin.from('flows').delete().eq('id', newTemplate.id)
        return NextResponse.json({ error: insertNodesErr.message }, { status: 500 })
      }
    }

    return NextResponse.json(
      {
        success: true,
        template: newTemplate,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
