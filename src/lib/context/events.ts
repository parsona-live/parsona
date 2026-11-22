import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactEvent } from '@/types'
import { logContactActivity } from '@/lib/contacts/timeline'

export interface RecordContactEventParams {
  accountId: string
  contactId: string
  eventType: string
  source: string
  sourceReference?: string | null
  payload?: Record<string, unknown>
  occurredAt?: string
  idempotencyKey?: string | null
  conversationId?: string | null
  /** Human-readable description for timeline logging */
  summary?: string
}

/**
 * Record a deterministic, typed business event (e.g. appointment.booked, quote.sent, payment.completed).
 * Idempotent: duplicate events with the same idempotencyKey are safely ignored.
 */
export async function recordContactEvent(
  db: SupabaseClient,
  params: RecordContactEventParams,
): Promise<{ success: boolean; event?: ContactEvent; duplicate?: boolean }> {
  const {
    accountId,
    contactId,
    eventType,
    source,
    sourceReference = null,
    payload = {},
    occurredAt = new Date().toISOString(),
    idempotencyKey = null,
    conversationId = null,
    summary,
  } = params

  if (!accountId || !contactId || !eventType || !source) {
    throw new Error('[recordContactEvent] Missing required fields: accountId, contactId, eventType, source')
  }

  // 1. Insert into contact_events with idempotency guard
  const insertPayload: Record<string, unknown> = {
    account_id: accountId,
    contact_id: contactId,
    event_type: eventType,
    source,
    source_reference: sourceReference,
    payload,
    occurred_at: occurredAt,
  }
  if (idempotencyKey) {
    insertPayload.idempotency_key = idempotencyKey
  }

  const { data, error } = await db
    .from('contact_events')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    // Unique violation on idempotency_key (code 23505) -> return duplicate
    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
      return { success: true, duplicate: true }
    }
    console.error('[recordContactEvent] Error inserting contact event:', error)
    throw error
  }

  const event = data as ContactEvent

  // 2. Format a human-readable title for business action caching
  const readableAction = formatEventToReadableAction(eventType, payload)

  // 3. Update low-latency cache on contacts table
  await db
    .from('contacts')
    .update({
      last_business_action: readableAction,
      last_business_action_at: occurredAt,
      last_action_summary: summary || readableAction,
      last_action_at: occurredAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('account_id', accountId)

  // 4. Mirror into contact_activities for unified chronological timeline
  await logContactActivity(db, {
    accountId,
    contactId,
    conversationId,
    channel: mapSourceToActivityChannel(source),
    eventType,
    summary: summary || readableAction,
    metadata: {
      source,
      sourceReference,
      ...payload,
    },
  }).catch((err) => {
    console.warn('[recordContactEvent] Failed to log timeline activity:', err)
  })

  return { success: true, event }
}

/**
 * Query recent business events for a contact.
 */
export async function queryContactEvents(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  options: { limit?: number; eventType?: string } = {},
): Promise<ContactEvent[]> {
  const limit = options.limit ?? 20

  let query = db
    .from('contact_events')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (options.eventType) {
    query = query.eq('event_type', options.eventType)
  }

  const { data, error } = await query
  if (error) {
    console.error('[queryContactEvents] Error fetching contact events:', error)
    return []
  }

  return (data || []) as ContactEvent[]
}

function formatEventToReadableAction(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'appointment.booked':
      return payload.start_at
        ? `Appointment Booked (${new Date(payload.start_at as string).toLocaleDateString([], { month: 'short', day: 'numeric' })})`
        : 'Appointment Booked'
    case 'appointment.rescheduled':
      return 'Appointment Rescheduled'
    case 'appointment.cancelled':
      return 'Appointment Canceled'
    case 'quote.requested':
      return 'Quote Requested'
    case 'quote.sent':
      return payload.amount ? `Quote Sent (${payload.amount})` : 'Quote Sent'
    case 'quote.accepted':
      return 'Quote Accepted'
    case 'payment.completed':
      return payload.amount ? `Payment Completed (${payload.amount})` : 'Payment Completed'
    case 'payment.failed':
      return 'Payment Failed'
    case 'order.created':
      return 'Order Created'
    case 'lead.qualified':
      return 'Lead Qualified'
    default: {
      // e.g. "pricing.inquired" -> "Pricing Inquired"
      return eventType
        .split(/[._]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
  }
}

function mapSourceToActivityChannel(source: string): 'whatsapp' | 'instagram' | 'facebook' | 'system' {
  const s = source.toLowerCase()
  if (s.includes('whatsapp')) return 'whatsapp'
  if (s.includes('instagram')) return 'instagram'
  if (s.includes('facebook')) return 'facebook'
  return 'system'
}
