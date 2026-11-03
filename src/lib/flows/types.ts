/**
 * Type definitions for the Flows runtime.
 *
 * These mirror the Supabase schema added in migration 010 (`flows`,
 * `flow_nodes`, `flow_runs`, `flow_run_events`) plus the discriminated
 * unions the engine uses to typecheck node configs.
 *
 * Schema invariants enforced here that the DB CHECK constraints don't:
 *   - Each node_type maps to one config shape — adding a new node_type
 *     requires adding the matching config interface AND extending
 *     `FlowNodeConfig` so the engine's exhaustiveness checks light up.
 *   - Edges live INSIDE the config (each button row / list row carries
 *     `next_node_key`). The DB schema doesn't model this — the
 *     validator (PR #3) catches missing or orphan edges at save time.
 *
 * `next_node_key` is the stable string id stored in `flow_nodes.node_key`,
 * not a UUID, so flows can be cloned / templated without rewriting
 * references in JSONB.
 */

// ============================================================
// Node configs (discriminated union by node_type)
// ============================================================

export interface StartNodeConfig {
  /** Stable node_key of the first real node to advance to. */
  next_node_key: string;
}

export interface SendMessageNodeConfig {
  /** Plain text sent to the customer; can interpolate {{vars.X}}. */
  text: string;
  /** Auto-advance target after the message lands at Meta. */
  next_node_key: string;
  /** Optional media or text header. */
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_text?: string;
  header_media_url?: string;
  header_filename?: string;
}

export interface SendButtonsNodeConfig {
  text: string;
  /** Optional header / footer lines around the buttons. */
  header_text?: string;
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_media_url?: string;
  header_filename?: string;
  footer_text?: string;
  /** 1-3 buttons; Meta cap enforced in meta-api validation. */
  buttons: Array<{
    /** Stable id sent back by Meta when this button is tapped. */
    reply_id: string;
    /** Visible label (≤ 20 chars per Meta). */
    title: string;
    /** node_key the runner advances to when this button is tapped. */
    next_node_key: string;
  }>;
}

export interface SendListNodeConfig {
  text: string;
  /** Label of the tap-to-expand button on the message bubble. */
  button_label: string;
  header_text?: string;
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_media_url?: string;
  header_filename?: string;
  footer_text?: string;
  /** 1-10 rows TOTAL across sections; cap enforced in meta-api. */
  sections: Array<{
    title?: string;
    rows: Array<{
      reply_id: string;
      title: string;
      description?: string;
      next_node_key: string;
    }>;
  }>;
}

/**
 * Sends a single image / video / document via WhatsApp, then
 * auto-advances. The media file is uploaded to the `flow-media`
 * Supabase Storage bucket by the builder; `media_url` is the public
 * URL Meta fetches at send time.
 *
 * Why one node with a `media_type` discriminator (rather than three
 * separate node types): Meta's send-side payload differs only in the
 * top-level key (`image` / `video` / `document`) and the
 * filename-on-document quirk. Modeling three node types would triple
 * the builder forms, engine cases, and add-menu entries for no
 * meaningful behavioural difference.
 */
export interface SendMediaNodeConfig {
  media_type: "image" | "video" | "document" | "audio";
  /** Public URL Meta will fetch. Uploaded via the builder's file picker. */
  media_url: string;
  /** Optional caption shown under the media (Meta caps at 1024 chars). Audio ignores it. */
  caption?: string;
  /**
   * Filename shown in the recipient's chat. Documents only — Meta
   * ignores it for image/video/audio.
   */
  filename?: string;
  /** Audio only: set true to send as an interactive voice message (waveform). */
  voice?: boolean;
  /** Auto-advance target after the send lands at Meta. */
  next_node_key: string;
}

