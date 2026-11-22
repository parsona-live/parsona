import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConversationSummary } from '@/types'
import { loadAiConfig } from '@/lib/ai/config'
import { generateReply } from '@/lib/ai/generate'

export interface SummarizeConversationOptions {
  force?: boolean
}

/**
 * Generate or update an incremental rolling conversation summary.
 * Derived data: original messages remain the authoritative source of truth.
 */
export async function summarizeConversation(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
  options: SummarizeConversationOptions = {},
): Promise<ConversationSummary | null> {
  // 1. Fetch conversation and contact
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('id, contact_id, account_id, channel')
    .eq('id', conversationId)
    .single()

  if (convErr || !conv) return null

  // 2. Fetch existing summary (if any)
  const { data: existingSummary } = await db
    .from('conversation_summaries')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  // 3. Fetch messages since last summary
  const lastMsgId = existingSummary?.last_summarized_message_id

  let msgQuery = db
    .from('messages')
    .select('id, sender_type, content_text, created_at')
    .eq('conversation_id', conversationId)
    .eq('content_type', 'text')
    .order('created_at', { ascending: true })

  const { data: messages } = await msgQuery
  if (!messages || messages.length === 0) return (existingSummary as ConversationSummary) || null

  const latestMessageId = messages[messages.length - 1].id
  if (!options.force && existingSummary && latestMessageId === lastMsgId) {
    // No new messages since last summary
    return existingSummary as ConversationSummary
  }

  // 4. Check AI config
  const aiConfig = await loadAiConfig(db, accountId).catch(() => null)
  if (!aiConfig || !aiConfig.apiKey) {
    return existingSummary as ConversationSummary
  }

  const systemPrompt = `You are a CRM Conversation Summarizer.
Analyze the conversation transcript and output ONLY valid JSON without markdown code fences.

JSON Schema:
{
  "conversation_purpose": string,
  "customer_needs": string,
  "known_facts": string[],
  "decisions": string[],
  "requirements": string[],
  "objections": string[],
  "unresolved_questions": string[],
  "business_promises": string[],
  "current_status": string
}

CRITICAL RULES:
- Explicitly identify any unresolved questions from the customer.
- Explicitly capture promises made by the business/agent (e.g., "Will email quote by 5pm", "Checking warehouse stock").
- Keep bullet points factual and concise.`

  const transcript = messages
    .map((m) => `[${m.created_at}] ${m.sender_type.toUpperCase()}: ${m.content_text}`)
    .join('\n')

  let parsed: any = null
  try {
    const { text } = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: 'user', content: transcript }],
    })
    if (text) {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleanJson)
    }
  } catch (err) {
    console.warn('[summarizeConversation] Error generating summary:', err)
  }

  if (!parsed) return (existingSummary as ConversationSummary) || null

  const summaryData = {
    account_id: accountId,
    contact_id: conv.contact_id,
    conversation_id: conversationId,
    conversation_purpose: parsed.conversation_purpose || null,
    customer_needs: parsed.customer_needs || null,
    known_facts: parsed.known_facts || [],
    decisions: parsed.decisions || [],
    requirements: parsed.requirements || [],
    objections: parsed.objections || [],
    unresolved_questions: parsed.unresolved_questions || [],
    business_promises: parsed.business_promises || [],
    current_status: parsed.current_status || null,
    last_summarized_message_id: latestMessageId,
    last_summarized_sequence: messages.length,
    summary_version: (existingSummary?.summary_version || 0) + 1,
    summarized_at: new Date().toISOString(),
    model_id: aiConfig.model,
  }

  const { data: saved, error: saveErr } = await db
    .from('conversation_summaries')
    .upsert(summaryData, { onConflict: 'conversation_id' })
    .select()
    .single()

  if (saveErr) {
    console.error('[summarizeConversation] Error saving summary:', saveErr)
  }

  return (saved as ConversationSummary) || null
}
