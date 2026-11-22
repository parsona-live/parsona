import { describe, it, expect, vi } from 'vitest'
import { recordContactEvent } from './events'
import { upsertCustomerMemory } from './memory'

describe('Customer Context Engine — Events & Memory', () => {
  it('records a contact event and handles duplicate idempotency keys cleanly', async () => {
    let insertedEvent: Record<string, unknown> | null = null

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'contact_events') {
          return {
            insert: vi.fn((payload) => {
              insertedEvent = payload
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'evt-1', ...payload },
                    error: null,
                  }),
                })),
              }
            }),
          }
        }
        if (table === 'contacts') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          }
        }
        if (table === 'contact_activities') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    } as any

    const res = await recordContactEvent(mockDb, {
      accountId: 'acc-1',
      contactId: 'c-1',
      eventType: 'appointment.booked',
      source: 'booking_system',
      payload: { start_at: '2026-11-25T10:30:00Z', service: 'Solar Consultation' },
      idempotencyKey: 'apt_123_booked',
    })

    expect(res.success).toBe(true)
    expect(res.event?.event_type).toBe('appointment.booked')
    expect(insertedEvent).toMatchObject({
      event_type: 'appointment.booked',
      idempotency_key: 'apt_123_booked',
    })
  })

  it('preserves authority ranking and prevents AI inference from overwriting human edit', async () => {
    const existingHumanMemory = {
      id: 'mem-1',
      account_id: 'acc-1',
      contact_id: 'c-1',
      memory_key: 'budget',
      memory_value: '80000',
      authority: 'human_business_edit',
      confidence: 1.0,
      status: 'active',
    }

    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [existingHumanMemory],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as any

    // Attempt to overwrite human edit with an AI-inferred lower-authority memory
    const result = await upsertCustomerMemory(mockDb, {
      accountId: 'acc-1',
      contactId: 'c-1',
      memoryKey: 'budget',
      memoryValue: '50000',
      sourceType: 'ai_inferred',
      authority: 'ai_inferred',
      confidence: 0.6,
    })

    expect(result.success).toBe(false)
    expect(result.skippedReason).toContain('Cannot overwrite authority')
  })
})
