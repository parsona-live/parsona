"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Copy,
  Check,
  Sparkles,
  Play,
  RotateCcw,
  LayoutGrid,
  AlertCircle,
  FileCode,
  CheckCircle2,
  Info,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useFlowEditor } from "./flow-editor-state";
import {
  serializeFlowToJson,
  parseFlowFromJson,
  generateChatGptPrompt,
  generateMasterPrompt,
} from "@/lib/flows/flow-json";
import { autoLayoutNodes } from "@/lib/flows/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlowJsonEditorProps {
  onSwitchToCanvas?: () => void;
}

export function FlowJsonEditor({ onSwitchToCanvas }: FlowJsonEditorProps) {
  const { state, setState } = useFlowEditor();

  const [jsonText, setJsonText] = useState(() => serializeFlowToJson(state));
  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [appliedRecently, setAppliedRecently] = useState(false);
  const [showHelper, setShowHelper] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and line numbers column
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Re-serialize when switching to this tab if the state changed externally
  useEffect(() => {
    // Only re-sync if the current jsonText is already in sync with state or empty
    const currentSerialized = serializeFlowToJson(state);
    if (!jsonText || jsonText.trim() === "") {
      setJsonText(currentSerialized);
    }
  }, [state]);

  // Live syntax check
  const validationStatus = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      const nodeCount = Array.isArray(parsed?.nodes) ? parsed.nodes.length : 0;
      return {
        valid: true,
        error: null,
        nodeCount,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: msg,
        nodeCount: 0,
      };
    }
  }, [jsonText]);

  // Compute line count for line numbers
  const lines = useMemo(() => {
    const count = jsonText.split("\n").length;
    return Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1);
  }, [jsonText]);

  // Handle Tab key in textarea to insert 2 spaces
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;

      const newValue = value.substring(0, start) + "  " + value.substring(end);
      setJsonText(newValue);

      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Format / Prettify JSON
  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      toast.success("JSON formatted successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Cannot format invalid JSON: ${msg}`);
    }
  };

  // Auto layout nodes in JSON
  const handleAutoLayout = () => {
    const res = parseFlowFromJson(jsonText, state);
    if (!res.success || !res.state) {
      toast.error(res.error || "Please fix JSON syntax before auto-arranging");
      return;
    }
    const arrangedNodes = autoLayoutNodes(res.state.nodes);
    const updatedState = { ...res.state, nodes: arrangedNodes };
    const formatted = serializeFlowToJson(updatedState);
    setJsonText(formatted);
    toast.success("Nodes rearranged with clean visual coordinates");
  };

  // Reset to current visual canvas state
  const handleResetToCanvas = () => {
    setJsonText(serializeFlowToJson(state));
    toast.info("Reset JSON to match visual canvas");
  };

  // Copy Master Prompt with all nodes catalog, use cases, and full schemas
  const handleCopyMasterPrompt = async () => {
    try {
      const master = generateMasterPrompt(state);
      await navigator.clipboard.writeText(master);
      setCopiedMasterPrompt(true);
      toast.success(
        "Master AI Prompt copied! Contains all 22+ node types, use cases, and schemas.",
      );
      setTimeout(() => setCopiedMasterPrompt(false), 2500);
    } catch {
      toast.error("Failed to copy Master Prompt");
    }
  };

  // Copy standard ChatGPT prompt
  const handleCopyPrompt = async () => {
    try {
      const prompt = generateChatGptPrompt(state);
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      toast.success("ChatGPT / Claude Prompt copied! Paste it directly into your AI chat.");
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      toast.error("Failed to copy prompt to clipboard");
    }
  };

  // Copy raw JSON
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopiedJson(true);
      toast.success("Flow JSON copied to clipboard");
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      toast.error("Failed to copy JSON");
    }
  };

  // Apply JSON to flow state
  const handleApplyToCanvas = () => {
    const res = parseFlowFromJson(jsonText, state);
    if (!res.success || !res.state) {
      toast.error(res.error || "Invalid flow JSON");
      return;
    }

    setState(res.state);
    setAppliedRecently(true);
    toast.success(`Applied ${res.state.nodes.length} nodes to visual flow!`);

    if (res.warnings && res.warnings.length > 0) {
      res.warnings.forEach((w) => toast.warning(w));
    }

    setTimeout(() => {
      setAppliedRecently(false);
    }, 900);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-card overflow-hidden">
      {/* Side Panel Header */}
      <div className="h-12 border-b border-border bg-muted/40 px-3.5 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-4 w-4 text-purple-500 shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">Flow JSON</span>
          {validationStatus.valid ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="h-3 w-3" />
              <span>{validationStatus.nodeCount} nodes</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded truncate max-w-[180px]">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{validationStatus.error}</span>
            </span>
          )}
        </div>
        {onSwitchToCanvas && (
          <button
            type="button"
            onClick={onSwitchToCanvas}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close JSON side panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Single-Line Compact Action Toolbar */}
      <div className="border-b border-border bg-muted/20 px-3 py-1.5 flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          {/* Copy Master Prompt (no sparkles, no "(All Nodes)") */}
          <Button
            type="button"
            size="sm"
            onClick={handleCopyMasterPrompt}
            className="h-7 px-2.5 text-[11px] font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-2xs transition-all shrink-0"
            title="Copy Master Prompt with all node schemas for ChatGPT/Claude"
          >
            <span>{copiedMasterPrompt ? "Copied!" : "Copy Master Prompt"}</span>
          </Button>

          {/* Copy Raw JSON (icon-only) */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyJson}
            className="h-7 w-7 border-border shrink-0"
            title={copiedJson ? "Copied JSON" : "Copy JSON"}
            aria-label="Copy JSON"
          >
            {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          {/* Format / Prettify (icon-only) */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePrettify}
            disabled={!validationStatus.valid}
            className="h-7 w-7 border-border shrink-0"
            title="Format JSON (2-space indent)"
            aria-label="Format JSON"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Button>

          {/* Reset from Canvas (icon-only) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleResetToCanvas}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            title="Reset from Canvas"
            aria-label="Reset from Canvas"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Apply */}
        <Button
          type="button"
          size="sm"
          onClick={handleApplyToCanvas}
          disabled={!validationStatus.valid}
          className={cn(
            "h-7 px-2.5 gap-1 text-[11px] font-semibold text-white shadow-2xs transition-all shrink-0",
            appliedRecently
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          )}
          title="Apply JSON changes to visual canvas"
        >
          {appliedRecently ? <Check className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
          <span>{appliedRecently ? "Applied!" : "Apply"}</span>
        </Button>
      </div>

      {/* Editor Body: Line numbers + Code Textarea */}
      <div className="flex-1 flex min-h-0 relative font-mono text-xs leading-5 bg-background">
        {/* Line Numbers Column */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="w-12 select-none border-r border-border bg-muted/20 py-3 pr-2 text-right text-muted-foreground/50 overflow-hidden shrink-0 font-mono"
        >
          {lines.map((num) => (
            <div key={num} className="leading-5 h-5">
              {num}
            </div>
          ))}
        </div>

        {/* JSON Code Input Area */}
        <div className="flex-1 h-full min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="w-full h-full resize-none p-3 bg-transparent text-foreground outline-none font-mono text-xs leading-5 whitespace-pre tab-size-2 selection:bg-purple-500/25"
            placeholder="Paste or write flow JSON here..."
          />
        </div>
      </div>

      {/* Bottom Info Banner */}
      <div className="border-t border-border bg-muted/30 px-3 py-2 flex flex-col gap-1 text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-start gap-1.5 leading-snug">
          <Info className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
          <span className="whitespace-normal break-words">
            Click <strong>Copy Master Prompt</strong> for AI, paste back the JSON, then click <strong>Apply</strong>.
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pl-5">
          <span>Tab: 2 spaces</span>
          <span>Encoding: UTF-8</span>
        </div>
      </div>
    </div>
  );
}
