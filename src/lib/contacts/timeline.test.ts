import { describe, it, expect, vi } from 'vitest'
import { logContactActivity, fetchContactActivities } from './timeline'

describe('timeline', () => {
  it('logs contact activity and updates hot-path contact fields', async () => {
    const insertedActivity = {
      id: 'act-123',
      account_id: 'acc-1',
      contact_id: 'c-1',
      conversation_id: 'conv-1',
      channel: 'instagram',
      event_type: 'message_inbound',
      summary: 'Inbound DM from Instagram user',
      metadata: { text: 'Hi there' },
      created_at: '2026-11-21T10:00:00.000Z',
    }

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const db = {
      from: vi.fn((table: string) => {
        if (table === 'contact_activities') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: insertedActivity, error: null }),
              }),
            }),
          }
        }
        if (table === 'contacts') {
          return {
            update: updateMock,
          }
        }
        return {}
      }),
    } as any

    const result = await logContactActivity(db, {
      accountId: 'acc-1',
      contactId: 'c-1',
      conversationId: 'conv-1',
      channel: 'instagram',
      eventType: 'message_inbound',
      summary: 'Inbound DM from Instagram user',
      metadata: { text: 'Hi there' },
    })

    expect(result).toEqual(insertedActivity)
    expect(db.from).toHaveBeenCalledWith('contact_activities')
    expect(db.from).toHaveBeenCalledWith('contacts')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        last_seen_channel: 'instagram',
        last_action_summary: 'Inbound DM from Instagram user',
      }),
    )
  })

  it('fetches contact activities with cursor pagination', async () => {
    const mockData = [
      { id: 'act-2', contact_id: 'c-1', created_at: '2026-11-21T10:05:00.000Z' },
      { id: 'act-1', contact_id: 'c-1', created_at: '2026-11-21T10:00:00.000Z' },
    ]

    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })),
    } as any

    const { activities, nextCursor } = await fetchContactActivities(db, 'c-1', { limit: 10 })
    expect(activities).toHaveLength(2)
    expect(nextCursor).toBeUndefined()
  })
})
