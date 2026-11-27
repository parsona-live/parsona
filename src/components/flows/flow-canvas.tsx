import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Node as RfNode,
  type Edge as RfEdge,
  type NodeChange,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  X,
  Plus,
  Trash2,
  Eye,
  Check,
  MapPin,
  User,
  Truck,
  GalleryHorizontalEnd,
  ListChecks,
  FileText,
  Tag,
  Video,
  Image as ImageIcon,
  ChevronDown,
  Zap,
  Clock,
  Mail,
  Sparkles,
  CreditCard,
  Briefcase,
  Globe,
  Flag,
  CheckCircle2,
  Copy,
  Hand,
  MousePointer2,
} from 'lucide-react';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  applyEdgeConnection,
  deriveCanvasEdges,
  outgoingSlots,
} from '@/lib/flows/edges';
import { NODE_REGISTRY } from '@/lib/flows/node-registry';
import { autoLayout, shouldAutoLayout } from '@/lib/flows/layout';
import {
  NODE_META,
  NodeIconChip,
  groupNodeTypesByCategory,
  nodeColors,
  summarizeNode,
  type BuilderNode,
  type NodeType,
} from './shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFlowEditor } from './flow-editor-state';
import { NodeConfigForm } from './forms/node-config-form';
import { ChannelIcon } from '@/components/channels/channel-badge';

// React-Flow node `data` payload — the bits our custom renderer needs.
interface NodeData extends Record<string, unknown> {
  node: BuilderNode;
  isEntry: boolean;
  /** Validator's "look here" pulse — flashes the card border for
   *  ~1.6s. Drives a CSS animation, doesn't change layout. */
  isFlashed: boolean;
  onDeleteNode?: (key: string) => void;
  onDuplicateNode?: (key: string) => void;
  onTestNode?: (node: BuilderNode) => void;
  onUpdateNodeConfig?: (key: string, patch: Record<string, unknown>) => void;
  onUpdateTrigger?: (
    triggerType: 'keyword' | 'first_inbound_message' | 'manual' | 'ai_intent',
    triggerConfig: Record<string, unknown>,
  ) => void;
}

const NODE_WIDTH = 260;
// Best-effort default; actual height varies by summary length but
// dagre needs SOMETHING to compute rank spacing. Underestimating is
// safer than over (tighter layout that still doesn't overlap).
const NODE_HEIGHT = 110;

// ============================================================
// Custom node — one card per flow node. Deliberately neutral:
// white surface, hairline border, a single accent for selection.
// The only per-type color is the small icon chip in the header.
// ============================================================

// Echo green/red branch ports for the condition node's true / false
// slots; every other slot stays neutral. Derived from the start
// (emerald) and handoff (rose) node colors so branch colors stay
// single-sourced in NODE_HUE.
function slotColor(nodeType: NodeType, slotId: string, fallback: string) {
  if (nodeType === 'condition' && slotId === 'true') {
    return nodeColors('start').solid;
  }
  if (nodeType === 'condition' && slotId === 'false') {
    return nodeColors('handoff').solid;
  }
  return fallback;
}

const HANDLE_BASE = '!h-2.5 !w-2.5 !border-[1.5px] !bg-white !border-slate-400';

const VERTICAL_ACTION_NODES = new Set<string>([
  'input_flow',
  'collect_input',
  'send_email',
  'book_appointment',
  'end',
  'agent_handover',
  'handoff',
  'webhook',
  'http_fetch',
  'delay',
]);

/** Muted placeholder for empty fields. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="text-slate-400 italic">{children}</span>;
}

/** Small "icon + text" line used by the compact body variants. */
function IconLine({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="text-slate-500 flex items-center gap-1.5 text-[11px]">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-slate-100 text-slate-600 w-fit rounded px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </span>
  );
}

function BodyText({ children, lines = 3 }: { children: React.ReactNode; lines?: 2 | 3 | 4 }) {
  return (
    <p
      className={cn(
        'text-slate-700 text-xs leading-relaxed whitespace-pre-wrap',
        lines === 2 && 'line-clamp-2',
        lines === 3 && 'line-clamp-3',
        lines === 4 && 'line-clamp-4'
      )}
    >
      {children}
    </p>
  );
}

