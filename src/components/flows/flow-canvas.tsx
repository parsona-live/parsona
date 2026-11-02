// 'use client';

// /**
//  * Canvas / mind-map view of a flow. Editable, in parity with the
//  * list view for everything except the trigger / header / fallback
//  * panels (those are list-only — they don't fit visually inside a
//  * node graph and the user can switch to List for them).
//  *
//  * What this view does:
//  *   - Renders every flow_node as a draggable tile, pan + zoom +
//  *     minimap. Drag positions persist via the editor context
//  *     (writing on dragStop, not every frame).
//  *   - Renders edges between nodes, labeled per slot (button title,
//  *     "true" / "false", list row title) so a branching flow reads
//  *     as a real decision tree.
//  *   - Click a node → side-sheet opens with the same per-node form
//  *     the list view uses, plus "Set as entry" / "Delete".
//  *   - Drag from a source handle on one node to a target handle on
//  *     another → wires that slot's `next_node_key`. Per-slot handles
//  *     for multi-outgoing types (condition, send_buttons, send_list)
//  *     so the user picks which branch they're wiring.
//  *   - Backspace / Delete on a selected node → removes it AND clears
//  *     every inbound `next_node_key` reference (no dangling arrows).
//  *   - Delete on a selected edge → clears just that slot.
//  *   - "+ Add node" floating button drops a new node at the visible
//  *     viewport center.
//  *   - Runs dagre auto-layout once on mount for flows whose
//  *     `position_x` / `position_y` are all zero (pre-canvas flows
//  *     and brand-new flows) — otherwise everything would pile at
//  *     the origin.
//  *
//  * The toggle in `flow-editor-shell.tsx` swaps this in for
//  * `<FlowBuilder>` on the same page. Both views share the same
//  * `BuilderState` via `useFlowEditor()` — toggling never resets
//  * unsaved edits, and a drag here updates the same nodes array the
//  * list view reads.
//  */

// import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import {
//   applyNodeChanges,
//   Background,
//   BackgroundVariant,
//   Controls,
//   Handle,
//   MiniMap,
//   Panel,
//   Position,
//   ReactFlow,
//   ReactFlowProvider,
//   useReactFlow,
//   type Connection,
//   type Node as RfNode,
//   type Edge as RfEdge,
//   type NodeChange,
//   type NodeProps,
//   type OnNodeDrag,
// } from '@xyflow/react';
// import '@xyflow/react/dist/style.css';
// import {
//   Plus,
//   Trash2,
//   Eye,
//   MapPin,
//   User,
//   Truck,
//   GalleryHorizontalEnd,
//   ListChecks,
//   FileText,
//   Tag,
//   CheckCheck,
//   Video,
//   Image as ImageIcon,
// } from 'lucide-react';

// import { useTranslations } from 'next-intl';

// import { cn } from '@/lib/utils';
// import { Button } from '@/components/ui/button';
// import {
//   Sheet,
//   SheetContent,
//   SheetDescription,
//   SheetFooter,
//   SheetHeader,
//   SheetTitle,
// } from '@/components/ui/sheet';
// import {
//   applyEdgeConnection,
//   deriveCanvasEdges,
//   outgoingSlots,
// } from '@/lib/flows/edges';
// import { autoLayout, shouldAutoLayout } from '@/lib/flows/layout';
// import {
//   NODE_META,
//   NodeIconChip,
//   groupNodeTypesByCategory,
//   nodeColors,
//   summarizeNode,
//   type BuilderNode,
//   type NodeType,
// } from './shared';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuGroup,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu';
// import { useFlowEditor } from './flow-editor-state';
// import { NodeConfigForm } from './forms/node-config-form';

// // React-Flow node `data` payload — the bits our custom renderer needs.
// interface NodeData extends Record<string, unknown> {
//   node: BuilderNode;
//   isEntry: boolean;
//   /** Validator's "look here" pulse — flashes the card border for
//    *  ~1.6s. Drives a CSS animation, doesn't change layout. */
//   isFlashed: boolean;
//   onDeleteNode?: (key: string) => void;
//   onTestNode?: (node: BuilderNode) => void;
// }

// const NODE_WIDTH = 270;
// // Best-effort default; actual height varies by summary length but
// // dagre needs SOMETHING to compute rank spacing. Underestimating is
// // safer than over (tighter layout that still doesn't overlap).
// const NODE_HEIGHT = 120;

// // ============================================================
// // Custom node — one card per flow node, styled to match the list
// // view's collapsed card so the two views feel like the same product.
// // ============================================================

// // Echo the design's green/red branch ports for the condition node's
// // true / false slots; every other slot inherits the node's own hue.
// // The true/false hues are derived from the start (emerald) and handoff
// // (rose) node colors so all branch/port colors stay single-sourced in
// // NODE_HUE — a palette tweak there can't leave these stale.
// function slotColor(nodeType: NodeType, slotId: string, fallback: string) {
//   if (nodeType === 'condition' && slotId === 'true') {
//     return nodeColors('start').solid;
//   }
//   if (nodeType === 'condition' && slotId === 'false') {
//     return nodeColors('handoff').solid;
//   }
//   return fallback;
// }

// function NodeBodyVisual({ node }: { node: BuilderNode }) {
//   const cfg = (node.config ?? {}) as Record<string, any>;
//   const headerType = cfg.header_type;
//   const headerMediaUrl = cfg.header_media_url;
//   const headerText = cfg.header_text;
//   const headerFilename = cfg.header_filename;

//   // Render header media / banner if configured
//   const renderHeader = () => {
//     if (!headerType || headerType === 'none') return null;

//     if (headerType === 'image' && headerMediaUrl) {
//       return (
//         <div className="relative aspect-video max-h-32 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-b border-[#e9edef] dark:border-[#2a3942]">
//           <img
//             src={headerMediaUrl}
//             alt="header"
//             className="w-full h-full object-cover"
//             onError={(e) => {
//               (e.target as HTMLElement).style.display = 'none';
//             }}
//           />
//           <span className="absolute bottom-1 right-1 bg-black/60 text-white rounded px-1 text-[8px] font-semibold">
//             IMAGE
//           </span>
//         </div>
//       );
//     }

//     if (headerType === 'video' && headerMediaUrl) {
//       return (
//         <div className="relative aspect-video max-h-24 w-full overflow-hidden bg-zinc-900 text-white flex flex-col items-center justify-center gap-1 border-b border-[#e9edef] dark:border-[#2a3942]">
//           <Video className="h-5 w-5 text-emerald-400" />
//           <span className="text-[9px] font-semibold">VIDEO</span>
//         </div>
//       );
//     }

//     if (headerType === 'document') {
//       return (
//         <div className="flex items-center gap-2 p-2 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222d34]">
//           <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
//           <span className="text-[10.5px] font-medium truncate text-[#111b21] dark:text-zinc-200">
//             {headerFilename || 'Document.pdf'}
//           </span>
//         </div>
//       );
//     }

