import { describe, it, expect, vi } from "vitest";
import {
  fastClassifyHeuristic,
  classifyInputOrInterruption,
} from "./ai-classifier";

vi.mock("@/lib/ai/generate", () => ({
  generateReply: vi.fn(async () => ({
    text: JSON.stringify({
      intent: "interruption",
      extracted_value: null,
      detected_language: "en",
      confidence: 0.95,
      reasoning: "User is asking about booking status instead of giving name",
    }),
    handoff: false,
    usage: { promptTokens: 10, completionTokens: 10 },
  })),
}));

describe("ai-classifier: fastClassifyHeuristic", () => {
  it("extracts English name from conversational prefix", () => {
    const res = fastClassifyHeuristic("My name is Yash Tupkar", "Please enter your name", "full_name");
    expect(res).not.toBeNull();
    expect(res?.intent).toBe("answer");
    expect(res?.extracted_value).toBe("Yash Tupkar");
    expect(res?.detected_language).toBe("en");
  });

  it("extracts Hindi/Hinglish name from conversational prefix", () => {
    const res = fastClassifyHeuristic("Mera naam Yash Tupkar hai", "Apna naam bataye", "name");
    expect(res).not.toBeNull();
    expect(res?.intent).toBe("answer");
    expect(res?.extracted_value).toBe("Yash Tupkar");
    expect(res?.detected_language).toBe("hi");
  });

  it("extracts Spanish name from conversational prefix", () => {
    const res = fastClassifyHeuristic("Me llamo Carlos Garcia", "Ingrese su nombre", "name");
    expect(res).not.toBeNull();
    expect(res?.intent).toBe("answer");
    expect(res?.extracted_value).toBe("Carlos Garcia");
    expect(res?.detected_language).toBe("es");
  });

  it("extracts email from text", () => {
    const res = fastClassifyHeuristic(
      "You can send it to yash@example.com please",
      "Enter your email",
      "email",
      "email",
    );
    expect(res).not.toBeNull();
    expect(res?.intent).toBe("answer");
    expect(res?.extracted_value).toBe("yash@example.com");
  });

  it("extracts phone number from text", () => {
    const res = fastClassifyHeuristic(
      "Call me at +919876543210 thank you",
      "Enter your phone",
      "phone",
      "phone",
    );
    expect(res).not.toBeNull();
    expect(res?.intent).toBe("answer");
    expect(res?.extracted_value).toBe("+919876543210");
  });

  it("classifies explicit cancellation", () => {
    expect(fastClassifyHeuristic("cancel")?.intent).toBe("cancel");
    expect(fastClassifyHeuristic("band karo")?.intent).toBe("cancel");
    expect(fastClassifyHeuristic("stop flow")?.intent).toBe("cancel");
  });

  it("classifies explicit resumption", () => {
    expect(fastClassifyHeuristic("resume")?.intent).toBe("resume");
    expect(fastClassifyHeuristic("continue")?.intent).toBe("resume");
    expect(fastClassifyHeuristic("aage badho")?.intent).toBe("resume");
  });

  it("returns null for ambiguous conversational questions so AI can classify", () => {
    const res = fastClassifyHeuristic(
      "I want to check my previous booking status",
      "Please enter your name",
      "name",
    );
    expect(res).toBeNull();
  });
});

describe("ai-classifier: classifyInputOrInterruption", () => {
  it("uses AI to classify an unrelated interruption", async () => {
    const mockAiConfig = {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      apiKey: "test",
      baseUrl: null,
      systemPrompt: null,
      isActive: true,
      autoReplyEnabled: true,
      autoReplyMaxPerConversation: 5,
      handoffAgentId: null,
      embeddingsApiKey: null,
    };

    const res = await classifyInputOrInterruption({
      text: "I want to check my previous booking status",
      promptText: "Please provide your full name",
      varKey: "full_name",
      aiConfig: mockAiConfig,
    });

    expect(res.intent).toBe("interruption");
    expect(res.extracted_value).toBeNull();
  });

  it("falls back gracefully when AI is unavailable", async () => {
    const res = await classifyInputOrInterruption({
      text: "What are your open hours?",
      promptText: "Please provide your full name",
      varKey: "full_name",
      aiConfig: null,
    });

    expect(res.intent).toBe("interruption");
  });
});