export interface SendLocationNodeConfig {
  /** Latitude in decimal degrees (e.g. 37.442162). */
  latitude: string | number;
  /** Longitude in decimal degrees (e.g. -122.161535). */
  longitude: string | number;
  /** Optional location name (e.g. "Philz Coffee"). */
  name?: string;
  /** Optional physical address (e.g. "101 Forest Ave, Palo Alto, CA"). */
  address?: string;
  next_node_key: string;
}

export interface ContactPhoneConfig {
  phone: string;
  type?: string;
  wa_id?: string;
}

export interface ContactEmailConfig {
  email: string;
  type?: string;
}

export interface ContactAddressConfig {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  type?: string;
}

export interface ContactUrlConfig {
  url: string;
  type?: string;
}

export interface SendContactNodeConfig {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  prefix?: string;
  suffix?: string;
  company?: string;
  department?: string;
  title?: string;
  birthday?: string;
  phone?: string;
  phone_type?: string;
  wa_id?: string;
  email?: string;
  email_type?: string;
  phones?: ContactPhoneConfig[];
  emails?: ContactEmailConfig[];
  addresses?: ContactAddressConfig[];
  urls?: ContactUrlConfig[];
  next_node_key: string;
}

export interface RequestAddressNodeConfig {
  /** Prompt message asking for the delivery address. */
  text: string;
  /** Country code (ISO 2-letter, e.g. "IN"). */
  country: string;
  header_text?: string;
  footer_text?: string;
  next_node_key: string;
}

export interface CarouselCardButtonConfig {
  /** Stable id echoed back when this button is tapped. */
  reply_id: string;
  /** Visible label (≤ 25 chars per Meta). */
  title: string;
  /** node_key to advance to when tapped. */
  next_node_key: string;
}

export interface CarouselCardConfig {
  card_index?: number;
  type?: string;
  /** Header image URL (uploaded to flow-media or public URL). */
  header_image_url: string;
  /** Optional description text (≤ 160 chars per Meta). */
  body_text?: string;
  /** Quick-reply buttons on this card (1-2 buttons). */
  buttons: CarouselCardButtonConfig[];
}

export interface SendCarouselNodeConfig {
  /** Main message text displayed above the carousel. */
  text: string;
  /** 2 to 10 scrollable cards. */
  cards: CarouselCardConfig[];
}

export interface HandoffNodeConfig {
  /** Optional internal note written to flow_run_events.payload.note. */
  note?: string;
  /**
   * Optional agent user_id to assign on the conversation when this
   * node fires. Leave unset to flip the status without assignment.
   */
  assign_to?: string;
}

/**
 * Captures the customer's next free-text reply into
 * `flow_runs.vars[var_key]`, then advances.
 *
 * v1.5 ships without runtime validation (`validation` is accepted on
 * the config for forward compat but ignored by the runner); the
 * builder still surfaces the field so users can author flows that
 * v2 will start enforcing.
 */
export interface CollectInputNodeConfig {
  /** Prompt text sent to the customer before they reply. */
  prompt_text: string;
  /**
   * Key under which to store the captured text in
   * `flow_runs.vars`. Stable identifier — used by downstream
   * `condition` nodes and `handoff` notes via interpolation.
   */
  var_key: string;
  /**
   * Reserved for v2. Accepted on the config but ignored by the v1.5
   * runner — captures any non-empty text.
   */
  validation?: "any" | "email" | "phone" | "regex";
  /** Used only when `validation === 'regex'`. */
  regex?: string;
  /** Node to advance to after capture. */
  next_node_key: string;
}

export type ConditionOperator =
  | "equals"
  | "contains"
  | "present"
  | "absent";

export type ConditionSubject = "var" | "tag" | "contact_field";

/**
 * Routes the run based on a predicate over the contact's tags,
 * profile fields, or stored vars. Always auto-advances — no Meta
 * call, no customer-side input.
 */
