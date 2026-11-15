import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { getLinkedContacts } from '@/lib/meta/identity'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('viewer')
    const { id } = await params

    const linked = await getLinkedContacts(ctx.supabase, ctx.accountId, id)

    // For each linked contact, fetch their latest conversation if exists
    const contactIds = linked.map((c) => c.id)
    let convs: Array<{ id: string; contact_id: string; channel?: string }> = []
    if (contactIds.length > 0) {
      const { data } = await ctx.supabase
        .from('conversations')
        .select('id, contact_id, channel')
        .in('contact_id', contactIds)
      if (data) convs = data
    }

    const result = linked.map((contact) => ({
      ...contact,
      conversation_id: convs.find((c) => c.contact_id === contact.id)?.id || null,
      channel: convs.find((c) => c.contact_id === contact.id)?.channel || (contact.ig_user_id ? 'instagram' : contact.fb_page_scoped_id ? 'facebook' : 'whatsapp'),
    }))

    return NextResponse.json({
      success: true,
      linked: result,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

