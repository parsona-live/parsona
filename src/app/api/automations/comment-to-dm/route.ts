import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/automations/comment-to-dm
 * Lists all active Comment-to-DM automation rules for the account.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAccount()

    const { data, error } = await ctx.supabase
      .from('comment_to_dm_rules')
      .select('*, channel_connection:meta_channel_connections(page_name, instagram_username, channel)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ rules: data || [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/automations/comment-to-dm
 * Create a new Comment-to-DM automation rule.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireRole('admin')
    const body = await req.json()

    const {
      channel_connection_id,
      name,
      keywords,
      match_type = 'contains',
      dm_message_text,
      public_replies,
      post_filter_type = 'all_posts',
      post_id = null,
      flow_id = null,
    } = body

    if (!channel_connection_id || !name || !dm_message_text) {
      return NextResponse.json(
        { error: 'channel_connection_id, name, and dm_message_text are required' },
        { status: 400 },
      )
    }

    const { data, error } = await ctx.supabase
      .from('comment_to_dm_rules')
      .insert({
        account_id: ctx.accountId,
        channel_connection_id,
        name: name.trim(),
        keywords: Array.isArray(keywords) ? keywords : [],
        match_type,
        dm_message_text: dm_message_text.trim(),
        public_replies: Array.isArray(public_replies) && public_replies.length > 0
          ? public_replies
          : ['Sent you a DM! 📩', 'Check your inbox for details! ✨'],
        post_filter_type,
        post_id: post_id || null,
        flow_id: flow_id || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ rule: data }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}

