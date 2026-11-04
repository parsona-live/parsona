import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/flows/library
 *
 * Returns all active master flow templates available in the library.
 * Accessible to any authenticated user.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  // Load all global master templates
  const { data: templates, error: tmplErr } = await admin
    .from('flows')
    .select('id, name, description, trigger_type, template_category, status, created_at, updated_at')
    .eq('is_template', true)
    .is('account_id', null)
    .order('created_at', { ascending: false })

  if (tmplErr) {
    console.error('[GET /api/flows/library] error loading templates:', tmplErr)
    return NextResponse.json({ error: tmplErr.message }, { status: 500 })
  }

  // Count nodes for each template
  const templateIds = (templates ?? []).map((t) => t.id)
  const nodeCountMap: Record<string, number> = {}

  if (templateIds.length > 0) {
    const { data: nodes } = await admin
      .from('flow_nodes')
      .select('flow_id')
      .in('flow_id', templateIds)

    if (nodes) {
      for (const node of nodes) {
        nodeCountMap[node.flow_id] = (nodeCountMap[node.flow_id] ?? 0) + 1
      }
    }
  }

  const library = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.template_category || 'General',
    trigger_type: t.trigger_type,
    status: t.status,
    node_count: nodeCountMap[t.id] ?? 0,
    created_at: t.created_at,
  }))

  return NextResponse.json({ templates: library })
}

