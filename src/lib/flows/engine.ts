/**
 * Flow runner.
 *
 * The single entry point `dispatchInboundToFlows` is called by the
 * WhatsApp webhook on every inbound message *for an account that has
 * opted into the Flows beta*. It decides whether the message belongs
 * to an active conversation flow (advance it) or matches the entry
 * trigger of an active flow (start a new run) — and reports back to
 * the webhook so the webhook knows whether to also fire automations.
 *
 * Architecture in a sentence: the runner walks the customer through
 * a DB-stored node graph, suspending only at nodes that need
 * customer input. Each tap or text reply wakes it back up.
 *
 * What lives here vs elsewhere:
 *   - Pure decision logic (which button matched, where to advance to,
 *     when to fallback) — here.
 *   - DB shape (table reads/writes) — here.
 *   - Meta API calls — `meta-send.ts` (engineSendInteractive*).
 *   - Policy resolution (reprompt vs handoff vs end) — `fallback.ts`.
 *   - Type definitions — `types.ts`.
 *
 * Concurrency model:
 *   - Idempotency on `meta_message_id`: the runner refuses to advance
 *     an active run twice for the same Meta message — protects against
 *     Meta's retries.
 *   - Optimistic UPDATE with `current_node_key` precondition: two
 *     simultaneous taps for the same run collide at the DB layer; the
 *     second is a no-op.
 *   - Partial unique index `idx_one_active_run_per_contact`: two
 *     simultaneous starts for the same contact collide; the second
 *     INSERT raises 23505 and the runner catches & exits.
 */

import { supabaseAdmin } from "./admin-client";
import {
  engineSendAddressMessage,
  engineSendContacts,
  engineSendInteractiveButtons,
  engineSendInteractiveCarousel,
  engineSendInteractiveList,
  engineSendLocation,
  engineSendMedia,
  engineSendText,
  loadAccountMetaCredentials,
} from "./meta-send";
import { sendTypingIndicator } from "@/lib/whatsapp/meta-api";
import { resolveFallbackPolicy, decideFallback } from "./fallback";
import {
  analyzeFlowInput,
  validateAndNormalize,
  getDefaultInvalidMessage,
  checkFlowCommand,
} from "./input-analyzer";
import { buildConversationContext } from "@/lib/ai/context";
import { localizeNode } from "./localization";
import { loadAiConfig } from "@/lib/ai/config";
import { dispatchEmail, type EmailConfigData } from "@/lib/email/email-service";
import { addContactTagAndDispatch } from "@/lib/contacts/tag-events";
import { removeContactTag } from "@/lib/contacts/tag-write";
import { checkRunTimeout, markRunTimedOut, type RunTimeoutCheck } from "./timeout";
import {
  type CollectInputNodeConfig,
  type ConditionNodeConfig,
  type DispatchInboundInput,
  type DispatchInboundResult,
  type FlowNodeRow,
  type FlowRow,
  type FlowRunRow,
  type ParsedInbound,
  type RequestAddressNodeConfig,
  type SendButtonsNodeConfig,
  type SendCarouselNodeConfig,
  type SendContactNodeConfig,
  type SendListNodeConfig,
  type SendLocationNodeConfig,
  type SendMediaNodeConfig,
  type SendEmailNodeConfig,
  type SendMessageNodeConfig,
  type SetTagNodeConfig,
  type StartNodeConfig,
  type KeywordTriggerConfig,
  AUTO_ADVANCING_NODE_TYPES,
  MAX_NODES_PER_ADVANCE,
} from "./types";

// ============================================================
// Pure helpers — extracted so engine.test.ts can exercise them
// without a Supabase / Meta mock.
// ============================================================

/**
 * Given a node + the customer's reply_id, return the next_node_key
 * to advance to, or `null` if no option matches.
 */
export function matchReplyId(
  node: { node_type: string; config: Record<string, unknown> },
  reply_id: string,
): string | null {
  if (node.node_type === "send_buttons") {
    const cfg = node.config as unknown as SendButtonsNodeConfig;
    const hit = cfg.buttons?.find((b) => b.reply_id === reply_id);
    return hit?.next_node_key ?? null;
  }
  if (node.node_type === "send_list") {
    const cfg = node.config as unknown as SendListNodeConfig;
    for (const section of cfg.sections ?? []) {
      const hit = section.rows?.find((r) => r.reply_id === reply_id);
      if (hit) return hit.next_node_key;
    }
    return null;
  }
  if (node.node_type === "send_carousel") {
    const cfg = node.config as unknown as SendCarouselNodeConfig;
    for (const card of cfg.cards ?? []) {
      const hit = card.buttons?.find((b) => b.reply_id === reply_id);
      if (hit) return hit.next_node_key;
    }
    return null;
  }
  return null;
}

/**
 * Case-insensitive contains/exact match against a list of keywords.
 * Used by the trigger evaluator. Stable enough that the v3 builder
 * UI can preview matches by passing canned strings.
 */
export function matchesKeywordTrigger(
  text: string,
  cfg: KeywordTriggerConfig,
): boolean {
  if (!text || !cfg.keywords?.length) return false;
  const matchType = cfg.match_type ?? "contains";
  const haystack = cfg.case_sensitive ? text : text.toLowerCase();
  for (const raw of cfg.keywords) {
    if (!raw) continue;
    const needle = cfg.case_sensitive ? raw : raw.toLowerCase();
    if (matchType === "exact" ? haystack === needle : haystack.includes(needle)) {
      return true;
    }
  }
  return false;
}

/**
 * The strings an inbound message offers to a flow's *entry* trigger.
 *
 * Typed text offers itself. A button / list tap offers two: the visible
 * title — what the customer would have typed had the button not been
 * there — and the stable reply_id, because the automation engine's
 * `interactive_reply` trigger routes on the id, so an author moving a
 * menu into a flow reaches for the same value.
 *
 * Matching the id does mean a keyword that happens to be a substring of
 * an id can fire (ids are author-controlled slugs, defaulting to
 * `btn_1`). That is the same substring semantic keyword triggers
 * already have for typed text, and the alternative — ignoring the id —
 * silently breaks the author who keyed on it.
 */
export function entryTriggerTexts(message: ParsedInbound): string[] {
  if (message.kind === "text") return [message.text];
  return [...new Set([message.reply_title, message.reply_id])].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
}

/** Nodes that advance to a next_node_key without waiting for input. */
export function isAutoAdvancing(node_type: string): boolean {
  return AUTO_ADVANCING_NODE_TYPES.has(node_type);
}

export type ActiveRunClosure =
  | { kind: "cancel"; reason: "flow_not_active" | "current_node_removed" }
  | { kind: "fail"; reason: "active_run_missing_current_node" }
  | { kind: "timeout"; check: RunTimeoutCheck };

export function closureForActiveRun(args: {
  run: Pick<FlowRunRow, "current_node_key" | "last_advanced_at">;
  flow: Pick<FlowRow, "status" | "fallback_policy"> | null;
  nodeKeys: ReadonlySet<string> | { has(key: string): boolean };
  now: Date;
}): ActiveRunClosure | null {
  if (!args.flow || args.flow.status !== "active") {
    return { kind: "cancel", reason: "flow_not_active" };
  }
  const check = checkRunTimeout(
    args.run.last_advanced_at,
    args.flow.fallback_policy,
    args.now,
  );
  if (check.timedOut) return { kind: "timeout", check };
  if (!args.run.current_node_key) {
    return { kind: "fail", reason: "active_run_missing_current_node" };
  }
  if (!args.nodeKeys.has(args.run.current_node_key)) {
    return { kind: "cancel", reason: "current_node_removed" };
  }
  return null;
}

/** Nodes that send a prompt and suspend awaiting a customer reply. */
export function isSuspending(node_type: string): boolean {
  return (
    node_type === "send_buttons" ||
    node_type === "send_list" ||
    node_type === "collect_input" ||
    node_type === "input_flow"
  );
}

/** Nodes that end the run. */
export function isTerminal(node_type: string): boolean {
  return (
    node_type === "handoff" ||
    node_type === "agent_handover" ||
    node_type === "end" ||
    node_type === "close_conversation"
  );
}

