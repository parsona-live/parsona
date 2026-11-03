'use client';

/**
 * Authentic WhatsApp Chat Preview Panel for the Flow Editor.
 *
 * Renders as a dedicated right-hand side panel in the editor shell (no modal/phone artifact).
 * - Real WhatsApp design system:
 *   - Chat background with authentic WhatsApp doodle pattern and #efeae2 background.
 *   - Clean empty state with authentic WhatsApp yellow E2E encryption notice pill (no predefined keyword buttons).
 *   - Inbound bubbles (#ffffff with tail, hairline dividers, footer, timestamps).
 *   - Outbound bubbles (#d9fdd3 with tail and double blue checkmarks).
 *   - Real WhatsApp interactive buttons (stacked with hairline dividers and reply icon).
 *   - Real WhatsApp interactive list with "View options" bottom-sheet selector.
 *   - Real WhatsApp carousel (horizontal scroll cards with buttons).
 *   - Real WhatsApp contact and location cards.
 * - Trigger verification:
 *   - User types keyword into message input -> if matches configured keywords, starts/restarts flow.
 *   - Any non-matching message routes to AI: "This message does not match any flow keywords. The AI agent will respond to this in WhatsApp."
 *   - Collect input steps capture user text responses and advance the flow.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Send,
  MessageSquare,
  Sparkles,
  Paperclip,
  CheckCheck,
  Tag,
  Mail,
  Clock,
  Globe,
  UserCheck,
  Briefcase,
  CreditCard,
  Calendar,
  FileText,
  Flag,
  Reply,
  ListFilter,
  MapPin,
  User,
  ExternalLink,
  ChevronRight,
  Phone,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuilderNode, NodeType } from './shared';
import type { FlowRow } from '@/lib/flows/types';
import { fastClassifyHeuristic } from '@/lib/flows/ai-classifier-shared';

interface FlowChatPreviewProps {
  flow: FlowRow;
  nodes: BuilderNode[];
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system' | 'ai';
  nodeKey?: string;
  nodeType?: NodeType;
  text?: string;
  headerType?: string;
  headerText?: string;
  headerMediaUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  footerText?: string;
  buttonLabel?: string;
  buttons?: Array<{ reply_id: string; title: string; next_node_key?: string }>;
  listSections?: Array<{
    title?: string;
    rows: Array<{ reply_id: string; title: string; description?: string; next_node_key?: string }>;
  }>;
  carouselCards?: Array<{
    header_type?: string;
    media_url?: string;
    body_text?: string;
    buttons: Array<{ title: string; reply_id?: string; next_node_key?: string }>;
  }>;
  contact?: {
    formatted_name: string;
    phone?: string;
  };
  location?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  actionBadge?: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    detail?: string;
  };
  timestamp: string;
}

/**
 * Format WhatsApp Markdown: *bold*, _italic_, ~strikethrough~
 */
function FormattedWhatsAppText({ text }: { text?: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const formatted = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\*(.*?)\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
          .replace(/_(.*?)_/g, '<em class="italic">$1</em>')
          .replace(/~(.*?)~/g, '<del class="line-through text-slate-500">$1</del>');
        return (
          <p
            key={idx}
            className="whitespace-pre-wrap leading-relaxed text-[13px] text-[#111b21]"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      })}
    </div>
  );
}

