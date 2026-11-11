import type { SupabaseClient } from '@supabase/supabase-js'
import { getDecryptedChannelToken } from './channels'
import type { CommentToDmRule, MetaChannelConnection } from '@/types'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export interface InboundCommentEvent {
  field: string
  value: {
    from: { id: string; username?: string; name?: string }
    post?: { id: string }
    media?: { id: string }
    message: string
    comment_id: string
    created_time?: number
    parent_id?: string
  }
}

export interface CommentMatchResult {
  rule: CommentToDmRule
  sentDm: boolean
  postedReply: boolean
  dmMessageId?: string
  error?: string
}

/**
 * Match comment text against a rule's keyword configuration.
 */
export function matchesCommentRule(text: string, rule: CommentToDmRule): boolean {
  if (!text) return false
  if (rule.match_type === 'any') return true
  if (!rule.keywords || rule.keywords.length === 0) return true

  const normalized = text.toLowerCase().trim()
  for (const rawKw of rule.keywords) {
    const kw = rawKw.toLowerCase().trim()
    if (!kw) continue

    if (rule.match_type === 'exact') {
      if (normalized === kw) return true
    } else {
      // 'contains'
      if (normalized.includes(kw)) return true
    }
  }
  return false
}

/**
 * Send a private DM in response to an Instagram/Facebook comment.
 */
export async function sendCommentDm(
  pageAccessToken: string,
  commentId: string,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text },
      }),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || 'Meta API DM send failed' }
    }
    return { success: true, messageId: data.message_id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

/**
 * Post a public comment reply under the customer's comment.
 */
export async function postCommentReply(
  pageAccessToken: string,
  commentId: string,
  replyText: string,
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const url = `${GRAPH_BASE}/${commentId}/replies?access_token=${encodeURIComponent(pageAccessToken)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText }),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || 'Meta API reply comment failed' }
    }
    return { success: true, replyId: data.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

/**
 * Process an inbound comment webhook change and execute matching Comment-to-DM rules.
 */
export async function processInboundComment(
  db: SupabaseClient,
  recipientId: string, // Page ID or Instagram Business ID
  event: InboundCommentEvent,
): Promise<CommentMatchResult[]> {
  const commentValue = event.value
  if (!commentValue || !commentValue.comment_id || !commentValue.message) {
    return []
  }

  // 1. Find matching channel connection
  const { data: connData, error: connErr } = await db
    .from('meta_channel_connections')
    .select('*')
    .or(`page_id.eq.${recipientId},instagram_business_id.eq.${recipientId}`)
    .maybeSingle()

  if (connErr || !connData) {
    console.warn(`[Comment-to-DM] No channel connection found for recipient ${recipientId}`)
    return []
  }
  const connection = connData as MetaChannelConnection

  // 2. Fetch active rules for this connection
  const { data: rulesData, error: rulesErr } = await db
    .from('comment_to_dm_rules')
    .select('*')
    .eq('channel_connection_id', connection.id)
    .eq('is_active', true)

  if (rulesErr || !rulesData || rulesData.length === 0) {
    return []
  }

  const results: CommentMatchResult[] = []
  const token = await getDecryptedChannelToken(connection.id, connection.account_id)
  if (!token) {
    console.error(`[Comment-to-DM] Failed to decrypt token for connection ${connection.id}`)
    return []
  }

  const postId = commentValue.post?.id || commentValue.media?.id || ''
  const commentText = commentValue.message
  const commentId = commentValue.comment_id
  const commenterUsername = commentValue.from?.username || commentValue.from?.name || ''

  for (const rule of rulesData as CommentToDmRule[]) {
    // Post filter check
    if (rule.post_filter_type === 'specific_post' && rule.post_id && rule.post_id !== postId) {
      continue
    }

    // Keyword match
    if (!matchesCommentRule(commentText, rule)) {
      continue
    }

    // 3. Interpolate username into DM text
    const dmText = rule.dm_message_text.replace(/\{\{username\}\}/gi, commenterUsername ? `@${commenterUsername}` : '')

    // 4. Send private DM to commenter
    const dmRes = await sendCommentDm(token, commentId, dmText)

    // 5. Post randomized public reply if configured
    let postedReply = false
    if (rule.public_replies && rule.public_replies.length > 0) {
      const randomIndex = Math.floor(Math.random() * rule.public_replies.length)
      const selectedReply = rule.public_replies[randomIndex]
      const replyWithHandle = commenterUsername
        ? `@${commenterUsername} ${selectedReply}`
        : selectedReply

      const replyRes = await postCommentReply(token, commentId, replyWithHandle)
      postedReply = replyRes.success
    }

    // 6. Increment execution counter
    await db
      .from('comment_to_dm_rules')
      .update({
        execution_count: (rule.execution_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule.id)

    results.push({
      rule,
      sentDm: dmRes.success,
      postedReply,
      dmMessageId: dmRes.messageId,
      error: dmRes.error,
    })
  }

  return results
}

