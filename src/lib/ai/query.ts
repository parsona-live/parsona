import type { ChatMessage } from './types'

/**
 * The text to retrieve knowledge against: the most recent customer
 * (`user`) turn in the conversation context. Falls back to the last
 * message of any role, then empty string. Shared by the draft route and
 * the auto-reply bot so both query the knowledge base the same way.
 */
export function latestUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return messages.length > 0 ? messages[messages.length - 1].content : ''
}

/**
 * Context-aware retrieval query: when the user's latest message is very short
 * (e.g. "Book", "Yes", "How much?", "Slot"), look back at the immediate prior
 * context (assistant question or preceding user topic) and synthesize a grounded
 * query for semantic and lexical knowledge retrieval.
 */
export function buildContextualQuery(messages: ChatMessage[]): string {
  const latest = latestUserMessage(messages).trim()
  if (!latest) return ''

  const words = latest.split(/\s+/).filter(Boolean)
  // If the query is already substantive (>= 5 words), use it directly
  if (words.length >= 5 || messages.length <= 1) {
    return latest
  }

  // Look back up to 2 preceding messages to add topic context
  const contextSnippets: string[] = []
  let foundPrior = false
  for (let i = messages.length - 2; i >= 0 && contextSnippets.length < 2; i--) {
    const msg = messages[i]
    if (msg.content && msg.content.trim()) {
      // Clean cross-channel or badge artifacts
      const clean = msg.content.replace(/^\[Via [^\]]+\]\s*/i, '').trim()
      if (clean && !clean.startsWith('⚡ Flow:')) {
        contextSnippets.unshift(clean.slice(0, 120))
        foundPrior = true
      }
    }
  }

  if (foundPrior) {
    return `${contextSnippets.join(' ')} ${latest}`.trim()
  }
  return latest
}
