import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelType, InboundEvent } from '@/types'
import {
  processInboundMetaMessage,
  handleMetaDeliveryOrReadEvent,
  type MetaMessagingEvent,
} from '@/lib/meta/inbound-normalizer'
import { processInboundComment, type InboundCommentEvent } from '@/lib/meta/comment-to-dm'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'
import type { ParsedInbound } from '@/lib/flows/types'

export interface EnqueueInboundParams {
  accountId?: string | null
  channel: ChannelType
  eventKey: string
  partitionKey?: string | null
  payload: Record<string, unknown>
}

/**
 * Enqueue a raw webhook event idempotently into `inbound_events`.
 * Returns true if newly enqueued, false if duplicate.
 */
export async function enqueueInboundEvent(
  db: SupabaseClient,
  params: EnqueueInboundParams,
): Promise<{ enqueued: boolean; eventId?: string }> {
  const { accountId = null, channel, eventKey, partitionKey = null, payload } = params

  const { data, error } = await db
    .from('inbound_events')
    .upsert(
      {
        account_id: accountId,
        channel,
        event_key: eventKey,
        partition_key: partitionKey,
        payload,
        status: 'pending',
        attempts: 0,
        max_attempts: 5,
        retry_after: new Date().toISOString(),
      },
      { onConflict: 'channel,event_key', ignoreDuplicates: true },
    )
    .select('id')

  if (error) {
    console.error(`[enqueueInboundEvent] Error enqueuing event ${channel}/${eventKey}:`, error)
    return { enqueued: false }
  }

  const enqueued = Boolean(data && data.length > 0)
  return { enqueued, eventId: data?.[0]?.id }
}

/**
 * Claim a batch of pending events using PostgreSQL FOR UPDATE SKIP LOCKED
 * via the `claim_inbound_events_batch` RPC.
 */
export async function claimInboundEvents(
  db: SupabaseClient,
  batchSize: number = 10,
): Promise<InboundEvent[]> {
  const { data, error } = await db.rpc('claim_inbound_events_batch', {
    p_batch_size: batchSize,
  })

  if (!error && data) {
    return data as InboundEvent[]
  }

  // Fallback if RPC is missing (e.g. before migration applied in dev)
  const now = new Date().toISOString()
  const { data: fallbackData } = await db
    .from('inbound_events')
    .select('*')
    .eq('status', 'pending')
    .lte('retry_after', now)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (!fallbackData || fallbackData.length === 0) return []

  const ids = fallbackData.map((e) => e.id)
  await db
    .from('inbound_events')
    .update({ status: 'processing' })
    .in('id', ids)

  return fallbackData as InboundEvent[]
}

/**
 * Process a single inbound event with exponential backoff and DLQ handling.
 */
