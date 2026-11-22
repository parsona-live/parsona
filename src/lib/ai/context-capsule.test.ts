import { describe, it, expect, vi } from 'vitest'
import { buildContactContextCapsule, renderCapsuleForAiPrompt } from './context-capsule'

describe('context-capsule', () => {
  it('renders capsule for AI prompt properly', () => {
    const rendered = renderCapsuleForAiPrompt({
      name: 'Yash Tupkar',
      phone: '+917898297769',
      email: 'yashtupkar6@gmail.com',
      socialHandles: {
        whatsapp: '+917898297769',
        instagram: '@yashtupkar',
        facebook: 'Yash Tupkar',
      },
      tags: ['VIP', 'Hot Lead'],
      lastSeenChannel: 'instagram',
      lastActionSummary: 'Booked consultation for Friday 2 PM',
      lastActionAt: '2026-11-21T10:30:00.000Z',
      recentTimeline: [
        {
          channel: 'instagram',
          eventType: 'appointment_booked',
          summary: 'Appointment booked for Friday 2 PM',
          createdAt: '2026-11-21T10:30:00.000Z',
        },
      ],
    })

    expect(rendered).toContain('### Omnichannel Customer Memory & State:')
    expect(rendered).toContain('**Name**: Yash Tupkar')
    expect(rendered).toContain('Instagram (@yashtupkar)')
    expect(rendered).toContain('**Last Seen Platform**: instagram')
    expect(rendered).toContain('**Last Action**: Booked consultation for Friday 2 PM')
    expect(rendered).toContain('**Customer Tags**: [VIP, Hot Lead]')
    expect(rendered).toContain('[INSTAGRAM] Appointment booked for Friday 2 PM')
  })

  it('builds context capsule by querying contact and timeline', async () => {
    const mockContact = {
      id: 'c-123',
      name: 'Yash Tupkar',
      phone: '+917898297769',
      email: 'yashtupkar6@gmail.com',
      ig_username: 'yashtupkar',
      last_seen_channel: 'instagram',
      last_action_summary: 'Inbound message received',
      last_action_at: '2026-11-21T10:00:00.000Z',
      contact_tags: [
        { tags: { id: 't-1', name: 'VIP', color: '#ff0000' } },
      ],
    }

    const mockActivities = [
      {
        id: 'act-1',
        channel: 'instagram',
        event_type: 'message_inbound',
        summary: 'Inbound message from user',
        created_at: '2026-11-21T10:00:00.000Z',
      },
    ]

    const db = {
      from: vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockContact, error: null }),
              }),
            }),
          }
        }
        if (table === 'contact_activities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockActivities, error: null }),
          }
        }
        return {}
      }),
    } as any

    const capsule = await buildContactContextCapsule(db, 'c-123')
    expect(capsule).not.toBeNull()
    expect(capsule?.name).toBe('Yash Tupkar')
    expect(capsule?.socialHandles.instagram).toBe('@yashtupkar')
    expect(capsule?.tags).toEqual(['VIP'])
    expect(capsule?.recentTimeline).toHaveLength(1)
    expect(capsule?.renderedPromptContext).toContain('### Omnichannel Customer Memory & State:')
  })
})
