/**
 * Two-way Flow JSON Serialization, Deserialization, Validation, and AI Prompt generation.
 *
 * Enables seamless ChatGPT / Claude flow authoring:
 *   - Export visual canvas flows to clean JSON
 *   - Generate prompt templates with full schema instructions
 *   - Parse and validate pasted JSON from AI
 *   - Auto-layout nodes when coordinates are omitted
 *   - Seamless two-way reflection with visual editor
 */

import type { BuilderState } from "@/components/flows/flow-editor-state";
import type { BuilderNode } from "@/components/flows/shared";
import { autoLayoutNodes } from "./layout";

export interface FlowJsonExport {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  entry_node_id: string | null;
  channels?: string[];
  nodes: Array<{
    node_key: string;
    node_type: string;
    ui_position?: { x: number; y: number };
    position_x?: number;
    position_y?: number;
    config: Record<string, unknown>;
  }>;
}

/**
 * Serialize the current visual flow state to formatted JSON string.
 */
export function serializeFlowToJson(state: BuilderState): string {
  const payload: FlowJsonExport = {
    name: state.name || "Untitled Flow",
    description: state.description || "",
    trigger_type: state.trigger_type || "keyword",
    trigger_config: state.trigger_config || {},
    entry_node_id: state.entry_node_id || (state.nodes[0]?.node_key ?? null),
    channels: state.channels,
    nodes: state.nodes.map((node) => ({
      node_key: node.node_key,
      node_type: node.node_type,
      ui_position: {
        x: node.position_x ?? 0,
        y: node.position_y ?? 0,
      },
      config: node.config || {},
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export interface ParseFlowJsonResult {
  success: boolean;
  state?: BuilderState;
  error?: string;
  warnings?: string[];
}

/**
 * Normalizes node config properties across synonyms and aliases so that
 * both the visual canvas, form inspector, and execution engine receive
 * expected field names regardless of which schema format ChatGPT or the user used.
 */
export function normalizeNodeConfig(
  nodeType: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const config: Record<string, unknown> = { ...raw };

  switch (nodeType) {
    case "collect_input":
    case "input_flow": {
      const text = (raw.prompt_text || raw.text || raw.prompt || raw.message || "") as string;
      const varKey = (raw.var_key || raw.variable_name || raw.variable || "input") as string;
      const valType = (raw.validation || raw.input_type || "any") as string;
      const errMsg = (raw.invalid_message || raw.validation_error_message || "") as string;

      config.prompt_text = text;
      config.text = text;
      config.var_key = varKey;
      config.variable_name = varKey;
      config.validation = valType;
      config.input_type = valType;
      if (errMsg) {
        config.invalid_message = errMsg;
        config.validation_error_message = errMsg;
      }
      break;
    }

    case "ai_decision": {
      const prompt = (raw.prompt || raw.decision_prompt || raw.instruction || "") as string;
      config.prompt = prompt;
      config.decision_prompt = prompt;

      const fallback = (raw.fallback_next || raw.fallback_node_key || "") as string;
      config.fallback_next = fallback;
      config.fallback_node_key = fallback;

      if (Array.isArray(raw.branches)) {
        config.branches = raw.branches.map((b: any, idx: number) => {
          const key = (b.branch_key || b.key || b.id || `branch_${idx + 1}`).trim();
          const desc = b.description || b.label || b.name || key;
          return {
            ...b,
            branch_key: key,
            key: key,
            description: desc,
            label: desc,
            next_node_key: b.next_node_key || b.next || b.target || "",
          };
        });
      }
      break;
    }

    case "condition": {
      const varName = (raw.subject_key || raw.variable_name || raw.variable || raw.var_key || "var") as string;
      const val = (raw.value !== undefined ? raw.value : raw.compare_value) ?? "";
      config.subject_key = varName;
      config.variable_name = varName;
      config.value = val;
      config.compare_value = val;
      config.operator = raw.operator || "equals";

      if (raw.true_next || raw.true_next_node_key) {
        const tn = (raw.true_next || raw.true_next_node_key) as string;
        config.true_next = tn;
        config.true_next_node_key = tn;
      }
      if (raw.false_next || raw.false_next_node_key) {
        const fn = (raw.false_next || raw.false_next_node_key) as string;
        config.false_next = fn;
        config.false_next_node_key = fn;
      }
      break;
    }

    case "send_message": {
      const text = (raw.text || raw.message || raw.body || "") as string;
      config.text = text;
      config.message = text;
      if (raw.next || raw.next_node_key) {
        config.next_node_key = (raw.next_node_key || raw.next) as string;
      }
      break;
    }

    case "send_buttons": {
      const text = (raw.text || raw.body_text || raw.message || "") as string;
      config.text = text;
      config.body_text = text;
      if (Array.isArray(raw.buttons)) {
        config.buttons = raw.buttons.map((btn: any, idx: number) => ({
          ...btn,
          title: btn.title || btn.label || `Button ${idx + 1}`,
          reply_id: btn.reply_id || btn.id || btn.key || `btn_${idx + 1}`,
          next_node_key: btn.next_node_key || btn.next || "",
        }));
      }
      break;
    }

    case "send_list": {
      const text = (raw.body_text || raw.text || raw.message || "") as string;
      const btn = (raw.button_label || raw.button_text || "View options") as string;
      config.body_text = text;
      config.text = text;
      config.button_label = btn;
      config.button_text = btn;
      break;
    }

    case "set_tag": {
      const tag = (raw.tag_name || raw.tag || raw.tag_id || "") as string;
      const action = (raw.action || raw.mode || "add") as string;
      config.tag_name = tag;
      config.tag = tag;
      config.action = action;
      config.mode = action;
      break;
    }

    case "update_contact": {
      const field = (raw.field || raw.key || "name") as string;
      const val = (raw.value !== undefined ? raw.value : raw.val) ?? "";
      config.field = field;
      config.key = field;
      config.value = val;
      break;
    }

    case "create_deal": {
      const title = (raw.title || raw.name || "New Deal") as string;
      const val = raw.value !== undefined ? raw.value : raw.amount;
      config.title = title;
      config.name = title;
      if (val !== undefined) config.value = Number(val);
      break;
    }

    case "whatsapp_payment": {
      const amt = raw.amount !== undefined ? raw.amount : raw.value;
      if (amt !== undefined) config.amount = Number(amt);
      config.currency = (raw.currency || "INR") as string;
      const next = (raw.next_node_key || raw.success_next || "") as string;
      if (next) {
        config.next_node_key = next;
        config.success_next = next;
      }
      break;
    }

    case "webhook":
    case "http_fetch": {
      const url = (raw.url || raw.endpoint || "") as string;
      config.url = url;
      config.endpoint = url;
      config.method = ((raw.method as string) || "POST").toUpperCase();
      break;
    }
  }

  return config;
}

/**
 * Parse and validate JSON input, creating a valid BuilderState.
 * Automatically runs auto-layout if positions are omitted or all 0.
 */
export function parseFlowFromJson(
  jsonString: string,
  currentState?: BuilderState,
): ParseFlowJsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Invalid JSON syntax: ${msg}` };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      success: false,
      error: "Flow JSON must be an object containing 'nodes' and flow metadata",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const warnings: string[] = [];

  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : null;
  if (!rawNodes || rawNodes.length === 0) {
    return { success: false, error: "Flow JSON must contain a non-empty 'nodes' array." };
  }

  const seenKeys = new Set<string>();
  const nodes: BuilderNode[] = [];
  let hasExplicitPositions = false;

  for (let i = 0; i < rawNodes.length; i++) {
    const item = rawNodes[i];
    if (!item || typeof item !== "object") {
      return { success: false, error: `Node at index ${i} is not a valid object.` };
    }
    const nodeObj = item as Record<string, unknown>;
    const nodeKey =
      typeof nodeObj.node_key === "string" && nodeObj.node_key.trim()
        ? nodeObj.node_key.trim()
        : `node_${i + 1}`;

    if (seenKeys.has(nodeKey)) {
      return {
        success: false,
        error: `Duplicate node_key found: "${nodeKey}". Every node must have a unique node_key.`,
      };
    }
    seenKeys.add(nodeKey);

    const nodeType = typeof nodeObj.node_type === "string" ? nodeObj.node_type : "send_message";

    let posX = typeof nodeObj.position_x === "number" ? nodeObj.position_x : undefined;
    let posY = typeof nodeObj.position_y === "number" ? nodeObj.position_y : undefined;

    if (
      (posX === undefined || posY === undefined) &&
      nodeObj.ui_position &&
      typeof nodeObj.ui_position === "object"
    ) {
      const uiPos = nodeObj.ui_position as Record<string, unknown>;
      if (typeof uiPos.x === "number") posX = uiPos.x;
      if (typeof uiPos.y === "number") posY = uiPos.y;
    }

    if (posX !== undefined && posY !== undefined && (posX !== 0 || posY !== 0)) {
      hasExplicitPositions = true;
    }

    const rawConfig =
      nodeObj.config && typeof nodeObj.config === "object" && !Array.isArray(nodeObj.config)
        ? (nodeObj.config as Record<string, unknown>)
        : {};

    const config = normalizeNodeConfig(nodeType, rawConfig);

    nodes.push({
      node_key: nodeKey,
      node_type: nodeType as any,
      config,
      position_x: posX ?? 0,
      position_y: posY ?? 0,
    });
  }

  // If positions were missing or all (0,0), auto-layout them cleanly
  const finalNodes = !hasExplicitPositions ? autoLayoutNodes(nodes) : nodes;

  const name =
    typeof obj.name === "string" && obj.name.trim()
      ? obj.name.trim()
      : currentState?.name || "Imported Flow";

  const description =
    typeof obj.description === "string"
      ? obj.description
      : currentState?.description || "";

  const triggerType =
    typeof obj.trigger_type === "string" &&
    ["keyword", "first_inbound_message", "manual", "ai_intent"].includes(obj.trigger_type)
      ? (obj.trigger_type as BuilderState["trigger_type"])
      : currentState?.trigger_type || "keyword";

  const triggerConfig =
    obj.trigger_config && typeof obj.trigger_config === "object" && !Array.isArray(obj.trigger_config)
      ? (obj.trigger_config as Record<string, unknown>)
      : currentState?.trigger_config || {};

  let entryNodeId =
    typeof obj.entry_node_id === "string" && seenKeys.has(obj.entry_node_id)
      ? obj.entry_node_id
      : null;

  if (!entryNodeId) {
    const startNode = finalNodes.find((n) => n.node_type === "start");
    entryNodeId = startNode ? startNode.node_key : finalNodes[0].node_key;
    warnings.push(`entry_node_id was inferred as "${entryNodeId}".`);
  }

  const newState: BuilderState = {
    name,
    description,
    trigger_type: triggerType,
    trigger_config: triggerConfig,
    entry_node_id: entryNodeId,
    status: currentState?.status || "draft",
    channels: Array.isArray(obj.channels) ? (obj.channels as any) : currentState?.channels,
    nodes: finalNodes,
  };

  return {
    success: true,
    state: newState,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Generate a ready-to-paste prompt for ChatGPT / Claude containing
 * the current flow JSON schema and comprehensive instructions.
 */
export function generateChatGptPrompt(state: BuilderState): string {
  const jsonSchema = serializeFlowToJson(state);
  return `You are an expert WhatsApp and omnichannel conversational flow architect.
Below is the existing flow definition in JSON format:

\`\`\`json
${jsonSchema}
\`\`\`

YOUR TASK:
[Describe what you want to add/modify, e.g. "Add a lead qualification step asking for their budget with 3 buttons ($1k, $5k, $10k+). If $10k+, create a high-value deal and notify sales; otherwise send a standard catalog."]

RULES & INSTRUCTIONS:
1. Return ONLY the complete, valid updated JSON enclosed in a single \`\`\`json codeblock.
2. Every node must have:
   - "node_key": unique alphanumeric string (e.g. "ask_budget", "lead_deal")
   - "node_type": one of:
     * "send_message": { "text": "...", "next_node_key": "..." }
     * "send_buttons": { "text": "...", "buttons": [{ "title": "...", "reply_id": "...", "next_node_key": "..." }] }
     * "send_list": { "text": "...", "button_text": "View Options", "sections": [{ "title": "Options", "rows": [{ "id": "...", "title": "...", "description": "...", "next_node_key": "..." }] }] }
     * "collect_input": { "text": "Please provide your email:", "variable_name": "lead_email", "input_type": "email", "next_node_key": "..." }
     * "condition": { "variable_name": "lead_budget", "operator": "greater_than", "compare_value": "5000", "true_next_node_key": "...", "false_next_node_key": "..." }
     * "ai_decision": { "decision_prompt": "Classify if customer needs sales or support", "branches": [{ "branch_key": "sales", "label": "Sales", "next_node_key": "..." }, { "branch_key": "support", "label": "Support", "next_node_key": "..." }], "fallback_next": "..." }
     * "ai_extract": { "instruction": "Extract user's name and company", "target_var": "extracted_info", "next_node_key": "..." }
     * "set_tag": { "tag_name": "High Priority", "action": "add", "next_node_key": "..." }
     * "create_deal": { "title": "Inbound Lead", "value": 10000, "stage": "Qualified", "next_node_key": "..." }
     * "webhook": { "url": "https://api.crm.com/leads", "method": "POST", "body": "{}", "next_node_key": "..." }
     * "end": {}
3. Ensure all "next_node_key" references point to an existing node's "node_key".
4. You do NOT need to calculate coordinates (ui_position / position_x / position_y); the editor will auto-layout nodes automatically.`;
}

/**
 * Generate a comprehensive MASTER AI PROMPT containing:
 *   - Complete node encyclopedia with every supported node type
 *   - Real-world business use cases for each node
 *   - Exact JSON configuration schemas for all 22+ nodes
 *   - The active flow JSON context
 *   - Architecture & connection rules so any LLM (ChatGPT, Claude, etc.) can generate flawless industrial-grade flows.
 */
export function generateMasterPrompt(state: BuilderState): string {
  const jsonSchema = serializeFlowToJson(state);

  return `You are the Lead Conversational Automation Architect and WhatsApp CRM Flow Engineer.
Your objective is to design, extend, or optimize enterprise-grade conversation flows that qualify leads, automate customer service, collect payments, and drive business revenue.

============================================================
CURRENT FLOW DEFINITION (JSON)
============================================================
\`\`\`json
${jsonSchema}
\`\`\`

============================================================
YOUR TASK
============================================================
[Describe your goal here, e.g.:
 "Refactor this flow into a full lead qualification funnel:
  1. Welcome the lead and ask their company size with 3 quick buttons (1-10, 11-50, 50+).
  2. If 50+, route via AI Decision to ask for their corporate email, tag them as 'Enterprise VIP', create a $25,000 CRM deal, and book an executive consultation call.
  3. If 1-10, send our standard product catalog and collect a $99 self-serve setup payment via WhatsApp Payment.
  4. Include fallback handling and human agent handoff if customer asks for a person."]

============================================================
FLOW ENGINE 2.0: MASTER NODE CATALOG & USE CASES
============================================================
Every node in the "nodes" array MUST have:
  - "node_key": (string) Unique identifier (e.g. "welcome_step", "qualify_budget").
  - "node_type": (string) One of the supported node types documented below.
  - "config": (object) The exact configuration properties for that node type.
  - Optional "ui_position": { "x": number, "y": number } (Can be omitted; the visual editor auto-arranges coordinates).

------------------------------------------------------------
1. CUSTOMER MESSAGING & INTERACTION NODES
------------------------------------------------------------
• "send_message"
  Use Case: Send text messages, announcements, instructions, or thank-you notes. Can include media headers (images, video, documents).
  Schema:
  {
    "node_key": "msg_step",
    "node_type": "send_message",
    "config": {
      "text": "Hi {{contact.name}}! Thanks for contacting us.",
      "header_type": "none", // "none" | "image" | "video" | "document"
      "header_media_url": "", // optional URL if header_type != "none"
      "next_node_key": "next_node_key"
    }
  }

• "send_buttons"
  Use Case: Fast interactive decisions with up to 3 quick-reply buttons (button title ≤ 20 chars).
  Schema:
  {
    "node_key": "choose_tier",
    "node_type": "send_buttons",
    "config": {
      "text": "What is your primary interest?",
      "buttons": [
        { "title": "Enterprise Sales", "reply_id": "tier_ent", "next_node_key": "enterprise_flow" },
        { "title": "Small Business", "reply_id": "tier_smb", "next_node_key": "smb_flow" },
        { "title": "Talk to Human", "reply_id": "tier_human", "next_node_key": "handoff_flow" }
      ]
    }
  }

• "send_list"
  Use Case: Structured menu dropdown with up to 10 options organized into sections (row title ≤ 24 chars).
  Schema:
  {
    "node_key": "service_menu",
    "node_type": "send_list",
    "config": {
      "text": "Please choose a service from our menu:",
      "button_text": "Select Option",
      "sections": [
        {
          "title": "Consulting Services",
          "rows": [
            { "id": "srv_audit", "title": "Tech Stack Audit", "description": "Review your current CRM ($500)", "next_node_key": "audit_step" },
            { "id": "srv_impl", "title": "Full Implementation", "description": "Custom setup & training", "next_node_key": "impl_step" }
          ]
        }
      ]
    }
  }

• "send_media"
  Use Case: Send brochures (PDF), introductory videos, product photos, or audio recordings.
  Schema:
  {
    "node_key": "send_pdf",
    "node_type": "send_media",
    "config": {
      "media_type": "document", // "image" | "video" | "audio" | "document"
      "media_url": "https://cdn.example.com/brochure.pdf",
      "caption": "Here is our product specification guide.",
      "next_node_key": "next_node_key"
    }
  }

• "send_carousel"
  Use Case: Showcase multiple products or services in a horizontal swipeable card carousel on WhatsApp & Instagram.
  Schema:
  {
    "node_key": "carousel_step",
    "node_type": "send_carousel",
    "config": {
      "cards": [
        {
          "card_index": 0,
          "text": "Plan A - Unlimited WhatsApp",
          "media_url": "https://cdn.example.com/plan_a.png",
          "buttons": [{ "title": "Choose Plan A", "reply_id": "plan_a", "next_node_key": "checkout_a" }]
        }
      ]
    }
  }

• "send_location"
  Use Case: Send a physical store, office, or venue map location with coordinates.
  Schema:
  {
    "node_key": "share_office",
    "node_type": "send_location",
    "config": {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "name": "Headquarters",
      "address": "Connaught Place, New Delhi",
      "next_node_key": "next_node_key"
    }
  }

• "send_contact"
  Use Case: Send a vCard with direct phone, email, and name of an account manager.
  Schema:
  {
    "node_key": "share_rep",
    "node_type": "send_contact",
    "config": {
      "formatted_name": "Sarah Connor - Account Director",
      "phones": [{ "phone": "+14155552671", "type": "WORK" }],
      "next_node_key": "next_node_key"
    }
  }

------------------------------------------------------------
2. DATA COLLECTION & LOGIC NODES
------------------------------------------------------------
• "collect_input"
  Use Case: Ask questions (email, phone, budget, name) and store the response into a variable. Automatically validates format.
  Schema:
  {
    "node_key": "get_email",
    "node_type": "collect_input",
    "config": {
      "text": "What is your work email address?",
      "variable_name": "lead_email",
      "input_type": "email", // "email" | "phone" | "number" | "text"
      "validation_error_message": "Please enter a valid work email address (e.g. name@company.com):",
      "next_node_key": "next_node_key"
    }
  }

• "condition"
  Use Case: Branching logic based on variable values. Supports operators: "equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty".
  Schema:
  {
    "node_key": "check_team_size",
    "node_type": "condition",
    "config": {
      "variable_name": "team_size",
      "operator": "greater_than",
      "compare_value": "20",
      "true_next_node_key": "enterprise_deal_step",
      "false_next_node_key": "standard_deal_step"
    }
  }

• "delay"
  Use Case: Delay the next message by a set number of seconds (e.g. 5 seconds for natural pacing or follow-ups).
  Schema:
  {
    "node_key": "natural_pause",
    "node_type": "delay",
    "config": {
      "delay_seconds": 5,
      "next_node_key": "next_node_key"
    }
  }

------------------------------------------------------------
3. ARTIFICIAL INTELLIGENCE (AI) NODES
------------------------------------------------------------
• "ai_decision"
  Use Case: Route customer requests using LLM intelligence based on conversational intent, sentiment, or criteria.
  Schema:
  {
    "node_key": "ai_triage",
    "node_type": "ai_decision",
    "config": {
      "decision_prompt": "Evaluate whether customer needs sales inquiry, tech support, or billing based on their message.",
      "branches": [
        { "branch_key": "sales", "label": "Sales Inquiry", "next_node_key": "sales_step" },
        { "branch_key": "support", "label": "Technical Support", "next_node_key": "support_step" },
        { "branch_key": "billing", "label": "Billing Issues", "next_node_key": "billing_step" }
      ],
      "fallback_next": "general_step"
    }
  }

• "ai_extract"
  Use Case: Extract multiple entities (name, company, timeline, budget) from natural freeform text into a structured JSON variable.
  Schema:
  {
    "node_key": "extract_entities",
    "node_type": "ai_extract",
    "config": {
      "instruction": "Extract the lead's full name, company name, and budget from the user's message into JSON.",
      "target_var": "extracted_lead",
      "next_node_key": "next_node_key"
    }
  }

• "ai_message"
  Use Case: Generate a contextual dynamic response using an LLM prompt.
  Schema:
  {
    "node_key": "dynamic_ai_reply",
    "node_type": "ai_message",
    "config": {
      "prompt": "You are a senior real estate advisor. Answer the lead's question about mortgage rates clearly and concisely.",
      "next_node_key": "next_node_key"
    }
  }

• "ai_summarize"
  Use Case: Summarize the conversation history or collected inputs into an executive note.
  Schema:
  {
    "node_key": "summarize_lead",
    "node_type": "ai_summarize",
    "config": {
      "target_var": "lead_summary",
      "next_node_key": "next_node_key"
    }
  }

------------------------------------------------------------
4. BUSINESS, CRM & COMMERCIAL ACTIONS
------------------------------------------------------------
• "create_deal"
  Use Case: Automatically create a deal/opportunity in the CRM sales pipeline when a lead qualifies.
  Schema:
  {
    "node_key": "create_crm_deal",
    "node_type": "create_deal",
    "config": {
      "title": "Enterprise Lead - {{contact.name}}",
      "value": 15000,
      "stage": "Qualified",
      "next_node_key": "next_node_key"
    }
  }

• "whatsapp_payment"
  Use Case: Send native WhatsApp in-chat UPI/card payment requests (Razorpay, PayU, Stripe) for booking fees or orders.
  Schema:
  {
    "node_key": "collect_fee",
    "node_type": "whatsapp_payment",
    "config": {
      "payment_configuration": "razorpay_default",
      "amount": 999,
      "currency": "INR",
      "description": "Consultation Slot Booking Fee",
      "success_next": "payment_success_step",
      "failure_next": "payment_failed_step",
      "next_node_key": "payment_success_step"
    }
  }

• "whatsapp_form"
  Use Case: Open native Meta WhatsApp interactive multi-screen flows/forms inside the chat.
  Schema:
  {
    "node_key": "open_flow_form",
    "node_type": "whatsapp_form",
    "config": {
      "flow_id": "wa_flow_lead_capture_01",
      "flow_token": "token_lead_123",
      "flow_cta": "Fill Details",
      "screen_id": "SCREEN_START",
      "next_node_key": "after_form_step"
    }
  }

• "catalog"
  Use Case: Send Meta WhatsApp commerce product catalog or collection.
  Schema:
  {
    "node_key": "show_catalog",
    "node_type": "catalog",
    "config": {
      "catalog_id": "catalog_default",
      "body_text": "Explore our full catalog:",
      "thumbnail_product_retailer_id": "sku_hero_product",
      "next_node_key": "after_catalog_step"
    }
  }

• "book_appointment"
  Use Case: Book a calendar consultation slot or demo call.
  Schema:
  {
    "node_key": "schedule_call",
    "node_type": "book_appointment",
    "config": {
      "provider": "internal",
      "duration_minutes": 30,
      "title": "Strategy Consultation",
      "success_next": "booking_success_step",
      "failure_next": "booking_retry_step",
      "next_node_key": "booking_success_step"
    }
  }

• "set_tag"
  Use Case: Add or remove CRM tags (e.g. 'VIP', 'Qualified', 'Hot Lead') on the contact.
  Schema:
  {
    "node_key": "tag_lead",
    "node_type": "set_tag",
    "config": {
      "tag_name": "VIP Enterprise",
      "action": "add", // "add" | "remove"
      "next_node_key": "next_node_key"
    }
  }

• "update_contact"
  Use Case: Update contact attributes in the CRM (name, custom fields).
  Schema:
  {
    "node_key": "update_lead_info",
    "node_type": "update_contact",
    "config": {
      "field": "company",
      "value": "{{extracted_company}}",
      "next_node_key": "next_node_key"
    }
  }

• "webhook"
  Use Case: Make HTTP GET/POST calls to external APIs, Zapier, Make, n8n, or backend webhooks.
  Schema:
  {
    "node_key": "sync_to_erp",
    "node_type": "webhook",
    "config": {
      "url": "https://api.mycompany.com/v1/leads",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer api_secret_token",
        "Content-Type": "application/json"
      },
      "body": "{\"phone\":\"{{contact.phone}}\",\"email\":\"{{lead_email}}\",\"deal_value\":15000}",
      "save_response_var": "webhook_res",
      "next_node_key": "webhook_ok",
      "failure_next": "webhook_err"
    }
  }

• "send_email"
  Use Case: Send instant internal email alerts to sales reps or confirmation emails to customers.
  Schema:
  {
    "node_key": "alert_sales_rep",
    "node_type": "send_email",
    "config": {
      "to": "sales@mycompany.com",
      "subject": "🔥 Hot Lead Alert: {{contact.name}} (Budget: USD {{lead_budget}})",
      "body": "A new qualified lead has arrived:\\nName: {{contact.name}}\\nPhone: {{contact.phone}}\\nSummary: {{lead_summary}}",
      "next_node_key": "next_node_key"
    }
  }

• "add_to_group" / "remove_from_group"
  Use Case: Add/remove contact from CRM audience groups or broadcast lists.
  Schema:
  {
    "node_key": "add_to_onboarding",
    "node_type": "add_to_group",
    "config": {
      "group_id": "grp_onboarding_drip",
      "next_node_key": "next_node_key"
    }
  }

------------------------------------------------------------
5. FLOW CONTROL & HANDOFF
------------------------------------------------------------
• "handoff" (or "agent_handover")
  Use Case: Pause the flow automation and assign the thread to human agents in the CRM Inbox.
  Schema:
  {
    "node_key": "transfer_to_support",
    "node_type": "handoff",
    "config": {
      "reason": "Customer requested live support agent",
      "notify_agents": true
    }
  }

• "end"
  Use Case: Complete the flow cleanly.
  Schema:
  {
    "node_key": "end_flow",
    "node_type": "end",
    "config": {}
  }

============================================================
RULES FOR PRODUCING VALID FLOW JSON
============================================================
1. Output ONLY a valid JSON object wrapped in a single \`\`\`json ... \`\`\` code fence.
2. The root object must contain:
   - "name": string
   - "description": string
   - "trigger_type": "keyword" | "first_inbound_message" | "manual" | "ai_intent"
   - "trigger_config": object (e.g. { "keywords": ["quote", "price"] } or { "intent_name": "book_appointment" })
   - "entry_node_id": string (must match the node_key of the first node)
   - "nodes": array of node objects
3. Every "next_node_key" or branch target MUST match a real "node_key" in the "nodes" array.
4. You do NOT need to calculate coordinates (ui_position / position_x / position_y); the visual editor automatically calculates optimal Dagre layout positions when imported.
`;
}