function NodeBodyVisual({ node }: { node: BuilderNode }) {
  const cfg = (node.config ?? {}) as Record<string, any>;
  const headerType = cfg.header_type;
  const headerMediaUrl = cfg.header_media_url;
  const headerText = cfg.header_text;
  const headerFilename = cfg.header_filename;

  // Optional header (image / video / document / text) shared by the
  // message-like nodes. Kept to a single quiet line, or a short
  // thumbnail for images.
  const renderHeader = () => {
    if (!headerType || headerType === 'none') return null;

    if (headerType === 'image' && headerMediaUrl) {
      return (
        <img
          src={headerMediaUrl}
          alt=""
          className="bg-slate-100 max-h-28 w-full rounded-md object-cover"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    if (headerType === 'video' && headerMediaUrl) {
      return <IconLine icon={Video}>Video header</IconLine>;
    }
    if (headerType === 'document') {
      return <IconLine icon={FileText}>{headerFilename || 'Document.pdf'}</IconLine>;
    }
    if (headerType === 'text' && headerText) {
      return <p className="text-slate-900 text-xs font-semibold">{headerText}</p>;
    }
    return null;
  };

  switch (node.node_type) {
    case 'send_message': {
      const isPrompt = cfg.text_mode === 'prompt' && cfg.prompt;
      const text = isPrompt ? `✨ Prompt: ${cfg.prompt}` : ((cfg.text as string) || '');
      return (
        <>
          {renderHeader()}
          {isPrompt && (
            <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI Generated
            </span>
          )}
          <BodyText lines={4}>{text || <Placeholder>Empty message text…</Placeholder>}</BodyText>
        </>
      );
    }

    case 'send_media': {
      const mediaUrl = (cfg.media_url as string) || '';
      const mediaType = (cfg.media_type as string) || 'image';
      const caption = (cfg.caption as string) || '';
      return (
        <>
          {!mediaUrl ? (
            <IconLine icon={ImageIcon}>
              <Placeholder>No media URL set</Placeholder>
            </IconLine>
          ) : mediaType === 'image' ? (
            <img
              src={mediaUrl}
              alt=""
              className="bg-slate-100 max-h-28 w-full rounded-md object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <IconLine icon={FileText}>
              <span className="uppercase">{mediaType}</span>
            </IconLine>
          )}
          {caption && <BodyText lines={2}>{caption}</BodyText>}
        </>
      );
    }

    case 'send_location': {
      const name = (cfg.name as string) || 'Location pin';
      const address = (cfg.address as string) || '';
      const lat = cfg.latitude;
      const lng = cfg.longitude;
      return (
        <>
          <IconLine icon={MapPin}>
            <span className="text-slate-900 font-medium">{name}</span>
          </IconLine>
          {address && <BodyText lines={2}>{address}</BodyText>}
          {lat !== undefined && lng !== undefined && (
            <Chip>
              {lat}, {lng}
            </Chip>
          )}
        </>
      );
    }

    case 'send_contact': {
      const formatted_name = (cfg.formatted_name as string) || 'Contact card';
      const phones = Array.isArray(cfg.phones) ? (cfg.phones as Array<{ phone: string }>) : [];
      const phone = (cfg.phone as string) || phones[0]?.phone || '';
      return (
        <>
          <IconLine icon={User}>
            <span className="text-slate-900 font-medium">{formatted_name}</span>
          </IconLine>
          {phone && <Chip>{phone}</Chip>}
        </>
      );
    }

    case 'request_address': {
      const body = (cfg.body_text as string) || 'Provide delivery address';
      const country = (cfg.country as string) || 'IN';
      return (
        <>
          <BodyText lines={2}>{body}</BodyText>
          <div className="flex items-center gap-1.5">
            <Truck className="text-slate-400 h-3.5 w-3.5" />
            <Chip>{country}</Chip>
          </div>
        </>
      );
    }

    case 'send_carousel': {
      const body = (cfg.text as string) || (cfg.body_text as string) || '';
      const cards = Array.isArray(cfg.cards)
        ? (cfg.cards as Array<{
            title?: string;
            body_text?: string;
            buttons?: Array<{ title?: string }>;
          }>)
        : [];
      return (
        <div className="space-y-1.5">
          {body && <BodyText lines={2}>{body}</BodyText>}
          <IconLine icon={GalleryHorizontalEnd}>
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </IconLine>
          {cards.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {cards.slice(0, 3).map((card, cIdx) => {
                const titleLine =
                  card.title?.trim() ||
                  (card.body_text || '')
                    .split(/\r?\n/)
                    .map((l) => l.trim())
                    .find(Boolean) ||
                  `Card ${cIdx + 1}`;
                const btnTitles = (card.buttons || [])
                  .map((b) => b.title?.trim())
                  .filter(Boolean);
                return (
                  <div
                    key={cIdx}
                    className="rounded-md border border-slate-200/80 bg-slate-50/70 px-2 py-1 text-[10px]"
                  >
                    <p className="font-semibold text-slate-800 truncate">{titleLine}</p>
                    {btnTitles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {btnTitles.map((bt, bIdx) => (
                          <span
                            key={bIdx}
                            className="rounded bg-white border border-slate-200 px-1 py-0.2 text-[9px] text-slate-600"
                          >
                            {bt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {cards.length > 3 && (
                <p className="text-[10px] text-slate-400">+{cards.length - 3} more cards</p>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'send_buttons': {
      // Button rows render below the body as handle slots.
      const isPrompt = cfg.text_mode === 'prompt' && cfg.prompt;
      const text = isPrompt
        ? `✨ Prompt: ${cfg.prompt}`
        : ((cfg.text as string) || (cfg.body_text as string) || '');
      const footer = (cfg.footer_text as string) || '';
      return (
        <>
          {renderHeader()}
          {isPrompt && (
            <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI Generated
            </span>
          )}
          <BodyText>{text || <Placeholder>Select an option below</Placeholder>}</BodyText>
          {footer && (
            <p className="text-[10px] text-slate-400 italic truncate">{footer}</p>
          )}
        </>
      );
    }

    case 'send_list': {
      const body = (cfg.text as string) || (cfg.body_text as string) || '';
      const label = (cfg.button_label as string) || 'View options';
      const sections = Array.isArray(cfg.sections)
        ? (cfg.sections as Array<{ title?: string; rows?: Array<{ title?: string }> }>)
        : [];
      const rowTitles = sections.flatMap((s) => (s.rows || []).map((r) => r.title).filter(Boolean));
      return (
        <>
          {renderHeader()}
          <BodyText>{body || <Placeholder>Select from list</Placeholder>}</BodyText>
          <IconLine icon={ListChecks}>
            {label} ({rowTitles.length} {rowTitles.length === 1 ? 'option' : 'options'})
          </IconLine>
          {rowTitles.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {rowTitles.slice(0, 4).map((rt, idx) => (
                <Chip key={idx}>{rt}</Chip>
              ))}
              {rowTitles.length > 4 && <Chip>+{rowTitles.length - 4}</Chip>}
            </div>
          )}
        </>
      );
    }

    case 'collect_input':
    case 'input_flow': {
      const isPrompt = cfg.text_mode === 'prompt' && cfg.prompt;
      const prompt = isPrompt
        ? `✨ Prompt: ${cfg.prompt}`
        : ((cfg.prompt_text as string) || (cfg.text as string) || (cfg.prompt as string) || (cfg.message as string) || '');
      const varKey = (cfg.var_key as string) || (cfg.variable_name as string) || (cfg.variable as string) || 'input';
      const validation = (cfg.validation as string) || (cfg.input_type as string) || 'any';
      const contextBehavior =
        (cfg.context_behavior as string) || (cfg.skip_if_known === false ? 'ask_always' : 'skip_if_known');
      const contextLabel =
        contextBehavior === 'ask_always'
          ? 'Always ask'
          : contextBehavior === 'confirm_if_known'
            ? 'Confirm if known'
            : 'Skip if known';
      return (
        <>
          {isPrompt && (
            <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI Prompt Question
            </span>
          )}
          <BodyText lines={3}>{prompt || <Placeholder>Please enter your response…</Placeholder>}</BodyText>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <Chip>&#123;&#123;vars.{varKey}&#125;&#125;</Chip>
            {validation !== 'any' && <Chip>{validation}</Chip>}
            <span className="rounded bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
              {contextLabel}
            </span>
          </div>
        </>
      );
    }

    case 'condition': {
      const key = (cfg.subject_key as string) || (cfg.variable_name as string) || (cfg.variable as string) || (cfg.var_key as string) || 'var';
      const op = (cfg.operator as string) || 'equals';
      const val = (cfg.value !== undefined ? cfg.value : cfg.compare_value) ?? '';
      return (
        <p className="text-slate-800 font-mono text-[11px] leading-relaxed">
          <span className="text-slate-500">if </span>
          &#123;&#123;{key}&#125;&#125;{' '}
          <span className="text-slate-500">{op}</span>
          {val !== '' && <> &quot;{val}&quot;</>}
        </p>
      );
    }

    case 'set_tag': {
      const tag = (cfg.tag_name as string) || (cfg.tag_id as string)?.slice(0, 8) || 'tag';
      const action = (cfg.action as string) || (cfg.mode as string) || 'add';
      return (
        <IconLine icon={Tag}>
          {action === 'remove' ? 'Remove' : 'Add'} #{tag}
        </IconLine>
      );
    }

    case 'assign_label': {
      const tag = (cfg.tag_id as string)?.slice(0, 8) || 'label';
      const mode = (cfg.mode as string) === 'remove' ? 'Remove' : 'Add';
      return (
        <IconLine icon={Tag}>
          {mode} #{tag}
        </IconLine>
      );
    }

    case 'ai_response': {
      const prompt = (cfg.prompt as string) || '';
      const cond = cfg.proceed_condition === 'always' ? 'Always proceed' : 'Wait for confidence';
      return (
        <>
          <IconLine icon={Sparkles}>{cond}</IconLine>
          {prompt && <BodyText lines={2}>{prompt}</BodyText>}
        </>
      );
    }

    case 'ai_message': {
      const mode = (cfg.mode as string) || 'generated';
      const prompt = (cfg.prompt as string) || '';
      const staticText = (cfg.static_text as string) || '';
      const fallback = (cfg.fallback_text as string) || '';
      return (
        <>
          <IconLine icon={Sparkles}>
            {mode === 'generated' ? 'Context-Aware AI Generation' : 'Static AI Fallback'}
          </IconLine>
          {mode === 'generated' ? (
            prompt ? (
              <BodyText lines={3}>{prompt}</BodyText>
            ) : (
              <Placeholder>No prompt specified…</Placeholder>
            )
          ) : (
            <BodyText lines={2}>{staticText || <Placeholder>No text…</Placeholder>}</BodyText>
          )}
          {fallback && (
            <p className="text-[10px] text-slate-400 truncate">Fallback: {fallback}</p>
          )}
        </>
      );
    }

    case 'ai_extract': {
      const fields = Array.isArray(cfg.fields) ? (cfg.fields as Array<{ name: string; type?: string; required?: boolean }>) : [];
      const instructions = (cfg.extraction_instructions as string) || '';
      return (
        <div className="space-y-1.5">
          {instructions && <BodyText lines={2}>{instructions}</BodyText>}
          <div className="flex flex-wrap gap-1 pt-1">
            {fields.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300"
              >
                <span>{f.name}</span>
                {f.required !== false && <span className="text-amber-500 font-bold">*</span>}
              </span>
            ))}
            {fields.length === 0 && <Placeholder>No fields configured</Placeholder>}
          </div>
        </div>
      );
    }

    case 'ai_decision': {
      const prompt = (cfg.prompt as string) || (cfg.decision_prompt as string) || (cfg.instruction as string) || '';
      const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
      return (
        <>
          <IconLine icon={Sparkles}>Semantic Decision Router</IconLine>
          {prompt ? (
            <BodyText lines={3}>{prompt}</BodyText>
          ) : (
            <Placeholder>Describe classification criteria…</Placeholder>
          )}
          {branches.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {branches.map((b: any, bIdx: number) => {
                const label = b.label || b.description || b.name || b.branch_key || b.key || `Branch ${bIdx + 1}`;
                return (
                  <span
                    key={bIdx}
                    className="inline-flex items-center rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 px-1.5 py-0.5 text-[9px] font-medium text-purple-700 dark:text-purple-300"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </>
      );
    }

    case 'ai_summarize': {
      const targetVar = (cfg.target_var as string) || 'summary';
      const focus = (cfg.focus as string) || 'all';
      return (
        <>
          <IconLine icon={FileText}>Focus: {focus}</IconLine>
          <Chip>&#123;&#123;vars.{targetVar}&#125;&#125;</Chip>
        </>
      );
    }

    case 'send_email': {
      const subject = (cfg.subject as string) || '';
      const toEmail = (cfg.to_email as string) || '';
      return (
        <div className="space-y-1">
          <IconLine icon={Mail}>
            {subject ? `Subject: ${subject}` : 'Configure email'}
          </IconLine>
          {toEmail && <Chip>To: {toEmail}</Chip>}
        </div>
      );
    }

    case 'trigger_flow': {
      const target =
        (cfg.target_flow_name as string) ||
        (cfg.target_flow_id as string) ||
        '';
      const passVars = (cfg.pass_vars as Record<string, string>) || {};
      const entries = Object.entries(passVars);
      return (
        <div className="space-y-1.5">
          <IconLine icon={Zap}>
            {target ? `→ ${target}` : 'Select target flow…'}
          </IconLine>
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entries.slice(0, 3).map(([k, v], i) => (
                <Chip key={i}>
                  {k}={v}
                </Chip>
              ))}
            </div>
          )}
          {Boolean(cfg.pass_all_vars) && (
            <span className="text-[10px] text-purple-600 font-medium block">
              Forwards all flow variables
            </span>
          )}
        </div>
      );
    }

    case 'delay': {
      const amt = cfg.amount ?? 5;
      const unit = (cfg.unit as string) || 'minutes';
      return (
        <IconLine icon={Clock}>
          Wait {amt} {unit}
        </IconLine>
      );
    }

    case 'webhook':
    case 'http_fetch': {
      const url = (cfg.url as string) || '';
      const method = (cfg.method as string) || 'POST';
      return (
        <IconLine icon={Globe}>
          {method} {url || 'Configure URL'}
        </IconLine>
      );
    }

    case 'update_contact': {
      const field = (cfg.field as string) || 'field';
      const val = (cfg.value as string) || '';
      return (
        <IconLine icon={User}>
          Set {field} {val ? `= "${val}"` : ''}
        </IconLine>
      );
    }

    case 'create_deal': {
      const title = (cfg.title as string) || 'New Deal';
      const val = cfg.value ? `$${cfg.value}` : '';
      return (
        <IconLine icon={Briefcase}>
          {title} {val}
        </IconLine>
      );
    }

    case 'whatsapp_payment': {
      const amt = cfg.amount ?? 0;
      const curr = (cfg.currency as string) || 'INR';
      const isWait = Boolean(cfg.wait_for_payment);
      return (
        <div className="space-y-1">
          <IconLine icon={CreditCard}>
            Request {amt} {curr}
          </IconLine>
          {isWait && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
              ⏳ Waits for payment webhook
            </span>
          )}
        </div>
      );
    }

    case 'handoff':
    case 'agent_handover': {
      const agentName = (cfg.agent_name as string) || (cfg.assign_to as string) || '';
      const agentEmail = (cfg.agent_email as string) || '';
      const msg = (cfg.message as string) || (cfg.note as string) || 'Default message';
      const hasAgent = Boolean(cfg.assign_to);

      return (
        <div className="space-y-1.5 text-xs py-0.5">
          {hasAgent ? (
            <p className="text-slate-700 font-medium truncate">
              Assign to: {agentName} {agentEmail ? `(${agentEmail})` : ''}
            </p>
          ) : (
            <p className="text-amber-600 font-medium flex items-center gap-1">
              <span>⚠️ No agent selected</span>
            </p>
          )}
          <p className="text-slate-500 line-clamp-2">
            Message: {msg}
          </p>
          <p className="text-amber-600 font-semibold text-[11px]">
            Flow ends here
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
            <span className="text-slate-400">Action</span>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium text-[10px]">
              Active
            </span>
          </div>
        </div>
      );
    }

    case 'end': {
      return (
        <div className="flex items-center gap-2 text-xs text-rose-600 font-medium py-1">
          <Flag className="h-4 w-4 text-rose-500 shrink-0" />
          <span>Workflow concludes here</span>
        </div>
      );
    }

    case 'close_conversation': {
      return (
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium py-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Resolve & close chat</span>
        </div>
      );
    }

    default:
      return null;
  }
}

function TriggerNodeCard({
  node,
  selected,
  isFlashed,
  onDeleteNode,
  onUpdateNodeConfig,
  onUpdateTrigger,
}: {
  node: BuilderNode;
  selected?: boolean;
  isFlashed?: boolean;
  onDeleteNode?: (key: string) => void;
  onUpdateNodeConfig?: (key: string, patch: Record<string, unknown>) => void;
  onUpdateTrigger?: (
    triggerType: 'keyword' | 'first_inbound_message' | 'manual' | 'ai_intent',
    triggerConfig: Record<string, unknown>,
  ) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { state, setState } = useFlowEditor();
  const currentChannels = state.channels || ['whatsapp', 'instagram', 'facebook'];
  const cfg = (node.config ?? {}) as Record<string, any>;
  const startingStep = cfg.starting_step || (state.trigger_type === 'ai_intent' ? 'ai_intent' : 'new_contact');
  const keywordsList: string[] = Array.isArray(cfg.keywords) ? cfg.keywords : [];
  const [keywordText, setKeywordText] = useState(() => keywordsList.join(', '));

  useEffect(() => {
    setKeywordText(keywordsList.join(', '));
  }, [cfg.keywords]);

  const selectStartingStep = (step: 'new_contact' | 'keyword' | 'contact_from_ad' | 'ai_intent') => {
    setDropdownOpen(false);
    if (step === 'new_contact') {
      onUpdateNodeConfig?.(node.node_key, { starting_step: 'new_contact' });
      onUpdateTrigger?.('first_inbound_message', {});
      setState((s) => ({ ...s, trigger_type: 'first_inbound_message', trigger_config: {} }));
    } else if (step === 'keyword') {
      const parsed = keywordText ? keywordText.split(',').map((s) => s.trim()).filter(Boolean) : keywordsList;
      onUpdateNodeConfig?.(node.node_key, { starting_step: 'keyword', keywords: parsed });
      onUpdateTrigger?.('keyword', { keywords: parsed });
      setState((s) => ({ ...s, trigger_type: 'keyword', trigger_config: { keywords: parsed } }));
    } else if (step === 'contact_from_ad') {
      const parsed = keywordText ? keywordText.split(',').map((s) => s.trim()).filter(Boolean) : keywordsList;
      onUpdateNodeConfig?.(node.node_key, { starting_step: 'contact_from_ad', keywords: parsed });
      onUpdateTrigger?.('keyword', { ad: true, keywords: parsed });
      setState((s) => ({ ...s, trigger_type: 'keyword', trigger_config: { ad: true, keywords: parsed } }));
    } else if (step === 'ai_intent') {
      const intentConfig = {
        intent_name: cfg.intent_name || (state.trigger_config?.intent_name as string) || '',
        intent_description: cfg.intent_description || (state.trigger_config?.intent_description as string) || '',
        positive_examples: cfg.positive_examples || (state.trigger_config?.positive_examples as string[]) || [],
        negative_examples: cfg.negative_examples || (state.trigger_config?.negative_examples as string[]) || [],
        confidence_threshold: typeof cfg.confidence_threshold === 'number' ? cfg.confidence_threshold : 0.75,
        priority: typeof cfg.priority === 'number' ? cfg.priority : 0,
      };
      onUpdateNodeConfig?.(node.node_key, { starting_step: 'ai_intent', ...intentConfig });
      onUpdateTrigger?.('ai_intent', intentConfig);
      setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: intentConfig }));
    }
  };

  const handleKeywordsChange = (val: string) => {
    setKeywordText(val);
    const parsed = val.split(',').map((s) => s.trim()).filter(Boolean);
    onUpdateNodeConfig?.(node.node_key, { starting_step: startingStep, keywords: parsed });
    if (startingStep === 'keyword' || startingStep === 'contact_from_ad') {
      onUpdateTrigger?.('keyword', { keywords: parsed, ...(startingStep === 'contact_from_ad' ? { ad: true } : {}) });
    }
  };

  const currentLabel =
    startingStep === 'new_contact'
      ? 'New contact'
      : startingStep === 'contact_from_ad'
        ? 'Contact from Ad'
        : startingStep === 'ai_intent'
          ? 'AI Intent — Natural Language'
          : 'Text contains specific keywords';

  return (
    <div
      className={cn(
        'group relative w-[315px] rounded-xl border bg-white text-left shadow-xs transition-all select-none',
        'hover:shadow-md hover:border-slate-300',
        selected ? '!border-purple-600 ring-2 ring-purple-600/20' : 'border-slate-200',
        isFlashed && '!border-amber-400 ring-2 ring-amber-400/60'
      )}
    >
      <div className="p-4 space-y-3">
        {/* Header with icon, title and delete button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#5850ec] text-white">
              <Zap className="h-3.5 w-3.5 fill-white" />
            </span>
            <span className="text-xs font-semibold text-slate-800 tracking-tight">Trigger</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode?.(node.node_key);
            }}
            className="text-slate-400 rounded p-1 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Define the input parameters to trigger the workflow, to ensure that accurate information is captured in the conversation flow.
        </p>

        {/* Starting Step */}
        <div className="space-y-1.5 pt-1 relative">
          <span className="text-[11px] font-semibold text-slate-700">Starting Step</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((v) => !v);
            }}
            className="flex w-full items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 shadow-2xs hover:border-slate-300 transition-colors"
          >
            <span className="truncate">{currentLabel}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-200', dropdownOpen && 'rotate-180')} />
          </button>

          {/* Dropdown Options Popup (Matches User Screenshot) */}
          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden py-1 animate-in fade-in-50 zoom-in-95">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectStartingStep('new_contact');
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                  startingStep === 'new_contact'
                    ? 'bg-[#fef9c3] text-amber-950 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {startingStep === 'new_contact' ? (
                  <Check className="h-3.5 w-3.5 text-amber-700 shrink-0 stroke-[2.5]" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span>New contact</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectStartingStep('keyword');
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                  startingStep === 'keyword'
                    ? 'bg-[#fef9c3] text-amber-950 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {startingStep === 'keyword' ? (
                  <Check className="h-3.5 w-3.5 text-amber-700 shrink-0 stroke-[2.5]" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span>Text contains specific keywords</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectStartingStep('ai_intent');
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                  startingStep === 'ai_intent'
                    ? 'bg-[#fef9c3] text-amber-950 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {startingStep === 'ai_intent' ? (
                  <Check className="h-3.5 w-3.5 text-amber-700 shrink-0 stroke-[2.5]" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>AI Intent — Natural Language</span>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectStartingStep('contact_from_ad');
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                  startingStep === 'contact_from_ad'
                    ? 'bg-[#fef9c3] text-amber-950 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {startingStep === 'contact_from_ad' ? (
                  <Check className="h-3.5 w-3.5 text-amber-700 shrink-0 stroke-[2.5]" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span>Contact from Ad</span>
              </button>
            </div>
          )}
        </div>

        {/* Keywords input right inside the Trigger node */}
        {startingStep === 'keyword' && (
          <div className="space-y-1 pt-1.5 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700">Keywords</span>
              <span className="text-[10px] text-slate-400">Comma separated</span>
            </div>
            <input
              type="text"
              value={keywordText}
              onChange={(e) => handleKeywordsChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="e.g. hi, hello, start, support"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
            />
          </div>
        )}

        {/* AI Intent input right inside the Trigger node */}
        {startingStep === 'ai_intent' && (
          <div className="space-y-2 pt-1.5 border-t border-slate-100">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-700">Intent Name</span>
              <input
                type="text"
                value={cfg.intent_name || (state.trigger_config?.intent_name as string) || ''}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                  const patch = { intent_name: val };
                  onUpdateNodeConfig?.(node.node_key, patch);
                  onUpdateTrigger?.('ai_intent', { ...state.trigger_config, ...patch });
                  setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g. appointment_booking"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-700">Description</span>
              <textarea
                value={cfg.intent_description || (state.trigger_config?.intent_description as string) || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const patch = { intent_description: val };
                  onUpdateNodeConfig?.(node.node_key, patch);
                  onUpdateTrigger?.('ai_intent', { ...state.trigger_config, ...patch });
                  setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="What user intent triggers this flow..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-700">Positive Examples</span>
              <input
                type="text"
                value={
                  Array.isArray(cfg.positive_examples)
                    ? cfg.positive_examples.join(', ')
                    : Array.isArray(state.trigger_config?.positive_examples)
                      ? (state.trigger_config.positive_examples as string[]).join(', ')
                      : ''
                }
                onChange={(e) => {
                  const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  const patch = { positive_examples: list };
                  onUpdateNodeConfig?.(node.node_key, patch);
                  onUpdateTrigger?.('ai_intent', { ...state.trigger_config, ...patch });
                  setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g. book appointment, demo, hi"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
              />
            </div>
          </div>
        )}
        {/* Active Channels */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700">Active Channels</span>
            <span className="text-[10px] text-slate-400">Trigger where</span>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            {[
              { id: 'whatsapp', label: 'WhatsApp', badge: 'WA', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
              { id: 'instagram', label: 'Instagram', badge: 'IG', color: 'text-pink-700 bg-pink-50 border-pink-300' },
              { id: 'facebook', label: 'Messenger', badge: 'FB', color: 'text-blue-700 bg-blue-50 border-blue-300' },
            ].map(({ id, label, badge, color }) => {
              const isChecked = currentChannels.includes(id as any);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = isChecked
                      ? currentChannels.filter((c) => c !== id)
                      : [...currentChannels, id];
                    if (updated.length > 0) {
                      setState((s) => ({ ...s, channels: updated as any }));
                    }
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded-md border text-[11px] font-medium transition-all shadow-2xs',
                    isChecked
                      ? cn(color, 'font-semibold ring-1 ring-current/20')
                      : 'border-slate-200 bg-slate-50/50 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                  )}
                  title={`Toggle ${label} trigger`}
                >
                  <ChannelIcon channel={id as any} className="size-3 shrink-0" />
                  <span>{badge}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outgoing Handle */}
      <Handle
        type="source"
        id="next"
        position={Position.Right}
        className="!h-3.5 !w-3.5 !border-2 !border-emerald-600 !bg-emerald-600 hover:!scale-125 transition-transform"
      />
    </div>
  );
}

function FlowNodeCard({ data, selected }: NodeProps) {
  const t = useTranslations('Flows.builder');
  const {
    node,
    isEntry,
    isFlashed,
    onDeleteNode,
    onDuplicateNode,
    onTestNode,
    onUpdateNodeConfig,
    onUpdateTrigger,
  } = data as NodeData;
  const c = nodeColors(node.node_type);
  const slots = outgoingSlots(node);
  const isMultiSlot = slots.length > 1;
  const cfg = (node.config ?? {}) as Record<string, any>;

  // Custom Trigger Card (Matching User Screenshot)
  if (node.node_type === 'trigger') {
    return (
      <TriggerNodeCard
        node={node}
        selected={selected}
        isFlashed={isFlashed}
        onDeleteNode={onDeleteNode}
        onUpdateNodeConfig={onUpdateNodeConfig}
        onUpdateTrigger={onUpdateTrigger}
      />
    );
  }

  const body = NodeBodyVisual({ node });

  return (
    <div
      className={cn(
        'group bg-white relative w-[265px] rounded-xl border border-slate-200 text-left shadow-xs transition-all select-none',
        'hover:shadow-md hover:border-slate-300',
        selected ? '!border-blue-500 ring-2 ring-blue-500/20' : '',
        isFlashed && '!border-amber-400 ring-2 ring-amber-400/60'
      )}
    >
      {/* Target handle (top for action nodes, left for message nodes) */}
      {node.node_type !== 'start' && (
        <Handle
          type="target"
          position={VERTICAL_ACTION_NODES.has(node.node_type) ? Position.Top : Position.Left}
          className={cn(
            HANDLE_BASE,
            node.node_type === 'agent_handover' || node.node_type === 'handoff'
              ? '!border-purple-500 !bg-purple-600 !w-3 !h-3 -top-1.5'
              : VERTICAL_ACTION_NODES.has(node.node_type)
              ? '!border-slate-400 !bg-white -top-1.5'
              : '!border-slate-400 !bg-white'
          )}
        />
      )}

      {/* Header: type chip + label + entry badge; actions */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <NodeIconChip
          type={node.node_type}
          size={22}
          iconSize={13}
          className="shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="text-slate-900 truncate text-xs font-semibold">
            {node.node_type === 'agent_handover' && cfg.assign_to
              ? `Agent Handover → ${cfg.agent_name || cfg.assign_to} ${cfg.agent_email ? `(${cfg.agent_email})` : ''}`
              : (NODE_REGISTRY[node.node_type]?.label || t(`nodes.${node.node_type}.label`))}
          </span>
          {isEntry && (
            <span className="text-emerald-600 shrink-0 text-[10px] font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
              {t('badgeEntry')}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTestNode?.(node);
            }}
            className="text-slate-400 hover:bg-slate-100 hover:text-slate-800 rounded p-1 transition-colors"
            title="Preview from this node"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateNode?.(node.node_key);
            }}
            className="text-slate-400 hover:bg-slate-100 hover:text-slate-800 rounded p-1 transition-colors"
            title="Duplicate node"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode?.(node.node_key);
            }}
            className="text-slate-400 rounded p-1 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {body && <div className="flex flex-col gap-1.5 px-3 pb-3 text-slate-600">{body}</div>}

      {/* Per-branch rows (buttons, condition, list rows, carousel, ai_decision) —
          each row owns the source handle for its slot. */}
      {isMultiSlot && (
        <div className="border-slate-100 divide-slate-100 divide-y border-t bg-slate-50/50 rounded-b-xl">
          {slots.map((slot, sIdx) => (
            <div
              key={`${slot.id || 'slot'}_${sIdx}`}
              className={cn(
                'relative flex items-center px-3 py-1.5 text-[11px]',
                node.node_type === 'send_buttons'
                  ? 'text-blue-600 font-medium'
                  : 'text-slate-600'
              )}
            >
              <span className="truncate pr-3">{slot.label}</span>
              <Handle
                type="source"
                id={slot.id}
                position={Position.Right}
                style={{ borderColor: slotColor(node.node_type, slot.id, '#94a3b8') }}
                className={HANDLE_BASE}
              />
            </div>
          ))}
        </div>
      )}

      {/* Single source handle for single-slot nodes (bottom for action nodes, right for message nodes) */}
      {!isMultiSlot && slots.length === 1 && (
        <Handle
          type="source"
          id={slots[0].id}
          position={VERTICAL_ACTION_NODES.has(node.node_type) ? Position.Bottom : Position.Right}
          className={cn(
            HANDLE_BASE,
            VERTICAL_ACTION_NODES.has(node.node_type)
              ? '!border-slate-400 !bg-white hover:!border-blue-500 -bottom-1.5'
              : '!border-slate-400 !bg-white hover:!border-blue-500'
          )}
        />
      )}
    </div>
  );
}

const NODE_TYPES = { flow: FlowNodeCard };

// ============================================================
// Root canvas
// ============================================================

/**
 * Outer wrapper provides the React-Flow context to the inner body,
 * so `useReactFlow()` works from anywhere in `FlowCanvasInner`
 * (notably, the pan-to-flash effect). The split is required because
 * useReactFlow() must be called inside a ReactFlowProvider.
 */
export function FlowCanvas({
  onTestNode,
  selectedNodeKey,
  onSelectNodeKey,
}: {
  onTestNode?: (node: BuilderNode) => void;
  selectedNodeKey?: string | null;
  onSelectNodeKey?: (key: string | null) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner
        onTestNode={onTestNode}
        selectedNodeKey={selectedNodeKey}
        onSelectNodeKey={onSelectNodeKey}
      />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner({
  onTestNode,
  selectedNodeKey: controlledSelectedKey,
  onSelectNodeKey,
}: {
  onTestNode?: (node: BuilderNode) => void;
  selectedNodeKey?: string | null;
  onSelectNodeKey?: (key: string | null) => void;
}) {
  const t = useTranslations('Flows.builder');
  const {
    state,
    setState,
    updateNodeConfig,
    updateNodePosition,
    updateNodePositions,
    removeNode,
    removeNodes,
    duplicateNodes,
    addNode,
    arrangeNodes,
    flashKey,
  } = useFlowEditor();
  const reactFlow = useReactFlow();
  const builderNodes = state.nodes;
  const entryNodeId = state.entry_node_id;

  // Side-panel state — which node's form is open (controlled by shell when provided).
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(null);
  const selectedNodeKey =
    controlledSelectedKey !== undefined ? controlledSelectedKey : internalSelectedKey;
  const setSelectedNodeKey = useCallback(
    (key: string | null) => {
      if (onSelectNodeKey) {
        onSelectNodeKey(key);
      } else {
        setInternalSelectedKey(key);
      }
    },
    [onSelectNodeKey],
  );
  // Tracks whether a drag from the Node Library is currently hovering
  // over the canvas so we can render a drop affordance.
  const [isDragOver, setIsDragOver] = useState(false);
  // Canvas interaction mode: false = Pan (Shift+drag to box-select), true = Select Area
  const [selectAreaMode, setSelectAreaMode] = useState(false);
  const [selectedNodeKeys, setSelectedNodeKeys] = useState<string[]>([]);

  const handleSelectionChange = useCallback(({ nodes: sel }: { nodes: RfNode[] }) => {
    const next = sel.map((n) => n.id);
    setSelectedNodeKeys((prev) => {
      if (prev.length === next.length && prev.every((id, i) => id === next[i])) {
        return prev;
      }
      return next;
    });
  }, []);
  const selectedNode = useMemo(
    () =>
      selectedNodeKey
        ? (builderNodes.find((n) => n.node_key === selectedNodeKey) ?? null)
        : null,
    [selectedNodeKey, builderNodes]
  );

  const autoLayoutPositions = useMemo(() => {
    const canvasEdges = deriveCanvasEdges(builderNodes);

    return shouldAutoLayout(builderNodes)
      ? autoLayout(
        builderNodes.map((n) => ({
          id: n.node_key,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        })),
        canvasEdges.map((e) => ({ source: e.source, target: e.target })),
        { direction: 'TB' }
      )
      : null;
  }, [builderNodes]);

  // If dagre had to place an all-zero flow, persist the generated
  // positions into editor state once. Otherwise the next drag would
  // save only the dragged node and every other node would fall back
  // to (0,0), which feels like nodes teleporting around the canvas.
  const persistedAutoLayoutRef = useRef(false);
  useEffect(() => {
    if (!autoLayoutPositions || persistedAutoLayoutRef.current) return;
    persistedAutoLayoutRef.current = true;
    updateNodePositions(
      Object.fromEntries(
        [...autoLayoutPositions].map(([key, pos]) => [key, pos])
      )
    );
  }, [autoLayoutPositions, updateNodePositions]);

  const derivedRfNodes = useMemo(() => {
    const nodes: RfNode<NodeData>[] = builderNodes.map((n) => {
      const fallback = autoLayoutPositions?.get(n.node_key);
      return {
        id: n.node_key,
        type: 'flow',
        position: {
          x: fallback?.x ?? n.position_x ?? 0,
          y: fallback?.y ?? n.position_y ?? 0,
        },
        data: {
          node: n,
          isEntry: n.node_key === entryNodeId,
          isFlashed: n.node_key === flashKey,
          onDeleteNode: (key: string) => removeNode(key),
          onDuplicateNode: (key: string) => {
            const [clonedKey] = duplicateNodes([key]);
            if (clonedKey) setSelectedNodeKeys([clonedKey]);
          },
          onTestNode: (node: BuilderNode) => onTestNode?.(node),
          onUpdateNodeConfig: (key: string, patch: Record<string, unknown>) =>
            updateNodeConfig(key, patch),
          onUpdateTrigger: (
            type: 'keyword' | 'first_inbound_message' | 'manual' | 'ai_intent',
            config: Record<string, unknown>,
          ) => {
            setState((prev) => ({
              ...prev,
              trigger_type: type,
              trigger_config: config,
            }));
          },
        },
      };
    });

    return nodes;
  }, [
    builderNodes,
    entryNodeId,
    flashKey,
    autoLayoutPositions,
    removeNode,
    duplicateNodes,
    onTestNode,
    updateNodeConfig,
    setState,
  ]);

  const [rfNodes, setRfNodes] = useState<RfNode<NodeData>[]>(derivedRfNodes);

  useEffect(() => {
    setRfNodes(derivedRfNodes);
  }, [derivedRfNodes]);

  const rfEdges = useMemo(() => {
    const canvasEdges = deriveCanvasEdges(builderNodes);

    // sourceHandle is now wired up — the FlowNodeCard renders a Handle
    // per slot whose id matches the scheme in edges.ts, so React-Flow
    // can hang the arrow off the right place on each card.
    const rfEdges: RfEdge[] = canvasEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label,
      // Keep connecting curves and labels strictly in white-mode colors on the white canvas.
      labelStyle: { fill: '#475569', fontSize: 11, fontWeight: 500 },
      labelBgStyle: { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 1 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: '#94a3b8', strokeWidth: 1.25 },
    }));

    return rfEdges;
  }, [builderNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<RfNode<NodeData>>[]) => {
      setRfNodes((nodes) => applyNodeChanges(changes, nodes));
    },
    []
  );

  // Drag-to-position: React-Flow tracks the visual drag internally and
  // fires this once on release. We write the final coordinate back to
  // the editor context (which flips `dirty`); save then ships the new
  // positions in the existing PUT /api/flows/[id] body (the route
  // already destructures position_x / position_y per migration 010).
  // Writing only on dragStop (not on every position-change tick during
  // the drag) keeps state updates cheap on long drags.
  const handleNodeDragStop = useCallback<OnNodeDrag<RfNode<NodeData>>>(
    (_event, node) => {
      updateNodePosition(node.id, node.position.x, node.position.y);
    },
    [updateNodePosition]
  );

  // Pan to the flashed node when the validator panel requests one.
  // Animate over 400ms; landing zoom is whatever the user already has
  // (don't force a zoom reset — that would be jarring mid-edit).
  useEffect(() => {
    if (!flashKey) return;
    const node = builderNodes.find((n) => n.node_key === flashKey);
    if (!node) return;
    const x = (node.position_x ?? 0) + NODE_WIDTH / 2;
    const y = (node.position_y ?? 0) + NODE_HEIGHT / 2;
    reactFlow.setCenter(x, y, {
      zoom: reactFlow.getZoom(),
      duration: 400,
    });
  }, [flashKey, builderNodes, reactFlow]);

  // Fit the canvas once on first mount so the initial nodes are all
  // visible. We deliberately do NOT use the `fitView` prop because it
  // re-runs on every nodes-changed tick — that's what was zooming the
  // view out and stealing focus every time a node was added via the
  // sidebar "click to add" path. After the initial fit the viewport
  // stays under the user's control (drag-drop, pan, zoom).
  const initialFitRef = useRef(false);
  useEffect(() => {
    if (initialFitRef.current || rfNodes.length === 0) return;
    initialFitRef.current = true;
    const id = requestAnimationFrame(() => reactFlow.fitView({ padding: 0.2, maxZoom: 1 }));
    return () => cancelAnimationFrame(id);
  }, [rfNodes.length, reactFlow]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RfNode<NodeData>) => {
      setSelectedNodeKey(node.id);
    },
    []
  );

  // Drag-and-drop from the Node Library sidebar. The sidebar items
  // already announce their type via `application/reactflow-nodetype`;
  // here we convert the drop cursor position into flow coordinates
  // and place the new node there instead of the viewport center,
  // so the user has full control over where a node lands.
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const type = event.dataTransfer.getData(
        'application/reactflow-nodetype',
      ) as NodeType | '';
      if (!type) return;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const key = addNode(type);
      updateNodePosition(key, position.x - NODE_WIDTH / 2, position.y - NODE_HEIGHT / 2);
    },
    [addNode, reactFlow, updateNodePosition],
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // Only clear when leaving the canvas entirely (relatedTarget is
    // null or outside the canvas root), otherwise a drag moving
    // between child elements flickers the affordance off.
    if (!event.relatedTarget || !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  // Drag-to-connect: React-Flow fires onConnect when the user drops a
  // handle drag onto a target handle. We look up the source node,
  // compute the right config patch via applyEdgeConnection (matches
  // the same slot scheme as deriveCanvasEdges), and dispatch via
  // updateNodeConfig. The resulting state change re-derives edges on
  // the next render — no need to maintain a separate edge list.
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle
      ) {
        return;
      }
      const sourceNode = builderNodes.find(
        (n) => n.node_key === connection.source
      );
      if (!sourceNode) return;
      // Self-loops are a footgun (a button whose target is its own
      // node = infinite reprompt). Reject silently — the user can
      // still wire one via the per-node dropdown if they really want.
      if (connection.source === connection.target) return;
      const patch = applyEdgeConnection(
        sourceNode,
        connection.sourceHandle,
        connection.target
      );
      if (patch) updateNodeConfig(connection.source, patch);
    },
    [builderNodes, updateNodeConfig]
  );

  // Keyboard delete (Backspace / Delete) + drag-to-trash. React-Flow
  // fires this with the set of deleted-node objects; we route each
  // through the editor context's removeNode (which now also unlinks
  // inbound references so no dangling arrows survive). Closing the
  // side panel on delete keeps the UI honest if the user deleted the
  // node currently being edited.
  const handleNodesDelete = useCallback(
    (deleted: RfNode<NodeData>[]) => {
      for (const n of deleted) {
        removeNode(n.id);
        if (selectedNodeKey === n.id) setSelectedNodeKey(null);
      }
    },
    [removeNode, selectedNodeKey]
  );

  // Edge delete: clear the source node's slot rather than removing
  // anything. Edges are derived from configs, so the only way to
  // "delete" one is to null out its underlying next_node_key.
  const handleEdgesDelete = useCallback(
    (deleted: RfEdge[]) => {
      for (const e of deleted) {
        if (!e.sourceHandle) continue;
        const sourceNode = builderNodes.find((n) => n.node_key === e.source);
        if (!sourceNode) continue;
        const patch = applyEdgeConnection(sourceNode, e.sourceHandle, '');
        if (patch) updateNodeConfig(e.source, patch);
      }
    },
    [builderNodes, updateNodeConfig]
  );

  // Wrapped mutators that target the currently-selected node — pass to
  // the form so each keystroke goes through the editor context (which
  // flips `dirty` and feeds the validator).
  const onSelectedUpdateConfig = useCallback(
    (patch: Record<string, unknown>) => {
      if (selectedNodeKey) updateNodeConfig(selectedNodeKey, patch);
    },
    [selectedNodeKey, updateNodeConfig]
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeKey) return;
    removeNode(selectedNodeKey);
    setSelectedNodeKey(null);
  }, [selectedNodeKey, removeNode, setSelectedNodeKey]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedNodeKey) return;
    const [clonedKey] = duplicateNodes([selectedNodeKey]);
    if (clonedKey) {
      setSelectedNodeKey(clonedKey);
      setSelectedNodeKeys([clonedKey]);
    }
  }, [selectedNodeKey, duplicateNodes, setSelectedNodeKey]);

  const handleBulkDuplicate = useCallback(() => {
    if (selectedNodeKeys.length === 0) return;
    const clonedKeys = duplicateNodes(selectedNodeKeys);
    if (clonedKeys.length > 0) {
      setSelectedNodeKeys(clonedKeys);
    }
  }, [selectedNodeKeys, duplicateNodes]);

  const handleBulkDelete = useCallback(() => {
    const deletable = selectedNodeKeys.filter((k) => {
      const n = builderNodes.find((b) => b.node_key === k);
      return n && n.node_type !== 'trigger' && n.node_type !== 'start';
    });
    if (deletable.length === 0) return;
    removeNodes(deletable);
    setSelectedNodeKeys([]);
    if (selectedNodeKey && deletable.includes(selectedNodeKey)) {
      setSelectedNodeKey(null);
    }
  }, [selectedNodeKeys, builderNodes, removeNodes, selectedNodeKey, setSelectedNodeKey]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        const targets = selectedNodeKeys.length > 0 ? selectedNodeKeys : selectedNodeKey ? [selectedNodeKey] : [];
        if (targets.length === 0) return;
        e.preventDefault();
        const clonedKeys = duplicateNodes(targets);
        if (clonedKeys.length > 0) setSelectedNodeKeys(clonedKeys);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeKeys, selectedNodeKey, duplicateNodes]);

  const handleSetEntry = useCallback(() => {
    if (!selectedNodeKey) return;
    setState((s) => ({ ...s, entry_node_id: selectedNodeKey }));
  }, [selectedNodeKey, setState]);

  if (rfNodes.length === 0) {
    return (
      <div className="text-slate-500 bg-white flex h-full flex-col items-center justify-center gap-3 text-sm [color-scheme:light]">
        <p>{t('noNodesYet')}</p>
        <CanvasAddNodeButton t={t} />
      </div>
    );
  }

  return (
    <>
      <div
        className="h-full w-full overflow-hidden bg-white [color-scheme:light] relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-purple-50/40 border-2 border-dashed border-purple-400 rounded-xl m-2">
            <span className="text-xs font-semibold text-purple-700 bg-white px-3 py-1.5 rounded-lg shadow-sm">
              Drop node here
            </span>
          </div>
        )}
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          proOptions={{ hideAttribution: true }}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onConnect={handleConnect}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onSelectionChange={handleSelectionChange}
          selectionOnDrag={selectAreaMode}
          panOnDrag={selectAreaMode ? [1, 2] : true}
          selectionMode={SelectionMode.Partial}
          // Default is "Backspace" only — accept both so Mac users
          // hitting Delete (Fn+Backspace) get the same behavior.
          deleteKeyCode={['Backspace', 'Delete']}
          nodesConnectable={true}
          edgesFocusable={true}
          elementsSelectable={true}
          // Lower default min/max zoom than the lib's defaults; the
          // tiles already truncate their summary at a reasonable
          // size, so we don't need to zoom past 1.5x.
          minZoom={0.2}
          maxZoom={1.5}
          defaultEdgeOptions={{
            style: { stroke: '#94a3b8', strokeWidth: 1.25 },
          }}
          connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 1.25 }}
        >
          {/* Dot grid, clean white-mode aesthetic. */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.2}
            color="#cbd5e1"
          />
          <Controls
            className="!border-slate-200 !bg-white [&_button]:!border-slate-200 [&_button]:!bg-white [&_button:hover]:!bg-slate-100 [&_button_svg]:!fill-slate-700 !overflow-hidden !rounded-xl !border !shadow-sm"
            showInteractive={false}
          />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) =>
              nodeColors((n.data as NodeData).node.node_type).solid
            }
            nodeStrokeWidth={0}
            nodeBorderRadius={3}
            maskColor="rgba(248, 250, 252, 0.7)"
            className="!border-slate-200 !bg-white !rounded-xl !border !shadow-sm"
          />
        </ReactFlow>

        {/* Top-left Canvas Mode Toggle: Pan vs Select Area */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setSelectAreaMode(false)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              !selectAreaMode
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
            title="Pan canvas (hold Shift + drag to select area)"
          >
            <Hand className="h-3.5 w-3.5" />
            Pan
          </button>
          <button
            type="button"
            onClick={() => setSelectAreaMode(true)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              selectAreaMode
                ? 'bg-purple-600 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
            title="Drag to select multiple nodes"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Select Area
          </button>
        </div>

        {/* Floating Selection Action Bar */}
        {selectedNodeKeys.length > 0 && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <span className="text-xs font-semibold text-slate-700 pr-1">
              {selectedNodeKeys.length} node{selectedNodeKeys.length === 1 ? '' : 's'} selected
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBulkDuplicate}
              className="h-7 px-2.5 text-xs text-slate-700 hover:bg-slate-100 gap-1.5"
              title="Duplicate selected (Ctrl+D)"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              className="h-7 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
              title="Delete selected"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelectedNodeKeys([])}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <NodeEditPanel
        node={selectedNode}
        isEntry={selectedNode?.node_key === entryNodeId}
        allNodes={builderNodes}
        onClose={() => setSelectedNodeKey(null)}
        onUpdateConfig={onSelectedUpdateConfig}
        onDelete={handleDeleteSelected}
        onDuplicate={handleDuplicateSelected}
        onSetEntry={handleSetEntry}
        t={t}
      />
    </>
  );
}