export interface ConditionNodeConfig {
  subject: ConditionSubject;
  /**
   * For `var`: the key in flow_runs.vars.
   * For `tag`: the tag UUID (matched against contact_tags).
   * For `contact_field`: one of 'name' | 'email' | 'phone' | 'company'.
   */
  subject_key: string;
  operator: ConditionOperator;
  /** Compared against `subject` for `equals`/`contains`. Ignored for `present`/`absent`. */
  value?: string;
  /** Node to advance to when the predicate evaluates true. */
  true_next: string;
  /** Node to advance to when it evaluates false. */
  false_next: string;
}

export interface SetTagNodeConfig {
  mode: "add" | "remove";
  /** Tag UUID. The builder picks from the user's existing tags. */
  tag_id: string;
  next_node_key: string;
}

export interface TriggerNodeConfig {
  starting_step: "new_contact" | "keyword";
  keywords?: string[];
  match_type?: "exact" | "contains" | "word";
  next_node_key: string;
}

export interface AiResponseNodeConfig {
  prompt?: string;
  proceed_condition: "always" | "wait_high_confidence";
  confidence_threshold?: number;
  low_confidence_message?: string;
  active?: boolean;
  next_node_key: string;
}

export interface SendEmailNodeConfig {
  subject: string;
  body: string;
  smtp_host?: string;
  smtp_port?: number | string;
  username?: string;
  password?: string;
  encryption?: "tls" | "ssl" | "none";
  from_name?: string;
  from_email?: string;
  active?: boolean;
  next_node_key: string;
}

export interface AddToGroupNodeConfig {
  group_id: string;
  group_name?: string;
  next_node_key: string;
}

export interface RemoveFromGroupNodeConfig {
  group_id: string;
  group_name?: string;
  next_node_key: string;
}

export interface UpdateContactNodeConfig {
  field: string;
  value: string;
  next_node_key: string;
}

export interface AssignLabelNodeConfig {
  mode: "add" | "remove";
  tag_id: string;
  next_node_key: string;
}

export interface DelayNodeConfig {
  amount: number;
  unit: "minutes" | "hours" | "days";
  next_node_key: string;
}

export interface WebhookNodeConfig {
  url: string;
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body_template?: string;
  save_response_var?: string;
  next_node_key: string;
}

export interface BookAppointmentNodeConfig {
  service_type?: "calendly" | "cal_com" | "custom";
  booking_url: string;
  prompt_text?: string;
  next_node_key: string;
}

export interface WhatsAppPaymentNodeConfig {
  amount: number;
  currency: string;
  item_name: string;
  provider?: "razorpay" | "whatsapp_pay" | "custom";
  success_next?: string;
  failure_next?: string;
  next_node_key: string;
}

export interface CatalogNodeConfig {
  catalog_id?: string;
  product_retailer_id?: string;
  body_text?: string;
  next_node_key: string;
}

export interface AgentHandoverNodeConfig {
  note?: string;
  assign_to?: string;
  agent_name?: string;
  agent_email?: string;
  message?: string;
  mode?: "specific" | "round_robin";
  active?: boolean;
}

export interface InputFlowNodeConfig {
  prompt_text: string;
  var_key: string;
  validation?: "any" | "email" | "phone" | "number" | "regex";
  regex?: string;
  next_node_key: string;
}

export interface WhatsAppFormNodeConfig {
  flow_id?: string;
  flow_token?: string;
  screen_id?: string;
  next_node_key: string;
}

export interface CreateDealNodeConfig {
  pipeline_id: string;
  stage_id: string;
  title: string;
  value?: number;
  next_node_key: string;
}

export interface CloseConversationNodeConfig {
  reason?: string;
}

// Terminal nodes carry no config — they just stop the run.
export type EndNodeConfig = Record<string, never>;

/**
 * Total union — every concrete node_type the unified engine understands.
 */
