import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractPhoneAndEmail,
  extractNameFromText,
  findContactBySocialId,
  findCanonicalContactByIdentity,
  findContactByPhone,
  findContactByEmail,
  createSocialContact,
  linkContacts,
} from './identity'
import { getDecryptedChannelToken, fetchSenderProfile } from './channels'
import { logContactActivity } from '@/lib/contacts/timeline'
import type { ChannelType, Contact, Conversation, Message, MetaChannelConnection } from '@/types'

export interface MetaMessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{
      type: string
      payload?: {
        url?: string
        title?: string
        reel_video_url?: string
        preview_url?: string
      }
    }>
    quick_reply?: { payload: string }
    is_echo?: boolean
  }
  delivery?: {
    mids?: string[]
    watermark?: number
  }
  read?: {
    watermark?: number
    mid?: string
  }
  postback?: {
    payload: string
    title?: string
    mid?: string
  }
  reaction?: {
    mid?: string
    action?: 'react' | 'unreact'
    reaction?: string
    emoji?: string
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
  const postback = event.postback
  if ((!msg && !postback) || msg?.is_echo) return null

  const senderId = event.sender.id
  const recipientId = event.recipient.id
  const quickReplyPayload = msg?.quick_reply?.payload || postback?.payload || null
  const isInteractive = Boolean(quickReplyPayload)

  const attachment = msg?.attachments?.[0]
  const mediaUrl =
    attachment?.payload?.url ||
    attachment?.payload?.reel_video_url ||
    attachment?.payload?.preview_url ||
    null
  const rawMediaType = attachment?.type || null
  const isReel =
    rawMediaType === 'reel' ||
    rawMediaType === 'ig_reel' ||
    (rawMediaType === 'share' && channel === 'instagram')

  let text = msg?.text || postback?.title || ''
  if (!text && isReel) {
    text = attachment?.payload?.title || 'Shared an Instagram Reel'
  }
  const mid = msg?.mid || postback?.mid || `meta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

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

  // Check if we can find a matching contact by persistent identity, phone, or email
  let matchingContact: Contact | null = null

  // 2a. First, check persistent contact_identities (e.g. returning user whose chat was deleted)
  if (!contact) {
    matchingContact = await findCanonicalContactByIdentity(db, accountId, channel, senderId)
    if (matchingContact) {
      console.log(`[processInboundMetaMessage] Recognized returning customer from contact_identities! Primary ID=${matchingContact.id}, Name=${matchingContact.name}`)
    }
  }

  // 2b. Check matching contact by extracted phone or email
  if (!matchingContact && phones.length > 0) {
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
    // Create new channel contact and link to matchingContact if found
    const name =
      profile?.name ||
      (matchingContact?.name && matchingContact.name !== 'Instagram User' && matchingContact.name !== 'Facebook User' ? matchingContact.name : null) ||
      extractedName ||
      (profile?.username
        ? `@${profile.username.replace(/^@/, '')}`
        : channel === 'instagram'
          ? 'Instagram User'
          : 'Facebook User')

    console.log(`[processInboundMetaMessage] Creating new contact with name: "${name}"`)
    contact = await createSocialContact(db, accountId, connection.user_id, {
      channel,
      socialId: senderId,
      name,
      username: profile?.username || null,
      avatarUrl: profile?.profilePic || matchingContact?.avatar_url || null,
      linkedContactId: matchingContact?.id || null,
    })

    const initialUpdates: Record<string, unknown> = {}
    if (matchingContact?.email) {
      initialUpdates.email = matchingContact.email
    } else if (emails.length > 0) {
      initialUpdates.email = emails[0]
    }

    if (!matchingContact && phones.length > 0) {
      initialUpdates.phone = phones[0]
    }

    if (Object.keys(initialUpdates).length > 0) {
      await db.from('contacts').update(initialUpdates).eq('id', contact.id)
      contact = { ...contact, ...initialUpdates } as Contact
      console.log(`[processInboundMetaMessage] Initialized contact email/phone:`, initialUpdates)
    }

    if (matchingContact) {
      autoLinked = true
      const linkResult = await linkContacts(db, accountId, matchingContact.id, contact.id).catch(console.warn)
      if (linkResult && typeof linkResult === 'object' && 'secondary' in linkResult && linkResult.secondary) {
        contact = linkResult.secondary as Contact
      }
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
      } else if (profile?.username) {
        updates.name = `@${profile.username.replace(/^@/, '')}`
      }
    }

    if (!contact.email) {
      if (matchingContact?.email) {
        updates.email = matchingContact.email
      } else if (emails.length > 0) {
        console.log(`[processInboundMetaMessage] Updating contact email: "${emails[0]}"`)
        updates.email = emails[0]
      }
    }

    if (!contact.phone && !matchingContact && phones.length > 0) {
      console.log(`[processInboundMetaMessage] Updating contact phone: "${phones[0]}"`)
      updates.phone = phones[0]
    }

    if (profile?.profilePic && profile.profilePic !== contact.avatar_url) {
      console.log(`[processInboundMetaMessage] Updating contact avatar_url from profile`)
      updates.avatar_url = profile.profilePic
    }
    if (channel === 'instagram' && profile?.username && profile.username.replace(/^@/, '') !== contact.ig_username) {
      updates.ig_username = profile.username.replace(/^@/, '')
    }
    if (channel === 'facebook' && !contact.fb_name && (profile?.name || extractedName)) {
      updates.fb_name = profile?.name || extractedName
    }

    // Link to matching contact if found and not already linked
    if (matchingContact && matchingContact.id !== contact.id && !contact.linked_contact_id) {
      const linkResult = await linkContacts(db, accountId, matchingContact.id, contact.id).catch(console.warn)
      contact.linked_contact_id = matchingContact.id
      if (linkResult && typeof linkResult === 'object' && 'secondary' in linkResult && linkResult.secondary) {
        contact = linkResult.secondary as Contact
      } else {
        if (matchingContact.phone && contact.phone !== matchingContact.phone) {
          contact.phone = matchingContact.phone
        }
        if (!contact.avatar_url && matchingContact.avatar_url) {
          contact.avatar_url = matchingContact.avatar_url
        }
      }
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
  const displaySummary = isReel
    ? 'Shared an Instagram Reel'
    : isInteractive
      ? (text || 'Button reply')
      : (text || (rawMediaType ? `[${rawMediaType}]` : '[Attachment]'))

  if (existingConv) {
    conversation = existingConv as Conversation
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
        last_message_text: displaySummary,
        last_message_at: now,
        last_inbound_at: now,
        unread_count: 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (createErr) throw createErr
    conversation = newConv as Conversation
  }

  // 4. Idempotent insert into messages (deduplication boundary)
  const contentType = isInteractive
    ? 'interactive'
    : rawMediaType === 'audio'
      ? 'audio'
      : rawMediaType === 'video' || isReel
        ? 'video'
        : rawMediaType === 'image' || rawMediaType === 'file'
          ? 'image'
          : 'text'

  const { data: insertedRows, error: msgErr } = await db
    .from('messages')
    .upsert(
      {
        conversation_id: conversation.id,
        sender_type: 'customer',
        sender_id: null,
        content_type: contentType,
        content_text: text || (isReel ? 'Shared an Instagram Reel' : null),
        media_url: mediaUrl,
        media_type: rawMediaType || (isReel ? 'reel' : null),
        interactive_reply_id: quickReplyPayload,
        message_id: mid,
        channel,
        status: 'delivered',
        created_at: now,
      },
      { onConflict: 'conversation_id,message_id', ignoreDuplicates: true },
    )
    .select()

  if (msgErr) throw msgErr

  // If ignoreDuplicates dropped it because this mid was already received:
  if (!insertedRows || insertedRows.length === 0) {
    console.info('[processInboundMetaMessage] duplicate inbound message ignored (idempotent replay):', mid)
    return null
  }

  const messageData = insertedRows[0]

  // Genuine new message: bump unread count and update last message state
  const unreadCount = (conversation.unread_count || 0) + 1
  const { data: updatedConv, error: updateErr } = await db
    .from('conversations')
    .update({
      status: 'open',
      last_message_text: displaySummary,
      last_message_at: now,
      last_inbound_at: now,
      unread_count: unreadCount,
      channel_connection_id: connection.id,
      updated_at: now,
    })
    .eq('id', conversation.id)
    .select()
    .single()

  if (!updateErr && updatedConv) {
    conversation = updatedConv as Conversation
  }

  // 5. Log inbound message to contact activity timeline (fire-and-forget safe)
  await logContactActivity(db, {
    accountId,
    contactId: contact.id,
    conversationId: conversation.id,
    channel,
    eventType: 'message_inbound',
    summary: displaySummary ? `${channel === 'instagram' ? 'Instagram' : 'Facebook'}: ${displaySummary.slice(0, 100)}` : `Inbound message from ${channel}`,
    metadata: {
      mid,
      isInteractive,
      isReel,
      quickReplyPayload,
    },
  }).catch((err) => {
    console.warn('[processInboundMetaMessage] Failed to log activity:', err)
  })

  if (autoLinked && matchingContact) {
    await logContactActivity(db, {
      accountId,
      contactId: contact.id,
      conversationId: conversation.id,
      channel: 'system',
      eventType: 'identity_linked',
      summary: `Auto-linked identity to existing profile (${matchingContact.name || matchingContact.phone})`,
      metadata: {
        primaryContactId: matchingContact.id,
      },
    }).catch((err) => {
      console.warn('[processInboundMetaMessage] Failed to log identity link activity:', err)
    })
  }

  return {
    connection,
    contact,
    conversation,
    message: messageData as Message,
    autoLinked,
  }
}

/**
 * Handle delivery receipts and read indicators from Meta webhook for Facebook & Instagram.
 */
export async function handleMetaDeliveryOrReadEvent(
  db: SupabaseClient,
  channel: ChannelType,
  event: MetaMessagingEvent,
): Promise<void> {
  if (event.delivery) {
    const mids = event.delivery.mids || []
    if (mids.length > 0) {
      await db
        .from('messages')
        .update({ status: 'delivered' })
        .in('message_id', mids)
        .in('status', ['sending', 'sent'])
    }
  }

  if (event.read) {
    if (event.read.mid) {
      await db
        .from('messages')
        .update({ status: 'read' })
        .eq('message_id', event.read.mid)
        .in('status', ['sending', 'sent', 'delivered'])
    }
    if (event.read.watermark) {
      const senderId = event.sender?.id
      if (senderId) {
        // Resolve contact by sender social id
        const contact = await findContactBySocialId(db, '', channel, senderId)
        if (contact) {
          const watermarkIso = new Date(event.read.watermark).toISOString()
          // Update messages in conversations belonging to this contact and channel
          const { data: convs } = await db
            .from('conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('channel', channel)

          if (convs && convs.length > 0) {
            const convIds = convs.map((c) => c.id)
            await db
              .from('messages')
              .update({ status: 'read' })
              .in('conversation_id', convIds)
              .in('sender_type', ['agent', 'bot'])
              .lte('created_at', watermarkIso)
              .in('status', ['sending', 'sent', 'delivered'])
          }
        }
      }
    }
  }
}
