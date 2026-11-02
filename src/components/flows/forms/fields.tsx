"use client";

/**
 * Reusable field components shared across every per-node form.
 *
 * `NodeKeySelect` — picks a node from the flow's node list, rendered
 * with the source node's icon so the dropdown reads as
 * "destination = ◇ menu" rather than an opaque slug.
 *
 * `NextNodeRow` — wraps NodeKeySelect with a label; the most common
 * per-node form row ("after this node, advance to…").
 *
 * `TextRow` — wraps Input or Textarea behind a label. Pure UI sugar
 * to keep per-node forms uncluttered.
 *
 * Lives in src/components/flows/forms/ so both the list view's
 * collapsed-card editor and the canvas view's side-panel editor
 * (introduced in this PR) mount the exact same form components.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Image as ImageIcon, Video, FileText, Type, X } from "lucide-react";
import { NODE_META, type BuilderNode } from "../shared";

export function TextRow({
  label,
  value,
  onChange,
  rows = 1,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {rows > 1 ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="bg-muted"
        />
      ) : (
        <Input
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
