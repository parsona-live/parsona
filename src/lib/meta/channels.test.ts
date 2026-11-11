import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  upsertMetaChannelConnection,
  listAccountMetaChannels,
  deleteMetaChannelConnection,
  getDecryptedChannelToken,
  fetchLinkedInstagramAccount,
  subscribePageToApp,
} from './channels'

const h = vi.hoisted(() => ({
  state: {
    channels: [] as Record<string, unknown>[],
    upserted: null as Record<string, unknown> | null,
    deletedId: null as string | null,
  },
}))

vi.mock('@/lib/whatsapp/encryption', () => ({
  encrypt: (text: string) => `enc_${text}`,
  decrypt: (cipher: string) => cipher.replace(/^enc_/, ''),
}))

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'meta_channel_connections') {
        const chain: Record<string, unknown> = {
          select: vi.fn(() => chain),
          eq: vi.fn((col: string, val: string) => {
            if (col === 'id') {
              const found = h.state.channels.find((c) => c.id === val)
              return {
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: found || null, error: null }),
                })),
                single: vi.fn().mockResolvedValue({ data: found || null, error: null }),
              }
            }
            return chain
          }),
          order: vi.fn().mockResolvedValue({ data: h.state.channels, error: null }),
          upsert: vi.fn((payload: Record<string, unknown>) => {
            h.state.upserted = payload
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'conn_123', ...payload },
                  error: null,
                }),
              }),
            }
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              eq: vi.fn(() => {
                h.state.deletedId = val
                return Promise.resolve({ error: null })
              }),
            })),
          })),
        }
        return chain
      }
      return {}
    },
  }),
}))

describe('Meta Channels Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.state.channels = []
    h.state.upserted = null
    h.state.deletedId = null
    global.fetch = vi.fn()
  })

  it('upserts a channel connection with encrypted token', async () => {
    const res = await upsertMetaChannelConnection({
      accountId: 'acc_1',
      userId: 'usr_1',
      channel: 'facebook',
      pageId: 'page_999',
      pageName: 'My Awesome Page',
      accessToken: 'token_secret_123',
    })

    expect(res.id).toBe('conn_123')
    expect(h.state.upserted?.encrypted_access_token).toBe('enc_token_secret_123')
    expect(h.state.upserted?.channel).toBe('facebook')
    expect(h.state.upserted?.page_id).toBe('page_999')
  })

  it('lists channel connections for an account', async () => {
    h.state.channels = [
      { id: '1', account_id: 'acc_1', channel: 'facebook', page_name: 'Page 1' },
      { id: '2', account_id: 'acc_1', channel: 'instagram', page_name: 'Page 1' },
    ]

    const list = await listAccountMetaChannels('acc_1')
    expect(list).toHaveLength(2)
    expect(list[0].channel).toBe('facebook')
    expect(list[1].channel).toBe('instagram')
  })

  it('retrieves decrypted channel token', async () => {
    h.state.channels = [
      { id: 'c_abc', account_id: 'acc_1', encrypted_access_token: 'enc_real_token' },
    ]

    const token = await getDecryptedChannelToken('c_abc', 'acc_1')
    expect(token).toBe('real_token')
  })

  it('deletes a channel connection', async () => {
    const success = await deleteMetaChannelConnection('acc_1', 'conn_to_delete')
    expect(success).toBe(true)
    expect(h.state.deletedId).toBe('conn_to_delete')
  })

  it('fetches linked Instagram account from Meta Graph API', async () => {
    const mockRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'page_123',
        instagram_business_account: {
          id: 'ig_biz_456',
          username: 'brand_official',
        },
      }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockRes as unknown as Response)

    const ig = await fetchLinkedInstagramAccount('page_123', 'tok')
    expect(ig).toEqual({ id: 'ig_biz_456', username: 'brand_official' })
  })

  it('subscribes Facebook Page to App Webhooks successfully', async () => {
    const mockRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockRes as unknown as Response)

    const sub = await subscribePageToApp('page_123', 'tok')
    expect(sub.success).toBe(true)
  })
})
