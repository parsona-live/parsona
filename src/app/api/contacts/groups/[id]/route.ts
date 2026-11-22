import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { updateContactGroup, deleteContactGroup } from '@/lib/contacts/groups'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id: groupId } = await params
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const group = await updateContactGroup(ctx.supabase, ctx.accountId, groupId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      color: typeof body.color === 'string' ? body.color : undefined,
    })

    return NextResponse.json({ group })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id: groupId } = await params
    await deleteContactGroup(ctx.supabase, ctx.accountId, groupId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