//     if (headerType === 'text' && headerText) {
//       return (
//         <div className="px-2.5 pt-2 text-[11px] font-bold text-[#111b21] dark:text-zinc-100">
//           {headerText}
//         </div>
//       );
//     }

//     return null;
//   };

//   switch (node.node_type) {
//     case 'send_message': {
//       const text = (cfg.text as string) || '';
//       return (
//         <div className="overflow-hidden">
//           {renderHeader()}
//           <div className="p-2.5 text-xs text-[#111b21] dark:text-zinc-100 whitespace-pre-wrap leading-relaxed line-clamp-4">
//             {text || <span className="text-zinc-400 italic">Empty message text...</span>}
//           </div>
//           <div className="flex items-center justify-end gap-1 px-2.5 pb-1.5 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//         </div>
//       );
//     }

//     case 'send_media': {
//       const mediaUrl = (cfg.media_url as string) || '';
//       const mediaType = (cfg.media_type as string) || 'image';
//       const caption = (cfg.caption as string) || '';
//       return (
//         <div className="overflow-hidden">
//           {mediaUrl ? (
//             <div className="relative aspect-video max-h-32 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-b border-[#e9edef] dark:border-[#2a3942]">
//               {mediaType === 'image' ? (
//                 <img
//                   src={mediaUrl}
//                   alt="Media"
//                   className="w-full h-full object-cover"
//                   onError={(e) => {
//                     (e.target as HTMLElement).style.display = 'none';
//                   }}
//                 />
//               ) : (
//                 <div className="flex flex-col items-center justify-center h-full gap-1 text-zinc-500">
//                   <FileText className="h-6 w-6 text-purple-500" />
//                   <span className="text-[10px] uppercase font-semibold">{mediaType}</span>
//                 </div>
//               )}
//             </div>
//           ) : (
//             <div className="p-3 text-center text-[10px] text-zinc-400 border-b border-dashed border-[#e9edef]">
//               No media URL set
//             </div>
//           )}
//           {caption && (
//             <p className="p-2 text-xs text-[#111b21] dark:text-zinc-100 line-clamp-3 leading-relaxed">
//               {caption}
//             </p>
//           )}
//           <div className="flex items-center justify-end gap-1 px-2.5 pb-1.5 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//         </div>
//       );
//     }

//     case 'send_location': {
//       const name = (cfg.name as string) || 'Location Pin';
//       const address = (cfg.address as string) || '';
//       const lat = cfg.latitude;
//       const lng = cfg.longitude;
//       return (
//         <div className="p-2 space-y-1.5">
//           <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 p-2 space-y-1">
//             <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 text-xs">
//               <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
//               <span className="truncate">{name}</span>
//             </div>
//             {address && <p className="text-[10.5px] text-zinc-600 dark:text-zinc-400 line-clamp-1">{address}</p>}
//             {lat !== undefined && lng !== undefined && (
//               <span className="inline-block text-[9px] font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-zinc-800 px-1 py-0.2 rounded border border-emerald-300 dark:border-emerald-700">
//                 {lat}, {lng}
//               </span>
//             )}
//           </div>
//           <div className="flex items-center justify-end gap-1 px-1 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//         </div>
//       );
//     }

//     case 'send_contact': {
//       const formatted_name = (cfg.formatted_name as string) || 'Contact Card';
//       const phones = Array.isArray(cfg.phones) ? (cfg.phones as Array<{ phone: string }>) : [];
//       const phone = (cfg.phone as string) || phones[0]?.phone || '';
//       return (
//         <div className="p-2 space-y-1.5">
//           <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-2 flex items-center gap-2">
//             <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
//               {formatted_name.charAt(0).toUpperCase()}
//             </div>
//             <div className="min-w-0 flex-1 leading-tight">
//               <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs block truncate">{formatted_name}</span>
//               {phone && <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono block truncate">{phone}</span>}
//             </div>
//           </div>
//           <div className="flex items-center justify-end gap-1 px-1 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//         </div>
//       );
//     }

//     case 'request_address': {
//       const body = (cfg.body_text as string) || 'Provide delivery address';
//       const country = (cfg.country as string) || 'IN';
//       return (
//         <div className="p-2 space-y-1.5">
//           <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 p-2 space-y-1">
//             <div className="flex items-center justify-between text-xs font-bold text-purple-800 dark:text-purple-300">
//               <span className="flex items-center gap-1">
//                 <Truck className="h-3.5 w-3.5" />
//                 Address Request
//               </span>
//               <span className="text-[9px] px-1 py-0.2 rounded bg-purple-200 dark:bg-purple-900/60 font-semibold">{country}</span>
//             </div>
//             <p className="text-[10.5px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-tight">{body}</p>
//           </div>
//           <div className="flex items-center justify-end gap-1 px-1 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//         </div>
//       );
//     }

//     case 'send_carousel': {
//       const body = (cfg.body_text as string) || '';
//       const cards = Array.isArray(cfg.cards) ? (cfg.cards as Array<{ media_url?: string; body_text?: string }>) : [];
//       return (
//         <div className="overflow-hidden">
//           {body && <p className="p-2 text-xs text-[#111b21] dark:text-zinc-100 line-clamp-2">{body}</p>}
//           <div className="p-2 bg-[#f0f2f5] dark:bg-[#111b21] border-t border-[#e9edef] dark:border-[#222d34] flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400">
//             <span className="flex items-center gap-1.5">
//               <GalleryHorizontalEnd className="h-3.5 w-3.5" />
//               Carousel Cards
//             </span>
//             <span className="bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px]">
//               {cards.length} {cards.length === 1 ? 'card' : 'cards'}
//             </span>
//           </div>
//         </div>
//       );
//     }

//     case 'send_buttons': {
//       const text = (cfg.text as string) || '';
//       return (
//         <div className="overflow-hidden">
//           {renderHeader()}
//           <div className="p-2.5 text-xs text-[#111b21] dark:text-zinc-100 whitespace-pre-wrap leading-relaxed line-clamp-3">
//             {text || <span className="text-zinc-400 italic">Select an option below:</span>}
//           </div>
//           <div className="flex items-center justify-end gap-1 px-2.5 pb-1 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//         </div>
//       );
//     }

