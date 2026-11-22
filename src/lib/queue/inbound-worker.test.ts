import { describe, it, expect, vi } from 'vitest'
import {
  enqueueInboundEvent,
  claimInboundEvents,
  processSingleInboundEvent,
  drainInboundQueue,
} from './inbound-worker'

describe('inbound-worker', () => {
  it('enqueues an inbound event idempotently', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'evt-1' }],
            error: null,
          }),
        }),
      }),
    } as any

    const res = await enqueueInboundEvent(db, {
      accountId: 'acc-1',
      channel: 'instagram',
      eventKey: 'mid.12345',
      partitionKey: 'acc-1:user-999',
      payload: { hello: 'world' },
    })

    expect(res.enqueued).toBe(true)
    expect(res.eventId).toBe('evt-1')
    expect(db.from).toHaveBeenCalledWith('inbound_events')
  })

  it('claims events using RPC', async () => {
    const mockEvents = [
      { id: 'evt-1', channel: 'instagram', status: 'processing', attempts: 1 },
    ]
    const db = {
      rpc: vi.fn().mockResolvedValue({
        data: mockEvents,
        error: null,
      }),
    } as any

    const claimed = await claimInboundEvents(db, 10)
    expect(claimed).toEqual(mockEvents)
    expect(db.rpc).toHaveBeenCalledWith('claim_inbound_events_batch', { p_batch_size: 10 })
  })

  it('handles exponential backoff on processing failure', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const db = {
      from: vi.fn().mockReturnValue({
        update: updateMock,
      }),
    } as any

    const failedEvent = {
      id: 'evt-fail',
      channel: 'instagram' as const,
      event_key: 'key-1',
      payload: null as any, // causes error when accessing payload.messaging_event
      status: 'processing' as const,
      attempts: 1,
      max_attempts: 5,
      retry_after: '2026-11-21T10:00:00Z',
      created_at: '2026-11-21T10:00:00Z',
    }

    const res = await processSingleInboundEvent(db, failedEvent)
    expect(res.success).toBe(false)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        attempts: 2,
        last_error: expect.any(String),
      }),
    )
  })

  it('moves event to failed status (DLQ) after reaching max attempts', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const db = {
      from: vi.fn().mockReturnValue({
        update: updateMock,
      }),
    } as any

    const finalFailEvent = {
      id: 'evt-dlq',
      channel: 'instagram' as const,
      event_key: 'key-dlq',
      payload: null as any,
      status: 'processing' as const,
      attempts: 4,
      max_attempts: 5,
      retry_after: '2026-11-21T10:00:00Z',
      created_at: '2026-11-21T10:00:00Z',
    }

    const res = await processSingleInboundEvent(db, finalFailEvent)
    expect(res.success).toBe(false)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        attempts: 5,
      }),
    )
  })
})
