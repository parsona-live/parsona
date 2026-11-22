import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phoneVariants } from '@/lib/whatsapp/phone-utils'
import { logContactActivity } from '@/lib/contacts/timeline'
import type { ChannelType, Contact } from '@/types'

export interface ExtractedIdentifiers {
  phones: string[]
  emails: string[]
}

/**
 * Extract phone numbers and email addresses from conversational text.
 */
export function extractPhoneAndEmail(text: string): ExtractedIdentifiers {
  if (!text) return { phones: [], emails: [] }

  // Email regex: standard RFC 5322 compliant pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
  const emails = Array.from(new Set(text.match(emailRegex) || [])).map((e) =>
    e.toLowerCase().trim(),
  )

  // Phone regex: International E.164, country codes (+XX), or standard 10-13 digit formats
  // Matches: +1 (555) 234-5678, +919876543210, 9876543210, +44 20 7946 0991
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g
  const rawPhones = text.match(phoneRegex) || []

  const validPhones: string[] = []
  for (const raw of rawPhones) {
    const digitsOnly = normalizePhone(raw)
    // Filter out short numbers (like zip codes, dates, order IDs < 8 digits or > 15 digits)
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      validPhones.push(digitsOnly)
    }
  }

  return {
    phones: Array.from(new Set(validPhones)),
    emails,
  }
}

/**
 * Extract person name from conversational text (e.g. "My name is Sultan Alam", "I am Sultan Alam", "Name: Sultan Alam").
 */
export function extractNameFromText(text: string): string | null {
  if (!text) return null
  const cleaned = text.trim()

  const patterns = [
    /(?:my\s+name\s+is|i\s+am|i'm|this\s+is|call\s+me)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'\-]{1,40}?)(?=[,\.\n\r]|\s+(?:and|my|email|phone|whatsapp|contact|pls|please)|$)/i,
    /(?:^|\n)\s*name\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'\-]{1,40}?)(?=[,\.\n\r]|\s+(?:and|email|phone|whatsapp|contact)|$)/i,
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      const candidate = match[1].trim()
      const lower = candidate.toLowerCase()
      const blacklist = [
        'interested',
        'looking',
        'here',
        'calling',
        'inquiring',
        'texting',
        'writing',
        'asking',
        'good',
        'fine',
        'ok',
        'okay',
        'yes',
        'no',
        'hello',
        'hi',
      ]
      if (candidate.length >= 2 && !blacklist.includes(lower)) {
        return candidate
          .split(/\s+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ')
      }
    }
  }

  return null
}

/**
 * Find contact by social ID (Instagram IGSID or Facebook PSID) within an account.
 */
export async function findContactBySocialId(
  db: SupabaseClient,
  accountId: string,
  channel: ChannelType,
  socialId: string,
): Promise<Contact | null> {
  const column = channel === 'instagram' ? 'ig_user_id' : 'fb_page_scoped_id'
  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq(column, socialId)
    .maybeSingle()

  if (error || !data) return null
  return data as Contact
}

/**
 * Find contact by phone variants within an account.
 */
export async function findContactByPhone(
  db: SupabaseClient,
  accountId: string,
  phone: string,
): Promise<Contact | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .in('phone_normalized', phoneVariants(normalized))
    .maybeSingle()

  if (error || !data) return null
  return data as Contact
}

/**
 * Find contact by email within an account.
 */
export async function findContactByEmail(
  db: SupabaseClient,
  accountId: string,
  email: string,
): Promise<Contact | null> {
  if (!email) return null
  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .ilike('email', email.trim().toLowerCase())
    .maybeSingle()

  if (error || !data) return null
  return data as Contact
}

export interface LinkSocialParams {
  channel: ChannelType
  socialId: string
  username?: string | null
  name?: string | null
  avatarUrl?: string | null
  linkedContactId?: string | null
}

/**
 * Link Instagram or Facebook social identity to an existing contact.
 */
