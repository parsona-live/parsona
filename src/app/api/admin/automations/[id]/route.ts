import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/admin/automations/[id]
 * Update a master template's name, description, category, or status.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    const body = (await request.json().catch(() => null)) as {
      name?: string
      description?: string
      category?: string
      status?: 'draft' | 'active' | 'archived'
    } | null

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description.trim()
    if (body.category !== undefined) updates.template_category = body.category.trim()
    if (body.status !== undefined) updates.status = body.status

    const admin = supabaseAdmin()
    const { data: updated, error } = await admin
      .from('flows')
      .update(updates)
      .eq('id', id)
      .eq('is_template', true)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, flow: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

/**
 * DELETE /api/admin/automations/[id]
 * Deletes a master template and its nodes.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()
    const { id } = await params

    const admin = supabaseAdmin()
    // Delete nodes first
    await admin.from('flow_nodes').delete().eq('flow_id', id)

    // Delete flow
    const { error } = await admin
      .from('flows')
      .delete()
      .eq('id', id)
      .eq('is_template', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

