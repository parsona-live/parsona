import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phoneVariants } from '@/lib/whatsapp/phone-utils'
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
  const insertPayload: Record<string, unknown> = {
    account_id: accountId,
    user_id: userId,
    phone: '', // Tolerated by migration 022 partial index
    name: params.name || (params.username ? `@${params.username.replace(/^@/, '')}` : `${params.channel} User`),
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
