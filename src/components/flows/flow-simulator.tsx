'use client';

/**
 * Interactive WhatsApp Phone Simulator for Flow Builder.
 *
 * Allows users to test flows in a realistic WhatsApp mobile container:
 * - Emulates start / entry node progression.
 * - Interactive buttons, lists, carousels, location, contact, and address requests.
 * - Interactive text replies for `collect_input` nodes.
 * - Simulates branching for `condition` nodes.
 * - Real WhatsApp colors, timestamps, checkmarks, and layout.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Send,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  MapPin,
  User,
  Truck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Play,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuilderNode, NodeType } from './shared';
import type { FlowRow } from '@/lib/flows/types';

interface FlowSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  flow: FlowRow;
  nodes: BuilderNode[];
  initialNodeKey?: string | null;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  nodeKey?: string;
  nodeType?: NodeType;
  text?: string;
  headerType?: string;
  headerText?: string;
  headerMediaUrl?: string;
  headerFilename?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  buttons?: Array<{ reply_id: string; title: string; next_node_key?: string }>;
  buttonLabel?: string;
  listSections?: Array<{
    title?: string;
    rows: Array<{ reply_id: string; title: string; description?: string; next_node_key?: string }>;
  }>;
  carouselCards?: Array<{
    header_type?: string;
    media_url?: string;
    body_text?: string;
    buttons: Array<{ title: string; reply_id?: string; next_node_key?: string; type?: string; url?: string }>;
  }>;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    formatted_name: string;
    phone?: string;
    email?: string;
  };
  addressRequest?: {
    body_text: string;
    country: string;
  };
  timestamp: string;
}

export function FlowSimulator({
  isOpen,
  onClose,
  flow,
  nodes,
  initialNodeKey,
}: FlowSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentNodeKey, setCurrentNodeKey] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [activeInputNodeKey, setActiveInputNodeKey] = useState<string | null>(null);
  const [simVars, setSimVars] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, BuilderNode>();
    nodes.forEach((n) => map.set(n.node_key, n));
    return map;
  }, [nodes]);

  const entryKey = useMemo(() => {
    if (initialNodeKey && nodeMap.has(initialNodeKey)) {
      return initialNodeKey;
    }
    const startNode = nodes.find((n) => n.node_type === 'start');
    if (startNode) return startNode.node_key;
    if (nodes.length > 0) return nodes[0].node_key;
    return null;
  }, [initialNodeKey, nodes, nodeMap]);

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const interpolate = useCallback(
    (text?: string) => {
      if (!text) return '';
      return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
        return simVars[key] ?? `{{${key}}}`;
      });
    },
    [simVars]
  );

  // Advance simulation from a given node key
  const executeNode = useCallback(
    (nodeKey: string, currentHistory: ChatMessage[]): ChatMessage[] => {
      const node = nodeMap.get(nodeKey);
      if (!node) {
        return [
          ...currentHistory,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: `Node "${nodeKey}" not found.`,
            timestamp: getTimeString(),
          },
        ];
      }

      setCurrentNodeKey(node.node_key);
      const cfg = node.config as Record<string, unknown>;
      const time = getTimeString();

      switch (node.node_type) {
        case 'start': {
          const next = cfg.next_node_key as string | undefined;
          if (next) {
            return executeNode(next, currentHistory);
          }
          return currentHistory;
        }

        case 'send_message': {
          const text = interpolate(cfg.text as string);
          const next = cfg.next_node_key as string | undefined;
          const headerType = (cfg.header_type as string) || 'none';
          const headerText = interpolate((cfg.header_text as string) || '');
          const headerMediaUrl = (cfg.header_media_url as string) || '';
          const headerFilename = (cfg.header_filename as string) || '';

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
              headerMediaUrl,
              headerFilename,
              mediaUrl: headerType !== 'none' && headerType !== 'text' ? headerMediaUrl : undefined,
              mediaType: headerType,
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, nextHistory);
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
            return executeNode(next, nextHistory);
          }
          return nextHistory;
        }

        case 'send_location': {
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_location',
              location: {
                latitude: Number(cfg.latitude) || 0,
                longitude: Number(cfg.longitude) || 0,
                name: (cfg.name as string) || 'Shared Location',
                address: (cfg.address as string) || '',
              },
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, nextHistory);
          }
          return nextHistory;
        }

        case 'send_contact': {
          const next = cfg.next_node_key as string | undefined;
          const phones = Array.isArray(cfg.phones) ? (cfg.phones as Array<{ phone: string }>) : [];
          const phone = (cfg.phone as string) || (phones[0]?.phone ?? '');
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_contact',
              contact: {
                formatted_name: (cfg.formatted_name as string) || 'Contact Name',
                phone,
                email: (cfg.email as string) || '',
              },
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, nextHistory);
          }
          return nextHistory;
        }

        case 'request_address': {
          const next = cfg.next_node_key as string | undefined;
          const nextHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'request_address',
              addressRequest: {
                body_text: (cfg.body_text as string) || 'Please provide your delivery address',
                country: (cfg.country as string) || 'IN',
              },
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, nextHistory);
          }
          return nextHistory;
        }

        case 'send_buttons': {
          const text = interpolate((cfg.text as string) || '');
          const headerType = (cfg.header_type as string) || 'none';
          const headerText = interpolate((cfg.header_text as string) || '');
          const headerMediaUrl = (cfg.header_media_url as string) || '';
          const headerFilename = (cfg.header_filename as string) || '';
          const buttons = Array.isArray(cfg.buttons)
            ? (cfg.buttons as Array<{ reply_id: string; title: string; next_node_key?: string }>)
            : [];
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
              headerFilename,
              mediaUrl: headerType !== 'none' && headerType !== 'text' ? headerMediaUrl : undefined,
              mediaType: headerType,
              buttons,
              timestamp: time,
            },
          ];
        }

        case 'send_list': {
          const bodyText = interpolate((cfg.body_text as string) || (cfg.text as string) || '');
          const headerType = (cfg.header_type as string) || 'none';
          const headerText = interpolate((cfg.header_text as string) || '');
          const headerMediaUrl = (cfg.header_media_url as string) || '';
          const headerFilename = (cfg.header_filename as string) || '';
          const buttonLabel = (cfg.button_label as string) || (cfg.button_text as string) || 'View Options';
          const sections = Array.isArray(cfg.sections)
            ? (cfg.sections as Array<{
                title?: string;
                rows: Array<{ reply_id: string; title: string; description?: string; next_node_key?: string }>;
              }>)
            : [];
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_list',
              text: bodyText,
              buttonLabel,
              headerType,
              headerText,
              headerMediaUrl,
              headerFilename,
              mediaUrl: headerType !== 'none' && headerType !== 'text' ? headerMediaUrl : undefined,
              mediaType: headerType,
              listSections: sections,
              timestamp: time,
            },
          ];
        }

        case 'send_carousel': {
          const bodyText = interpolate((cfg.body_text as string) || '');
          const cards = Array.isArray(cfg.cards)
            ? (cfg.cards as Array<{
                header_type?: string;
                media_url?: string;
                body_text?: string;
                buttons: Array<{ title: string; reply_id?: string; next_node_key?: string; type?: string; url?: string }>;
              }>)
            : [];
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'send_carousel',
              text: bodyText,
              carouselCards: cards,
              timestamp: time,
            },
          ];
        }

        case 'collect_input': {
          const prompt = interpolate((cfg.prompt_text as string) || '');
          setActiveInputNodeKey(node.node_key);
          return [
            ...currentHistory,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              nodeKey: node.node_key,
              nodeType: 'collect_input',
              text: prompt,
              timestamp: time,
            },
          ];
        }

        case 'condition': {
          const trueNext = cfg.true_next as string | undefined;
          const falseNext = cfg.false_next as string | undefined;
          // In simulation, default to true branch if configured
          const target = trueNext || falseNext;
          const branchHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `sys-${Date.now()}-${Math.random()}`,
              sender: 'system',
              text: `Condition evaluated → following True branch (${target || 'End'})`,
              timestamp: time,
            },
          ];
          if (target) {
            return executeNode(target, branchHistory);
          }
          return branchHistory;
        }

        case 'set_tag': {
          const tagName = (cfg.tag_name as string) || 'tag';
          const next = cfg.next_node_key as string | undefined;
          const tagHistory: ChatMessage[] = [
            ...currentHistory,
            {
              id: `sys-${Date.now()}-${Math.random()}`,
              sender: 'system',
              text: `Applied tag: #${tagName}`,
              timestamp: time,
            },
          ];
          if (next) {
            return executeNode(next, tagHistory);
          }
          return tagHistory;
        }

        case 'handoff': {
          return [
            ...currentHistory,
            {
              id: `sys-${Date.now()}-${Math.random()}`,
              sender: 'system',
              text: `Conversation handed off to a live agent.`,
              timestamp: time,
            },
          ];
        }

        case 'end': {
          return [
            ...currentHistory,
            {
              id: `sys-${Date.now()}-${Math.random()}`,
              sender: 'system',
              text: `Flow completed.`,
              timestamp: time,
            },
          ];
        }

        default:
          return currentHistory;
      }
    },
    [nodeMap, interpolate]
  );

  // Initialize or reset flow
  const handleRestart = useCallback(() => {
    setActiveInputNodeKey(null);
    setInputText('');
    setSimVars({});
    if (entryKey) {
      const initial = executeNode(entryKey, []);
      setMessages(initial);
    } else {
      setMessages([
        {
          id: 'init-empty',
          sender: 'system',
          text: 'No entry or start node found in this flow.',
          timestamp: getTimeString(),
        },
      ]);
    }
  }, [entryKey, executeNode]);

  useEffect(() => {
    if (isOpen) {
      handleRestart();
    }
  }, [isOpen, handleRestart]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle user clicking an interactive button
  const handleSelectOption = (title: string, nextNodeKey?: string) => {
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: title,
      timestamp: getTimeString(),
    };
    const nextHist = [...messages, userMsg];
    if (nextNodeKey) {
      const advanced = executeNode(nextNodeKey, nextHist);
      setMessages(advanced);
    } else {
      setMessages([
        ...nextHist,
        {
          id: `sys-${Date.now()}`,
          sender: 'system',
          text: `Option "${title}" is not linked to any next node.`,
          timestamp: getTimeString(),
        },
      ]);
    }
  };

  // Handle user submitting text for collect_input
  const handleSendInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeInputNodeKey) return;

    const inputNode = nodeMap.get(activeInputNodeKey);
    const cfg = (inputNode?.config ?? {}) as Record<string, unknown>;
    const varKey = (cfg.var_key as string) || 'input';
    const next = cfg.next_node_key as string | undefined;

    setSimVars((prev) => ({ ...prev, [varKey]: inputText.trim() }));

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: inputText.trim(),
      timestamp: getTimeString(),
    };

    setInputText('');
    setActiveInputNodeKey(null);

    const nextHist = [...messages, userMsg];
    if (next) {
      const advanced = executeNode(next, nextHist);
      setMessages(advanced);
    } else {
      setMessages(nextHist);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col h-[90vh] max-h-[820px] w-full max-w-[420px] rounded-[40px] bg-zinc-950 p-3 shadow-2xl border-4 border-zinc-800 select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone Dynamic Island / Speaker Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 h-4 w-28 rounded-full bg-black flex items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-900 mr-2 border border-zinc-800" />
          <div className="h-1.5 w-8 rounded-full bg-zinc-900" />
        </div>

        {/* WhatsApp Top Bar */}
        <div className="flex items-center justify-between bg-[#008069] dark:bg-[#1f2c34] text-white pt-6 pb-2.5 px-3 rounded-t-[32px] z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 text-white/90 hover:text-white rounded-full transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-emerald-700 dark:bg-emerald-800 flex items-center justify-center text-white font-bold text-xs uppercase border border-white/20">
                {flow.name?.slice(0, 2) || 'WA'}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#008069]" />
            </div>
            <div className="leading-tight">
              <h3 className="text-sm font-semibold truncate max-w-[150px]">{flow.name || 'WhatsApp Flow'}</h3>
              <p className="text-[10px] text-emerald-100/80 font-normal">verified business · online</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-white/90">
            <button
              type="button"
              onClick={handleRestart}
              className="p-1.5 hover:bg-white/10 rounded-full transition"
              title="Restart simulation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full transition"
              title="Close simulator"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Area */}
        <div
          className="flex-1 overflow-y-auto p-3 space-y-3"
          style={{
            backgroundColor: '#efeae2',
            backgroundImage:
              'radial-gradient(#d1c7b7 0.8px, transparent 0.8px), radial-gradient(#d1c7b7 0.8px, #efeae2 0.8px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        >
          {/* Welcome Tag */}
          <div className="flex justify-center">
            <span className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm text-[10px] font-medium text-zinc-600 dark:text-zinc-300 py-1 px-3 rounded-lg shadow-sm border border-zinc-200/50">
              🔒 Messages are simulated end-to-end
            </span>
          </div>

          {messages.map((m) => {
            if (m.sender === 'system') {
              return (
                <div key={m.id} className="flex justify-center my-1">
                  <span className="bg-amber-100/90 text-amber-900 text-[10px] py-0.5 px-2.5 rounded-md shadow-xs border border-amber-200">
                    {m.text}
                  </span>
                </div>
              );
            }

            const isBot = m.sender === 'bot';

            return (
              <div key={m.id} className={cn('flex flex-col', isBot ? 'items-start' : 'items-end')}>
                {/* Main bubble */}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl p-2.5 shadow-sm text-xs relative leading-relaxed',
                    isBot
                      ? 'bg-white text-zinc-900 rounded-tl-xs border border-zinc-200/70'
                      : 'bg-[#d9fdd3] text-zinc-900 rounded-tr-xs border border-emerald-200/60'
                  )}
                >
                  {/* Media header / attachment */}
                  {m.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 aspect-video relative flex items-center justify-center">
                      {m.mediaType === 'image' ? (
                        <img
                          src={m.mediaUrl}
                          alt="media"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : m.mediaType === 'video' ? (
                        <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center shadow-md">
                            <Play className="h-5 w-5 fill-current ml-0.5" />
                          </div>
                          <span className="absolute bottom-1.5 right-2 text-[9px] text-white/90 bg-black/60 px-1.5 py-0.5 rounded font-mono font-semibold">
                            VIDEO
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 p-3 text-zinc-700 w-full bg-zinc-50">
                          <div className="h-8 w-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-semibold truncate block text-zinc-900">
                              {m.headerFilename || 'Document attachment'}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono uppercase">PDF / Document</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Header Text if specified */}
                  {m.headerText && (
                    <div className="font-bold text-zinc-900 text-xs mb-1">
                      {m.headerText}
                    </div>
                  )}

                  {/* Location card */}
                  {m.location && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50/70 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="truncate">{m.location.name}</span>
                      </div>
                      {m.location.address && (
                        <p className="text-[10px] text-zinc-600 leading-tight">{m.location.address}</p>
                      )}
                      <div className="text-[9px] font-mono text-emerald-700 bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200 w-fit">
                        {m.location.latitude.toFixed(4)}, {m.location.longitude.toFixed(4)}
                      </div>
                    </div>
                  )}

                  {/* Contact card */}
                  {m.contact && (
                    <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <span className="font-bold text-zinc-900 block truncate text-[11px]">
                          {m.contact.formatted_name}
                        </span>
                        {m.contact.phone && (
                          <span className="text-[10px] text-zinc-600 font-mono block">{m.contact.phone}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Address Request card */}
                  {m.addressRequest && (
                    <div className="mb-2 rounded-xl border border-purple-200 bg-purple-50/70 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-purple-800 font-bold text-[11px]">
                        <Truck className="h-3.5 w-3.5" />
                        <span>Address Request ({m.addressRequest.country})</span>
                      </div>
                      <p className="text-[10px] text-zinc-700">{m.addressRequest.body_text}</p>
                    </div>
                  )}

                  {/* Body Text */}
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                  {m.caption && <p className="whitespace-pre-wrap mt-1">{m.caption}</p>}

                  {/* Timestamp & checkmarks */}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-zinc-400 mt-1">
                    <span>{m.timestamp}</span>
                    {!isBot && <CheckCheck className="h-3 w-3 text-blue-500" />}
                  </div>
                </div>

                {/* Reply Buttons below bot bubble */}
                {m.buttons && m.buttons.length > 0 && (
                  <div className="w-[85%] mt-1 flex flex-col gap-1">
                    {m.buttons.map((btn) => (
                      <button
                        key={btn.reply_id}
                        type="button"
                        onClick={() => handleSelectOption(btn.title, btn.next_node_key)}
                        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 active:scale-[0.98] border border-zinc-200 hover:border-emerald-500 text-emerald-700 font-semibold text-center text-xs shadow-xs transition"
                      >
                        {btn.title}
                      </button>
                    ))}
                  </div>
                )}

                {/* List Menu rows below bot bubble */}
                {m.listSections && m.listSections.length > 0 && (
                  <div className="w-[85%] mt-1 rounded-xl bg-white border border-zinc-200 p-2 space-y-1.5 shadow-xs">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-1">
                      {m.buttonLabel || 'Options Menu'}
                    </div>
                    {m.listSections.flatMap((s) => s.rows || []).map((row) => (
                      <button
                        key={row.reply_id}
                        type="button"
                        onClick={() => handleSelectOption(row.title, row.next_node_key)}
                        className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 border border-transparent hover:border-zinc-300 transition"
                      >
                        <div className="font-semibold text-zinc-800 text-[11px]">{row.title}</div>
                        {row.description && (
                          <div className="text-[10px] text-zinc-500 line-clamp-1">{row.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Carousel Cards horizontal scroll */}
                {m.carouselCards && m.carouselCards.length > 0 && (
                  <div className="w-full mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {m.carouselCards.map((card, cIdx) => (
                      <div
                        key={cIdx}
                        className="w-[200px] shrink-0 rounded-2xl bg-white border border-zinc-200 overflow-hidden shadow-sm flex flex-col"
                      >
                        {card.media_url ? (
                          <img
                            src={card.media_url}
                            alt="card"
                            className="w-full h-24 object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-16 bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400">
                            Card #{cIdx + 1}
                          </div>
                        )}
                        <div className="p-2 flex-1">
                          {card.body_text && (
                            <p className="text-[11px] text-zinc-700 line-clamp-2 leading-tight">{card.body_text}</p>
                          )}
                        </div>
                        <div className="p-1.5 border-t border-zinc-100 space-y-1">
                          {(card.buttons || []).map((b, bIdx) => (
                            <button
                              key={bIdx}
                              type="button"
                              onClick={() => handleSelectOption(b.title, b.next_node_key)}
                              className="w-full py-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] text-center border border-emerald-200"
                            >
                              {b.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <form
          onSubmit={handleSendInput}
          className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-2.5 flex items-center gap-2 rounded-b-[32px] z-20"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!activeInputNodeKey}
            placeholder={
              activeInputNodeKey
                ? 'Type your response and hit Enter…'
                : 'Select a button option above…'
            }
            className="flex-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!activeInputNodeKey || !inputText.trim()}
            className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center disabled:opacity-40 transition"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

