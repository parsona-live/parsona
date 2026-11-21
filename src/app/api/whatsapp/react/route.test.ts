import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  sendReactionMessage: vi.fn(),
  getDecryptedChannelToken: vi.fn(),
  decrypt: vi.fn((x: string) => x),
  removeBusinessReaction: vi.fn().mockResolvedValue(null),
  setBusinessReaction: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: h.requireRole,
  toErrorResponse: vi.fn((err: any) => new Response(JSON.stringify({ error: err.message }), { status: 500 })),
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendReactionMessage: h.sendReactionMessage,
}));

vi.mock('@/lib/meta/channels', () => ({
  getDecryptedChannelToken: h.getDecryptedChannelToken,
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: h.decrypt,
}));

vi.mock('@/lib/inbox/business-reaction', () => ({
  removeBusinessReaction: h.removeBusinessReaction,
  setBusinessReaction: h.setBusinessReaction,
}));

describe('POST /api/whatsapp/react', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('sends sender_action react payload to Meta Graph API for Instagram messages', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  table === 'messages'
                    ? { id: 'msg-ig-1', message_id: 'mid.ig.123', conversation_id: 'conv-ig-1' }
                    : {
                        id: 'conv-ig-1',
                        account_id: 'acct-1',
                        channel: 'instagram',
                        channel_connection_id: 'conn-1',
                        contact: { ig_user_id: 'igsid_456' },
                      },
                error: null,
              }),
            })),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'msg-ig-1', message_id: 'mid.ig.123', conversation_id: 'conv-ig-1' },
              error: null,
            }),
          })),
        })),
      })),
    };

    h.requireRole.mockResolvedValue({
      supabase: mockSupabase,
      accountId: 'acct-1',
      userId: 'user-1',
    });
    h.getDecryptedChannelToken.mockResolvedValue('page_access_token_123');

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response);

    const request = new Request('http://localhost/api/whatsapp/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: 'msg-ig-1', emoji: '❤️' }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    // Verify Meta API call uses sender_action: 'react' and payload: { message_id, reaction }
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recipient: { id: 'igsid_456' },
          sender_action: 'react',
          payload: {
            message_id: 'mid.ig.123',
            reaction: '❤️',
          },
        }),
      }),
    );

    // Verify local DB mirroring
    expect(h.setBusinessReaction).toHaveBeenCalledWith(
      mockSupabase,
      { messageId: 'msg-ig-1', conversationId: 'conv-ig-1' },
      'user-1',
      '❤️',
    );
  });

  it('sends sender_action unreact payload to Meta Graph API when emoji is empty', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  table === 'messages'
                    ? { id: 'msg-ig-1', message_id: 'mid.ig.123', conversation_id: 'conv-ig-1' }
                    : {
                        id: 'conv-ig-1',
                        account_id: 'acct-1',
                        channel: 'instagram',
                        channel_connection_id: 'conn-1',
                        contact: { ig_user_id: 'igsid_456' },
                      },
                error: null,
              }),
            })),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'msg-ig-1', message_id: 'mid.ig.123', conversation_id: 'conv-ig-1' },
              error: null,
            }),
          })),
        })),
      })),
    };

    h.requireRole.mockResolvedValue({
      supabase: mockSupabase,
      accountId: 'acct-1',
      userId: 'user-1',
    });
    h.getDecryptedChannelToken.mockResolvedValue('page_access_token_123');

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response);

    const request = new Request('http://localhost/api/whatsapp/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: 'msg-ig-1', emoji: '' }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    // Verify Meta API call uses sender_action: 'unreact' and payload: { message_id }
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recipient: { id: 'igsid_456' },
          sender_action: 'unreact',
          payload: {
            message_id: 'mid.ig.123',
          },
        }),
      }),
    );

    // Verify local DB removal
    expect(h.removeBusinessReaction).toHaveBeenCalledWith(mockSupabase, 'msg-ig-1');
  });
});
