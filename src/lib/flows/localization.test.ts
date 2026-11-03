import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  localizeText,
  localizeNode,
  clearTranslationCache,
} from "./localization";
import type { FlowNodeRow, SendButtonsNodeConfig } from "./types";

vi.mock("@/lib/ai/generate", () => ({
  generateReply: vi.fn(async ({ messages }) => {
    const text = messages[0].content;
    if (text === "Welcome") return { text: "स्वागत है" };
    if (text === "Yes") return { text: "हाँ" };
    if (text === "No") return { text: "नहीं" };
    return { text: `Localized: ${text}` };
  }),
}));

describe("localization: localizeText", () => {
  beforeEach(() => {
    clearTranslationCache();
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
  });

  it("translates non-English text via AI", async () => {
    const res = await localizeText("Welcome", "hi", mockAiConfig);
    expect(res).toBe("स्वागत है");
  });

  it("uses in-memory cache on repeat calls", async () => {
    const res1 = await localizeText("Welcome", "hi", mockAiConfig);
    const res2 = await localizeText("Welcome", "hi", mockAiConfig);
    expect(res1).toBe("स्वागत है");
    expect(res2).toBe("स्वागत है");
  });
});

describe("localization: localizeNode", () => {
  beforeEach(() => {
    clearTranslationCache();
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

  it("localizes button node text while preserving reply_id and next_node_key", async () => {
    const node: FlowNodeRow = {
      id: "node_1",
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

    const localized = await localizeNode(node, "hi", mockAiConfig);
    const cfg = localized.config as unknown as SendButtonsNodeConfig;

    expect(cfg.text).toBe("स्वागत है");
    expect(cfg.buttons[0].title).toBe("हाँ");
    expect(cfg.buttons[0].reply_id).toBe("btn_yes"); // deterministic ID preserved!
    expect(cfg.buttons[0].next_node_key).toBe("k_yes"); // routing preserved!

    expect(cfg.buttons[1].title).toBe("नहीं");
    expect(cfg.buttons[1].reply_id).toBe("btn_no");
    expect(cfg.buttons[1].next_node_key).toBe("k_no");
  });
});
