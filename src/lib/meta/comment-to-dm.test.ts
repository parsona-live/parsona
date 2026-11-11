import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  matchesCommentRule,
  sendCommentDm,
  postCommentReply,
  processInboundComment,
} from './comment-to-dm'
import type { CommentToDmRule } from '@/types'

const h = vi.hoisted(() => ({
  getDecryptedChannelToken: vi.fn(),
}))

vi.mock('./channels', () => ({
  getDecryptedChannelToken: h.getDecryptedChannelToken,
}))

describe('Comment-to-DM Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('matches comments based on "contains" keywords', () => {
    const rule = {
      match_type: 'contains',
      keywords: ['price', 'cost'],
    } as unknown as CommentToDmRule

    expect(matchesCommentRule('Can you please tell me the price?', rule)).toBe(true)
    expect(matchesCommentRule('How much does it cost?', rule)).toBe(true)
    expect(matchesCommentRule('Love this outfit!', rule)).toBe(false)
  })

  it('matches comments based on "exact" keywords', () => {
    const rule = {
      match_type: 'exact',
      keywords: ['link', 'buy'],
    } as unknown as CommentToDmRule

    expect(matchesCommentRule('LINK', rule)).toBe(true)
    expect(matchesCommentRule('send link please', rule)).toBe(false)
  })

  it('matches any comment when match_type is "any"', () => {
    const rule = {
      match_type: 'any',
      keywords: [],
    } as unknown as CommentToDmRule

    expect(matchesCommentRule('anything at all', rule)).toBe(true)
  })

  it('sends private DM to comment ID via Meta Graph API', async () => {
    const mockRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({ message_id: 'dm_sent_123' }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockRes as unknown as Response)

    const res = await sendCommentDm('valid_token', 'comm_777', 'Here is your link: https://example.com')

    expect(res.success).toBe(true)
    expect(res.messageId).toBe('dm_sent_123')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com/v21.0/me/messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recipient: { comment_id: 'comm_777' },
          message: { text: 'Here is your link: https://example.com' },
        }),
      }),
    )
  })

  it('posts public reply under comment via Meta Graph API', async () => {
    const mockRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'reply_comm_888' }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockRes as unknown as Response)

    const res = await postCommentReply('valid_token', 'comm_777', '@jane Sent you a DM! 📩')

    expect(res.success).toBe(true)
    expect(res.replyId).toBe('reply_comm_888')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com/v21.0/comm_777/replies'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: '@jane Sent you a DM! 📩' }),
      }),
    )
  })

  it('executes matching comment rule, dispatches DM, and increments counter', async () => {
    h.getDecryptedChannelToken.mockResolvedValue('decrypted_token')

    const mockFetchRes = {
      ok: true,
      json: vi.fn().mockResolvedValue({ message_id: 'dm_1', id: 'reply_1' }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockFetchRes as unknown as Response)

    const updateMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))

    const mockRule = {
      id: 'rule_1',
      channel_connection_id: 'conn_1',
      account_id: 'acc_1',
      match_type: 'contains',
      keywords: ['price'],
      dm_message_text: 'Hi {{username}}, the price is $49!',
      public_replies: ['Check your DMs! 📩'],
      post_filter_type: 'all_posts',
      execution_count: 5,
    }

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'meta_channel_connections') {
          return {
            select: vi.fn(() => ({
              or: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'conn_1', account_id: 'acc_1' },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'comment_to_dm_rules') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [mockRule],
                  error: null,
                }),
              })),
            })),
            update: updateMock,
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof processInboundComment>[0]

    const event = {
      field: 'comments',
      value: {
        from: { id: 'user_1', username: 'sarah_fashion' },
        post: { id: 'post_999' },
        message: 'What is the price of this jacket?',
        comment_id: 'comm_123',
      },
    }

    const results = await processInboundComment(mockDb, 'page_123', event)

    expect(results).toHaveLength(1)
    expect(results[0].sentDm).toBe(true)
    expect(results[0].postedReply).toBe(true)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ execution_count: 6 }),
    )
  })
})

