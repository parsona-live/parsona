import { describe, expect, it } from "vitest";
import {
  serializeFlowToJson,
  parseFlowFromJson,
  generateChatGptPrompt,
  generateMasterPrompt,
} from "./flow-json";
import type { BuilderState } from "@/components/flows/flow-editor-state";

describe("flow-json serialization & parsing", () => {
  const sampleState: BuilderState = {
    name: "Lead Qualification Bot",
    description: "Qualifies inbound enterprise leads",
    trigger_type: "keyword",
    trigger_config: { keyword: "pricing" },
    entry_node_id: "start_1",
    status: "draft",
    channels: ["whatsapp"],
    nodes: [
      {
        node_key: "start_1",
        node_type: "start",
        position_x: 100,
        position_y: 50,
        config: { next_node_key: "menu_1" },
      },
      {
        node_key: "menu_1",
        node_type: "send_buttons",
        position_x: 100,
        position_y: 200,
        config: {
          text: "How can we help?",
          buttons: [
            { title: "Pricing", reply_id: "btn_pricing", next_node_key: "pricing_msg" },
          ],
        },
      },
      {
        node_key: "pricing_msg",
        node_type: "send_message",
        position_x: 100,
        position_y: 350,
        config: { text: "Our pricing starts at $49/mo." },
      },
    ],
  };

  it("serializes BuilderState to formatted JSON", () => {
    const jsonStr = serializeFlowToJson(sampleState);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.name).toBe("Lead Qualification Bot");
    expect(parsed.entry_node_id).toBe("start_1");
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.nodes[0].ui_position).toEqual({ x: 100, y: 50 });
  });

  it("parses valid JSON back to BuilderState preserving explicit coordinates", () => {
    const jsonStr = serializeFlowToJson(sampleState);
    const res = parseFlowFromJson(jsonStr);
    expect(res.success).toBe(true);
    expect(res.state?.name).toBe("Lead Qualification Bot");
    expect(res.state?.nodes).toHaveLength(3);
    expect(res.state?.nodes[0].position_x).toBe(100);
    expect(res.state?.nodes[0].position_y).toBe(50);
  });

  it("auto-layouts nodes when coordinates are omitted (e.g. from ChatGPT)", () => {
    const chatGptGeneratedJson = JSON.stringify({
      name: "AI Generated Lead Flow",
      trigger_type: "ai_intent",
      trigger_config: { intent_name: "booking" },
      entry_node_id: "welcome",
      nodes: [
        {
          node_key: "welcome",
          node_type: "send_message",
          config: { text: "Hello! Welcome to our service.", next_node_key: "ask_name" },
        },
        {
          node_key: "ask_name",
          node_type: "collect_input",
          config: { text: "What is your name?", variable_name: "lead_name", next_node_key: "confirm" },
        },
        {
          node_key: "confirm",
          node_type: "send_message",
          config: { text: "Thank you {{lead_name}}!" },
        },
      ],
    });

    const res = parseFlowFromJson(chatGptGeneratedJson);
    expect(res.success).toBe(true);
    expect(res.state?.nodes).toHaveLength(3);
    // Since coordinates were omitted, autoLayout should have assigned sensible x/y
    const positions = res.state?.nodes.map((n) => ({ x: n.position_x, y: n.position_y }));
    expect(positions?.[0].y).toBeLessThan(positions?.[1].y!);
    expect(positions?.[1].y).toBeLessThan(positions?.[2].y!);
  });

  it("detects syntax errors in JSON", () => {
    const broken = "{ name: broken_json }";
    const res = parseFlowFromJson(broken);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Invalid JSON syntax");
  });

  it("fails if nodes array is missing or empty", () => {
    const emptyNodes = JSON.stringify({ name: "Test", nodes: [] });
    const res = parseFlowFromJson(emptyNodes);
    expect(res.success).toBe(false);
    expect(res.error).toContain("non-empty 'nodes' array");
  });

  it("detects duplicate node_key values", () => {
    const dup = JSON.stringify({
      name: "Duplicate Keys",
      nodes: [
        { node_key: "node_1", node_type: "send_message" },
        { node_key: "node_1", node_type: "send_message" },
      ],
    });
    const res = parseFlowFromJson(dup);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Duplicate node_key found: "node_1"');
  });

  it("generates a comprehensive ChatGPT prompt", () => {
    const prompt = generateChatGptPrompt(sampleState);
    expect(prompt).toContain("Lead Qualification Bot");
    expect(prompt).toContain("send_buttons");
    expect(prompt).toContain("YOUR TASK");
    expect(prompt).toContain("RULES & INSTRUCTIONS");
  });

  it("generates a rich Master Prompt with all 22+ node types, use cases, and schemas", () => {
    const master = generateMasterPrompt(sampleState);
    expect(master).toContain("MASTER NODE CATALOG & USE CASES");
    expect(master).toContain("send_buttons");
    expect(master).toContain("send_list");
    expect(master).toContain("collect_input");
    expect(master).toContain("ai_decision");
    expect(master).toContain("ai_extract");
    expect(master).toContain("whatsapp_payment");
    expect(master).toContain("whatsapp_form");
    expect(master).toContain("create_deal");
    expect(master).toContain("book_appointment");
    expect(master).toContain("webhook");
    expect(master).toContain("handoff");
    expect(master).toContain("end");
    expect(master).toContain("Lead Qualification Bot");
  });

  it("normalizes collect_input and ai_decision aliases on JSON import", () => {
    const aiJson = JSON.stringify({
      name: "Lead Funnel",
      nodes: [
        {
          node_key: "input_1",
          node_type: "collect_input",
          config: {
            text: "What is your company email?",
            variable_name: "lead_email",
            input_type: "email",
            validation_error_message: "Invalid email",
          },
        },
        {
          node_key: "decision_1",
          node_type: "ai_decision",
          config: {
            decision_prompt: "Determine if lead wants sales or support",
            branches: [
              { label: "Sales Lead", branch_key: "sales", next_node_key: "end_1" },
              { label: "Support Ticket", next_node_key: "end_1" },
            ],
            fallback_next: "end_1",
          },
        },
        {
          node_key: "cond_1",
          node_type: "condition",
          config: {
            variable_name: "lead_budget",
            compare_value: 5000,
            operator: "greater_than",
          },
        },
        {
          node_key: "end_1",
          node_type: "end",
          config: {},
        },
      ],
    });

    const res = parseFlowFromJson(aiJson);
    expect(res.success).toBe(true);

    const inputNode = res.state?.nodes.find((n) => n.node_key === "input_1");
    expect(inputNode?.config.prompt_text).toBe("What is your company email?");
    expect(inputNode?.config.text).toBe("What is your company email?");
    expect(inputNode?.config.var_key).toBe("lead_email");
    expect(inputNode?.config.variable_name).toBe("lead_email");
    expect(inputNode?.config.validation).toBe("email");
    expect(inputNode?.config.invalid_message).toBe("Invalid email");

    const decisionNode = res.state?.nodes.find((n) => n.node_key === "decision_1");
    expect(decisionNode?.config.prompt).toBe("Determine if lead wants sales or support");
    expect(decisionNode?.config.decision_prompt).toBe("Determine if lead wants sales or support");
    expect(decisionNode?.config.fallback_next).toBe("end_1");
    expect(decisionNode?.config.fallback_node_key).toBe("end_1");

    const branches = decisionNode?.config.branches as any[];
    expect(branches).toHaveLength(2);
    expect(branches[0].branch_key).toBe("sales");
    expect(branches[0].description).toBe("Sales Lead");
    expect(branches[0].label).toBe("Sales Lead");
    expect(branches[1].branch_key).toBe("branch_2");
    expect(branches[1].description).toBe("Support Ticket");

    const condNode = res.state?.nodes.find((n) => n.node_key === "cond_1");
    expect(condNode?.config.subject_key).toBe("lead_budget");
    expect(condNode?.config.variable_name).toBe("lead_budget");
    expect(condNode?.config.value).toBe(5000);
    expect(condNode?.config.compare_value).toBe(5000);
  });
});
