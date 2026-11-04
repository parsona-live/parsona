/**
 * Server-side AI-powered input analysis and regex heuristic validation for WhatsApp flows.
 *
 * Implements:
 * 1. Fast-path deterministic validation & command heuristics (cancel, restart, resume, clean email/phone/number).
 * 2. Full AI Agent conversational analysis with dedicated input-analysis system prompt.
 * 3. Strict regex validation & normalization before assignment to flow variables.
 * 4. Interruption handling (unrelated business queries vs pending questions).
 */

import { generateReply } from "@/lib/ai/generate";
import type { AiConfig } from "@/lib/ai/types";
import type { InputValidationType } from "./types";

export type FlowInputIntent =
  | "valid_input"
  | "unclear_input"
  | "interruption"
  | "resume"
  | "cancel"
  | "restart";

export interface FlowAnalysisResult {
  intent: FlowInputIntent;
  extracted_value: string | null;
  confidence: number;
  reason: string;
}

export interface AnalyzeFlowInputArgs {
  text: string;
  promptText?: string;
  varKey?: string;
  validation?: InputValidationType;
  regex?: string;
  currentVars?: Record<string, unknown>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  aiConfig?: AiConfig | null;
  allowInterruption?: boolean;
}

// RFC 5322 simplified strict email regex
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Unicode name regex: letters, spaces, hyphens, apostrophes; min 2 chars
export const NAME_REGEX = /^[\p{L}\p{M}\s'-]{2,}$/u;

// Standard number regex: optional negative sign, integer or decimal
export const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

/**
 * Validates and normalizes an input value according to the expected validation type.
 * Never throws.
 */
export function validateAndNormalize(
  validation: InputValidationType = "any",
  value: string | null | undefined,
  customRegex?: string,
): { isValid: boolean; normalized: string | null } {
  if (value === null || value === undefined) {
    return { isValid: false, normalized: null };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, normalized: null };
  }

  switch (validation) {
    case "email": {
      const isMatch = EMAIL_REGEX.test(trimmed);
      return {
        isValid: isMatch,
        normalized: isMatch ? trimmed.toLowerCase() : null,
      };
    }
    case "phone": {
      // Must have at least 7 digits, allow leading +
      const cleaned = trimmed.replace(/[^\d+]/g, "");
      const digitCount = (cleaned.match(/\d/g) || []).length;
      const isValid = digitCount >= 7 && digitCount <= 16 && /^\+?\d+$/.test(cleaned);
      return {
        isValid,
        normalized: isValid ? cleaned : null,
      };
    }
    case "name": {
      const isValid = NAME_REGEX.test(trimmed) && trimmed.length <= 100;
      return {
        isValid,
        normalized: isValid ? trimmed : null,
      };
    }
    case "number": {
      const isValid = NUMBER_REGEX.test(trimmed);
      return {
        isValid,
        normalized: isValid ? trimmed : null,
      };
    }
    case "regex": {
      if (!customRegex) {
        return { isValid: true, normalized: trimmed };
      }
      try {
        const re = new RegExp(customRegex);
        const isValid = re.test(trimmed);
        return {
          isValid,
          normalized: isValid ? trimmed : null,
        };
      } catch {
        return { isValid: false, normalized: null };
      }
    }
    case "any":
    default:
      return { isValid: true, normalized: trimmed };
  }
}

/**
 * Returns a user-friendly default corrective message when input validation fails.
 */
export function getDefaultInvalidMessage(validation?: InputValidationType): string {
  switch (validation) {
    case "name":
      return "I couldn't understand your name. Could you please share your name again?";
    case "email":
      return "I couldn't identify a valid email address. Could you please provide your email again?";
    case "phone":
      return "Please share a valid contact number so we can continue.";
    case "number":
      return "Please provide a valid number so we can continue.";
    default:
      return "Please provide a valid response so we can continue.";
  }
}

/**
 * Fast-path check for flow control commands (cancel, restart, resume).
 */
export function checkFlowCommand(text: string): FlowInputIntent | null {
  const norm = text.trim().toLowerCase();
  if (!norm) return null;

  // Cancel / Stop commands
  if (
    /^(cancel|stop|quit|exit|abort|terminate|band\s*karo|rok\s*do)$/i.test(norm)
  ) {
    return "cancel";
  }

  // Restart commands
  if (
    /^(restart|start\s*over|reset|rebegin|shuru\s*se|phir\s*se)$/i.test(norm)
  ) {
    return "restart";
  }

  // Resume commands
  if (
    /^(resume|continue|unpause|proceed|go\s*on|aage\s*badho|chalu\s*karo)$/i.test(norm)
  ) {
    return "resume";
  }

  return null;
}

