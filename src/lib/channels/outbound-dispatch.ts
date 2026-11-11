import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { engineSendText } from '@/lib/flows/meta-send'
import { getDecryptedChannelToken } from '@/lib/meta/channels'
import type { ChannelType, Message } from '@/types'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export interface OutboundDispatchArgs {
  db?: SupabaseClient
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  text: string
  aiGenerated?: boolean
  senderType?: 'agent' | 'bot'
  mediaUrl?: string | null
  mediaType?: string | null
}

export interface OutboundDispatchResult {
  success: boolean
  channel: ChannelType
  messageId?: string
  error?: string
  isHumanAgentTag?: boolean
}

/**
 * Universal omnichannel message dispatcher.
 * Routes message to WhatsApp Cloud API, Instagram Graph API, or Facebook Messenger.
 */
export async function dispatchOutboundMessage(
  args: OutboundDispatchArgs,
): Promise<OutboundDispatchResult> {
  const {
    accountId,
    userId,
    conversationId,
    contactId,
    text,
    aiGenerated = false,
    senderType = 'agent',
    mediaUrl,
    mediaType,
  } = args

  const db = args.db ?? supabaseAdmin()

  // 1. Fetch conversation details to check channel and connection
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('id, channel, channel_connection_id, last_inbound_at')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr || !conv) {
    return { success: false, channel: 'whatsapp', error: 'Conversation not found' }
  }

  const channel: ChannelType = conv.channel || 'whatsapp'

  // 2. Dispatch to WhatsApp
  if (channel === 'whatsapp') {
    try {
      const res = await engineSendText({
        accountId,
        userId,
        conversationId,
        contactId,
        text,
        aiGenerated,
      })
      return { success: true, channel: 'whatsapp', messageId: res.whatsapp_message_id }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, channel: 'whatsapp', error: msg }
    }
  }

  // 3. Dispatch to Instagram or Facebook Messenger
  if (!conv.channel_connection_id) {
    return {
      success: false,
      channel,
      error: `No channel connection configured for this ${channel} conversation`,
    }
  }

  const token = await getDecryptedChannelToken(conv.channel_connection_id, accountId)
  if (!token) {
    return {
      success: false,
      channel,
      error: 'Failed to decrypt access token for connected page',
    }
  }

  // Fetch recipient's social ID from contact
  const { data: contact } = await db
    .from('contacts')
    .select('ig_user_id, fb_page_scoped_id')
    .eq('id', contactId)
    .single()

  const recipientId = channel === 'instagram' ? contact?.ig_user_id : contact?.fb_page_scoped_id
  if (!recipientId) {
    return {
      success: false,
      channel,
      error: `Contact has no ${channel} identifier (IGSID or PSID)`,
    }
  }

  // 4. Check 24-hour window & Human Agent Tag
  let isHumanAgentTag = false
  const now = Date.now()
  const lastInboundTime = conv.last_inbound_at ? new Date(conv.last_inbound_at).getTime() : 0
  const hoursSinceInbound = (now - lastInboundTime) / (1000 * 60 * 60)

  // Meta policy: Standard messaging window is 24 hours.
  // Between 24h and 7 days (168h), a human agent may respond using HUMAN_AGENT tag.
  if (hoursSinceInbound > 24) {
    if (hoursSinceInbound <= 168 && senderType === 'agent') {
      isHumanAgentTag = true
    } else if (hoursSinceInbound > 168) {
      return {
        success: false,
        channel,
        error: 'Outside allowed messaging window (exceeded 7 days). Cannot send message.',
      }
    }
  }

  // 5. Construct Meta Graph API payload
  const sendUrl = `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(token)}`
  const bodyPayload: Record<string, unknown> = {
    recipient: { id: recipientId },
  }

  if (mediaUrl) {
    const attachmentType = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'image'
    bodyPayload.message = {
      attachment: {
        type: attachmentType,
        payload: { url: mediaUrl, is_reusable: true },
      },
    }
  } else {
    bodyPayload.message = { text }
  }

  if (isHumanAgentTag) {
    bodyPayload.tag = 'HUMAN_AGENT'
  }

  try {
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      const errMsg = data.error?.message || 'Meta API call failed'
      return { success: false, channel, error: errMsg }
    }

    const messageId = data.message_id || `meta_${Date.now()}`
    const timestamp = new Date().toISOString()

    // 6. Persist outbound message in database
    await db.from('messages').insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: userId,
      content_type: mediaUrl ? (mediaType === 'audio' ? 'audio' : mediaType === 'video' ? 'video' : 'image') : 'text',
      content_text: text || null,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      message_id: messageId,
      channel,
      is_human_agent_tag: isHumanAgentTag,
      ai_generated: aiGenerated,
      status: 'sent',
      created_at: timestamp,
    })

    // 7. Update conversation last message state
    await db
      .from('conversations')
      .update({
        last_message_text: text || '[Attachment]',
        last_message_at: timestamp,
        last_reply_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', conversationId)

    return {
      success: true,
      channel,
      messageId,
      isHumanAgentTag,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, channel, error: msg }
  }
}
