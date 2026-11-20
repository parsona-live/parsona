import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  engineSendText,
  engineSendInteractiveButtons,
  engineSendInteractiveList,
  engineSendInteractiveCarousel,
  engineSendMedia,
} from '@/lib/flows/meta-send'
import { getDecryptedChannelToken } from '@/lib/meta/channels'
import type { ChannelType } from '@/types'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export interface AdaptiveResult {
  success: boolean
  channel: ChannelType
  messageId?: string
  error?: string
  windowExpired?: boolean
}

export interface SendAdaptiveTextArgs {
  db?: SupabaseClient
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  text: string
  aiGenerated?: boolean
  senderType?: 'agent' | 'bot'
}

export interface SendAdaptiveButtonsArgs {
  db?: SupabaseClient
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  headerText?: string
  bodyText: string
  footerText?: string
  buttons: Array<{ id: string; title: string }>
  senderType?: 'agent' | 'bot'
}

export interface SendAdaptiveListArgs {
  db?: SupabaseClient
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  headerText?: string
  bodyText: string
  footerText?: string
  buttonText?: string
  sections: Array<{
    title?: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
  senderType?: 'agent' | 'bot'
}

export interface SendAdaptiveCarouselArgs {
  db?: SupabaseClient
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  cards: Array<{
    card_index?: number
    cardIndex?: number
    header_media_type?: 'image' | 'video'
    header_media_url?: string
    headerImageUrl?: string
    body_text?: string
    bodyText?: string
    buttons: Array<{ id: string; title: string }>
  }>
  senderType?: 'agent' | 'bot'
}

export interface SendAdaptiveMediaArgs {
  db?: SupabaseClient
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  mediaType: 'image' | 'video' | 'audio' | 'document'
  mediaUrl: string
  caption?: string
  fileName?: string
  senderType?: 'agent' | 'bot'
}

/**
 * Validates 24-hour Meta messaging window for Instagram and Facebook.
 * Prevents automated bot sends from triggering Meta API policy violations (#10 / #230).
 */
function isWithin24HourWindow(lastInboundAt?: string | null): boolean {
  if (!lastInboundAt) return false
  const elapsedMs = Date.now() - new Date(lastInboundAt).getTime()
  return elapsedMs <= 24 * 60 * 60 * 1000
}

/**
 * Truncate a string to maxLength with an optional ellipsis.
 */
function truncate(str: string | undefined | null, maxLength: number): string {
  if (!str) return ''
  const trimmed = str.trim()
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength - 1) + '…'
}

/**
 * Universal Omnichannel Text Dispatcher.
 */
