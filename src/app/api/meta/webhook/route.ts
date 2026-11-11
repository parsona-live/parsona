import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  verifyMetaWebhookSignature,
  verifyTokenMatches,
} from '@/lib/whatsapp/webhook-signature'
import { readCappedBody } from '@/lib/whatsapp/webhook-body'
import { processInboundMetaMessage, type MetaMessagingEvent } from '@/lib/meta/inbound-normalizer'
import { processInboundComment, type InboundCommentEvent } from '@/lib/meta/comment-to-dm'

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

  if (payload.object !== 'page' && payload.object !== 'instagram') {
    return NextResponse.json({ status: 'ignored_object' })
  }

  // 2. Process events in the background with `after()` so Meta gets a fast 200
  after(async () => {
    try {
      const db = supabaseAdmin()
      const channel = payload.object === 'instagram' ? 'instagram' : 'facebook'

      for (const entry of payload.entry || []) {
        // Direct messages
        if (entry.messaging && entry.messaging.length > 0) {
          for (const event of entry.messaging) {
            await processInboundMetaMessage(db, channel, event).catch((err) => {
              console.error('[Meta Webhook] Failed to process messaging event:', err)
            })
          }
        }

        // Comment-to-DM triggers
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              await processInboundComment(db, entry.id, change as unknown as InboundCommentEvent).catch((err) => {
                console.error('[Meta Webhook] Failed to process comment event:', err)
              })
            }
          }
        }
      }
    } catch (err) {
      console.error('[Meta Webhook] Background execution error:', err)
    }
  })

  return NextResponse.json({ status: 'ok' })
}
