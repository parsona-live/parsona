import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: {
    activeRuns: [] as unknown[],
    flows: [] as unknown[],
    nodes: [] as unknown[],
    inserted: [] as { table: string; row: Record<string, unknown> }[],
    insertedRun: null as Record<string, unknown> | null,
    rpcCalls: [] as string[],
  },
}));

vi.mock("./admin-client", () => {
  function rows(table: string): unknown[] {
    if (table === "flow_runs") return h.state.activeRuns;
    if (table === "flows") return h.state.flows;
    if (table === "flow_nodes") return h.state.nodes;
    return [];
  }

  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: () => b,
      filter: () => b,
      order: () => b,
      limit: () => b,
      update: () => b,
      insert: (row: Record<string, unknown>) => {
        h.state.inserted.push({ table, row });
        if (table === "flow_runs") {
          h.state.insertedRun = {
            id: "run-multi-1",
            vars: {},
            reprompt_count: 0,
            ...row,
          };
        }
        return b;
      },
      maybeSingle: async () => ({
        data: table === "flow_runs" ? h.state.insertedRun : (rows(table)[0] ?? null),
        error: null,
      }),
      single: async () => ({ data: rows(table)[0] ?? null, error: null }),
      then: (
        resolve: (r: {
          data: unknown[];
          error: null;
          count: number;
        }) => unknown,
      ) => resolve({ data: rows(table), error: null, count: 0 }),
    };
    return b;
  }

  return {
    supabaseAdmin: () => ({
      from: (t: string) => builder(t),
      rpc: (name: string) => {
        h.state.rpcCalls.push(name);
        return Promise.resolve({ error: null });
      },
    }),
  };
});

const engineSendText = vi.fn(async () => ({ whatsapp_message_id: "wamid.1" }));
const engineSendInteractiveButtons = vi.fn(async () => ({ whatsapp_message_id: "wamid.btn" }));

