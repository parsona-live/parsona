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
import { resolveFallbackPolicy, decideFallback } from "./fallback";
import {
  analyzeFlowInput,
  validateAndNormalize,
  getDefaultInvalidMessage,
  checkFlowCommand,
} from "./input-analyzer";
import { buildConversationContext } from "@/lib/ai/context";
import { localizeNode, localizeText } from "./localization";
import { detectLanguage, fastPathDetectLanguage } from "./language-detector";
import { loadAiConfig } from "@/lib/ai/config";
import { dispatchEmail, type EmailConfigData } from "@/lib/email/email-service";
import { addContactTagAndDispatch } from "@/lib/contacts/tag-events";
import { removeContactTag } from "@/lib/contacts/tag-write";
import { logContactActivity } from "@/lib/contacts/timeline";
import { upsertCustomerMemory } from "@/lib/context/memory";
import { checkRunTimeout, markRunTimedOut, type RunTimeoutCheck } from "./timeout";
import { safeInterpolate } from "./safe-interpolator";
import {
  executeAiMessageNode,
  executeAiExtractNode,
  executeAiDecisionNode,
  executeAiSummarizeNode,
} from "./ai-node-service";
import { routeInboundIntent, scoreSemanticIntent } from "./intent-router";
import { isDeliverableUrl } from "@/lib/webhooks/ssrf";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp/meta-api";
import { executeAccountIntegration } from "@/lib/integrations/runner";
import {
  queryRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  formatCrmRecordsText,
} from "@/lib/crm/service";
import type { CrmFilter } from "@/lib/crm/types";
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
  type AiMessageNodeConfig,
  type AiExtractNodeConfig,
  type AiDecisionNodeConfig,
  type AiSummarizeNodeConfig,
  type AiIntentTriggerConfig,
  type WebhookNodeConfig,
  type PromptTextConfig,
  type CreateDealNodeConfig,
  type CrmFetchNodeConfig,
  type CrmMutateNodeConfig,
  type NotifyMemberNodeConfig,
  type WhatsAppPaymentNodeConfig,
  type WhatsAppFormNodeConfig,
  type CatalogNodeConfig,
  type BookAppointmentNodeConfig,
  type AddToGroupNodeConfig,
  type RemoveFromGroupNodeConfig,
  type TriggerFlowNodeConfig,
  type FlowCatalogItem,
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
 * Given a node + the customer's typed text, matches against interactive options
 * (buttons, list rows, carousel cards) to advance the flow.
 * Supports:
 * - 1-based index (e.g. "1", "2", "3", "#1")
 * - Direct reply_id match
 * - Exact or normalized title match (case-insensitive, trimmed)
 * - Substring title match
 * - Affirmative/negative synonyms for yes/no/confirm/cancel buttons
 */
export function matchReplyByText(
  node: { node_type: string; config: Record<string, unknown> },
  text: string,
): string | null {
  const norm = text.trim().toLowerCase();
  if (!norm) return null;

  if (node.node_type === "send_buttons") {
    const cfg = node.config as unknown as SendButtonsNodeConfig;
    const buttons = cfg.buttons ?? [];
    if (buttons.length === 0) return null;

    // 1. 1-based index (e.g. "1", "2", "3", "#1", "opt 1")
    const numMatch = norm.match(/^(?:#|\bopt(?:ion)?\s*)?([1-9]\d*)$/i);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < buttons.length) {
        return buttons[idx].next_node_key ?? null;
      }
    }

    // 2. Direct reply_id match
    const idHit = buttons.find((b) => b.reply_id && b.reply_id.toLowerCase() === norm);
    if (idHit) return idHit.next_node_key ?? null;

    // 3. Exact title match
    const titleHit = buttons.find((b) => b.title && b.title.trim().toLowerCase() === norm);
    if (titleHit) return titleHit.next_node_key ?? null;

    // 4. Substring title match (e.g. user typed "confirm booking" for button "Confirm", or vice-versa)
    const subHit = buttons.find((b) => {
      const bTitle = b.title ? b.title.trim().toLowerCase() : "";
      return bTitle.length >= 2 && (norm.includes(bTitle) || bTitle.includes(norm));
    });
    if (subHit) return subHit.next_node_key ?? null;

    // 5. Affirmative / negative synonyms
    const isAffirmative = /^(yes|yeah|yup|haan|ha|confirm|agree|proceed|ok|okay|theek|sahi\s*hai|sure|done|accept)\b/i.test(norm);
    const isNegative = /^(no|nah|nope|nahi|na|cancel|reject|decline|stop|abort|galat)\b/i.test(norm);

    if (isAffirmative) {
      const yesBtn = buttons.find((b) =>
        /^(confirm|yes|haan|ha|agree|proceed|accept|ok|sure|sahi)/i.test((b.title || "").trim())
      );
      if (yesBtn) return yesBtn.next_node_key ?? null;
    }

    if (isNegative) {
      const noBtn = buttons.find((b) =>
        /^(cancel|no|nahi|na|reject|decline|abort)/i.test((b.title || "").trim())
      );
      if (noBtn) return noBtn.next_node_key ?? null;
    }

    return null;
  }

  if (node.node_type === "send_list") {
    const cfg = node.config as unknown as SendListNodeConfig;
    const allRows: Array<{ reply_id: string; title: string; next_node_key?: string }> = [];
    for (const section of cfg.sections ?? []) {
      for (const row of section.rows ?? []) {
        allRows.push(row);
      }
    }
    if (allRows.length === 0) return null;

    const numMatch = norm.match(/^(?:#|\bopt(?:ion)?\s*)?([1-9]\d*)$/i);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < allRows.length) {
        return allRows[idx].next_node_key ?? null;
      }
    }

    const idHit = allRows.find((r) => r.reply_id && r.reply_id.toLowerCase() === norm);
    if (idHit) return idHit.next_node_key ?? null;

    const titleHit = allRows.find((r) => r.title && r.title.trim().toLowerCase() === norm);
    if (titleHit) return titleHit.next_node_key ?? null;

    const subHit = allRows.find((r) => {
      const rTitle = r.title ? r.title.trim().toLowerCase() : "";
      return rTitle.length >= 2 && (norm.includes(rTitle) || rTitle.includes(norm));
    });
    if (subHit) return subHit.next_node_key ?? null;

    return null;
  }

  if (node.node_type === "send_carousel") {
    const cfg = node.config as unknown as SendCarouselNodeConfig;
    const allButtons: Array<{ reply_id: string; title: string; next_node_key?: string }> = [];
    for (const card of cfg.cards ?? []) {
      for (const b of card.buttons ?? []) {
        allButtons.push(b);
      }
    }
    if (allButtons.length === 0) return null;

    const idHit = allButtons.find((b) => b.reply_id && b.reply_id.toLowerCase() === norm);
    if (idHit) return idHit.next_node_key ?? null;

    const titleHit = allButtons.find((b) => b.title && b.title.trim().toLowerCase() === norm);
    if (titleHit) return titleHit.next_node_key ?? null;

    return null;
  }

  return null;
}

/**
 * Extracts contextual metadata & custom button `set_vars` when a customer taps
 * an interactive button, list row, or carousel card button (e.g. capturing
 * `selected_card_title` such as "Dr. Nisha Tupkar" and `set_vars.doctor`).
 */
