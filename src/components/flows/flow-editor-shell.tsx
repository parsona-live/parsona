"use client";

/**
 * Visual Canvas Studio for the Flow Editor.
 *
 * Dedicated unified visual studio matching user layout:
 *   - Compact single-line header with Flow name, Edit badge, Status,
 *     Warning/Error issues popover pill, Go Back, Save changes, and Publish/Unpublish.
 *   - 100vh full-bleed studio layout (zero window scrollbars).
 *   - Horizontal workspace: Collapsible Sidebar (Messages & Actions) + Main Expandable Canvas.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Workflow,
  Code2,
  ChevronDown,
  AlertTriangle,
  Check,
  Loader2,
  Play,
  Pause,
  Sun,
  Moon,
} from "lucide-react";

import { FlowCanvas } from "./flow-canvas";
import { FlowSidebar } from "./flow-sidebar";
import { FlowJsonEditor } from "./flow-json-editor";
import { FlowEditorProvider, useFlowEditor } from "./flow-editor-state";
import { FlowChatPreview } from "./flow-chat-preview";
import { IssueLine } from "./validation-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import type { FlowRow, FlowNodeRow } from "@/lib/flows/types";
import type { BuilderNode } from "./shared";

interface Props {
  initialFlow: FlowRow;
  initialNodes: FlowNodeRow[];
}

export function FlowEditorShell({ initialFlow, initialNodes }: Props) {
  return (
    <FlowEditorProvider initialFlow={initialFlow} initialNodes={initialNodes}>
      <FlowEditorShellInner initialFlow={initialFlow} />
    </FlowEditorProvider>
  );
}

function FlowEditorShellInner({ initialFlow }: { initialFlow: FlowRow }) {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const {
    state,
    setState,
    dirty,
    saving,
    activating,
    canActivate,
    issues,
    save,
    setStatus,
    requestFlash,
    addNode,
  } = useFlowEditor();

  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const errors = issues.filter((i) => i.severity === "error");

  // Mutual-exclusion panel handlers: opening one right-side panel closes any other.
  const handleSelectNodeKey = useCallback((key: string | null) => {
    setSelectedNodeKey(key);
    if (key !== null) {
      setJsonOpen(false);
      setPreviewOpen(false);
    }
  }, []);

  const handleToggleJson = useCallback(() => {
    setJsonOpen((prev) => {
      const next = !prev;
      if (next) {
        setSelectedNodeKey(null);
        setPreviewOpen(false);
      }
      return next;
    });
  }, []);

  const handleTogglePreview = useCallback(() => {
    setPreviewOpen((prev) => {
      const next = !prev;
      if (next) {
        setSelectedNodeKey(null);
        setJsonOpen(false);
      }
      return next;
    });
  }, []);

  const handleTestNode = useCallback((_node: BuilderNode) => {
    setSelectedNodeKey(null);
    setJsonOpen(false);
    setPreviewOpen(true);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden select-none">
      {/* ================= COMPACT HEADER ================= */}
      <header className="h-12 border-b border-border bg-card text-card-foreground px-4 flex items-center justify-between shrink-0 z-20 gap-3">
        {/* Left: Flow icon, name input, Edit button, subtle inline status text */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-foreground shrink-0">
            <Workflow className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <input
              ref={nameInputRef}
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              placeholder="Untitled Flow"
              className="text-xs font-semibold text-foreground bg-transparent outline-none hover:bg-muted/50 focus:bg-background focus:ring-1 focus:ring-ring rounded px-1.5 py-0.5 max-w-[210px] truncate"
            />
            <button
              type="button"
              onClick={() => nameInputRef.current?.focus()}
              className="px-1.5 py-0.5 text-[11px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors shrink-0"
            >
              Edit
            </button>
          </div>
          {dirty ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0 pl-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved</span>
            </span>
          ) : issues.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0 pl-1">
              <Check className="h-3 w-3" />
              <span>Ready</span>
            </span>
          ) : null}
        </div>

        {/* Right: Issues, JSON, Preview, Theme, Go Back, Save, Active/Pause */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Validation Issues Alert Pill & Popover */}
          {issues.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIssuesOpen((v) => !v)}
                className={cn(
                  "h-7 flex items-center gap-1 px-2 text-[11px] font-semibold rounded border transition-colors",
                  errors.length > 0
                    ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>
                  {issues.length} {issues.length === 1 ? "issue" : "issues"}
                </span>
              </button>

              {issuesOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-72 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground p-3 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                    <span className="text-xs font-semibold text-foreground">
                      Validation Issues ({issues.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIssuesOpen(false)}
                      className="text-muted-foreground hover:text-foreground text-xs font-medium"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {issues.map((issue, idx) => (
                      <IssueLine
                        key={idx}
                        issue={issue}
                        onJump={(key) => {
                          requestFlash(key);
                          setIssuesOpen(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Single JSON Panel Toggle Button */}
          <button
            type="button"
            onClick={handleToggleJson}
            className={cn(
              "h-7 px-2.5 gap-1 rounded border text-[11px] font-semibold transition-all flex items-center",
              jsonOpen
                ? "border-purple-500 bg-purple-500/15 text-purple-600 dark:text-purple-400"
                : "border-border bg-card hover:bg-muted text-foreground"
            )}
            title="Toggle Flow JSON side panel"
          >
            <Code2 className="h-3.5 w-3.5 text-purple-500" />
            <span>JSON</span>
          </button>

          {/* Live Chat Preview Toggle */}
          <button
            type="button"
            onClick={handleTogglePreview}
            className={cn(
              "h-7 px-2.5 gap-1 rounded border text-[11px] font-semibold transition-all flex items-center",
              previewOpen
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-card hover:bg-muted text-foreground"
            )}
          >
            <Play
              className={cn(
                "h-3 w-3",
                previewOpen
                  ? "fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400"
                  : "fill-emerald-500 text-emerald-500"
              )}
            />
            <span>Preview</span>
          </button>

          {/* Theme Toggle Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleMode}
            className="h-7 w-7 p-0 rounded border-border bg-card hover:bg-muted text-foreground"
            title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme mode"
          >
            {mode === "dark" ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>

          <div className="h-4 w-px bg-border mx-0.5" />

          {/* Go Back */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/flows")}
            className="h-7 px-2.5 gap-1 rounded border-border bg-card hover:bg-muted text-[11px] font-semibold text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back</span>
          </Button>

          {/* Save changes */}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-7 px-3 text-[11px] font-semibold rounded bg-[#16a34a] hover:bg-[#15803d] text-white transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span>Save</span>
          </button>

          {/* Active / Pause button */}
          {state.status === "active" ? (
            <button
              type="button"
              onClick={() => void setStatus("draft")}
              disabled={activating}
              className="h-7 px-3 text-[11px] font-semibold rounded bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {activating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setStatus("active")}
              disabled={activating || !canActivate}
              title={!canActivate ? "Fix validation issues before activating" : undefined}
              className="h-7 px-3 text-[11px] font-semibold rounded bg-[#16a34a] hover:bg-[#15803d] text-white transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {activating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
              <span>Active</span>
            </button>
          )}
        </div>
      </header>

      {/* ================= MAIN WORKSPACE (SIDEBAR + CANVAS + JSON SIDE PANEL / CHAT PREVIEW) ================= */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-background relative">
        <FlowSidebar
          onAddNode={(type) => addNode(type)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        />
        <div className="flex-1 h-full min-w-0 relative flex bg-white [color-scheme:light]">
          <FlowCanvas
            onTestNode={handleTestNode}
            selectedNodeKey={selectedNodeKey}
            onSelectNodeKey={handleSelectNodeKey}
          />
        </div>
        {jsonOpen && (
          <aside className="w-[460px] lg:w-[540px] max-w-[90vw] h-full border-l border-border bg-card flex flex-col shrink-0 z-30 shadow-2xl">
            <FlowJsonEditor onSwitchToCanvas={() => setJsonOpen(false)} />
          </aside>
        )}
        {previewOpen && (
          <FlowChatPreview
            flow={{
              ...initialFlow,
              name: state.name,
              description: state.description,
              trigger_type: state.trigger_type,
              trigger_config: state.trigger_config,
              entry_node_id: state.entry_node_id,
              status: state.status,
            }}
            nodes={state.nodes}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
