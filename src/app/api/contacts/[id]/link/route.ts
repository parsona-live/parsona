import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { linkContacts } from '@/lib/meta/identity'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id: primaryId } = await params

    const body = await req.json()
    const { targetContactId } = body

    if (!targetContactId) {
      return NextResponse.json(
        { error: 'targetContactId is required' },
        { status: 400 },
      )
    }

    if (primaryId === targetContactId) {
      return NextResponse.json(
        { error: 'Cannot link a contact to itself' },
        { status: 400 },
      )
    }

    const result = await linkContacts(ctx.supabase, ctx.accountId, primaryId, targetContactId)

    return NextResponse.json({
      success: true,
      primary: result.primary,
      secondary: result.secondary,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

