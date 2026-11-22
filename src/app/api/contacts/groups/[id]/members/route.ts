import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import {
  addContactsToGroup,
  removeContactsFromGroup,
  moveContactsToGroup,
} from '@/lib/contacts/groups'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id: groupId } = await params
    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.contactIds) || body.contactIds.length === 0) {
      return NextResponse.json({ error: 'contactIds array is required' }, { status: 400 })
    }

    const action = body.action || 'add'

    if (action === 'remove') {
      const count = await removeContactsFromGroup(ctx.supabase, ctx.accountId, groupId, body.contactIds)
      return NextResponse.json({ ok: true, removed: count })
    }

    if (action === 'move') {
      if (!body.targetGroupId || typeof body.targetGroupId !== 'string') {
        return NextResponse.json({ error: 'targetGroupId is required for move action' }, { status: 400 })
      }
      const result = await moveContactsToGroup(
        ctx.supabase,
        ctx.accountId,
        groupId,
        body.targetGroupId,
        body.contactIds,
      )
      return NextResponse.json({ ok: true, ...result })
    }

    // Default: 'add'
    const count = await addContactsToGroup(ctx.supabase, ctx.accountId, groupId, body.contactIds)
    return NextResponse.json({ ok: true, added: count })
  } catch (error) {
    return toErrorResponse(error)
  }
}
