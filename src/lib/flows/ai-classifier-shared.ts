/**
 * Pure, browser-safe intent heuristics and types for WhatsApp flows.
 *
 * Contains zero Node.js built-ins or AI SDK dependencies so it can safely
 * be bundled into Next.js client components (e.g. FlowChatPreview).
 */

import type { AiConfig } from "@/lib/ai/types";

export interface AIClassificationResult {
  intent: "answer" | "interruption" | "resume" | "cancel";
  /** Clean extracted entity (e.g., 'Yash Tupkar' without conversational noise). Null on interruption/cancel. */
  extracted_value: string | null;
  /** Detected ISO 639-1 language code (e.g., 'en', 'hi', 'es', 'mr'). Defaults to 'en'. */
  detected_language: string;
  confidence: number;
  reasoning?: string;
}

export interface ClassifyInputArgs {
  text: string;
  promptText?: string;
  varKey?: string;
  validation?: "any" | "email" | "phone" | "regex";
  regex?: string;
  aiConfig?: AiConfig | null;
}

export const CANCEL_PHRASES = new Set([
  "cancel",
  "stop",
  "quit",
  "exit",
  "end",
  "end flow",
  "stop flow",
  "band karo",
  "ruk jao",
  "khatam karo",
  "cancelar",
]);

export const RESUME_PHRASES = new Set([
  "resume",
  "continue",
  "proceed",
  "go on",
  "yes continue",
  "yes resume",
  "wapas",
  "aage badho",
  "chalu karo",
  "haan aage",
  "continuar",
]);

export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
export const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/;

export function cleanExtractedName(raw: string): string {
  const clean = raw.trim().replace(/^['"]|['"]$/g, "");
  // Title-case if all lowercase
  if (clean === clean.toLowerCase()) {
    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return clean;
}

export function detectSimpleLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/\b(hai|hoon|karo|nahi|acha|theek|kya|kaise)\b/i.test(text)) return "hi";
  if (/\b(hola|gracias|bueno|si|por\s+favor)\b/i.test(text)) return "es";
  return "en";
}

/**
 * Fast-path heuristic rules to extract entities or classify common intents
 * with zero latency, zero external SDK dependencies, and 100% browser compatibility.
 */
export function fastClassifyHeuristic(
  text: string,
  promptText = "",
  varKey = "",
  validation = "any",
): AIClassificationResult | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Explicit cancellation check
  if (CANCEL_PHRASES.has(lower)) {
    return {
      intent: "cancel",
      extracted_value: null,
      detected_language: lower.includes("karo") || lower.includes("jao") ? "hi" : "en",
      confidence: 1.0,
      reasoning: "Matched explicit cancellation keyword",
    };
  }

  // 2. Explicit resumption check
  if (RESUME_PHRASES.has(lower)) {
    return {
      intent: "resume",
      extracted_value: null,
      detected_language: lower.includes("badho") || lower.includes("karo") ? "hi" : "en",
      confidence: 1.0,
      reasoning: "Matched explicit resumption keyword",
    };
  }

  // 3. Validation-specific fast extraction
  if (validation === "email" || varKey.toLowerCase().includes("email")) {
    const match = trimmed.match(EMAIL_REGEX);
    if (match) {
      return {
        intent: "answer",
        extracted_value: match[0],
        detected_language: "en",
        confidence: 0.98,
        reasoning: "Extracted email address via pattern",
      };
    }
  }

  if (validation === "phone" || varKey.toLowerCase().includes("phone") || varKey.toLowerCase().includes("mobile")) {
    const match = trimmed.match(PHONE_REGEX);
    if (match) {
      const cleanPhone = match[0].replace(/[^\d+]/g, "");
      if (cleanPhone.replace(/\D/g, "").length >= 7) {
        return {
          intent: "answer",
          extracted_value: cleanPhone,
          detected_language: "en",
          confidence: 0.95,
          reasoning: "Extracted phone number via pattern",
        };
      }
    }
  }

  // 4. Name extraction fast path
  const isNameKey =
    varKey.toLowerCase().includes("name") ||
    promptText.toLowerCase().includes("name") ||
    promptText.toLowerCase().includes("naam");

  if (isNameKey) {
    // English name patterns: "My name is X", "I am X", "This is X", "Call me X", "Myself X"
    const enMatch = trimmed.match(/^(?:my\s+name\s+is|i\s+am|i'm|this\s+is|call\s+me|myself)\s+([a-zA-Z\s.'-]+)$/i);
    if (enMatch && enMatch[1].trim().length > 1) {
      return {
        intent: "answer",
        extracted_value: cleanExtractedName(enMatch[1]),
        detected_language: "en",
        confidence: 0.95,
        reasoning: "Extracted English name from conversational prefix",
      };
    }

    // Hindi/Hinglish name patterns: "Mera naam X hai", "Main X hoon", "Naam X"
    const hiMatch = trimmed.match(/^(?:mera\s+naam|naam|main)\s+([a-zA-Z\u0900-\u097F\s.'-]+?)(?:\s+(?:hai|hoon|hu))?$/i);
    if (hiMatch && hiMatch[1].trim().length > 1) {
      return {
        intent: "answer",
        extracted_value: cleanExtractedName(hiMatch[1]),
        detected_language: "hi",
        confidence: 0.95,
        reasoning: "Extracted Hindi/Hinglish name from conversational prefix",
      };
    }

    // Spanish: "Me llamo X", "Mi nombre es X"
    const esMatch = trimmed.match(/^(?:me\s+llamo|mi\s+nombre\s+es)\s+([a-zA-Z\s.'-]+)$/i);
    if (esMatch && esMatch[1].trim().length > 1) {
      return {
        intent: "answer",
        extracted_value: cleanExtractedName(esMatch[1]),
        detected_language: "es",
        confidence: 0.95,
        reasoning: "Extracted Spanish name from conversational prefix",
      };
    }
  }

  // If input is short and straightforward without questions or auxiliary verbs, treat as direct answer
  const isQuestion = trimmed.includes("?") || /^(what|how|why|when|where|can|could|is|are|kya|kaise|kab|kahan|kyun)\b/i.test(trimmed);
  if (!isQuestion && trimmed.split(/\s+/).length <= 4) {
    return {
      intent: "answer",
      extracted_value: trimmed,
      detected_language: detectSimpleLanguage(trimmed),
      confidence: 0.85,
      reasoning: "Direct concise response",
    };
  }

  // Ambiguous or complex sentence -> defer to AI classifier
  return null;
}

