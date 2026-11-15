import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { deleteConversation } from '@/lib/inbox/conversation-delete'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent')
    const { id } = await params

    const url = new URL(req.url)
    const deleteContact = url.searchParams.get('delete_contact') === 'true'

    const result = await deleteConversation(ctx.supabase, ctx.accountId, id, {
      deleteContact,
    })

    return NextResponse.json(result)
  } catch (err) {
    return toErrorResponse(err)
  }
}

