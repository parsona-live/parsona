import { supabaseAdmin } from '@/lib/flows/admin-client'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import type { MetaChannelConnection, ChannelType } from '@/types'

const META_GRAPH_VERSION = 'v21.0'
const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`

export interface MetaPageProfile {
  id: string
  name: string
  access_token: string
  instagram_business_account?: {
    id: string
    username?: string
  }
}

/**
 * List all connected Meta channels (Facebook Pages & Instagram) for an account.
 * Decrypts tokens only when requested.
 */
export async function listAccountMetaChannels(
  accountId: string,
): Promise<Omit<MetaChannelConnection, 'encrypted_access_token'>[]> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('meta_channel_connections')
    .select('id, account_id, user_id, channel, page_id, page_name, instagram_business_id, instagram_username, status, subscribed_fields, created_at, updated_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as Omit<MetaChannelConnection, 'encrypted_access_token'>[]
}

/**
 * Retrieve decrypted access token for a specific connection.
 */
export async function getDecryptedChannelToken(
  connectionId: string,
  accountId: string,
): Promise<string | null> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('meta_channel_connections')
    .select('encrypted_access_token')
    .eq('id', connectionId)
    .eq('account_id', accountId)
    .single()

  if (error || !data) return null
  return decrypt(data.encrypted_access_token)
}

/**
 * Fetch Instagram Business Account details linked to a Facebook Page.
 */
export async function fetchLinkedInstagramAccount(
  pageId: string,
  pageAccessToken: string,
): Promise<{ id: string; username?: string } | null> {
  const url = `${GRAPH_BASE_URL}/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(pageAccessToken)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.instagram_business_account || null
}

/**
 * Subscribe the Facebook Page and linked Instagram account to our App's Webhooks.
 */
export async function subscribePageToApp(
  pageId: string,
  pageAccessToken: string,
  fields: string[] = ['messages', 'messaging_postbacks', 'feed'],
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${GRAPH_BASE_URL}/${pageId}/subscribed_apps`
    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: pageAccessToken,
        subscribed_fields: fields,
      }),
    })
    let data = await res.json()

    // If 'feed' fails due to missing permissions, fall back to core messaging fields
    if ((!res.ok || data.success === false) && fields.includes('feed')) {
      const fallbackFields = fields.filter((f) => f !== 'feed')
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: pageAccessToken,
          subscribed_fields: fallbackFields,
        }),
      })
      data = await res.json()
    }

    if (!res.ok || data.success === false) {
      return { success: false, error: data.error?.message || 'Failed to subscribe Page to webhook app' }
    }
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export interface UpsertChannelArgs {
  accountId: string
  userId: string
  channel: ChannelType
  pageId: string
  pageName: string
  accessToken: string
  instagramBusinessId?: string | null
  instagramUsername?: string | null
  subscribedFields?: string[]
}

/**
 * Upsert a Meta channel connection into the database with AES-256 encrypted token.
 */
export async function upsertMetaChannelConnection(
  args: UpsertChannelArgs,
): Promise<MetaChannelConnection> {
  const db = supabaseAdmin()
  const encryptedToken = encrypt(args.accessToken)

  const payload = {
    account_id: args.accountId,
    user_id: args.userId,
    channel: args.channel,
    page_id: args.pageId,
    page_name: args.pageName,
    instagram_business_id: args.instagramBusinessId ?? null,
    instagram_username: args.instagramUsername ?? null,
    encrypted_access_token: encryptedToken,
    status: 'connected',
    subscribed_fields: args.subscribedFields || ['messages', 'messaging_postbacks', 'feed'],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('meta_channel_connections')
    .upsert(payload, { onConflict: 'account_id,channel,page_id' })
    .select()
    .single()

  if (error) throw error
  return data as MetaChannelConnection
}

/**
 * Remove a connected channel.
 */
export async function deleteMetaChannelConnection(
  accountId: string,
  connectionId: string,
): Promise<boolean> {
  const db = supabaseAdmin()
  const { error } = await db
    .from('meta_channel_connections')
    .delete()
    .eq('id', connectionId)
    .eq('account_id', accountId)

  if (error) throw error
  return true
}
