import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelType, Contact, ContactActivity, Conversation, Message, Tag } from '@/types'

export interface OmnichannelContactSummary {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  company: string | null
  channels: {
    whatsapp: boolean
    instagram: boolean
    facebook: boolean
  }
  socialHandles: {
    whatsapp?: string | null
    instagram?: string | null
    facebook?: string | null
  }
  lastSeenChannel: ChannelType | null
  lastActionSummary: string | null
  lastActionAt: string | null
  lastMessageText: string | null
  lastMessageAt: string | null
  tags: Tag[]
  conversationsCount: number
}

export interface OmnichannelProfileDetails {
  contact: Contact
  linkedContacts: Contact[]
  channels: {
    whatsapp: boolean
    instagram: boolean
    facebook: boolean
  }
  socialHandles: {
    whatsapp?: string | null
    instagram?: string | null
    facebook?: string | null
  }
  conversations: Conversation[]
  messages: Message[]
  activities: ContactActivity[]
  tags: Tag[]
}

/**
 * Fetch a unified omnichannel contact profile along with cross-platform
 * chat transcripts, activity timeline, and linked channel handles.
 */
export async function getOmnichannelProfile(
  db: SupabaseClient,
  contactId: string,
): Promise<OmnichannelProfileDetails | null> {
  // 1. Fetch contact
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select(`
      *,
      contact_tags (
        tags (
          id,
          name,
          color
        )
      )
    `)
    .eq('id', contactId)
    .maybeSingle()

  if (contactErr || !contact) return null

  // 2. Fetch linked contacts (if any)
  const { data: linkedRows } = await db
    .from('contacts')
    .select(`
      *,
      contact_tags (
        tags (
          id,
          name,
          color
        )
      )
    `)
    .or(`linked_contact_id.eq.${contactId},id.eq.${contact.linked_contact_id || contactId}`)

  const allContacts = [contact, ...(linkedRows || []).filter((c) => c.id !== contact.id)]
  const allContactIds = allContacts.map((c) => c.id)

  // 3. Compute channels presence & handles
  const channels = {
    whatsapp: allContacts.some((c) => c.phone && c.phone !== ''),
    instagram: allContacts.some((c) => c.ig_user_id || c.ig_username),
    facebook: allContacts.some((c) => c.fb_page_scoped_id || c.fb_name),
  }

  const socialHandles = {
    whatsapp: allContacts.find((c) => c.phone && c.phone !== '')?.phone || null,
    instagram: allContacts.find((c) => c.ig_username)?.ig_username
      ? `@${allContacts.find((c) => c.ig_username)?.ig_username?.replace(/^@/, '')}`
      : allContacts.find((c) => c.ig_user_id)?.ig_user_id || null,
    facebook: allContacts.find((c) => c.fb_name)?.fb_name || allContacts.find((c) => c.fb_page_scoped_id)?.fb_page_scoped_id || null,
  }

  // 4. Fetch all conversations across channels
  const { data: conversations } = await db
    .from('conversations')
    .select('*')
    .in('contact_id', allContactIds)
    .order('last_message_at', { ascending: false })

  const convIds = (conversations || []).map((c) => c.id)

  // 5. Fetch all messages across conversations
  let messages: Message[] = []
  if (convIds.length > 0) {
    const { data: msgRows } = await db
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true })

    messages = (msgRows || []) as Message[]
  }

  // 6. Fetch activities
  const { data: activities } = await db
    .from('contact_activities')
    .select('*')
    .in('contact_id', allContactIds)
    .order('created_at', { ascending: false })
    .limit(50)

  // 7. Aggregate tags
  const tagMap = new Map<string, Tag>()
  for (const c of allContacts) {
    for (const ct of c.contact_tags || []) {
      if (ct.tags) tagMap.set(ct.tags.id, ct.tags)
    }
  }

  return {
    contact,
    linkedContacts: allContacts.filter((c) => c.id !== contact.id),
    channels,
    socialHandles,
    conversations: (conversations || []) as Conversation[],
    messages,
    activities: (activities || []) as ContactActivity[],
    tags: Array.from(tagMap.values()),
  }
}
