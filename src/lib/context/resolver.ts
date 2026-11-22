import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelType, Contact, ContactIdentity } from '@/types'

export type IdentitySource = 'contact_record' | 'contact_identities' | 'linked_contact'
export type IdentityVerificationStatus = 'verified' | 'channel_observed' | 'customer_provided' | 'unverified'

export interface ResolvedIdentity {
  channel: ChannelType | 'email' | 'phone' | 'other'
  type: 'phone' | 'handle' | 'profile_name' | 'email' | 'id'
  value: string
  normalizedValue: string
  source: IdentitySource
  verificationStatus: IdentityVerificationStatus
  contactId: string
  displayName?: string | null
  isCurrentChannel?: boolean
}

export interface IdentityConflict {
  field: 'name' | 'email' | 'phone' | 'company' | 'social_handle'
  values: string[]
  description: string
}

export interface CustomerResolutionResult {
  rootContact: Contact
  linkedContacts: Contact[]
  allContactIds: string[]
  identities: ResolvedIdentity[]
  primaryName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  primaryCompany: string | null
  socialHandles: {
    whatsapp?: string | null
    instagram?: string | null
    facebook?: string | null
  }
  conflicts: IdentityConflict[]
  isReturningCustomer: boolean
  currentChannelIdentity: ResolvedIdentity | null
}

export interface ResolveCustomerOptions {
  currentChannel?: ChannelType | string | null
  conversationId?: string | null
}

/**
 * Normalize an email address for deduplication.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const clean = email.trim().toLowerCase()
  return clean.includes('@') ? clean : null
}

/**
 * Normalize a phone number for deduplication.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')
  if (cleaned.length < 7) return null
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

/**
 * Normalize an Instagram handle (removes leading @ and lowercases).
 */
export function normalizeInstagramHandle(handle: string | null | undefined): string | null {
  if (!handle) return null
  const clean = handle.replace(/^@+/, '').trim().toLowerCase()
  return clean.length > 0 ? clean : null
}

/**
 * Safe, multi-hop traversal to resolve all linked contacts without cycles.
 */
export async function resolveLinkedContacts(
  db: SupabaseClient,
  accountId: string,
  initialContactId: string,
  maxDepth = 5,
): Promise<{ primaryContact: Contact; allContacts: Contact[] }> {
  const visited = new Set<string>()
  const queue: string[] = [initialContactId]
  const contactsMap = new Map<string, Contact>()
  let depth = 0

  while (queue.length > 0 && depth < maxDepth) {
    depth++
    const currentBatch = queue.splice(0, queue.length)
    const toFetch = currentBatch.filter((id) => !visited.has(id))
    if (toFetch.length === 0) break

    for (const id of toFetch) visited.add(id)

    const { data, error } = await db
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .in('id', toFetch)

    if (error || !data || data.length === 0) continue

    for (const contact of data as Contact[]) {
      contactsMap.set(contact.id, contact)

      // Traverse linked_contact_id if present and not visited
      if (contact.linked_contact_id && !visited.has(contact.linked_contact_id)) {
        queue.push(contact.linked_contact_id)
      }
    }

    // Also look up any contacts that point to any of our visited contacts as linked_contact_id
    const { data: backLinked } = await db
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .in('linked_contact_id', toFetch)

    if (backLinked && backLinked.length > 0) {
      for (const bl of backLinked as Contact[]) {
        if (!contactsMap.has(bl.id)) {
          contactsMap.set(bl.id, bl)
          if (!visited.has(bl.id)) {
            queue.push(bl.id)
          }
        }
      }
    }
  }

  const allContacts = Array.from(contactsMap.values())
  const initial = contactsMap.get(initialContactId)

  // Determine root primary contact:
  // Prefer the one that does not have linked_contact_id, or the initial contact
  const primaryContact =
    allContacts.find((c) => !c.linked_contact_id) ||
    initial ||
    allContacts[0]

  return { primaryContact, allContacts }
}

/**
 * Full Customer & Identity Resolution:
 * Merges identities across linked contacts, contact_identities, and channel metadata,
 * detects conflicts, normalizes handles, and tags provenance.
 */