export function extractInteractiveSelectionVars(
  node: FlowNodeRow,
  message: ParsedInbound,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {};
  const isReplyId = message.kind === "interactive_reply";
  const target = (isReplyId ? message.reply_id : message.kind === "text" ? message.text : "")
    .trim()
    .toLowerCase();
  if (!target) return vars;

  if (node.node_type === "send_buttons") {
    const cfg = node.config as unknown as SendButtonsNodeConfig;
    const hit = isReplyId
      ? cfg.buttons?.find((b) => b.reply_id === message.reply_id)
      : cfg.buttons?.find((b) => b.reply_id?.toLowerCase() === target || b.title?.trim().toLowerCase() === target);
    if (hit) {
      vars.selected_reply_id = hit.reply_id;
      vars.selected_button_title = hit.title;
      if (hit.set_vars && typeof hit.set_vars === "object") {
        Object.assign(vars, hit.set_vars);
      }
    }
  } else if (node.node_type === "send_list") {
    const cfg = node.config as unknown as SendListNodeConfig;
    for (const section of cfg.sections ?? []) {
      const hit = isReplyId
        ? section.rows?.find((r) => r.reply_id === message.reply_id)
        : section.rows?.find((r) => r.reply_id?.toLowerCase() === target || r.title?.trim().toLowerCase() === target);
      if (hit) {
        vars.selected_reply_id = hit.reply_id;
        vars.selected_button_title = hit.title;
        if (hit.set_vars && typeof hit.set_vars === "object") {
          Object.assign(vars, hit.set_vars);
        }
        break;
      }
    }
  } else if (node.node_type === "send_carousel") {
    const cfg = node.config as unknown as SendCarouselNodeConfig;
    for (const card of cfg.cards ?? []) {
      const hit = isReplyId
        ? card.buttons?.find((b) => b.reply_id === message.reply_id)
        : card.buttons?.find((b) => b.reply_id?.toLowerCase() === target || b.title?.trim().toLowerCase() === target);
      if (hit) {
        vars.selected_reply_id = hit.reply_id;
        vars.selected_button_title = hit.title;
        const cardTitle =
          (card as unknown as { title?: string }).title?.trim() ||
          (card.body_text || "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .find(Boolean) ||
          "";
        if (cardTitle) {
          vars.selected_card_title = cardTitle;
        }
        if (card.body_text) {
          vars.selected_card_body = card.body_text;
        }
        if (hit.set_vars && typeof hit.set_vars === "object") {
          Object.assign(vars, hit.set_vars);
        }
        break;
      }
    }
  }

  return vars;
}

/**
 * Case-insensitive contains/exact match against a list of keywords.
 * Used by the trigger evaluator. Stable enough that the v3 builder
 * UI can preview matches by passing canned strings.
 *
 * NOTE: For "contains", matches on whole-word/phrase boundaries using Unicode
 * characters so that short keywords like "hi" or "he" do not erroneously match
 * substrings inside unrelated words (e.g. Hindi "chahiye", English "this" or "machine").
 */
export function matchesKeywordTrigger(
  text: string,
  cfg: KeywordTriggerConfig,
): boolean {
  if (!text || !cfg.keywords?.length) return false;
  const matchType = cfg.match_type ?? "contains";
  const rawHaystack = cfg.case_sensitive ? text : text.toLowerCase();
  const haystack = rawHaystack.trim();
  const strippedHaystack = haystack.replace(/[.!?]+$/, "").trim();

  // Support comma-separated keywords if saved in a single string
  const rawList = cfg.keywords.flatMap((k) => (typeof k === "string" ? k.split(",") : []));

  for (const raw of rawList) {
    if (!raw) continue;
    const needle = cfg.case_sensitive ? raw.trim() : raw.trim().toLowerCase();
    if (!needle) continue;

    if (matchType === "exact") {
      if (haystack === needle || strippedHaystack === needle) return true;
    } else {
      // Match whole word or phrase with Unicode boundaries:
      // Prevents short keywords like "hi" from triggering on "chahiye", "this", "machine", etc.
      const isWordPattern = /^[\p{L}\p{N}\s]+$/u.test(needle);
      if (isWordPattern) {
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundaryRegex = new RegExp(
          `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
          cfg.case_sensitive ? "u" : "iu",
        );
        if (wordBoundaryRegex.test(haystack)) {
          return true;
        }
      } else {
        if (haystack.includes(needle)) {
          return true;
        }
      }
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
    case "greater_than":
    case "less_than":
    case "greater_or_equal":
    case "less_or_equal": {
      if (args.subjectValue === undefined) return false;
      const numSubject = parseFloat(String(args.subjectValue).replace(/[^0-9.-]/g, ""));
      const numConfig = parseFloat(String(args.configValue ?? "").replace(/[^0-9.-]/g, ""));
      if (isNaN(numSubject) || isNaN(numConfig)) return false;
      if (args.operator === "greater_than") return numSubject > numConfig;
      if (args.operator === "less_than") return numSubject < numConfig;
      if (args.operator === "greater_or_equal") return numSubject >= numConfig;
      if (args.operator === "less_or_equal") return numSubject <= numConfig;
      return false;
    }
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
  conversationId?: string,
): Promise<FlowRunRow | null> {
  let query = db
    .from("flow_runs")
    .select("*")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .in("status", ["active", "paused_by_agent"])

  if (conversationId) {
    query = query.eq("conversation_id", conversationId)
  }

  const { data, error } = await query
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

const RECENT_MESSAGE_DEDUP_CACHE = new Map<string, number>();

/**
 * In-memory fast-path deduplication to block microsecond concurrency races from webhook retries.
 */
export function checkAndRecordInboundDeduplication(metaMessageId?: string): boolean {
  if (!metaMessageId) return false;
  if (process.env.NODE_ENV === "test" && !metaMessageId.startsWith("dedup-test-")) {
    return false;
  }
  const now = Date.now();
  for (const [key, ts] of RECENT_MESSAGE_DEDUP_CACHE.entries()) {
    if (now - ts > 60000) RECENT_MESSAGE_DEDUP_CACHE.delete(key);
  }
  if (RECENT_MESSAGE_DEDUP_CACHE.has(metaMessageId)) {
    return true;
  }
  RECENT_MESSAGE_DEDUP_CACHE.set(metaMessageId, now);
  return false;
}

export function clearInboundDeduplicationCache(): void {
  RECENT_MESSAGE_DEDUP_CACHE.clear();
}

export async function isFlowCompletedForContact(
  db: AdminClient,
  flowId: string,
  contactId: string,
): Promise<boolean> {
  if (!flowId || !contactId) return false;
  const { count, error } = await db
    .from("flow_completed_contacts")
    .select("contact_id", { count: "exact", head: true })
    .eq("flow_id", flowId)
    .eq("contact_id", contactId);
  if (error) {
    return false;
  }
  return (count ?? 0) > 0;
}

export async function markFlowCompletedForContact(
  db: AdminClient,
  flowId: string,
  contactId: string,
): Promise<void> {
  if (!flowId || !contactId) return;
  try {
    const tableClient = db.from("flow_completed_contacts");
    const row = { flow_id: flowId, contact_id: contactId, completed_at: new Date().toISOString() };
    if (typeof (tableClient as any).upsert === "function") {
      await (tableClient as any).upsert(row, { onConflict: "flow_id,contact_id" });
    } else {
      await tableClient.insert(row);
    }
  } catch (err) {
    console.warn("[flows] markFlowCompletedForContact error:", err);
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
  if (!metaMessageId) return false;
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
    .in("event_type", ["reply_received", "started"])
    .filter("payload->>meta_message_id", "eq", metaMessageId);
  return (count ?? 0) > 0;
}

async function findEntryFlow(
  db: AdminClient,
  accountId: string,
  message: ParsedInbound,
  isFirstInbound: boolean,
  channel?: string,
  contactId?: string,
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
    // Channel filter check
    const flowChannels = (flow as unknown as { channels?: string[] }).channels;
    if (channel && flowChannels && flowChannels.length > 0 && !flowChannels.includes(channel)) {
      continue;
    }

    // run_once check
    if (flow.run_once && contactId) {
      const alreadyCompleted = await isFlowCompletedForContact(db, flow.id, contactId);
      if (alreadyCompleted) continue;
    }

    if (flow.trigger_type === "keyword") {
      const cfg = flow.trigger_config as KeywordTriggerConfig;
      if (candidates.some((text) => matchesKeywordTrigger(text, cfg))) {
        return flow;
      }
    } else if (flow.trigger_type === "first_inbound_message" && isFirstInbound) {
      return flow;
    } else if (flow.trigger_type === ("ai_intent" as any) && message.kind === "text") {
      const cfg = (flow.trigger_config || {}) as unknown as AiIntentTriggerConfig;
      const { score } = scoreSemanticIntent(message.text, cfg);
      const threshold = cfg.confidence_threshold ?? 0.75;
      if (score >= threshold) {
        return flow;
      }
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

/**
 * Resolves the final text to send to the customer.
 * If text_mode is "prompt" and prompt is configured, dynamically generates contextual text via AI.
 * Falls back safely to fallback_text or defaultStaticText.
 */
export async function resolveNodeText(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
  defaultStaticText: string,
  config: PromptTextConfig,
  message?: ParsedInbound
): Promise<string> {
  if (config.text_mode === "prompt" && config.prompt?.trim()) {
    try {
      const res = await executeAiMessageNode({
        db: db as any,
        run,
        node: {
          ...node,
          config: {
            mode: "generated",
            prompt: config.prompt,
            fallback_text: config.fallback_text || defaultStaticText,
            language_style: config.language_style,
            context_sources: config.context_sources || ["contact", "conversation", "memories"],
          },
        },
        message,
      });
      if (res.text && res.text.trim()) {
        return res.text.trim();
      }
    } catch (err) {
      console.warn(`[engine] resolveNodeText dynamic prompt failed for node ${node.node_key}, using fallback:`, err);
    }
    if (config.fallback_text?.trim()) {
      return interpolateVars(config.fallback_text, run.vars);
    }
  }
  return interpolateVars(defaultStaticText, run.vars);
}

async function sendButtonsAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendButtonsNodeConfig;
  const resolvedBody = await resolveNodeText(db, run, node, cfg.text || "", cfg);
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
    bodyText: resolvedBody,
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
  const resolvedBody = await resolveNodeText(db, run, node, cfg.text || "", cfg);
  // See sendButtonsAndSuspend — interpolate every visible string,
  // never the row `reply_id`.
  const { whatsapp_message_id } = await engineSendInteractiveList({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: resolvedBody,
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

export async function resolveRoundRobinAgent(
  db: AdminClient,
  accountId: string,
): Promise<string | null> {
  const { data: profiles, error } = await db
    .from("profiles")
    .select("user_id")
    .eq("account_id", accountId)
    .in("account_role", ["admin", "agent"]);

  if (error || !profiles || profiles.length === 0) {
    const { data: fallbackProfiles } = await db
      .from("profiles")
      .select("user_id")
      .eq("account_id", accountId)
      .limit(5);
    if (!fallbackProfiles || fallbackProfiles.length === 0) return null;
    return fallbackProfiles[0].user_id;
  }

  if (profiles.length === 1) return profiles[0].user_id;

  const candidateIds = profiles.map((p) => p.user_id);

  // Find agent with the fewest active/open/pending conversations
  const { data: convs } = await db
    .from("conversations")
    .select("assigned_agent_id")
    .eq("account_id", accountId)
    .in("status", ["open", "pending"])
    .in("assigned_agent_id", candidateIds);

  const counts: Record<string, number> = {};
  for (const id of candidateIds) counts[id] = 0;
  if (convs) {
    for (const c of convs) {
      if (c.assigned_agent_id && counts[c.assigned_agent_id] !== undefined) {
        counts[c.assigned_agent_id]++;
      }
    }
  }

  candidateIds.sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0));
  return candidateIds[0] ?? null;
}

async function executeHandoff(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const targetLocale = (run.vars?.locale || run.vars?.language) as string | undefined;
  let effectiveNode = node;
  if (targetLocale && !targetLocale.toLowerCase().startsWith("en")) {
    const aiCfg = await loadAiConfig(db, run.account_id).catch(() => null);
    effectiveNode = await localizeNode(node, targetLocale, aiCfg, db, run.account_id);
  }
  const cfg = effectiveNode.config as {
    assign_to?: string;
    note?: string;
    message?: string;
    mode?: "specific" | "round_robin";
  };
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

  let assignedAgentId = cfg.assign_to;
  if (cfg.mode === "round_robin" || (!assignedAgentId && cfg.mode !== "specific")) {
    const resolvedAgent = await resolveRoundRobinAgent(db, run.account_id);
    if (resolvedAgent) assignedAgentId = resolvedAgent;
  }

  const convUpdate: Record<string, unknown> = {
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (assignedAgentId) convUpdate.assigned_agent_id = assignedAgentId;
  if (run.conversation_id) {
    await db
      .from("conversations")
      .update(convUpdate)
      .eq("id", run.conversation_id);
  }
  await logEvent(db, run.id, "handoff", node.node_key, {
    note: cfg.note ?? null,
    message: cfg.message ?? null,
    assigned_to: assignedAgentId ?? null,
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
  } else if (cfg.subject === "channel") {
    const { data: conv } = await db
      .from("conversations")
      .select("channel")
      .eq("id", run.conversation_id!)
      .maybeSingle();
    subjectValue = ((conv as Record<string, unknown> | null)?.channel as string) || "whatsapp";
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
 * Safe, predictable variable interpolation supporting both `{{vars.foo}}` and `{{foo}}`,
 * contact fields (`{{contact.name}}`, `{{contact.phone}}`), pipeline filters (`| default:"there"`),
 * and security allowlisting.
 */
export function interpolateVars(template: string, vars: Record<string, unknown> = {}): string {
  if (!template) return "";
  return safeInterpolate(template, vars);
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
  const { data: updatedRuns } = await db
    .from("flow_runs")
    .update({
      status,
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", runId)
    .eq("status", "active")
    .select("conversation_id, flow_id, contact_id");

  const runInfo = updatedRuns?.[0];
  const convId = runInfo?.conversation_id;
  if (convId && (status === "completed" || status === "cancelled")) {
    await db
      .from("conversations")
      .update({ ai_autoreply_disabled: false, ai_reply_count: 0 })
      .eq("id", convId);
  }

  // Atomically record completed contact if run completed and flow has run_once
  if (status === "completed" && runInfo?.flow_id && runInfo?.contact_id) {
    try {
      const flow = await loadFlow(db, runInfo.flow_id);
      if (flow?.run_once) {
        await markFlowCompletedForContact(db, runInfo.flow_id, runInfo.contact_id);
      }
    } catch (err) {
      console.warn("[flows] failed to mark flow completed contact:", err);
    }
  }
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
  message?: ParsedInbound,
): Promise<{ outcome: "advanced" | "completed" | "handed_off" }> {
  let currentKey: string | null = startNodeKey;
  const visitedKeys = new Set<string>();
  for (let safety = 0; safety < MAX_NODES_PER_ADVANCE; safety += 1) {
    if (!currentKey) {
      await logEvent(db, run.id, "completed", null, {
        reason: "flow_completed_terminal_node",
      });
      await endRun(db, run.id, "completed", "end_of_flow");
      return { outcome: "completed" };
    }
    if (visitedKeys.has(currentKey)) {
      await logEvent(db, run.id, "error", currentKey, {
        reason: "cycle_detected",
      });
      await endRun(db, run.id, "failed", "cycle_detected");
      return { outcome: "completed" };
    }
    visitedKeys.add(currentKey);
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

    // Dynamic AI localization: translate & load cached translations for non-English locales (e.g. Hindi, Hinglish)
    const targetLocale = (run.vars?.locale || run.vars?.language) as string | undefined;
    let effectiveNode = node;
    if (targetLocale && !targetLocale.toLowerCase().startsWith("en")) {
      const aiCfg = await loadAiConfig(db, run.account_id).catch(() => null);
      effectiveNode = await localizeNode(node, targetLocale, aiCfg, db, run.account_id);
    }

    if (node.node_type === "start") {
      currentKey = (node.config as unknown as StartNodeConfig).next_node_key;
      continue;
    }
    if (node.node_type === "send_message") {
      const cfg = effectiveNode.config as unknown as SendMessageNodeConfig;
      try {
        let whatsapp_message_id: string;
        const resolvedText = await resolveNodeText(db, run, effectiveNode, cfg.text || "", cfg);
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
            caption: resolvedText,
            filename: cfg.header_filename,
          });
          whatsapp_message_id = res.whatsapp_message_id;
        } else {
          const textToSend =
            cfg.header_type === "text" && cfg.header_text
              ? `*${interpolateVars(cfg.header_text, run.vars)}*\n\n${resolvedText}`
              : resolvedText;
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
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("WINDOW_EXPIRED")) {
          await logEvent(db, run.id, "handoff", node.node_key, {
            reason: "window_expired_yield",
            detail: errMsg,
          });
          if (run.conversation_id) {
            await db
              .from("conversations")
              .update({ status: "pending", updated_at: new Date().toISOString() })
              .eq("id", run.conversation_id);
          }
          await endRun(db, run.id, "handed_off", "window_expired_yield");
          return { outcome: "completed" };
        }
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_text_failed",
          detail: errMsg,
        });
        await endRun(db, run.id, "failed", "send_text_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_media") {
      const cfg = effectiveNode.config as unknown as SendMediaNodeConfig;
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
      const cfg = effectiveNode.config as unknown as RequestAddressNodeConfig;
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
      const cfg = effectiveNode.config as unknown as CollectInputNodeConfig;

      // Smart Context Handling: skip_if_known | confirm_if_known | ask_always
      const rawKey = cfg.var_key?.startsWith("vars.") ? cfg.var_key.slice(5) : cfg.var_key;
      const existingVal = run.vars[cfg.var_key] ?? (rawKey ? run.vars[rawKey] : undefined);
      const isKnown =
        typeof existingVal === "string" &&
        existingVal.trim().length > 0 &&
        existingVal !== "Instagram User" &&
        existingVal !== "Facebook User";

      const contextBehavior =
        cfg.context_behavior ?? (cfg.skip_if_known === false ? "ask_always" : "skip_if_known");

      if (contextBehavior === "skip_if_known" && isKnown && cfg.next_node_key) {
        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "step_skipped",
          node_type: node.node_type,
          var_key: cfg.var_key,
          value: existingVal,
          reason: "already_known_in_context",
        });

        if (run.contact_id) {
          await logContactActivity(db as any, {
            accountId: run.account_id,
            contactId: run.contact_id,
            conversationId: run.conversation_id,
            channel: 'system',
            eventType: 'flow_step_skipped',
            summary: `Auto-filled ${rawKey || cfg.var_key} with "${existingVal}" from profile`,
            metadata: {
              flowId: run.flow_id,
              nodeKey: node.node_key,
              varKey: cfg.var_key,
            },
            updateContactHotPath: false,
          }).catch(() => null);
        }

        currentKey = cfg.next_node_key;
        continue;
      }

      // Send the prompt and suspend. Customer's next TEXT reply will
      // wake us up via handleReplyForActiveRun's collect_input branch.
      try {
        let resolvedPrompt: string;
        if (contextBehavior === "confirm_if_known" && isKnown) {
          const fieldLabel = (rawKey || cfg.var_key || "detail").replace(/_/g, " ");
          const locale = (run.vars.locale as string) || "en";
          resolvedPrompt =
            locale === "hinglish" || locale === "hi"
              ? `Humare paas aapka ${fieldLabel} "${existingVal}" saved hai. Kya yahi use karein? Keep karne ke liye "Yes" likhein, ya naya ${fieldLabel} bhejein.`
              : `We have your ${fieldLabel} on file as "${existingVal}". Reply "Yes" to keep it, or type a new ${fieldLabel} to update it.`;
        } else {
          resolvedPrompt = await resolveNodeText(db, run, effectiveNode, cfg.prompt_text || "", cfg);
        }
        const { whatsapp_message_id } = await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: resolvedPrompt,
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
        await sendButtonsAndSuspend(db, run, effectiveNode);
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
        await sendListAndSuspend(db, run, effectiveNode);
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
        await sendCarouselAndSuspend(db, run, effectiveNode);
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
      if (!currentKey) {
        // If trigger card wasn't explicitly linked, find start node or first non-trigger node
        if (nodes.has("start")) {
          currentKey = "start";
        } else {
          for (const [k, n] of nodes) {
            if (k !== node.node_key && n.node_type !== "trigger") {
              currentKey = k;
              break;
            }
          }
        }
      }
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
          const ALLOWED_COLUMNS = [
            "name", "email", "phone", "company", "address", "city", "state", "zip", "country",
            "intent_category", "intent_score", "intent_summary", "next_best_action", "sentiment"
          ];
          if (ALLOWED_COLUMNS.includes(cfg.field)) {
            const updatePayload: Record<string, unknown> = { [cfg.field]: cfg.field === "intent_score" ? (parseInt(val, 10) || 0) : val };
            if (cfg.field.startsWith("intent_") || cfg.field === "sentiment") {
              updatePayload.intelligence_updated_at = new Date().toISOString();
            }
            await db.from("contacts").update(updatePayload).eq("id", run.contact_id).eq("account_id", run.account_id);
          } else {
            // Write to contact metadata safely
            const { data: c } = await db.from("contacts").select("metadata").eq("id", run.contact_id).maybeSingle();
            const meta = (((c as Record<string, unknown> | null)?.metadata as Record<string, unknown>) || {});
            meta[cfg.field] = val;
            await db.from("contacts").update({ metadata: meta }).eq("id", run.contact_id).eq("account_id", run.account_id);
          }
          run.vars[cfg.field] = val;
        }
      } catch (err) {
        console.error("[flows] update_contact error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "trigger_flow") {
      const cfg = node.config as unknown as TriggerFlowNodeConfig;
      const targetFlowRef = (cfg.target_flow_id || cfg.target_flow_name || "").trim();
      const depth = typeof run.vars.__subflow_depth === "number" ? run.vars.__subflow_depth : 0;

      if (!targetFlowRef || depth >= 3) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: !targetFlowRef ? "trigger_flow_missing_target" : "trigger_flow_max_depth_exceeded",
          depth,
        });
        await endRun(db, run.id, "failed", "trigger_flow_error");
        return { outcome: "completed" };
      }

      // Build forwarded variables for the target flow
      const forwardedVars: Record<string, unknown> = {
        __subflow_depth: depth + 1,
        __parent_flow_id: run.flow_id,
      };
      if (cfg.pass_all_vars) {
        for (const [k, v] of Object.entries(run.vars || {})) {
          if (!k.startsWith("__") && !k.startsWith("contact.") && k !== "contact" && k !== "metadata") {
            forwardedVars[k] = v;
          }
        }
      }
      if (cfg.pass_vars && typeof cfg.pass_vars === "object") {
        for (const [k, rawVal] of Object.entries(cfg.pass_vars)) {
          if (k.trim()) {
            forwardedVars[k.trim()] =
              typeof rawVal === "string" ? interpolateVars(rawVal, run.vars) : rawVal;
          }
        }
      }

      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "trigger_flow_handoff",
        target_flow: targetFlowRef,
        passed_keys: Object.keys(forwardedVars).filter((k) => !k.startsWith("__")),
      });

      // End the current flow run cleanly before starting the target flow
      await endRun(db, run.id, "completed", "handed_off_to_subflow");

      if (run.contact_id && run.conversation_id) {
        await triggerFlowForContact(db, {
          accountId: run.account_id,
          contactId: run.contact_id,
          conversationId: run.conversation_id,
          flowIdOrName: targetFlowRef,
          configOwnerUserId: run.user_id,
          triggerSource: "flow_to_flow",
          initialVars: forwardedVars,
        });
      }

      return { outcome: "completed" };
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
      const cfg = node.config as unknown as WebhookNodeConfig;
      const targetUrl = interpolateVars(cfg.url || "", run.vars).trim();
      let deliverySuccess = false;
      let responseBody: unknown = null;
      let statusCode = 0;

      if (targetUrl) {
        try {
          const deliverable = await isDeliverableUrl(targetUrl);
          if (!deliverable) {
            throw new Error(`SSRF guard blocked destination URL: ${targetUrl}`);
          }

          const method = (cfg.method || "POST").toUpperCase();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "WACRM-Flow-Engine/2.0",
          };
          if (cfg.headers) {
            for (const [k, v] of Object.entries(cfg.headers)) {
              headers[k] = interpolateVars(v, run.vars);
            }
          }

          let body: string | undefined = undefined;
          if (method !== "GET" && method !== "HEAD") {
            body = cfg.body_template ? interpolateVars(cfg.body_template, run.vars) : JSON.stringify(run.vars);
          }

          const res = await fetch(targetUrl, {
            method,
            headers,
            body,
            signal: AbortSignal.timeout(10000),
            redirect: "manual",
          });
          statusCode = res.status;
          const textRes = await res.text();
          try {
            responseBody = JSON.parse(textRes);
          } catch {
            responseBody = textRes;
          }
          deliverySuccess = res.ok;

          run.vars.webhook_status = statusCode;
          run.vars.webhook_success = deliverySuccess;
          if (cfg.save_response_var) {
            run.vars[cfg.save_response_var] = responseBody;
            run.vars[`${cfg.save_response_var}_status`] = statusCode;
          }
          await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn("[flows] webhook node failed:", errMsg);
          run.vars.webhook_status = statusCode || 500;
          run.vars.webhook_success = false;
          await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
          await logEvent(db, run.id, "error", node.node_key, {
            reason: "webhook_execution_failed",
            detail: errMsg,
          });
        }
      }

      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "webhook",
        url: targetUrl,
        success: deliverySuccess,
        statusCode,
      });

      if (!deliverySuccess && cfg.failure_next) {
        currentKey = cfg.failure_next;
      } else {
        currentKey = cfg.next_node_key || "";
      }
      continue;
    }
    if (node.node_type === "ai_message") {
      const cfg = effectiveNode.config as unknown as AiMessageNodeConfig;
      let textToSend = "";

      try {
        const res = await executeAiMessageNode({
          db,
          run,
          node: effectiveNode,
          message: undefined,
        });
        textToSend = res.text;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "ai_message_failed",
          detail: errMsg,
        });

        if (cfg.failure_next) {
          currentKey = cfg.failure_next;
          continue;
        }
        if (cfg.fallback_message) {
          textToSend = interpolateVars(cfg.fallback_message, run.vars);
        } else {
          await endRun(db, run.id, "failed", "ai_message_failed");
          return { outcome: "completed" };
        }
      }

      if (textToSend) {
        try {
          const res = await engineSendText({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id!,
            contactId: run.contact_id!,
            text: textToSend,
          });
          await logEvent(db, run.id, "message_sent", node.node_key, {
            node_type: "ai_message",
            whatsapp_message_id: res.whatsapp_message_id,
          });
        } catch (err) {
          await logEvent(db, run.id, "error", node.node_key, {
            reason: "send_text_failed",
            detail: err instanceof Error ? err.message : String(err),
          });
          await endRun(db, run.id, "failed", "send_text_failed");
          return { outcome: "completed" };
        }
      }

      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "ai_extract") {
      const cfg = effectiveNode.config as unknown as AiExtractNodeConfig;
      try {
        const res = await executeAiExtractNode({
          db,
          run,
          node: effectiveNode,
          message: undefined,
        });

        for (const [k, v] of Object.entries(res.extracted)) {
          if (v !== undefined && v !== null && v !== "") {
            run.vars[k] = v;
          }
        }
        if (res.missingFields.length > 0) {
          run.vars._missing_fields = res.missingFields;
        }
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "ai_extract_completed",
          extracted_keys: Object.keys(res.extracted),
          missing_fields: res.missingFields,
        });

        currentKey = res.nextNodeKey;
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "ai_extract_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        currentKey = cfg.next_node_key;
      }
      continue;
    }
    if (node.node_type === "ai_decision") {
      const cfg = effectiveNode.config as unknown as AiDecisionNodeConfig;
      try {
        const res = await executeAiDecisionNode({
          db,
          run,
          node: effectiveNode,
          message: message,
        });

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "ai_decision_completed",
          selected_branch: res.selectedBranch,
          confidence: res.confidence,
          reason: res.reason,
        });

        currentKey = res.nextNodeKey;
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "ai_decision_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        currentKey = cfg.fallback_next || (cfg.branches?.[0]?.next_node_key ?? "");
      }
      continue;
    }
    if (node.node_type === "ai_summarize") {
      const cfg = effectiveNode.config as unknown as AiSummarizeNodeConfig;
      try {
        const res = await executeAiSummarizeNode({
          db,
          run,
          node: effectiveNode,
        });

        run.vars[res.targetVar] = res.summary;
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "ai_summarize_completed",
          target_var: res.targetVar,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "ai_summarize_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "ai_response") {
      const cfg = node.config as { prompt?: string; next_node_key?: string };
      try {
        let textToSend = "";
        if (cfg.prompt && cfg.prompt.length > 5) {
          try {
            const res = await executeAiMessageNode({
              db,
              run,
              node: effectiveNode,
            });
            textToSend = res.text;
          } catch {
            textToSend = interpolateVars(cfg.prompt, run.vars);
          }
        } else {
          textToSend = "Thank you, our AI agent will assist you shortly.";
        }

        await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: textToSend,
        });
      } catch (err) {
        console.error("[flows] ai_response error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "create_deal") {
      const cfg = node.config as unknown as CreateDealNodeConfig;
      let dealId: string | null = null;
      try {
        let pipelineId = cfg.pipeline_id;
        let stageId = cfg.stage_id;

        if (!pipelineId || !stageId) {
          const { data: pipeline } = await db
            .from("pipelines")
            .select("id")
            .eq("account_id", run.account_id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (pipeline?.id) {
            pipelineId = pipeline.id;
            const { data: stage } = await db
              .from("pipeline_stages")
              .select("id")
              .eq("pipeline_id", pipeline.id)
              .order("position", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (stage?.id) stageId = stage.id;
          }
        }

        if (pipelineId && stageId && run.contact_id) {
          const { data: acct } = await db
            .from("accounts")
            .select("default_currency")
            .eq("id", run.account_id)
            .maybeSingle();

          const dealTitle = interpolateVars(cfg.title || "New Deal from WhatsApp", run.vars);
          const rawVal = cfg.value !== undefined ? String(cfg.value) : "0";
          const parsedVal = parseFloat(interpolateVars(rawVal, run.vars).replace(/[^0-9.-]/g, "")) || 0;

          const { data: deal, error: dealErr } = await db
            .from("deals")
            .insert({
              account_id: run.account_id,
              user_id: run.user_id,
              pipeline_id: pipelineId,
              stage_id: stageId,
              contact_id: run.contact_id,
              title: dealTitle,
              value: parsedVal,
              currency: cfg.currency || acct?.default_currency || "USD",
              status: "open",
            })
            .select("id")
            .single();

          if (!dealErr && deal?.id) {
            dealId = deal.id;
            run.vars.deal_id = deal.id;
            run.vars.deal_title = dealTitle;
            run.vars.deal_value = parsedVal;
            await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
          }
        }
      } catch (err) {
        console.warn("[flows] create_deal error:", err);
      }

      await logEvent(db, run.id, "node_entered", node.node_key, {
        action: "create_deal",
        deal_id: dealId,
        title: interpolateVars(cfg.title || "", run.vars),
      });
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "crm_fetch") {
      const cfg = node.config as unknown as CrmFetchNodeConfig;
      const targetVar = (cfg.target_var || "crm_records").trim();
      let found = false;
      try {
        if (cfg.collection_slug) {
          const evalVars: Record<string, unknown> = {
            ...run.vars,
            "contact.id": run.contact_id ?? "",
            contact: {
              ...((run.vars?.contact as Record<string, unknown> | undefined) ?? {}),
              id: run.contact_id ?? "",
            },
          };

          const filters: CrmFilter[] = (cfg.filters ?? [])
            .filter((f) => f.field && f.operator)
            .map((f) => ({
              field: f.field,
              operator: f.operator,
              value: interpolateVars(String(f.value ?? ""), evalVars),
            }))
            .filter((f) => {
              // Guard against passing empty string to UUID columns like contact_id or id
              if ((f.field === "contact_id" || f.field === "id") && (!f.value || String(f.value).trim() === "")) {
                return false;
              }
              return true;
            });

          const limit = Math.min(50, Math.max(1, Number(cfg.limit) || 5));
          const res = await queryRecords(db, run.account_id, cfg.collection_slug, {
            filters,
            sortBy: cfg.sort_by || "created_at",
            sortDir: cfg.sort_dir || "desc",
            limit,
          });

          found = res.records.length > 0;
          const mapped = res.records.map((r) => ({
            id: r.id,
            contact_id: r.contact_id,
            created_at: r.created_at,
            ...r.data,
          }));
          run.vars[targetVar] = limit === 1 ? (mapped[0] ?? null) : mapped;
          run.vars[`${targetVar}_first`] = mapped[0] ?? null;
          run.vars[`${targetVar}_first_id`] = mapped[0]?.id ?? "";
          run.vars[`${targetVar}_count`] = res.records.length;
          run.vars[`${targetVar}_text`] = formatCrmRecordsText(
            res.collection.name,
            res.fields,
            res.records,
          );
          await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);

          await logEvent(db, run.id, "node_entered", node.node_key, {
            action: "crm_fetch",
            collection: cfg.collection_slug,
            filters_applied: filters,
            count: res.records.length,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("[flows] crm_fetch error:", errMsg);
        run.vars[targetVar] = null;
        run.vars[`${targetVar}_count`] = 0;
        run.vars[`${targetVar}_text`] = "";
        run.vars.crm_error = errMsg;
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
        await logEvent(db, run.id, "error", node.node_key, {
          action: "crm_fetch_failed",
          collection: cfg.collection_slug,
          error: errMsg,
        });
      }
      currentKey = (found ? cfg.found_next : cfg.not_found_next) || cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "crm_mutate") {
      const cfg = node.config as unknown as CrmMutateNodeConfig;
      let succeeded = false;
      try {
        if (cfg.collection_slug) {
          const evalVars: Record<string, unknown> = {
            ...run.vars,
            "contact.id": run.contact_id ?? "",
            contact: {
              ...((run.vars?.contact as Record<string, unknown> | undefined) ?? {}),
              id: run.contact_id ?? "",
            },
          };
          const mappedData: Record<string, unknown> = {};
          for (const [k, rawTmpl] of Object.entries(cfg.field_mappings ?? {})) {
            if (!k) continue;
            mappedData[k] = interpolateVars(String(rawTmpl ?? ""), evalVars);
          }
          const contactId = cfg.link_contact !== false ? run.contact_id : null;
          const recordId = cfg.record_id ? interpolateVars(cfg.record_id, evalVars).trim() : "";
          const idempotencyKey = cfg.idempotency_key
            ? interpolateVars(cfg.idempotency_key, evalVars).trim()
            : `${run.id}_${node.node_key}`;

          let savedRecord: Record<string, unknown> | null = null;
          if (cfg.operation === "delete") {
            if (!recordId) throw new Error("record_id is required for delete");
            await deleteRecord(db, run.account_id, cfg.collection_slug, recordId);
            succeeded = true;
          } else if (cfg.operation === "update" || (cfg.operation === "upsert" && recordId)) {
            if (!recordId) throw new Error("record_id is required for update");
            const updated = await updateRecord(db, run.account_id, cfg.collection_slug, recordId, {
              contact_id: contactId ?? undefined,
              data: mappedData,
              updated_by_type: "flow",
            });
            savedRecord = { id: updated.id, contact_id: updated.contact_id, ...updated.data };
            succeeded = true;
          } else {
            const { record } = await createRecord(db, run.account_id, cfg.collection_slug, {
              contact_id: contactId,
              data: mappedData,
              created_by_type: "flow",
              created_by_ref: run.id,
              idempotency_key: idempotencyKey,
            });
            savedRecord = { id: record.id, contact_id: record.contact_id, ...record.data };
            succeeded = true;
          }

          if (cfg.save_result_var && savedRecord) {
            run.vars[cfg.save_result_var] = savedRecord;
            await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
          }

          await logEvent(db, run.id, "node_entered", node.node_key, {
            action: `crm_${cfg.operation}`,
            collection: cfg.collection_slug,
            record_id: savedRecord?.id ?? recordId ?? null,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("[flows] crm_mutate error:", errMsg);
        run.vars.crm_error = errMsg;
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
        await logEvent(db, run.id, "error", node.node_key, {
          action: `crm_${cfg.operation}_failed`,
          error: errMsg,
        });
      }
      currentKey = succeeded
        ? (cfg.next_node_key || "")
        : (cfg.failure_next || cfg.next_node_key || "");
      continue;
    }
    if (node.node_type === "notify_member") {
      const cfg = node.config as unknown as NotifyMemberNodeConfig;
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      try {
        const evalVars: Record<string, unknown> = {
          ...run.vars,
          "contact.id": run.contact_id ?? "",
          contact: {
            ...((run.vars?.contact as Record<string, unknown> | undefined) ?? {}),
            id: run.contact_id ?? "",
          },
        };

        const messageText = interpolateVars(cfg.message || "", evalVars).trim();
        const emailSubject = interpolateVars(cfg.email_subject || "Team Notification", evalVars).trim();
        const channel = cfg.channel || "whatsapp";
        const mode = cfg.recipient_mode || "specific";

        // 1. Resolve target account members from profiles
        let q = db
          .from("profiles")
          .select("user_id, full_name, email, phone, account_role")
          .eq("account_id", run.account_id);

        if (mode === "owner_only") {
          q = q.eq("account_role", "owner");
        } else if (mode === "admins_and_owner") {
          q = q.in("account_role", ["owner", "admin"]);
        } else if (mode === "specific") {
          const ids = Array.isArray(cfg.member_ids) ? cfg.member_ids.filter(Boolean) : [];
          if (ids.length === 0) {
            throw new Error("No team members selected in notify_member node.");
          }
          q = q.in("user_id", ids);
        }

        const { data: members, error: memErr } = await q;
        if (memErr) throw memErr;

        const targetMembers = (members ?? []) as Array<{
          user_id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          account_role: string;
        }>;

        if (targetMembers.length === 0) {
          throw new Error("No matching team members found.");
        }

        // 2. Load WhatsApp credentials if sending via WhatsApp
        let waCreds: { phoneNumberId: string; accessToken: string } | null = null;
        if (channel === "whatsapp" || channel === "both") {
          waCreds = await loadAccountMetaCredentials(db, run.account_id).catch((e) => {
            errors.push(e instanceof Error ? e.message : String(e));
            return null;
          });
        }

        // 3. Load Email config if sending via Email
        let emailCfg: EmailConfigData | null = null;
        if (channel === "email" || channel === "both") {
          const { data: savedEmailCfg } = await db
            .from("email_config")
            .select("*")
            .eq("account_id", run.account_id)
            .maybeSingle();
          if (savedEmailCfg) {
            emailCfg = savedEmailCfg as EmailConfigData;
          }
        }

        // 4. Deliver to each selected member
        for (const m of targetMembers) {
          const memberLabel = m.full_name || m.email || m.user_id;

          if ((channel === "whatsapp" || channel === "both") && waCreds) {
            if (!m.phone) {
              failedCount += 1;
              errors.push(`${memberLabel}: no WhatsApp phone number configured`);
            } else {
              try {
                if (cfg.template_name?.trim()) {
                  await sendTemplateMessage({
                    phoneNumberId: waCreds.phoneNumberId,
                    accessToken: waCreds.accessToken,
                    to: m.phone,
                    templateName: cfg.template_name.trim(),
                    language: cfg.template_language?.trim() || "en_US",
                    params: messageText ? [messageText] : undefined,
                  });
                } else {
                  await sendTextMessage({
                    phoneNumberId: waCreds.phoneNumberId,
                    accessToken: waCreds.accessToken,
                    to: m.phone,
                    text: messageText,
                  });
                }
                sentCount += 1;
              } catch (waErr) {
                failedCount += 1;
                errors.push(`${memberLabel} (WhatsApp): ${waErr instanceof Error ? waErr.message : String(waErr)}`);
              }
            }
          }

          if (channel === "email" || channel === "both") {
            if (!m.email) {
              failedCount += 1;
              errors.push(`${memberLabel}: no email address`);
            } else if (!emailCfg) {
              failedCount += 1;
              errors.push("No email integration configured in Settings > Email");
            } else {
              const res = await dispatchEmail(emailCfg, {
                toEmail: m.email,
                subject: emailSubject,
                body: messageText,
              });
              if (res.success) sentCount += 1;
              else {
                failedCount += 1;
                errors.push(`${memberLabel} (Email): ${res.error || "send failed"}`);
              }
            }
          }
        }

        await logEvent(db, run.id, sentCount > 0 ? "node_entered" : "error", node.node_key, {
          action: "notify_member",
          channel,
          recipient_mode: mode,
          sent_count: sentCount,
          failed_count: failedCount,
          errors,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(errMsg);
        console.warn("[flows] notify_member error:", errMsg);
        await logEvent(db, run.id, "error", node.node_key, {
          action: "notify_member_failed",
          error: errMsg,
        });
      }

      currentKey =
        sentCount > 0
          ? (cfg.next_node_key || "")
          : (cfg.failure_next || cfg.next_node_key || "");
      continue;
    }
    if (node.node_type === "integration_action") {
      const cfg = node.config as {
        integration_id?: string;
        action_key?: string;
        inputs?: Record<string, string>;
        target_var?: string;
        next_node_key?: string;
        failure_next?: string;
      };
      let succeeded = false;
      try {
        const evalVars: Record<string, unknown> = {
          ...run.vars,
          "contact.id": run.contact_id ?? "",
          contact: {
            ...((run.vars?.contact as Record<string, unknown> | undefined) ?? {}),
            id: run.contact_id ?? "",
          },
        };
        const resolvedInputs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cfg.inputs ?? {})) {
          resolvedInputs[k] = typeof v === "string" ? interpolateVars(v, evalVars) : v;
        }
        const res = await executeAccountIntegration({
          supabase: db,
          accountId: run.account_id,
          integrationId: String(cfg.integration_id || ""),
          actionKey: String(cfg.action_key || ""),
          inputs: resolvedInputs,
        });
        const targetVar = (cfg.target_var || "integration_res").trim() || "integration_res";
        if (res.success) {
          succeeded = true;
          run.vars = {
            ...run.vars,
            [targetVar]: res.data ?? {},
          };
          await db
            .from("flow_runs")
            .update({ vars: run.vars })
            .eq("id", run.id);
        } else {
          run.vars = {
            ...run.vars,
            integration_error: res.error || "Integration call failed",
          };
          await db
            .from("flow_runs")
            .update({ vars: run.vars })
            .eq("id", run.id);
        }
        await logEvent(db, run.id, res.success ? "node_entered" : "error", node.node_key, {
          action: "integration_action",
          integration_id: cfg.integration_id,
          action_key: cfg.action_key,
          success: res.success,
          error: res.error,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        run.vars = { ...run.vars, integration_error: errMsg };
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);
        await logEvent(db, run.id, "error", node.node_key, {
          action: "integration_action_failed",
          error: errMsg,
        });
      }

      currentKey = succeeded
        ? (cfg.next_node_key || "")
        : (cfg.failure_next || cfg.next_node_key || "");
      continue;
    }
    if (node.node_type === "whatsapp_payment") {
      const cfg = node.config as unknown as WhatsAppPaymentNodeConfig;
      try {
        const rawAmount = cfg.amount !== undefined ? String(cfg.amount) : "0";
        const parsedAmount = parseFloat(interpolateVars(rawAmount, run.vars).replace(/[^0-9.-]/g, "")) || 0;
        const currency = cfg.currency || "INR";
        const itemName = interpolateVars(cfg.item_name || "Order Payment", run.vars);
        const provider = cfg.provider || "razorpay";
        let paymentLink = cfg.payment_link ? interpolateVars(cfg.payment_link, run.vars).trim() : "";

        // Dynamic Razorpay Payment Link creation when provider is razorpay and no static link is set
        if (provider === "razorpay" && !paymentLink && parsedAmount > 0) {
          try {
            const { createRazorpayPaymentLink } = await import("@/lib/billing/razorpay");
            let contactName = "";
            let contactPhone = "";
            if (run.contact_id) {
              const { data: cRow } = await db
                .from("contacts")
                .select("name, phone")
                .eq("id", run.contact_id)
                .maybeSingle();
              if (cRow) {
                contactName = cRow.name || "";
                contactPhone = cRow.phone || "";
              }
            }
            const linkRes = await createRazorpayPaymentLink({
              amountInr: parsedAmount,
              description: itemName,
              customer: {
                name: contactName || undefined,
                contact: contactPhone || undefined,
              },
              notes: {
                flow_run_id: run.id,
                contact_id: run.contact_id || "",
                account_id: run.account_id,
                success_node_key: cfg.success_next || cfg.next_node_key || "",
              },
            });
            if (linkRes?.short_url) {
              paymentLink = linkRes.short_url;
            }
          } catch (linkErr) {
            console.warn("[flows] dynamic Razorpay link creation error:", linkErr);
          }
        }

        run.vars.payment_amount = parsedAmount;
        run.vars.payment_currency = currency;
        run.vars.payment_item = itemName;
        run.vars.payment_provider = provider;
        run.vars.payment_link = paymentLink;
        run.vars.payment_status = cfg.wait_for_payment ? "pending" : "requested";
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);

        let paymentText = `Please complete your payment of ${currency} ${parsedAmount.toLocaleString()} for *${itemName}*.`;
        if (paymentLink) {
          paymentText += `\n\nPay securely here: ${paymentLink}`;
        }

        if (run.conversation_id && run.contact_id) {
          if (cfg.wait_for_payment && cfg.cancel_next) {
            try {
              await engineSendInteractiveButtons({
                accountId: run.account_id,
                userId: run.user_id,
                conversationId: run.conversation_id,
                contactId: run.contact_id,
                bodyText: paymentText,
                buttons: [{ id: "cancel_payment", title: "Cancel Order" }],
              });
            } catch {
              await engineSendText({
                accountId: run.account_id,
                userId: run.user_id,
                conversationId: run.conversation_id,
                contactId: run.contact_id,
                text: `${paymentText}\n\n(Type 'cancel' to cancel this order)`,
              });
            }
          } else {
            await engineSendText({
              accountId: run.account_id,
              userId: run.user_id,
              conversationId: run.conversation_id,
              contactId: run.contact_id,
              text: paymentText,
            });
          }
        }

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "whatsapp_payment_requested",
          amount: parsedAmount,
          currency,
          item_name: itemName,
          provider,
          payment_link: paymentLink,
          wait_for_payment: Boolean(cfg.wait_for_payment),
        });

        // If wait_for_payment is requested, suspend the flow execution until Razorpay webhook arrives
        if (cfg.wait_for_payment) {
          await db
            .from("flow_runs")
            .update({ current_node_key: node.node_key, vars: run.vars })
            .eq("id", run.id);
          return { outcome: "advanced" };
        }
      } catch (err) {
        console.warn("[flows] whatsapp_payment error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "whatsapp_form") {
      const cfg = node.config as unknown as WhatsAppFormNodeConfig;
      try {
        const flowId = cfg.flow_id || "";
        const flowToken = cfg.flow_token || run.id;
        const promptText = interpolateVars(cfg.body_text || "Please complete the interactive form to proceed:", run.vars);
        const buttonLabel = cfg.button_text || "Complete Form";

        run.vars.flow_form_id = flowId;
        run.vars.flow_token = flowToken;
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);

        if (run.conversation_id && run.contact_id) {
          await engineSendText({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id,
            contactId: run.contact_id,
            text: `${promptText}\n\n[📋 ${buttonLabel}]`,
          });
        }

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "whatsapp_form_sent",
          flow_id: flowId,
          flow_token: flowToken,
        });
      } catch (err) {
        console.warn("[flows] whatsapp_form error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "catalog") {
      const cfg = node.config as unknown as CatalogNodeConfig;
      try {
        const bodyText = interpolateVars(cfg.body_text || "Explore our latest products and catalog below:", run.vars);
        const catalogId = cfg.catalog_id || "";
        const productId = cfg.product_retailer_id || "";

        if (run.conversation_id && run.contact_id) {
          let messageText = bodyText;
          if (productId) {
            messageText += `\n\nFeatured Product SKU: *${productId}*`;
          }
          messageText += `\n🛍️ [View WhatsApp Catalog]`;

          await engineSendText({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id,
            contactId: run.contact_id,
            text: messageText,
          });
        }

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "catalog_sent",
          catalog_id: catalogId,
          product_id: productId,
        });
      } catch (err) {
        console.warn("[flows] catalog error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "book_appointment") {
      const cfg = node.config as unknown as BookAppointmentNodeConfig;
      try {
        let bookingUrl = interpolateVars(cfg.booking_url || "", run.vars).trim();
        const prompt = interpolateVars(cfg.prompt_text || "Select a convenient time for your consultation:", run.vars);

        if (bookingUrl && run.contact_id) {
          const { data: contact } = await db
            .from("contacts")
            .select("name, email, phone")
            .eq("id", run.contact_id)
            .maybeSingle();

          if (contact) {
            const sep = bookingUrl.includes("?") ? "&" : "?";
            const params: string[] = [];
            if (contact.name) params.push(`name=${encodeURIComponent(contact.name)}`);
            if (contact.email) params.push(`email=${encodeURIComponent(contact.email)}`);
            if (contact.phone) params.push(`phone=${encodeURIComponent(contact.phone)}`);
            if (params.length > 0 && !bookingUrl.includes("email=")) {
              bookingUrl += sep + params.join("&");
            }
          }
        }

        run.vars.booking_url = bookingUrl;
        await db.from("flow_runs").update({ vars: run.vars }).eq("id", run.id);

        if (run.conversation_id && run.contact_id) {
          await engineSendText({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id,
            contactId: run.contact_id,
            text: `${prompt}\n\n📅 Book your slot here: ${bookingUrl || "Contact our support team"}`,
          });
        }

        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "book_appointment_sent",
          booking_url: bookingUrl,
        });
      } catch (err) {
        console.warn("[flows] book_appointment error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "add_to_group") {
      const cfg = node.config as unknown as AddToGroupNodeConfig;
      try {
        if (cfg.group_id && run.contact_id) {
          await db.from("contact_group_members").upsert(
            {
              account_id: run.account_id,
              group_id: cfg.group_id,
              contact_id: run.contact_id,
              added_at: new Date().toISOString(),
            },
            { onConflict: "group_id,contact_id" },
          );
        }
        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "contact_added_to_group",
          group_id: cfg.group_id,
        });
      } catch (err) {
        console.warn("[flows] add_to_group error:", err);
      }
      currentKey = cfg.next_node_key || "";
      continue;
    }
    if (node.node_type === "remove_from_group") {
      const cfg = node.config as unknown as RemoveFromGroupNodeConfig;
      try {
        if (cfg.group_id && run.contact_id) {
          await db
            .from("contact_group_members")
            .delete()
            .eq("account_id", run.account_id)
            .eq("group_id", cfg.group_id)
            .eq("contact_id", run.contact_id);
        }
        await logEvent(db, run.id, "node_entered", node.node_key, {
          action: "contact_removed_from_group",
          group_id: cfg.group_id,
        });
      } catch (err) {
        console.warn("[flows] remove_from_group error:", err);
      }
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
 * Typing indicator disabled per configuration to avoid network latency/timeout overhead.
 */
async function showFlowTypingIndicator(
  _db: AdminClient,
  _accountId: string,
  _messageId?: string,
): Promise<void> {
  return;
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

async function loadEnrichedActiveFlows(
  db: AdminClient,
  accountId: string,
): Promise<FlowRow[]> {
  const { data: flows } = await db
    .from("flows")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const typedFlows = (flows || []) as FlowRow[];
  if (typedFlows.length === 0) return [];

  try {
    const flowIds = typedFlows.map((f) => f.id);
    const { data: triggerNodes } = await db
      .from("flow_nodes")
      .select("flow_id, node_key, config")
      .in("flow_id", flowIds)
      .eq("node_type", "trigger");

    if (triggerNodes && triggerNodes.length > 0) {
      const triggerMap = new Map<string, { node_key: string; config: Record<string, unknown> }>();
      for (const tn of triggerNodes) {
        triggerMap.set(tn.flow_id, {
          node_key: tn.node_key,
          config: (tn.config || {}) as Record<string, unknown>,
        });
      }

      for (const flow of typedFlows) {
        if (!flow.channels || (Array.isArray(flow.channels) && flow.channels.length === 0)) {
          (flow as any).channels = ['whatsapp', 'instagram', 'facebook'];
        }
        const tn = triggerMap.get(flow.id);
        if (tn) {
          const tc = tn.config;
          if (!flow.entry_node_id) {
            flow.entry_node_id = tn.node_key;
          }
          if (tc.starting_step === "ai_intent" || tc.intent_name) {
            flow.trigger_type = "ai_intent" as any;
            flow.trigger_config = {
              ...flow.trigger_config,
              ...tc,
              starting_step: "ai_intent",
            };
          } else if (
            tc.starting_step === "keyword" ||
            (Array.isArray(tc.keywords) && tc.keywords.length > 0)
          ) {
            if (flow.trigger_type !== "ai_intent") {
              flow.trigger_type = "keyword";
              flow.trigger_config = {
                ...flow.trigger_config,
                keywords: tc.keywords || (flow.trigger_config as any)?.keywords || [],
              };
            }
          } else if (tc.starting_step === "new_contact") {
            if (flow.trigger_type !== "ai_intent" && flow.trigger_type !== "keyword") {
              flow.trigger_type = "first_inbound_message";
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[flows] failed to enrich active flows with trigger nodes:", err);
  }

  return typedFlows;
}

export async function dispatchInboundToFlows(
  input: DispatchInboundInput & { isFirstInboundMessage: boolean },
): Promise<DispatchInboundResult> {
  const db = supabaseAdmin();
  let ownedRunId: string | null = null;
  try {
    if (!input.accountId || !input.contactId) {
      return { consumed: false, outcome: "no_match" };
    }

    const activeRun = await loadActiveRunForContact(
      db,
      input.accountId,
      input.contactId,
      input.conversationId,
    );

    // Fast-path in-memory and DB idempotency deduplication by meta_message_id
    if (input.message?.meta_message_id) {
      if (checkAndRecordInboundDeduplication(input.message.meta_message_id)) {
        return {
          consumed: true,
          flow_run_id: activeRun?.id,
          outcome: "duplicate_inbound_ignored",
        };
      }
      const dupe = await isDuplicateInbound(
        db,
        input.accountId,
        input.contactId,
        input.message.meta_message_id,
      );
      if (dupe) {
        return {
          consumed: true,
          flow_run_id: activeRun?.id,
          outcome: "duplicate_inbound_ignored",
        };
      }
    }

    if (activeRun) {
      ownedRunId = activeRun.id;
      // Tenant isolation revalidation
      if (activeRun.account_id !== input.accountId || activeRun.contact_id !== input.contactId) {
        return { consumed: false, outcome: "no_match" };
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
        // Multi-stage intent routing & flow arbitration
        const typedFlows = await loadEnrichedActiveFlows(db, input.accountId);

        const routing = await routeInboundIntent({
          db,
          accountId: input.accountId,
          contactId: input.contactId,
          conversationId: input.conversationId,
          message: input.message,
          channel: input.channel,
          isFirstInbound: input.isFirstInboundMessage,
          activeRun,
          flows: typedFlows,
        });

        if (routing.decision === "interrupted_pause" && routing.selectedFlow) {
          // Pause current run to preserve variables
          await db
            .from("flow_runs")
            .update({ status: "paused_by_agent" })
            .eq("id", activeRun.id);
          await logEvent(db, activeRun.id, "node_entered", activeRun.current_node_key, {
            action: "flow_paused_for_interruption",
            reason: routing.reasonCode,
            selected_flow_id: routing.selectedFlow.id,
          });

          const newNodes = await loadAllNodes(db, routing.selectedFlow.id);
          return startNewRun(db, routing.selectedFlow, input, newNodes);
        }

        if (routing.decision === "trigger" && routing.selectedFlow) {
          if (
            activeRun.status === "paused_by_agent" ||
            routing.selectedFlow.id !== activeRun.flow_id ||
            routing.reasonCode?.includes("exact_keyword_trigger") ||
            routing.confidence >= 0.85
          ) {
            await endRun(db, activeRun.id, "completed", "superseded_by_trigger");
            const newNodes = await loadAllNodes(db, routing.selectedFlow.id);
            return startNewRun(db, routing.selectedFlow, input, newNodes);
          }
          // Same flow continuation
        }

        // Fire typing indicator immediately so customer sees "typing..." instantly
        void showFlowTypingIndicator(db, input.accountId, input.message.meta_message_id);

        // Language detection: adapt dynamically if customer switches or writes in Hindi/Hinglish
        if (input.message.kind === "text" && input.message.text) {
          const fast = fastPathDetectLanguage(input.message.text);
          if (fast && fast.locale && fast.locale !== "en") {
            activeRun.vars = {
              ...activeRun.vars,
              locale: fast.locale,
              language: fast.locale,
            };
          }
        }

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

    // No active run → use routeInboundIntent
    const typedFlows = await loadEnrichedActiveFlows(db, input.accountId);
    console.log(
      `[flows] dispatchInboundToFlows: account=${input.accountId} active_flows=${typedFlows.length} message="${input.message.kind === 'text' ? input.message.text : ''}"`,
    );

    const routing = await routeInboundIntent({
      db,
      accountId: input.accountId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      message: input.message,
      channel: input.channel,
      isFirstInbound: input.isFirstInboundMessage,
      activeRun: null,
      flows: typedFlows,
    });
    console.log(
      `[flows] routeInboundIntent decision=${routing.decision} selectedFlow=${routing.selectedFlow?.name || 'none'} confidence=${routing.confidence} reason=${routing.reasonCode}`,
    );

    if (
      (routing.decision === "trigger" || routing.decision === "interrupted_pause") &&
      routing.selectedFlow
    ) {
      if (routing.selectedFlow.run_once && input.contactId) {
        const alreadyCompleted = await isFlowCompletedForContact(db, routing.selectedFlow.id, input.contactId);
        if (alreadyCompleted) {
          return { consumed: false, outcome: "no_match" };
        }
      }
      // Fire typing indicator immediately as new flow run starts
      void showFlowTypingIndicator(db, input.accountId, input.message.meta_message_id);
      const nodes = await loadAllNodes(db, routing.selectedFlow.id);
      return startNewRun(db, routing.selectedFlow, input, nodes);
    }

    return { consumed: false, outcome: "no_match" };
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
    if (
      message.kind === "interactive_reply" &&
      (currentNode.node_type === "send_buttons" ||
        currentNode.node_type === "send_list" ||
        currentNode.node_type === "send_carousel")
    ) {
      const btnMatch = matchReplyId(currentNode, message.reply_id);
      if (btnMatch) {
        await db.from("flow_runs").update({ status: "active", end_reason: null, reprompt_count: 0 }).eq("id", run.id);
        run.status = "active";
        run.reprompt_count = 0;
        if (!(await claimReplyTransition(db, run, btnMatch))) {
          return lostReplyRace(db, run, currentNode.node_key);
        }
        await logEvent(db, run.id, "node_entered", currentNode.node_key, { action: "flow_resumed_with_answer" });
        const outcome = await advanceFromNodeKey(db, run, btnMatch, nodes, message);
        return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
      }
    }

    if (currentNode.node_type === "whatsapp_payment") {
      const pCfg = currentNode.config as unknown as WhatsAppPaymentNodeConfig;
      if (
        (message.kind === "interactive_reply" && message.reply_id === "cancel_payment") ||
        (message.kind === "text" && /^(?:cancel|cancel payment|cancel order)$/i.test(message.text.trim()))
      ) {
        if (pCfg.cancel_next) {
          run.vars.payment_status = "cancelled";
          await db.from("flow_runs").update({ status: "active", vars: run.vars, end_reason: null, reprompt_count: 0 }).eq("id", run.id);
          run.status = "active";
          if (!(await claimReplyTransition(db, run, pCfg.cancel_next))) {
            return lostReplyRace(db, run, currentNode.node_key);
          }
          await logEvent(db, run.id, "node_entered", currentNode.node_key, { action: "flow_payment_cancelled" });
          const outcome = await advanceFromNodeKey(db, run, pCfg.cancel_next, nodes, message);
          return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
        }
      }
    }

    if (message.kind === "text") {
      // Check if user answered a button/list/carousel while paused!
      if (
        currentNode.node_type === "send_buttons" ||
        currentNode.node_type === "send_list" ||
        currentNode.node_type === "send_carousel"
      ) {
        const btnMatch = matchReplyByText(currentNode, message.text);
        if (btnMatch) {
          await db.from("flow_runs").update({ status: "active", end_reason: null, reprompt_count: 0 }).eq("id", run.id);
          run.status = "active";
          run.reprompt_count = 0;
          if (!(await claimReplyTransition(db, run, btnMatch))) {
            return lostReplyRace(db, run, currentNode.node_key);
          }
          await logEvent(db, run.id, "node_entered", currentNode.node_key, { action: "flow_resumed_with_answer" });
          const outcome = await advanceFromNodeKey(db, run, btnMatch, nodes, message);
          return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
        }
      }

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
          const outcome = await advanceFromNodeKey(db, run, collectCfg.next_node_key, nodes, message);
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
    (currentNode.node_type === "send_buttons" ||
      currentNode.node_type === "send_list" ||
      currentNode.node_type === "send_carousel")
  ) {
    matched = matchReplyByText(currentNode, message.text);
  } else if (
    message.kind === "text" &&
    (currentNode.node_type === "collect_input" || currentNode.node_type === "input_flow")
  ) {
    const cfg = currentNode.config as unknown as CollectInputNodeConfig;

    // If node is in `confirm_if_known` mode and user confirms ("yes", "ok", "haan", "sahi", etc.),
    // keep the saved value and advance immediately without rejecting confirmation words.
    const rawKeyConfirm = cfg.var_key?.startsWith("vars.") ? cfg.var_key.slice(5) : cfg.var_key;
    const savedVal = run.vars[cfg.var_key] ?? (rawKeyConfirm ? run.vars[rawKeyConfirm] : undefined);
    const isConfirmMode = cfg.context_behavior === "confirm_if_known";
    const isAffirmation = /^(yes+|y|ok+|okay|confirm|keep|same|haan+|ha+|ji|sahi(\s*hai)?|theek(\s*hai)?|bilkul)[!.\s]*$/i.test(
      message.text.trim(),
    );
    if (isConfirmMode && typeof savedVal === "string" && savedVal.trim() && isAffirmation && cfg.next_node_key) {
      const confirmedVars = {
        ...run.vars,
        [cfg.var_key]: savedVal,
        ...(rawKeyConfirm ? { [rawKeyConfirm]: savedVal, [`vars.${rawKeyConfirm}`]: savedVal } : {}),
      };
      if (!(await claimReplyTransition(db, run, cfg.next_node_key, { vars: confirmedVars, reprompt_count: 0 }))) {
        return lostReplyRace(db, run, currentNode.node_key);
      }
      run.vars = confirmedVars;
      run.reprompt_count = 0;
      const outcome = await advanceFromNodeKey(db, run, cfg.next_node_key, nodes, message);
      return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
    }

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

      // Ensure AI auto-reply is enabled and has fresh budget on this conversation so the interruption query gets answered
      if (run.conversation_id) {
        await db
          .from("conversations")
          .update({ ai_autoreply_disabled: false, ai_reply_count: 0 })
          .eq("id", run.conversation_id);
      }

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

        // Backfill profile details and dynamic memory to contacts table & log activity
        if (run.contact_id) {
          const { data: curContact } = await db
            .from("contacts")
            .select("id, linked_contact_id, metadata")
            .eq("id", run.contact_id)
            .maybeSingle();

          const rootId = (curContact as any)?.linked_contact_id || run.contact_id;
          const contactUpdates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if ((rawKey === "name" || rawKey === "contact_name" || rawKey === "user_name") && normalized) {
            contactUpdates.name = normalized;
          } else if ((rawKey === "phone" || rawKey === "phone_number") && normalized) {
            contactUpdates.phone = normalized;
          } else if (rawKey === "email" && normalized) {
            contactUpdates.email = normalized;
          }

          // Always store any captured variable into dynamic customer memory
          const existingMeta = ((curContact as any)?.metadata as Record<string, unknown>) || {};
          contactUpdates.metadata = {
            ...existingMeta,
            [rawKey]: normalized,
          };

          await db.from("contacts").update(contactUpdates).eq("id", run.contact_id);
          if (rootId !== run.contact_id) {
            await db.from("contacts").update(contactUpdates).eq("id", rootId);
          }

          logContactActivity(db as any, {
            accountId: run.account_id,
            contactId: run.contact_id,
            conversationId: run.conversation_id,
            channel: 'system',
            eventType: 'flow_input_collected',
            summary: `Collected ${rawKey || cfg.var_key}: "${normalized}" via flow`,
            metadata: {
              flowId: run.flow_id,
              nodeKey: currentNode.node_key,
              varKey: cfg.var_key,
              normalizedValue: normalized,
            },
          }).catch(() => null);

          // Persist into Customer Memory Engine with provenance
          upsertCustomerMemory(db as any, {
            accountId: run.account_id,
            contactId: rootId,
            memoryKey: rawKey || cfg.var_key,
            memoryValue: normalized,
            sourceType: 'customer_explicit',
            sourceChannel: 'whatsapp',
            authority: 'customer_explicit',
            confidence: 1.0,
          }).catch(() => null);
        }

        const outcome = await advanceFromNodeKey(db, run, cfg.next_node_key, nodes, message);
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

      let correctiveMessage =
        cfg.invalid_message?.trim() ||
        getDefaultInvalidMessage(cfg.validation);

      const targetLocale = (run.vars?.locale || run.vars?.language) as string | undefined;
      if (targetLocale && !targetLocale.toLowerCase().startsWith("en")) {
        const aiCfg = await loadAiConfig(db, run.account_id).catch(() => null);
        correctiveMessage = await localizeText(correctiveMessage, targetLocale, aiCfg, db, run.account_id);
      }

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
    const selectionVars = extractInteractiveSelectionVars(currentNode, message);
    const hasSelectionVars = Object.keys(selectionVars).length > 0;
    const nextVars = hasSelectionVars ? { ...(run.vars || {}), ...selectionVars } : undefined;
    if (!(await claimReplyTransition(db, run, matched, nextVars ? { vars: nextVars } : {}))) {
      return lostReplyRace(db, run, currentNode.node_key);
    }
    if (nextVars) {
      run.vars = nextVars;
    }
    const outcome = await advanceFromNodeKey(db, run, matched, nodes, message);
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

    // Off-script message (e.g. "I want a book", "Hello"):
    // Pause the flow and route to AI Auto-Reply or agent without resending the menu in a loop!
    await db
      .from("flow_runs")
      .update({
        status: "paused_by_agent",
        end_reason: "interrupted_by_user",
      })
      .eq("id", run.id);

    if (run.conversation_id) {
      await db
        .from("conversations")
        .update({ ai_autoreply_disabled: false, ai_reply_count: 0 })
        .eq("id", run.conversation_id);
    }

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
      const targetLocale = (run.vars?.locale || run.vars?.language) as string | undefined;
      let effectiveCurrentNode = currentNode;
      if (targetLocale && !targetLocale.toLowerCase().startsWith("en")) {
        const aiCfg = await loadAiConfig(db, run.account_id).catch(() => null);
        effectiveCurrentNode = await localizeNode(currentNode, targetLocale, aiCfg, db, run.account_id);
      }

      if (effectiveCurrentNode.node_type === "send_buttons") {
        await sendButtonsAndSuspend(db, run, effectiveCurrentNode);
      } else if (effectiveCurrentNode.node_type === "send_list") {
        await sendListAndSuspend(db, run, effectiveCurrentNode);
      } else if (effectiveCurrentNode.node_type === "send_carousel") {
        await sendCarouselAndSuspend(db, run, effectiveCurrentNode);
      } else if (effectiveCurrentNode.node_type === "collect_input" || effectiveCurrentNode.node_type === "input_flow") {
        // Customer typed something we couldn't accept (empty after trim,
        // or var_key missing — rare). Re-send the prompt so they try again.
        const cfg = effectiveCurrentNode.config as unknown as CollectInputNodeConfig;
        const resolvedPrompt = await resolveNodeText(db, run, effectiveCurrentNode, cfg.prompt_text || "", cfg, message);
        await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: resolvedPrompt,
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
  extraInitialVars?: Record<string, unknown>,
): Promise<DispatchInboundResult> {
  // run_once check
  if (flow.run_once && input.contactId) {
    const alreadyCompleted = await isFlowCompletedForContact(db, flow.id, input.contactId);
    if (alreadyCompleted) {
      return { consumed: false, outcome: "no_match" };
    }
  }

  // Pre-seed contact info into run vars so {{contact.name}}, {{name}}, {{phone}}, {{email}} work
  let initialVars: Record<string, unknown> = {};
  if (input.contactId) {
    try {
      const { data: contact } = await db
        .from("contacts")
        .select("id, name, phone, email, ig_username, fb_name, last_seen_channel, metadata, linked_contact_id")
        .eq("id", input.contactId)
        .maybeSingle();
      if (contact) {
        let c = contact as any;

        // If this is a linked contact, merge in root contact's metadata and fields
        if (c.linked_contact_id) {
          const { data: rootContact } = await db
            .from("contacts")
            .select("id, name, phone, email, ig_username, fb_name, last_seen_channel, metadata")
            .eq("id", c.linked_contact_id)
            .maybeSingle();
          if (rootContact) {
            const r = rootContact as any;
            c = {
              ...r,
              ...c,
              phone: c.phone || r.phone,
              ig_username: c.ig_username || r.ig_username,
              fb_name: c.fb_name || r.fb_name,
              email: c.email || r.email,
              name: (c.name && c.name !== "Instagram User" && c.name !== "Facebook User") ? c.name : r.name,
              metadata: { ...(r.metadata || {}), ...(c.metadata || {}) },
            };
          }
        }

        const cName = c.name && c.name !== "Instagram User" && c.name !== "Facebook User" ? c.name : "";
        const cPhone = c.phone || "";
        const cEmail = c.email || "";
        const cIg = c.ig_username ? `@${c.ig_username.replace(/^@/, '')}` : "";
        const cFb = c.fb_name || "";
        const cMeta = (c.metadata as Record<string, unknown>) || {};

        initialVars = {
          ...cMeta, // Injects all dynamic memory fields (address, preferred_time, budget, etc.)
          "contact.id": input.contactId,
          "contact.name": cName,
          "contact.phone": cPhone,
          "contact.email": cEmail,
          name: cName || cMeta.name || "",
          contact_name: cName || cMeta.name || "",
          user_name: cName || cMeta.name || "",
          phone: cPhone || cMeta.phone || "",
          phone_number: cPhone || cMeta.phone || "",
          email: cEmail || cMeta.email || "",
          ig_username: cIg,
          fb_name: cFb,
          channel: input.channel || c.last_seen_channel || "whatsapp",
          metadata: cMeta,
          contact: {
            ...cMeta,
            id: input.contactId,
            name: cName,
            phone: cPhone,
            email: cEmail,
            ig_username: cIg,
            fb_name: cFb,
          },
        };
      }
    } catch {
      // Non-fatal if contact lookup fails
    }
  }

  // Detect customer's initial language (e.g. Hindi, Hinglish, English)
  let detectedLocale = "en";
  if (input.message.kind === "text" && input.message.text) {
    const fast = fastPathDetectLanguage(input.message.text);
    if (fast) {
      detectedLocale = fast.locale;
    } else {
      const aiCfg = await loadAiConfig(db, flow.account_id).catch(() => null);
      const det = await detectLanguage(input.message.text, aiCfg).catch(() => null);
      if (det?.locale) {
        detectedLocale = det.locale;
      }
    }
  }

  initialVars.locale = detectedLocale;
  initialVars.language = detectedLocale;
  if (extraInitialVars && Object.keys(extraInitialVars).length > 0) {
    initialVars = { ...initialVars, ...extraInitialVars };
  }

  // Resolve entry node key: check flow.entry_node_id, then trigger node, then start, or first node in graph
  let entryNodeKey = flow.entry_node_id;
  if (!entryNodeKey || !nodes.has(entryNodeKey)) {
    const triggerNode = Array.from(nodes.values()).find((n) => n.node_type === "trigger");
    entryNodeKey = triggerNode?.node_key || (nodes.has("start") ? "start" : Array.from(nodes.keys())[0]);
  }
  if (!entryNodeKey) {
    console.error(`[flows] flow ${flow.id} has no valid nodes to start run`);
    return { consumed: false, outcome: "no_match" };
  }
  flow.entry_node_id = entryNodeKey;

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
      current_node_key: entryNodeKey,
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
  await logEvent(db, run.id, "started", entryNodeKey, {
    flow_id: flow.id,
    trigger_type: flow.trigger_type,
    meta_message_id: input.message.meta_message_id,
  });

  // Client/Agent-only internal badge for CRM Inbox:
  if (input.conversationId) {
    try {
      await db.from("messages").insert({
        conversation_id: input.conversationId,
        sender_type: "bot",
        content_type: "text",
        content_text: `⚡ Flow: "${flow.name}" triggered`,
        status: "delivered",
      });
    } catch (badgeErr) {
      console.warn("[flows] Failed to log flow trigger badge message:", badgeErr);
    }
  }
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
  const outcome = await advanceFromNodeKey(db, run, flow.entry_node_id!, nodes, input.message);
  if (outcome.outcome === "completed" && flow.run_once && input.contactId) {
    await markFlowCompletedForContact(db, flow.id, input.contactId);
  }
  return {
    consumed: true,
    flow_run_id: run.id,
    outcome: outcome.outcome === "advanced" ? "started" : outcome.outcome,
  };
}

/**
 * Resumes an active flow run upon an external system event (e.g. Razorpay webhook, payment received).
 */
export async function resumeFlowRunOnEvent(args: {
  db: AdminClient;
  runId: string;
  targetNodeKey?: string;
  varsPatch?: Record<string, unknown>;
  eventPayload?: Record<string, unknown>;
}): Promise<{ success: boolean; outcome?: string }> {
  const { db, runId, targetNodeKey, varsPatch, eventPayload } = args;
  const { data: run, error } = await db
    .from("flow_runs")
    .select("*")
    .eq("id", runId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !run) {
    return { success: false, outcome: "run_not_found_or_inactive" };
  }

  const nodes = await loadAllNodes(db, run.flow_id);
  const currentNode = run.current_node_key ? nodes.get(run.current_node_key) : null;

  let nextKey = targetNodeKey;
  if (!nextKey && currentNode) {
    if (currentNode.node_type === "whatsapp_payment") {
      const paymentCfg = currentNode.config as unknown as WhatsAppPaymentNodeConfig;
      nextKey = paymentCfg.success_next || paymentCfg.next_node_key;
    } else {
      nextKey = (currentNode.config as any)?.next_node_key;
    }
  }

  if (!nextKey) {
    return { success: false, outcome: "no_target_node_key" };
  }

  const updatedVars = { ...(run.vars || {}), ...(varsPatch || {}) };
  run.vars = updatedVars;
  await db
    .from("flow_runs")
    .update({ vars: updatedVars, current_node_key: nextKey })
    .eq("id", run.id);

  await logEvent(db, run.id, "node_entered", nextKey, {
    action: "flow_resumed_from_external_event",
    ...(eventPayload || {}),
  });

  const outcome = await advanceFromNodeKey(db, run, nextKey, nodes);
  return { success: true, outcome: outcome.outcome };
}

/**
 * Loads a normalized, high-signal catalog of all active flows for an account.
 * Fed directly into AI auto-reply system prompts to provide flow awareness.
 */
export async function loadActiveFlowCatalog(
  db: AdminClient,
  accountId: string,
): Promise<FlowCatalogItem[]> {
  const flows = await loadEnrichedActiveFlows(db, accountId);
  return flows.map((f) => {
    let triggerSummary = "";
    const tc = (f.trigger_config || {}) as Record<string, unknown>;
    if (f.trigger_type === "ai_intent") {
      const intentName = (tc.intent_name as string) || f.name;
      const intentDesc = (tc.intent_description as string) || "Matches inquiries or requests for this topic";
      triggerSummary = `AI Intent: "${intentName}". Description: ${intentDesc}`;
      if (Array.isArray(tc.positive_examples) && tc.positive_examples.length > 0) {
        triggerSummary += `. Trigger phrases: ${tc.positive_examples.slice(0, 4).join(", ")}`;
      }
    } else if (f.trigger_type === "keyword") {
      const kw = Array.isArray(tc.keywords) ? (tc.keywords as string[]).join(", ") : "";
      triggerSummary = `Keywords: ${kw || "None specified"}`;
    } else {
      triggerSummary = `Trigger type: ${f.trigger_type}`;
    }
    return {
      id: f.id,
      name: f.name,
      description: f.description || undefined,
      triggerType: f.trigger_type,
      triggerSummary,
      keywords: Array.isArray(tc.keywords) ? (tc.keywords as string[]) : undefined,
      intentName: (tc.intent_name as string) || undefined,
      intentDescription: (tc.intent_description as string) || undefined,
    };
  });
}

/**
 * Triggers an interactive flow for a contact directly (e.g. from an AI autonomous directive).
 * Resolves by flow ID or flow name, ends any conflicting prior run, and executes the entry node.
 */
export async function triggerFlowForContact(
  db: AdminClient,
  args: {
    accountId: string;
    contactId: string;
    conversationId: string;
    flowIdOrName: string;
    configOwnerUserId?: string;
    triggerSource?: string;
    initialVars?: Record<string, unknown>;
  },
): Promise<DispatchInboundResult> {
  const { accountId, contactId, conversationId, flowIdOrName, configOwnerUserId, triggerSource, initialVars } = args;

  if (!accountId || !contactId || !flowIdOrName) {
    return { consumed: false, outcome: "no_match" };
  }

  // 1. Resolve target flow by ID or name
  let targetFlow: FlowRow | null = null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowIdOrName.trim());
  if (isUuid) {
    targetFlow = await loadFlow(db, flowIdOrName.trim());
  } else {
    // Try exact or case-insensitive match on name
    const { data: matched } = await db
      .from("flows")
      .select("*")
      .eq("account_id", accountId)
      .eq("status", "active")
      .ilike("name", flowIdOrName.trim())
      .limit(1)
      .maybeSingle();
    targetFlow = matched as FlowRow | null;

    if (!targetFlow) {
      // Fuzzy contains match
      const { data: fuzzy } = await db
        .from("flows")
        .select("*")
        .eq("account_id", accountId)
        .eq("status", "active")
        .ilike("name", `%${flowIdOrName.trim()}%`)
        .limit(1)
        .maybeSingle();
      targetFlow = fuzzy as FlowRow | null;
    }
  }

  if (!targetFlow || targetFlow.status !== "active") {
    console.warn(`[flows] triggerFlowForContact: Active flow "${flowIdOrName}" not found for account ${accountId}`);
    return { consumed: false, outcome: "no_match" };
  }

  // 2. Check if an active run already exists for this contact
  const activeRun = await loadActiveRunForContact(db, accountId, contactId, conversationId);
  if (activeRun) {
    if (activeRun.flow_id === targetFlow.id) {
      console.log(`[flows] triggerFlowForContact: Contact ${contactId} already in active run ${activeRun.id} for flow "${targetFlow.name}"`);
      return { consumed: true, flow_run_id: activeRun.id, outcome: "started" };
    }
    // Supersede other active run
    await endRun(db, activeRun.id, "completed", "superseded_by_ai_trigger");
  }

  // 3. Load all nodes
  const nodes = await loadAllNodes(db, targetFlow.id);
  if (nodes.size === 0) {
    console.warn(`[flows] triggerFlowForContact: Flow "${targetFlow.name}" has no nodes`);
    return { consumed: false, outcome: "no_match" };
  }

  // 4. Construct synthetic message for entry
  const syntheticMessage: ParsedInbound = {
    kind: "text",
    text: triggerSource || `AI Triggered: ${targetFlow.name}`,
    meta_message_id: `ai_trig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };

  const input: DispatchInboundInput = {
    accountId,
    userId: configOwnerUserId || targetFlow.user_id,
    contactId,
    conversationId,
    channel: "whatsapp",
    message: syntheticMessage,
  };

  // 5. Start new run (forwarding initialVars before entry node advances)
  return startNewRun(db, targetFlow, input, nodes, initialVars);
}
