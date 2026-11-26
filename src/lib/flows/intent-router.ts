/**
 * Multi-Stage Semantic Intent Router & Flow Arbitration Service (Flow Engine 2.0).
 *
 * Architecture:
 *   Stage 1: Deterministic routing (interactive reply IDs, active run wait-for-input, exact keyword matches) - 0 LLM calls!
 *   Stage 2: Lightweight Semantic Intent matching (Hindi, Hinglish, English, n-grams, intent embeddings/profiles)
 *   Stage 3: AI Classifier fallback (only when ambiguous, multi-intent, or borderline confidence)
 *   Flow Arbitration: Single primary flow selection by priority and confidence, preventing double-firing
 *   Interruption Policy: Preserves active flow vars during off-topic questions
 */

import { generateReply } from '@/lib/ai/generate';
import { loadAiConfig } from '@/lib/ai/config';
import type { AiConfig } from '@/lib/ai/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AiIntentTriggerConfig,
  FlowRow,
  FlowRunRow,
  ParsedInbound,
} from './types';
import { matchesKeywordTrigger, entryTriggerTexts } from './engine';

export interface IntentCandidate {
  flow: FlowRow;
  config: AiIntentTriggerConfig;
  score: number;
  matchedReason: string;
}

export interface RoutingDecision {
  decision: 'trigger' | 'continue_active_flow' | 'interrupted_pause' | 'no_match' | 'clarify' | 'handoff';
  selectedFlow: FlowRow | null;
  confidence: number;
  reasonCode: string;
  stage: 'deterministic' | 'semantic' | 'ai_classifier' | 'arbitration';
  secondaryIntents?: string[];
  arbitrationLog?: {
    candidatesEvaluated: number;
    topCandidates: Array<{ flowId: string; flowName: string; score: number }>;
    interruptionApplied?: string;
  };
}

/**
 * Hindi / Hinglish / English normalizer for conversational matching.
 */
export function normalizeConversationalText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[?!.,;:'"’`~@#$%^&*()_+=\[\]{}|<>\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Common phrase patterns for Hinglish & Hindi intent classification.
 */
const HINGLISH_INTENT_PATTERNS: Record<string, { positive: RegExp[]; negative: RegExp[] }> = {
  greeting: {
    positive: [
      /\b(hi|hello|hey|namaste|hlo|hola|gm|good\s*morning|good\s*evening|good\s*afternoon|salaam|pranam)\b/i,
      /\b(kaise\s*ho|kya\s*hal\s*hai|kem\s*cho|kemon\s*acho)\b/i,
    ],
    negative: [],
  },
  lead: {
    positive: [
      /\b(inquiry|enquiry|interested|demo|want|need|details|information|info|chahiye|jankari)\b/i,
      /\b(connect|contact|call\s*me|call\s*back|reach\s*out|talk\s*to)\b/i,
    ],
    negative: [],
  },
  pricing: {
    positive: [
      /\b(price|pricing|cost|charge|fees?|rate|estimate|quote|budget)\b/i,
      /\b(kitn[ae]|kitne\s*ka|kya\s*rate|kya\s*price|kitna\s*lagega|paisa|paise)\b/i,
      /\b(kharcha|charges\s*kya|how\s*much|what\s*will\s*it\s*cost)\b/i,
    ],
    negative: [
      /\b(already\s*paid|paid\s*already|payment\s*done|paise\s*de\s*diye|payment\s*ho\s*gayi)\b/i,
      /\b(refund|too\s*high|expensive|after\s*payment|receipt)\b/i,
    ],
  },
  booking: {
    positive: [
      /\b(book|booking|schedule|appointment|reserve|reservation|demo|consultation|visit|slot)\b/i,
      /\b(kal\s*aana|milna\s*hai|slot|time\s*slot|book\s*karna|appointment\s*lena)\b/i,
      /\b(visit\s*kar\s*sakte|schedule\s*a\s*demo|meeting|call\s*schedule)\b/i,
    ],
    negative: [
      /\b(already\s*booked|booked\s*already|cancel|reschedule|already\s*have\s*an\s*appointment|have\s*(an?)?\s*appointment)\b/i,
    ],
  },
  support: {
    positive: [
      /\b(help|support|agent|human|issue|problem|not\s*working|complaint|talk\s*to\s*someone)\b/i,
      /\b(baat\s*karni\s*hai|madad|pareshani|shikayat|representative)\b/i,
    ],
    negative: [],
  },
  sales: {
    positive: [
      /\b(buy|purchase|interested|order|catalog|product|service|details|info|kareedna|lena\s*hai)\b/i,
      /\b(chahiye|details\s*bhejo|catalogue|features|kya\s*hai)\b/i,
    ],
    negative: [],
  },
};

const SHORT_INTENT_WORDS = new Set(['hi', 'gm', 'ge', 'ga', 'ok', 'yo', 'dm', 'hey']);

function stemWord(word: string): string {
  if (word.length <= 3) return word.toLowerCase();
  return word
    .replace(/(ing|tion|ment|ed|es|s)$/i, '')
    .toLowerCase();
}

function matchesStemOrPrefix(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = stemWord(a);
  const sb = stemWord(b);
  if (sa.length >= 3 && sb.length >= 3 && sa === sb) return true;
  if (a.length >= 4 && b.startsWith(a)) return true;
  if (b.length >= 4 && a.startsWith(b)) return true;
  return false;
}

const COMMON_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours',
  'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'to', 'from', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'of', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'should', 'now', 'want', 'wanted', 'need', 'needs',
  'would', 'could', 'please', 'sir', 'madam', 'bhai', 'ji', 'hai', 'hain',
  'ho', 'kya', 'karo', 'karna', 'chahiye', 'mujhe', 'hum', 'aap', 'ka', 'ke', 'ki'
]);

