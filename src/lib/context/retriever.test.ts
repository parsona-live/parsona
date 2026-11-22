import { describe, it, expect, vi } from 'vitest'
import { assembleCustomerContext } from './retriever'

describe('Customer Context Engine — Context Retrieval & Assembly', () => {
  it('assembles verified customer memory and authoritative business state into prompt block', async () => {
    const contact = {
      id: 'contact-1',
      account_id: 'acc-1',
      name: 'Yash Sharma',
      phone: '+919876543210',
      last_business_action: 'Appointment Booked (Nov 25)',
      last_business_action_at: '2026-11-25T10:30:00Z',
    }

    const memory = {
      id: 'mem-1',
      account_id: 'acc-1',
      contact_id: 'contact-1',
      memory_key: 'budget',
      memory_value: '₹80,000',
      authority: 'customer_explicit',
      status: 'active',
      confidence: 1.0,
      created_at: new Date().toISOString(),
      last_confirmed_at: new Date().toISOString(),
    }

    const event = {
      id: 'evt-1',
      account_id: 'acc-1',
      contact_id: 'contact-1',
      event_type: 'appointment.booked',
      source: 'booking_system',
      payload: { service: 'Solar Installation' },
      occurred_at: '2026-11-25T10:30:00Z',
      created_at: new Date().toISOString(),
    }

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: contact, error: null }),
                })),
              })),
            })),
          }
        }
        if (table === 'contact_memories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      order: vi.fn().mockResolvedValue({ data: [memory], error: null }),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'contact_events') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({ data: [event], error: null }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'contact_intelligence_snapshots') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: 'snap-1',
                          intent_category: 'ready_to_convert',
                          intent_score: 90,
                          intent_summary: 'Customer wants solar setup installed by end of month with ₹80k budget.',
                          signals: [{ signal: 'Confirmed budget and requested installation date' }],
                          objections: [],
                          next_best_action: 'Send contract and confirm installation crew for Nov 25',
                        },
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'context_traces') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }),
    } as any

    const context = await assembleCustomerContext(mockDb, 'acc-1', 'contact-1')

    expect(context).not.toBeNull()
    expect(context?.contact.name).toBe('Yash Sharma')
    expect(context?.memories).toHaveLength(1)
    expect(context?.businessEvents).toHaveLength(1)

    // Check prompt string assembly
    const prompt = context?.renderedPromptBlock || ''
    expect(prompt).toContain('VERIFIED CUSTOMER CONTEXT & BUSINESS STATE')
    expect(prompt).toContain('UNTRUSTED DATA GUARD')
    expect(prompt).toContain('Yash Sharma')
    expect(prompt).toContain('Appointment Booked (Nov 25)')
    expect(prompt).toContain('budget: "₹80,000"')
    expect(prompt).toContain('ready_to_convert')
    expect(prompt).toContain('Score: 90/100')
  })

  it('handles missing contact gracefully without throwing', async () => {
    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            })),
          })),
        })),
      })),
    } as any

    const context = await assembleCustomerContext(mockDb, 'acc-1', 'unknown-contact')
    expect(context).toBeNull()
  })
})