/**
 * Fast-path deterministic evaluation for pure values without conversational wrapper words.
 */
export function fastPathDeterministicCheck(
  text: string,
  validation: InputValidationType = "any",
  customRegex?: string,
): FlowAnalysisResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Check explicit commands first
  const command = checkFlowCommand(trimmed);
  if (command) {
    return {
      intent: command,
      extracted_value: null,
      confidence: 1.0,
      reason: `Exact command keyword matched: ${command}`,
    };
  }

  // 2. Exact email token (no spaces)
  if (validation === "email" && !trimmed.includes(" ")) {
    const { isValid, normalized } = validateAndNormalize("email", trimmed);
    if (isValid) {
      return {
        intent: "valid_input",
        extracted_value: normalized,
        confidence: 1.0,
        reason: "Exact email format matched",
      };
    }
  }

  // 3. Exact phone token (numbers and +, no spaces or words)
  if (validation === "phone") {
    const withoutSpaces = trimmed.replace(/\s+/g, "");
    if (/^\+?\d{7,16}$/.test(withoutSpaces)) {
      const { isValid, normalized } = validateAndNormalize("phone", withoutSpaces);
      if (isValid) {
        return {
          intent: "valid_input",
          extracted_value: normalized,
          confidence: 1.0,
          reason: "Exact phone format matched",
        };
      }
    }
  }

  // 4. Exact number token
  if (validation === "number" && !trimmed.includes(" ")) {
    const { isValid, normalized } = validateAndNormalize("number", trimmed);
    if (isValid) {
      return {
        intent: "valid_input",
        extracted_value: normalized,
        confidence: 1.0,
        reason: "Exact number format matched",
      };
    }
  }

  // 5. Custom regex exact match
  if (validation === "regex" && customRegex && !trimmed.includes("\n")) {
    try {
      const re = new RegExp(customRegex);
      if (re.test(trimmed)) {
        return {
          intent: "valid_input",
          extracted_value: trimmed,
          confidence: 1.0,
          reason: "Custom regex exact match",
        };
      }
    } catch {
      // Invalid regex pattern
    }
  }

  return null;
}

/**
 * System prompt dedicated to analyzing flow input, extracting clean entities,
 * and detecting interruptions or commands.
 */
export const INPUT_ANALYSIS_SYSTEM_PROMPT = `You are an intelligent input analyzer for a WhatsApp automation flow.
Your responsibility is to understand the user's latest message in the context of the ongoing conversation and determine whether it correctly answers the current flow question.

You will receive:
- Recent conversation history.
- Current flow question.
- Expected input type.
- Current variable name.
- Previous collected variables.
- Latest user message.

Analyze the latest message carefully.

Rules:
1. If the user provides the requested information, extract only the correct value in a clean, normalized format.
   Understand natural conversational responses. For example:
   - Question: What is your name?
     User: My name is Yash Tupkar.
     Extracted value: Yash Tupkar.
   - Question: What is your email?
     User: You can contact me at yash@example.com.
     Extracted value: yash@example.com.
   - Question: How many tickets do you need?
     User: I need 5 tickets.
     Extracted value: 5.
2. If the user provides an answer that cannot confidently be understood or extracted, classify it as unclear_input. Do not guess or fabricate values.
3. If the user asks an unrelated question, such as store hours, pricing, previous booking status, services, or business information, classify it as an interruption.
4. If the user wants to cancel, resume, or restart the flow, identify the corresponding command (cancel, resume, or restart).
5. If the user directly provides a valid answer while a flow is paused, recognize it as valid_input to the pending question.
6. Always consider conversation context. Never interpret a message in isolation when previous messages clarify its meaning.
7. Never treat an unrelated question as an answer to the current flow question.

Return ONLY structured JSON:
{
  "intent": "valid_input" | "unclear_input" | "interruption" | "resume" | "cancel" | "restart",
  "extracted_value": "clean extracted value or null",
  "confidence": 0.0,
  "reason": "short explanation"
}

Do not generate customer-facing responses. The application will handle the appropriate response based on the result.`;

/**
 * Core flow input analyzer.
 * Checks commands and fast-paths first, invokes the Full AI Agent for conversational interpretation,
 * and enforces strict regex validation on extracted entities.
 */
