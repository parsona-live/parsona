import { describe, it, expect, vi } from "vitest";
import {
  analyzeFlowInput,
  validateAndNormalize,
  checkFlowCommand,
  fastPathDeterministicCheck,
  getDefaultInvalidMessage,
} from "./input-analyzer";
import type { AiConfig } from "@/lib/ai/types";

vi.mock("@/lib/ai/generate", () => ({
  generateReply: vi.fn(async ({ messages, systemPrompt }) => {
    const userPrompt = messages[0]?.content || "";

    // Simulated AI responses based on test scenarios
    if (userPrompt.includes("My name is Yash Tupkar")) {
      return {
        text: JSON.stringify({
          intent: "valid_input",
          extracted_value: "Yash Tupkar",
          confidence: 0.98,
          reason: "User naturally provided their name",
        }),
      };
    }

    if (userPrompt.includes("Contact me at yash@example.com")) {
      return {
        text: JSON.stringify({
          intent: "valid_input",
          extracted_value: "yash@example.com",
          confidence: 0.99,
          reason: "User naturally provided their email",
        }),
      };
    }

    if (userPrompt.includes("I need 5 tickets")) {
      return {
        text: JSON.stringify({
          intent: "valid_input",
          extracted_value: "5",
          confidence: 0.95,
          reason: "User specified 5 tickets",
        }),
      };
    }

    if (userPrompt.includes("What are your store timings?")) {
      return {
        text: JSON.stringify({
          intent: "interruption",
          extracted_value: null,
          confidence: 0.95,
          reason: "User asked for store timings, which is an unrelated inquiry",
        }),
      };
    }

    if (userPrompt.includes("I want to check my previous booking")) {
      return {
        text: JSON.stringify({
          intent: "interruption",
          extracted_value: null,
          confidence: 0.96,
          reason: "User is asking about previous booking status",
        }),
      };
    }

    if (userPrompt.includes("invalid-email-no-at")) {
      return {
        text: JSON.stringify({
          intent: "unclear_input",
          extracted_value: null,
          confidence: 0.9,
          reason: "Not a valid email address",
        }),
      };
    }

    return {
      text: JSON.stringify({
        intent: "unclear_input",
        extracted_value: null,
        confidence: 0.7,
        reason: "Could not understand input",
      }),
    };
  }),
}));

const mockAiConfig: AiConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "test-api-key",
  baseUrl: null,
  systemPrompt: null,
  isActive: true,
  autoReplyEnabled: true,
  autoReplyMaxPerConversation: 10,
  handoffAgentId: null,
  embeddingsApiKey: null,
};

describe("input-analyzer: deterministic validation & normalization", () => {
  it("validates and normalizes email", () => {
    expect(validateAndNormalize("email", "yash@example.com")).toEqual({
      isValid: true,
      normalized: "yash@example.com",
    });
    expect(validateAndNormalize("email", " YASH@Example.COM ")).toEqual({
      isValid: true,
      normalized: "yash@example.com",
    });
    expect(validateAndNormalize("email", "not-an-email").isValid).toBe(false);
  });

  it("validates and normalizes phone numbers", () => {
    expect(validateAndNormalize("phone", "+1 (234) 567-8901")).toEqual({
      isValid: true,
      normalized: "+12345678901",
    });
    expect(validateAndNormalize("phone", "9876543210")).toEqual({
      isValid: true,
      normalized: "9876543210",
    });
    expect(validateAndNormalize("phone", "123").isValid).toBe(false);
  });

  it("validates person names", () => {
    expect(validateAndNormalize("name", "Yash Tupkar")).toEqual({
      isValid: true,
      normalized: "Yash Tupkar",
    });
    expect(validateAndNormalize("name", "A").isValid).toBe(false);
  });

  it("validates numbers", () => {
    expect(validateAndNormalize("number", "42")).toEqual({
      isValid: true,
      normalized: "42",
    });
    expect(validateAndNormalize("number", "3.14")).toEqual({
      isValid: true,
      normalized: "3.14",
    });
    expect(validateAndNormalize("number", "abc").isValid).toBe(false);
  });

  it("validates custom regex", () => {
    expect(validateAndNormalize("regex", "ABC-1234", "^[A-Z]{3}-\\d{4}$")).toEqual({
      isValid: true,
      normalized: "ABC-1234",
    });
    expect(validateAndNormalize("regex", "bad", "^[A-Z]{3}-\\d{4}$").isValid).toBe(false);
  });
});