//     case 'send_list': {
//       const body = (cfg.body_text as string) || '';
//       const label = (cfg.button_label as string) || 'View Options';
//       return (
//         <div className="overflow-hidden">
//           {renderHeader()}
//           <div className="p-2.5 text-xs text-[#111b21] dark:text-zinc-100 whitespace-pre-wrap leading-relaxed line-clamp-3">
//             {body || <span className="text-zinc-400 italic">Select from list:</span>}
//           </div>
//           <div className="flex items-center justify-end gap-1 px-2.5 pb-1 text-[9px] text-[#667781] dark:text-[#8696a0]">
//             <span>10:42 AM</span>
//             <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
//           </div>
//           <div className="border-t border-[#e9edef] dark:border-[#2a3942] py-2 px-3 text-[#00a884] font-semibold text-xs flex items-center justify-center gap-1.5 bg-white dark:bg-[#1f2c34]">
//             <ListChecks className="h-3.5 w-3.5" />
//             <span>{label}</span>
//           </div>
//         </div>
//       );
//     }

//     case 'collect_input': {
//       const prompt = (cfg.prompt_text as string) || '';
//       const varKey = (cfg.var_key as string) || 'input';
//       return (
//         <div className="p-2.5 space-y-2">
//           <div className="text-xs text-[#111b21] dark:text-zinc-100 line-clamp-3 leading-relaxed">
//             {prompt || <span className="text-zinc-400 italic">Please enter your response...</span>}
//           </div>
//           <div className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 w-fit">
//             Save into: &#123;&#123;{varKey}&#125;&#125;
//           </div>
//         </div>
//       );
//     }

//     case 'condition': {
//       const key = (cfg.subject_key as string) || 'var';
//       const op = (cfg.operator as string) || 'equals';
//       const val = (cfg.value as string) ?? '';
//       return (
//         <div className="p-2.5">
//           <div className="rounded-lg bg-[#f0f2f5] dark:bg-[#111b21] p-2 text-[10.5px] font-mono border border-[#e2e8f0] dark:border-[#2a3942]">
//             <span className="text-zinc-500">IF </span>
//             <span className="font-bold text-zinc-800 dark:text-zinc-200">&#123;&#123;{key}&#125;&#125; </span>
//             <span className="text-amber-600 font-semibold">{op} </span>
//             {val && <span className="text-zinc-900 dark:text-zinc-100 font-bold">&quot;{val}&quot;</span>}
//           </div>
//         </div>
//       );
//     }

//     case 'set_tag': {
//       const tag = (cfg.tag_name as string) || 'tag';
//       const action = (cfg.action as string) || 'add';
//       return (
//         <div className="p-2.5">
//           <div className="text-[10.5px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 w-fit">
//             <Tag className="h-3.5 w-3.5" />
//             <span>{action === 'remove' ? 'Remove tag' : 'Add tag'}: #{tag}</span>
//           </div>
//         </div>
//       );
//     }

//     default:
//       return null;
//   }
// }

// function FlowNodeCard({ data, selected }: NodeProps) {
//   const t = useTranslations('Flows.builder');
//   const { node, isEntry, isFlashed, onDeleteNode, onTestNode } = data as NodeData;
//   const c = nodeColors(node.node_type);
//   const slots = outgoingSlots(node);
//   const isMultiSlot = slots.length > 1;

//   return (
//     <div
//       style={
//         {
//           '--nc': c.solid,
//           '--nc-soft': c.soft,
//           '--nc-ring': c.ring,
//           '--nc-text': c.text,
//           borderColor: selected ? '#00a884' : undefined,
//           boxShadow: selected
//             ? '0 0 0 2px #00a884, 0 12px 24px -6px rgba(11,20,26,0.18)'
//             : '0 2px 8px -1px rgba(11,20,26,0.08), 0 1px 3px rgba(11,20,26,0.05)',
//         } as React.CSSProperties
//       }
//       className={cn(
//         'relative w-[280px] rounded-2xl bg-white dark:bg-[#1f2c34] border border-[#d1d7db] dark:border-[#2a3942] transition-all text-left overflow-hidden select-none',
//         selected
//           ? 'border-[#00a884]'
//           : 'hover:border-[#00a884]/60',
//         isFlashed && '!border-amber-400 ring-2 ring-amber-400/60'
//       )}
//     >
//       {/* Target connection Handle on Left */}
//       <Handle
//         type="target"
//         position={Position.Left}
//         className="!bg-white !h-3 !w-3 !border-2 !border-[#00a884] shadow-xs"
//       />

//       {/* WhatsApp Node Header Strip */}
//       <div className="flex items-center justify-between px-3 py-2 bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222d34]">
//         <div className="flex items-center gap-1.5 min-w-0">
//           <NodeIconChip
//             type={node.node_type}
//             size={20}
//             iconSize={12}
//             className="rounded-md shrink-0"
//           />
//           <span
//             className="truncate text-[10px] font-bold tracking-wider uppercase"
//             style={{ color: c.text }}
//           >
//             {t(`nodes.${node.node_type}.label`)}
//           </span>
//           {isEntry && (
//             <span className="bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 rounded px-1 py-0.2 text-[8px] font-bold tracking-wider uppercase shrink-0">
//               {t('badgeEntry')}
//             </span>
//           )}
//         </div>

//         {/* Action icons: Eye (Test) + Trash (Delete) */}
//         <div className="flex items-center gap-0.5 shrink-0">
//           <button
//             type="button"
//             onClick={(e) => {
//               e.stopPropagation();
//               onTestNode?.(node);
//             }}
//             className="p-1 rounded text-zinc-500 hover:text-[#00a884] hover:bg-[#00a884]/10 transition"
//             title="Preview from this node"
//           >
//             <Eye className="h-3.5 w-3.5" />
//           </button>
//           {node.node_type !== 'start' && (
//             <button
//               type="button"
//               onClick={(e) => {
//                 e.stopPropagation();
//                 onDeleteNode?.(node.node_key);
//               }}
//               className="p-1 rounded text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
//               title="Delete node"
//             >
//               <Trash2 className="h-3.5 w-3.5" />
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Node Key Identifier */}
//       <div className="px-3 pt-1.5 pb-0.5 text-[9.5px] font-mono text-zinc-400 dark:text-zinc-500">
//         #{node.node_key}
//       </div>

//       {/* WhatsApp Message Bubble Area (Light Mode Aesthetic) */}
//       <div className="p-2">
//         <div className="rounded-xl bg-white dark:bg-[#1f2c34] border border-[#e2e8f0] dark:border-[#2a3942] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] overflow-hidden">
//           <NodeBodyVisual node={node} />

