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

export interface SenderProfileResult {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  profilePic?: string | null
}

/**
 * Fetch sender profile information (name, avatar, username) from Meta Graph API.
 */
export async function fetchSenderProfile(
  channel: ChannelType,
  senderId: string,
  pageAccessToken: string,
  pageId?: string,
): Promise<SenderProfileResult | null> {
  console.log(`[fetchSenderProfile] Starting profile resolution for channel=${channel}, senderId=${senderId}, pageId=${pageId || 'none'}`)
  try {
    // 1. Direct user profile node lookup (Messenger Platform User Profile API)
    const fields = channel === 'instagram'
      ? 'name,username,profile_pic'
      : 'first_name,last_name,profile_pic'

    const directUrl = `${GRAPH_BASE_URL}/${senderId}?fields=${fields}&access_token=${encodeURIComponent(pageAccessToken)}`
    console.log(`[fetchSenderProfile] Direct profile lookup URL: ${GRAPH_BASE_URL}/${senderId}?fields=${fields}`)
    const directRes = await fetch(directUrl)
    console.log(`[fetchSenderProfile] Direct profile lookup HTTP status: ${directRes.status} ${directRes.statusText}`)

    if (directRes.ok) {
      const data = await directRes.json()
      console.log(`[fetchSenderProfile] Direct profile lookup response:`, JSON.stringify(data, null, 2))

      const hasFields = data && Object.keys(data).length > 0
      if (!hasFields) {
        console.warn(
          `[fetchSenderProfile] Meta returned an empty object {} for sender ${senderId}. ` +
          `According to Meta docs, an empty object is returned when:\n` +
          `  1. The app lacks Advanced Access for 'Business Asset User Profile Access' (BAUPA) via App Review,\n` +
          `  2. Fields have not been requested under Page Settings > Advanced Messaging > 'Info About People', or\n` +
          `  3. The user has not opted in (e.g., clicked an ad without replying).`
        )
      }

      const resolvedName =
        (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null) ||
        data.name ||
        null

      if (resolvedName) {
        console.log(`[fetchSenderProfile] Successfully resolved name from direct lookup: "${resolvedName}"`)
        return {
          name: resolvedName,
          firstName: data.first_name || null,
          lastName: data.last_name || null,
          username: data.username || null,
          profilePic: data.profile_pic || null,
        }
      }
    } else {
      const errText = await directRes.text()
      console.error(`[fetchSenderProfile] Direct lookup failed (${directRes.status} ${directRes.statusText}):`, errText)
      try {
        const errJson = JSON.parse(errText)
        if (errJson?.error?.code === 2018218) {
          console.warn(
            `[fetchSenderProfile] Meta Error 2018218: 'No profile available for this user'. ` +
            `This Messenger account was created using a phone number, which Meta User Profile API does not support.`
          )
        }
      } catch {
        // Response was not JSON
      }
    }

    // 2. Targeted conversation lookup by sender user_id if pageId is present
    if (pageId) {
      const targetConvUrl = `${GRAPH_BASE_URL}/${pageId}/conversations?user_id=${senderId}&fields=participants{id,name}&access_token=${encodeURIComponent(pageAccessToken)}`
      console.log(`[fetchSenderProfile] Querying target conversation: ${GRAPH_BASE_URL}/${pageId}/conversations?user_id=${senderId}`)
      const targetRes = await fetch(targetConvUrl)
      console.log(`[fetchSenderProfile] Target conversation HTTP status: ${targetRes.status}`)
      if (targetRes.ok) {
        const targetData = await targetRes.json()
        console.log(`[fetchSenderProfile] Target conversation response:`, JSON.stringify(targetData))
        for (const thread of targetData.data || []) {
          const participants: Array<{ id: string; name: string }> = thread.participants?.data || []
          const match = participants.find((p) => p.id === senderId)
            || participants.find((p) => p.id !== pageId)

          if (match && match.name) {
            console.log(`[fetchSenderProfile] Successfully resolved name from target conversation: "${match.name}"`)
            const parts = match.name.trim().split(/\s+/)
            return {
              name: match.name,
              firstName: parts[0] || null,
              lastName: parts.slice(1).join(' ') || null,
              username: null,
              profilePic: null,
            }
          }
        }
      } else {
        const targetErr = await targetRes.text()
        console.log(`[fetchSenderProfile] Target conversation query failed:`, targetErr)
      }
    }

    // 3. Fallback: Page Conversations API (scans recent threads for participant info)
    const convUrl = `${GRAPH_BASE_URL}/me/conversations?fields=participants{id,name}&access_token=${encodeURIComponent(pageAccessToken)}`
    console.log(`[fetchSenderProfile] Querying /me/conversations...`)
    const convRes = await fetch(convUrl)
    console.log(`[fetchSenderProfile] /me/conversations HTTP status: ${convRes.status}`)
    if (convRes.ok) {
      const convData = await convRes.json()
      console.log(`[fetchSenderProfile] /me/conversations returned ${convData.data?.length || 0} threads:`, JSON.stringify(convData))
      for (const thread of convData.data || []) {
        const participants: Array<{ id: string; name: string }> = thread.participants?.data || []
        // Match specific senderId first, or fallback to the non-page participant
        const match = participants.find((p) => p.id === senderId)
          || (pageId ? participants.find((p) => p.id !== pageId) : null)

        if (match && match.name) {
          console.log(`[fetchSenderProfile] Successfully resolved name from /me/conversations: "${match.name}"`)
          const parts = match.name.trim().split(/\s+/)
          return {
            name: match.name,
            firstName: parts[0] || null,
            lastName: parts.slice(1).join(' ') || null,
            username: null,
            profilePic: null,
          }
        }
      }
    } else {
      const convErr = await convRes.text()
      console.log(`[fetchSenderProfile] /me/conversations query failed:`, convErr)
    }

    console.warn(`[fetchSenderProfile] Could not resolve profile for ${channel} ${senderId}`)
    return null
  } catch (err) {
    console.error(`[fetchSenderProfile] Exception while fetching profile for ${channel} ${senderId}:`, err)
    return null
  }
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
