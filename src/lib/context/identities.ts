import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelType, ContactIdentity } from '@/types'

export interface MapChannelIdentityParams {
  accountId: string
  contactId: string
  channel: ChannelType | 'web' | 'other'
  externalId: string
  externalUsername?: string | null
  displayName?: string | null
  phone?: string | null
  email?: string | null
  verificationMethod?: 'platform_id' | 'verified_phone' | 'verified_email' | 'manual_link'
}

/**
 * Record or map a verified channel identity to a canonical contact.
 * Non-destructive and idempotent.
 */
export async function mapChannelIdentity(
  db: SupabaseClient,
  params: MapChannelIdentityParams,
): Promise<ContactIdentity> {
  const {
    accountId,
    contactId,
    channel,
    externalId,
    externalUsername = null,
    displayName = null,
    phone = null,
    email = null,
    verificationMethod = 'platform_id',
  } = params

  const { data, error } = await db
    .from('contact_identities')
    .upsert(
      {
        account_id: accountId,
        contact_id: contactId,
        channel,
        external_id: externalId,
        external_username: externalUsername,
        display_name: displayName,
        phone,
        email,
        identity_status: 'verified',
        verification_method: verificationMethod,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,channel,external_id' },
    )
    .select()
    .single()

  if (error || !data) {
    console.error('[mapChannelIdentity] Error mapping channel identity:', error)
    throw error
  }

  return data as ContactIdentity
}

/**
 * Retrieve all mapped channel identities for a contact.
 */
export async function getContactIdentities(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
): Promise<ContactIdentity[]> {
  const { data, error } = await db
    .from('contact_identities')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .neq('identity_status', 'unlinked')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getContactIdentities] Error fetching identities:', error)
    return []
  }

  return (data || []) as ContactIdentity[]
}

/**
 * Unlink a channel identity from a contact.
 */
export async function unlinkChannelIdentity(
  db: SupabaseClient,
  accountId: string,
  identityId: string,
): Promise<boolean> {
  const { error } = await db
    .from('contact_identities')
    .update({
      identity_status: 'unlinked',
      updated_at: new Date().toISOString(),
    })
    .eq('id', identityId)
    .eq('account_id', accountId)

  return !error
}
