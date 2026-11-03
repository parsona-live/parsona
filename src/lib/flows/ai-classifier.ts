/**
 * Server-side AI-driven intent classification and entity extraction for WhatsApp flows.
 *
 * Evaluates whether an incoming customer message:
 * 1. "answer" — Answers the current prompt with clean extracted value (e.g. "My name is Yash Tupkar" -> "Yash Tupkar")
 * 2. "interruption" — Asks an unrelated question or requests a different action (e.g. "I want to check my booking status")
 * 3. "resume" — Explicitly or implicitly asks to resume a paused flow ("resume", "continue", "aage badho")
 * 4. "cancel" — Requests to cancel/stop the flow ("cancel", "stop", "band karo")
 *
 * Works across any language, script, or dialect (English, Hindi, Hinglish, Spanish, etc.).
 */

import { generateReply } from "@/lib/ai/generate";
import {
  fastClassifyHeuristic,
  detectSimpleLanguage,
  type AIClassificationResult,
  type ClassifyInputArgs,
} from "./ai-classifier-shared";

export * from "./ai-classifier-shared";

/**
 * Classify user reply and extract clean entity using AI when conversational.
 */
export async function classifyInputOrInterruption(
  args: ClassifyInputArgs,
): Promise<AIClassificationResult> {
  const { text, promptText = "", varKey = "", validation = "any", aiConfig } = args;

  // 1. Check fast-path heuristics first
  const fast = fastClassifyHeuristic(text, promptText, varKey, validation);
  if (fast) return fast;

  // 2. If AI config is available, call the LLM for deep natural-language classification
  if (aiConfig && aiConfig.isActive) {
    try {
      const systemPrompt = `You are a conversational intent classifier and entity extractor for a WhatsApp automated assistant.
A customer was presented with the following prompt:
"${promptText || "Please provide the requested information."}"
The system expects: variable "${varKey || "input"}" (validation: ${validation}).

The customer sent this reply:
"${text}"

Your task:
1. Determine the customer's intent:
   - "answer": The customer is providing the requested information, even if embedded in conversational prose (e.g., "My name is Yash", "You can reach me at test@example.com").
   - "interruption": The customer is asking an unrelated question, requesting a different action (e.g., "I want to check my booking status", "What are your hours?", "Can I talk to human?"), or changing the subject.
   - "resume": The customer wants to continue/resume a paused conversation.
   - "cancel": The customer wants to cancel, stop, or exit.
2. If intent is "answer", extract the clean, normalized entity into "extracted_value" (e.g., "Yash Tupkar", "test@example.com", "5"). Do not include conversational filler like "My name is" or "Please".
3. If intent is not "answer", set "extracted_value" to null.
4. Detect the ISO 639-1 language code of the customer's message (e.g., "en", "hi", "es", "mr").

Respond strictly with a valid JSON object matching this schema:
{
  "intent": "answer" | "interruption" | "resume" | "cancel",
  "extracted_value": string | null,
  "detected_language": string,
  "confidence": number,
  "reasoning": string
}`;

      const res = await generateReply({
        config: aiConfig,
        systemPrompt,
        messages: [{ role: "user", content: text }],
      });

      if (res.text) {
        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as AIClassificationResult;
          if (parsed && (parsed.intent === "answer" || parsed.intent === "interruption" || parsed.intent === "resume" || parsed.intent === "cancel")) {
            return {
              intent: parsed.intent,
              extracted_value: parsed.extracted_value ?? null,
              detected_language: parsed.detected_language || "en",
              confidence: parsed.confidence ?? 0.9,
              reasoning: parsed.reasoning,
            };
          }
        }
      }
    } catch (err) {
      console.warn("[ai-classifier] LLM classification error, falling back to heuristic:", err);
    }
  }

  // 3. Fallback heuristic if LLM is unavailable or failed
  const isQuestion = text.includes("?") || /^(what|how|why|when|where|can|could|is|are|kya|kaise|kab|kahan|kyun|check|status)\b/i.test(text.trim());
  if (isQuestion) {
    return {
      intent: "interruption",
      extracted_value: null,
      detected_language: detectSimpleLanguage(text),
      confidence: 0.75,
      reasoning: "Detected question/interruption pattern without LLM",
    };
  }

  return {
    intent: "answer",
    extracted_value: text.trim(),
    detected_language: detectSimpleLanguage(text),
    confidence: 0.6,
    reasoning: "Fallback default answer extraction",
  };
}
