/**
 * Shared editor primitives used by both the linear-list and canvas
 * views of a flow.
 *
 * What lives here vs in flow-builder.tsx / flow-canvas.tsx:
 *   - Types and metadata that BOTH views need to render a node
 *     consistently (icon, label, color, 1-line summary).
 *   - Editing-only helpers (defaultConfigFor, slugify, uniqueNodeKey,
 *     BuilderState) stay in flow-builder.tsx until the canvas grows
 *     editing affordances — pulled across in the PR that adds them.
 *
 * Why .tsx and not .ts: NODE_META holds lucide icon components, which
 * are typed as React components; importing them from a .ts module
 * works at runtime but trips TypeScript's
 * `verbatimModuleSyntax`-related linting in some setups. Keeping the
 * file .tsx future-proofs it for inline JSX in node-card renderers.
 */

import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Contact,
  CreditCard,
  FileText,
  Flag,
  GalleryHorizontalEnd,
  GitFork,
  Globe,
  Inbox,
  ListChecks,
  ListPlus,
  Mail,
  MapPin,
  MessageCircle,
  Paperclip,
  PlayCircle,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  UserCheck,
  UserMinus,
  UserPlus,
  Workflow,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { FlowNodeType } from '@/lib/flows/types';

// ============================================================
// Node-type union — single source of truth for every place the UI
// enumerates types (add menu, type pickers, switch statements). Kept
// in lockstep with `FlowNodeType` in src/lib/flows/types.ts.
// ============================================================

export type NodeType = FlowNodeType;

export interface BuilderNode {
  node_key: string;
  node_type: NodeType;
  config: Record<string, unknown>;
  /** Optional in v1 — defaults to 0 in the DB. Canvas view reads it
   *  to position nodes; list view ignores it. */
  position_x?: number;
  position_y?: number;
}

// ============================================================
// Per-node-type metadata used to render icons + colours everywhere
// the user sees a node summary. The user-visible label and blurb live
// in the message catalogue (`Flows.builder.nodes.<type>` /
// `Flows.builder.categories.<id>`), not here.
// ============================================================

// ------------------------------------------------------------
// Node categories — buckets the add-step menu groups types under so
// the picker stays scannable as the type list grows, and so a fork
// adding its own node types has an obvious place to slot them.
//
// Note there's no "Events / Triggers" category: in wacrm a flow is
// triggered by flow-level config (`trigger_type`), not by a node on
// the canvas, so `start` is just the entry point under Flow control.
// ------------------------------------------------------------

export type NodeCategory = 'messaging' | 'logic' | 'flow';

/** The order categories render in the add-step menu. */
export const NODE_CATEGORIES: NodeCategory[] = ['messaging', 'logic', 'flow'];

export const NODE_META: Record<
  NodeType,
  {
    /** English seed for the auto-generated node_key (`slugify(slugSeed)`).
     *  Deliberately NOT translated: node keys are stable identifiers that
     *  surface in analytics and the runner, so they must not change with
     *  the UI locale. */
    slugSeed: string;
    icon: typeof Workflow;
    color: string;
    category: NodeCategory;
  }