export type FlowNodeConfig =
  | { node_type: "trigger"; config: TriggerNodeConfig }
  | { node_type: "start"; config: StartNodeConfig }
  | { node_type: "send_message"; config: SendMessageNodeConfig }
  | { node_type: "send_buttons"; config: SendButtonsNodeConfig }
  | { node_type: "send_list"; config: SendListNodeConfig }
  | { node_type: "send_media"; config: SendMediaNodeConfig }
  | { node_type: "send_carousel"; config: SendCarouselNodeConfig }
  | { node_type: "send_location"; config: SendLocationNodeConfig }
  | { node_type: "send_contact"; config: SendContactNodeConfig }
  | { node_type: "request_address"; config: RequestAddressNodeConfig }
  | { node_type: "collect_input"; config: CollectInputNodeConfig }
  | { node_type: "condition"; config: ConditionNodeConfig }
  | { node_type: "set_tag"; config: SetTagNodeConfig }
  | { node_type: "handoff"; config: HandoffNodeConfig }
  | { node_type: "agent_handover"; config: AgentHandoverNodeConfig }
  | { node_type: "add_to_group"; config: AddToGroupNodeConfig }
  | { node_type: "remove_from_group"; config: RemoveFromGroupNodeConfig }
  | { node_type: "update_contact"; config: UpdateContactNodeConfig }
  | { node_type: "assign_label"; config: AssignLabelNodeConfig }
  | { node_type: "send_email"; config: SendEmailNodeConfig }
  | { node_type: "delay"; config: DelayNodeConfig }
  | { node_type: "webhook"; config: WebhookNodeConfig }
  | { node_type: "http_fetch"; config: WebhookNodeConfig }
  | { node_type: "book_appointment"; config: BookAppointmentNodeConfig }
  | { node_type: "ai_response"; config: AiResponseNodeConfig }
  | { node_type: "whatsapp_payment"; config: WhatsAppPaymentNodeConfig }
  | { node_type: "catalog"; config: CatalogNodeConfig }
  | { node_type: "input_flow"; config: InputFlowNodeConfig }
  | { node_type: "whatsapp_form"; config: WhatsAppFormNodeConfig }
  | { node_type: "create_deal"; config: CreateDealNodeConfig }
  | { node_type: "close_conversation"; config: CloseConversationNodeConfig }
  | { node_type: "end"; config: EndNodeConfig };

export type FlowNodeType = FlowNodeConfig["node_type"];

export const TERMINAL_NODE_TYPES: ReadonlySet<string> = new Set([
  "end",
  "handoff",
  "agent_handover",
  "close_conversation",
]);

// ============================================================
// Triggers (matches `flows.trigger_type` + `trigger_config`)
// ============================================================

export interface KeywordTriggerConfig {
  /** One or more keywords. Match is case-insensitive by default. */
  keywords: string[];
  match_type?: "exact" | "contains";
  case_sensitive?: boolean;
}

// No knobs in v1 — the trigger has a single semantic. Kept as a type
// alias (not an empty interface) for forward compat without tripping
// the no-empty-object-type lint rule.
export type FirstInboundTriggerConfig = Record<string, never>;

export type FlowTriggerConfig =
  | { trigger_type: "keyword"; config: KeywordTriggerConfig }
  | { trigger_type: "first_inbound_message"; config: FirstInboundTriggerConfig }
  | { trigger_type: "manual"; config: Record<string, never> };

// ============================================================
// DB-row shapes (read by the engine via supabaseAdmin)
// ============================================================

