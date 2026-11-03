"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Image as ImageIcon, Video, FileText, Type, X, Braces, ChevronDown } from "lucide-react";
import { NODE_META, type BuilderNode } from "../shared";
import { useOptionalFlowEditor } from "../flow-editor-state";

const CONTACT_VARIABLES = [
  { label: "Full Name", value: "{{contact.name}}" },
  { label: "Phone Number", value: "{{contact.phone}}" },
  { label: "Email Address", value: "{{contact.email}}" },
];

export function VariableDropdown({
  onSelect,
  nodes,
}: {
  onSelect: (variableTag: string) => void;
  nodes?: BuilderNode[];
}) {
  const editor = useOptionalFlowEditor();
  const allNodes = nodes || editor?.state?.nodes || [];

  // Collect flow variables dynamically defined across all input nodes in this workflow
  const flowVars: string[] = [];
  const seen = new Set<string>();

  for (const n of allNodes) {
    const cfg = (n.config || {}) as Record<string, any>;
    if ((n.node_type === "collect_input" || n.node_type === "input_flow") && cfg.var_key) {
      let key = String(cfg.var_key).trim();
      if (key.startsWith("vars.")) {
        key = key.slice(5);
      }
      if (key && !seen.has(key)) {
        seen.add(key);
        flowVars.push(key);
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex items-center gap-1 h-5 px-1.5 text-[11px] font-normal text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded transition-colors cursor-pointer select-none"
        title="Insert dynamic variable"
      >
        <Braces className="h-3 w-3 text-blue-500" />
        <span>Add Variable</span>
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs shadow-md">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-1">
            Flow Variables
          </DropdownMenuLabel>
          {flowVars.length > 0 ? (
            flowVars.map((v) => (
              <DropdownMenuItem
                key={v}
                onClick={() => onSelect(`{{vars.${v}}}`)}
                className="cursor-pointer font-mono text-[11px] py-1.5 flex items-center justify-between"
              >
                <span className="text-blue-600 font-semibold">{`{{vars.${v}}}`}</span>
                <span className="text-[10px] text-muted-foreground font-sans">input</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-1 text-[11px] text-muted-foreground italic">
              No input variables in flow yet
            </div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-1">
            Contact Attributes
          </DropdownMenuLabel>
          {CONTACT_VARIABLES.map((v) => (
            <DropdownMenuItem
              key={v.value}
              onClick={() => onSelect(v.value)}
              className="cursor-pointer font-mono text-[11px] py-1.5 flex items-center justify-between"
            >
              <span className="text-emerald-600 font-semibold">{v.value}</span>
              <span className="text-[10px] text-muted-foreground font-sans">{v.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TextRow({
  label,
  value,
  onChange,
  rows = 1,
  placeholder,
  allNodes,
  hideVariablePicker = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  allNodes?: BuilderNode[];
  hideVariablePicker?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInsertVariable = (varTag: string) => {
    const el = rows > 1 ? textareaRef.current : inputRef.current;
    if (!el) {
      onChange(value ? `${value} ${varTag}` : varTag);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.substring(0, start);
    const after = value.substring(end);
    const nextVal = `${before}${varTag}${after}`;
    onChange(nextVal);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + varTag.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-muted-foreground">{label}</label>
        {!hideVariablePicker && (
          <VariableDropdown onSelect={handleInsertVariable} nodes={allNodes} />
        )}
      </div>
      {rows > 1 ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="bg-muted"
        />
      ) : (
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-muted"
        />
      )}
    </div>
  );
}

export function NextNodeRow({
  value,
  allNodes,
  currentKey,
  onChange,
  label,
}: {
  value: string;
  allNodes: BuilderNode[];
  currentKey: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <NodeKeySelect
        value={value || null}
        nodes={allNodes}
        excludeKey={currentKey}
        onChange={(v) => onChange(v ?? "")}
        placeholder={useTranslations("Flows.builder.form")("pickNextNode")}
      />
    </div>
  );
}

export function NodeKeySelect({
  value,
  nodes,
  excludeKey,
  onChange,
  placeholder,
  className,
}: {
  value: string | null;
  nodes: BuilderNode[];
  excludeKey?: string;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("Flows.builder.form");
  const options = nodes.filter((n) => n.node_key !== excludeKey);
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className={cn("bg-muted", className)}>
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{t("none")}</SelectItem>
        {options.map((n) => {
          const Icon = NODE_META[n.node_type].icon;
          return (
            <SelectItem key={n.node_key} value={n.node_key}>
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  className={cn("h-3 w-3", NODE_META[n.node_type].color)}
                />
                {n.node_key}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function HeaderMediaSelector({
  headerType = "none",
  headerText = "",
  headerMediaUrl = "",
  headerFilename = "",
  onChange,
}: {
  headerType?: "none" | "text" | "image" | "video" | "document";
  headerText?: string;
  headerMediaUrl?: string;
  headerFilename?: string;
  onChange: (patch: {
    header_type?: "none" | "text" | "image" | "video" | "document";
    header_text?: string;
    header_media_url?: string;
    header_filename?: string;
  }) => void;
}) {
  const effectiveType = headerType || "none";

  return (
    <div className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">
          Header (Optional)
        </label>
        {effectiveType !== "none" && (
          <button
            type="button"
            onClick={() =>
              onChange({
                header_type: "none",
                header_text: "",
                header_media_url: "",
                header_filename: "",
              })
            }
            className="text-[10px] text-destructive hover:underline font-semibold"
          >
            Remove Header
          </button>
        )}
      </div>

      {/* Header Type Tabs */}
      <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1 text-center font-medium">
        {[
          { id: "none", label: "None", icon: null },
          { id: "text", label: "Text", icon: Type },
          { id: "image", label: "Image", icon: ImageIcon },
          { id: "video", label: "Video", icon: Video },
          { id: "document", label: "PDF", icon: FileText },
        ].map((opt) => {
          const Icon = opt.icon;
          const active = effectiveType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() =>
                onChange({
                  header_type: opt.id as any,
                  ...(opt.id === "none"
                    ? { header_text: "", header_media_url: "", header_filename: "" }
                    : {}),
                })
              }
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md text-[10px] font-semibold transition-all",
                active
                  ? "bg-card text-emerald-600 dark:text-emerald-400 font-bold shadow-xs border border-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Text Header Input */}
      {effectiveType === "text" && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Header text</span>
            <span className="text-[10px]">{headerText.length}/60</span>
          </div>
          <Input
            value={headerText}
            maxLength={60}
            onChange={(e) => onChange({ header_text: e.target.value })}
            placeholder="e.g. Welcome to our service"
            className="bg-card text-xs"
          />
        </div>
      )}

      {/* Media Header Inputs */}
      {["image", "video", "document"].includes(effectiveType) && (
        <div className="space-y-2 pt-1">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                HTTPS {effectiveType === "image" ? "Image" : effectiveType === "video" ? "Video" : "Document"} Direct URL
              </span>
              {headerMediaUrl && (
                <button
                  type="button"
                  onClick={() => onChange({ header_media_url: "" })}
                  className="text-[10px] text-destructive hover:underline"
                >
                  Clear URL
                </button>
              )}
            </div>
            <Input
              type="url"
              value={headerMediaUrl}
              onChange={(e) => onChange({ header_media_url: e.target.value })}
              placeholder={
                effectiveType === "image"
                  ? "https://example.com/banner.jpg"
                  : effectiveType === "video"
                  ? "https://example.com/demo.mp4"
                  : "https://example.com/brochure.pdf"
              }
              className="bg-card text-xs font-mono"
            />
          </div>

          {effectiveType === "document" && (
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">File display name (optional)</label>
              <Input
                value={headerFilename}
                onChange={(e) => onChange({ header_filename: e.target.value })}
                placeholder="e.g. Catalogue.pdf"
                className="bg-card text-xs"
              />
            </div>
          )}

          {/* Media Live Preview */}
          {headerMediaUrl ? (
            <div className="rounded-xl overflow-hidden border border-border bg-muted/40 aspect-video relative flex items-center justify-center max-h-36">
              {effectiveType === "image" ? (
                <img
                  src={headerMediaUrl}
                  alt="Header preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : effectiveType === "video" ? (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <Video className="h-6 w-6 text-purple-500" />
                  <span className="text-[10px] font-semibold">Video Header Ready</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-6 w-6 text-emerald-500" />
                  <span className="text-[10px] font-semibold">PDF Document Header Ready</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 p-2 text-center text-[10.5px] text-muted-foreground">
              Paste an image or video URL above to attach as header
            </div>
          )}
        </div>
      )}
    </div>
  );
}
