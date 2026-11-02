"use client";

/**
 * View-switcher + chrome for the flow editor.
 *
 * Lays the editor out as one app-like column that fills the dashboard
 * content area (toolbar → mode row → stage → validation bar).
 *   - A segmented Canvas / List control on the left of the mode row.
 *   - Preview Flow + Expand Fullscreen buttons on the right.
 *   - Tags above the canvas are removed for a clean, professional workspace.
 *   - The active view is mounted inside an expanded stage with increased height
 *     and fullscreen expansion support.
 */

import { useEffect, useState, useCallback } from "react";
import { GitFork, List, Play, Maximize2, Minimize2 } from "lucide-react";

import { FlowBuilder } from "./flow-builder";
import { FlowCanvas } from "./flow-canvas";
import { FlowEditorProvider, useFlowEditor } from "./flow-editor-state";
import { EditorHeader } from "./header";
import { ValidationPanel } from "./validation-panel";
import { FlowSimulator } from "./flow-simulator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowRow, FlowNodeRow } from "@/lib/flows/types";
import type { BuilderNode } from "./shared";
import { useTranslations } from "next-intl";

const MOBILE_BREAKPOINT = "(max-width: 767px)";

type View = "canvas" | "list";

const STORAGE_KEY = "wacrm.flowEditor.view";

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
  const t = useTranslations("Flows.builder");
  const { state } = useFlowEditor();

  const [view, setView] = useState<View>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "canvas" || saved === "list") return saved;
    } catch {
      // Private browsing / disabled storage — fall through to default.
    }
    return "canvas";
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorNode, setSimulatorNode] = useState<string | null>(null);

  const isMobile = useMatchMedia(MOBILE_BREAKPOINT);
  const effectiveView: View = isMobile ? "list" : view;

  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  // Escape key exits fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  const handleTestNode = useCallback((node: BuilderNode) => {
    setSimulatorNode(node.node_key);
    setSimulatorOpen(true);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader />

      {/* Mode row: view toggle + action controls (tags above canvas removed) */}
      {!isMobile && (
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div
            role="group"
            aria-label={t("editorView")}
            className="inline-flex gap-0.5 rounded-lg border border-border bg-muted p-0.5"
          >
            <SegButton
              active={effectiveView === "canvas"}
              onClick={() => choose("canvas")}
              icon={<GitFork className="h-3.5 w-3.5" />}
              label={t("canvasView")}
            />
            <SegButton
              active={effectiveView === "list"}
              onClick={() => choose("list")}
              icon={<List className="h-3.5 w-3.5" />}
              label={t("listView")}
            />
          </div>

          {/* Right Toolbar Actions: Live Simulator Preview + Expand Canvas */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSimulatorNode(null);
                setSimulatorOpen(true);
              }}
              className="h-8 gap-1.5 rounded-lg border-border bg-card hover:bg-muted text-xs font-semibold shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
              <span>Preview Flow</span>
            </Button>

            {effectiveView === "canvas" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded((v) => !v)}
                className="h-8 gap-1.5 rounded-lg border-border bg-card hover:bg-muted text-xs font-semibold shadow-xs"
                title={isExpanded ? "Exit Fullscreen (Esc)" : "Expand Canvas"}
              >
                {isExpanded ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Expand Canvas</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stage: canvas or linear list with comfortable height */}
      <div
        className={cn(
          "relative mx-4 sm:mx-6 min-h-[580px] lg:min-h-[660px] h-[calc(100vh-270px)] overflow-hidden rounded-xl border border-border bg-card-2 transition-all duration-300 shadow-sm",
          isExpanded &&
            "fixed inset-0 z-50 m-0 h-screen w-screen min-h-screen rounded-none border-0"
        )}
      >
        {isExpanded && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border shadow-xl">
            <span className="text-xs font-medium text-muted-foreground">
              Fullscreen mode (Esc to exit)
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(false)}
              className="h-7 px-2 text-xs font-semibold"
            >
              <Minimize2 className="h-3.5 w-3.5 mr-1" />
              Exit
            </Button>
          </div>
        )}

        {effectiveView === "canvas" ? (
          <FlowCanvas onTestNode={handleTestNode} />
        ) : (
          <div className="absolute inset-0 overflow-y-auto">
            <FlowBuilder />
          </div>
        )}
      </div>

      {/* Validation / activate-readiness bar */}
      <div className="px-6 pb-5 pt-3">
        <ValidationPanel />
      </div>

      {/* WhatsApp Interactive Simulator */}
      <FlowSimulator
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        flow={initialFlow}
        nodes={state.nodes}
        initialNodeKey={simulatorNode}
      />
    </div>
  );
}

function SegButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
