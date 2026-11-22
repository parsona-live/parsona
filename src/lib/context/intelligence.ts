import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BuyingSignal,
  ContactIntelligenceSnapshot,
  CustomerObjection,
  CustomerSentiment,
  IntentCategory,
  ResponseBehavior,
} from '@/types'
import { loadAiConfig } from '@/lib/ai/config'
import { generateReply } from '@/lib/ai/generate'
import { upsertCustomerMemory } from './memory'
import { queryContactEvents } from './events'

export interface EvaluateIntelligenceOptions {
  forceRefresh?: boolean
  modelId?: string
}

interface RawIntelligenceJson {
  intent_category?: string
  intent_score?: number
  intent_summary?: string
  signals?: Array<{ signal: string; evidence_message_ids?: string[]; confidence?: number }>
  objections?: Array<{ type: string; description: string; status?: string; evidence_message_ids?: string[] }>
  sentiment?: string
  next_best_action?: string
  confidence?: number
  extracted_memories?: Array<{ key: string; value: string; value_type?: string }>
}

/**
 * Evaluate customer intelligence with behavioral analysis, evidence tracking,
 * and structured LLM extraction.
 */
export async function evaluateCustomerIntelligence(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  options: EvaluateIntelligenceOptions = {},
): Promise<ContactIntelligenceSnapshot | null> {
  const force = options.forceRefresh ?? false

  // 1. Fetch contact record
  const { data: contact, error: cErr } = await db
    .from('contacts')
    .select('*, contact_tags(tags(name))')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single()

  if (cErr || !contact) {
    console.warn(`[evaluateCustomerIntelligence] Contact ${contactId} not found`)
    return null
  }

  // 2. Check cache: if updated within 1 hour and not forced, return latest snapshot
  if (!force && contact.intelligence_updated_at) {
    const ageMs = Date.now() - new Date(contact.intelligence_updated_at).getTime()
    if (ageMs < 60 * 60 * 1000) {
      const { data: latestSnap } = await db
        .from('contact_intelligence_snapshots')
        .select('*')
        .eq('account_id', accountId)
        .eq('contact_id', contactId)
        .order('evaluated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestSnap) return latestSnap as ContactIntelligenceSnapshot
    }
  }

  // 3. Fetch recent messages across all connected channels for this contact
  const rootId = contact.linked_contact_id || contact.id
  const { data: linkedContacts } = await db
    .from('contacts')
    .select('id')
    .or(`id.eq.${rootId},linked_contact_id.eq.${rootId}`)

  const allContactIds = linkedContacts && linkedContacts.length > 0 ? linkedContacts.map((c) => c.id) : [contactId]

  const { data: convs } = await db
    .from('conversations')
    .select('id, channel')
    .in('contact_id', allContactIds)

  const convIds = (convs || []).map((c) => c.id)

  let recentMessages: Array<{
    id: string
    sender_type: string
    content_text: string | null
    channel?: string | null
    created_at: string
  }> = []

  if (convIds.length > 0) {
    const { data: msgRows } = await db
      .from('messages')
      .select('id, sender_type, content_text, channel, created_at')
      .in('conversation_id', convIds)
      .eq('content_type', 'text')
      .order('created_at', { ascending: false })
      .limit(25)

    if (msgRows) {
      recentMessages = msgRows.reverse()
    }
  }

  // 4. Calculate deterministic behavioral reply metrics
  const responseBehavior = calculateResponseBehavior(recentMessages)

  // 5. Query recent deterministic business events (e.g. bookings, quotes, payments)
  const recentEvents = await queryContactEvents(db, accountId, contactId, { limit: 5 })

  // 6. Check if AI config is available
  const aiConfig = await loadAiConfig(db, accountId).catch(() => null)
  if (!aiConfig || !aiConfig.apiKey) {
    // Fallback: rule-based intelligence when no AI key is configured
    return await persistFallbackIntelligence(db, accountId, contactId, contact, responseBehavior)
  }

  // 7. Assemble LLM prompt for structured intelligence extraction
  const systemPrompt = `You are a Customer Intelligence & Sales Analyst for a multi-channel business CRM.
Analyze the customer's conversation history, business events, and communication behavior.
You must output ONLY valid, parseable JSON with NO markdown code fences, NO thoughts, and NO extra text.

JSON Schema:
{
  "intent_category": "new_inquiry" | "information_seeking" | "purchase_evaluation" | "ready_to_convert" | "customer_active" | "support_needed" | "inactive" | "unknown",
  "intent_score": number (0-100, based on buying signals and readiness),
  "intent_summary": string (1-2 sentences summarizing what the customer wants, their goals, and their situation),
  "signals": [
    { "signal": string, "evidence_message_ids": string[], "confidence": number }
  ],
  "objections": [
    { "type": string, "description": string, "status": "open" | "addressed" | "resolved", "evidence_message_ids": string[] }
  ],
  "sentiment": "positive" | "neutral" | "skeptical" | "frustrated" | "interested",
  "next_best_action": string (Specific recommended action for the business, e.g., "Send quotation for solar package", "Confirm Saturday appointment", "Follow up on pricing question"),
  "confidence": number (0.0 to 1.0),
  "extracted_memories": [
    { "key": string, "value": string, "value_type": "string" | "number" | "boolean" | "date" }
  ]
}

CRITICAL RULES:
- Ground all buying signals and objections strictly in actual customer statements.
- If the customer has not expressed buying intent, set intent_category to "information_seeking" or "unknown" and intent_score accordingly.
- For extracted_memories, extract only durable facts (e.g. budget, preferred_time, requirements, location, constraints). Never extract transient greetings.`

  const conversationTranscript = recentMessages
    .map((m) => `[${m.created_at}] (${m.channel || 'chat'}) [ID:${m.id}] ${m.sender_type.toUpperCase()}: ${m.content_text}`)
    .join('\n')

  const eventsSummary = recentEvents
    .map((e) => `- [${e.occurred_at}] Event: ${e.event_type} (Source: ${e.source})`)
    .join('\n')

  const userPrompt = `Customer: ${contact.name || 'Unknown'} (${contact.phone || 'No phone'})
Last Business Action on record: ${contact.last_business_action || 'None'}

Recent Business Events:
${eventsSummary || 'None'}

Recent Conversation History:
${conversationTranscript || 'No recent messages'}`

  let parsed: RawIntelligenceJson | null = null
  try {
    const { text } = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (text) {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleanJson)
    }
  } catch (err) {
    console.warn('[evaluateCustomerIntelligence] LLM extraction error, using deterministic fallback:', err)
  }

  // 8. Sanitize and validate extracted intelligence
  const intentCategory: IntentCategory = validateIntentCategory(parsed?.intent_category)
  const intentScore = typeof parsed?.intent_score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.intent_score))) : null
  const intentSummary = parsed?.intent_summary?.trim() || 'Customer has initiated contact and is reviewing available offerings.'
  const sentiment: CustomerSentiment = validateSentiment(parsed?.sentiment)
  const nextBestAction = parsed?.next_best_action?.trim() || 'Follow up with customer regarding their inquiry'
  const signals: BuyingSignal[] = (parsed?.signals || []).map((s) => ({
    signal: s.signal,
    evidence_message_ids: s.evidence_message_ids || [],
    confidence: s.confidence || 0.85,
    observed_at: new Date().toISOString(),
  }))
  const objections: CustomerObjection[] = (parsed?.objections || []).map((o) => ({
    type: o.type,
    description: o.description,
    status: (o.status as any) || 'open',
    evidence_message_ids: o.evidence_message_ids || [],
    first_observed_at: new Date().toISOString(),
  }))

  // 9. Persist newly extracted memories into Customer Memory Engine with provenance
  if (parsed?.extracted_memories && Array.isArray(parsed.extracted_memories)) {
    for (const mem of parsed.extracted_memories) {
      if (mem.key && mem.value) {
        await upsertCustomerMemory(db, {
          accountId,
          contactId,
          memoryKey: mem.key,
          memoryValue: String(mem.value),
          valueType: (mem.value_type as any) || 'string',
          sourceType: 'ai_extracted',
          confidence: 0.85,
        }).catch(() => null)
      }
    }
  }

  // 10. Persist versioned snapshot into contact_intelligence_snapshots
  const { data: snapshotRow, error: snapErr } = await db
    .from('contact_intelligence_snapshots')
    .insert({
      account_id: accountId,
      contact_id: contactId,
      intent_category: intentCategory,
      intent_score: intentScore,
      intent_summary: intentSummary,
      signals,
      objections,
      sentiment,
      response_behavior: responseBehavior,
      next_best_action: nextBestAction,
      confidence: parsed?.confidence || 0.85,
      source_window: { messageCount: recentMessages.length, eventsCount: recentEvents.length },
      evaluated_at: new Date().toISOString(),
      model_id: aiConfig.model,
      prompt_version: 'v1.0',
    })
    .select()
    .single()

  if (snapErr) {
    console.error('[evaluateCustomerIntelligence] Error saving snapshot:', snapErr)
  }

  // 11. Update low-latency cache columns on contacts table
  await db
    .from('contacts')
    .update({
      intent_category: intentCategory,
      intent_score: intentScore,
      intent_summary: intentSummary,
      next_best_action: nextBestAction,
      sentiment,
      intelligence_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('account_id', accountId)

  return (snapshotRow as ContactIntelligenceSnapshot) || null
}

function calculateResponseBehavior(
  messages: Array<{ sender_type: string; channel?: string | null; created_at: string }>,
): ResponseBehavior {
  const inbounds = messages.filter((m) => m.sender_type === 'customer')
  const outbounds = messages.filter((m) => m.sender_type === 'agent' || m.sender_type === 'bot')

  let totalDiffMs = 0
  let diffCount = 0

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    if ((prev.sender_type === 'agent' || prev.sender_type === 'bot') && curr.sender_type === 'customer') {
      const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        totalDiffMs += diff
        diffCount++
      }
    }
  }

  const avgMinutes = diffCount > 0 ? Math.round(totalDiffMs / diffCount / (60 * 1000)) : undefined
  let responsiveness: 'fast' | 'moderate' | 'slow' = 'moderate'
  if (avgMinutes !== undefined) {
    if (avgMinutes <= 5) responsiveness = 'fast'
    else if (avgMinutes > 30) responsiveness = 'slow'
  }

  // Find preferred channel
  const channelCounts: Record<string, number> = {}
  for (const m of inbounds) {
    const ch = m.channel || 'whatsapp'
    channelCounts[ch] = (channelCounts[ch] || 0) + 1
  }
  let preferredChannel: any = undefined
  let maxCount = 0
  for (const [ch, cnt] of Object.entries(channelCounts)) {
    if (cnt > maxCount) {
      maxCount = cnt
      preferredChannel = ch
    }
  }

  return {
    responsiveness,
    avg_response_minutes: avgMinutes,
    preferred_channel: preferredChannel,
    inbound_count: inbounds.length,
    outbound_count: outbounds.length,
  }
}

