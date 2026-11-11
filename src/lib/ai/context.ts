import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from './types'
import { aiContextMessageLimit } from './defaults'
import type { ChannelType } from '@/types'

interface DbMessage {
  sender_type: 'customer' | 'agent' | 'bot'
  content_text: string | null
  channel?: ChannelType | null
}

function formatMessageWithChannel(text: string, channel?: ChannelType | null): string {
  const trimmed = text.trim()
  if (!channel || channel === 'whatsapp') return trimmed
  if (channel === 'instagram') return `[Via Instagram DM] ${trimmed}`
  if (channel === 'facebook') return `[Via Facebook Messenger] ${trimmed}`
  return `[Via ${channel}] ${trimmed}`
}

/**
 * Fetch the last N text messages of a conversation (or cross-channel
 * for a unified contact) and map them to the provider-neutral chat shape.
 * Customer messages become `user`; agent and bot messages become `assistant`.
 * Cross-channel messages are prefixed with `[Via Instagram DM]` or `[Via Facebook Messenger]`.
 *
 * Ordered oldest-first (chronological).
 */
export async function buildConversationContext(
  db: SupabaseClient,
  conversationId: string,
  limit: number = aiContextMessageLimit(),
  contactId?: string,
): Promise<ChatMessage[]> {
  let conversationIds = [conversationId]

  // If contactId is provided, pull conversation IDs across all channels
  if (contactId) {
    const { data: convs } = await db
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
    if (convs && convs.length > 0) {
      conversationIds = convs.map((c) => c.id)
    }
  }

  const { data, error } = await db
    .from('messages')
    .select('sender_type, content_text, channel')
    .in('conversation_id', conversationIds)
    .eq('content_type', 'text')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = ((data ?? []) as DbMessage[]).reverse()
  return rows
    .filter((m) => m.content_text && m.content_text.trim())
    .map((m) => ({
      role: m.sender_type === 'customer' ? 'user' : 'assistant',
      content: formatMessageWithChannel(m.content_text!, m.channel),
    }))
}
