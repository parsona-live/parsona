'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  NODE_REGISTRY,
  SIDEBAR_MESSAGES_NODES,
  SIDEBAR_ACTIONS_NODES,
} from '@/lib/flows/node-registry';
import type { FlowNodeType } from '@/lib/flows/types';

interface FlowSidebarProps {
  onAddNode: (type: FlowNodeType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function FlowSidebar({
  onAddNode,
  isCollapsed,
  onToggleCollapse,
}: FlowSidebarProps) {
  const [activeTab, setActiveTab] = useState<'messages' | 'actions'>('messages');
  const [searchQuery, setSearchQuery] = useState('');

  const nodeTypes = activeTab === 'messages' ? SIDEBAR_MESSAGES_NODES : SIDEBAR_ACTIONS_NODES;

  const filteredNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return nodeTypes;
    return nodeTypes.filter((type) => {
      const def = NODE_REGISTRY[type];
      return (
        def.label.toLowerCase().includes(q) ||
        def.blurb.toLowerCase().includes(q)
      );
    });
  }, [nodeTypes, searchQuery]);

  if (isCollapsed) {
    return (
      <div className="relative flex flex-col items-center border-r border-slate-200 bg-white py-3 px-1.5 shadow-sm transition-all duration-300 z-10 w-12 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
          title="Expand Node Library"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 z-10 w-72 shrink-0 h-full select-none">
      {/* Top Tabs: Messages vs Actions (Matching User Mockup) */}
      <div className="flex items-center border-b border-slate-200 bg-white px-2">
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={cn(
            'flex-1 py-3.5 text-xs font-semibold text-center transition-all relative',
            activeTab === 'messages'
              ? 'text-slate-900 border-b-2 border-slate-900'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          Messages
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('actions')}
          className={cn(
            'flex-1 py-3.5 text-xs font-semibold text-center transition-all relative',
            activeTab === 'actions'
              ? 'text-slate-900 border-b-2 border-slate-900'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          Actions
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-7 w-7 text-slate-400 hover:text-slate-700 ml-1 rounded"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="h-8 pl-8 text-xs bg-slate-50/70 border-slate-200 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-slate-400"
          />
        </div>
      </div>

      {/* Node List (Matching User's Screenshot Layout with Grip Handles) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredNodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No matching {activeTab} found
          </div>
        ) : (
          filteredNodes.map((type) => {
            const def = NODE_REGISTRY[type];
            if (!def) return null;
            const Icon = def.icon;

            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow-nodetype', type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onAddNode(type)}
                className="group flex items-center justify-between px-3.5 py-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing select-none text-left"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <Icon className="h-4 w-4 text-slate-700 shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-slate-950">
                    {def.label}
                  </span>
                </div>

                {/* 6-dot drag grip handle on right matching user mockup */}
                <GripVertical className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

