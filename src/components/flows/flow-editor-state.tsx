"use client";

/**
 * Single source of truth for the flow editor's state.
 *
 * Both views (list and canvas) read and mutate the same `BuilderState`
 * via `useFlowEditor()`. The provider mounts once inside
 * `FlowEditorShell`, so toggling views never resets unsaved edits.
 *
 * What lives here:
 *   - `BuilderState` shape (header fields, trigger config, nodes).
 *   - Dirty / saving / activating flags so the header save button
 *     and the beforeunload guard share the same source.
 *   - All mutations: name / description / trigger / fallback,
 *     addNode / updateNode / updateNodeConfig / updateNodePosition /
 *     removeNode, setEntryNodeId.
 *   - Side effects: save (PUT), setStatus (POST /activate),
 *     deleteFlow (DELETE then router.push).
 *   - Validation issues + the canActivate boolean.
 *
 * What does NOT live here:
 *   - List-view UI state (expanded card set, scroll refs,
 *     flash-on-jump) — those are list-only and stay in
 *     `flow-builder.tsx`.
 *   - Canvas-view UI state (selected node id, side-sheet open) —
 *     those are canvas-only and stay in `flow-canvas.tsx`.
 *
 * `removeNode` does NOT auto-clean inbound edges. The list-view's
 * NodeKeySelect dropdowns and the validator both surface dangling
 * `next_node_key` references; that visibility is enough for v1. PR 2b
 * (canvas delete via keyboard) will revisit if the canvas adds an
 * implicit-delete affordance that's easier to trip accidentally.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  validateFlowForActivation,
  type ValidationIssue,
} from "@/lib/flows/validate";
import { useTranslations } from "next-intl";
import { getT } from "@/lib/i18n/translate";
import {
  deriveCanvasEdges,
  unlinkNodeReferences,
} from "@/lib/flows/edges";
import { autoLayout } from "@/lib/flows/layout";
import type { FlowNodeRow, FlowRow } from "@/lib/flows/types";
import { NODE_META, slugify, type BuilderNode, type NodeType } from "./shared";

// ============================================================
// State shape
// ============================================================

export interface BuilderState {
  name: string;
  description: string;
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: Record<string, unknown>;
  entry_node_id: string | null;
  status: FlowRow["status"];
  nodes: BuilderNode[];
}

export interface FlowEditorContextValue {
  /** Immutable post-load envelope: id, created_at, fallback_policy, etc. */
  flow: FlowRow;

  // Authored state
  state: BuilderState;
  /**
   * Dirty-tracking React setState. Flips `dirty` on every call. Used
   * by the list view's existing subcomponents (Header, TriggerPanel,
   * EntryPicker) which mutate multiple fields atomically — granular
   * setters below would force them to fan out the update.
   */
  setState: (
    updaterOrValue:
      | BuilderState
      | ((prev: BuilderState) => BuilderState),
  ) => void;
  dirty: boolean;
  saving: boolean;
  activating: boolean;
  issues: ValidationIssue[];
  canActivate: boolean;

  // Node mutations. addNode returns the generated key so the caller
  // (a NodeCard "Add" button or canvas "+" button) can scroll to /
  // focus / open the new node.
  addNode: (type: NodeType) => string;
  updateNode: (key: string, patch: Partial<BuilderNode>) => void;
  updateNodeConfig: (key: string, patch: Record<string, unknown>) => void;
  updateNodePosition: (key: string, x: number, y: number) => void;
  updateNodePositions: (
    positions: Record<string, { x: number; y: number }>,
  ) => void;
  removeNode: (key: string) => void;
  /**
   * Run the dagre auto-layout over the current node graph and persist
   * the resulting positions. Unlike the lazy initial-layout hook this
   * is an explicit user action ("Arrange") so it always dirties the
   * editor and always overwrites whatever the user had placed.
   */
  arrangeNodes: (options?: { direction?: "TB" | "LR" }) => void;

  // Actions
  save: () => Promise<boolean>;
  setStatus: (status: BuilderState["status"]) => Promise<void>;
  deleteFlow: () => Promise<void>;

  /**
   * Transient "look here" signal. Set when the validation panel's
   * issue is clicked — both views subscribe: list scrolls the row
   * into view and flashes its border, canvas pans the viewport to
   * the node and flashes its card. Auto-clears after 1600ms so the
   * flash is a one-shot.
   *
   * Lives in context (not local view state) so the panel can be
   * rendered ONCE in the shell and trigger flashes in whichever
   * view is currently mounted, without per-view plumbing.
   */
  flashKey: string | null;
  requestFlash: (key: string) => void;
}

