/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
  WhatsAppPaymentNodeConfig,
  BookAppointmentNodeConfig,
  CreateDealNodeConfig,
  AgentHandoverNodeConfig,
  CatalogNodeConfig,
  FlowNodeType,
} from "./types";
import { getT } from "@/lib/i18n/translate";

export type FlowTemplateNodeType = FlowNodeType;

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | WhatsAppPaymentNodeConfig
    | BookAppointmentNodeConfig
    | CreateDealNodeConfig
    | AgentHandoverNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: "MessageSquare" | "HelpCircle" | "UserPlus" | "CreditCard" | "Calendar" | "Award" | string;
  trigger_type: "keyword" | "first_inbound_message" | "manual" | "ai_intent";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

const t = getT("StarterFlows");

/** Comma-separated keyword list from the catalogue → trimmed array. */
function keywords(key: string): string[] {
  return t(key)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// ============================================================
// 1. Welcome menu — the example from the owner's brief
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: t("welcome_menu.name"),
  description: t("welcome_menu.description"),
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: keywords("welcome_menu.keywords"), match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: t("welcome_menu.text"),
        footer_text: t("welcome_menu.footer"),
        buttons: [
          {
            reply_id: "existing",
            title: t("welcome_menu.existingButton"),
            next_node_key: "existing_handoff",
          },
          {
            reply_id: "new",
            title: t("welcome_menu.newButton"),
            next_node_key: "new_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "existing_handoff",
      node_type: "handoff",
      config: {
        note: t("welcome_menu.existingNote"),
      } as HandoffNodeConfig,
    },
    {
      node_key: "new_handoff",
      node_type: "handoff",
      config: {
        note: t("welcome_menu.newNote"),
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot — list-message answers, fully automated
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: t("faq_bot.name"),
  description: t("faq_bot.description"),
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: keywords("faq_bot.keywords"),
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: t("faq_bot.text"),
        button_label: t("faq_bot.buttonLabel"),
        sections: [
          {
            title: t("faq_bot.commonSection"),
            rows: [
              {
                reply_id: "hours",
                title: t("faq_bot.hoursRow"),
                next_node_key: "answer_hours",
              },
              {
                reply_id: "pricing",
                title: t("faq_bot.pricingRow"),
                next_node_key: "answer_pricing",
              },
              {
                reply_id: "refunds",
                title: t("faq_bot.refundsRow"),
                next_node_key: "answer_refunds",
              },
            ],
          },
          {
            title: t("faq_bot.otherSection"),
            rows: [
              {
                reply_id: "human",
                title: t("faq_bot.humanRow"),
                next_node_key: "human_handoff",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "answer_hours",
      node_type: "send_message",
      config: {
        text: t("faq_bot.hoursAnswer"),
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_pricing",
      node_type: "send_message",
      config: {
        text: t("faq_bot.pricingAnswer"),
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_refunds",
      node_type: "send_message",
      config: {
        text: t("faq_bot.refundsAnswer"),
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "human_handoff",
      node_type: "handoff",
      config: {
        note: t("faq_bot.humanNote"),
      } as HandoffNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture — collect_input chain, ends in a handoff
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: t("lead_capture.name"),
  description: t("lead_capture.description"),
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "intro" },
    },
    {
      node_key: "intro",
      node_type: "send_message",
      config: {
        text: t("lead_capture.intro"),
        next_node_key: "ask_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_name",
      node_type: "collect_input",
      config: {
        prompt_text: t("lead_capture.askName"),
        var_key: "name",
        next_node_key: "ask_email",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_email",
      node_type: "collect_input",
      config: {
        prompt_text: t("lead_capture.askEmail", { name: "{{vars.name}}" }),
        var_key: "email",
        next_node_key: "ask_company",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_company",
      node_type: "collect_input",
      config: {
        prompt_text: t("lead_capture.askCompany"),
        var_key: "company",
        next_node_key: "handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: t("lead_capture.handoffNote", {
          name: "{{vars.name}}",
          email: "{{vars.email}}",
          company: "{{vars.company}}",
        }),
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 4. Instant Checkout & Razorpay Payment
// ============================================================
const INSTANT_CHECKOUT: FlowTemplate = {
  slug: "instant_checkout",
  name: "Smart Checkout & Razorpay Payment",
  description: "Collect payments via automated Razorpay links, interactive Pay/Cancel buttons, and instant webhook fulfillment.",
  icon: "CreditCard",
  trigger_type: "keyword",
  trigger_config: { keywords: ["pay", "order", "buy", "checkout"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "select_plan" },
    },
    {
      node_key: "select_plan",
      node_type: "send_buttons",
      config: {
        text: "Select a package to proceed with your order:",
        footer_text: "Secure checkout powered by Razorpay",
        buttons: [
          { reply_id: "standard", title: "Standard (₹499)", next_node_key: "pay_standard" },
          { reply_id: "premium", title: "Premium (₹999)", next_node_key: "pay_premium" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "pay_standard",
      node_type: "whatsapp_payment",
      config: {
        amount: 499,
        currency: "INR",
        item_name: "Standard Package",
        provider: "razorpay",
        wait_for_payment: true,
        success_next: "payment_success",
        cancel_next: "payment_cancelled",
        next_node_key: "payment_success",
      } as WhatsAppPaymentNodeConfig,
    },
    {
      node_key: "pay_premium",
      node_type: "whatsapp_payment",
      config: {
        amount: 999,
        currency: "INR",
        item_name: "Premium Package",
        provider: "razorpay",
        wait_for_payment: true,
        success_next: "payment_success",
        cancel_next: "payment_cancelled",
        next_node_key: "payment_success",
      } as WhatsAppPaymentNodeConfig,
    },
    {
      node_key: "payment_success",
      node_type: "send_message",
      config: {
        text: "🎉 Payment received! Your order for *{{vars.payment_item}}* is confirmed. Receipt ID: {{vars.razorpay_payment_id}}.",
        next_node_key: "create_deal_record",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "create_deal_record",
      node_type: "create_deal",
      config: {
        title: "Order: {{vars.payment_item}} - {{contact.name}}",
        value: "{{vars.payment_amount}}",
        currency: "INR",
        next_node_key: "end",
      } as CreateDealNodeConfig,
    },
    {
      node_key: "payment_cancelled",
      node_type: "send_message",
      config: {
        text: "Your order was cancelled. Feel free to type *order* anytime if you'd like to try again!",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 5. Service Consultation Booking
// ============================================================
const SERVICE_BOOKING: FlowTemplate = {
  slug: "service_consultation_booking",
  name: "Service Consultation Booking",
  description: "Qualify client needs, generate a prefilled Cal.com booking link, and create a CRM deal.",
  icon: "Calendar",
  trigger_type: "keyword",
  trigger_config: { keywords: ["book", "consultation", "schedule", "appointment"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "ask_requirement" },
    },
    {
      node_key: "ask_requirement",
      node_type: "collect_input",
      config: {
        prompt_text: "What specific project or consultation service would you like to discuss with our team?",
        var_key: "consultation_topic",
        validation: "any",
        next_node_key: "create_consultation_deal",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "create_consultation_deal",
      node_type: "create_deal",
      config: {
        title: "Consultation: {{vars.consultation_topic}} - {{contact.name}}",
        value: 1500,
        currency: "INR",
        next_node_key: "book_slot",
      } as CreateDealNodeConfig,
    },
    {
      node_key: "book_slot",
      node_type: "book_appointment",
      config: {
        booking_url: "https://cal.com/your-team/30min",
        prompt_text: "Please select a convenient time for your 30-min strategy session:",
        next_node_key: "booking_confirmation",
      } as BookAppointmentNodeConfig,
    },
    {
      node_key: "booking_confirmation",
      node_type: "send_message",
      config: {
        text: "Thank you! Our specialists have received your request and look forward to speaking with you.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 6. Enterprise BANT Lead Qualifier
// ============================================================
const BANT_QUALIFIER: FlowTemplate = {
  slug: "enterprise_bant_qualifier",
  name: "Enterprise BANT Lead Qualifier",
  description: "Collect budget & requirements, qualify leads with numeric condition logic, and route enterprise clients to sales.",
  icon: "Award",
  trigger_type: "keyword",
  trigger_config: { keywords: ["enterprise", "quote", "pricing", "demo"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "ask_budget" },
    },
    {
      node_key: "ask_budget",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your estimated monthly budget for this automation solution (in INR)?",
        var_key: "lead_budget",
        validation: "number",
        next_node_key: "evaluate_budget",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "evaluate_budget",
      node_type: "condition",
      config: {
        subject: "var",
        subject_key: "lead_budget",
        operator: "greater_or_equal",
        value: "50000",
        true_next: "create_enterprise_deal",
        false_next: "self_serve_info",
      } as ConditionNodeConfig,
    },
    {
      node_key: "create_enterprise_deal",
      node_type: "create_deal",
      config: {
        title: "Enterprise Lead (₹{{vars.lead_budget}}) - {{contact.name}}",
        value: "{{vars.lead_budget}}",
        currency: "INR",
        next_node_key: "handover_to_sales",
      } as CreateDealNodeConfig,
    },
    {
      node_key: "handover_to_sales",
      node_type: "agent_handover",
      config: {
        note: "High-value enterprise lead with monthly budget ₹{{vars.lead_budget}}.",
      } as AgentHandoverNodeConfig,
    },
    {
      node_key: "self_serve_info",
      node_type: "send_message",
      config: {
        text: "Thank you for inquiring! Here is our standard product guide and starter pricing: https://example.com/starter-guide",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 7. Real Estate High-Ticket Buyer Qualifier
// ============================================================
const REAL_ESTATE_QUALIFIER: FlowTemplate = {
  slug: "real_estate_buyer_qualifier",
  name: "Real Estate Buyer Qualification & Triage",
  description: "Capture property preferences, triage high-budget investors, present catalog listings, and assign VIP leads to sales agents.",
  icon: "Award",
  trigger_type: "keyword",
  trigger_config: { keywords: ["property", "flat", "apartment", "villa", "real estate", "plot"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "select_property_type" },
    },
    {
      node_key: "select_property_type",
      node_type: "send_buttons",
      config: {
        text: "Welcome to our Premier Realty Desk! Which property type are you looking to purchase?",
        footer_text: "Select an option below",
        buttons: [
          { reply_id: "villa", title: "Luxury Villa", next_node_key: "ask_budget" },
          { reply_id: "apartment", title: "Premium Apartment", next_node_key: "ask_budget" },
          { reply_id: "commercial", title: "Commercial Space", next_node_key: "ask_budget" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "ask_budget",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your target investment budget (in INR or Lakhs)? Example: 15000000 or 1.5 Cr",
        var_key: "buyer_budget",
        validation: "number",
        next_node_key: "check_high_budget",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "check_high_budget",
      node_type: "condition",
      config: {
        subject: "var",
        subject_key: "buyer_budget",
        operator: "greater_or_equal",
        value: "10000000",
        true_next: "create_vip_deal",
        false_next: "send_catalog_brochure",
      } as ConditionNodeConfig,
    },
    {
      node_key: "create_vip_deal",
      node_type: "create_deal",
      config: {
        title: "VIP Buyer (₹{{vars.buyer_budget}}) - {{contact.name}}",
        value: "{{vars.buyer_budget}}",
        currency: "INR",
        next_node_key: "vip_agent_handoff",
      } as CreateDealNodeConfig,
    },
    {
      node_key: "vip_agent_handoff",
      node_type: "agent_handover",
      config: {
        note: "High-net-worth real estate prospect with target budget ₹{{vars.buyer_budget}}.",
      } as AgentHandoverNodeConfig,
    },
    {
      node_key: "send_catalog_brochure",
      node_type: "catalog",
      config: {
        body_text: "Here are our current verified property listings fitting your search criteria:",
        catalog_id: "realty_catalog_all",
        next_node_key: "end",
      } as CatalogNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 8. B2B SaaS Demo Lead Qualification & Booking
// ============================================================
const SAAS_DEMO_QUALIFIER: FlowTemplate = {
  slug: "b2b_saas_demo_qualifier",
  name: "B2B SaaS Growth Lead Qualifier & Booking",
  description: "Triage team size, route mid-market & enterprise accounts directly to Cal.com demo booking, and record pipeline deals.",
  icon: "Calendar",
  trigger_type: "keyword",
  trigger_config: { keywords: ["demo", "trial", "saas", "software", "pricing"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "ask_team_size" },
    },
    {
      node_key: "ask_team_size",
      node_type: "collect_input",
      config: {
        prompt_text: "How many team members or agents will be using the platform?",
        var_key: "team_size",
        validation: "number",
        next_node_key: "evaluate_team_size",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "evaluate_team_size",
      node_type: "condition",
      config: {
        subject: "var",
        subject_key: "team_size",
        operator: "greater_or_equal",
        value: "10",
        true_next: "create_saas_deal",
        false_next: "starter_onboarding",
      } as ConditionNodeConfig,
    },
    {
      node_key: "create_saas_deal",
      node_type: "create_deal",
      config: {
        title: "Growth/Enterprise Deal ({{vars.team_size}} Seats) - {{contact.name}}",
        value: 25000,
        currency: "INR",
        next_node_key: "schedule_executive_demo",
      } as CreateDealNodeConfig,
    },
    {
      node_key: "schedule_executive_demo",
      node_type: "book_appointment",
      config: {
        booking_url: "https://cal.com/sales-team/enterprise-demo",
        prompt_text: "Let's schedule a personalized product walkthrough with a solutions architect:",
        next_node_key: "demo_booked_confirmation",
      } as BookAppointmentNodeConfig,
    },
    {
      node_key: "demo_booked_confirmation",
      node_type: "send_message",
      config: {
        text: "Thank you! Our solutions architect will prepare custom benchmark data for your {{vars.team_size}}-person team.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "starter_onboarding",
      node_type: "send_message",
      config: {
        text: "Welcome aboard! For teams under 10 members, you can get started immediately with our self-serve trial: https://example.com/signup",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
  instant_checkout: INSTANT_CHECKOUT,
  service_consultation_booking: SERVICE_BOOKING,
  enterprise_bant_qualifier: BANT_QUALIFIER,
  real_estate_buyer_qualifier: REAL_ESTATE_QUALIFIER,
  b2b_saas_demo_qualifier: SAAS_DEMO_QUALIFIER,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}