/**
 * Evaluate a `condition` node's predicate against the current run
 * state. Exported pure for unit testing — the engine wraps it with a
 * DB lookup for `tag` / `contact_field` subjects.
 */
export function evaluateConditionPredicate(args: {
  operator: ConditionNodeConfig["operator"];
  /**
   * Resolved value of the subject. `undefined` means the subject is
   * absent (no var with that key / no such tag / contact field is
   * null). Pure function: caller does the DB lookup.
   */
  subjectValue: string | undefined;
  /** The configured comparison value, when applicable. */
  configValue: string | undefined;
}): boolean {
  switch (args.operator) {
    case "present":
      return args.subjectValue !== undefined && args.subjectValue !== "";
    case "absent":
      return args.subjectValue === undefined || args.subjectValue === "";
    case "equals":
      if (args.subjectValue === undefined) return false;
      return args.subjectValue === (args.configValue ?? "");
    case "contains":
      if (args.subjectValue === undefined) return false;
      return args.subjectValue.includes(args.configValue ?? "");
  }
}

// ============================================================
// DB I/O — wrapped in tiny helpers so the dispatch flow stays
// readable. Errors surface as thrown — the entry point catches.
// ============================================================

type AdminClient = ReturnType<typeof supabaseAdmin>;

async function loadActiveRunForContact(
  db: AdminClient,
  accountId: string,
  contactId: string,
): Promise<FlowRunRow | null> {
  const { data, error } = await db
    .from("flow_runs")
    .select("*")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .in("status", ["active", "paused_by_agent"])
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[flows] loadActiveRunForContact error:", error.message);
    return null;
  }
  const rows = (data as FlowRunRow[] | null) ?? [];
  return rows[0] ?? null;
}

async function loadFlow(
  db: AdminClient,
  flowId: string,
): Promise<FlowRow | null> {
  const { data, error } = await db
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .maybeSingle();
  if (error) throw new Error(`loadFlow failed: ${error.message}`);
  return (data as FlowRow | null) ?? null;
}

/**
 * Load every node of a flow in one round trip and key them by
 * `node_key`. The advance loop is then in-memory — a 5-node
 * auto-advancing chain costs one SELECT, not five.
 */
async function loadAllNodes(
  db: AdminClient,
  flowId: string,
): Promise<Map<string, FlowNodeRow>> {
  const { data, error } = await db
    .from("flow_nodes")
    .select("*")
    .eq("flow_id", flowId);
  if (error) throw new Error(`loadAllNodes failed: ${error.message}`);
  const map = new Map<string, FlowNodeRow>();
  for (const row of (data ?? []) as FlowNodeRow[]) {
    map.set(row.node_key, row);
  }
  return map;
}

async function logEvent(
  db: AdminClient,
  flowRunId: string,
  event_type:
    | "started"
    | "node_entered"
    | "message_sent"
    | "reply_received"
    | "fallback_fired"
    | "handoff"
    | "timeout"
    | "error"
    | "completed",
  node_key: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db.from("flow_run_events").insert({
    flow_run_id: flowRunId,
    event_type,
    node_key,
    payload,
  });
  if (error) {
    // Logging failure is non-fatal — surface but don't throw.
    console.error("[flows] logEvent error:", error.message);
  }
}

/**
 * Idempotency check — has a `reply_received` event with this Meta
 * message_id already been recorded for any of the contact's flow
 * runs? If yes, the inbound is a duplicate (Meta retry) and we
 * exit without re-advancing.
 *
 * Implementation note: scoped to runs belonging to this user/contact
 * so the lookup is cheap (the index on flow_run_events(flow_run_id,
 * event_type) plus the small set of runs per contact).
 */
async function isDuplicateInbound(
  db: AdminClient,
  accountId: string,
  contactId: string,
  metaMessageId: string,
): Promise<boolean> {
  // Fetch ALL run ids for this contact in this account (active +
  // historical). Bounded by how many flows the customer has been
  // through — small.
  const { data: runs } = await db
    .from("flow_runs")
    .select("id")
    .eq("account_id", accountId)
    .eq("contact_id", contactId);
  if (!runs?.length) return false;
  const runIds = runs.map((r) => (r as { id: string }).id);

  const { count } = await db
    .from("flow_run_events")
    .select("id", { count: "exact", head: true })
    .in("flow_run_id", runIds)
    .eq("event_type", "reply_received")
    .filter("payload->>meta_message_id", "eq", metaMessageId);
  return (count ?? 0) > 0;
}

async function findEntryFlow(
  db: AdminClient,
  accountId: string,
  message: ParsedInbound,
  isFirstInbound: boolean,
): Promise<FlowRow | null> {
  // A tap used to be rejected outright here, on the reasoning that
  // interactive replies are responses to existing prompts. That holds
  // only while a prompt is outstanding — and this function runs solely
  // when the contact has NO active run, so there is nothing the tap
  // could be answering. What it actually blocked was issue #490: an
  // *automation* sends the buttons, the customer taps one, and the flow
  // whose keyword matches that button never starts. Retyping the label
  // by hand worked, which is the tell — same words, different envelope.
  const candidates = entryTriggerTexts(message);

  // Pull all active flows for this account. Active set is bounded
  // (the builder discourages double-trigger overlap; partial index
  // makes the lookup index-supported).
  const { data: flows, error } = await db
    .from("flows")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error || !flows) return null;

  const typed = flows as FlowRow[];
  for (const flow of typed) {
    if (flow.trigger_type === "keyword") {
      const cfg = flow.trigger_config as KeywordTriggerConfig;
      if (candidates.some((text) => matchesKeywordTrigger(text, cfg))) {
        return flow;
      }
    } else if (flow.trigger_type === "first_inbound_message" && isFirstInbound) {
      // Also reachable by a tap now: a broadcast template with a
      // quick-reply button can genuinely be what prompts a contact's
      // first-ever inbound. The automations dispatcher has always
      // treated a tap that way (the webhook pushes
      // `first_inbound_message` regardless of envelope) — flows were
      // the inconsistent half.
      return flow;
    }
    // 'manual' triggers do not auto-start from inbound messages.
  }
  return null;
}

// ============================================================
// Node executors — each handles ONE node type. send_buttons and
// send_list also persist `last_prompt_message_id` so the inbox
// thread can quote the prompt the customer is replying to.
// ============================================================