/**
 * Separates positive intent description from negative/exclusion clauses such as
 * "Do not trigger for booking, location, fees...".
 */
function splitIntentDescription(desc: string): { positive: string; excluded: string } {
  if (!desc) return { positive: '', excluded: '' };
  const exclusionMatch = desc.match(
    /(?:^|[.;\n])\s*(?:do\s+not\s+trigger|don'?t\s+trigger|never\s+trigger|avoid\s+triggering|exclude|not\s+for)\b[\s\S]*/i,
  );
  if (!exclusionMatch || exclusionMatch.index === undefined) {
    return { positive: desc, excluded: '' };
  }
  return {
    positive: desc.slice(0, exclusionMatch.index).trim(),
    excluded: exclusionMatch[0].trim(),
  };
}

/**
 * Whole-word / whole-phrase check using Unicode boundaries so short words
 * like "hi" do not match inside unrelated words like "chahiye" or "this".
 */
function containsWholePhrase(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
  return regex.test(haystack);
}

/**
 * Computes semantic similarity between text and configured intent.
 * Evaluates intent description, positive examples, and negative examples.
 */
export function scoreSemanticIntent(
  text: string,
  config: AiIntentTriggerConfig,
): { score: number; reason: string } {
  const norm = normalizeConversationalText(text);
  if (!norm) return { score: 0, reason: 'empty_text' };

  const words = new Set(norm.split(' ').filter(Boolean));
  const msgNonStopWords = norm.split(' ').filter((w) => w.length > 1 && !COMMON_STOPWORDS.has(w));

  // 1. Check explicitly configured Negative Examples first
  if (config.negative_examples && config.negative_examples.length > 0) {
    for (const neg of config.negative_examples) {
      const normNeg = normalizeConversationalText(neg);
      if (
        normNeg &&
        (norm === normNeg ||
          containsWholePhrase(norm, normNeg) ||
          (msgNonStopWords.length > 0 && containsWholePhrase(normNeg, norm)))
      ) {
        return { score: 0.05, reason: 'matched_negative_example' };
      }
    }
  }

  // 2. Check explicitly configured Positive Examples (exact & phrase inclusion)
  if (config.positive_examples && config.positive_examples.length > 0) {
    let maxExampleScore = 0;
    let bestReason = '';

    for (const ex of config.positive_examples) {
      const normEx = normalizeConversationalText(ex);
      if (!normEx) continue;

      if (norm === normEx) {
        return { score: 0.99, reason: 'exact_positive_example_match' };
      }

      // Phrase inclusion: customer message contains the example phrase as a whole phrase
      if (containsWholePhrase(norm, normEx)) {
        return { score: 0.95, reason: `contains_positive_example:${normEx}` };
      }

      // Reverse inclusion: example contains message as a whole phrase (for short queries like "pricing", "demo", "book")
      // Require either a non-stopword token or explicit short intent token so "hi" never matches "chahiye",
      // and stopwords like "for" or "hai" never match multi-word examples.
      const hasMeaningfulToken = msgNonStopWords.length > 0 || SHORT_INTENT_WORDS.has(norm);
      if (norm.length >= 2 && hasMeaningfulToken && containsWholePhrase(normEx, norm)) {
        if (0.92 > maxExampleScore) {
          maxExampleScore = 0.92;
          bestReason = `example_contains_message:${normEx}`;
        }
      }

      // Significant word intersection (ignoring stopwords) with stem matching
      const exSigWords = normEx.split(' ').filter((w) => w.length > 1 && !COMMON_STOPWORDS.has(w));
      const msgSigWords = norm.split(' ').filter((w) => (w.length > 1 || SHORT_INTENT_WORDS.has(w)) && !COMMON_STOPWORDS.has(w));
      if (exSigWords.length > 0 && msgSigWords.length > 0) {
        let matchCount = 0;
        for (const ew of exSigWords) {
          if (msgSigWords.some((mw) => matchesStemOrPrefix(mw, ew))) {
            matchCount++;
          }
        }
        const ratio = matchCount / exSigWords.length;
        if (ratio >= 0.5) {
          const score = Math.min(0.95, 0.75 + ratio * 0.20);
          if (score > maxExampleScore) {
            maxExampleScore = score;
            bestReason = `significant_words_overlap:${normEx}`;
          }
        }
      }
    }

    if (maxExampleScore >= 0.70) {
      return { score: maxExampleScore, reason: bestReason };
    }
  }

  // 2b. Check configured keywords on ai_intent flows
  const keywords = (config as unknown as { keywords?: string[] }).keywords;
  if (Array.isArray(keywords) && keywords.length > 0) {
    let maxKwScore = 0;
    let kwReason = '';
    for (const rawKw of keywords) {
      const normKw = normalizeConversationalText(rawKw);
      if (!normKw) continue;
      if (norm === normKw) {
        return { score: 0.96, reason: `exact_keyword_match:${normKw}` };
      }
      if (containsWholePhrase(norm, normKw) && 0.93 > maxKwScore) {
        maxKwScore = 0.93;
        kwReason = `contains_keyword:${normKw}`;
      }
    }
    if (maxKwScore > 0) {
      return { score: maxKwScore, reason: kwReason };
    }
  }

  // Separate positive description from "Do not trigger for ..." exclusion clauses
  const { positive: posDesc, excluded: exclDesc } = splitIntentDescription(config.intent_description || '');

  // 3. Check built-in Hinglish & English patterns for known intents (positive description only!)
  const intentKey = `${config.intent_name || ''} ${posDesc}`.toLowerCase();
  for (const [key, patterns] of Object.entries(HINGLISH_INTENT_PATTERNS)) {
    if (intentKey.includes(key)) {
      // Check negative patterns first: if matched, heavily penalize or zero out
      for (const neg of patterns.negative) {
        if (neg.test(norm)) {
          return { score: 0.1, reason: `matched_negative_pattern:${neg.source}` };
        }
      }

      // Check positive patterns
      for (const pos of patterns.positive) {
        if (pos.test(norm)) {
          return { score: 0.92, reason: `matched_positive_pattern:${pos.source}` };
        }
      }
    }
  }

  // 4. Token overlap with positive intent description & name (with stemming & prefixes)
  const descNorm = normalizeConversationalText(`${config.intent_name || ''} ${posDesc}`);
  const descSigWords = descNorm.split(' ').filter((w) => (w.length > 2 || SHORT_INTENT_WORDS.has(w)) && !COMMON_STOPWORDS.has(w));

  const msgSigWords = norm.split(' ').filter((w) => (w.length > 2 || SHORT_INTENT_WORDS.has(w)) && !COMMON_STOPWORDS.has(w));
  let descHits = 0;
  for (const w of msgSigWords) {
    if (descSigWords.some((dw) => matchesStemOrPrefix(w, dw))) {
      descHits++;
    }
  }

  // Penalize if the message hits an exclusion clause (e.g. "Do not trigger for booking, location")
  // without hitting any positive intent terms.
  if (exclDesc && descHits === 0 && msgSigWords.length > 0) {
    const exclNorm = normalizeConversationalText(exclDesc);
    const exclWords = exclNorm.split(' ').filter((w) => w.length > 2 && !COMMON_STOPWORDS.has(w));
    if (msgSigWords.some((w) => exclWords.some((ew) => matchesStemOrPrefix(w, ew)))) {
      return { score: 0.12, reason: 'matched_description_exclusion' };
    }
  }

  if (descSigWords.length > 0 && msgSigWords.length > 0) {
    const overlapRatio = descHits / Math.min(msgSigWords.length, 3);
    if (overlapRatio >= 0.4) {
      const score = Math.min(0.89, 0.55 + overlapRatio * 0.34);
      return {
        score,
        reason: 'intent_description_significant_overlap',
      };
    }
  }

  return {
    score: 0.1,
    reason: 'low_match',
  };
}



/**
 * Stage 3 AI Classifier Fallback for ambiguous or multi-intent messages.
 */
async function classifyWithAiFallback(
  aiConfig: AiConfig,
  text: string,
  candidates: IntentCandidate[],
  activeRun: FlowRunRow | null,
): Promise<{
  decision: 'trigger' | 'continue_active_flow' | 'no_match' | 'clarify';
  selectedFlowId: string | null;
  confidence: number;
  reasonCode: string;
}> {
  const eligible = candidates.map((c) => ({
    flow_id: c.flow.id,
    flow_name: c.flow.name,
    intent_name: c.config.intent_name,
    description: c.config.intent_description,
  }));

  const systemPrompt = `You are an Intent Classification Router in a WhatsApp CRM platform.
Your task is to classify incoming customer messages against eligible workflow intents.

ELIGIBLE WORKFLOWS:
${JSON.stringify(eligible, null, 2)}

ACTIVE FLOW STATUS:
${activeRun ? `Contact currently has an active flow (id: ${activeRun.flow_id}, current_node: ${activeRun.current_node_key})` : 'None'}

RULES:
1. Output valid JSON only:
{
  "decision": "trigger" | "continue_active_flow" | "no_match" | "clarify",
  "selected_flow_id": "<flow_id_or_null>",
  "confidence": <number 0.0 to 1.0>,
  "reason_code": "<short_reason>"
}
2. "selected_flow_id" MUST match one of the eligible flow IDs or null. Never invent flow IDs.
3. If customer is responding to an ongoing question from an active flow, prefer "continue_active_flow".
4. If customer explicitly requests a different service or business action, select "trigger" with that flow_id.
5. Do NOT trigger a flow merely because a word is mentioned out of context (e.g. "I already paid" is NOT pricing inquiry).`;

  try {
    const response = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    const parsedMatch = response.text.match(/\{[\s\S]*\}/);
    if (parsedMatch) {
      const parsed = JSON.parse(parsedMatch[0]);
      const validId = candidates.some((c) => c.flow.id === parsed.selected_flow_id)
        ? parsed.selected_flow_id
        : null;

      return {
        decision: parsed.decision || 'no_match',
        selectedFlowId: validId,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.75,
        reasonCode: parsed.reason_code || 'ai_classified',
      };
    }
  } catch (err) {
    console.warn('[intent-router] AI classifier fallback error:', err);
  }

  return {
    decision: 'no_match',
    selectedFlowId: null,
    confidence: 0,
    reasonCode: 'classifier_error',
  };
}

/**
 * Main Intent Router and Flow Arbitration Entry Point.
 */
export async function routeInboundIntent(args: {
  db: SupabaseClient;
  accountId: string;
  contactId: string;
  conversationId: string;
  message: ParsedInbound;
  channel?: string;
  isFirstInbound: boolean;
  activeRun: FlowRunRow | null;
  flows: FlowRow[];
}): Promise<RoutingDecision> {
  const { db, accountId, message, channel, activeRun, flows } = args;

  // ============================================================
  // STAGE 1 — Deterministic Routing (0 LLM Calls)
  // ============================================================

  // 1.1 Interactive button/list reply
  if (message.kind === 'interactive_reply') {
    // If contact has active run, active run handles it
    if (activeRun) {
      return {
        decision: 'continue_active_flow',
        selectedFlow: null,
        confidence: 1.0,
        reasonCode: 'active_run_interactive_reply',
        stage: 'deterministic',
      };
    }
  }

  // 1.2 Deterministic Keyword Triggers & First Inbound Triggers
  const triggerTexts = entryTriggerTexts(message);
  for (const flow of flows) {
    // Channel filter
    const flowChannels = (flow as unknown as { channels?: string[] }).channels;
    if (channel && flowChannels && flowChannels.length > 0 && !flowChannels.includes(channel)) {
      continue;
    }

    if (flow.trigger_type === 'keyword') {
      const cfg = flow.trigger_config as any;
      if (triggerTexts.some((t) => matchesKeywordTrigger(t, cfg))) {
        return {
          decision: 'trigger',
          selectedFlow: flow,
          confidence: 1.0,
          reasonCode: 'exact_keyword_trigger',
          stage: 'deterministic',
        };
      }
    } else if (flow.trigger_type === 'first_inbound_message' && args.isFirstInbound) {
      return {
        decision: 'trigger',
        selectedFlow: flow,
        confidence: 1.0,
        reasonCode: 'first_inbound_message_trigger',
        stage: 'deterministic',
      };
    }
  }

  // ============================================================
  // STAGE 2 — Semantic Intent Matching
  // ============================================================
  if (message.kind !== 'text' || !message.text?.trim()) {
    return {
      decision: activeRun ? 'continue_active_flow' : 'no_match',
      selectedFlow: null,
      confidence: 0,
      reasonCode: 'non_text_inbound',
      stage: 'deterministic',
    };
  }

  const inboundText = message.text.trim();

  // Filter flows configured with ai_intent trigger
  const aiIntentFlows = flows.filter((f) => {
    const isAi =
      f.trigger_type === ('ai_intent' as any) ||
      (f.trigger_config as any)?.starting_step === 'ai_intent' ||
      Boolean((f.trigger_config as any)?.intent_name);
    if (!isAi) return false;
    const flowChannels = (f as unknown as { channels?: string[] }).channels;
    if (channel && flowChannels && flowChannels.length > 0 && !flowChannels.includes(channel)) {
      return false;
    }
    return true;
  });

  if (aiIntentFlows.length === 0) {
    // No AI intent flows configured
    return {
      decision: activeRun ? 'continue_active_flow' : 'no_match',
      selectedFlow: null,
      confidence: 0,
      reasonCode: activeRun ? 'active_flow_continuation' : 'no_eligible_ai_intent_flows',
      stage: 'deterministic',
    };
  }

  // Score all candidate flows
  const candidates: IntentCandidate[] = [];
  for (const flow of aiIntentFlows) {
    const cfg = (flow.trigger_config || {}) as unknown as AiIntentTriggerConfig;
    const { score, reason } = scoreSemanticIntent(inboundText, cfg);
    candidates.push({
      flow,
      config: cfg,
      score,
      matchedReason: reason,
    });
  }

  // Sort candidates by score descending, then by configured flow priority only on near-exact ties
  candidates.sort((a, b) => {
    const priorityA = a.config.priority ?? (a.flow as any).priority ?? 0;
    const priorityB = b.config.priority ?? (b.flow as any).priority ?? 0;
    if (Math.abs(b.score - a.score) < 0.02) {
      return priorityB - priorityA;
    }
    return b.score - a.score;
  });

  const top = candidates[0];
  const second = candidates[1];
  const threshold = top?.config.confidence_threshold ?? (candidates.length === 1 ? 0.55 : 0.65);

  // Check if we have a decisive semantic match (clear margin over runner-up)
  const isDecisive =
    top &&
    (top.score >= threshold || (candidates.length === 1 && top.score >= 0.50)) &&
    (!second || top.score - second.score >= 0.08);

  if (isDecisive) {
    // ============================================================
    // FLOW ARBITRATION & INTERRUPTION HANDLING
    // ============================================================
    if (activeRun) {
      // If customer run is currently paused by agent, a decisive intent triggers fresh!
      if (activeRun.status === 'paused_by_agent') {
        return {
          decision: 'trigger',
          selectedFlow: top.flow,
          confidence: top.score,
          reasonCode: 'paused_run_resumed_by_intent',
          stage: 'arbitration',
        };
      }

      // If customer is in the SAME flow, only re-trigger on explicit high-confidence intent (>= 0.92)
      if (activeRun.flow_id === top.flow.id) {
        if (top.score >= 0.92) {
          return {
            decision: 'trigger',
            selectedFlow: top.flow,
            confidence: top.score,
            reasonCode: 'same_flow_retriggered_by_intent',
            stage: 'arbitration',
          };
        }
        return {
          decision: 'continue_active_flow',
          selectedFlow: null,
          confidence: top.score,
          reasonCode: 'same_flow_continuation',
          stage: 'arbitration',
        };
      }

      // If customer matched a higher priority flow or interruption is allowed
      const interruptionPolicy = top.config.interruption_policy || 'pause';
      if (interruptionPolicy === 'pause') {
        return {
          decision: 'interrupted_pause',
          selectedFlow: top.flow,
          confidence: top.score,
          reasonCode: 'interrupted_higher_priority_intent',
          stage: 'arbitration',
          arbitrationLog: {
            candidatesEvaluated: candidates.length,
            topCandidates: candidates.slice(0, 3).map((c) => ({
              flowId: c.flow.id,
              flowName: c.flow.name,
              score: c.score,
            })),
            interruptionApplied: 'paused_previous_run',
          },
        };
      } else if (interruptionPolicy === 'continue') {
        return {
          decision: 'continue_active_flow',
          selectedFlow: null,
          confidence: top.score,
          reasonCode: 'active_flow_interruption_disallowed',
          stage: 'arbitration',
        };
      }
    }

    return {
      decision: 'trigger',
      selectedFlow: top.flow,
      confidence: top.score,
      reasonCode: top.matchedReason,
      stage: 'semantic',
      arbitrationLog: {
        candidatesEvaluated: candidates.length,
        topCandidates: candidates.slice(0, 3).map((c) => ({
          flowId: c.flow.id,
          flowName: c.flow.name,
          score: c.score,
        })),
      },
    };
  }

  // ============================================================
  // STAGE 3 — AI Classifier Fallback (When Ambiguous or Low Confidence)
  // ============================================================
  // If heuristic matching didn't produce a decisive match, consult the AI Classifier
  if (!isDecisive && candidates.length > 0) {
    try {
      const aiConfig = await loadAiConfig(db, accountId);
      if (aiConfig?.apiKey) {
        const classified = await classifyWithAiFallback(aiConfig, inboundText, candidates, activeRun);
        if (classified.decision === 'trigger' && classified.selectedFlowId) {
          const matchedCandidate = candidates.find(
            (c) =>
              c.flow.id === classified.selectedFlowId ||
              c.config.intent_name === classified.selectedFlowId ||
              c.flow.name === classified.selectedFlowId,
          );
          if (matchedCandidate) {
            return {
              decision: activeRun ? 'interrupted_pause' : 'trigger',
              selectedFlow: matchedCandidate.flow,
              confidence: classified.confidence,
              reasonCode: classified.reasonCode,
              stage: 'ai_classifier',
            };
          }
        } else if (classified.decision === 'continue_active_flow' && activeRun) {
          return {
            decision: 'continue_active_flow',
            selectedFlow: null,
            confidence: classified.confidence,
            reasonCode: 'ai_classifier_preferred_continuation',
            stage: 'ai_classifier',
          };
        }
      }
    } catch (err) {
      console.warn('[intent-router] Fallback classifier error:', err);
    }

    // Priority tiebreak fallback: if Stage 3 AI Classifier was unavailable/unconfigured
    // and top candidates both cleared threshold with a strict priority winner, pick top.flow.
    const topPriority = top?.config.priority ?? (top?.flow as any)?.priority ?? 0;
    const secondPriority = second?.config.priority ?? (second?.flow as any)?.priority ?? 0;
    if (top && top.score >= threshold && (!second || topPriority > secondPriority)) {
      return {
        decision: activeRun ? 'interrupted_pause' : 'trigger',
        selectedFlow: top.flow,
        confidence: top.score,
        reasonCode: 'priority_tiebreak_fallback',
        stage: 'arbitration',
      };
    }
  }

  // Default: if active run exists, continue it; otherwise no match
  return {
    decision: activeRun ? 'continue_active_flow' : 'no_match',
    selectedFlow: null,
    confidence: top?.score ?? 0,
    reasonCode: activeRun ? 'active_flow_continuation' : 'no_matching_intent',
    stage: 'arbitration',
  };
}