describe("input-analyzer: flow commands and fast path", () => {
  it("detects flow commands", () => {
    expect(checkFlowCommand("cancel")).toBe("cancel");
    expect(checkFlowCommand("band karo")).toBe("cancel");
    expect(checkFlowCommand("restart")).toBe("restart");
    expect(checkFlowCommand("start over")).toBe("restart");
    expect(checkFlowCommand("resume")).toBe("resume");
    expect(checkFlowCommand("continue")).toBe("resume");
    expect(checkFlowCommand("hello")).toBeNull();
  });

  it("fast-paths clean direct email values without calling AI", () => {
    const fast = fastPathDeterministicCheck("user@domain.com", "email");
    expect(fast).not.toBeNull();
    expect(fast?.intent).toBe("valid_input");
    expect(fast?.extracted_value).toBe("user@domain.com");
  });

  it("fast-paths clean phone number values", () => {
    const fast = fastPathDeterministicCheck("+919876543210", "phone");
    expect(fast).not.toBeNull();
    expect(fast?.intent).toBe("valid_input");
    expect(fast?.extracted_value).toBe("+919876543210");
  });
});

describe("input-analyzer: AI conversational analysis", () => {
  it('extracts "Yash Tupkar" from "My name is Yash Tupkar"', async () => {
    const res = await analyzeFlowInput({
      text: "My name is Yash Tupkar",
      promptText: "What is your name?",
      varKey: "full_name",
      validation: "name",
      aiConfig: mockAiConfig,
    });
    expect(res.intent).toBe("valid_input");
    expect(res.extracted_value).toBe("Yash Tupkar");
  });

  it('extracts email from "Contact me at yash@example.com"', async () => {
    const res = await analyzeFlowInput({
      text: "Contact me at yash@example.com",
      promptText: "What is your email address?",
      varKey: "email",
      validation: "email",
      aiConfig: mockAiConfig,
    });
    expect(res.intent).toBe("valid_input");
    expect(res.extracted_value).toBe("yash@example.com");
  });

  it('extracts 5 from "I need 5 tickets"', async () => {
    const res = await analyzeFlowInput({
      text: "I need 5 tickets",
      promptText: "How many tickets do you need?",
      varKey: "tickets_count",
      validation: "number",
      aiConfig: mockAiConfig,
    });
    expect(res.intent).toBe("valid_input");
    expect(res.extracted_value).toBe("5");
  });

  it('classifies "What are your store timings?" as an interruption', async () => {
    const res = await analyzeFlowInput({
      text: "What are your store timings?",
      promptText: "Please enter your email",
      varKey: "email",
      validation: "email",
      aiConfig: mockAiConfig,
      allowInterruption: true,
    });
    expect(res.intent).toBe("interruption");
    expect(res.extracted_value).toBeNull();
  });

  it('treats interruption as unclear_input when allowInterruption is false', async () => {
    const res = await analyzeFlowInput({
      text: "What are your store timings?",
      promptText: "Please enter your email",
      varKey: "email",
      validation: "email",
      aiConfig: mockAiConfig,
      allowInterruption: false,
    });
    expect(res.intent).toBe("unclear_input");
  });

  it('classifies "I want to check my previous booking" as an interruption', async () => {
    const res = await analyzeFlowInput({
      text: "I want to check my previous booking",
      promptText: "Please provide your phone number",
      varKey: "phone",
      validation: "phone",
      aiConfig: mockAiConfig,
    });
    expect(res.intent).toBe("interruption");
  });

  it("returns polite corrective messages for invalid inputs", () => {
    expect(getDefaultInvalidMessage("email")).toContain("email");
    expect(getDefaultInvalidMessage("phone")).toContain("contact number");
    expect(getDefaultInvalidMessage("name")).toContain("name");
  });
});

