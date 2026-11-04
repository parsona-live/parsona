import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/flows/client-flows
 *
 * Lists all tenant flows across the system for the Super Admin
 * with tenant names, node counts, and execution statistics.
 *
 * Query params:
 *   - accountId: Filter by specific account
 *   - search: Search by flow name
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const search = searchParams.get('search')?.toLowerCase().trim()

    const admin = supabaseAdmin()

    // 1. Query client flows (is_template = false)
    let query = admin
      .from('flows')
      .select('id, name, description, trigger_type, status, execution_count, last_executed_at, created_at, updated_at, account_id, origin_template_id')
      .eq('is_template', false)
      .not('account_id', 'is', null)
      .order('updated_at', { ascending: false })

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data: flows, error: flowsErr } = await query

    if (flowsErr) {
      console.error('[GET /api/admin/flows/client-flows] error:', flowsErr)
      return NextResponse.json({ error: flowsErr.message }, { status: 500 })
    }

    // 2. Fetch account names
    const accountIds = Array.from(new Set((flows ?? []).map((f) => f.account_id).filter(Boolean))) as string[]
    const accountMap: Record<string, string> = {}

    if (accountIds.length > 0) {
      const { data: accounts } = await admin
        .from('accounts')
        .select('id, name')
        .in('id', accountIds)

      if (accounts) {
        for (const acc of accounts) {
          accountMap[acc.id] = acc.name
        }
      }
    }

    // 3. Count nodes for each flow
    const flowIds = (flows ?? []).map((f) => f.id)
    const nodeCountMap: Record<string, number> = {}

    if (flowIds.length > 0) {
      const { data: nodes } = await admin
        .from('flow_nodes')
        .select('flow_id')
        .in('flow_id', flowIds)

      if (nodes) {
        for (const n of nodes) {
          nodeCountMap[n.flow_id] = (nodeCountMap[n.flow_id] ?? 0) + 1
        }
      }
    }

    // 4. Map & filter
    let results = (flows ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      trigger_type: f.trigger_type,
      status: f.status,
      execution_count: f.execution_count ?? 0,
      last_executed_at: f.last_executed_at,
      created_at: f.created_at,
      updated_at: f.updated_at,
      account_id: f.account_id,
      account_name: accountMap[f.account_id] || 'Unknown Tenant',
      node_count: nodeCountMap[f.id] ?? 0,
      is_from_template: Boolean(f.origin_template_id),
    }))

    if (search) {
      results = results.filter(
        (f) =>
          f.name.toLowerCase().includes(search) ||
          f.account_name.toLowerCase().includes(search) ||
          (f.description && f.description.toLowerCase().includes(search))
      )
    }

    return NextResponse.json({ clientFlows: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