export async function processSingleInboundEvent(
  db: SupabaseClient,
  event: InboundEvent,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = event.payload as any

    if (event.channel === 'instagram' || event.channel === 'facebook') {
      // Check for messaging event
      if (payload.messaging_event) {
        const msgEvent = payload.messaging_event as MetaMessagingEvent

        if (msgEvent.delivery || msgEvent.read) {
          await handleMetaDeliveryOrReadEvent(db, event.channel, msgEvent)
        } else {
          const inboundResult = await processInboundMetaMessage(db, event.channel, msgEvent)

          if (inboundResult) {
            let parsedFlowMessage: ParsedInbound | null = null
            const metaMsg = msgEvent.message
            const postback = (msgEvent as any).postback

            if (metaMsg?.quick_reply) {
              parsedFlowMessage = {
                kind: 'interactive_reply',
                reply_id: metaMsg.quick_reply.payload,
                reply_title: metaMsg.text || metaMsg.quick_reply.payload,
                meta_message_id: metaMsg.mid,
              }
            } else if (postback) {
              parsedFlowMessage = {
                kind: 'interactive_reply',
                reply_id: postback.payload,
                reply_title: postback.title || postback.payload,
                meta_message_id: postback.mid || `postback_${Date.now()}`,
              }
            } else if (metaMsg?.text) {
              parsedFlowMessage = {
                kind: 'text',
                text: metaMsg.text,
                meta_message_id: metaMsg.mid,
              }
            }

            let flowHandled = false
            if (parsedFlowMessage) {
              const isFirst = inboundResult.autoLinked ? false : (inboundResult.conversation.unread_count <= 1)
              const flowRes = await dispatchInboundToFlows({
                accountId: inboundResult.connection.account_id,
                userId: inboundResult.connection.user_id,
                contactId: inboundResult.contact.id,
                conversationId: inboundResult.conversation.id,
                message: parsedFlowMessage,
                isFirstInboundMessage: isFirst,
                channel: event.channel,
              }).catch((err) => {
                console.error('[inbound-worker] Flow dispatch error:', err)
                return null
              })
              flowHandled = Boolean(flowRes?.consumed)
            }

            if (!flowHandled && (metaMsg?.text || metaMsg?.quick_reply)) {
              const { data: activeFlow } = await db
                .from('flow_runs')
                .select('id')
                .eq('account_id', inboundResult.connection.account_id)
                .eq('contact_id', inboundResult.contact.id)
                .eq('status', 'active')
                .limit(1)

              if (!activeFlow || activeFlow.length === 0) {
                await dispatchInboundToAiReply({
                  accountId: inboundResult.connection.account_id,
                  conversationId: inboundResult.conversation.id,
                  contactId: inboundResult.contact.id,
                  configOwnerUserId: inboundResult.connection.user_id,
                  inboundMessageId: inboundResult.message.message_id || undefined,
                }).catch((err) => {
                  console.warn('[inbound-worker] AI auto-reply dispatch error:', err)
                })
              }
            }
          }
        }
      } else if (payload.comment_event) {
        // Comment-to-DM event
        await processInboundComment(
          db,
          event.channel,
          payload.comment_event as InboundCommentEvent,
        )
      }
    }

    // Mark completed
    await db
      .from('inbound_events')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', event.id)

    return { success: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[processSingleInboundEvent] Error processing event ${event.id}:`, err)

    const attempts = (event.attempts || 0) + 1
    const maxAttempts = event.max_attempts || 5

    if (attempts >= maxAttempts) {
      // Dead letter queue
      await db
        .from('inbound_events')
        .update({
          status: 'failed',
          attempts,
          last_error: errorMsg,
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id)
    } else {
      // Exponential backoff: 2^attempts seconds
      const delaySeconds = Math.pow(2, attempts)
      const retryAfter = new Date(Date.now() + delaySeconds * 1000).toISOString()

      await db
        .from('inbound_events')
        .update({
          status: 'pending',
          attempts,
          retry_after: retryAfter,
          last_error: errorMsg,
        })
        .eq('id', event.id)
    }

    return { success: false, error: errorMsg }
  }
}

/**
 * Drain pending events from the queue in batches.
 * Safe to be invoked from Next.js `after()`, cron, or background workers.
 */
export async function drainInboundQueue(
  db: SupabaseClient,
  options: { batchSize?: number } = {},
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const batchSize = options.batchSize || 10
  const events = await claimInboundEvents(db, batchSize)

  if (events.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  // Group events by partition_key so events for the same contact run in serial FIFO,
  // while different contacts run in parallel.
  const partitionMap = new Map<string, InboundEvent[]>()
  for (const event of events) {
    const key = event.partition_key || `general_${event.id}`
    const list = partitionMap.get(key) || []
    list.push(event)
    partitionMap.set(key, list)
  }

  // Run distinct partitions in parallel
  await Promise.all(
    Array.from(partitionMap.values()).map(async (partitionEvents) => {
      for (const ev of partitionEvents) {
        const res = await processSingleInboundEvent(db, ev)
        if (res.success) {
          succeeded++
        } else {
          failed++
        }
      }
    }),
  )

  return {
    processed: events.length,
    succeeded,
    failed,
  }
}