//           {/* Interactive Button Slots (Stacked like real WhatsApp reply buttons) */}
//           {node.node_type === 'send_buttons' && (
//             <div className="border-t border-[#e9edef] dark:border-[#2a3942] divide-y divide-[#e9edef] dark:divide-[#2a3942]">
//               {slots.map((slot) => (
//                 <div
//                   key={slot.id}
//                   className="relative flex items-center justify-between py-2 px-3 text-[#00a884] font-semibold text-xs hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors"
//                 >
//                   <span className="truncate pr-3">{slot.label}</span>
//                   <Handle
//                     type="source"
//                     id={slot.id}
//                     position={Position.Right}
//                     style={{ borderColor: '#00a884' }}
//                     className="!bg-white !relative !top-auto !right-auto !h-2.5 !w-2.5 !translate-x-[16px] !transform-none !border-2 shadow-xs"
//                   />
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Interactive Multi-Slots for condition / carousel / list rows */}
//           {isMultiSlot && node.node_type !== 'send_buttons' && (
//             <div className="border-t border-[#e9edef] dark:border-[#2a3942] divide-y divide-[#e9edef] dark:divide-[#2a3942]">
//               {slots.map((slot) => (
//                 <div
//                   key={slot.id}
//                   className="relative flex items-center justify-between py-1.5 px-3 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors"
//                 >
//                   <span className="truncate pr-3 font-medium text-[11px]">{slot.label}</span>
//                   <Handle
//                     type="source"
//                     id={slot.id}
//                     position={Position.Right}
//                     style={{ borderColor: slotColor(node.node_type, slot.id, c.solid) }}
//                     className="!bg-white !relative !top-auto !right-auto !h-2.5 !w-2.5 !translate-x-[16px] !transform-none !border-2 shadow-xs"
//                   />
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Single source connection handle for single-slot nodes */}
//       {!isMultiSlot && slots.length === 1 && (
//         <Handle
//           type="source"
//           id={slots[0].id}
//           position={Position.Right}
//           style={{ borderColor: c.solid }}
//           className="!bg-white !h-3 !w-3 !border-2 shadow-xs"
//         />
//       )}
//     </div>
//   );
// }

// const NODE_TYPES = { flow: FlowNodeCard };

// // ============================================================
// // Root canvas
// // ============================================================

// /**
//  * Outer wrapper provides the React-Flow context to the inner body,
//  * so `useReactFlow()` works from anywhere in `FlowCanvasInner`
//  * (notably, the pan-to-flash effect). The split is required because
//  * useReactFlow() must be called inside a ReactFlowProvider.
//  */
// export function FlowCanvas({ onTestNode }: { onTestNode?: (node: BuilderNode) => void }) {
//   return (
//     <ReactFlowProvider>
//       <FlowCanvasInner onTestNode={onTestNode} />
//     </ReactFlowProvider>
//   );
// }

// function FlowCanvasInner({ onTestNode }: { onTestNode?: (node: BuilderNode) => void }) {
//   const t = useTranslations('Flows.builder');
//   const {
//     state,
//     setState,
//     updateNodeConfig,
//     updateNodePosition,
//     updateNodePositions,
//     removeNode,
//     flashKey,
//   } = useFlowEditor();
//   const reactFlow = useReactFlow();
//   const builderNodes = state.nodes;
//   const entryNodeId = state.entry_node_id;

//   // Side-panel state — which node's form is open. Canvas-only UI; the
//   // list view's analogue is the per-card expanded set in
//   // flow-builder.tsx.
//   const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
//   const selectedNode = useMemo(
//     () =>
//       selectedNodeKey
//         ? (builderNodes.find((n) => n.node_key === selectedNodeKey) ?? null)
//         : null,
//     [selectedNodeKey, builderNodes]
//   );

//   const autoLayoutPositions = useMemo(() => {
//     const canvasEdges = deriveCanvasEdges(builderNodes);

//     return shouldAutoLayout(builderNodes)
//       ? autoLayout(
//           builderNodes.map((n) => ({
//             id: n.node_key,
//             width: NODE_WIDTH,
//             height: NODE_HEIGHT,
//           })),
//           canvasEdges.map((e) => ({ source: e.source, target: e.target })),
//           { direction: 'TB' }
//         )
//       : null;
//   }, [builderNodes]);

//   // If dagre had to place an all-zero flow, persist the generated
//   // positions into editor state once. Otherwise the next drag would
//   // save only the dragged node and every other node would fall back
//   // to (0,0), which feels like nodes teleporting around the canvas.
//   const persistedAutoLayoutRef = useRef(false);
//   useEffect(() => {
//     if (!autoLayoutPositions || persistedAutoLayoutRef.current) return;
//     persistedAutoLayoutRef.current = true;
//     updateNodePositions(
//       Object.fromEntries(
//         [...autoLayoutPositions].map(([key, pos]) => [key, pos])
//       )
//     );
//   }, [autoLayoutPositions, updateNodePositions]);

//   const derivedRfNodes = useMemo(() => {
//     const nodes: RfNode<NodeData>[] = builderNodes.map((n) => {
//       const fallback = autoLayoutPositions?.get(n.node_key);
//       return {
//         id: n.node_key,
//         type: 'flow',
//         position: {
//           x: fallback?.x ?? n.position_x ?? 0,
//           y: fallback?.y ?? n.position_y ?? 0,
//         },
//         data: {
//           node: n,
//           isEntry: n.node_key === entryNodeId,
//           isFlashed: n.node_key === flashKey,
//           onDeleteNode: (key: string) => removeNode(key),
//           onTestNode: (node: BuilderNode) => onTestNode?.(node),
//         },
//       };
//     });

//     return nodes;
//   }, [builderNodes, entryNodeId, flashKey, autoLayoutPositions, removeNode, onTestNode]);

//   const [rfNodes, setRfNodes] = useState<RfNode<NodeData>[]>(derivedRfNodes);

//   useEffect(() => {
//     setRfNodes(derivedRfNodes);
//   }, [derivedRfNodes]);

//   const rfEdges = useMemo(() => {
//     const canvasEdges = deriveCanvasEdges(builderNodes);

//     // sourceHandle is now wired up — the FlowNodeCard renders a Handle
//     // per slot whose id matches the scheme in edges.ts, so React-Flow
//     // can hang the arrow off the right place on each card.
//     const rfEdges: RfEdge[] = canvasEdges.map((e) => ({
//       id: e.id,
//       source: e.source,
//       target: e.target,
//       sourceHandle: e.sourceHandle,
//       label: e.label,
//       // Mode-aware via CSS tokens so edge chrome flips with light/dark.
//       labelStyle: { fill: 'var(--muted-foreground)', fontSize: 11 },
//       labelBgStyle: { fill: 'var(--card)' },
//       labelBgPadding: [4, 2] as [number, number],
//       labelBgBorderRadius: 4,
//       style: { stroke: 'var(--border)', strokeWidth: 1.5 },
//     }));

//     return rfEdges;
//   }, [builderNodes]);

//   const handleNodesChange = useCallback(
//     (changes: NodeChange<RfNode<NodeData>>[]) => {
//       setRfNodes((nodes) => applyNodeChanges(changes, nodes));
//     },
//     []
//   );

