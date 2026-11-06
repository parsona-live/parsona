import { describe, it, expect, vi } from "vitest";
import {
  fastPathDetectLanguage,
  detectLanguage,
  DEVANAGARI_REGEX,
} from "./language-detector";

vi.mock("@/lib/ai/generate", () => ({
  generateReply: vi.fn(async ({ messages }) => {
    const text = messages[0]?.content || "";
    if (text.includes("¿Hola cómo estás?")) return { text: "es" };
    if (text.includes("வணக்கம்")) return { text: "ta" };
    return { text: "en" };
  }),
}));

describe("language-detector: fastPathDetectLanguage", () => {
  it("detects Devanagari Hindi with 100% confidence", () => {
    const result1 = fastPathDetectLanguage("नमस्ते, मुझे जानकारी चाहिए");
    expect(result1?.locale).toBe("hi");
    expect(result1?.confidence).toBe(1.0);

    const result2 = fastPathDetectLanguage("हाँ");
    expect(result2?.locale).toBe("hi");
  });

  it("detects Hinglish phrases with high confidence", () => {
    expect(fastPathDetectLanguage("bhai mujhe details chahiye")?.locale).toBe("hinglish");
    expect(fastPathDetectLanguage("price kya hai")?.locale).toBe("hinglish");
    expect(fastPathDetectLanguage("kripya send karo")?.locale).toBe("hinglish");
    expect(fastPathDetectLanguage("kitna hoga cost")?.locale).toBe("hinglish");
    expect(fastPathDetectLanguage("haan")?.locale).toBe("hinglish");
    expect(fastPathDetectLanguage("nahi")?.locale).toBe("hinglish");
  });

  it("returns null for English or unclassified text so caller can decide", () => {
    expect(fastPathDetectLanguage("Hello, I would like to book an appointment")).toBeNull();
    expect(fastPathDetectLanguage("What is the price of this product?")).toBeNull();
  });
});

describe("language-detector: detectLanguage", () => {
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

  it("defaults to 'en' for standard English inputs", async () => {
    const res = await detectLanguage("Hello there", mockAiConfig);
    expect(res.locale).toBe("en");
  });

  it("detects Hindi Devanagari immediately", async () => {
    const res = await detectLanguage("नमस्ते", mockAiConfig);
    expect(res.locale).toBe("hi");
  });

  it("detects Hinglish via fast-path without calling AI", async () => {
    const res = await detectLanguage("Mujhe fees batao na", mockAiConfig);
    expect(res.locale).toBe("hinglish");
  });

  it("falls back to AI for other foreign languages", async () => {
    const res = await detectLanguage("¿Hola cómo estás? Quisiera más información", mockAiConfig);
    expect(res.locale).toBe("es");
  });
});

