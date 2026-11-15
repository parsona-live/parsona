import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { clearConversationMessages } from '@/lib/inbox/conversation-delete'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id } = await params

    const result = await clearConversationMessages(ctx.supabase, ctx.accountId, id)

    return NextResponse.json(result)
  } catch (err) {
    return toErrorResponse(err)
  }
}

