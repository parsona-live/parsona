/**
 * Real-time Language Detector for WhatsApp flows.
 *
 * Implements:
 * 1. Fast-path Devanagari Unicode detection -> 'hi' (0ms, 0 tokens)
 * 2. High-speed heuristic detection for Romanized Hindi -> 'hinglish' (0ms, 0 tokens)
 * 3. AI-based fallback detection for other languages (Spanish, Tamil, etc.)
 */

import type { AiConfig } from "@/lib/ai/types";
import { generateReply } from "@/lib/ai/generate";

// Devanagari unicode range: \u0900-\u097F
export const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

// Common Hinglish marker words (case-insensitive boundary match)
const HINGLISH_TOKENS = new Set([
  "kya", "kyu", "kyun", "kaise", "kaha", "kahan", "kitna", "kitne", "kitni", "kab",
  "hai", "hain", "hoon", "tha", "thi", "the", "hoga", "hogi", "honge",
  "mujhe", "mera", "meri", "mere", "mujhko", "apna", "apni", "apne",
  "aap", "aapka", "aapki", "aapke", "tum", "tumhara", "tumhari", "tumhare",
  "hum", "humara", "humari", "humare", "hume", "humko",
  "chahiye", "karo", "karein", "karna", "karta", "karti", "karte",
  "batao", "bataiye", "bhejo", "bhejiye", "dekho", "dekhein", "dekhna",
  "haan", "nahi", "nahin", "theek", "accha", "achha", "bahut", "bohot",
  "thoda", "kuch", "zaroor", "shukriya", "dhanyawad", "sirji", "bhai",
  "madad", "samajh", "pata", "poochna", "mil", "milega", "milegi",
]);

// Strong Hinglish 2-word collocations
const HINGLISH_PHRASES = [
  /\b(kya\s+hai|kya\s+cost|kya\s+price|kya\s+rate)\b/i,
  /\b(kitna\s+hai|kitna\s+hoga|kitne\s+ka)\b/i,
  /\b(bata\s+do|batao\s+na|bataiye\s+na)\b/i,
  /\b(bhej\s+do|bhejiye\s+na|send\s+karo|send\s+kijiye)\b/i,
  /\b(chahiye\s+bhai|chahiye\s+mujhe|chahiye\s+hume)\b/i,
  /\b(kaise\s+karein|kaise\s+hoga|kaise\s+milega)\b/i,
  /\b(details\s+chahiye|details\s+bhejo|info\s+chahiye)\b/i,
  /\b(book\s+karo|book\s+karna\s+hai|start\s+karo)\b/i,
  /\b(shuru\s+karo|band\s+karo|rok\s+do|aage\s+badho)\b/i,
];

/**
 * Fast-path heuristic detection for Hindi (Devanagari) and Hinglish (Latin).
 * Returns detected locale or null if inconclusive.
 */
export function fastPathDetectLanguage(text: string): { locale: string; confidence: number } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Devanagari script -> 'hi'
  if (DEVANAGARI_REGEX.test(trimmed)) {
    return { locale: "hi", confidence: 1.0 };
  }

  // 2. Check Hinglish phrases first
  for (const phrase of HINGLISH_PHRASES) {
    if (phrase.test(trimmed)) {
      return { locale: "hinglish", confidence: 0.95 };
    }
  }

  // 3. Check Hinglish token density
  const words = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return null;

  let hinglishCount = 0;
  for (const word of words) {
    if (HINGLISH_TOKENS.has(word)) {
      hinglishCount += 1;
    }
  }

  // If single word like "haan" or "nahi", that's Hinglish
  if (words.length === 1 && (words[0] === "haan" || words[0] === "nahi" || words[0] === "nahin")) {
    return { locale: "hinglish", confidence: 0.9 };
  }

  // If 2+ Hinglish words or > 25% of words are Hinglish in a short phrase
  if (hinglishCount >= 2 || (words.length <= 4 && hinglishCount >= 1 && words.length > 1)) {
    return { locale: "hinglish", confidence: Math.min(0.9, hinglishCount / words.length + 0.3) };
  }

  return null;
}

/**
 * Detect language of incoming customer text.
 * Runs fast-path heuristics first (0ms), then falls back to AI classification if ambiguous.
 * Defaults to 'en'.
 */
export async function detectLanguage(
  text: string,
  aiConfig?: AiConfig | null,
): Promise<{ locale: string; confidence: number }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { locale: "en", confidence: 1.0 };
  }

  // 1. Try 0ms fast-path
  const fast = fastPathDetectLanguage(trimmed);
  if (fast) {
    return fast;
  }

  // If text is short English words or standard commands (e.g. "hi", "hello", "yes", "no", "start"), fast-path English
  if (/^(hi|hello|hey|yes|no|ok|okay|start|restart|cancel|help)$/i.test(trimmed)) {
    return { locale: "en", confidence: 0.95 };
  }

  // 2. If AI Config is active and text is more than 3 words or ambiguous, ask AI
  if (aiConfig && aiConfig.isActive && trimmed.length > 5) {
    try {
      const systemPrompt = `You are a language identification engine for customer support messages.
Analyze the message and identify the customer's language.
Rules:
- If the text is Hindi in Latin/English letters (e.g. "mujhe price list chahiye"), return "hinglish".
- If the text is Hindi in Devanagari script (e.g. "नमस्ते"), return "hi".
- If the text is English, return "en".
- For other languages, return the ISO 639-1 code (e.g. "es", "ta", "te", "bn", "pt", "fr", "ar").
- Return ONLY the language code string, in lowercase. No punctuation, no explanation.`;

      const res = await generateReply({
        config: aiConfig,
        systemPrompt,
        messages: [{ role: "user", content: trimmed }],
      });

      const detected = res.text?.trim().toLowerCase().replace(/[^a-z_-]/g, "");
      if (detected && detected.length >= 2 && detected.length <= 10) {
        return { locale: detected, confidence: 0.9 };
      }
    } catch (err) {
      console.warn("[language-detector] AI detection failed, defaulting to 'en':", err);
    }
  }

  // Default fallback
  return { locale: "en", confidence: 0.6 };
}