async function persistFallbackIntelligence(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
  contact: any,
  responseBehavior: ResponseBehavior,
): Promise<ContactIntelligenceSnapshot> {
  const intentCategory: IntentCategory = contact.intent_category || 'information_seeking'
  const intentSummary = contact.intent_summary || 'Customer engaged across communication channels.'
  const nextBestAction = contact.next_best_action || 'Follow up with customer regarding recent messages.'

  const { data } = await db
    .from('contact_intelligence_snapshots')
    .insert({
      account_id: accountId,
      contact_id: contactId,
      intent_category: intentCategory,
      intent_score: contact.intent_score || 50,
      intent_summary: intentSummary,
      signals: [],
      objections: [],
      sentiment: contact.sentiment || 'neutral',
      response_behavior: responseBehavior,
      next_best_action: nextBestAction,
      confidence: 0.7,
      source_window: {},
      evaluated_at: new Date().toISOString(),
    })
    .select()
    .single()

  await db
    .from('contacts')
    .update({
      intent_category: intentCategory,
      intent_summary: intentSummary,
      next_best_action: nextBestAction,
      intelligence_updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('account_id', accountId)

  return data as ContactIntelligenceSnapshot
}

function validateIntentCategory(cat?: string): IntentCategory {
  const valid: IntentCategory[] = [
    'new_inquiry',
    'information_seeking',
    'purchase_evaluation',
    'ready_to_convert',
    'customer_active',
    'support_needed',
    'inactive',
    'unknown',
  ]
  if (cat && valid.includes(cat as IntentCategory)) {
    return cat as IntentCategory
  }
  return 'information_seeking'
}

function validateSentiment(s?: string): CustomerSentiment {
  const valid: CustomerSentiment[] = ['positive', 'neutral', 'skeptical', 'frustrated', 'interested']
  if (s && valid.includes(s as CustomerSentiment)) {
    return s as CustomerSentiment
  }
  return 'neutral'
}
