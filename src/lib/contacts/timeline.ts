import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityChannel, ContactActivity, ContactEventType } from '@/types'

export interface LogContactActivityParams {
  accountId: string
  contactId: string
  channel: ActivityChannel
  eventType: ContactEventType | string
  summary: string
  metadata?: Record<string, unknown>
  conversationId?: string | null
  updateContactHotPath?: boolean
}

/**
 * Log a single omnichannel event to `contact_activities` and update
 * hot-path fields (`last_seen_channel`, `last_action_summary`, `last_action_at`) on the contact.
 */
export async function logContactActivity(
  db: SupabaseClient,
  params: LogContactActivityParams,
): Promise<ContactActivity | null> {
  const {
    accountId,
    contactId,
    channel,
    eventType,
    summary,
    metadata = {},
    conversationId = null,
    updateContactHotPath = true,
  } = params

  const nowIso = new Date().toISOString()

  // 1. Insert into event stream
  const { data, error } = await db
    .from('contact_activities')
    .insert({
      account_id: accountId,
      contact_id: contactId,
      conversation_id: conversationId,
      channel,
      event_type: eventType,
      summary,
      metadata,
      created_at: nowIso,
    })
    .select('*')
    .single()

  if (error) {
    console.error(`[logContactActivity] Failed to insert activity for contact ${contactId}:`, error)
    return null
  }

  // 2. Denormalize hot-path fields to `contacts` table
  if (updateContactHotPath) {
    const contactUpdates: Record<string, unknown> = {
      last_action_summary: summary,
      last_action_at: nowIso,
      updated_at: nowIso,
    }
    if (channel !== 'system') {
      contactUpdates.last_seen_channel = channel
    }

    const { error: updateErr } = await db
      .from('contacts')
      .update(contactUpdates)
      .eq('id', contactId)
      .eq('account_id', accountId)

    if (updateErr) {
      console.warn(`[logContactActivity] Hot-path update failed for contact ${contactId}:`, updateErr)
    }
  }

  return data as ContactActivity
}

export interface FetchActivitiesOptions {
  limit?: number
  cursorCreatedAt?: string
  cursorId?: string
}

/**
 * Fetch contact activities with cursor-based pagination for high performance.
 */
export async function fetchContactActivities(
  db: SupabaseClient,
  contactId: string,
  options: FetchActivitiesOptions = {},
): Promise<{ activities: ContactActivity[]; nextCursor?: { createdAt: string; id: string } }> {
  const limit = Math.min(options.limit || 20, 50)

  let query = db
    .from('contact_activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (options.cursorCreatedAt) {
    query = query.lt('created_at', options.cursorCreatedAt)
  }

  const { data, error } = await query
  if (error || !data) {
    console.error(`[fetchContactActivities] Error fetching activities for contact ${contactId}:`, error)
    return { activities: [] }
  }

  const hasMore = data.length > limit
  const activities = (hasMore ? data.slice(0, limit) : data) as ContactActivity[]

  let nextCursor: { createdAt: string; id: string } | undefined
  if (hasMore && activities.length > 0) {
    const last = activities[activities.length - 1]
    nextCursor = { createdAt: last.created_at, id: last.id }
  }

  return { activities, nextCursor }
}