// ============================================================
// Helpers — node_key generation + per-type default configs
// ============================================================

export function uniqueNodeKey(base: string, existing: BuilderNode[]): string {
  if (!existing.some((n) => n.node_key === base)) return base;
  let i = 2;
  while (existing.some((n) => n.node_key === `${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function buildNewNode(type: NodeType, existing: BuilderNode[]): BuilderNode {
  const base = slugify(NODE_META[type].slugSeed, type);
  return {
    node_key: uniqueNodeKey(base, existing),
    node_type: type,
    config: defaultConfigFor(type),
  };
}

export function appendNode(state: BuilderState, node: BuilderNode): BuilderState {
  return {
    ...state,
    nodes: [...state.nodes, node],
    entry_node_id:
      state.entry_node_id ?? (node.node_type === "start" ? node.node_key : null),
  };
}

export function defaultConfigFor(type: NodeType): Record<string, unknown> {
  const t = getT("Flows.editorState");
  const tForm = getT("Flows.builder.form");
  switch (type) {
    case "start":
      return { next_node_key: "" };
    case "send_message":
      return { text: "", next_node_key: "" };
    case "send_buttons":
      return {
        text: "",
        buttons: [{ reply_id: "yes", title: t("defaultYes"), next_node_key: "" }],
      };
    case "send_list":
      return {
        text: "",
        button_label: t("defaultListButton"),
        sections: [
          {
            title: "",
            rows: [
              { reply_id: "row_1", title: tForm("optionN", { n: 1 }), next_node_key: "" },
            ],
          },
        ],
      };
    case "send_media":
      return {
        media_type: "image",
        media_url: "",
        caption: "",
        filename: "",
        next_node_key: "",
      };
    case "send_carousel":
      return {
        text: "",
        cards: [
          {
            header_image_url: "",
            body_text: "",
            buttons: [
              {
                reply_id: "card_1_btn_1",
                title: tForm("defaultOptionTitle") || "Select",
                next_node_key: "",
              },
            ],
          },
          {
            header_image_url: "",
            body_text: "",
            buttons: [
              {
                reply_id: "card_2_btn_1",
                title: tForm("defaultOptionTitle") || "Select",
                next_node_key: "",
              },
            ],
          },
        ],
      };
    case "send_location":
      return {
        latitude: "",
        longitude: "",
        name: "",
        address: "",
        next_node_key: "",
      };
    case "send_contact":
      return {
        formatted_name: "",
        first_name: "",
        last_name: "",
        phone: "",
        phone_type: "CELL",
        email: "",
        company: "",
        title: "",
        next_node_key: "",
      };
    case "request_address":
      return {
        text: "",
        country: "IN",
        header: "",
        footer: "",
        next_node_key: "",
      };
    case "collect_input":
      return {
        prompt_text: "",
        var_key: "answer",
        next_node_key: "",
      };
    case "condition":
      return {
        subject: "var",
        subject_key: "",
        operator: "equals",
        value: "",
        true_next: "",
        false_next: "",
      };
    case "set_tag":
      return { mode: "add", tag_id: "", next_node_key: "" };
    case "handoff":
    case "agent_handover":
      return { note: "", mode: "round_robin" };
    case "end":
      return {};
    case "trigger":
      return { starting_step: "new_contact", next_node_key: "" };
    case "ai_response":
      return {
        prompt: "",
        proceed_condition: "wait_high_confidence",
        confidence_threshold: 0.8,
        low_confidence_message: "I'm not confident about my response. Could you rephrase your question?",
        active: true,
        next_node_key: "",
      };
    case "send_email":
      return {
        to_email: "{{contact.email}}",
        subject: "",
        body: "",
        use_custom_smtp: false,
        smtp_host: "",
        smtp_port: "587",
        username: "",
        password: "",
        encryption: "tls",
        from_name: "",
        from_email: "",
        active: true,
        next_node_key: "",
      };
    case "delay":
      return { amount: 5, unit: "minutes", next_node_key: "" };
    case "webhook":
    case "http_fetch":
      return { url: "", method: "POST", headers: {}, body_template: "", next_node_key: "" };
    case "update_contact":
      return { field: "name", value: "", next_node_key: "" };
    case "assign_label":
      return { mode: "add", tag_id: "", next_node_key: "" };
    case "add_to_group":
      return { group_id: "", next_node_key: "" };
    case "remove_from_group":
      return { group_id: "", next_node_key: "" };
    case "whatsapp_payment":
      return { amount: 100, currency: "INR", item_name: "Product Order", provider: "razorpay", next_node_key: "" };
    case "create_deal":
      return { pipeline_id: "", stage_id: "", title: "New Deal", value: 0, next_node_key: "" };
    case "catalog":
      return { catalog_id: "", body_text: "Browse our catalog:", next_node_key: "" };
    case "input_flow":
      return { prompt_text: "Please enter your response:", var_key: "user_input", validation: "any", next_node_key: "" };
    case "book_appointment":
      return { service_type: "cal_com", booking_url: "", prompt_text: "Book your appointment:", next_node_key: "" };
    case "whatsapp_form":
      return { flow_id: "", next_node_key: "" };
    case "close_conversation":
      return { reason: "Resolved by workflow" };
    default:
      return { next_node_key: "" };
  }
}

export function applyNodePositions(
  nodes: BuilderNode[],
  positions: Record<string, { x: number; y: number }>,
): BuilderNode[] {
  return nodes.map((n) => {
    const next = positions[n.node_key];
    return next
      ? {
          ...n,
          position_x: Math.round(next.x),
          position_y: Math.round(next.y),
        }
      : n;
  });
}

// ============================================================
// Context
// ============================================================

export const FlowEditorCtx = createContext<FlowEditorContextValue | null>(null);

export function useFlowEditor(): FlowEditorContextValue {
  const ctx = useContext(FlowEditorCtx);
  if (!ctx) {
    throw new Error(
      "useFlowEditor must be called inside <FlowEditorProvider>",
    );
  }
  return ctx;
}

export function useOptionalFlowEditor(): FlowEditorContextValue | null {
  return useContext(FlowEditorCtx);
}

// ============================================================
// Provider
// ============================================================

interface ProviderProps {
  initialFlow: FlowRow;
  initialNodes: FlowNodeRow[];
  children: ReactNode;
}

export function FlowEditorProvider({
  initialFlow,
  initialNodes,
  children,
}: ProviderProps) {
  const router = useRouter();
  const t = useTranslations("Flows.editorState");

  const [state, setStateRaw] = useState<BuilderState>(() => {
    let mappedNodes = initialNodes.map((n) => ({
      node_key: n.node_key,
      node_type: n.node_type as NodeType,
      config: n.config as Record<string, unknown>,
      position_x: n.position_x,
      position_y: n.position_y,
    }));

    // If new flow has no nodes, default to a Trigger node on the canvas
    if (mappedNodes.length === 0) {
      const defaultStartingStep = initialFlow.trigger_type === "first_inbound_message" ? "new_contact" : "keyword";
      const defaultKeywords = Array.isArray((initialFlow.trigger_config as Record<string, unknown>)?.keywords)
        ? ((initialFlow.trigger_config as Record<string, unknown>).keywords as string[])
        : [];
      mappedNodes = [
        {
          node_key: "trigger_1",
          node_type: "trigger",
          config: {
            starting_step: defaultStartingStep,
            keywords: defaultKeywords,
            next_node_key: "",
          },
          position_x: 80,
          position_y: 120,
        },
      ];
    }

    const triggerNode = mappedNodes.find((n) => n.node_type === "trigger");
    const entryId = initialFlow.entry_node_id || triggerNode?.node_key || (mappedNodes[0]?.node_key ?? null);

    return {
      name: initialFlow.name,
      description: initialFlow.description ?? "",
      trigger_type: initialFlow.trigger_type,
      trigger_config: initialFlow.trigger_config as Record<string, unknown>,
      entry_node_id: entryId,
      status: initialFlow.status,
      nodes: mappedNodes,
    };
  });

  const [saving, setSaving] = useState(false);
  const latestNodesRef = useRef(state.nodes);
  useEffect(() => {
    latestNodesRef.current = state.nodes;
  }, [state.nodes]);
  const [activating, setActivating] = useState(false);
  // dirty flips on user edits; status-only updates (after the activate
  // API succeeds) use setStateRaw so they don't falsely re-flag the
  // form as dirty.
  const [dirty, setDirty] = useState(false);
  const setState = useCallback<typeof setStateRaw>((updaterOrValue) => {
    setDirty(true);
    setStateRaw(updaterOrValue);
  }, []);

  // Cross-view "look here" signal (see FlowEditorContextValue docs).
  // Tracked via a ref alongside state so a rapid second click on a
  // different issue cancels the previous timeout instead of letting
  // the first flash linger past the new one.
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const requestFlash = useCallback((key: string) => {
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    setFlashKey(key);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashKey(null);
      flashTimeoutRef.current = null;
    }, 1600);
  }, []);
  useEffect(
    () => () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    },
    [],
  );

  // Browser-level reload / tab-close / external-link guard. SPA
  // navigation (sidebar links, back button) isn't covered — Next 16
  // routes through the App Router and beforeunload doesn't fire on
  // client-side route changes. That's a follow-up; this catches the
  // accidental refresh / closed-window class of data loss.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the return value but require something
      // truthy to actually show the native prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---- Validation ----
  const issues = useMemo<ValidationIssue[]>(
    () =>
      validateFlowForActivation(
        {
          name: state.name,
          trigger_type: state.trigger_type,
          trigger_config: state.trigger_config,
          entry_node_id: state.entry_node_id,
        },
        state.nodes,
      ),
    [state],
  );
  const canActivate = useMemo(
    () => issues.every((i) => i.severity !== "error"),
    [issues],
  );

  // ---- Save (PUT) ----
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flows/${initialFlow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          description: state.description || null,
          trigger_type: state.trigger_type,
          trigger_config: state.trigger_config,
          entry_node_id: state.entry_node_id,
          nodes: state.nodes,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? t("saveFailedStatus", { status: res.status }));
      }
      setDirty(false);
      toast.success(t("saved"));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveFailed");
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [initialFlow.id, state, t]);

  // ---- Activate / Pause / Archive ----
  const setStatus = useCallback(
    async (next: BuilderState["status"]) => {
      if (next === "active" && !canActivate) {
        toast.error(t("fixIssues"));
        return;
      }
      setActivating(true);
      try {
        // Always save first so the activation validator sees the
        // latest state — the user shouldn't have to remember "save
        // then activate".
        if (next === "active" && !(await save())) {
          return;
        }
        const res = await fetch(`/api/flows/${initialFlow.id}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? t("statusUpdateFailedStatus", { status: res.status }));
        }
        setStateRaw((s) => ({ ...s, status: next }));
        toast.success(
          next === "active"
            ? t("statusActivated")
            : next === "archived"
              ? t("statusArchived")
              : t("statusDraft")
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("statusUpdateFailed");
        toast.error(msg);
      } finally {
        setActivating(false);
      }
    },
    [canActivate, save, initialFlow.id, t],
  );

  // ---- Delete ----
  const deleteFlow = useCallback(async () => {
    const yes = window.confirm(t("deleteConfirm", { name: state.name }));
    if (!yes) return;
    try {
      const res = await fetch(`/api/flows/${initialFlow.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(t("deleteFailedStatus", { status: res.status }));
      router.push("/flows");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("deleteFailed");
      toast.error(msg);
    }
  }, [initialFlow.id, router, state.name, t]);

  // ---- Node mutations ----
  const updateNode = useCallback(
    (key: string, patch: Partial<BuilderNode>) => {
      setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.node_key === key ? { ...n, ...patch } : n,
        ),
      }));
    },
    [setState],
  );

  const updateNodeConfig = useCallback(
    (key: string, configPatch: Record<string, unknown>) => {
      setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.node_key === key
            ? { ...n, config: { ...n.config, ...configPatch } }
            : n,
        ),
      }));
    },
    [setState],
  );

  const updateNodePosition = useCallback(
    (key: string, x: number, y: number) => {
      setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.node_key === key
            ? { ...n, position_x: Math.round(x), position_y: Math.round(y) }
            : n,
        ),
      }));
    },
    [setState],
  );

  const updateNodePositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      // Initial Dagre layout hydration should not dirty the editor:
      // opening a legacy all-zero flow must not enable Save or arm
      // beforeunload before the user actually edits anything.
      setStateRaw((s) => ({
        ...s,
        nodes: applyNodePositions(s.nodes, positions),
      }));
    },
    [],
  );

  const arrangeNodes = useCallback(
    (options?: { direction?: "TB" | "LR" }) => {
      const positions = autoLayout(
        state.nodes.map((n) => ({
          id: n.node_key,
          width: 260,
          height: 110,
        })),
        deriveCanvasEdges(state.nodes).map((e) => ({
          source: e.source,
          target: e.target,
        })),
        {
          direction: options?.direction ?? "TB",
          rankSep: 90,
          nodeSep: 70,
        },
      );
      setState((s) => ({
        ...s,
        nodes: applyNodePositions(
          s.nodes,
          Object.fromEntries(
            [...positions].map(([key, pos]) => [key, pos])
          )
        ),
      }));
    },
    [setState, state.nodes],
  );

  const addNode = useCallback(
    (type: NodeType): string => {
      const node = buildNewNode(type, latestNodesRef.current);
      latestNodesRef.current = [...latestNodesRef.current, node];
      setState((s) => appendNode(s, node));
      return node.node_key;
    },
    [setState],
  );

  const removeNode = useCallback(
    (key: string) => {
      // Auto-unlink inbound references so canvas / list deletes don't
      // leave dangling arrows behind that the validator would flag.
      // Cleared refs become "" (the "no target picked" sentinel the
      // builder forms already use).
      setState((s) => {
        const remainingNodes = unlinkNodeReferences(
          s.nodes.filter((n) => n.node_key !== key),
          key,
        );
        const nextEntry =
          s.entry_node_id === key
            ? (remainingNodes.find((n) => n.node_type === "trigger")?.node_key ?? remainingNodes[0]?.node_key ?? null)
            : s.entry_node_id;
        return {
          ...s,
          nodes: remainingNodes,
          entry_node_id: nextEntry,
        };
      });
    },
    [setState],
  );

const value = useMemo<FlowEditorContextValue>(
    () => ({
      flow: initialFlow,
      state,
      setState,
      dirty,
      saving,
      activating,
      issues,
      canActivate,
      addNode,
      updateNode,
      updateNodeConfig,
      updateNodePosition,
      updateNodePositions,
      removeNode,
      arrangeNodes,
      save,
      setStatus,
      deleteFlow,
      flashKey,
      requestFlash,
    }),
    [
      initialFlow,
      state,
      setState,
      dirty,
      saving,
      activating,
      issues,
      canActivate,
      addNode,
      updateNode,
      updateNodeConfig,
      updateNodePosition,
      updateNodePositions,
      removeNode,
      arrangeNodes,
      save,
      setStatus,
      deleteFlow,
      flashKey,
      requestFlash,
    ],
  );

  return <FlowEditorCtx.Provider value={value}>{children}</FlowEditorCtx.Provider>;
}
