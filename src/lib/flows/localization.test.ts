import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  localizeText,
  localizeNode,
  applySavedTranslation,
  clearTranslationCache,
} from "./localization";
import type { FlowNodeRow, SendButtonsNodeConfig, SendMessageNodeConfig } from "./types";

const mockGenerateReply = vi.fn(async ({ messages }) => {
  const text = messages[0]?.content;
  if (text === "Welcome") return { text: "स्वागत है" };
  if (text === "Welcome Hinglish") return { text: "Aapka swagat hai" };
  if (text === "Yes") return { text: "हाँ" };
  if (text === "No") return { text: "नहीं" };
  return { text: `Localized: ${text}` };
});

vi.mock("@/lib/ai/generate", () => ({
  generateReply: (...args: unknown[]) => mockGenerateReply(...(args as [any])),
}));

describe("localization: localizeText", () => {
  beforeEach(() => {
    clearTranslationCache();
    mockGenerateReply.mockClear();
  });

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

  it("returns English/default text unchanged", async () => {
    const res = await localizeText("Welcome", "en", mockAiConfig);
    expect(res).toBe("Welcome");
    expect(mockGenerateReply).not.toHaveBeenCalled();
  });

  it("translates non-English text via AI", async () => {
    const res = await localizeText("Welcome", "hi", mockAiConfig);
    expect(res).toBe("स्वागत है");
    expect(mockGenerateReply).toHaveBeenCalledTimes(1);
  });

  it("translates Hinglish text with Hinglish prompt", async () => {
    const res = await localizeText("Welcome Hinglish", "hinglish", mockAiConfig);
    expect(res).toBe("Aapka swagat hai");
  });

  it("uses in-memory cache on repeat calls", async () => {
    const res1 = await localizeText("Welcome", "hi", mockAiConfig);
    const res2 = await localizeText("Welcome", "hi", mockAiConfig);
    expect(res1).toBe("स्वागत है");
    expect(res2).toBe("स्वागत है");
    expect(mockGenerateReply).toHaveBeenCalledTimes(1);
  });
});

describe("localization: localizeNode and self-learning caching", () => {
  beforeEach(() => {
    clearTranslationCache();
    mockGenerateReply.mockClear();
  });

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

  it("uses pre-saved translations in node.config.translations with ZERO AI calls", async () => {
    const node: FlowNodeRow = {
      id: "node_saved",
      flow_id: "flow_1",
      node_key: "k_msg",
      node_type: "send_message",
      position_x: 0,
      position_y: 0,
      config: {
        text: "Original English",
        translations: {
          hi: { text: "पहले से सेव किया गया हिंदी टेक्स्ट" },
          hinglish: { text: "Pehle se saved hinglish text" },
        },
      },
      created_at: new Date().toISOString(),
    };

    // Test Hindi cached retrieval
    const localizedHi = await localizeNode(node, "hi", mockAiConfig);
    const cfgHi = localizedHi.config as unknown as SendMessageNodeConfig;
    expect(cfgHi.text).toBe("पहले से सेव किया गया हिंदी टेक्स्ट");
    expect(mockGenerateReply).not.toHaveBeenCalled();

    // Test Hinglish cached retrieval
    const localizedHinglish = await localizeNode(node, "hinglish", mockAiConfig);
    const cfgHinglish = localizedHinglish.config as unknown as SendMessageNodeConfig;
    expect(cfgHinglish.text).toBe("Pehle se saved hinglish text");
    expect(mockGenerateReply).not.toHaveBeenCalled();
  });

  it("translates via AI on first hit and saves into translations map", async () => {
    const mockDb = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    };

    const node: FlowNodeRow = {
      id: "node_new",
      flow_id: "flow_1",
      node_key: "k_buttons",
      node_type: "send_buttons",
      position_x: 0,
      position_y: 0,
      config: {
        text: "Welcome",
        buttons: [
          { reply_id: "btn_yes", title: "Yes", next_node_key: "k_yes" },
          { reply_id: "btn_no", title: "No", next_node_key: "k_no" },
        ],
      },
      created_at: new Date().toISOString(),
    };

    const localized = await localizeNode(node, "hi", mockAiConfig, mockDb);
    const cfg = localized.config as unknown as SendButtonsNodeConfig;

    expect(cfg.text).toBe("स्वागत है");
    expect(cfg.buttons[0].title).toBe("हाँ");
    expect(cfg.buttons[0].reply_id).toBe("btn_yes"); // deterministic ID preserved!
    expect(cfg.buttons[0].next_node_key).toBe("k_yes"); // routing preserved!

    // Verify it saved into node.config.translations.hi
    const translations = (node.config as any).translations;
    expect(translations?.hi).toBeDefined();
    expect(translations.hi.text).toBe("स्वागत है");
    expect(translations.hi.buttons[0].title).toBe("हाँ");

    // CRITICAL FIX: Verify the root English text on node.config was NEVER overwritten!
    expect((node.config as any).text).toBe("Welcome");
    expect((node.config as any).buttons[0].title).toBe("Yes");
    expect((node.config as any).buttons[1].title).toBe("No");

    // Verify DB update was triggered with English root text + Hindi translation map
    expect(mockDb.from).toHaveBeenCalledWith("flow_nodes");
    const updateCall = mockDb.from.mock.results[0].value.update.mock.calls[0][0];
    expect(updateCall.config.text).toBe("Welcome");
    expect(updateCall.config.buttons[0].title).toBe("Yes");
    expect(updateCall.config.translations.hi.text).toBe("स्वागत है");
  });

  it("localizes and caches input_flow nodes (prompt and invalid message)", async () => {
    const node: FlowNodeRow = {
      id: "node_input_flow",
      flow_id: "flow_1",
      node_key: "k_inp",
      node_type: "input_flow",
      position_x: 0,
      position_y: 0,
      config: {
        prompt_text: "Welcome",
        invalid_message: "No",
        var_key: "city",
        next_node_key: "k_next",
      },
      created_at: new Date().toISOString(),
    };

    const localized = await localizeNode(node, "hi", mockAiConfig);
    const cfg = localized.config as Record<string, any>;

    expect(cfg.prompt_text).toBe("स्वागत है");
    expect(cfg.invalid_message).toBe("नहीं");
    expect(cfg.var_key).toBe("city");
    expect(cfg.next_node_key).toBe("k_next");

    // Translations cached
    expect(cfg.translations?.hi?.prompt_text).toBe("स्वागत है");
    expect(cfg.translations?.hi?.invalid_message).toBe("नहीं");
  });

  it("localizes and caches handoff / agent_handover message", async () => {
    const node: FlowNodeRow = {
      id: "node_handoff",
      flow_id: "flow_1",
      node_key: "k_handoff",
      node_type: "agent_handover",
      position_x: 0,
      position_y: 0,
      config: {
        message: "Welcome",
      },
      created_at: new Date().toISOString(),
    };

    const localized = await localizeNode(node, "hi", mockAiConfig);
    const cfg = localized.config as Record<string, any>;

    expect(cfg.message).toBe("स्वागत है");
    expect(cfg.translations?.hi?.message).toBe("स्वागत है");
  });
});
