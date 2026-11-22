import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { fetchContactGroups, createContactGroup } from '@/lib/contacts/groups'

export async function GET() {
  try {
    const ctx = await requireRole('agent')
    const groups = await fetchContactGroups(ctx.supabase, ctx.accountId)
    return NextResponse.json({ groups })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent')
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const group = await createContactGroup(ctx.supabase, ctx.accountId, {
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : null,
      color: typeof body.color === 'string' ? body.color : undefined,
    })

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
