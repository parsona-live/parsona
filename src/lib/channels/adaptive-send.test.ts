import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendAdaptiveText,
  sendAdaptiveButtons,
  sendAdaptiveList,
  sendAdaptiveMedia,
} from './adaptive-send'

// Mock dependencies
vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/flows/meta-send', () => ({
  engineSendText: vi.fn().mockResolvedValue({ whatsapp_message_id: 'wa_msg_123' }),
  engineSendInteractiveButtons: vi.fn().mockResolvedValue({ whatsapp_message_id: 'wa_btn_123' }),
  engineSendInteractiveList: vi.fn().mockResolvedValue({ whatsapp_message_id: 'wa_list_123' }),
  engineSendInteractiveCarousel: vi.fn().mockResolvedValue({ whatsapp_message_id: 'wa_car_123' }),
  engineSendMedia: vi.fn().mockResolvedValue({ whatsapp_message_id: 'wa_media_123' }),
}))

vi.mock('@/lib/meta/channels', () => ({
  getDecryptedChannelToken: vi.fn().mockResolvedValue('test_token_xyz'),
}))

describe('adaptive-send (Omnichannel Channel Adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: 'mid.ig.999' }),
    }) as any
  })

  it('routes text to WhatsApp when conversation.channel is whatsapp', async () => {
    const fakeDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'c1', channel: 'whatsapp', channel_connection_id: null },
            }),
          }),
        }),
      }),
    } as any

    const result = await sendAdaptiveText({
      db: fakeDb,
      accountId: 'acc1',
      userId: 'usr1',
      conversationId: 'c1',
      contactId: 'ct1',
      text: 'Hello from WhatsApp flow!',
    })

    expect(result.success).toBe(true)
    expect(result.channel).toBe('whatsapp')
    expect(result.messageId).toBe('wa_msg_123')
  })

  it('enforces 24-hour window guard on Instagram automated bot messages', async () => {
    // 25 hours ago
    const expiredTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

    const fakeDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'c2',
                channel: 'instagram',
                channel_connection_id: 'conn_1',
                last_inbound_at: expiredTimestamp,
              },
            }),
          }),
        }),
      }),
    } as any

    const result = await sendAdaptiveText({
      db: fakeDb,
      accountId: 'acc1',
      userId: 'usr1',
      conversationId: 'c2',
      contactId: 'ct2',
      text: 'Hello from Instagram flow!',
      senderType: 'bot',
    })

    expect(result.success).toBe(false)
    expect(result.channel).toBe('instagram')
    expect(result.windowExpired).toBe(true)
    expect(result.error).toContain('24-hour messaging window')
  })

  it('translates interactive buttons to Instagram Generic Template with postback buttons within 24h window', async () => {
    // 2 hours ago
    const recentTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const fakeDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'c3',
                    channel: 'instagram',
                    channel_connection_id: 'conn_1',
                    last_inbound_at: recentTimestamp,
                  },
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { ig_user_id: 'igsid_456' },
                }),
              }),
            }),
          }
        }
        if (table === 'messages') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      }),
    } as any

    const result = await sendAdaptiveButtons({
      db: fakeDb,
      accountId: 'acc1',
      userId: 'usr1',
      conversationId: 'c3',
      contactId: 'ct3',
      bodyText: 'Choose your preferred package:',
      buttons: [
        { id: 'opt_1', title: 'Starter Package Plan' },
        { id: 'opt_2', title: 'Enterprise Business Tier' },
      ],
      senderType: 'bot',
    })

    expect(result.success).toBe(true)
    expect(result.channel).toBe('instagram')
    expect(result.messageId).toBe('mid.ig.999')

    // Verify fetch payload had Generic Template with postback buttons
    expect(global.fetch).toHaveBeenCalled()
    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const bodySent = JSON.parse(fetchCall[1]?.body as string)
    expect(bodySent.recipient.id).toBe('igsid_456')
    expect(bodySent.message.attachment.payload.template_type).toBe('generic')
    const buttons = bodySent.message.attachment.payload.elements[0].buttons
    expect(buttons.length).toBe(2)
    expect(buttons[0].type).toBe('postback')
    expect(buttons[0].title.length).toBeLessThanOrEqual(20)
    expect(buttons[0].payload).toBe('opt_1')
  })

  it('converts document PDF attachments into clickable text links on Instagram', async () => {
    const recentTimestamp = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()

    const fakeDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'c4',
                    channel: 'instagram',
                    channel_connection_id: 'conn_1',
                    last_inbound_at: recentTimestamp,
                  },
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { ig_user_id: 'igsid_789' },
                }),
              }),
            }),
          }
        }
        if (table === 'messages') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      }),
    } as any

    const result = await sendAdaptiveMedia({
      db: fakeDb,
      accountId: 'acc1',
      userId: 'usr1',
      conversationId: 'c4',
      contactId: 'ct4',
      mediaType: 'document',
      mediaUrl: 'https://example.com/pricing-guide.pdf',
      caption: 'Here is our pricing brochure',
      senderType: 'bot',
    })

    expect(result.success).toBe(true)
    expect(result.channel).toBe('instagram')

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const bodySent = JSON.parse(fetchCall[1]?.body as string)
    // Document on Instagram was sent as text link!
    expect(bodySent.message.text).toContain('📄 Document: https://example.com/pricing-guide.pdf')
  })
})