> = {
  start: {
    slugSeed: 'Start',
    icon: PlayCircle,
    color: 'text-emerald-400',
    category: 'flow',
  },
  send_message: {
    slugSeed: 'Send message',
    icon: MessageCircle,
    color: 'text-sky-400',
    category: 'messaging',
  },
  send_buttons: {
    slugSeed: 'Send buttons',
    icon: ListChecks,
    color: 'text-primary',
    category: 'messaging',
  },
  send_list: {
    slugSeed: 'Send list',
    icon: ListPlus,
    color: 'text-indigo-400',
    category: 'messaging',
  },
  send_media: {
    slugSeed: 'Send media',
    icon: Paperclip,
    color: 'text-cyan-400',
    category: 'messaging',
  },
  send_carousel: {
    slugSeed: 'Send carousel',
    icon: GalleryHorizontalEnd,
    color: 'text-amber-500',
    category: 'messaging',
  },
  send_location: {
    slugSeed: 'Send location',
    icon: MapPin,
    color: 'text-emerald-500',
    category: 'messaging',
  },
  send_contact: {
    slugSeed: 'Send contact',
    icon: Contact,
    color: 'text-indigo-500',
    category: 'messaging',
  },
  request_address: {
    slugSeed: 'Request address',
    icon: Truck,
    color: 'text-violet-500',
    category: 'messaging',
  },
  collect_input: {
    slugSeed: 'Collect input',
    icon: Inbox,
    color: 'text-teal-400',
    category: 'logic',
  },
  condition: {
    slugSeed: 'If / else',
    icon: GitFork,
    color: 'text-fuchsia-400',
    category: 'logic',
  },
  set_tag: {
    slugSeed: 'Tag contact',
    icon: Tag,
    color: 'text-pink-400',
    category: 'logic',
  },
  handoff: {
    slugSeed: 'Handoff to agent',
    icon: UserPlus,
    color: 'text-amber-400',
    category: 'flow',
  },
  end: {
    slugSeed: 'End',
    icon: Flag,
    color: 'text-muted-foreground',
    category: 'flow',
  },
  trigger: {
    slugSeed: 'Trigger',
    icon: Zap,
    color: 'text-purple-400',
    category: 'flow',
  },
  agent_handover: {
    slugSeed: 'Agent handover',
    icon: UserCheck,
    color: 'text-amber-400',
    category: 'flow',
  },
  add_to_group: {
    slugSeed: 'Add to group',
    icon: UserPlus,
    color: 'text-emerald-400',
    category: 'logic',
  },
  remove_from_group: {
    slugSeed: 'Remove from group',
    icon: UserMinus,
    color: 'text-rose-400',
    category: 'logic',
  },
  update_contact: {
    slugSeed: 'Update contact',
    icon: UserCheck,
    color: 'text-sky-400',
    category: 'logic',
  },
  assign_label: {
    slugSeed: 'Assign label',
    icon: Tag,
    color: 'text-pink-400',
    category: 'logic',
  },
  send_email: {
    slugSeed: 'Send email',
    icon: Mail,
    color: 'text-blue-400',
    category: 'messaging',
  },
  delay: {
    slugSeed: 'Delay',
    icon: Clock,
    color: 'text-amber-400',
    category: 'logic',
  },
  webhook: {
    slugSeed: 'Webhook',
    icon: Globe,
    color: 'text-violet-400',
    category: 'logic',
  },
  http_fetch: {
    slugSeed: 'Webhook',
    icon: Globe,
    color: 'text-violet-400',
    category: 'logic',
  },
  book_appointment: {
    slugSeed: 'Book appointment',
    icon: Calendar,
    color: 'text-teal-400',
    category: 'logic',
  },
  ai_response: {
    slugSeed: 'AI response',
    icon: Sparkles,
    color: 'text-purple-400',
    category: 'messaging',
  },
  whatsapp_payment: {
    slugSeed: 'WhatsApp payment',
    icon: CreditCard,
    color: 'text-emerald-400',
    category: 'messaging',
  },
  catalog: {
    slugSeed: 'Catalog',
    icon: ShoppingBag,
    color: 'text-amber-400',
    category: 'messaging',
  },
  input_flow: {
    slugSeed: 'Input flow',
    icon: Inbox,
    color: 'text-teal-400',
    category: 'messaging',
  },
  whatsapp_form: {
    slugSeed: 'WhatsApp form',
    icon: FileText,
    color: 'text-indigo-400',
    category: 'messaging',
  },
  create_deal: {
    slugSeed: 'Create deal',
    icon: Briefcase,
    color: 'text-emerald-400',
    category: 'logic',
  },
  close_conversation: {
    slugSeed: 'Close conversation',
    icon: CheckCircle2,
    color: 'text-muted-foreground',
    category: 'flow',
  },
};

/**
 * Bucket an ordered list of node types by category, preserving both
 * the category order (NODE_CATEGORIES) and the within-category order
 * of the input list. Empty categories are dropped. Used by both the
 * canvas and list add-step menus so they stay in lockstep.
 */