export async function resolveCustomerIdentities(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  options: ResolveCustomerOptions = {},
): Promise<CustomerResolutionResult | null> {
  const { currentChannel, conversationId } = options

  // 1. Resolve primary & all linked contacts
  const { primaryContact, allContacts } = await resolveLinkedContacts(db, accountId, contactId)
  if (!primaryContact) return null

  const allContactIds = allContacts.map((c) => c.id)

  // 2. Fetch contact_identities for all linked contacts
  const { data: rawIdentities } = await db
    .from('contact_identities')
    .select('*')
    .eq('account_id', accountId)
    .in('contact_id', allContactIds)
    .neq('identity_status', 'unlinked')

  const identitiesList: ContactIdentity[] = (rawIdentities as ContactIdentity[]) || []

  // 3. Assemble and normalize all identities
  const resolvedIdentities: ResolvedIdentity[] = []
  const seenPhone = new Set<string>()
  const seenEmail = new Set<string>()
  const seenIg = new Set<string>()
  const seenFb = new Set<string>()

  // A. From contact_identities table (higher authority)
  for (const row of identitiesList) {
    if (row.channel === 'whatsapp' || row.phone) {
      const norm = normalizePhone(row.phone || row.external_id)
      if (norm && !seenPhone.has(norm)) {
        seenPhone.add(norm)
        resolvedIdentities.push({
          channel: 'whatsapp',
          type: 'phone',
          value: row.phone || row.external_id,
          normalizedValue: norm,
          source: 'contact_identities',
          verificationStatus: row.identity_status === 'verified' ? 'verified' : 'channel_observed',
          contactId: row.contact_id,
          displayName: row.display_name,
        })
      }
    }

    if (row.channel === 'instagram' || row.external_username) {
      const norm = normalizeInstagramHandle(row.external_username || row.external_id)
      if (norm && !seenIg.has(norm)) {
        seenIg.add(norm)
        resolvedIdentities.push({
          channel: 'instagram',
          type: 'handle',
          value: `@${norm}`,
          normalizedValue: norm,
          source: 'contact_identities',
          verificationStatus: row.identity_status === 'verified' ? 'verified' : 'channel_observed',
          contactId: row.contact_id,
          displayName: row.display_name,
        })
      }
    }

    if (row.channel === 'facebook') {
      const norm = row.external_id
      if (norm && !seenFb.has(norm)) {
        seenFb.add(norm)
        resolvedIdentities.push({
          channel: 'facebook',
          type: row.display_name ? 'profile_name' : 'id',
          value: row.display_name || row.external_id,
          normalizedValue: norm,
          source: 'contact_identities',
          verificationStatus: row.identity_status === 'verified' ? 'verified' : 'channel_observed',
          contactId: row.contact_id,
          displayName: row.display_name,
        })
      }
    }

    if (row.email) {
      const norm = normalizeEmail(row.email)
      if (norm && !seenEmail.has(norm)) {
        seenEmail.add(norm)
        resolvedIdentities.push({
          channel: 'email',
          type: 'email',
          value: row.email,
          normalizedValue: norm,
          source: 'contact_identities',
          verificationStatus: row.identity_status === 'verified' ? 'verified' : 'customer_provided',
          contactId: row.contact_id,
        })
      }
    }
  }

  // B. From contact rows
  for (const c of allContacts) {
    if (c.phone) {
      const norm = normalizePhone(c.phone)
      if (norm && !seenPhone.has(norm)) {
        seenPhone.add(norm)
        resolvedIdentities.push({
          channel: 'whatsapp',
          type: 'phone',
          value: c.phone,
          normalizedValue: norm,
          source: c.id === primaryContact.id ? 'contact_record' : 'linked_contact',
          verificationStatus: 'channel_observed',
          contactId: c.id,
          displayName: c.name,
        })
      }
    }

    if (c.ig_username) {
      const norm = normalizeInstagramHandle(c.ig_username)
      if (norm && !seenIg.has(norm)) {
        seenIg.add(norm)
        resolvedIdentities.push({
          channel: 'instagram',
          type: 'handle',
          value: `@${norm}`,
          normalizedValue: norm,
          source: c.id === primaryContact.id ? 'contact_record' : 'linked_contact',
          verificationStatus: 'channel_observed',
          contactId: c.id,
          displayName: c.name,
        })
      }
    }

    if (c.fb_name || c.fb_page_scoped_id) {
      const val = c.fb_name || c.fb_page_scoped_id || ''
      if (val && !seenFb.has(val)) {
        seenFb.add(val)
        resolvedIdentities.push({
          channel: 'facebook',
          type: c.fb_name ? 'profile_name' : 'id',
          value: val,
          normalizedValue: val,
          source: c.id === primaryContact.id ? 'contact_record' : 'linked_contact',
          verificationStatus: 'channel_observed',
          contactId: c.id,
          displayName: c.fb_name,
        })
      }
    }

    if (c.email) {
      const norm = normalizeEmail(c.email)
      if (norm && !seenEmail.has(norm)) {
        seenEmail.add(norm)
        resolvedIdentities.push({
          channel: 'email',
          type: 'email',
          value: c.email,
          normalizedValue: norm,
          source: c.id === primaryContact.id ? 'contact_record' : 'linked_contact',
          verificationStatus: 'customer_provided',
          contactId: c.id,
        })
      }
    }
  }

  // 4. Conflict detection
  const conflicts: IdentityConflict[] = []
  if (seenEmail.size > 1) {
    conflicts.push({
      field: 'email',
      values: Array.from(seenEmail),
      description: `Multiple conflicting emails found across linked records: ${Array.from(seenEmail).join(', ')}`,
    })
  }

  const distinctNames = Array.from(
    new Set(
      allContacts
        .map((c) => c.name?.trim())
        .filter((n): n is string => Boolean(n && n !== 'WhatsApp User' && n !== 'Instagram User' && n !== 'Facebook User')),
    ),
  )
  if (distinctNames.length > 1) {
    conflicts.push({
      field: 'name',
      values: distinctNames,
      description: `Multiple distinct names observed across linked records: ${distinctNames.join(', ')}`,
    })
  }

  // 5. Build canonical social handles & primary contact fields
  const socialHandles = {
    whatsapp:
      resolvedIdentities.find((i) => i.channel === 'whatsapp')?.value ||
      primaryContact.phone ||
      null,
    instagram:
      resolvedIdentities.find((i) => i.channel === 'instagram')?.value ||
      (primaryContact.ig_username ? `@${primaryContact.ig_username.replace(/^@/, '')}` : null),
    facebook:
      resolvedIdentities.find((i) => i.channel === 'facebook')?.value ||
      primaryContact.fb_name ||
      null,
  }

  const primaryName =
    distinctNames[0] ||
    primaryContact.name ||
    null

  const primaryEmail =
    resolvedIdentities.find((i) => i.channel === 'email')?.value ||
    primaryContact.email ||
    null

  const primaryPhone = socialHandles.whatsapp
  const primaryCompany = primaryContact.company || allContacts.find((c) => c.company)?.company || null

  // 6. Current channel identity & returning customer determination
  let currentChannelIdentity: ResolvedIdentity | null = null
  if (currentChannel) {
    const normChannel = currentChannel.toLowerCase()
    currentChannelIdentity =
      resolvedIdentities.find((i) => i.channel === normChannel) || null

    if (currentChannelIdentity) {
      currentChannelIdentity.isCurrentChannel = true
    }
  }

  // Check returning customer status:
  // If contact was created > 10 minutes ago, or has multiple messages, or has past business actions/memories
  const isReturningCustomer = Boolean(
    primaryContact.last_action_summary ||
      primaryContact.last_business_action ||
      (primaryContact.created_at && Date.now() - new Date(primaryContact.created_at).getTime() > 10 * 60 * 1000) ||
      allContacts.length > 1 ||
      resolvedIdentities.length > 1,
  )

  return {
    rootContact: primaryContact,
    linkedContacts: allContacts.filter((c) => c.id !== primaryContact.id),
    allContactIds,
    identities: resolvedIdentities,
    primaryName,
    primaryEmail,
    primaryPhone,
    primaryCompany,
    socialHandles,
    conflicts,
    isReturningCustomer,
    currentChannelIdentity,
  }
}