export async function analyzeFlowInput(
  args: AnalyzeFlowInputArgs,
): Promise<FlowAnalysisResult> {
  const {
    text,
    promptText = "",
    varKey = "input",
    validation = "any",
    regex: customRegex,
    currentVars = {},
    conversationHistory = [],
    aiConfig,
    allowInterruption = true,
  } = args;

  const trimmed = text.trim();

  // 1. Check deterministic fast-path first (commands or exact token matches)
  const fastPath = fastPathDeterministicCheck(trimmed, validation, customRegex);
  if (fastPath) {
    if (fastPath.intent === "interruption" && !allowInterruption) {
      return {
        intent: "unclear_input",
        extracted_value: null,
        confidence: fastPath.confidence,
        reason: "Interruption not allowed on this step",
      };
    }
    return fastPath;
  }

  // 2. If AI Config is active, invoke Full AI Agent with dedicated input analysis prompt
  if (aiConfig && aiConfig.isActive) {
    try {
      const contextLines: string[] = [];

      if (conversationHistory.length > 0) {
        contextLines.push("Recent conversation history:");
        for (const msg of conversationHistory.slice(-6)) {
          contextLines.push(`${msg.role === "assistant" ? "Bot" : "User"}: ${msg.content}`);
        }
        contextLines.push("");
      }

      contextLines.push(`Current flow question: "${promptText}"`);
      contextLines.push(`Expected input type: "${validation}"`);
      contextLines.push(`Current variable name: "${varKey}"`);

      const varKeys = Object.keys(currentVars).filter((k) => !k.startsWith("_"));
      if (varKeys.length > 0) {
        const previewVars: Record<string, unknown> = {};
        for (const k of varKeys.slice(0, 10)) {
          previewVars[k] = currentVars[k];
        }
        contextLines.push(`Previous collected variables: ${JSON.stringify(previewVars)}`);
      }

      contextLines.push(`Latest user message: "${trimmed}"`);

      const userPrompt = contextLines.join("\n");

      const response = await generateReply({
        config: aiConfig,
        systemPrompt: INPUT_ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      if (response.text) {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            intent?: string;
            extracted_value?: string | null;
            confidence?: number;
            reason?: string;
          };

          const validIntents: FlowInputIntent[] = [
            "valid_input",
            "unclear_input",
            "interruption",
            "resume",
            "cancel",
            "restart",
          ];

          let intent: FlowInputIntent = validIntents.includes(parsed.intent as FlowInputIntent)
            ? (parsed.intent as FlowInputIntent)
            : "unclear_input";

          let extractedVal = parsed.extracted_value ?? null;

          // If AI says valid_input, strictly validate the extracted value against regex rules
          if (intent === "valid_input" && extractedVal !== null) {
            const { isValid, normalized } = validateAndNormalize(
              validation,
              extractedVal,
              customRegex,
            );
            if (isValid && normalized !== null) {
              extractedVal = normalized;
            } else {
              // Extraction failed regex validation -> reclassify as unclear_input
              intent = "unclear_input";
              extractedVal = null;
            }
          }

          // If interruption is detected but disallowed on this node, convert to unclear_input
          if (intent === "interruption" && !allowInterruption) {
            intent = "unclear_input";
            extractedVal = null;
          }

          return {
            intent,
            extracted_value: extractedVal,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
            reason: parsed.reason || "AI analysis completed",
          };
        }
      }
    } catch (err) {
      console.warn("[input-analyzer] AI analysis error, falling back to heuristic:", err);
    }
  }

  // 3. Fallback heuristic when AI is unavailable or failed
  // Check if user is asking a question (interruption)
  const isQuestion =
    trimmed.includes("?") ||
    /^(what|how|why|when|where|who|can|could|is|are|do|does|kya|kaise|kab|kahan|kyun|check|status|price|cost|timing|hours)\b/i.test(
      trimmed,
    );

  if (isQuestion) {
    if (allowInterruption) {
      return {
        intent: "interruption",
        extracted_value: null,
        confidence: 0.8,
        reason: "Heuristic detected question/inquiry pattern",
      };
    }
    return {
      intent: "unclear_input",
      extracted_value: null,
      confidence: 0.8,
      reason: "Question asked but interruptions disabled on this step",
    };
  }

  // Attempt deterministic validation on the raw text
  const { isValid, normalized } = validateAndNormalize(validation, trimmed, customRegex);
  if (isValid && normalized !== null) {
    return {
      intent: "valid_input",
      extracted_value: normalized,
      confidence: 0.75,
      reason: "Fallback heuristic regex match",
    };
  }

  return {
    intent: "unclear_input",
    extracted_value: null,
    confidence: 0.7,
    reason: "Input could not be validated",
  };
}

