import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { mergeContacts } from '@/lib/meta/identity'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id: primaryId } = await params

    const body = await req.json()
    const { secondaryContactId } = body

    if (!secondaryContactId) {
      return NextResponse.json(
        { error: 'secondaryContactId is required' },
        { status: 400 },
      )
    }

    if (primaryId === secondaryContactId) {
      return NextResponse.json(
        { error: 'Cannot merge a contact with itself' },
        { status: 400 },
      )
    }

    await mergeContacts(ctx.supabase, ctx.accountId, primaryId, secondaryContactId)

    return NextResponse.json({
      success: true,
      primaryContactId: primaryId,
      mergedContactId: secondaryContactId,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
