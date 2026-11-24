import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  verifyMetaWebhookSignature,
  verifyTokenMatches,
} from '@/lib/whatsapp/webhook-signature'
import { readCappedBody } from '@/lib/whatsapp/webhook-body'
import {
  processInboundMetaMessage,
  handleMetaDeliveryOrReadEvent,
  type MetaMessagingEvent,
} from '@/lib/meta/inbound-normalizer'
import { processInboundComment, type InboundCommentEvent } from '@/lib/meta/comment-to-dm'
import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import {
  enqueueInboundEvent,
  drainInboundQueue,
} from '@/lib/queue/inbound-worker'
import type { ParsedInbound } from '@/lib/flows/types'

export const maxDuration = 60

/**
 * GET /api/meta/webhook
 * Meta Webhook verification handshake for Facebook Messenger and Instagram.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('[Meta Webhook GET] Handshake received. Mode:', mode, 'Token:', token)

  if (mode !== 'subscribe') {
    return new NextResponse('Expected hub.mode=subscribe', { status: 400 })
  }

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'wacrm_meta_verify_token'
  if (!token || !verifyTokenMatches(token, expectedToken)) {
    console.warn('[Meta Webhook GET] Verify token mismatch! Expected:', expectedToken, 'Got:', token)
    return new NextResponse('Forbidden: Verify token mismatch', { status: 403 })
  }

  console.log('[Meta Webhook GET] Verification successful! Returning challenge.')
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

interface MetaWebhookPayload {
  object: 'page' | 'instagram'
  entry?: Array<{
    id: string
    time: number
    messaging?: MetaMessagingEvent[]
    changes?: Array<{
      field: string
      value: Record<string, unknown>
    }>
  }>
}

/**
 * POST /api/meta/webhook
 * Ingest inbound direct messages and comment changes from Meta.
 */
export async function POST(req: Request) {
  const rawBody = await readCappedBody(req)
  if (rawBody === null) {
    console.warn('[Meta Webhook POST] Payload too large')
    return new NextResponse('Payload Too Large', { status: 413 })
  }

  console.log('[Meta Webhook POST] Inbound webhook POST received! Bytes:', rawBody.length)

  // 1. Verify HMAC-SHA256 signature
  const signature = req.headers.get('x-hub-signature-256')
  if (process.env.META_APP_SECRET) {
    const verified = verifyMetaWebhookSignature(rawBody, signature)
    if (!verified) {
      console.warn('[Meta Webhook] Signature verification failed. Header:', signature)
      return new NextResponse('Unauthorized: Invalid HMAC signature', { status: 401 })
    }
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.warn('[Meta Webhook] Invalid JSON payload')
    return new NextResponse('Bad Request: Invalid JSON', { status: 400 })
  }

  console.log('[Meta Webhook POST] Object:', payload.object, 'Entries:', payload.entry?.length)
  console.log('[Meta Webhook POST] Full Inbound Payload:\n', JSON.stringify(payload, null, 2))

  if (payload.object !== 'page' && payload.object !== 'instagram') {
    return NextResponse.json({ status: 'ignored_object' })
  }

  const db = supabaseAdmin()
  const channel = payload.object === 'instagram' ? 'instagram' : 'facebook'

  // 2. Fast durable queue ingestion (deduplicated by event_key)
  for (const entry of payload.entry || []) {
    if (entry.messaging && entry.messaging.length > 0) {
      for (const event of entry.messaging) {
        const eventKey =
          event.message?.mid ||
          (event as any).postback?.mid ||
          event.delivery?.mids?.[0] ||
          event.read?.mid ||
          `meta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const partitionKey = `${channel}:${event.sender.id}`

        await enqueueInboundEvent(db, {
          channel,
          eventKey,
          partitionKey,
          payload: { messaging_event: event },
        }).catch((err) => {
          console.warn('[Meta Webhook] Ingestion enqueue warning:', err)
        })
      }
    }

    if (entry.changes && entry.changes.length > 0) {
      for (const change of entry.changes) {
        if (change.field === 'comments') {
          const commentVal = change.value as Record<string, unknown>
          const commentId = commentVal?.comment_id as string | undefined
          const fromObj = commentVal?.from as { id?: string } | undefined
          const eventKey =
            commentId ||
            `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
          const partitionKey = `${channel}:${fromObj?.id || entry.id}`

          await enqueueInboundEvent(db, {
            channel,
            eventKey,
            partitionKey,
            payload: { comment_event: change as unknown as Record<string, unknown> },
          }).catch((err) => {
            console.warn('[Meta Webhook] Comment enqueue warning:', err)
          })
        }
      }
    }
  }

  // 3. Drain pending events immediately for instant realtime inbox updates
  try {
    await Promise.race([
      drainInboundQueue(db, { batchSize: 20 }),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ])
  } catch (err) {
    console.error('[Meta Webhook] Immediate queue drain warning:', err)
  }

  // Fallback in after() to catch any remaining or delayed queue items
  after(async () => {
    try {
      await drainInboundQueue(db, { batchSize: 20 })
    } catch (err) {
      console.error('[Meta Webhook] Queue drain error in after():', err)
    }
  })

  return NextResponse.json({ status: 'ok' })
}