//   // Drag-to-position: React-Flow tracks the visual drag internally and
//   // fires this once on release. We write the final coordinate back to
//   // the editor context (which flips `dirty`); save then ships the new
//   // positions in the existing PUT /api/flows/[id] body (the route
//   // already destructures position_x / position_y per migration 010).
//   // Writing only on dragStop (not on every position-change tick during
//   // the drag) keeps state updates cheap on long drags.
//   const handleNodeDragStop = useCallback<OnNodeDrag<RfNode<NodeData>>>(
//     (_event, node) => {
//       updateNodePosition(node.id, node.position.x, node.position.y);
//     },
//     [updateNodePosition]
//   );

//   // Pan to the flashed node when the validator panel requests one.
//   // Animate over 400ms; landing zoom is whatever the user already has
//   // (don't force a zoom reset — that would be jarring mid-edit).
//   useEffect(() => {
//     if (!flashKey) return;
//     const node = builderNodes.find((n) => n.node_key === flashKey);
//     if (!node) return;
//     const x = (node.position_x ?? 0) + NODE_WIDTH / 2;
//     const y = (node.position_y ?? 0) + NODE_HEIGHT / 2;
//     reactFlow.setCenter(x, y, {
//       zoom: reactFlow.getZoom(),
//       duration: 400,
//     });
//   }, [flashKey, builderNodes, reactFlow]);

//   const handleNodeClick = useCallback(
//     (_event: React.MouseEvent, node: RfNode<NodeData>) => {
//       setSelectedNodeKey(node.id);
//     },
//     []
//   );

//   // Drag-to-connect: React-Flow fires onConnect when the user drops a
//   // handle drag onto a target handle. We look up the source node,
//   // compute the right config patch via applyEdgeConnection (matches
//   // the same slot scheme as deriveCanvasEdges), and dispatch via
//   // updateNodeConfig. The resulting state change re-derives edges on
//   // the next render — no need to maintain a separate edge list.
//   const handleConnect = useCallback(
//     (connection: Connection) => {
//       if (
//         !connection.source ||
//         !connection.target ||
//         !connection.sourceHandle
//       ) {
//         return;
//       }
//       const sourceNode = builderNodes.find(
//         (n) => n.node_key === connection.source
//       );
//       if (!sourceNode) return;
//       // Self-loops are a footgun (a button whose target is its own
//       // node = infinite reprompt). Reject silently — the user can
//       // still wire one via the per-node dropdown if they really want.
//       if (connection.source === connection.target) return;
//       const patch = applyEdgeConnection(
//         sourceNode,
//         connection.sourceHandle,
//         connection.target
//       );
//       if (patch) updateNodeConfig(connection.source, patch);
//     },
//     [builderNodes, updateNodeConfig]
//   );

//   // Keyboard delete (Backspace / Delete) + drag-to-trash. React-Flow
//   // fires this with the set of deleted-node objects; we route each
//   // through the editor context's removeNode (which now also unlinks
//   // inbound references so no dangling arrows survive). Closing the
//   // side panel on delete keeps the UI honest if the user deleted the
//   // node currently being edited.
//   const handleNodesDelete = useCallback(
//     (deleted: RfNode<NodeData>[]) => {
//       for (const n of deleted) {
//         removeNode(n.id);
//         if (selectedNodeKey === n.id) setSelectedNodeKey(null);
//       }
//     },
//     [removeNode, selectedNodeKey]
//   );

//   // Edge delete: clear the source node's slot rather than removing
//   // anything. Edges are derived from configs, so the only way to
//   // "delete" one is to null out its underlying next_node_key.
//   const handleEdgesDelete = useCallback(
//     (deleted: RfEdge[]) => {
//       for (const e of deleted) {
//         if (!e.sourceHandle) continue;
//         const sourceNode = builderNodes.find((n) => n.node_key === e.source);
//         if (!sourceNode) continue;
//         const patch = applyEdgeConnection(sourceNode, e.sourceHandle, '');
//         if (patch) updateNodeConfig(e.source, patch);
//       }
//     },
//     [builderNodes, updateNodeConfig]
//   );

//   // Wrapped mutators that target the currently-selected node — pass to
//   // the form so each keystroke goes through the editor context (which
//   // flips `dirty` and feeds the validator).
//   const onSelectedUpdateConfig = useCallback(
//     (patch: Record<string, unknown>) => {
//       if (selectedNodeKey) updateNodeConfig(selectedNodeKey, patch);
//     },
//     [selectedNodeKey, updateNodeConfig]
//   );

//   const handleDeleteSelected = useCallback(() => {
//     if (!selectedNodeKey) return;
//     removeNode(selectedNodeKey);
//     setSelectedNodeKey(null);
//   }, [selectedNodeKey, removeNode]);

//   const handleSetEntry = useCallback(() => {
//     if (!selectedNodeKey) return;
//     setState((s) => ({ ...s, entry_node_id: selectedNodeKey }));
//   }, [selectedNodeKey, setState]);

//   if (rfNodes.length === 0) {
//     return (
//       <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-sm">
//         <p>{t('noNodesYet')}</p>
//         <CanvasAddNodeButton t={t} />
//       </div>
//     );
//   }

//   return (
//     <>
//       <div className="h-full w-full overflow-hidden">
//         <ReactFlow
//           nodes={rfNodes}
//           edges={rfEdges}
//           nodeTypes={NODE_TYPES}
//           fitView
//           fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
//           proOptions={{ hideAttribution: true }}
//           onNodesChange={handleNodesChange}
//           onNodeDragStop={handleNodeDragStop}
//           onNodeClick={handleNodeClick}
//           onConnect={handleConnect}
//           onNodesDelete={handleNodesDelete}
//           onEdgesDelete={handleEdgesDelete}
//           // Default is "Backspace" only — accept both so Mac users
//           // hitting Delete (Fn+Backspace) get the same behavior.
//           deleteKeyCode={['Backspace', 'Delete']}
//           nodesConnectable={true}
//           edgesFocusable={true}
//           elementsSelectable={true}
//           // Lower default min/max zoom than the lib's defaults; the
//           // tiles already truncate their summary at a reasonable
//           // size, so we don't need to zoom past 1.5x.
//           minZoom={0.2}
//           maxZoom={1.5}
//         >
//           {/* Dot grid, matching the design's faint canvas backdrop. */}
//           <Background
//             variant={BackgroundVariant.Dots}
//             gap={22}
//             size={1.4}
//             color="var(--border)"
//           />
//           <Controls
//             className="!border-border !bg-card [&_button]:!border-border [&_button]:!bg-card [&_button:hover]:!bg-muted [&_button_svg]:!fill-foreground !overflow-hidden !rounded-xl !border !shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)]"
//             showInteractive={false}
//           />
//           <MiniMap
//             pannable
//             zoomable
//             nodeColor={(n) =>
//               nodeColors((n.data as NodeData).node.node_type).solid
//             }
//             nodeStrokeWidth={0}
//             nodeBorderRadius={3}
//             maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
//             className="!border-border !bg-card !rounded-xl !border !shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)]"
//           />
//           <Panel position="top-left" className="!top-4 !left-4">
//             <CanvasAddNodeButton t={t} />
//           </Panel>
//         </ReactFlow>
//       </div>