export interface FlowRow {
  id: string;
  /** Account tenancy (NOT NULL post-017). The engine looks up active
   *  flows for inbound dispatch using this field. */
  account_id: string;
  /** Author. Used as a default sender-of-record on engine sends and
   *  preserved on flow_runs for log/audit display. */
  user_id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | FirstInboundTriggerConfig | Record<string, unknown>;
  entry_node_id: string | null;
  fallback_policy: FlowFallbackPolicy;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowNodeRow {
  id: string;
  flow_id: string;
  node_key: string;
  node_type: FlowNodeType;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface FlowRunRow {
  id: string;
  flow_id: string;
  /** Tenancy. Matches flows.account_id; NOT NULL post-017. */
  account_id: string;
  /** Audit. Matches the parent flow.user_id. */
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  status:
    | "active"
    | "completed"
    | "handed_off"
    | "timed_out"
    | "paused_by_agent"
    | "cancelled"
    | "failed";
  current_node_key: string | null;
  transition_seq: number;
  last_prompt_message_id: string | null;
  vars: Record<string, unknown>;
  reprompt_count: number;
  started_at: string;
  last_advanced_at: string;
  ended_at: string | null;
  end_reason: string | null;
}

// ============================================================
// Fallback policy (matches flows.fallback_policy JSONB)
// ============================================================

export interface FlowFallbackPolicy {
  /** What to do when the customer reply doesn't match any option. */
  on_unknown_reply: "reprompt" | "handoff" | "ignore" | "ai";
  /** Max reprompts before applying `on_exhaust`. */
  max_reprompts: number;
  /** Stale-run sweep cutoff. */
  on_timeout_hours: number;
  /** What to do once max_reprompts has been hit. */
  on_exhaust: "handoff" | "end";
}

export const MAX_FLOW_TIMEOUT_HOURS = 87600;

export const DEFAULT_FALLBACK_POLICY: FlowFallbackPolicy = {
  on_unknown_reply: "ai",
  max_reprompts: 0,
  on_timeout_hours: 24,
  on_exhaust: "handoff",
};

// ============================================================
// Engine input — what `dispatchInboundToFlows` accepts
// ============================================================

/**
 * Normalised view of an inbound message that the runner needs. The
 * webhook lifts this out of the raw Meta payload before invoking the
 * runner; keeps the runner free of any WhatsApp-API specifics.
 */
export type ParsedInbound =
  | {
      kind: "text";
      /** The user's typed message body. */
      text: string;
      /** Meta's `messages[0].id` — used for idempotency. */
      meta_message_id: string;
    }
  | {
      kind: "interactive_reply";
      /** The reply_id of the tapped button or list row. */
      reply_id: string;
      /** The visible title of the tapped option (for logging). */
      reply_title: string;
      meta_message_id: string;
    };

export interface DispatchInboundInput {
  /** Account tenancy key. Drives the lookup of active flows and the
   *  idempotency check for previously-seen inbound message_ids. */
  accountId: string;
  /** Sender-of-record for the bot's outbound prompts on engine
   *  sends. Set by the webhook to the WhatsApp config owner. */
  userId: string;
  contactId: string;
  conversationId: string;
  message: ParsedInbound;
}

export interface DispatchInboundResult {
  /**
   * True iff the runner handled the message — it either advanced an
   * existing run or started a new one matching a flow trigger.
   * Webhook uses this to decide whether to also fire automations.
   */
  consumed: boolean;
  /** For diagnostics / logging — null when not consumed. */
  flow_run_id?: string;
  /** For diagnostics. */
  outcome?:
    | "advanced"
    | "started"
    | "completed"
    | "handed_off"
    | "fallback_fired"
    | "duplicate_inbound_ignored"
    | "run_error"
    | "no_match";
}

// ============================================================
// Helpers — exhaustiveness assertions
// ============================================================

/**
 * Throws a typed compile-time error if the switch over a discriminated
 * union forgets a case. Used in the engine's node-type switch.
 */
export const AUTO_ADVANCING_NODE_TYPES: ReadonlySet<string> = new Set([
  "trigger",
  "start",
  "send_message",
  "send_media",
  "send_location",
  "send_contact",
  "request_address",
  "condition",
  "set_tag",
  "add_to_group",
  "remove_from_group",
  "update_contact",
  "assign_label",
  "send_email",
  "webhook",
  "http_fetch",
  "book_appointment",
  "catalog",
  "create_deal",
]);

export const MAX_NODES_PER_ADVANCE = 25;

export const MAX_AUTO_ADVANCING_CHAIN = MAX_NODES_PER_ADVANCE - 1;

export function assertNever(x: never): never {
  throw new Error(`Unhandled node type: ${JSON.stringify(x)}`);
}