vi.mock("./meta-send", () => ({
  loadAccountMetaCredentials: vi.fn(async () => ({
    phoneNumberId: "phone_1",
    accessToken: "token_1",
  })),
  engineSendText: (...a: unknown[]) =>
    (engineSendText as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendMedia: vi.fn(async () => ({ whatsapp_message_id: "wamid.2" })),
  engineSendInteractiveButtons: (...a: unknown[]) =>
    (engineSendInteractiveButtons as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendInteractiveList: vi.fn(async () => ({ whatsapp_message_id: "wamid.4" })),
  engineSendInteractiveCarousel: vi.fn(async () => ({ whatsapp_message_id: "wamid.5" })),
  engineSendAddressMessage: vi.fn(async () => ({ whatsapp_message_id: "wamid.6" })),
  engineSendLocation: vi.fn(async () => ({ whatsapp_message_id: "wamid.7" })),
  engineSendContacts: vi.fn(async () => ({ whatsapp_message_id: "wamid.8" })),
}));

vi.mock("@/lib/ai/generate", () => ({
  generateReply: vi.fn(async ({ systemPrompt, messages }) => {
    const text = messages[0]?.content || "";
    if (systemPrompt?.includes("Hinglish")) {
      return { text: `Hinglish: ${text}` };
    }
    if (systemPrompt?.includes("Hindi")) {
      return { text: `Hindi: ${text}` };
    }
    return { text: `Localized: ${text}` };
  }),
}));

vi.mock("@/lib/ai/config", () => ({
  loadAiConfig: vi.fn(async () => ({
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
  })),
}));

import { dispatchInboundToFlows } from "./engine";

describe("multilingual flows dispatch", () => {
  beforeEach(() => {
    h.state.activeRuns = [];
    h.state.flows = [];
    h.state.nodes = [];
    h.state.inserted = [];
    h.state.insertedRun = null;
    h.state.rpcCalls = [];
    engineSendText.mockClear();
    engineSendInteractiveButtons.mockClear();
  });

  const baseFlow = {
    id: "flow-1",
    account_id: "acc-1",
    user_id: "usr-1",
    name: "Customer Support Flow",
    status: "active",
    entry_node_id: "k_start",
    trigger_type: "first_inbound_message",
    trigger_config: {},
    fallback_policy: { type: "end" },
  };

  const startNode = {
    id: "node-start",
    flow_id: "flow-1",
    node_key: "k_start",
    node_type: "start",
    config: { next_node_key: "k_msg" },
  };

  it("detects Hindi Devanagari on inbound and dispatches localized Hindi message", async () => {
    const messageNode = {
      id: "node-msg",
      flow_id: "flow-1",
      node_key: "k_msg",
      node_type: "send_message",
      config: { text: "Hello, welcome to our store!" },
    };

    h.state.flows = [baseFlow];
    h.state.nodes = [startNode, messageNode];

    const result = await dispatchInboundToFlows({
      accountId: "acc-1",
      userId: "usr-1",
      contactId: "ct-1",
      conversationId: "conv-1",
      isFirstInboundMessage: true,
      message: {
        kind: "text",
        text: "नमस्ते मुझे मदद चाहिए", // Hindi
        meta_message_id: "m-hi-1",
      },
    });

    expect(result.consumed).toBe(true);
    // Verified engineSendText received Hindi localized text!
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hindi: Hello, welcome to our store!",
      }),
    );
  });

  it("detects Hinglish on inbound and dispatches localized Hinglish message", async () => {
    const messageNode = {
      id: "node-msg",
      flow_id: "flow-1",
      node_key: "k_msg",
      node_type: "send_message",
      config: { text: "Hello, welcome to our store!" },
    };

    h.state.flows = [baseFlow];
    h.state.nodes = [startNode, messageNode];

    const result = await dispatchInboundToFlows({
      accountId: "acc-1",
      userId: "usr-1",
      contactId: "ct-2",
      conversationId: "conv-2",
      isFirstInboundMessage: true,
      message: {
        kind: "text",
        text: "bhai mujhe details chahiye", // Hinglish
        meta_message_id: "m-hinglish-1",
      },
    });

    expect(result.consumed).toBe(true);
    // Verified engineSendText received Hinglish localized text!
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hinglish: Hello, welcome to our store!",
      }),
    );
  });

  it("uses pre-saved translations in node.config.translations directly", async () => {
    const messageNode = {
      id: "node-msg",
      flow_id: "flow-1",
      node_key: "k_msg",
      node_type: "send_message",
      config: {
        text: "Hello, welcome to our store!",
        translations: {
          hinglish: { text: "Bhai humare store mein aapka swagat hai!" },
        },
      },
    };

    h.state.flows = [baseFlow];
    h.state.nodes = [startNode, messageNode];

    const result = await dispatchInboundToFlows({
      accountId: "acc-1",
      userId: "usr-1",
      contactId: "ct-3",
      conversationId: "conv-3",
      isFirstInboundMessage: true,
      message: {
        kind: "text",
        text: "bhai price kya hai", // Hinglish
        meta_message_id: "m-hinglish-2",
      },
    });

    expect(result.consumed).toBe(true);
    // Verified engineSendText directly used pre-saved translation!
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Bhai humare store mein aapka swagat hai!",
      }),
    );
  });

  it("preserves English default message so subsequent English users still get pure English", async () => {
    const messageNode = {
      id: "node-msg-persist",
      flow_id: "flow-1",
      node_key: "k_msg",
      node_type: "send_message",
      config: { text: "Hello, welcome to our store!" },
    };

    h.state.flows = [baseFlow];
    h.state.nodes = [startNode, messageNode];

    // 1. Hindi user arrives
    await dispatchInboundToFlows({
      accountId: "acc-1",
      userId: "usr-1",
      contactId: "ct-hi",
      conversationId: "conv-hi",
      isFirstInboundMessage: true,
      message: {
        kind: "text",
        text: "नमस्ते",
        meta_message_id: "m-hi",
      },
    });

    expect(engineSendText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: "Hindi: Hello, welcome to our store!",
      }),
    );

    // 2. English user arrives next
    await dispatchInboundToFlows({
      accountId: "acc-1",
      userId: "usr-1",
      contactId: "ct-en",
      conversationId: "conv-en",
      isFirstInboundMessage: true,
      message: {
        kind: "text",
        text: "Hello",
        meta_message_id: "m-en",
      },
    });

    // CRITICAL: English user still receives pure English, root message was NOT overwritten!
    expect(engineSendText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: "Hello, welcome to our store!",
      }),
    );
  });
});