//       <NodeEditSheet
//         node={selectedNode}
//         isEntry={selectedNode?.node_key === entryNodeId}
//         allNodes={builderNodes}
//         onClose={() => setSelectedNodeKey(null)}
//         onUpdateConfig={onSelectedUpdateConfig}
//         onDelete={handleDeleteSelected}
//         onSetEntry={handleSetEntry}
//         t={t}
//       />
//     </>
//   );
// }

// // ============================================================
// // Side panel — opens when a canvas node is clicked. Mounts the
// // shared NodeConfigForm dispatcher so edits made here behave
// // identically to the list view's per-card editor.
// // ============================================================

// function NodeEditSheet({
//   node,
//   isEntry,
//   allNodes,
//   onClose,
//   onUpdateConfig,
//   onDelete,
//   onSetEntry,
//   t,
// }: {
//   node: BuilderNode | null;
//   isEntry: boolean;
//   allNodes: BuilderNode[];
//   onClose: () => void;
//   onUpdateConfig: (patch: Record<string, unknown>) => void;
//   onDelete: () => void;
//   onSetEntry: () => void;
//   t: ReturnType<typeof useTranslations>;
// }) {
//   // Sheet is controlled — opens when a node is selected, closes via
//   // Esc / overlay / close button (all delegated to onClose).
//   const open = node !== null;
//   if (!node) {
//     return (
//       <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
//         <SheetContent side="right" className="w-full sm:max-w-md" />
//       </Sheet>
//     );
//   }
//   const meta = NODE_META[node.node_type];
//   const c = nodeColors(node.node_type);
//   return (
//     <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
//       <SheetContent
//         side="right"
//         className="border-border bg-popover flex w-full flex-col gap-0 border-l p-0 sm:max-w-md"
//       >
//         <SheetHeader className="border-border flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
//           <NodeIconChip type={node.node_type} size={36} iconSize={18} />
//           <div className="min-w-0 flex-1">
//             <SheetTitle className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
//               <span style={{ color: c.text }}>{t(`nodes.${node.node_type}.label`)}</span>
//               {isEntry && (
//                 <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-300 uppercase">
//                   {t('badgeEntry')}
//                 </span>
//               )}
//             </SheetTitle>
//             <SheetDescription className="text-muted-foreground mt-0.5 text-xs">
//               {t(`nodes.${node.node_type}.blurb`)}
//             </SheetDescription>
//           </div>
//           <code className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
//             {node.node_key}
//           </code>
//         </SheetHeader>

//         <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
//           <NodeConfigForm
//             node={node}
//             allNodes={allNodes}
//             showAdvanced={false}
//             onUpdateConfig={onUpdateConfig}
//           />
//         </div>

//         <SheetFooter className="border-border border-t px-5 py-3 sm:flex-row sm:justify-between">
//           {!isEntry ? (
//             <Button variant="ghost" size="sm" onClick={onSetEntry}>
//               {t('setAsEntry')}
//             </Button>
//           ) : (
//             <span />
//           )}
//           <Button
//             variant="ghost"
//             size="sm"
//             onClick={onDelete}
//             className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
//           >
//             <Trash2 className="h-3.5 w-3.5" />
//             {t('deleteNode')}
//           </Button>
//         </SheetFooter>
//       </SheetContent>
//     </Sheet>
//   );
// }

// // ============================================================
// // Floating add-node button — bottom-right of the canvas. Mirrors
// // the list view's AddNodeButton (same dropdown menu, same NodeType
// // list, same icons via NODE_META) but drops the new node into the
// // center of the visible viewport rather than appending to a list.
// // ============================================================

// const ADD_NODE_TYPES: NodeType[] = [
//   'start',
//   'send_buttons',
//   'send_list',
//   'send_carousel',
//   'send_message',
//   'send_media',
//   'send_location',
//   'send_contact',
//   'request_address',
//   'collect_input',
//   'condition',
//   'set_tag',
//   'handoff',
//   'end',
// ];

// function CanvasAddNodeButton({ t }: { t: ReturnType<typeof useTranslations> }) {
//   const reactFlow = useReactFlow();
//   const { addNode, updateNodePosition } = useFlowEditor();

//   const handleAdd = (type: NodeType) => {
//     const key = addNode(type);
//     // Place the new node at the visible canvas center. The Panel's
//     // own DOM lives inside ReactFlow so we can climb up to find the
//     // .react-flow root and read its bounding rect. If we can't find
//     // it (test envs, etc.), addNode's default (0, 0) is the fallback
//     // and the user can drag the node into view.
//     const root = document.querySelector('.react-flow') as HTMLElement | null;
//     if (!root) return;
//     const rect = root.getBoundingClientRect();
//     const center = reactFlow.screenToFlowPosition({
//       x: rect.left + rect.width / 2,
//       y: rect.top + rect.height / 2,
//     });
//     // NODE_WIDTH / NODE_HEIGHT are the dagre layout defaults; offset
//     // so the card sits visually centered rather than top-left at the
//     // viewport center.
//     updateNodePosition(
//       key,
//       center.x - NODE_WIDTH / 2,
//       center.y - NODE_HEIGHT / 2
//     );
//   };

//   return (
//     <DropdownMenu>
//       <DropdownMenuTrigger
//         className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)] transition-colors"
//         aria-label={t('addNode')}
//       >
//         <Plus className="h-4 w-4" />
//         {t('addNode')}
//       </DropdownMenuTrigger>
//       <DropdownMenuContent
//         align="start"
//         className="border-border bg-popover w-[268px] p-1.5"
//       >
//         {groupNodeTypesByCategory(ADD_NODE_TYPES).map((group, i) => (
//           // DropdownMenuGroup (base-ui Menu.Group) is REQUIRED: the
//           // DropdownMenuLabel below is base-ui's Menu.GroupLabel, which
//           // throws at render without a Menu.Group ancestor. A plain <div>
//           // here crashed the page when this menu opened (issue #336).
//           <Fragment key={group.id}>
//             {i > 0 && <DropdownMenuSeparator />}
//             <DropdownMenuGroup>
//               <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-[11px] font-semibold tracking-wider uppercase">
//                 {t(`categories.${group.id}`)}
//               </DropdownMenuLabel>
//               {group.types.map((t_type) => {
//                 const meta = NODE_META[t_type];
//                 return (
//                   <DropdownMenuItem
//                     key={t_type}
//                     onClick={() => handleAdd(t_type)}
//                     className="gap-3 py-2"
//                   >
//                     <NodeIconChip
//                       type={t_type}
//                       size={28}
//                       iconSize={16}
//                       className="rounded-md"
//                     />
//                     <span className="flex flex-col">
//                       <span className="text-popover-foreground text-[13px] font-semibold">
//                         {t(`nodes.${t_type}.label`)}
//                       </span>
//                       <span className="text-muted-foreground text-[11.5px]">
//                         {t(`nodes.${t_type}.blurb`)}
//                       </span>
//                     </span>
//                   </DropdownMenuItem>
//                 );
//               })}
//             </DropdownMenuGroup>
//           </Fragment>
//         ))}
//       </DropdownMenuContent>
//     </DropdownMenu>
//   );
// }