// ============================================================
// Inline side panel — opens when a canvas node is clicked. Renders
// as a fixed-width right-hand column inside the workspace layout
// (no floating overlay / backdrop), matching the chat preview's
// placement so both panels can coexist inside the flow shell.
// Mounts the shared NodeConfigForm dispatcher so edits made here
// behave identically to the list view's per-card editor.
// ============================================================

function NodeEditPanel({
  node,
  isEntry,
  allNodes,
  onClose,
  onUpdateConfig,
  onDelete,
  onDuplicate,
  onSetEntry,
  t,
}: {
  node: BuilderNode | null;
  isEntry: boolean;
  allNodes: BuilderNode[];
  onClose: () => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetEntry: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!node) return null;
  const def = NODE_REGISTRY[node.node_type];
  return (
    <aside className="w-[400px] lg:w-[440px] h-full border-l border-border bg-card text-card-foreground flex flex-col shrink-0 z-30 select-none shadow-xl transition-all relative">
      <div className="min-h-14 border-b border-border bg-muted/40 px-5 py-2.5 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <NodeIconChip type={node.node_type} size={32} iconSize={16} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-foreground truncate">
                {def?.label || t(`nodes.${node.node_type}.label`)}
              </h4>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                {node.node_key}
              </code>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {def?.blurb || t(`nodes.${node.node_type}.blurb`)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 bg-background/40 [&_>_div]:rounded-xl [&_>_div]:border [&_>_div]:border-border/70 [&_>_div]:bg-card [&_>_div]:p-3.5 [&_>_div]:shadow-2xs">
        <NodeConfigForm
          node={node}
          allNodes={allNodes}
          showAdvanced={false}
          onUpdateConfig={onUpdateConfig}
        />
      </div>

      <div className="border-border border-t px-5 py-3 sm:flex-row sm:justify-between bg-muted/40 flex items-center gap-2">
        {!isEntry && node.node_type !== 'trigger' ? (
          <Button variant="ghost" size="sm" onClick={onSetEntry} className="text-muted-foreground hover:text-foreground hover:bg-muted">
            Set as entry
          </Button>
        ) : (
          <span />
        )}
        {node.node_type !== 'start' && node.node_type !== 'trigger' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDuplicate}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Node
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
     

// ============================================================
// Floating add-node button — bottom-right of the canvas. Mirrors
// the list view's AddNodeButton (same dropdown menu, same NodeType
// list, same icons via NODE_META) but drops the new node into the
// center of the visible viewport rather than appending to a list.
// ============================================================

const ADD_NODE_TYPES: NodeType[] = [
  'start',
  'send_buttons',
  'send_list',
  'send_carousel',
  'send_message',
  'ai_message',
  'send_media',
  'send_location',
  'send_contact',
  'request_address',
  'collect_input',
  'condition',
  'ai_extract',
  'ai_decision',
  'ai_summarize',
  'set_tag',
  'handoff',
  'end',
];

function CanvasAddNodeButton({ t }: { t: ReturnType<typeof useTranslations> }) {
  const reactFlow = useReactFlow();
  const { addNode, updateNodePosition } = useFlowEditor();

  const handleAdd = (type: NodeType) => {
    const key = addNode(type);
    // Place the new node at the visible canvas center. The Panel's
    // own DOM lives inside ReactFlow so we can climb up to find the
    // .react-flow root and read its bounding rect. If we can't find
    // it (test envs, etc.), addNode's default (0, 0) is the fallback
    // and the user can drag the node into view.
    const root = document.querySelector('.react-flow') as HTMLElement | null;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const center = reactFlow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    // NODE_WIDTH / NODE_HEIGHT are the dagre layout defaults; offset
    // so the card sits visually centered rather than top-left at the
    // viewport center.
    updateNodePosition(
      key,
      center.x - NODE_WIDTH / 2,
      center.y - NODE_HEIGHT / 2
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)] transition-colors"
        aria-label={t('addNode')}
      >
        <Plus className="h-4 w-4" />
        {t('addNode')}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="border-border bg-popover w-[268px] p-1.5"
      >
        {groupNodeTypesByCategory(ADD_NODE_TYPES).map((group, i) => (
          // DropdownMenuGroup (base-ui Menu.Group) is REQUIRED: the
          // DropdownMenuLabel below is base-ui's Menu.GroupLabel, which
          // throws at render without a Menu.Group ancestor. A plain <div>
          // here crashed the page when this menu opened (issue #336).
          <Fragment key={group.id}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-[11px] font-semibold tracking-wider uppercase">
                {t(`categories.${group.id}`)}
              </DropdownMenuLabel>
              {group.types.map((t_type) => {
                const meta = NODE_META[t_type];
                return (
                  <DropdownMenuItem
                    key={t_type}
                    onClick={() => handleAdd(t_type)}
                    className="gap-3 py-2"
                  >
                    <NodeIconChip
                      type={t_type}
                      size={28}
                      iconSize={16}
                      className="rounded-md"
                    />
                    <span className="flex flex-col">
                      <span className="text-popover-foreground text-[13px] font-semibold">
                        {t(`nodes.${t_type}.label`)}
                      </span>
                      <span className="text-muted-foreground text-[11.5px]">
                        {t(`nodes.${t_type}.blurb`)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}