export async function sendAdaptiveText(args: SendAdaptiveTextArgs): Promise<AdaptiveResult> {
  const db = args.db ?? supabaseAdmin()
  const { data: conv } = await db
    .from('conversations')
    .select('id, channel, channel_connection_id, last_inbound_at')
    .eq('id', args.conversationId)
    .maybeSingle()

  const channel: ChannelType = conv?.channel || 'whatsapp'

  if (channel === 'whatsapp') {
    try {
      const res = await engineSendText({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        text: args.text,
        aiGenerated: args.aiGenerated,
      })
      return { success: true, channel, messageId: res.whatsapp_message_id }
    } catch (err) {
      return { success: false, channel, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Instagram / Facebook 24h Window Check
  if (args.senderType === 'bot' && !isWithin24HourWindow(conv?.last_inbound_at)) {
    return {
      success: false,
      channel,
      windowExpired: true,
      error: 'Outside allowed 24-hour messaging window for automated messages',
    }
  }

  return postMetaGraphMessage({
    db,
    channel,
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    connectionId: conv?.channel_connection_id,
    bodyPayload: { text: args.text },
    previewText: args.text,
    senderType: args.senderType || 'bot',
    aiGenerated: args.aiGenerated,
  })
}

/**
 * Universal Omnichannel Interactive Buttons Dispatcher.
 * - WhatsApp: Native 3-button interactive message.
 * - Instagram/Facebook: Quick Replies pills (up to 13 buttons, max 20 chars per title).
 */
export async function sendAdaptiveButtons(args: SendAdaptiveButtonsArgs): Promise<AdaptiveResult> {
  const db = args.db ?? supabaseAdmin()
  const { data: conv } = await db
    .from('conversations')
    .select('id, channel, channel_connection_id, last_inbound_at')
    .eq('id', args.conversationId)
    .maybeSingle()

  const channel: ChannelType = conv?.channel || 'whatsapp'

  if (channel === 'whatsapp') {
    try {
      const res = await engineSendInteractiveButtons({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        headerText: args.headerText,
        bodyText: args.bodyText,
        footerText: args.footerText,
        buttons: args.buttons.slice(0, 3).map((b) => ({
          id: b.id,
          title: truncate(b.title, 20),
        })),
      })
      return { success: true, channel, messageId: res.whatsapp_message_id }
    } catch (err) {
      return { success: false, channel, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // 24h Window Check
  if (args.senderType !== 'agent' && !isWithin24HourWindow(conv?.last_inbound_at)) {
    return {
      success: false,
      channel,
      windowExpired: true,
      error: 'Outside allowed 24-hour messaging window for automated messages',
    }
  }

  // Render as Generic Template card with clickable native buttons for Instagram & Facebook (1-3 buttons)
  const templateTitle = truncate(args.headerText || args.bodyText, 80)
  const templateSubtitle = args.headerText
    ? truncate(args.bodyText, 80)
    : args.footerText
    ? truncate(args.footerText, 80)
    : undefined

  const postbackButtons = args.buttons.slice(0, 3).map((b) => ({
    type: 'postback' as const,
    title: truncate(b.title, 20),
    payload: b.id,
  }))

  const messageText = args.headerText
    ? `${args.headerText}\n\n${args.bodyText}`
    : args.bodyText

  // Instagram Direct / Messenger: Try native Generic Template card first for 1-3 buttons
  if (postbackButtons.length > 0 && postbackButtons.length <= 3) {
    const templateResult = await postMetaGraphMessage({
      db,
      channel,
      accountId: args.accountId,
      userId: args.userId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      connectionId: conv?.channel_connection_id,
      bodyPayload: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: templateTitle,
                ...(templateSubtitle ? { subtitle: templateSubtitle } : {}),
                buttons: postbackButtons,
              },
            ],
          },
        },
      },
      previewText: messageText,
      senderType: args.senderType || 'bot',
    })

    if (templateResult.success) {
      return templateResult
    }

    console.warn(
      `[sendAdaptiveButtons] Generic template failed on ${channel}, falling back to quick replies:`,
      templateResult.error,
    )
  }

  // Fallback: Quick Replies
  const quickReplies = args.buttons.slice(0, 13).map((b) => ({
    content_type: 'text',
    title: truncate(b.title, 20),
    payload: b.id,
  }))

  return postMetaGraphMessage({
    db,
    channel,
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    connectionId: conv?.channel_connection_id,
    bodyPayload: {
      text: messageText,
      quick_replies: quickReplies,
    },
    previewText: messageText,
    senderType: args.senderType || 'bot',
  })
}

/**
 * Universal Omnichannel Interactive List Dispatcher.
 * - WhatsApp: Native interactive list picker with sections.
 * - Instagram/Facebook: Quick Replies pills (up to 13) or Generic Template card carousel.
 */
export async function sendAdaptiveList(args: SendAdaptiveListArgs): Promise<AdaptiveResult> {
  const db = args.db ?? supabaseAdmin()
  const { data: conv } = await db
    .from('conversations')
    .select('id, channel, channel_connection_id, last_inbound_at')
    .eq('id', args.conversationId)
    .maybeSingle()

  const channel: ChannelType = conv?.channel || 'whatsapp'

  if (channel === 'whatsapp') {
    try {
      const res = await engineSendInteractiveList({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        headerText: args.headerText,
        bodyText: args.bodyText,
        footerText: args.footerText,
        buttonLabel: args.buttonText || 'Select',
        sections: args.sections,
      })
      return { success: true, channel, messageId: res.whatsapp_message_id }
    } catch (err) {
      return { success: false, channel, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // 24h Window Check
  if (args.senderType !== 'agent' && !isWithin24HourWindow(conv?.last_inbound_at)) {
    return {
      success: false,
      channel,
      windowExpired: true,
      error: 'Outside allowed 24-hour messaging window for automated messages',
    }
  }

  // Flatten rows across sections
  const allRows = args.sections.flatMap((s) => s.rows)
  const messageText = args.headerText
    ? `${args.headerText}\n\n${args.bodyText}`
    : args.bodyText

  // If items fit cleanly in Quick Replies (< 13 items and titles fit in 20 chars)
  if (allRows.length <= 13 && allRows.every((r) => r.title.length <= 20)) {
    const quickReplies = allRows.map((r) => ({
      content_type: 'text',
      title: truncate(r.title, 20),
      payload: r.id,
    }))

    return postMetaGraphMessage({
      db,
      channel,
      accountId: args.accountId,
      userId: args.userId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      connectionId: conv?.channel_connection_id,
      bodyPayload: {
        text: messageText,
        quick_replies: quickReplies,
      },
      previewText: messageText,
      senderType: args.senderType || 'bot',
    })
  }

  // Otherwise, render as Generic Template cards (up to 10 cards)
  const elements = allRows.slice(0, 10).map((r) => ({
    title: truncate(r.title, 80),
    subtitle: truncate(r.description || messageText, 80),
    buttons: [
      {
        type: 'postback',
        title: truncate(args.buttonText || 'Select', 20),
        payload: r.id,
      },
    ],
  }))

  return postMetaGraphMessage({
    db,
    channel,
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    connectionId: conv?.channel_connection_id,
    bodyPayload: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements,
        },
      },
    },
    previewText: messageText,
    senderType: args.senderType || 'bot',
  })
}

/**
 * Universal Omnichannel Carousel Dispatcher.
 * - WhatsApp: Native WhatsApp Carousel cards.
 * - Instagram/Facebook: Generic Template cards (image, title, buttons).
 */
export async function sendAdaptiveCarousel(args: SendAdaptiveCarouselArgs): Promise<AdaptiveResult> {
  const db = args.db ?? supabaseAdmin()
  const { data: conv } = await db
    .from('conversations')
    .select('id, channel, channel_connection_id, last_inbound_at')
    .eq('id', args.conversationId)
    .maybeSingle()

  const channel: ChannelType = conv?.channel || 'whatsapp'

  if (channel === 'whatsapp') {
    try {
      const res = await engineSendInteractiveCarousel({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        bodyText: 'Swipe to view options',
        cards: args.cards.map((c, idx) => ({
          cardIndex: c.card_index ?? c.cardIndex ?? idx,
          headerImageUrl: c.header_media_url || c.headerImageUrl || '',
          bodyText: c.body_text || c.bodyText || '',
          buttons: c.buttons.slice(0, 3).map((b) => ({
            id: b.id,
            title: truncate(b.title, 20),
          })),
        })),
      })
      return { success: true, channel, messageId: res.whatsapp_message_id }
    } catch (err) {
      return { success: false, channel, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // 24h Window Check
  if (args.senderType !== 'agent' && !isWithin24HourWindow(conv?.last_inbound_at)) {
    return {
      success: false,
      channel,
      windowExpired: true,
      error: 'Outside allowed 24-hour messaging window for automated messages',
    }
  }

  const elements = args.cards.slice(0, 10).map((c) => ({
    title: truncate(c.body_text || c.bodyText || '', 80),
    image_url: c.header_media_url || c.headerImageUrl || undefined,
    buttons: c.buttons.slice(0, 3).map((b) => ({
      type: 'postback',
      title: truncate(b.title, 20),
      payload: b.id,
    })),
  }))

  return postMetaGraphMessage({
    db,
    channel,
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    connectionId: conv?.channel_connection_id,
    bodyPayload: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements,
        },
      },
    },
    previewText: '[Carousel Cards]',
    senderType: args.senderType || 'bot',
  })
}

/**
 * Universal Omnichannel Media Dispatcher.
 * Handles images, videos, audio, and documents with Instagram PDF fallback.
 */
export async function sendAdaptiveMedia(args: SendAdaptiveMediaArgs): Promise<AdaptiveResult> {
  const db = args.db ?? supabaseAdmin()
  const { data: conv } = await db
    .from('conversations')
    .select('id, channel, channel_connection_id, last_inbound_at')
    .eq('id', args.conversationId)
    .maybeSingle()

  const channel: ChannelType = conv?.channel || 'whatsapp'

  if (channel === 'whatsapp') {
    try {
      const res = await engineSendMedia({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        kind: args.mediaType,
        link: args.mediaUrl,
        caption: args.caption,
        filename: args.fileName,
      })
      return { success: true, channel, messageId: res.whatsapp_message_id }
    } catch (err) {
      return { success: false, channel, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // 24h Window Check
  if (args.senderType !== 'agent' && !isWithin24HourWindow(conv?.last_inbound_at)) {
    return {
      success: false,
      channel,
      windowExpired: true,
      error: 'Outside allowed 24-hour messaging window for automated messages',
    }
  }

  // Instagram does not support generic document attachments; fallback to text link
  if (channel === 'instagram' && args.mediaType === 'document') {
    const textMsg = args.caption
      ? `${args.caption}\n\n📄 Document: ${args.mediaUrl}`
      : `📄 Document: ${args.mediaUrl}`

    return postMetaGraphMessage({
      db,
      channel,
      accountId: args.accountId,
      userId: args.userId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      connectionId: conv?.channel_connection_id,
      bodyPayload: { text: textMsg },
      previewText: textMsg,
      senderType: args.senderType || 'bot',
    })
  }

  const attachmentType = args.mediaType === 'document' ? 'file' : args.mediaType

  return postMetaGraphMessage({
    db,
    channel,
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    connectionId: conv?.channel_connection_id,
    bodyPayload: {
      attachment: {
        type: attachmentType,
        payload: { url: args.mediaUrl, is_reusable: true },
      },
    },
    previewText: args.caption || `[${args.mediaType}]`,
    mediaUrl: args.mediaUrl,
    mediaType: args.mediaType,
    senderType: args.senderType || 'bot',
  })
}

// ------------------------------------------------------------
// Internal Helper: Post to Meta Graph API for IG / FB
// ------------------------------------------------------------

interface PostMetaGraphArgs {
  db: SupabaseClient
  channel: ChannelType
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  connectionId?: string | null
  bodyPayload: Record<string, unknown>
  previewText: string
  mediaUrl?: string
  mediaType?: string
  senderType: 'agent' | 'bot'
  aiGenerated?: boolean
}

async function postMetaGraphMessage(args: PostMetaGraphArgs): Promise<AdaptiveResult> {
  const { db, channel, accountId, userId, conversationId, contactId, connectionId } = args

  if (!connectionId) {
    return {
      success: false,
      channel,
      error: `No channel connection configured for this ${channel} conversation`,
    }
  }

  const token = await getDecryptedChannelToken(connectionId, accountId)
  if (!token) {
    return {
      success: false,
      channel,
      error: 'Failed to decrypt channel access token',
    }
  }

  const { data: contact } = await db
    .from('contacts')
    .select('ig_user_id, fb_page_scoped_id')
    .eq('id', contactId)
    .maybeSingle()

  const recipientId = channel === 'instagram' ? contact?.ig_user_id : contact?.fb_page_scoped_id
  if (!recipientId) {
    return {
      success: false,
      channel,
      error: `Contact has no ${channel} recipient ID (IGSID/PSID)`,
    }
  }

  const sendUrl = `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(token)}`
  const requestBody = {
    recipient: { id: recipientId },
    messaging_type: 'RESPONSE',
    message: args.bodyPayload,
  }

  try {
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      const errMsg = data.error?.message || 'Meta API request failed'
      return { success: false, channel, error: errMsg }
    }

    const messageId = data.message_id || `meta_${Date.now()}`
    const timestamp = new Date().toISOString()

    // Persist outbound message in database
    await db.from('messages').insert({
      conversation_id: conversationId,
      sender_type: args.senderType,
      sender_id: userId,
      content_type: args.mediaUrl ? (args.mediaType || 'image') : 'text',
      content_text: args.previewText || null,
      media_url: args.mediaUrl || null,
      media_type: args.mediaType || null,
      message_id: messageId,
      channel,
      ai_generated: args.aiGenerated || false,
      status: 'sent',
      created_at: timestamp,
    })

    // Update conversation state
    await db
      .from('conversations')
      .update({
        last_message_text: args.previewText,
        last_message_at: timestamp,
        last_reply_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', conversationId)

    return {
      success: true,
      channel,
      messageId,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, channel, error: msg }
  }
}
