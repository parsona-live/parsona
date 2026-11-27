'use client';

import { useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkspaceNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  active?: boolean;
  onClick: () => void;
}

export interface WorkspaceNavSection {
  title?: string;
  items: WorkspaceNavItem[];
}

export interface WorkspaceBreadcrumb {
  label: string;
  onClick?: () => void;
}

interface WorkspaceShellProps {
  sidebarTitle?: string;
  sections: WorkspaceNavSection[];
  sidebarExtra?: ReactNode;
  breadcrumbs?: WorkspaceBreadcrumb[];
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  sidebarFooter?: ReactNode;
  noPadding?: boolean;
  children: ReactNode;
}

/**
 * Secondary inner-dashboard workspace layout:
 * - Solid bg-card collapsible secondary sidebar with page title & grouped sections
 * - Solid bg-card top breadcrumb + compact title + action bar
 * - Main scrollable bg-background content area
 */
export function WorkspaceShell({
  sidebarTitle,
  sections,
  sidebarExtra,
  sidebarFooter,
  noPadding = false,
  children,
}: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="-m-4 sm:-m-6 flex min-h-[calc(100vh-3.5rem)] flex-col md:flex-row bg-background text-foreground">
      {/* Secondary Left Sidebar — solid bg-card matching main Sidebar */}
      <aside
        className={cn(
          'border-b md:border-b-0 md:border-r border-border bg-card flex flex-col shrink-0 transition-[width] duration-200',
          collapsed ? 'md:w-12' : 'md:w-60',
        )}
      >
        {/* Top Page Name + Collapse Header inside Secondary Sidebar — exact h-14 matching Workspace Header */}
        <div
          className={cn(
            'hidden md:flex h-14 shrink-0 items-center justify-between border-b border-border px-3.5 gap-2',
            collapsed && 'justify-center px-0',
          )}
        >
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
              {sidebarTitle || 'Workspace'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Mobile horizontal strip */}
        <div className="flex md:hidden items-center gap-1 overflow-x-auto px-3 py-2">
          {sections.flatMap((sec) =>
            sec.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                    item.active
                      ? 'bg-accent text-foreground border border-border'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            }),
          )}
        </div>

        {/* Desktop vertical grouped navigation */}
        <div className="hidden md:flex flex-1 flex-col justify-between overflow-y-auto py-3">
          <div className="space-y-4">
            {sections.map((section, sIdx) => (
              <div key={section.title || sIdx} className="space-y-1">
                {section.title && !collapsed && (
                  <div className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/75">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5 px-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors text-left',
                          item.active
                            ? 'bg-accent text-foreground font-semibold'
                            : 'text-foreground/90 hover:bg-muted/70 hover:text-foreground',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            item.active ? 'text-foreground' : 'text-foreground/80',
                          )}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge !== undefined && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!collapsed && sidebarExtra && (
              <div className="px-3 pt-2 border-t border-border/70">{sidebarExtra}</div>
            )}
          </div>

          {!collapsed && sidebarFooter && (
            <div className="pt-3 border-t border-border px-2.5">
              {sidebarFooter}
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area — no inner header, content starts directly at the top */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className={cn('flex-1 min-w-0', noPadding ? 'flex flex-col' : 'p-4 sm:p-5 space-y-4 overflow-x-hidden')}>
          {children}
        </div>
      </div>
    </div>
  );
}
