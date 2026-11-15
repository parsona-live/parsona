import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractPhoneAndEmail,
  extractNameFromText,
  findContactBySocialId,
  findContactByPhone,
  findContactByEmail,
  createSocialContact,
  linkContacts,
} from './identity'
import { getDecryptedChannelToken, fetchSenderProfile } from './channels'
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

  // 1.5. Resolve profile info from Meta Graph API
  const channelToken = await getDecryptedChannelToken(connection.id, accountId).catch((err) => {
    console.error(`[processInboundMetaMessage] Failed to decrypt channel token for connection ${connection.id}:`, err)
    return null
  })
  console.log(`[processInboundMetaMessage] Channel token loaded: ${!!channelToken}, page_id: ${connection.page_id}`)

  const profile = channelToken
    ? await fetchSenderProfile(channel, senderId, channelToken, connection.page_id)
    : null
  console.log(`[processInboundMetaMessage] Resolved profile from Meta:`, JSON.stringify(profile))

  // 2. Identify or auto-link contact
  let contact = await findContactBySocialId(db, accountId, channel, senderId)
  let autoLinked = false

  const extractedName = extractNameFromText(text)
  const { phones, emails } = extractPhoneAndEmail(text)

  console.log(`[processInboundMetaMessage] Extracted from message text "${text}":`, {
    extractedName,
    phones,
    emails,
  })

  // Check if we can find a matching WhatsApp contact by phone or email
  let matchingContact: Contact | null = null
  if (phones.length > 0) {
    for (const phone of phones) {
      matchingContact = await findContactByPhone(db, accountId, phone)
      if (matchingContact) break
    }
  }
  if (!matchingContact && emails.length > 0) {
    for (const email of emails) {
      matchingContact = await findContactByEmail(db, accountId, email)
      if (matchingContact) break
    }
  }

  if (matchingContact) {
    console.log(`[processInboundMetaMessage] Found matching contact for auto-link: ID=${matchingContact.id}, Name=${matchingContact.name}`)
  }

  if (!contact) {
    // Create new contact with real profile name, customer-stated name, or avatar
    const name =
      profile?.name ||
      extractedName ||
      (profile?.username
        ? `@${profile.username}`
        : channel === 'instagram'
          ? 'Instagram User'
          : 'Facebook User')

    console.log(`[processInboundMetaMessage] Creating new contact with name: "${name}"`)
    contact = await createSocialContact(db, accountId, connection.user_id, {
      channel,
      socialId: senderId,
      name,
      username: profile?.username || null,
      avatarUrl: profile?.profilePic || null,
      linkedContactId: matchingContact?.id || null,
    })

    const initialUpdates: Record<string, unknown> = {}
    if (emails.length > 0) initialUpdates.email = emails[0]
    if (phones.length > 0) initialUpdates.phone = phones[0]
    if (Object.keys(initialUpdates).length > 0) {
      await db.from('contacts').update(initialUpdates).eq('id', contact.id)
      contact = { ...contact, ...initialUpdates } as Contact
      console.log(`[processInboundMetaMessage] Initialized contact email/phone:`, initialUpdates)
    }

    if (matchingContact) {
      autoLinked = true
    }
  } else {
    // Contact exists. Update profile name/avatar if missing or default
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const isDefaultName =
      !contact.name ||
      contact.name === 'Facebook User' ||
      contact.name === 'Instagram User'

    if (isDefaultName) {
      if (profile?.name) {
        console.log(`[processInboundMetaMessage] Updating default name to Meta profile name: "${profile.name}"`)
        updates.name = profile.name
      } else if (extractedName) {
        console.log(`[processInboundMetaMessage] Updating default name to customer-stated name: "${extractedName}"`)
        updates.name = extractedName
      } else if (
        matchingContact?.name &&
        matchingContact.name !== 'Facebook User' &&
        matchingContact.name !== 'Instagram User'
      ) {
        console.log(`[processInboundMetaMessage] Updating default name to matching contact name: "${matchingContact.name}"`)
        updates.name = matchingContact.name
      }
    }

    if (!contact.email && emails.length > 0) {
      console.log(`[processInboundMetaMessage] Updating contact email: "${emails[0]}"`)
      updates.email = emails[0]
    }
    if (!contact.phone && phones.length > 0) {
      console.log(`[processInboundMetaMessage] Updating contact phone: "${phones[0]}"`)
      updates.phone = phones[0]
    }
    if (!contact.avatar_url && profile?.profilePic) {
      updates.avatar_url = profile.profilePic
    }
    if (channel === 'instagram' && !contact.ig_username && profile?.username) {
      updates.ig_username = profile.username
    }
    if (channel === 'facebook' && !contact.fb_name && (profile?.name || extractedName)) {
      updates.fb_name = profile?.name || extractedName
    }

    // Link to matching contact if found and not already linked
    if (matchingContact && matchingContact.id !== contact.id && !contact.linked_contact_id) {
      await linkContacts(db, accountId, matchingContact.id, contact.id).catch(console.warn)
      contact.linked_contact_id = matchingContact.id
      autoLinked = true
      console.log(`[processInboundMetaMessage] Linked contact ${contact.id} to contact ${matchingContact.id}`)
    }

    if (Object.keys(updates).length > 1) {
      const { data: updated } = await db
        .from('contacts')
        .update(updates)
        .eq('id', contact.id)
        .select()
        .single()
      if (updated) contact = updated as Contact
      console.log(`[processInboundMetaMessage] Successfully applied contact updates:`, updates)
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
