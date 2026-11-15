import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { unlinkContact } from '@/lib/meta/identity'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id } = await params

    await unlinkContact(ctx.supabase, ctx.accountId, id)

    return NextResponse.json({
      success: true,
      unlinkedContactId: id,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