export function groupNodeTypesByCategory(
  types: NodeType[]
): { id: NodeCategory; types: NodeType[] }[] {
  return NODE_CATEGORIES.map((id) => ({
    id,
    types: types.filter((t) => NODE_META[t].category === id),
  })).filter((group) => group.types.length > 0);
}

// ============================================================
// Per-node-type color system.
//
// Each node type gets its own hue so the canvas reads at a glance —
// what KIND of step is this. Kept as raw oklch (not Tailwind classes)
// so a node card can tint its icon chip, type label, selection ring,
// and edge ports from one source, the way the Flow Builder design
// handoff does. Hues sit in the same oklch family as the app tokens
// in globals.css; they don't replace --primary (the accent), they
// complement it. `nodeColors()` derives the soft/ring/text variants.
// ============================================================

const NODE_HUE: Record<NodeType, { l: number; c: number; h: number }> = {
  start: { l: 0.62, c: 0.13, h: 162 }, // emerald — the start, echoes WhatsApp green
  send_message: { l: 0.6, c: 0.18, h: 293 }, // violet — the workhorse
  send_buttons: { l: 0.62, c: 0.16, h: 254 }, // cobalt
  send_list: { l: 0.62, c: 0.15, h: 277 }, // indigo
  send_media: { l: 0.65, c: 0.12, h: 210 }, // sky
  send_carousel: { l: 0.68, c: 0.16, h: 48 }, // amber - carousel cards
  send_location: { l: 0.65, c: 0.16, h: 150 }, // emerald - location
  send_contact: { l: 0.62, c: 0.16, h: 260 }, // indigo - contact
  request_address: { l: 0.64, c: 0.18, h: 285 }, // violet - address request
  collect_input: { l: 0.65, c: 0.1, h: 185 }, // teal — capture
  condition: { l: 0.72, c: 0.15, h: 65 }, // amber — a fork in the road
  set_tag: { l: 0.65, c: 0.15, h: 350 }, // pink
  handoff: { l: 0.65, c: 0.17, h: 16 }, // rose — hands off
  end: { l: 0.55, c: 0.01, h: 260 }, // neutral grey — terminal
  trigger: { l: 0.55, c: 0.22, h: 270 },
  agent_handover: { l: 0.62, c: 0.18, h: 30 },
  add_to_group: { l: 0.60, c: 0.16, h: 160 },
  remove_from_group: { l: 0.60, c: 0.18, h: 25 },
  update_contact: { l: 0.60, c: 0.18, h: 240 },
  assign_label: { l: 0.65, c: 0.15, h: 350 },
  send_email: { l: 0.60, c: 0.18, h: 220 },
  delay: { l: 0.65, c: 0.14, h: 70 },
  webhook: { l: 0.58, c: 0.20, h: 290 },
  http_fetch: { l: 0.58, c: 0.20, h: 290 },
  book_appointment: { l: 0.62, c: 0.16, h: 170 },
  ai_response: { l: 0.58, c: 0.22, h: 305 },
  whatsapp_payment: { l: 0.62, c: 0.18, h: 140 },
  catalog: { l: 0.64, c: 0.16, h: 60 },
  input_flow: { l: 0.65, c: 0.12, h: 185 },
  whatsapp_form: { l: 0.62, c: 0.16, h: 260 },
  create_deal: { l: 0.62, c: 0.16, h: 160 },
  close_conversation: { l: 0.55, c: 0.12, h: 150 },
};

export interface NodeColors {
  /** Full-strength hue — icon glyph, selection ring, port fill. */
  solid: string;
  /** ~14% tint — icon chip background, soft fills. */
  soft: string;
  /** ~45% tint — hover border / focus ring. */
  ring: string;
  /** Hue for the uppercase type label, kept readable in BOTH modes. */
  text: string;
}