export function FlowChatPreview({ flow, nodes, onClose }: FlowChatPreviewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentNodeKey, setCurrentNodeKey] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null);
  const [pausedNodeKey, setPausedNodeKey] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [activeListModal, setActiveListModal] = useState<ChatMessage | null>(null);
  const [simVars, setSimVars] = useState<Record<string, string>>({
    'contact.name': 'Alex Johnson',
    'contact.phone': '+1 (555) 019-2834',
    'contact.email': 'alex@example.com',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, BuilderNode>();
    nodes.forEach((n) => map.set(n.node_key, n));
    return map;
  }, [nodes]);

  // Find trigger node and keywords
  const triggerNode = useMemo(
    () => nodes.find((n) => n.node_type === 'trigger'),
    [nodes]
  );

  const triggerConfig = useMemo(() => {
    const nodeCfg = (triggerNode?.config ?? {}) as Record<string, any>;
    const startingStep =
      nodeCfg.starting_step ||
      (flow.trigger_type === 'first_inbound_message' ? 'new_contact' : 'keyword');

    let keywords: string[] = [];
    if (Array.isArray(nodeCfg.keywords) && nodeCfg.keywords.length > 0) {
      keywords = nodeCfg.keywords;
    } else if (Array.isArray((flow.trigger_config as any)?.keywords) && (flow.trigger_config as any).keywords.length > 0) {
      keywords = (flow.trigger_config as any).keywords;
    }

    return { startingStep, keywords };
  }, [triggerNode, flow.trigger_type, flow.trigger_config]);

  const entryKey = useMemo(() => {
    if (flow.entry_node_id && nodeMap.has(flow.entry_node_id)) {
      return flow.entry_node_id;
    }
    if (triggerNode) return triggerNode.node_key;
    const startNode = nodes.find((n) => n.node_type === 'start');
    if (startNode) return startNode.node_key;
    return nodes[0]?.node_key ?? null;
  }, [flow.entry_node_id, triggerNode, nodes, nodeMap]);

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const interpolate = useCallback(
    (text?: string) => {
      if (!text) return '';
      return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, rawKey) => {
        // Direct
        if (simVars[rawKey] !== undefined) return String(simVars[rawKey]);
        // Stripped "vars."
        if (rawKey.startsWith('vars.')) {
          const stripped = rawKey.slice(5);
          if (simVars[stripped] !== undefined) return String(simVars[stripped]);
        }
        // Prefixed "vars."
        const prefixed = `vars.${rawKey}`;
        if (simVars[prefixed] !== undefined) return String(simVars[prefixed]);
        // Contact attributes fallback simulation
        if (rawKey === 'contact.name' || rawKey === 'vars.contact.name') return 'John Doe';
        if (rawKey === 'contact.phone' || rawKey === 'vars.contact.phone') return '+1234567890';
        if (rawKey === 'contact.email' || rawKey === 'vars.contact.email') return 'john@example.com';
        return `{{${rawKey}}}`;
      });
    },
    [simVars]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Node Execution Engine
  const executeNode = useCallback(
    (nodeKey: string, currentHistory: ChatMessage[], vars = simVars): ChatMessage[] => {
      const node = nodeMap.get(nodeKey);
      if (!node) {
        return [
          ...currentHistory,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: `Flow reached terminal or target node "${nodeKey}" not found.`,
            timestamp: getTimeString(),
          },
        ];
      }

      setCurrentNodeKey(node.node_key);
      const cfg = (node.config ?? {}) as Record<string, any>;
      const time = getTimeString();

      switch (node.node_type) {
        case 'trigger':
        case 'start': {
          const next = cfg.next_node_key as string | undefined;
          if (next) {
            return executeNode(next, currentHistory, vars);
          }
          return currentHistory;
        }

        case 'send_message': {
          const text = interpolate(cfg.text as string);
          const headerType = (cfg.header_type as string) || 'none';
          const headerText = interpolate((cfg.header_text as string) || '');
          const footerText = interpolate((cfg.footer_text as string) || '');
          const next = cfg.next_node_key as string | undefined;

          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_message',
              text,
              headerType,
              headerText,
              footerText,
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, nextHistory, vars);
          }
          return nextHistory;
        }

        case 'send_media': {
          const mediaUrl = (cfg.media_url as string) || '';
          const mediaType = (cfg.media_type as string) || 'image';
          const caption = interpolate(cfg.caption as string);
          const next = cfg.next_node_key as string | undefined;

          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_media',
              mediaUrl,
              mediaType,
              caption,
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, nextHistory, vars);
          }
          return nextHistory;
        }

        case 'send_buttons': {
          const text = interpolate((cfg.text as string) || '');
          const headerText = interpolate((cfg.header_text as string) || '');
          const footerText = interpolate((cfg.footer_text as string) || '');
          const headerMediaUrl = (cfg.header_media_url as string) || '';
          const headerType = (cfg.header_type as string) || 'none';
          const buttons = Array.isArray(cfg.buttons) ? cfg.buttons : [];
          setWaitingForInput(null);
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_buttons',
              text,
              headerType,
              headerText,
              headerMediaUrl,
              footerText,
              buttons,
              timestamp: time,
            },
          ];
        }

        case 'send_list': {
          const bodyText = interpolate((cfg.body_text as string) || (cfg.text as string) || '');
          const headerText = interpolate((cfg.header_text as string) || '');
          const footerText = interpolate((cfg.footer_text as string) || '');
          const buttonLabel = (cfg.button_label as string) || 'View options';
          const sections = Array.isArray(cfg.sections) ? cfg.sections : [];
          setWaitingForInput(null);
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_list',
              text: bodyText,
              headerText,
              footerText,
              buttonLabel,
              listSections: sections,
              timestamp: time,
            },
          ];
        }

        case 'send_carousel': {
          const cards = Array.isArray(cfg.cards) ? cfg.cards : [];
          setWaitingForInput(null);
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_carousel',
              carouselCards: cards,
              timestamp: time,
            },
          ];
        }

        case 'send_contact': {
          const phones = Array.isArray(cfg.phones) ? (cfg.phones as Array<{ phone: string }>) : [];
          const phone = (cfg.phone as string) || (phones[0]?.phone ?? '');
          const formatted_name = (cfg.formatted_name as string) || 'Business Contact';
          const next = cfg.next_node_key as string | undefined;

          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_contact',
              contact: { formatted_name, phone },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'send_location': {
          const name = (cfg.name as string) || 'Location';
          const address = (cfg.address as string) || '';
          const next = cfg.next_node_key as string | undefined;

          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_location',
              location: { name, address },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'collect_input':
        case 'input_flow': {
          const prompt = interpolate((cfg.prompt_text as string) || '');
          setWaitingForInput(node.node_key);
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: node.node_type,
              text: prompt || 'Please enter your response:',
              timestamp: time,
            },
          ];
        }

        case 'ai_response': {
          const prompt = interpolate((cfg.prompt as string) || '');
          const aiResponseText = prompt
            ? `AI Response: Here is the information regarding "${prompt}". How else may I assist you today?`
            : "AI Response: Hello! I'm here to assist with any questions about our products and services.";
          const next = cfg.next_node_key as string | undefined;

          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'ai_response',
              text: aiResponseText,
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'set_tag': {
          const tag = (cfg.tag as string) || 'untagged';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: Tag, label: 'Tag Added', detail: tag },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'send_email': {
          const subject = (cfg.subject as string) || 'Notification';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: Mail, label: 'Email Dispatched', detail: subject },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'delay': {
          const amt = cfg.amount ?? 5;
          const unit = cfg.unit || 'minutes';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: Clock, label: 'Workflow Delay', detail: `Wait ${amt} ${unit}` },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'webhook':
        case 'http_fetch': {
          const method = (cfg.method as string) || 'POST';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: Globe, label: 'Webhook Triggered', detail: `${method} Request` },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'update_contact': {
          const field = (cfg.field as string) || 'name';
          const val = (cfg.value as string) || '';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: UserCheck, label: 'Contact Updated', detail: `Set ${field} = "${val}"` },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'create_deal': {
          const title = (cfg.title as string) || 'New Deal';
          const val = cfg.value ? `$${cfg.value}` : '';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: Briefcase, label: 'Deal Created', detail: `${title} ${val}` },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'whatsapp_payment': {
          const amt = cfg.amount ?? 100;
          const curr = cfg.currency || 'INR';
          const next = (cfg.success_next || cfg.next_node_key) as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              text: `Payment Request: ${curr} ${amt} for ${cfg.item_name || 'Order'}`,
              actionBadge: { icon: CreditCard, label: 'Payment Link Ready', detail: `${curr} ${amt}` },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'book_appointment': {
          const prompt = (cfg.prompt_text as string) || 'Book your appointment online:';
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              text: prompt,
              actionBadge: { icon: Calendar, label: 'Appointment Booking', detail: cfg.booking_url || 'Calendar Link' },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'whatsapp_form': {
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              text: 'Please complete the native WhatsApp form below:',
              actionBadge: { icon: FileText, label: 'WhatsApp Flow Form' },
              timestamp: time,
            },
          ];
          if (next) return executeNode(next, nextHistory, vars);
          return nextHistory;
        }

        case 'agent_handover':
        case 'handoff': {
          setWaitingForInput(null);
          const agentName = (cfg.agent_name as string) || (cfg.assign_to as string) || '';
          const agentEmail = (cfg.agent_email as string) || '';
          const msg = interpolate((cfg.message as string) || (cfg.note as string) || 'Transferring you to our team. Please wait...');
          const agentDetail = agentName ? `${agentName}${agentEmail ? ` (${agentEmail})` : ''}` : 'Queued in inbox';

          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              text: msg,
              timestamp: time,
            },
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: UserCheck, label: 'Transferred to Agent', detail: agentDetail },
              timestamp: time,
            },
          ];
        }

        case 'end':
        case 'close_conversation': {
          setWaitingForInput(null);
          return [
            ...currentHistory,
            {
              id: `act-${Date.now()}-${Math.random()}`,
              sender: 'system',
              actionBadge: { icon: Flag, label: 'Workflow Concluded' },
              timestamp: time,
            },
          ];
        }

        default: {
          const next = cfg.next_node_key as string | undefined;
          if (next) return executeNode(next, currentHistory, vars);
          return currentHistory;
        }
      }
    },
    [nodeMap, interpolate, simVars]
  );

  // Reset simulation to completely empty
  const resetSimulation = () => {
    setMessages([]);
    setCurrentNodeKey(null);
    setWaitingForInput(null);
    setActiveListModal(null);
  };

  // Check if user input triggers the workflow
  const checkTriggerMatch = useCallback(
    (text: string): boolean => {
      const { startingStep, keywords } = triggerConfig;
      const lower = text.toLowerCase().trim();
      if (!lower) return false;

      if (startingStep === 'keyword' || startingStep === 'contact_from_ad') {
        if (keywords.length > 0) {
          return keywords.some((kw) => {
            const cleanKw = kw.toLowerCase().trim();
            if (!cleanKw) return false;
            if (lower === cleanKw) return true;
            // Match with word boundary or substring
            const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(^|\\b|\\s)${escaped}($|\\b|\\s)`, 'i');
            return regex.test(lower) || lower.includes(cleanKw);
          });
        }
        // If keyword mode is active but user has not configured any keywords yet, do not trigger
        return false;
      }

      if (startingStep === 'new_contact') {
        const hasUserSent = messages.some((m) => m.sender === 'user');
        return !hasUserSent;
      }

      return false;
    },
    [triggerConfig]
  );

  // Handle user sending text message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text) return;
    setInputText('');

    const time = getTimeString();
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}-${Math.random()}`,
      sender: 'user',
      text,
      timestamp: time,
    };

    const newHistory = [...messages, userMsg];

    // Priority 1: Check if this message is a trigger keyword match!
    // A matching trigger keyword ALWAYS starts/restarts the workflow from entry node,
    // regardless of whether prior messages were sent or flow was already running.
    const isKeywordMatch = checkTriggerMatch(text);

    if (isKeywordMatch) {
      setWaitingForInput(null);
      if (entryKey) {
        const advanced = executeNode(entryKey, newHistory);
        setMessages(advanced);
      } else {
        setMessages([
          ...newHistory,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: 'Trigger matched, but no entry node configured in workflow.',
            timestamp: time,
          },
        ]);
      }
      return;
    }

    // Priority 2: If workflow was paused, check for resume or answer
    if (pausedNodeKey) {
      const pausedNode = nodeMap.get(pausedNodeKey);
      const isCollect = pausedNode?.node_type === 'collect_input' || pausedNode?.node_type === 'input_flow';
      const varKey = (pausedNode?.config?.var_key as string) || 'input';
      const promptText = (pausedNode?.config?.prompt_text as string) || '';
      const validation = (pausedNode?.config?.validation as any) || 'any';
      const classification = fastClassifyHeuristic(text, promptText, varKey, validation);

      if (classification?.intent === 'cancel') {
        setPausedNodeKey(null);
        setWaitingForInput(null);
        setMessages([
          ...newHistory,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: 'Workflow cancelled.',
            timestamp: time,
          },
        ]);
        return;
      }

      if (classification?.intent === 'resume') {
        // Resume paused workflow!
        const targetKey = pausedNodeKey;
        setPausedNodeKey(null);
        const advanced = executeNode(targetKey, newHistory);
        setMessages(advanced);
        return;
      }

      if (classification?.intent === 'answer' && isCollect) {
        // Answering the paused question directly!
        const cleanVal = classification.extracted_value ?? text;
        const rawKey = varKey.startsWith('vars.') ? varKey.slice(5) : varKey;
        const updatedVars = {
          ...simVars,
          [varKey]: cleanVal,
          [rawKey]: cleanVal,
          [`vars.${rawKey}`]: cleanVal,
        };
        setSimVars(updatedVars);
        setPausedNodeKey(null);
        const nextKey = pausedNode?.config?.next_node_key as string | undefined;
        if (nextKey) {
          const advanced = executeNode(nextKey, newHistory, updatedVars);
          setMessages(advanced);
          return;
        }
        setMessages(newHistory);
        return;
      }

      // Customer is continuing conversation with AI while workflow stays paused
      setMessages([
        ...newHistory,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `AI Auto-Reply: Responding to "${text}".\n\n_(Workflow paused. Reply 'resume' to continue.)_`,
          timestamp: time,
        },
      ]);
      return;
    }

    // Priority 3: If waiting for text input on collect_input
    if (waitingForInput) {
      const node = nodeMap.get(waitingForInput);
      const varKey = (node?.config?.var_key as string) || 'user_response';
      const promptText = (node?.config?.prompt_text as string) || '';
      const validation = (node?.config?.validation as any) || 'any';
      const classification = fastClassifyHeuristic(text, promptText, varKey, validation);

      if (classification?.intent === 'cancel') {
        setWaitingForInput(null);
        setMessages([
          ...newHistory,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: 'Workflow cancelled.',
            timestamp: time,
          },
        ]);
        return;
      }

      // Check if user is asking an unrelated question or changing topic (interruption)
      const isQuestion = text.includes('?') || /^(what|how|why|when|where|can|could|is|are|kya|kaise|kab|kahan|kyun|check|status)\b/i.test(text);
      if (isQuestion || classification?.intent === 'interruption') {
        // Pause the workflow and route to AI!
        setPausedNodeKey(waitingForInput);
        setWaitingForInput(null);
        setMessages([
          ...newHistory,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `AI Auto-Reply: Responding to "${text}".\n\n_(Workflow paused. Reply 'resume' to continue.)_`,
            timestamp: time,
          },
        ]);
        return;
      }

      // Smart Input Extraction: clean extracted entity (e.g. "Yash Tupkar" from "My name is Yash Tupkar")
      const cleanVal = classification?.extracted_value ?? text;
      const rawKey = varKey.startsWith('vars.') ? varKey.slice(5) : varKey;
      const updatedVars = {
        ...simVars,
        [varKey]: cleanVal,
        [rawKey]: cleanVal,
        [`vars.${rawKey}`]: cleanVal,
      };
      setSimVars(updatedVars);
      setWaitingForInput(null);

      const nextKey = node?.config?.next_node_key as string | undefined;
      if (nextKey) {
        const advanced = executeNode(nextKey, newHistory, updatedVars);
        setMessages(advanced);
        return;
      }
      setMessages(newHistory);
      return;
    }

    // Priority 4: Message sent while viewing buttons/list or freeform chat
    if (currentNodeKey && nodeMap.has(currentNodeKey)) {
      const currentNode = nodeMap.get(currentNodeKey);
      if (
        currentNode?.node_type === 'send_buttons' ||
        currentNode?.node_type === 'send_list' ||
        currentNode?.node_type === 'send_carousel'
      ) {
        // Customer typed text instead of tapping button -> pause and route to AI!
        setPausedNodeKey(currentNodeKey);
        setMessages([
          ...newHistory,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `AI Auto-Reply: Responding to "${text}".\n\n_(Workflow paused. Reply 'resume' or tap an option to continue.)_`,
            timestamp: time,
          },
        ]);
        return;
      }
    }

    // Priority 5: Fallback general AI route
    setMessages([
      ...newHistory,
      {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'This message does not match any flow keywords. The AI agent will respond to this in WhatsApp.',
        timestamp: time,
      },
    ]);
  };

  // Handle clicking interactive button option
  const handleButtonClick = (button: { reply_id: string; title: string; next_node_key?: string }) => {
    setActiveListModal(null);
    const time = getTimeString();
    const userChoiceMsg: ChatMessage = {
      id: `usr-${Date.now()}-${Math.random()}`,
      sender: 'user',
      text: button.title,
      timestamp: time,
    };

    const newHistory = [...messages, userChoiceMsg];
    if (button.next_node_key) {
      const advanced = executeNode(button.next_node_key, newHistory);
      setMessages(advanced);
    } else {
      setMessages(newHistory);
    }
  };

  return (
    <aside className="w-[380px] lg:w-[420px] h-full border-l border-slate-200 bg-white flex flex-col shrink-0 z-30 select-none shadow-xl transition-all relative">
      {/* ================= CHAT HEADER ================= */}
      <div className="h-14 border-b border-slate-200 bg-[#f0f2f5] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-xs font-bold text-xs">
            WA
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-[#111b21] truncate">
              {flow.name || 'Flow Preview'}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-[#00a884] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00a884] animate-pulse" />
              <span>online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetSimulation}
            className="p-1.5 rounded-md text-slate-500 hover:text-[#111b21] hover:bg-slate-200/60 transition-colors"
            title="Restart flow simulation"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-[#111b21] hover:bg-slate-200/60 transition-colors"
            title="Close Preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ================= AUTHENTIC WHATSAPP CHAT STREAM ================= */}
      <div
        className="flex-1 overflow-y-auto p-3.5 space-y-3"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'radial-gradient(#d1d7db 0.8px, transparent 0.8px)',
          backgroundSize: '16px 16px',
        }}
      >
        {/* Real WhatsApp End-to-End Encryption Notice Pill */}
        <div className="flex justify-center pt-1 pb-1">
          <div className="max-w-[90%] rounded-lg bg-[#ffeecd] px-3 py-1.5 text-center text-[10.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] leading-relaxed flex items-center justify-center gap-1.5">
            <span>🔒 Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.</span>
          </div>
        </div>

        {/* Date Stamp Pill */}
        <div className="flex justify-center my-1">
          <span className="rounded-md bg-white/90 border border-slate-200/50 px-2.5 py-0.5 text-[10px] text-[#54656f] font-semibold uppercase tracking-wider shadow-2xs">
            TODAY
          </span>
        </div>

        {/* Messages Stream */}
        {messages.map((msg) => {
          // System Action Badges
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-1.5">
                {msg.actionBadge ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-700 shadow-2xs">
                    <msg.actionBadge.icon className="h-3 w-3 text-slate-500" />
                    <span>{msg.actionBadge.label}</span>
                    {msg.actionBadge.detail && (
                      <span className="text-slate-400">({msg.actionBadge.detail})</span>
                    )}
                  </div>
                ) : (
                  <span className="rounded-md bg-white/80 border border-slate-200/60 px-2.5 py-0.5 text-[10px] text-slate-500 font-medium shadow-2xs">
                    {msg.text}
                  </span>
                )}
              </div>
            );
          }

          // AI Fallback Card (Routed to AI)
          if (msg.sender === 'ai') {
            return (
              <div key={msg.id} className="flex flex-col items-start gap-1 max-w-[88%] animate-in fade-in-50">
                <div className="w-full rounded-lg rounded-tl-none bg-white p-3 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border-l-4 border-purple-500 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-purple-700 font-semibold text-[11px]">
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    <span>AI Auto-Reply Route</span>
                  </div>
                  <p className="leading-relaxed text-slate-700 text-xs">{msg.text}</p>
                  <div className="text-[10px] text-[#667781] text-right mt-1">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          }

          // User Outbound Bubble (Real WhatsApp green with tail & double blue tick)
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="flex justify-end animate-in fade-in-50">
                <div className="max-w-[82%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative">
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#667781]">
                    <span>{msg.timestamp}</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            );
          }

          // Bot Inbound Message (Real WhatsApp white card with full interactive buttons/lists/media)
          return (
            <div key={msg.id} className="flex flex-col items-start gap-1 max-w-[88%] animate-in fade-in-50">
              <div className="w-full rounded-lg rounded-tl-none bg-white p-3 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] space-y-2">
                {/* Header text */}
                {msg.headerText && (
                  <p className="font-bold text-[#111b21] text-xs pb-0.5">
                    {msg.headerText}
                  </p>
                )}

                {/* Media preview */}
                {(msg.mediaUrl || msg.headerMediaUrl) && (
                  <div className="overflow-hidden rounded-md bg-slate-50 border border-slate-100 -mx-1">
                    {msg.mediaType === 'image' || (!msg.mediaType && (msg.mediaUrl || msg.headerMediaUrl)) ? (
                      <img
                        src={msg.mediaUrl || msg.headerMediaUrl}
                        alt="Media"
                        className="max-h-48 w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 text-slate-700">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-xs font-medium truncate">{msg.mediaUrl || msg.headerMediaUrl}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body text with WhatsApp Markdown */}
                {msg.text && <FormattedWhatsAppText text={msg.text} />}
                {msg.caption && <FormattedWhatsAppText text={msg.caption} />}

                {/* Contact card */}
                {msg.contact && (
                  <div className="flex items-center gap-3 p-2.5 bg-[#f0f2f5] rounded-lg border border-slate-200">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-slate-700 font-bold text-sm">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{msg.contact.formatted_name}</p>
                      <p className="text-[11px] text-slate-600 truncate">{msg.contact.phone}</p>
                    </div>
                  </div>
                )}

                {/* Location card */}
                {msg.location && (
                  <div className="p-2.5 bg-[#f0f2f5] rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <MapPin className="h-4 w-4 text-red-500 fill-red-500" />
                      <span>{msg.location.name || 'Shared Location'}</span>
                    </div>
                    {msg.location.address && (
                      <p className="text-[11px] text-slate-600 pl-6">{msg.location.address}</p>
                    )}
                  </div>
                )}

                {/* Carousel Cards (Horizontal Swipeable) */}
                {msg.carouselCards && msg.carouselCards.length > 0 && (
                  <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-1 -mx-2 px-2 snap-x">
                    {msg.carouselCards.map((c, cIdx) => (
                      <div
                        key={cIdx}
                        className="min-w-[190px] max-w-[210px] shrink-0 rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col justify-between snap-start"
                      >
                        {c.media_url ? (
                          <img src={c.media_url} alt="Card" className="h-24 w-full object-cover" />
                        ) : (
                          <div className="h-16 bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                        <div className="p-2.5 text-xs leading-relaxed text-slate-800">
                          {c.body_text}
                        </div>
                        {c.buttons && c.buttons.length > 0 && (
                          <div className="border-t border-[#e9edef] divide-y divide-[#e9edef]">
                            {c.buttons.map((b, bIdx) => (
                              <button
                                key={bIdx}
                                type="button"
                                onClick={() => handleButtonClick(b as any)}
                                className="w-full py-2 text-center text-xs font-semibold text-[#00a884] hover:bg-[#f5f6f6] transition-colors"
                              >
                                {b.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer Text */}
                {msg.footerText && (
                  <p className="text-[11px] text-[#667781] pt-0.5">{msg.footerText}</p>
                )}

                <div className="text-[10px] text-[#667781] text-right mt-0.5">
                  {msg.timestamp}
                </div>

                {/* WhatsApp Interactive Buttons (Stacked with Hairline Dividers) */}
                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="border-t border-[#e9edef] divide-y divide-[#e9edef] mt-2 -mx-3 -mb-3">
                    {msg.buttons.map((btn) => (
                      <button
                        key={btn.reply_id}
                        type="button"
                        onClick={() => handleButtonClick(btn)}
                        className="w-full py-2.5 px-3 text-center text-[13px] font-semibold text-[#00a884] hover:bg-[#f5f6f6] active:bg-[#e9edef] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Reply className="h-3.5 w-3.5 rotate-180 text-[#00a884]" />
                        <span>{btn.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* WhatsApp Interactive List (View Options Menu Button) */}
                {msg.listSections && msg.listSections.length > 0 && (
                  <div className="border-t border-[#e9edef] mt-2 -mx-3 -mb-3">
                    <button
                      type="button"
                      onClick={() => setActiveListModal(msg)}
                      className="w-full py-2.5 px-3 text-center text-[13px] font-semibold text-[#00a884] hover:bg-[#f5f6f6] active:bg-[#e9edef] transition-colors flex items-center justify-center gap-2"
                    >
                      <ListFilter className="h-4 w-4 text-[#00a884]" />
                      <span>{msg.buttonLabel || 'View options'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ================= NATIVE WHATSAPP LIST MENU MODAL ================= */}
      {activeListModal && activeListModal.listSections && (
        <div className="absolute inset-0 z-50 bg-black/40 flex flex-col justify-end animate-in fade-in-50">
          <div className="bg-white rounded-t-2xl max-h-[75%] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-[#f0f2f5]">
              <span className="text-xs font-bold text-slate-800">
                {activeListModal.buttonLabel || 'Select an option'}
              </span>
              <button
                type="button"
                onClick={() => setActiveListModal(null)}
                className="p-1 rounded text-slate-500 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
              {activeListModal.listSections.map((sec, sIdx) => (
                <div key={sIdx} className="py-2 space-y-1">
                  {sec.title && (
                    <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {sec.title}
                    </p>
                  )}
                  {sec.rows.map((row) => (
                    <button
                      key={row.reply_id}
                      type="button"
                      onClick={() => handleButtonClick(row)}
                      className="w-full px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-[#00a884]">
                          {row.title}
                        </p>
                        {row.description && (
                          <p className="text-[11px] text-slate-500 truncate">{row.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#00a884]" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= MESSAGE INPUT BAR ================= */}
      <div className="p-2.5 border-t border-slate-200 bg-[#f0f2f5]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              waitingForInput
                ? 'Type your answer to continue...'
                : 'Type a message...'
            }
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-[#111b21] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-xs transition-all hover:bg-[#008f6f] disabled:opacity-40 disabled:hover:bg-[#00a884]"
            title="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
}