export async function linkSocialIdToContact(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  params: LinkSocialParams,
): Promise<Contact | null> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (params.channel === 'instagram') {
    updatePayload.ig_user_id = params.socialId
    if (params.username) updatePayload.ig_username = params.username.replace(/^@/, '')
  } else if (params.channel === 'facebook') {
    updatePayload.fb_page_scoped_id = params.socialId
    if (params.name) updatePayload.fb_name = params.name
  }
  if (params.avatarUrl) {
    updatePayload.avatar_url = params.avatarUrl
  }

  const { data, error } = await db
    .from('contacts')
    .update(updatePayload)
    .eq('id', contactId)
    .eq('account_id', accountId)
    .select()
    .single()

  if (error) return null
  return data as Contact
}

/**
 * Create a new social-first contact (phone is empty string initially).
 */
export async function createSocialContact(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  params: LinkSocialParams,
): Promise<Contact> {
  const defaultName = params.name || (params.username ? `@${params.username.replace(/^@/, '')}` : (params.channel === 'instagram' ? 'Instagram User' : 'Facebook User'))

  const insertPayload: Record<string, unknown> = {
    account_id: accountId,
    user_id: userId,
    phone: '', // Tolerated by migration 022 partial index
    name: defaultName,
    avatar_url: params.avatarUrl || null,
    linked_contact_id: params.linkedContactId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (params.channel === 'instagram') {
    insertPayload.ig_user_id = params.socialId
    insertPayload.ig_username = params.username ? params.username.replace(/^@/, '') : null
  } else {
    insertPayload.fb_page_scoped_id = params.socialId
    insertPayload.fb_name = params.name || null
  }

  const { data, error } = await db
    .from('contacts')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error
  return data as Contact
}

/**
 * Link two contacts non-destructively so they share identity and AI context,
 * while preserving both individual contacts and conversation threads in the Inbox.
 */
export async function linkContacts(
  db: SupabaseClient,
  accountId: string,
  primaryId: string,
  secondaryId: string,
): Promise<{ primary: Contact; secondary: Contact }> {
  if (primaryId === secondaryId) {
    throw new Error('Cannot link a contact to itself')
  }

  // 1. Fetch both contacts
  const { data: primary, error: pErr } = await db
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .eq('account_id', accountId)
    .single()

  const { data: secondary, error: sErr } = await db
    .from('contacts')
    .select('*')
    .eq('id', secondaryId)
    .eq('account_id', accountId)
    .single()

  if (pErr || !primary || sErr || !secondary) {
    throw new Error('One or both contacts not found')
  }

  // If primary itself already points to a parent linked_contact_id, resolve root primary
  const rootPrimaryId = primary.linked_contact_id || primary.id

  // 2. Set secondary's linked_contact_id to rootPrimaryId
  const { data: updatedSecondary, error: updErr } = await db
    .from('contacts')
    .update({
      linked_contact_id: rootPrimaryId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', secondaryId)
    .eq('account_id', accountId)
    .select()
    .single()

  if (updErr) throw updErr

  // 3. Bidirectionally merge missing fields onto rootPrimary
  let rootContact = primary
  if (primary.id !== rootPrimaryId) {
    const { data: fetchedRoot } = await db
      .from('contacts')
      .select('*')
      .eq('id', rootPrimaryId)
      .eq('account_id', accountId)
      .single()
    if (fetchedRoot) rootContact = fetchedRoot
  }

  const rootUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (!rootContact.phone && secondary.phone) {
    rootUpdates.phone = secondary.phone
  }
  if (!rootContact.ig_user_id && secondary.ig_user_id) {
    rootUpdates.ig_user_id = secondary.ig_user_id
    rootUpdates.ig_username = secondary.ig_username
  }
  if (!rootContact.fb_page_scoped_id && secondary.fb_page_scoped_id) {
    rootUpdates.fb_page_scoped_id = secondary.fb_page_scoped_id
    rootUpdates.fb_name = secondary.fb_name
  }
  if (!rootContact.email && secondary.email) {
    rootUpdates.email = secondary.email
  }
  if (!rootContact.avatar_url && secondary.avatar_url) {
    rootUpdates.avatar_url = secondary.avatar_url
  }
  const isDefaultName = !rootContact.name || rootContact.name === 'Instagram User' || rootContact.name === 'Facebook User'
  if (isDefaultName && secondary.name && secondary.name !== 'Instagram User' && secondary.name !== 'Facebook User') {
    rootUpdates.name = secondary.name
  }

  // Merge dynamic metadata
  const primaryMeta = (rootContact.metadata as Record<string, unknown>) || {}
  const secondaryMeta = (secondary.metadata as Record<string, unknown>) || {}
  if (Object.keys(secondaryMeta).length > 0) {
    rootUpdates.metadata = { ...secondaryMeta, ...primaryMeta }
  }

  let finalPrimary = rootContact
  if (Object.keys(rootUpdates).length > 1) {
    const { data: updatedPrimary } = await db
      .from('contacts')
      .update(rootUpdates)
      .eq('id', rootPrimaryId)
      .eq('account_id', accountId)
      .select()
      .single()
    if (updatedPrimary) finalPrimary = updatedPrimary
  }

  // 4. Log timeline activity
  await logContactActivity(db, {
    accountId,
    contactId: rootPrimaryId,
    channel: 'system',
    eventType: 'identity_linked',
    summary: `Merged identity with ${secondary.name || secondary.phone || 'linked channel'}`,
    metadata: {
      secondaryContactId: secondaryId,
    },
  }).catch(() => null)

  return {
    primary: finalPrimary as Contact,
    secondary: updatedSecondary as Contact,
  }
}

/**
 * Unlink a contact from its linked identity.
 */
export async function unlinkContact(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
): Promise<boolean> {
  const { error } = await db
    .from('contacts')
    .update({
      linked_contact_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('account_id', accountId)

  if (error) throw error
  return true
}

/**
 * Get all linked contacts for a given contact ID.
 */
export async function getLinkedContacts(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
): Promise<Contact[]> {
  const { data: target } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single()

  if (!target) return []

  const rootId = target.linked_contact_id || target.id

  const { data: linked } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .or(`id.eq.${rootId},linked_contact_id.eq.${rootId}`)
    .order('created_at', { ascending: true })

  return (linked || []).filter((c) => c.id !== contactId) as Contact[]
}

/**
 * Merge secondary contact into primary contact.
 * Moves all conversations and preserves all non-empty fields.
 */
export async function mergeContacts(
  db: SupabaseClient,
  accountId: string,
  primaryId: string,
  secondaryId: string,
): Promise<boolean> {
  if (primaryId === secondaryId) return true

  // 1. Fetch both contacts
  const { data: primary } = await db
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .eq('account_id', accountId)
    .single()

  const { data: secondary } = await db
    .from('contacts')
    .select('*')
    .eq('id', secondaryId)
    .eq('account_id', accountId)
    .single()

  if (!primary || !secondary) {
    throw new Error('One or both contacts not found')
  }

  // 2. Prepare backfill payload for primary
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (!primary.email && secondary.email) updates.email = secondary.email
  if (!primary.company && secondary.company) updates.company = secondary.company
  if (!primary.ig_user_id && secondary.ig_user_id) updates.ig_user_id = secondary.ig_user_id
  if (!primary.ig_username && secondary.ig_username) updates.ig_username = secondary.ig_username
  if (!primary.fb_page_scoped_id && secondary.fb_page_scoped_id) updates.fb_page_scoped_id = secondary.fb_page_scoped_id
  if (!primary.fb_name && secondary.fb_name) updates.fb_name = secondary.fb_name
  if ((!primary.phone || primary.phone === '') && secondary.phone) updates.phone = secondary.phone

  // Update primary
  await db
    .from('contacts')
    .update(updates)
    .eq('id', primaryId)
    .eq('account_id', accountId)

  // 3. Move conversations from secondary to primary
  await db
    .from('conversations')
    .update({ contact_id: primaryId })
    .eq('contact_id', secondaryId)
    .eq('account_id', accountId)

  // 4. Move contact notes
  await db
    .from('contact_notes')
    .update({ contact_id: primaryId })
    .eq('contact_id', secondaryId)

  // 5. Delete secondary contact
  await db
    .from('contacts')
    .delete()
    .eq('id', secondaryId)
    .eq('account_id', accountId)

  return true
}