export function nodeColors(type: NodeType): NodeColors {
  const t = NODE_HUE[type];
  const solid = `oklch(${t.l} ${t.c} ${t.h})`;
  return {
    solid,
    soft: `oklch(${t.l} ${t.c} ${t.h} / 0.14)`,
    ring: `oklch(${t.l} ${t.c} ${t.h} / 0.45)`,
    // Blend the hue toward the live --foreground token so the label
    // holds contrast in BOTH modes: in dark mode --foreground is
    // near-white (the label lightens to read on the dark card), in
    // light mode it's near-black (the label darkens to read on the
    // white card). The old fixed-light value only worked on dark.
    text: `color-mix(in oklch, ${solid}, var(--foreground) 38%)`,
  };
}

// ============================================================
// Shared node icon chip — the per-type colored glyph badge used in
// the canvas node card, list-view card, inspector header, and the
// add-step menu. One component so a styling change (radius, contrast,
// hover) lands in every place at once and the `nodeColors()` lookup
// lives in exactly one spot.
// ============================================================

export function NodeIconChip({
  type,
  size = 24,
  iconSize = 14,
  className,
}: {
  type: NodeType;
  /** Chip side length in px. */
  size?: number;
  /** Glyph side length in px. */
  iconSize?: number;
  className?: string;
}) {
  const meta = NODE_META[type];
  const c = nodeColors(type);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        className
      )}
      style={{ width: size, height: size, background: c.soft, color: c.solid }}
    >
      <Icon size={iconSize} />
    </span>
  );
}

// ============================================================
// Pure editing helpers — used by forms in both views.
// ============================================================

/**
 * Coerce an arbitrary string into a stable identifier (node_key,
 * reply_id, etc.). Lowercases, collapses non-alphanumerics into
 * single underscores, and trims leading/trailing underscores. Falls
 * back to `fallback` for inputs that reduce to an empty string.
 */
export function slugify(s: string, fallback: string): string {
  const cleaned = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

// ============================================================
// Summary helpers — short, single-line content previews used in
// collapsed node cards (list view) and node tiles (canvas view).
// Returns null when there's nothing meaningful to show (start/end,
// or a freshly-added node with no fields filled in).
// ============================================================

export function truncate(s: string, max = 80): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + '…';
}

