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
      <div className="relative flex flex-col items-center border-r border-border bg-card py-3 px-1.5 shadow-sm transition-all duration-300 z-10 w-12 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
          title="Expand Node Library"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="relative flex flex-col border-r border-border bg-card text-card-foreground transition-all duration-300 z-10 w-72 shrink-0 h-full select-none">
      {/* Top Tabs: Messages vs Actions */}
      <div className="flex items-center border-b border-border bg-card px-2">
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={cn(
            'flex-1 py-3.5 text-xs font-semibold text-center transition-all relative',
            activeTab === 'messages'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
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
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Actions
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted ml-1 rounded"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="h-8 pl-8 text-xs bg-muted/60 border-input text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredNodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
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
                className="group flex items-center justify-between px-3.5 py-3 bg-card hover:bg-accent/40 border border-border hover:border-border/80 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-grab active:cursor-grabbing select-none text-left"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {def.label}
                  </span>
                </div>

                {/* 6-dot drag grip handle on right */}
                <GripVertical className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground shrink-0" />
              </div>
            );
          })
        )}
      </div>

      {/* Drag-and-drop hint */}
      <div className="px-3 pb-3 pt-1 border-t border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Drag a node onto the canvas to place it anywhere, or click to add it at the center.
        </p>
      </div>
    </aside>
  );
}