'use client';

/**
 * Canvas / mind-map view of a flow. Editable, in parity with the
 * list view for everything except the trigger / header / fallback
 * panels (those are list-only — they don't fit visually inside a
 * node graph and the user can switch to List for them).
 *
 * What this view does:
 *   - Renders every flow_node as a draggable tile, pan + zoom +
 *     minimap. Drag positions persist via the editor context
 *     (writing on dragStop, not every frame).
 *   - Renders edges between nodes, labeled per slot (button title,
 *     "true" / "false", list row title) so a branching flow reads
 *     as a real decision tree.
 *   - Click a node → side-sheet opens with the same per-node form
 *     the list view uses, plus "Set as entry" / "Delete".
 *   - Drag from a source handle on one node to a target handle on
 *     another → wires that slot's `next_node_key`. Per-slot handles
 *     for multi-outgoing types (condition, send_buttons, send_list)
 *     so the user picks which branch they're wiring.
 *   - Backspace / Delete on a selected node → removes it AND clears
 *     every inbound `next_node_key` reference (no dangling arrows).
 *   - Delete on a selected edge → clears just that slot.
 *   - "+ Add node" floating button drops a new node at the visible
 *     viewport center.
 *   - Runs dagre auto-layout once on mount for flows whose
 *     `position_x` / `position_y` are all zero (pre-canvas flows
 *     and brand-new flows) — otherwise everything would pile at
 *     the origin.
 *
 * The toggle in `flow-editor-shell.tsx` swaps this in for
 * `<FlowBuilder>` on the same page. Both views share the same
 * `BuilderState` via `useFlowEditor()` — toggling never resets
 * unsaved edits, and a drag here updates the same nodes array the
 * list view reads.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
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
  Plus,
  Trash2,
  Eye,
  MapPin,
  User,
  Truck,
  GalleryHorizontalEnd,
  ListChecks,
  FileText,
  Tag,
  Video,
  Image as ImageIcon,
} from 'lucide-react';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  applyEdgeConnection,
  deriveCanvasEdges,
  outgoingSlots,
} from '@/lib/flows/edges';
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

// React-Flow node `data` payload — the bits our custom renderer needs.
interface NodeData extends Record<string, unknown> {
  node: BuilderNode;
  isEntry: boolean;
  /** Validator's "look here" pulse — flashes the card border for
   *  ~1.6s. Drives a CSS animation, doesn't change layout. */
  isFlashed: boolean;
  onDeleteNode?: (key: string) => void;
  onTestNode?: (node: BuilderNode) => void;
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

const HANDLE_BASE = '!h-2.5 !w-2.5 !border-[1.5px] !bg-card';