export function summarizeNode(
  node: BuilderNode,
  t?: (key: string, values?: Record<string, string | number>) => string
): string | null {
  const cfg = node.config;
  switch (node.node_type) {
    case 'start':
    case 'end':
      return null;
    case 'send_message': {
      const text = typeof cfg.text === 'string' ? cfg.text : '';
      return text.length > 0 ? truncate(text) : null;
    }
    case 'send_buttons': {
      const text = typeof cfg.text === 'string' ? cfg.text : '';
      const buttons = Array.isArray(cfg.buttons)
        ? (cfg.buttons as Array<Record<string, unknown>>)
        : [];
      const titles = buttons
        .map((b) => (typeof b.title === 'string' ? b.title : ''))
        .filter(Boolean)
        .join(' / ');
      if (text.length > 0) {
        return titles
          ? `${truncate(text, 40)} · ${truncate(titles, 35)}`
          : truncate(text);
      }
      return titles || null;
    }
    case 'send_list': {
      const text = typeof cfg.text === 'string' ? cfg.text : '';
      const sections = Array.isArray(cfg.sections)
        ? (cfg.sections as Array<Record<string, unknown>>)
        : [];
      const rowCount = sections.reduce<number>((sum, s) => {
        const rows = Array.isArray(s.rows) ? s.rows : [];
        return sum + rows.length;
      }, 0);
      if (text.length > 0) {
        return rowCount > 0
          ? `${truncate(text, 50)} · ${t ? t('options', { count: rowCount }) : `${rowCount} option${rowCount === 1 ? '' : 's'}`}`
          : truncate(text);
      }
      return rowCount > 0
        ? t
          ? t('optionsAcrossSections', { rowCount, sectionCount: sections.length })
          : `${rowCount} option${rowCount === 1 ? '' : 's'} across ${sections.length} section${sections.length === 1 ? '' : 's'}`
        : null;
    }
    case 'send_media': {
      const mediaType =
        typeof cfg.media_type === 'string' ? cfg.media_type : '';
      const filename = typeof cfg.filename === 'string' ? cfg.filename : '';
      const url = typeof cfg.media_url === 'string' ? cfg.media_url : '';
      const caption = typeof cfg.caption === 'string' ? cfg.caption : '';
      const label = mediaType
        ? t ? t(mediaType) || (mediaType.charAt(0).toUpperCase() + mediaType.slice(1)) : mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
        : t ? t('media') : 'Media';
      if (!url) return t ? t('noFile', { label }) : `${label} (no file uploaded)`;
      const name = filename || url.split('/').pop() || 'file';
      return caption
        ? `${label}: ${truncate(name, 30)} · ${truncate(caption, 40)}`
        : `${label}: ${truncate(name, 60)}`;
    }
    case 'send_carousel': {
      const text = typeof cfg.text === 'string' ? cfg.text : '';
      const cards = Array.isArray(cfg.cards)
        ? (cfg.cards as Array<Record<string, unknown>>)
        : [];
      const cardCount = cards.length;
      if (text.length > 0) {
        return cardCount > 0
          ? `${truncate(text, 40)} · ${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`
          : truncate(text);
      }
      return cardCount > 0 ? `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}` : null;
    }
    case 'send_location': {
      const name = typeof cfg.name === 'string' ? cfg.name : '';
      const address = typeof cfg.address === 'string' ? cfg.address : '';
      const lat = cfg.latitude !== undefined && cfg.latitude !== null ? `${cfg.latitude}` : '';
      const lng = cfg.longitude !== undefined && cfg.longitude !== null ? `${cfg.longitude}` : '';
      if (name) return address ? `${truncate(name, 30)} · ${truncate(address, 40)}` : truncate(name);
      if (address) return truncate(address);
      if (lat && lng) return `${lat}, ${lng}`;
      return null;
    }
    case 'send_contact': {
      const name = typeof cfg.formatted_name === 'string' ? cfg.formatted_name : '';
      const phone = typeof cfg.phone === 'string' ? cfg.phone : '';
      if (name) return phone ? `${truncate(name, 30)} (${phone})` : truncate(name);
      return phone || null;
    }
    case 'request_address': {
      const text = typeof cfg.text === 'string' ? cfg.text : '';
      const country = typeof cfg.country === 'string' ? cfg.country : '';
      if (text) return country ? `${truncate(text, 40)} · ${country}` : truncate(text);
      return country || null;
    }
    case 'collect_input': {
      const prompt = typeof cfg.prompt_text === 'string' ? cfg.prompt_text : '';
      const varKey = typeof cfg.var_key === 'string' ? cfg.var_key : '';
      if (prompt.length > 0) {
        return varKey
          ? `${truncate(prompt, 50)} → vars.${varKey}`
          : truncate(prompt);
      }
      return varKey ? `→ vars.${varKey}` : null;
    }
    case 'condition': {
      const subjectKey =
        typeof cfg.subject_key === 'string' ? cfg.subject_key : '';
      if (!subjectKey) return null;
      const subject =
        cfg.subject === 'tag'
          ? 'tag'
          : cfg.subject === 'contact_field'
            ? 'field'
            : 'var';
      const subjectStr =
        subject === 'tag'
          ? t ? t('hasTag', { tag: truncate(subjectKey, 24) }) : `has tag ${truncate(subjectKey, 24)}`
          : `${subject}.${subjectKey}`;
      const op =
        cfg.operator === 'equals'
          ? '=='
          : cfg.operator === 'contains'
            ? t ? t('opContains') : 'contains'
            : cfg.operator === 'present'
              ? t ? t('opExists') : 'exists'
              : cfg.operator === 'absent'
                ? t ? t('opMissing') : 'missing'
                : '';
      const value = typeof cfg.value === 'string' ? cfg.value : '';
      const valStr =
        (cfg.operator === 'equals' || cfg.operator === 'contains') && value
          ? ` "${truncate(value, 20)}"`
          : '';
      return subject === 'tag' ? subjectStr : `${subjectStr} ${op}${valStr}`;
    }
    case 'set_tag': {
      const mode = cfg.mode === 'remove' ? (t ? t('modeRemove') : 'Remove') : (t ? t('modeAdd') : 'Add');
      const tagId = typeof cfg.tag_id === 'string' ? cfg.tag_id : '';
      // No tag name available without an async lookup here; show a
      // short prefix of the UUID so users can disambiguate between
      // multiple set_tag nodes at a glance.
      return tagId
        ? t ? t('tagPicked', { mode, tag: tagId.slice(0, 8) }) : `${mode} tag ${tagId.slice(0, 8)}…`
        : t ? t('tagNone', { mode }) : `${mode} tag (none picked)`;
    }
    case 'handoff':
    case 'agent_handover': {
      const note = typeof cfg.note === 'string' ? cfg.note : '';
      return note.length > 0 ? truncate(note) : 'Handover to human agent';
    }
    case 'trigger': {
      const step = cfg.starting_step === 'new_contact' ? 'New contact' : 'Keyword match';
      return `Starting: ${step}`;
    }
    case 'ai_response': {
      const prompt = typeof cfg.prompt === 'string' ? cfg.prompt : '';
      const cond = cfg.proceed_condition === 'always' ? 'Always proceed' : 'Wait for confidence';
      return prompt ? `${truncate(prompt, 40)} · ${cond}` : cond;
    }
    case 'send_email': {
      const subject = typeof cfg.subject === 'string' ? cfg.subject : '';
      return subject ? `Email: ${truncate(subject, 40)}` : 'Send email';
    }
    case 'delay': {
      const amt = cfg.amount ?? 5;
      const unit = cfg.unit ?? 'minutes';
      return `Wait ${amt} ${unit}`;
    }
    case 'webhook':
    case 'http_fetch': {
      const url = typeof cfg.url === 'string' ? cfg.url : '';
      const method = typeof cfg.method === 'string' ? cfg.method : 'POST';
      return url ? `${method} ${truncate(url, 40)}` : 'Send HTTP webhook';
    }
    case 'update_contact': {
      const field = typeof cfg.field === 'string' ? cfg.field : 'field';
      const val = typeof cfg.value === 'string' ? cfg.value : '';
      return `Set ${field} = ${truncate(val, 30)}`;
    }
    case 'assign_label': {
      const mode = cfg.mode === 'remove' ? 'Remove' : 'Add';
      const tagId = typeof cfg.tag_id === 'string' ? cfg.tag_id : '';
      return tagId ? `${mode} label ${tagId.slice(0, 8)}…` : `${mode} label`;
    }
    case 'create_deal': {
      const title = typeof cfg.title === 'string' ? cfg.title : 'New deal';
      return `Deal: ${truncate(title, 35)}`;
    }
    case 'whatsapp_payment': {
      const amt = cfg.amount ?? 0;
      const curr = cfg.currency ?? 'INR';
      return `Request payment: ${amt} ${curr}`;
    }
    case 'catalog': {
      const body = typeof cfg.body_text === 'string' ? cfg.body_text : '';
      return body ? truncate(body, 40) : 'Catalog product message';
    }
    case 'input_flow': {
      const p = typeof cfg.prompt_text === 'string' ? cfg.prompt_text : '';
      const v = typeof cfg.var_key === 'string' ? cfg.var_key : 'val';
      return p ? `${truncate(p, 40)} → vars.${v}` : `Capture → vars.${v}`;
    }
    case 'whatsapp_form': {
      return 'WhatsApp Flow Form';
    }
    case 'book_appointment': {
      const url = typeof cfg.booking_url === 'string' ? cfg.booking_url : '';
      return url ? `Booking: ${truncate(url, 35)}` : 'Schedule appointment';
    }
    case 'add_to_group': {
      return 'Add to contact group';
    }
    case 'remove_from_group': {
      return 'Remove from contact group';
    }
    case 'close_conversation': {
      return 'Close conversation';
    }
    default:
      return null;
  }
}
