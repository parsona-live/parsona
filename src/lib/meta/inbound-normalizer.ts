import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractPhoneAndEmail,
  findContactBySocialId,
  findContactByPhone,
  findContactByEmail,
  linkSocialIdToContact,
  createSocialContact,
} from './identity'
import type { ChannelType, Contact, Conversation, Message, MetaChannelConnection } from '@/types'

export interface MetaMessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{
      type: 'image' | 'audio' | 'video' | 'file' | 'fallback'
      payload?: { url?: string }
    }>
    quick_reply?: { payload: string }
    is_echo?: boolean
  }
}

export interface NormalizedInboundResult {
  connection: MetaChannelConnection
  contact: Contact
  conversation: Conversation
  message: Message
  autoLinked: boolean
}

/**
 * Normalize and process an inbound Instagram Direct or Facebook Messenger message.
 */
export async function processInboundMetaMessage(
  db: SupabaseClient,
  channel: ChannelType,
  event: MetaMessagingEvent,
): Promise<NormalizedInboundResult | null> {
  const msg = event.message
  if (!msg || msg.is_echo) return null

  const senderId = event.sender.id
  const recipientId = event.recipient.id
  const text = msg.text || ''
  const attachment = msg.attachments?.[0]
  const mediaUrl = attachment?.payload?.url || null
  const mediaType = attachment?.type || null
  const mid = msg.mid

  // 1. Resolve channel connection by recipient ID (Page ID or Instagram Business ID)
  let connQuery = db
    .from('meta_channel_connections')
    .select('*')
    .eq('channel', channel)

  if (channel === 'instagram') {
    connQuery = connQuery.eq('instagram_business_id', recipientId)
  } else {
    connQuery = connQuery.eq('page_id', recipientId)
  }

  const { data: connData, error: connErr } = await connQuery.maybeSingle()
  if (connErr || !connData) {
    console.warn(`[processInboundMetaMessage] No channel connection found for ${channel} recipient ${recipientId}`)
    return null
  }
  const connection = connData as MetaChannelConnection
  const accountId = connection.account_id

  // 2. Identify or auto-link contact
  let contact = await findContactBySocialId(db, accountId, channel, senderId)
  let autoLinked = false

  // If contact wasn't found by social ID, check if text has phone/email to match existing WhatsApp contact
  const { phones, emails } = extractPhoneAndEmail(text)

  if (!contact && phones.length > 0) {
    for (const phone of phones) {
      const match = await findContactByPhone(db, accountId, phone)
      if (match) {
        contact = await linkSocialIdToContact(db, accountId, match.id, {
          channel,
          socialId: senderId,
        })
        autoLinked = true
        break
      }
    }
  }

  if (!contact && emails.length > 0) {
    for (const email of emails) {
      const match = await findContactByEmail(db, accountId, email)
      if (match) {
        contact = await linkSocialIdToContact(db, accountId, match.id, {
          channel,
          socialId: senderId,
        })
        autoLinked = true
        break
      }
    }
  }

  // If still not linked, create a new social contact
  if (!contact) {
    contact = await createSocialContact(db, accountId, connection.user_id, {
      channel,
      socialId: senderId,
    })
  } else if (!autoLinked && (phones.length > 0 || emails.length > 0)) {
    // If contact already exists but they just provided their phone or email, enrich contact record
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ((!contact.phone || contact.phone === '') && phones.length > 0) {
      updates.phone = phones[0]
    }
    if (!contact.email && emails.length > 0) {
      updates.email = emails[0]
    }
    if (Object.keys(updates).length > 1) {
      const { data: updated } = await db
        .from('contacts')
        .update(updates)
        .eq('id', contact.id)
        .select()
        .single()
      if (updated) contact = updated as Contact
    }
  }

  // 3. Find or create conversation for this contact and channel
  const { data: existingConv } = await db
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contact.id)
    .eq('channel', channel)
    .maybeSingle()

  let conversation: Conversation
  const now = new Date().toISOString()

  if (existingConv) {
    const unreadCount = (existingConv.unread_count || 0) + 1
    const { data: updatedConv, error: updateErr } = await db
      .from('conversations')
      .update({
        status: 'open',
        last_message_text: text || (mediaType ? `[${mediaType}]` : '[Attachment]'),
        last_message_at: now,
        last_inbound_at: now,
        unread_count: unreadCount,
        channel_connection_id: connection.id,
        updated_at: now,
      })
      .eq('id', existingConv.id)
      .select()
      .single()

    if (updateErr) throw updateErr
    conversation = updatedConv as Conversation
  } else {
    const { data: newConv, error: createErr } = await db
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: connection.user_id,
        contact_id: contact.id,
        channel,
        channel_connection_id: connection.id,
        status: 'open',
        last_message_text: text || (mediaType ? `[${mediaType}]` : '[Attachment]'),
        last_message_at: now,
        last_inbound_at: now,
        unread_count: 1,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (createErr) throw createErr
    conversation = newConv as Conversation
  }

  // 4. Insert message
  const contentType = mediaType ? (mediaType === 'audio' ? 'audio' : mediaType === 'video' ? 'video' : 'image') : 'text'
  const { data: messageData, error: msgErr } = await db
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_type: 'customer',
      sender_id: null,
      content_type: contentType,
      content_text: text || null,
      media_url: mediaUrl,
      media_type: mediaType,
      message_id: mid,
      channel,
      status: 'delivered',
      created_at: now,
    })
    .select()
    .single()

  if (msgErr) throw msgErr

  return {
    connection,
    contact,
    conversation,
    message: messageData as Message,
    autoLinked,
  }
}