/** Muted placeholder for empty fields. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/60 italic">{children}</span>;
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
    <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground w-fit rounded px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </span>
  );
}

function BodyText({ children, lines = 3 }: { children: React.ReactNode; lines?: 2 | 3 | 4 }) {
  return (
    <p
      className={cn(
        'text-foreground text-xs leading-relaxed whitespace-pre-wrap',
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
          className="bg-muted max-h-28 w-full rounded-md object-cover"
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
      return <p className="text-foreground text-xs font-semibold">{headerText}</p>;
    }
    return null;
  };

  switch (node.node_type) {
    case 'send_message': {
      const text = (cfg.text as string) || '';
      return (
        <>
          {renderHeader()}
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
              className="bg-muted max-h-28 w-full rounded-md object-cover"
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
            <span className="text-foreground font-medium">{name}</span>
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
            <span className="text-foreground font-medium">{formatted_name}</span>
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
            <Truck className="text-muted-foreground h-3.5 w-3.5" />
            <Chip>{country}</Chip>
          </div>
        </>
      );
    }

    case 'send_carousel': {
      const body = (cfg.body_text as string) || '';
      const cards = Array.isArray(cfg.cards) ? (cfg.cards as unknown[]) : [];
      return (
        <>
          {body && <BodyText lines={2}>{body}</BodyText>}
          <IconLine icon={GalleryHorizontalEnd}>
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </IconLine>
        </>
      );
    }

    case 'send_buttons': {
      // Button rows render below the body as handle slots.
      const text = (cfg.text as string) || '';
      return (
        <>
          {renderHeader()}
          <BodyText>{text || <Placeholder>Select an option below</Placeholder>}</BodyText>
        </>
      );
    }

    case 'send_list': {
      const body = (cfg.body_text as string) || '';
      const label = (cfg.button_label as string) || 'View options';
      return (
        <>
          {renderHeader()}
          <BodyText>{body || <Placeholder>Select from list</Placeholder>}</BodyText>
          <IconLine icon={ListChecks}>{label}</IconLine>
        </>
      );
    }

    case 'collect_input': {
      const prompt = (cfg.prompt_text as string) || '';
      const varKey = (cfg.var_key as string) || 'input';
      return (
        <>
          <BodyText>{prompt || <Placeholder>Please enter your response…</Placeholder>}</BodyText>
          <Chip>&#123;&#123;{varKey}&#125;&#125;</Chip>
        </>
      );
    }

    case 'condition': {
      const key = (cfg.subject_key as string) || 'var';
      const op = (cfg.operator as string) || 'equals';
      const val = (cfg.value as string) ?? '';
      return (
        <p className="text-foreground font-mono text-[11px] leading-relaxed">
          <span className="text-muted-foreground">if </span>
          &#123;&#123;{key}&#125;&#125;{' '}
          <span className="text-muted-foreground">{op}</span>
          {val && <> &quot;{val}&quot;</>}
        </p>
      );
    }

    case 'set_tag': {
      const tag = (cfg.tag_name as string) || 'tag';
      const action = (cfg.action as string) || 'add';
      return (
        <IconLine icon={Tag}>
          {action === 'remove' ? 'Remove' : 'Add'} #{tag}
        </IconLine>
      );
    }

    default:
      return null;
  }
}

function FlowNodeCard({ data, selected }: NodeProps) {
  const t = useTranslations('Flows.builder');
  const { node, isEntry, isFlashed, onDeleteNode, onTestNode } = data as NodeData;
  const c = nodeColors(node.node_type);
  const slots = outgoingSlots(node);
  const isMultiSlot = slots.length > 1;
  const body = NodeBodyVisual({ node });

  return (
    <div
      className={cn(
        'group bg-card relative w-[260px] rounded-xl border text-left shadow-sm transition-shadow select-none',
        'hover:shadow-md',
        selected ? 'border-primary ring-primary ring-1' : 'border-border',
        isFlashed && '!border-amber-400 ring-2 ring-amber-400/60'
      )}
    >
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(HANDLE_BASE, '!border-muted-foreground/50')}
      />

      {/* Header: type chip + label + entry badge; actions on hover */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <NodeIconChip
          type={node.node_type}
          size={22}
          iconSize={13}
          className="shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="text-foreground truncate text-xs font-semibold">
            {t(`nodes.${node.node_type}.label`)}
          </span>
          {isEntry && (
            <span className="text-primary shrink-0 text-[10px] font-medium">
              {t('badgeEntry')}
            </span>
          )}
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5 transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTestNode?.(node);
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
            title="Preview from this node"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {node.node_type !== 'start' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode?.(node.node_key);
              }}
              className="text-muted-foreground rounded p-1 transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="Delete node"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {body && <div className="flex flex-col gap-1.5 px-3 pb-3">{body}</div>}

      {/* Per-branch rows (buttons, condition, list rows, carousel) —
          each row owns the source handle for its slot. */}
      {isMultiSlot && (
        <div className="border-border divide-border divide-y border-t">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={cn(
                'relative flex items-center px-3 py-1.5 text-[11px]',
                node.node_type === 'send_buttons'
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <span className="truncate pr-3">{slot.label}</span>
              <Handle
                type="source"
                id={slot.id}
                position={Position.Right}
                style={{ borderColor: slotColor(node.node_type, slot.id, 'var(--muted-foreground)') }}
                className={HANDLE_BASE}
              />
            </div>
          ))}
        </div>
      )}

      {/* Single source handle for single-slot nodes */}
      {!isMultiSlot && slots.length === 1 && (
        <Handle
          type="source"
          id={slots[0].id}
          position={Position.Right}
          className={cn(HANDLE_BASE, '!border-muted-foreground/50')}
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
export function FlowCanvas({ onTestNode }: { onTestNode?: (node: BuilderNode) => void }) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner onTestNode={onTestNode} />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner({ onTestNode }: { onTestNode?: (node: BuilderNode) => void }) {
  const t = useTranslations('Flows.builder');
  const {
    state,
    setState,
    updateNodeConfig,
    updateNodePosition,
    updateNodePositions,
    removeNode,
    flashKey,
  } = useFlowEditor();
  const reactFlow = useReactFlow();
  const builderNodes = state.nodes;
  const entryNodeId = state.entry_node_id;

  // Side-panel state — which node's form is open. Canvas-only UI; the
  // list view's analogue is the per-card expanded set in
  // flow-builder.tsx.
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
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
          onTestNode: (node: BuilderNode) => onTestNode?.(node),
        },
      };
    });

    return nodes;
  }, [builderNodes, entryNodeId, flashKey, autoLayoutPositions, removeNode, onTestNode]);

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
      // Mode-aware via CSS tokens so edge chrome flips with light/dark.
      labelStyle: { fill: 'var(--muted-foreground)', fontSize: 11 },
      labelBgStyle: { fill: 'var(--card)' },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: 'var(--border)', strokeWidth: 1.5 },
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

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RfNode<NodeData>) => {
      setSelectedNodeKey(node.id);
    },
    []
  );

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
  }, [selectedNodeKey, removeNode]);

  const handleSetEntry = useCallback(() => {
    if (!selectedNodeKey) return;
    setState((s) => ({ ...s, entry_node_id: selectedNodeKey }));
  }, [selectedNodeKey, setState]);

  if (rfNodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-sm">
        <p>{t('noNodesYet')}</p>
        <CanvasAddNodeButton t={t} />
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full overflow-hidden">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onConnect={handleConnect}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
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
        >
          {/* Dot grid, matching the design's faint canvas backdrop. */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color="var(--border)"
          />
          <Controls
            className="!border-border !bg-card [&_button]:!border-border [&_button]:!bg-card [&_button:hover]:!bg-muted [&_button_svg]:!fill-foreground !overflow-hidden !rounded-xl !border !shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)]"
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
            maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
            className="!border-border !bg-card !rounded-xl !border !shadow-[0_6px_20px_-8px_rgba(0,0,0,0.5)]"
          />
          <Panel position="top-left" className="!top-4 !left-4">
            <CanvasAddNodeButton t={t} />
          </Panel>
        </ReactFlow>
      </div>

      <NodeEditSheet
        node={selectedNode}
        isEntry={selectedNode?.node_key === entryNodeId}
        allNodes={builderNodes}
        onClose={() => setSelectedNodeKey(null)}
        onUpdateConfig={onSelectedUpdateConfig}
        onDelete={handleDeleteSelected}
        onSetEntry={handleSetEntry}
        t={t}
      />
    </>
  );
}

// ============================================================
// Side panel — opens when a canvas node is clicked. Mounts the
// shared NodeConfigForm dispatcher so edits made here behave
// identically to the list view's per-card editor.
// ============================================================

function NodeEditSheet({
  node,
  isEntry,
  allNodes,
  onClose,
  onUpdateConfig,
  onDelete,
  onSetEntry,
  t,
}: {
  node: BuilderNode | null;
  isEntry: boolean;
  allNodes: BuilderNode[];
  onClose: () => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onSetEntry: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  // Sheet is controlled — opens when a node is selected, closes via
  // Esc / overlay / close button (all delegated to onClose).
  const open = node !== null;
  if (!node) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const meta = NODE_META[node.node_type];
  const c = nodeColors(node.node_type);
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="border-border bg-popover flex w-full flex-col gap-0 border-l p-0 sm:max-w-md"
      >
        <SheetHeader className="border-border flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
          <NodeIconChip type={node.node_type} size={36} iconSize={18} />
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
              <span style={{ color: c.text }}>{t(`nodes.${node.node_type}.label`)}</span>
              {isEntry && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-300 uppercase">
                  {t('badgeEntry')}
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground mt-0.5 text-xs">
              {t(`nodes.${node.node_type}.blurb`)}
            </SheetDescription>
          </div>
          <code className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
            {node.node_key}
          </code>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <NodeConfigForm
            node={node}
            allNodes={allNodes}
            showAdvanced={false}
            onUpdateConfig={onUpdateConfig}
          />
        </div>

        <SheetFooter className="border-border border-t px-5 py-3 sm:flex-row sm:justify-between">
          {!isEntry ? (
            <Button variant="ghost" size="sm" onClick={onSetEntry}>
              {t('setAsEntry')}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('deleteNode')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
  'send_media',
  'send_location',
  'send_contact',
  'request_address',
  'collect_input',
  'condition',
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