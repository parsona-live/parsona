import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchOutboundMessage } from './outbound-dispatch'

const h = vi.hoisted(() => ({
  engineSendText: vi.fn(),
  getDecryptedChannelToken: vi.fn(),
}))

vi.mock('@/lib/flows/meta-send', () => ({
  engineSendText: h.engineSendText,
}))

vi.mock('@/lib/meta/channels', () => ({
  getDecryptedChannelToken: h.getDecryptedChannelToken,
}))

describe('Omnichannel Outbound Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('routes WhatsApp conversations to WhatsApp Cloud API engine', async () => {
    h.engineSendText.mockResolvedValue({ whatsapp_message_id: 'wa_msg_1' })

    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'conv_1', channel: 'whatsapp', channel_connection_id: null },
              error: null,
            }),
          })),
        })),
      })),
    } as unknown as Parameters<typeof dispatchOutboundMessage>[0]['db']

    const res = await dispatchOutboundMessage({
      db: mockDb,
      accountId: 'acc_1',
      userId: 'usr_1',
      conversationId: 'conv_1',
      contactId: 'cnt_1',
      text: 'Hello via WhatsApp',
    })

    expect(res.success).toBe(true)
    expect(res.channel).toBe('whatsapp')
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv_1', text: 'Hello via WhatsApp' }),
    )
  })

  it('routes Instagram conversations to Meta Graph API with IGSID', async () => {
    h.getDecryptedChannelToken.mockResolvedValue('decrypted_page_token')

    const mockFetchRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({ message_id: 'ig_mid_123' }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockFetchRes as unknown as Response)

    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'conv_ig_1',
                    channel: 'instagram',
                    channel_connection_id: 'conn_ig_1',
                    last_inbound_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              })),
            })),
            update: updateMock,
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { ig_user_id: 'igsid_9999', fb_page_scoped_id: null },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'messages') {
          return { insert: insertMock }
        }
        return {}
      }),
    } as unknown as Parameters<typeof dispatchOutboundMessage>[0]['db']

    const res = await dispatchOutboundMessage({
      db: mockDb,
      accountId: 'acc_1',
      userId: 'usr_1',
      conversationId: 'conv_ig_1',
      contactId: 'cnt_ig_1',
      text: 'Hello on Instagram DM',
    })

    expect(res.success).toBe(true)
    expect(res.channel).toBe('instagram')
    expect(res.messageId).toBe('ig_mid_123')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com/v21.0/me/messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recipient: { id: 'igsid_9999' },
          message: { text: 'Hello on Instagram DM' },
        }),
      }),
    )
    expect(insertMock).toHaveBeenCalled()
  })

  it('applies HUMAN_AGENT tag when agent replies between 24 hours and 7 days', async () => {
    h.getDecryptedChannelToken.mockResolvedValue('decrypted_page_token')

    const mockFetchRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({ message_id: 'fb_mid_agent' }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockFetchRes as unknown as Response)

    // 48 hours ago
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'conv_fb_1',
                    channel: 'facebook',
                    channel_connection_id: 'conn_fb_1',
                    last_inbound_at: twoDaysAgo,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { ig_user_id: null, fb_page_scoped_id: 'psid_888' },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'messages') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return {}
      }),
    } as unknown as Parameters<typeof dispatchOutboundMessage>[0]['db']

    const res = await dispatchOutboundMessage({
      db: mockDb,
      accountId: 'acc_1',
      userId: 'usr_1',
      conversationId: 'conv_fb_1',
      contactId: 'cnt_fb_1',
      text: 'Following up with you!',
      senderType: 'agent',
    })

    expect(res.success).toBe(true)
    expect(res.isHumanAgentTag).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({
          recipient: { id: 'psid_888' },
          message: { text: 'Following up with you!' },
          tag: 'HUMAN_AGENT',
        }),
      }),
    )
  })

  it('rejects sending when window has exceeded 7 days (168 hours)', async () => {
    h.getDecryptedChannelToken.mockResolvedValue('decrypted_page_token')

    // 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'conv_fb_old',
                    channel: 'facebook',
                    channel_connection_id: 'conn_fb_1',
                    last_inbound_at: eightDaysAgo,
                  },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { ig_user_id: null, fb_page_scoped_id: 'psid_888' },
                  error: null,
                }),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof dispatchOutboundMessage>[0]['db']

    const res = await dispatchOutboundMessage({
      db: mockDb,
      accountId: 'acc_1',
      userId: 'usr_1',
      conversationId: 'conv_fb_old',
      contactId: 'cnt_fb_1',
      text: 'Too late message',
      senderType: 'agent',
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('Outside allowed messaging window')
  })
})