async function sendButtonsAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendButtonsNodeConfig;
  // Every customer-visible string is interpolated against run.vars —
  // same treatment send_message / collect_input already get (#553).
  // `reply_id` is deliberately NOT interpolated: it is the routing key
  // matchReplyId compares the tapped button against, so it must reach
  // Meta byte-for-byte as authored. Interpolation can push a title past
  // Meta's 20-char cap; meta-api's validator throws a descriptive error
  // and the caller logs it — we never truncate silently.
  const { whatsapp_message_id } = await engineSendInteractiveButtons({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: interpolateVars(cfg.text, run.vars),
    headerText: interpolateOptionalVars(cfg.header_text, run.vars),
    headerType: cfg.header_type,
    headerMediaUrl: cfg.header_media_url,
    headerFilename: cfg.header_filename,
    footerText: interpolateOptionalVars(cfg.footer_text, run.vars),
    buttons: cfg.buttons.map((b) => ({
      id: b.reply_id,
      title: interpolateVars(b.title, run.vars),
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_buttons",
    whatsapp_message_id,
  });
  // Look up our internal message id so we can stash it on the run.
  // Cheap — indexed on `messages.message_id`.
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function sendListAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendListNodeConfig;
  // See sendButtonsAndSuspend — interpolate every visible string,
  // never the row `reply_id`.
  const { whatsapp_message_id } = await engineSendInteractiveList({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: interpolateVars(cfg.text, run.vars),
    buttonLabel: interpolateVars(cfg.button_label, run.vars),
    headerText: interpolateOptionalVars(cfg.header_text, run.vars),
    headerType: cfg.header_type,
    headerMediaUrl: cfg.header_media_url,
    headerFilename: cfg.header_filename,
    footerText: interpolateOptionalVars(cfg.footer_text, run.vars),
    sections: cfg.sections.map((s) => ({
      title: interpolateOptionalVars(s.title, run.vars),
      rows: s.rows.map((r) => ({
        id: r.reply_id,
        title: interpolateVars(r.title, run.vars),
        description: interpolateOptionalVars(r.description, run.vars),
      })),
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_list",
    whatsapp_message_id,
  });
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function sendCarouselAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendCarouselNodeConfig;
  const { whatsapp_message_id } = await engineSendInteractiveCarousel({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: interpolateVars(cfg.text, run.vars),
    cards: (cfg.cards ?? []).map((card, idx) => ({
      cardIndex: typeof card.card_index === "number" ? card.card_index : idx,
      type: card.type || "cta_url",
      headerImageUrl: interpolateVars(card.header_image_url, run.vars),
      bodyText: card.body_text
        ? interpolateVars(card.body_text, run.vars)
        : undefined,
      buttons: (card.buttons ?? []).map((b) => ({
        id: b.reply_id,
        title: interpolateVars(b.title, run.vars),
      })),
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_carousel",
    whatsapp_message_id,
  });
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function executeHandoff(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const cfg = node.config as { assign_to?: string; note?: string; message?: string };
  const handoverMsg = cfg.message || cfg.note;
  if (handoverMsg) {
    try {
      await engineSendText({
        accountId: run.account_id,
        userId: run.user_id,
        conversationId: run.conversation_id!,
        contactId: run.contact_id!,
        text: interpolateVars(handoverMsg, run.vars),
      });
    } catch (err) {
      console.warn("[flows] handover message send error:", err);
    }
  }

  const convUpdate: Record<string, unknown> = {
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (cfg.assign_to) convUpdate.assigned_agent_id = cfg.assign_to;
  if (run.conversation_id) {
    await db
      .from("conversations")
      .update(convUpdate)
      .eq("id", run.conversation_id);
  }
  await logEvent(db, run.id, "handoff", node.node_key, {
    note: cfg.note ?? null,
    message: cfg.message ?? null,
    assigned_to: cfg.assign_to ?? null,
  });
  await endRun(db, run.id, "handed_off", "handoff_node");
}

/**
 * Resolve a condition node's subject value from DB / run state, then
 * call the pure `evaluateConditionPredicate`. Splits out so the
 * predicate itself stays unit-testable without a Supabase mock.
 *
 * Subject sources:
 *   - `var` → `flow_runs.vars[subject_key]` (captured by collect_input
 *     or http_fetch in v2).
 *   - `tag` → present iff `contact_tags(contact_id, tag_id)` exists.
 *     `subject_key` IS the tag UUID; the SELECT returns 1 row or 0.
 *   - `contact_field` → one of name/email/phone/company on `contacts`.
 */
async function evaluateConditionNode(
  db: AdminClient,
  run: FlowRunRow,
  cfg: ConditionNodeConfig,
): Promise<boolean> {
  let subjectValue: string | undefined;
  if (cfg.subject === "var") {
    const v = run.vars[cfg.subject_key];
    subjectValue = typeof v === "string" ? v : v === undefined ? undefined : String(v);
  } else if (cfg.subject === "tag") {
    const { count } = await db
      .from("contact_tags")
      .select("contact_id", { count: "exact", head: true })
      .eq("contact_id", run.contact_id!)
      .eq("tag_id", cfg.subject_key);
    // For tags, "present" really is the only meaningful test — the
    // `present`/`absent` operators are the natural fit. equals/contains
    // against a tag UUID would still work mechanically (compare its
    // existence to the value).
    subjectValue = (count ?? 0) > 0 ? cfg.subject_key : undefined;
  } else {
    const ALLOWED = ["name", "email", "phone", "company"] as const;
    type AllowedField = (typeof ALLOWED)[number];
    if (!ALLOWED.includes(cfg.subject_key as AllowedField)) {
      throw new Error(`unsupported contact_field: ${cfg.subject_key}`);
    }
    const { data } = await db
      .from("contacts")
      .select(cfg.subject_key)
      .eq("id", run.contact_id!)
      .maybeSingle();
    const raw = (data as Record<string, unknown> | null)?.[cfg.subject_key];
    subjectValue = typeof raw === "string" && raw.length > 0 ? raw : undefined;
  }
  return evaluateConditionPredicate({
    operator: cfg.operator,
    subjectValue,
    configValue: cfg.value,
  });
}

/**
 * Flexible variable interpolation supporting both `{{vars.foo}}` and `{{foo}}`
 * as well as contact fields (`{{contact.name}}`, `{{contact.phone}}`).
 * Used by send_message + collect_input prompt text so captured variables
 * and contact properties show up smoothly in subsequent messages.
 * Missing vars render as empty string — consistent with automations.
 */
export function interpolateVars(template: string, vars: Record<string, unknown> = {}): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, rawKey) => {
    // 1. Direct match (e.g. "name", "vars.name", "contact.phone")
    if (vars[rawKey] !== undefined && vars[rawKey] !== null) {
      return String(vars[rawKey]);
    }
    // 2. Strip "vars." if present (e.g. "vars.name" -> look up "name")
    if (rawKey.startsWith("vars.")) {
      const stripped = rawKey.slice(5);
      if (vars[stripped] !== undefined && vars[stripped] !== null) {
        return String(vars[stripped]);
      }
    }
    // 3. Add "vars." if omitted (e.g. "name" -> look up "vars.name")
    const prefixed = `vars.${rawKey}`;
    if (vars[prefixed] !== undefined && vars[prefixed] !== null) {
      return String(vars[prefixed]);
    }
    // 4. Check nested object (e.g. "contact.name" on vars.contact = { name: "..." })
    if (rawKey.includes(".")) {
      const parts = rawKey.split(".");
      let cur: any = vars;
      for (const p of parts) {
        if (cur && typeof cur === "object") {
          cur = cur[p];
        } else {
          cur = undefined;
          break;
        }
      }
      if (cur !== undefined && cur !== null) {
        return String(cur);
      }
    }
    return "";
  });
}

/**
 * `interpolateVars` for optional config fields (header_text, footer_text,
 * list section titles, row descriptions). An absent field stays absent
 * — `interpolateVars(undefined)` would return "" and meta-api treats
 * header/footer/description by truthiness, so "" is harmless there, but
 * keeping `undefined` means the payload we log and send matches what
 * the author configured rather than sprouting empty strings.
 */
function interpolateOptionalVars(
  template: string | undefined,
  vars: Record<string, unknown>,
): string | undefined {
  return template === undefined || template === null
    ? undefined
    : interpolateVars(template, vars);
}

async function endRun(
  db: AdminClient,
  runId: string,
  status: "completed" | "handed_off" | "cancelled" | "failed",
  reason: string,
): Promise<void> {
  await db
    .from("flow_runs")
    .update({
      status,
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", runId)
    .eq("status", "active");
}

// ============================================================
// The synchronous advance loop. Walks through auto-advance nodes
// until it hits one that suspends (send_buttons/send_list) or
// terminates (handoff/end). Each suspending node persists the
// new current_node_key before returning.
// ============================================================

async function advanceFromNodeKey(
  db: AdminClient,
  run: FlowRunRow,
  startNodeKey: string,
  nodes: Map<string, FlowNodeRow>,
): Promise<{ outcome: "advanced" | "completed" | "handed_off" }> {
  let currentKey: string | null = startNodeKey;
  for (let safety = 0; safety < MAX_NODES_PER_ADVANCE; safety += 1) {
    if (!currentKey) {
      await logEvent(db, run.id, "error", null, {
        reason: "next_node_key was null mid-advance",
      });
      await endRun(db, run.id, "failed", "missing_next_node");
      return { outcome: "completed" };
    }
    const node: FlowNodeRow | null = nodes.get(currentKey) ?? null;
    if (!node) {
      await logEvent(db, run.id, "error", currentKey, {
        reason: "node_not_found",
      });
      await endRun(db, run.id, "failed", "node_not_found");
      return { outcome: "completed" };
    }
    await logEvent(db, run.id, "node_entered", node.node_key, {
      node_type: node.node_type,
    });

    if (node.node_type === "start") {
      currentKey = (node.config as unknown as StartNodeConfig).next_node_key;
      continue;
    }
    if (node.node_type === "send_message") {
      const cfg = node.config as unknown as SendMessageNodeConfig;
      try {
        let whatsapp_message_id: string;
        if (
          cfg.header_type &&
          cfg.header_type !== "none" &&
          cfg.header_type !== "text" &&
          cfg.header_media_url
        ) {
          const res = await engineSendMedia({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id!,
            contactId: run.contact_id!,
            kind: cfg.header_type as "image" | "video" | "document",
            link: cfg.header_media_url,
            caption: interpolateVars(cfg.text, run.vars),
            filename: cfg.header_filename,
          });
          whatsapp_message_id = res.whatsapp_message_id;
        } else {
          const textToSend =
            cfg.header_type === "text" && cfg.header_text
              ? `*${interpolateVars(cfg.header_text, run.vars)}*\n\n${interpolateVars(cfg.text, run.vars)}`
              : interpolateVars(cfg.text, run.vars);
          const res = await engineSendText({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id!,
            contactId: run.contact_id!,
            text: textToSend,
          });
          whatsapp_message_id = res.whatsapp_message_id;
        }
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_message",
          whatsapp_message_id,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_text_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_text_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_media") {
      const cfg = node.config as unknown as SendMediaNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendMedia({
          accountId: run.account_id,
    userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          kind: cfg.media_type,
          link: cfg.media_url,
          caption: cfg.caption
            ? interpolateVars(cfg.caption, run.vars)
            : undefined,
          filename: cfg.filename,
          voice: cfg.voice,
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_media",
          media_type: cfg.media_type,
          whatsapp_message_id,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_media_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_media_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_location") {
      const cfg = node.config as unknown as SendLocationNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendLocation({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          latitude:
            typeof cfg.latitude === "string"
              ? interpolateVars(cfg.latitude, run.vars)
              : cfg.latitude,
          longitude:
            typeof cfg.longitude === "string"
              ? interpolateVars(cfg.longitude, run.vars)
              : cfg.longitude,
          name: cfg.name ? interpolateVars(cfg.name, run.vars) : undefined,
          address: cfg.address ? interpolateVars(cfg.address, run.vars) : undefined,
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_location",
          whatsapp_message_id,
        });
      } catch (err) {
        console.error("[flows] send_location failed:", err);
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_location_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_location_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_contact") {
      const cfg = node.config as unknown as SendContactNodeConfig;
      try {
        const formattedName = interpolateVars(cfg.formatted_name, run.vars);
        const nameParts = formattedName.trim().split(/\s+/);
        const firstName = cfg.first_name
          ? interpolateVars(cfg.first_name, run.vars)
          : nameParts[0] || formattedName;
        const lastName = cfg.last_name
          ? interpolateVars(cfg.last_name, run.vars)
          : nameParts.length > 1
            ? nameParts.slice(1).join(" ")
            : undefined;

        const phones = (cfg.phones && cfg.phones.length > 0)
          ? cfg.phones.map((p) => ({
              phone: interpolateVars(p.phone, run.vars),
              type: p.type,
              waId: p.wa_id ? interpolateVars(p.wa_id, run.vars) : undefined,
            }))
          : cfg.phone
            ? [{
                phone: interpolateVars(cfg.phone, run.vars),
                type: cfg.phone_type || "CELL",
                waId: cfg.wa_id ? interpolateVars(cfg.wa_id, run.vars) : undefined,
              }]
            : [];

        const emails = (cfg.emails && cfg.emails.length > 0)
          ? cfg.emails.map((e) => ({
              email: interpolateVars(e.email, run.vars),
              type: e.type,
            }))
          : cfg.email
            ? [{
                email: interpolateVars(cfg.email, run.vars),
                type: cfg.email_type || "WORK",
              }]
            : [];

        const { whatsapp_message_id } = await engineSendContacts({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          contacts: [
            {
              name: {
                formattedName,
                firstName,
                lastName,
                middleName: cfg.middle_name ? interpolateVars(cfg.middle_name, run.vars) : undefined,
                prefix: cfg.prefix ? interpolateVars(cfg.prefix, run.vars) : undefined,
                suffix: cfg.suffix ? interpolateVars(cfg.suffix, run.vars) : undefined,
              },
              birthday: cfg.birthday,
              org: (cfg.company || cfg.department || cfg.title) ? {
                company: cfg.company ? interpolateVars(cfg.company, run.vars) : undefined,
                department: cfg.department ? interpolateVars(cfg.department, run.vars) : undefined,
                title: cfg.title ? interpolateVars(cfg.title, run.vars) : undefined,
              } : undefined,
              phones,
              emails,
              addresses: (cfg.addresses ?? []).map((a) => ({
                street: a.street ? interpolateVars(a.street, run.vars) : undefined,
                city: a.city ? interpolateVars(a.city, run.vars) : undefined,
                state: a.state ? interpolateVars(a.state, run.vars) : undefined,
                zip: a.zip ? interpolateVars(a.zip, run.vars) : undefined,
                country: a.country ? interpolateVars(a.country, run.vars) : undefined,
                countryCode: a.country_code ? interpolateVars(a.country_code, run.vars) : undefined,
                type: a.type,
              })),
              urls: (cfg.urls ?? []).map((u) => ({
                url: interpolateVars(u.url, run.vars),
                type: u.type,
              })),
            },
          ],
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_contact",
          whatsapp_message_id,
        });
      } catch (err) {
        console.error("[flows] send_contact failed:", err);
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_contact_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_contact_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "request_address") {
      const cfg = node.config as unknown as RequestAddressNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendAddressMessage({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          bodyText: interpolateVars(cfg.text, run.vars),
          country: cfg.country ? interpolateVars(cfg.country, run.vars) : "IN",
          headerText: cfg.header_text ? interpolateVars(cfg.header_text, run.vars) : undefined,
          footerText: cfg.footer_text ? interpolateVars(cfg.footer_text, run.vars) : undefined,
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "request_address",
          whatsapp_message_id,
        });
      } catch (err) {
        console.error("[flows] request_address failed:", err);
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "request_address_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "request_address_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "collect_input" || node.node_type === "input_flow") {
      // Send the prompt and suspend. Customer's next TEXT reply will
      // wake us up via handleReplyForActiveRun's collect_input branch.
      const cfg = node.config as unknown as CollectInputNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.prompt_text, run.vars),
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: node.node_type,
          whatsapp_message_id,
        });
        const { data: msg } = await db
          .from("messages")
          .select("id")
          .eq("message_id", whatsapp_message_id)
          .maybeSingle();
        await db
          .from("flow_runs")
          .update({
            last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
          })
          .eq("id", run.id);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "collect_input_prompt_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "collect_input_prompt_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "condition") {
      const cfg = node.config as unknown as ConditionNodeConfig;
      let branch: "true" | "false";
      try {
        branch = (await evaluateConditionNode(db, run, cfg))
          ? "true"
          : "false";
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "condition_evaluation_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "condition_evaluation_failed");
        return { outcome: "completed" };
      }
      currentKey =
        branch === "true" ? cfg.true_next : cfg.false_next;
      await logEvent(db, run.id, "node_entered", node.node_key, {
        condition_result: branch,
        advancing_to: currentKey,
      });
      continue;
    }
    if (node.node_type === "set_tag") {
      const cfg = node.config as unknown as SetTagNodeConfig;
      try {
        if (cfg.mode === "add") {
          await addContactTagAndDispatch({
            db,
            accountId: run.account_id,
            contactId: run.contact_id!,
            tagId: cfg.tag_id,
            context: {
              conversation_id: run.conversation_id ?? undefined,
              vars: run.vars,
            },
          });
        } else {
          await removeContactTag(db, {
            accountId: run.account_id,
            contactId: run.contact_id!,
            tagId: cfg.tag_id,
          });
        }
      } catch (err) {
        // Non-fatal — log + advance. A tag-write failure shouldn't
        // strand the customer mid-flow.
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "set_tag_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_buttons") {
      // Same failure contract as send_message / send_media /
      // collect_input above: log + fail the run. Previously an
      // exception here (Meta error, or meta-api's length validation —
      // now reachable via interpolation, see sendButtonsAndSuspend)
      // escaped to dispatchInboundToFlows' catch, which only
      // console.error'd and left the run active + stuck on the prior
      // node with nothing in flow_run_events.
      try {
        await sendButtonsAndSuspend(db, run, node);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_buttons_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_buttons_failed");
        return { outcome: "completed" };
      }
      // Persist the new current_node_key via optimistic UPDATE.
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "send_list") {
      try {
        await sendListAndSuspend(db, run, node);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_list_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_list_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "send_carousel") {
      try {
        await sendCarouselAndSuspend(db, run, node);
      } catch (err) {
        console.error("[flows] send_carousel failed:", err);
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_carousel_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_carousel_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "trigger") {
      const cfg = node.config as { next_node_key?: string };
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "assign_label") {
      const cfg = node.config as { mode?: string; tag_id?: string; next_node_key?: string };
      try {
        if (cfg.tag_id && run.contact_id) {
          if (cfg.mode === "remove") {
            await removeContactTag(db, {
              accountId: run.account_id,
              contactId: run.contact_id,
              tagId: cfg.tag_id,
            });
          } else {
            await addContactTagAndDispatch({
              db,
              accountId: run.account_id,
              contactId: run.contact_id,
              tagId: cfg.tag_id,
              context: { conversation_id: run.conversation_id ?? undefined, vars: run.vars },
            });
          }
        }
      } catch (err) {
        console.error("[flows] assign_label error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "update_contact") {
      const cfg = node.config as { field?: string; value?: string; next_node_key?: string };
      try {
        if (cfg.field && run.contact_id) {
          const val = interpolateVars(cfg.value || "", run.vars);
          if (["name", "email", "company"].includes(cfg.field)) {
            await db.from("contacts").update({ [cfg.field]: val }).eq("id", run.contact_id);
          }
        }
      } catch (err) {
        console.error("[flows] update_contact error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "send_email") {
      const cfg = node.config as unknown as SendEmailNodeConfig;
      let rawTo = cfg.to_email || "{{contact.email}}";
      let toEmail = interpolateVars(rawTo, run.vars).trim();

      // If toEmail unresolved, check run.vars.email or fetch from contact
      if ((!toEmail || toEmail === "{{contact.email}}") && run.contact_id) {
        const { data: contact } = await db
          .from("contacts")
          .select("email")
          .eq("id", run.contact_id)
          .maybeSingle();
        if (contact?.email) {
          toEmail = contact.email;
        }
      }

      const subject = interpolateVars(cfg.subject || "", run.vars);
      const body = interpolateVars(cfg.body || "", run.vars);

      let deliveryResult: { success: boolean; messageId?: string; error?: string } = {
        success: false,
        error: "Recipient email is missing or empty",
      };

      if (toEmail && toEmail.includes("@")) {
        try {
          let emailConfig: EmailConfigData | null = null;

          if (cfg.use_custom_smtp && cfg.smtp_host) {
            emailConfig = {
              provider: "smtp",
              smtp_host: cfg.smtp_host,
              smtp_port: cfg.smtp_port,
              smtp_username: cfg.username,
              smtp_password: cfg.password,
              smtp_encryption: cfg.encryption,
              from_name: cfg.from_name,
              from_email: cfg.from_email || "noreply@domain.com",
            };
          } else {
            // Centralized workspace configuration from email_configs
            const { data: savedConfig } = await db
              .from("email_configs")
              .select("*")
              .eq("account_id", run.account_id)
              .maybeSingle();

            if (savedConfig) {
              emailConfig = savedConfig as EmailConfigData;
            }
          }

          if (emailConfig) {
            deliveryResult = await dispatchEmail(emailConfig, {
              toEmail,
              subject,
              body,
            });
          } else {
            deliveryResult = {
              success: false,
              error: "No email integration configured. Please configure Brevo API or SMTP in Settings > Email.",
            };
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          deliveryResult = { success: false, error: errMsg };
        }
      }

      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "send_email",
        to: toEmail,
        subject,
        success: deliveryResult.success,
        messageId: deliveryResult.messageId,
        error: deliveryResult.error,
      });
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "delay") {
      const cfg = node.config as { amount?: number; unit?: string; next_node_key?: string };
      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "delay",
        amount: cfg.amount,
        unit: cfg.unit,
      });
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "webhook" || node.node_type === "http_fetch") {
      const cfg = node.config as { url?: string; method?: string; next_node_key?: string };
      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "webhook",
        url: cfg.url,
      });
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "ai_response") {
      const cfg = node.config as { prompt?: string; next_node_key?: string };
      try {
        await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: cfg.prompt ? interpolateVars(cfg.prompt, run.vars) : "Thank you, our AI agent will assist you shortly.",
        });
      } catch (err) {
        console.error("[flows] ai_response error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "create_deal") {
      const cfg = node.config as { title?: string; value?: number; next_node_key?: string };
      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "create_deal",
        title: interpolateVars(cfg.title || "", run.vars),
      });
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "catalog" || node.node_type === "book_appointment" || node.node_type === "add_to_group" || node.node_type === "remove_from_group") {
      const cfg = node.config as { next_node_key?: string };
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "handoff" || node.node_type === "agent_handover") {
      await executeHandoff(db, run, node);
      return { outcome: "handed_off" };
    }
    if (node.node_type === "end" || node.node_type === "close_conversation") {
      await logEvent(db, run.id, "completed", node.node_key);
      await endRun(db, run.id, "completed", "end_node");
      return { outcome: "completed" };
    }
    // Unknown node type — shouldn't happen given the CHECK constraint.
    await logEvent(db, run.id, "error", node.node_key, {
      reason: `unknown_node_type:${node.node_type}`,
    });
    await endRun(db, run.id, "failed", "unknown_node_type");
    return { outcome: "completed" };
  }
  // Safety break — log + fail.
  await logEvent(db, run.id, "error", currentKey, {
    reason: "advance_loop_safety_break",
  });
  await endRun(db, run.id, "failed", "advance_loop_overflow");
  return { outcome: "completed" };
}

/**
 * Optimistic UPDATE — only advance current_node_key when it matches
 * the value we read at the top of dispatch. If another webhook beat
 * us, the row's pointer has already moved and our UPDATE returns
 * zero rows; we treat that as a no-op and let the other run continue.
 */
async function advanceCurrentNodeKey(
  db: AdminClient,
  runId: string,
  expectedOldKey: string | null,
  newKey: string,
): Promise<boolean> {
  // PostgREST: when expectedOldKey is null we can't `.eq` (would match
  // any row); use `.is('current_node_key', null)` instead.
  let q = db
    .from("flow_runs")
    .update({
      current_node_key: newKey,
      last_advanced_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "active");
  if (expectedOldKey === null) {
    q = q.is("current_node_key", null);
  } else {
    q = q.eq("current_node_key", expectedOldKey);
  }
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[flows] advanceCurrentNodeKey error:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Best-effort typing indicator for an inbound message handled by Flows.
 * Marks the inbound message as read and shows "typing..." to the customer
 * immediately while the workflow processes.
 */
async function showFlowTypingIndicator(
  db: AdminClient,
  accountId: string,
  messageId?: string,
): Promise<void> {
  if (!messageId || process.env.NODE_ENV === "test" || process.env.VITEST) return;
  try {
    const { phoneNumberId, accessToken } = await loadAccountMetaCredentials(
      db as any,
      accountId,
    );
    await sendTypingIndicator({
      phoneNumberId,
      accessToken,
      messageId,
    });
  } catch (err) {
    // Best effort - never block the flow if typing indicator fails
    console.warn("[flows] typing indicator failed (continuing):", err);
  }
}

async function claimReplyTransition(
  db: AdminClient,
  run: FlowRunRow,
  nextNodeKey: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const fromKey = run.current_node_key;
  if (fromKey === null) return false;
  const nextSeq = (run.transition_seq ?? 0) + 1;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await db
        .from("flow_runs")
        .update({
          ...extra,
          current_node_key: nextNodeKey,
          transition_seq: nextSeq,
          reprompt_count: 0,
          last_advanced_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .eq("status", "active")
        .eq("current_node_key", fromKey)
        .eq("transition_seq", run.transition_seq ?? 0)
        .select("id");

      if (error) {
        const isTransient =
          error.message?.includes("fetch failed") ||
          error.message?.includes("network") ||
          error.message?.includes("ECONNRESET") ||
          error.message?.includes("ETIMEDOUT");
        if (isTransient && attempt < 2) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }
        console.error("[flows] claimReplyTransition error:", error.message);
        return false;
      }

      if (!Array.isArray(data) || data.length !== 1) return false;
      run.current_node_key = nextNodeKey;
      run.transition_seq = nextSeq;
      run.reprompt_count = 0;
      return true;
    } catch (err: any) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }
      console.error("[flows] claimReplyTransition exception:", err?.message ?? err);
      return false;
    }
  }
  return false;
}

async function closeActiveRun(
  db: AdminClient,
  run: FlowRunRow,
  closure: ActiveRunClosure,
  now: Date,
): Promise<void> {
  if (closure.kind === "timeout") {
    await markRunTimedOut(db, run.id, closure.check, "timed_out_on_reply", now);
    return;
  }
  await endRun(
    db,
    run.id,
    closure.kind === "cancel" ? "cancelled" : "failed",
    closure.reason,
  );
}

// ============================================================
// Public entry point — the webhook calls this on every inbound.
// ============================================================

export async function dispatchInboundToFlows(
  input: DispatchInboundInput & { isFirstInboundMessage: boolean },
): Promise<DispatchInboundResult> {
  const db = supabaseAdmin();
  let ownedRunId: string | null = null;
  try {
    const activeRun = await loadActiveRunForContact(
      db,
      input.accountId,
      input.contactId,
    );

    // Idempotency — only matters if there's already a run for this
    // contact. For new runs, the partial unique index catches duplicate
    // starts at INSERT time.
    if (activeRun) {
      ownedRunId = activeRun.id;
      const dupe = await isDuplicateInbound(
        db,
        input.accountId,
        input.contactId,
        input.message.meta_message_id,
      );
      if (dupe) {
        return {
          consumed: true,
          flow_run_id: activeRun.id,
          outcome: "duplicate_inbound_ignored",
        };
      }
      // One SELECT for the whole flow's nodes — advance loop is now
      // in-memory. See loadAllNodes.
      const [runFlow, nodes] = await Promise.all([
        loadFlow(db, activeRun.flow_id),
        loadAllNodes(db, activeRun.flow_id),
      ]);
      const now = new Date();
      const closure = closureForActiveRun({
        run: activeRun,
        flow: runFlow,
        nodeKeys: nodes,
        now,
      });
      if (!closure) {
        // Priority 1: Check if user sent a keyword trigger for any active flow
        const matchingEntryFlow = await findEntryFlow(
          db,
          input.accountId,
          input.message,
          false,
        );
        if (matchingEntryFlow) {
          if (matchingEntryFlow.id !== activeRun.flow_id) {
            await endRun(db, activeRun.id, "completed", "superseded_by_new_flow");
            const newNodes = await loadAllNodes(db, matchingEntryFlow.id);
            return startNewRun(db, matchingEntryFlow, input, newNodes);
          } else if (
            input.message.kind === "text" &&
            runFlow?.trigger_type === "keyword" &&
            matchesKeywordTrigger(input.message.text, (runFlow.trigger_config as unknown as KeywordTriggerConfig) ?? { keywords: [] })
          ) {
            await endRun(db, activeRun.id, "completed", "restarted_by_keyword");
            return startNewRun(db, matchingEntryFlow, input, nodes);
          }
        }

        // Fire typing indicator immediately so customer sees "typing..." instantly
        void showFlowTypingIndicator(db, input.accountId, input.message.meta_message_id);
        return handleReplyForActiveRun(
          db,
          activeRun,
          runFlow!,
          input.message,
          nodes,
        );
      }
      await closeActiveRun(db, activeRun, closure, now);
      ownedRunId = null;
    }

    // No active run → look for a flow whose entry trigger matches.
    const flow = await findEntryFlow(
      db,
      input.accountId,
      input.message,
      input.isFirstInboundMessage,
    );
    if (!flow || !flow.entry_node_id) {
      return { consumed: false, outcome: "no_match" };
    }
    // Fire typing indicator immediately as new flow run starts
    void showFlowTypingIndicator(db, input.accountId, input.message.meta_message_id);
    const nodes = await loadAllNodes(db, flow.id);
    return startNewRun(db, flow, input, nodes);
  } catch (err) {
    console.error(
      "[flows] dispatchInboundToFlows threw:",
      err instanceof Error ? err.message : err,
    );
    if (ownedRunId) {
      return { consumed: true, flow_run_id: ownedRunId, outcome: "run_error" };
    }
    return { consumed: false, outcome: "no_match" };
  }
}

async function handleReplyForActiveRun(
  db: AdminClient,
  run: FlowRunRow,
  flow: FlowRow,
  message: ParsedInbound,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  // Note: we intentionally do NOT persist the raw customer text. A
  // `collect_input` prompt that asks "what's your card number?" would
  // otherwise leave the PAN sitting in flow_run_events.payload forever,
  // visible to anyone with access to the runs viewer or the events
  // table. Length is enough for "did they actually reply?" debugging;
  // for the captured value itself, the `node_entered` event already
  // records `captured_key` + `captured_length` after the var is stored.
  await logEvent(db, run.id, "reply_received", run.current_node_key, {
    meta_message_id: message.meta_message_id,
    reply_kind: message.kind,
    reply_id: message.kind === "interactive_reply" ? message.reply_id : null,
    text_length: message.kind === "text" ? message.text.length : null,
  });

  const currentNode = nodes.get(run.current_node_key!)!;

  // Two ways a reply can advance:
  //   1. Interactive button/list/carousel tap on a send_buttons/send_list/send_carousel node.
  //   2. Text reply on a collect_input node — capture into vars.
  //
  // Everything else falls through to the fallback policy below.
  // 1. If run was paused, evaluate resume vs answer vs off-topic
  if (run.status === "paused_by_agent") {
    if (message.kind === "text") {
      const aiCfg = await loadAiConfig(db, run.account_id).catch(() => null);
      const collectCfg =
        currentNode.node_type === "collect_input" || currentNode.node_type === "input_flow"
          ? (currentNode.config as unknown as CollectInputNodeConfig)
          : null;

      const history = run.conversation_id
        ? await buildConversationContext(db, run.conversation_id, 6).catch(() => [])
        : [];

      const classification = await analyzeFlowInput({
        text: message.text,
        promptText: collectCfg?.prompt_text || "",
        varKey: collectCfg?.var_key || "",
        validation: collectCfg?.validation,
        regex: collectCfg?.regex,
        currentVars: run.vars,
        conversationHistory: history,
        aiConfig: aiCfg,
        allowInterruption: collectCfg?.allow_interruption !== false,
      });

      if (classification.intent === "cancel") {
        await endRun(db, run.id, "cancelled", "user_cancelled");
        return { consumed: true, flow_run_id: run.id, outcome: "completed" };
      }

      if (classification.intent === "restart") {
        await endRun(db, run.id, "cancelled", "user_restarted");
        return startNewRun(
          db,
          flow,
          {
            accountId: run.account_id,
            userId: run.user_id,
            contactId: run.contact_id!,
            conversationId: run.conversation_id!,
            message,
          },
          nodes,
        );
      }

      if (classification.intent === "resume") {
        // Reactivate run and resend the current prompt!
        await db.from("flow_runs").update({ status: "active", end_reason: null }).eq("id", run.id);
        run.status = "active";
        await logEvent(db, run.id, "node_entered", currentNode.node_key, { action: "flow_resumed" });

        if (currentNode.node_type === "send_buttons") {
          await sendButtonsAndSuspend(db, run, currentNode);
        } else if (currentNode.node_type === "send_list") {
          await sendListAndSuspend(db, run, currentNode);
        } else if (
          (currentNode.node_type === "collect_input" || currentNode.node_type === "input_flow") &&
          collectCfg
        ) {
          await engineSendText({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id!,
            contactId: run.contact_id!,
            text: interpolateVars(collectCfg.prompt_text, run.vars),
          });
        }
        return { consumed: true, flow_run_id: run.id, outcome: "advanced" };
      }

      if (classification.intent === "valid_input" && collectCfg) {
        // User answered the paused step directly! Reactivate and advance!
        const rawCaptured = (classification.extracted_value ?? message.text).trim();
        const { isValid, normalized } = validateAndNormalize(
          collectCfg.validation,
          rawCaptured,
          collectCfg.regex,
        );

        if (isValid && normalized !== null && collectCfg.var_key && collectCfg.next_node_key) {
          await db.from("flow_runs").update({ status: "active", end_reason: null, reprompt_count: 0 }).eq("id", run.id);
          run.status = "active";
          run.reprompt_count = 0;
          const rawKey = collectCfg.var_key.startsWith("vars.") ? collectCfg.var_key.slice(5) : collectCfg.var_key;
          const newVars = {
            ...run.vars,
            [collectCfg.var_key]: normalized,
            [rawKey]: normalized,
            [`vars.${rawKey}`]: normalized,
          };
          if (!(await claimReplyTransition(db, run, collectCfg.next_node_key, { vars: newVars, reprompt_count: 0 }))) {
            return lostReplyRace(db, run, currentNode.node_key);
          }
          run.vars = newVars;
          await logEvent(db, run.id, "node_entered", currentNode.node_key, {
            action: "flow_resumed_with_answer",
            captured_key: collectCfg.var_key,
            captured_value: normalized,
          });
          const outcome = await advanceFromNodeKey(db, run, collectCfg.next_node_key, nodes);
          return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
        }
      }

      // Customer is still asking off-topic questions -> keep paused and route to AI!
      return { consumed: false, flow_run_id: run.id, outcome: "no_match" };
    }
  }

  let matched: string | null = null;
  if (
    message.kind === "interactive_reply" &&
    (currentNode.node_type === "send_buttons" ||
      currentNode.node_type === "send_list" ||
      currentNode.node_type === "send_carousel")
  ) {
    matched = matchReplyId(currentNode, message.reply_id);
  } else if (
    message.kind === "text" &&
    (currentNode.node_type === "collect_input" || currentNode.node_type === "input_flow")
  ) {
    const cfg = currentNode.config as unknown as CollectInputNodeConfig;
    const aiCfg = await loadAiConfig(db, run.account_id).catch(() => null);

    const history = run.conversation_id
      ? await buildConversationContext(db, run.conversation_id, 6).catch(() => [])
      : [];

    // AI Intent Classification & Smart Entity Extraction
    const classification = await analyzeFlowInput({
      text: message.text,
      promptText: cfg.prompt_text,
      varKey: cfg.var_key,
      validation: cfg.validation,
      regex: cfg.regex,
      currentVars: run.vars,
      conversationHistory: history,
      aiConfig: aiCfg,
      allowInterruption: cfg.allow_interruption !== false,
    });

    if (classification.intent === "cancel") {
      await endRun(db, run.id, "cancelled", "user_cancelled");
      return { consumed: true, flow_run_id: run.id, outcome: "completed" };
    }

    if (classification.intent === "restart") {
      await endRun(db, run.id, "cancelled", "user_restarted");
      return startNewRun(
        db,
        flow,
        {
          accountId: run.account_id,
          userId: run.user_id,
          contactId: run.contact_id!,
          conversationId: run.conversation_id!,
          message,
        },
        nodes,
      );
    }

    if (classification.intent === "interruption") {
      // Pause the flow, preserve vars and node key, and let AI answer the customer's query!
      await db
        .from("flow_runs")
        .update({
          status: "paused_by_agent",
          end_reason: "interrupted_by_user",
        })
        .eq("id", run.id);

      await logEvent(db, run.id, "fallback_fired", currentNode.node_key, {
        action: "paused_for_ai",
        text_length: message.text.length,
        reason: classification.reason,
      });

      return {
        consumed: false,
        flow_run_id: run.id,
        outcome: "no_match",
      };
    }

    if (classification.intent === "valid_input") {
      // Intent is valid_input: validate and extract clean value
      const rawCaptured = (classification.extracted_value ?? message.text).trim();
      const { isValid, normalized } = validateAndNormalize(cfg.validation, rawCaptured, cfg.regex);

      if (isValid && normalized !== null && cfg.var_key && cfg.next_node_key) {
        const rawKey = cfg.var_key.startsWith("vars.") ? cfg.var_key.slice(5) : cfg.var_key;
        const newVars = {
          ...run.vars,
          [cfg.var_key]: normalized,
          [rawKey]: normalized,
          [`vars.${rawKey}`]: normalized,
        };
        if (!(await claimReplyTransition(db, run, cfg.next_node_key, { vars: newVars, reprompt_count: 0 }))) {
          return lostReplyRace(db, run, currentNode.node_key);
        }
        run.vars = newVars;
        run.reprompt_count = 0;
        await logEvent(db, run.id, "node_entered", currentNode.node_key, {
          captured_key: cfg.var_key,
          captured_length: normalized.length,
        });
        const outcome = await advanceFromNodeKey(db, run, cfg.next_node_key, nodes);
        return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
      }
    }

    // Unclear input or validation failed: evaluate fallback policy and reprompt/handoff/end
    const newReprompts = run.reprompt_count + 1;
    const policy = resolveFallbackPolicy(flow.fallback_policy);
    const action = decideFallback({ policy, reprompt_count: newReprompts });

    if (action.type === "reprompt") {
      await db.from("flow_runs").update({ reprompt_count: newReprompts }).eq("id", run.id);
      run.reprompt_count = newReprompts;

      const correctiveMessage =
        cfg.invalid_message?.trim() ||
        getDefaultInvalidMessage(cfg.validation);

      await engineSendText({
        accountId: run.account_id,
        userId: run.user_id,
        conversationId: run.conversation_id!,
        contactId: run.contact_id!,
        text: interpolateVars(correctiveMessage, run.vars),
      });

      await logEvent(db, run.id, "fallback_fired", currentNode.node_key, {
        action: "reprompt_invalid_input",
        reprompt_count: newReprompts,
        reason: classification.reason,
      });

      return { consumed: true, flow_run_id: run.id, outcome: "advanced" };
    }

    const fallbackClaim: Record<string, unknown> = {
      reprompt_count: newReprompts,
      status: action.type === "handoff" ? "handed_off" : "completed",
      ended_at: new Date().toISOString(),
      end_reason:
        action.type === "handoff"
          ? "fallback_exhausted"
          : "fallback_exhausted_end",
    };

    if (!(await claimFallbackTransition(db, run, fallbackClaim))) {
      return lostReplyRace(db, run, currentNode.node_key);
    }

    await logEvent(db, run.id, "fallback_fired", currentNode.node_key, {
      action: action.type,
      reprompt_count: newReprompts,
    });

    if (action.type === "handoff") {
      if (run.conversation_id) {
        await db
          .from("conversations")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", run.conversation_id);
      }
      await logEvent(db, run.id, "handoff", run.current_node_key, {
        reason: "fallback_exhausted",
      });
      return { consumed: true, flow_run_id: run.id, outcome: "handed_off" };
    }

    return { consumed: true, flow_run_id: run.id, outcome: "completed" };
  }

  if (matched) {
    if (!(await claimReplyTransition(db, run, matched))) {
      return lostReplyRace(db, run, currentNode.node_key);
    }
    const outcome = await advanceFromNodeKey(db, run, matched, nodes);
    return {
      consumed: true,
      flow_run_id: run.id,
      outcome: outcome.outcome,
    };
  }

  // When customer sent text while flow is waiting on interactive menus (buttons/list/carousel)
  if (
    message.kind === "text" &&
    (currentNode.node_type === "send_buttons" ||
      currentNode.node_type === "send_list" ||
      currentNode.node_type === "send_carousel")
  ) {
    // 0. Check explicit flow command
    const cmd = checkFlowCommand(message.text);
    if (cmd === "cancel") {
      await endRun(db, run.id, "cancelled", "user_cancelled");
      return { consumed: true, flow_run_id: run.id, outcome: "completed" };
    }
    if (cmd === "restart") {
      await endRun(db, run.id, "cancelled", "user_restarted");
      return startNewRun(
        db,
        flow,
        {
          accountId: run.account_id,
          userId: run.user_id,
          contactId: run.contact_id!,
          conversationId: run.conversation_id!,
          message,
        },
        nodes,
      );
    }

    // 1. Check if the typed text matches the current flow's entry trigger keywords to restart
    if (
      flow.trigger_type === "keyword" &&
      matchesKeywordTrigger(message.text, flow.trigger_config as KeywordTriggerConfig)
    ) {
      await endRun(db, run.id, "completed", "restarted_by_keyword");
      return startNewRun(
        db,
        flow,
        {
          accountId: run.account_id,
          userId: run.user_id,
          contactId: run.contact_id!,
          conversationId: run.conversation_id!,
          message,
        },
        nodes,
      );
    }

    // 2. Off-script message (e.g. "I want a book", "Hello"):
    // Pause the flow and route to AI Auto-Reply or agent!
    await db
      .from("flow_runs")
      .update({
        status: "paused_by_agent",
        end_reason: "interrupted_by_user",
      })
      .eq("id", run.id);

    await logEvent(db, run.id, "fallback_fired", currentNode.node_key, {
      action: "paused_for_ai",
      text_length: message.text.length,
    });
    return {
      consumed: false,
      flow_run_id: run.id,
      outcome: "no_match",
    };
  }

  // No match → fallback. Apply the policy.
  const policy = resolveFallbackPolicy(flow.fallback_policy);
  const newReprompts = run.reprompt_count + 1;
  const action = decideFallback({ policy, reprompt_count: newReprompts });
  if (action.type === "ignore") {
    await logEvent(db, run.id, "fallback_fired", run.current_node_key, {
      action: action.type,
      reprompt_count: newReprompts,
    });
    // Don't consume — let automations have a shot at it.
    return { consumed: false, flow_run_id: run.id, outcome: "no_match" };
  }

  const fallbackClaim: Record<string, unknown> =
    action.type === "reprompt"
      ? { reprompt_count: newReprompts }
      : {
          reprompt_count: newReprompts,
          status: action.type === "handoff" ? "handed_off" : "completed",
          ended_at: new Date().toISOString(),
          end_reason:
            action.type === "handoff"
              ? "fallback_exhausted"
              : "fallback_exhausted_end",
        };
  if (!(await claimFallbackTransition(db, run, fallbackClaim))) {
    return lostReplyRace(db, run, currentNode.node_key);
  }
  await logEvent(db, run.id, "fallback_fired", currentNode.node_key, {
    action: action.type,
    reprompt_count: newReprompts,
  });
  if (action.type === "reprompt") {
    // Re-send the same prompt. Same node, no current_node_key change.
    // The interactive helpers interpolate run.vars themselves, so a
    // reprompt renders the same text the original prompt did. A send
    // failure here is logged but does not end the run — the customer
    // still has the original prompt on screen and can retry.
    try {
      if (currentNode.node_type === "send_buttons") {
        await sendButtonsAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "send_list") {
        await sendListAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "send_carousel") {
        await sendCarouselAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "collect_input" || currentNode.node_type === "input_flow") {
        // Customer typed something we couldn't accept (empty after trim,
        // or var_key missing — rare). Re-send the prompt so they try again.
        const cfg = currentNode.config as unknown as CollectInputNodeConfig;
        await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.prompt_text, run.vars),
        });
      }
    } catch (err) {
      await logEvent(db, run.id, "error", currentNode.node_key, {
        reason: "reprompt_send_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    return { consumed: true, flow_run_id: run.id, outcome: "fallback_fired" };
  }
  if (action.type === "handoff") {
    if (run.conversation_id) {
      await db
        .from("conversations")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", run.conversation_id);
    }
    await logEvent(db, run.id, "handoff", run.current_node_key, {
      reason: "fallback_exhausted",
    });
    return { consumed: true, flow_run_id: run.id, outcome: "handed_off" };
  }
  return { consumed: true, flow_run_id: run.id, outcome: "completed" };
}

async function claimFallbackTransition(
  db: AdminClient,
  run: FlowRunRow,
  update: Record<string, unknown>,
): Promise<boolean> {
  const fromKey = run.current_node_key;
  if (fromKey === null) return false;
  const nextSeq = (run.transition_seq ?? 0) + 1;
  const { data, error } = await db
    .from("flow_runs")
    .update({ ...update, transition_seq: nextSeq })
    .eq("id", run.id)
    .eq("status", "active")
    .eq("current_node_key", fromKey)
    .eq("transition_seq", run.transition_seq ?? 0)
    .select("id");
  if (error) {
    console.error("[flows] claimFallbackTransition error:", error.message);
    return false;
  }
  if (!Array.isArray(data) || data.length !== 1) return false;
  run.transition_seq = nextSeq;
  run.reprompt_count = update.reprompt_count as number;
  return true;
}

async function lostReplyRace(
  db: AdminClient,
  run: FlowRunRow,
  nodeKey: string,
): Promise<DispatchInboundResult> {
  await logEvent(db, run.id, "error", nodeKey, {
    reason: "lost_race_during_reply",
  });
  return {
    consumed: true,
    flow_run_id: run.id,
    outcome: "duplicate_inbound_ignored",
  };
}

async function startNewRun(
  db: AdminClient,
  flow: FlowRow,
  input: DispatchInboundInput,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  // Pre-seed contact info into run vars so {{contact.name}}, {{contact.phone}}, {{contact.email}} work
  let initialVars: Record<string, unknown> = {};
  if (input.contactId) {
    try {
      const { data: contact } = await db
        .from("contacts")
        .select("name, phone, email")
        .eq("id", input.contactId)
        .maybeSingle();
      if (contact) {
        initialVars = {
          "contact.name": (contact as any).name || "",
          "contact.phone": (contact as any).phone || "",
          "contact.email": (contact as any).email || "",
          contact: {
            name: (contact as any).name || "",
            phone: (contact as any).phone || "",
            email: (contact as any).email || "",
          },
        };
      }
    } catch {
      // Non-fatal if contact lookup fails
    }
  }

  // INSERT — partial unique index `idx_one_active_run_per_contact`
  // catches concurrent inserts with 23505. We catch and return as
  // consumed:true (the parallel webhook handles it).
  const { data: inserted, error: insErr } = await db
    .from("flow_runs")
    .insert({
      flow_id: flow.id,
      // Tenancy: NOT NULL post-017. The partial unique index
      // `idx_one_active_run_per_contact` is over (account_id,
      // contact_id) WHERE status='active', so two accounts sharing
      // a contact phone number each run their own flows independently.
      account_id: flow.account_id,
      // Audit: preserves the flow's author on the run row for log
      // attribution.
      user_id: flow.user_id,
      contact_id: input.contactId,
      conversation_id: input.conversationId,
      status: "active",
      current_node_key: flow.entry_node_id,
      vars: initialVars,
    })
    .select("*")
    .maybeSingle();
  if (insErr) {
    // 23505 = unique_violation → another webhook is starting the run.
    const msg = insErr.message ?? "";
    if (msg.includes("23505") || msg.includes("duplicate key")) {
      return { consumed: true, outcome: "duplicate_inbound_ignored" };
    }
    console.error("[flows] startNewRun insert error:", insErr.message);
    return { consumed: false, outcome: "no_match" };
  }
  const run = inserted as FlowRunRow;
  await logEvent(db, run.id, "started", flow.entry_node_id, {
    flow_id: flow.id,
    trigger_type: flow.trigger_type,
    meta_message_id: input.message.meta_message_id,
  });
  // Bump the flow's execution counter — used by the builder UI to
  // surface "X runs since activation" on the flow card.
  //
  // Atomic RPC (migration 012) rather than read-modify-write: two
  // concurrent webhooks starting runs for different contacts on the
  // same flow would otherwise both read N and both write N+1, losing
  // a count. Mirrors the automations engine's use of
  // `increment_automation_execution_count` (migration 007).
  const { error: incErr } = await db.rpc("increment_flow_execution_count", {
    p_flow_id: flow.id,
  });
  if (incErr) {
    // Non-fatal — the run itself succeeded; only the counter is off.
    console.error("[flows] execution_count rpc error:", incErr.message);
  }

  // Run the advance loop starting from the entry node.
  const outcome = await advanceFromNodeKey(db, run, flow.entry_node_id!, nodes);
  return {
    consumed: true,
    flow_run_id: run.id,
    outcome: outcome.outcome === "advanced" ? "started" : outcome.outcome,
  };
}
