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
      if (onSwitchToCanvas) {
        onSwitchToCanvas();
      }
    }, 400);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-card overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-border bg-muted/40 px-4 flex items-center justify-between shrink-0 gap-3">
        {/* Left: Mode indicator & validation status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileCode className="h-4 w-4 text-purple-500" />
            <span>Flow JSON Schema</span>
          </div>

          <div className="h-4 w-px bg-border" />

          {validationStatus.valid ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="h-3 w-3" />
              <span>Valid ({validationStatus.nodeCount} nodes)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md truncate max-w-[320px]">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{validationStatus.error}</span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Master Prompt with All Nodes Encyclopedia & Use Cases */}
          <Button
            type="button"
            size="sm"
            onClick={handleCopyMasterPrompt}
            className="h-8 gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-2xs transition-all"
            title="Copy comprehensive Master Prompt with all 22+ node types, use cases, schemas, and instructions for ChatGPT/Claude"
          >
            {copiedMasterPrompt ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-white" />
            )}
            <span>{copiedMasterPrompt ? "Master Prompt Copied!" : "Copy Master Prompt (All Nodes)"}</span>
          </Button>

          {/* Copy Raw JSON */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="h-8 gap-1.5 text-xs font-medium border-border"
            title="Copy raw JSON"
          >
            {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
          </Button>

          {/* Format / Prettify */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrettify}
            disabled={!validationStatus.valid}
            className="h-8 gap-1.5 text-xs font-medium border-border"
            title="Format JSON with standard 2-space indentation"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>Format</span>
          </Button>

          {/* Auto Layout */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoLayout}
            disabled={!validationStatus.valid}
            className="h-8 gap-1.5 text-xs font-medium border-border"
            title="Automatically compute layout positions for all nodes"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Auto Layout</span>
          </Button>

          {/* Reset from Canvas */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToCanvas}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Discard current text and restore from visual canvas"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>

          {/* Apply to Visual Canvas */}
          <Button
            type="button"
            size="sm"
            onClick={handleApplyToCanvas}
            disabled={!validationStatus.valid}
            className={cn(
              "h-8 gap-1.5 text-xs font-semibold text-white shadow-2xs transition-all",
              appliedRecently
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            )}
          >
            {appliedRecently ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{appliedRecently ? "Applied!" : "Apply to Canvas"}</span>
          </Button>
        </div>
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
      <div className="h-8 border-t border-border bg-muted/30 px-4 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-purple-500 shrink-0" />
          <span>
            Click <strong>Copy Master Prompt</strong> to give ChatGPT/Claude all 22+ node types with use cases and schemas, paste back the JSON, then click <strong>Apply to Canvas</strong>.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Tab: 2 spaces</span>
          <span>Encoding: UTF-8</span>
        </div>
      </div>
    </div>
  );
}
