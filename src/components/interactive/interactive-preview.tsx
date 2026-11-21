"use client";

import { useState } from "react";
import { List, Reply, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InteractiveMessagePayload } from "@/lib/whatsapp/interactive";
import type { ChannelType } from "@/types";

/**
 * Platform-adaptive render of an interactive message (Buttons, List, Carousel).
 * Used both in the builder's live preview and by the inbox message bubble.
 * Adapts appearance according to channel (WhatsApp, Instagram, Facebook).
 */
export interface InteractivePreviewLabels {
  /** Shown in place of an empty body. */
  body?: string;
  /** Shown in place of an untitled reply button. */
  button?: string;
  /** Shown in place of an empty list button label. */
  menu?: string;
}

export interface InteractivePreviewProps {
  payload: InteractiveMessagePayload;
  className?: string;
  labels?: InteractivePreviewLabels;
  channel?: ChannelType;
  isAgent?: boolean;
  inBubble?: boolean;
}

export function InteractivePreview({
  payload,
  className,
  labels,
  channel = "whatsapp",
  isAgent = false,
  inBubble = false,
}: InteractivePreviewProps) {
  const [listExpanded, setListExpanded] = useState(false);

  const bodyLabel = labels?.body ?? "Message body…";
  const buttonLabel = labels?.button ?? "Button";
  const menuLabel = labels?.menu ?? "Menu";

  // ----------------------------------------------------------
  // CAROUSEL VIEW
  // ----------------------------------------------------------
  if (payload.kind === "carousel") {
    return (
      <div className={cn("flex flex-col gap-2 max-w-[280px] sm:max-w-[420px]", className)}>
        {/* Main message header / body / footer */}
        {(payload.body || payload.header || payload.footer) && (
          <div
            className={cn(
              "p-2.5 text-xs sm:text-sm",
              !inBubble && "overflow-hidden rounded-xl bg-card p-3 text-foreground shadow-xs ring-1 ring-border"
            )}
          >
            {payload.header ? (
              <p className={cn("mb-1 break-words font-semibold", isAgent ? "text-inherit" : "text-foreground")}>
                {payload.header}
              </p>
            ) : null}
            <p className={cn("whitespace-pre-wrap break-words leading-relaxed", isAgent ? "text-inherit" : "text-foreground")}>
              {payload.body || <span className="opacity-70">{bodyLabel}</span>}
            </p>
            {payload.footer ? (
              <p className={cn("mt-1 break-words text-[11px]", isAgent ? "opacity-75" : "text-muted-foreground")}>
                {payload.footer}
              </p>
            ) : null}
          </div>
        )}

        {/* Carousel horizontal cards slider */}
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar sm:scrollbar-thin">
          {(payload.cards ?? []).map((card, idx) => (
            <div
              key={card.card_index ?? idx}
              className={cn(
                "flex w-[200px] shrink-0 flex-col overflow-hidden rounded-xl shadow-xs transition-shadow",
                channel === "instagram"
                  ? "border border-purple-500/25 bg-card text-card-foreground dark:border-purple-500/35"
                  : channel === "facebook"
                    ? "border border-blue-500/20 bg-card text-card-foreground dark:border-blue-500/30"
                    : "border border-border bg-card text-foreground"
              )}
            >
              {card.header_image_url ? (
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                  <img
                    src={card.header_image_url}
                    alt={card.body_text || `Card ${idx + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}
              {card.body_text ? (
                <div className="flex-1 p-2.5">
                  <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-foreground">
                    {card.body_text}
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-h-4" />
              )}
              {card.buttons && card.buttons.length > 0 ? (
                <div className="mt-auto flex flex-col border-t border-border/80">
                  {card.buttons.map((b, btnIdx) => (
                    <button
                      key={b.id || btnIdx}
                      type="button"
                      disabled
                      className={cn(
                        "flex items-center justify-center gap-1.5 border-t border-border/70 py-2 px-2 text-xs font-semibold first:border-t-0 transition-colors",
                        channel === "instagram"
                          ? "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                          : channel === "facebook"
                            ? "text-[#0084ff] dark:text-[#3897f0] hover:bg-blue-500/10"
                            : "text-primary hover:bg-muted/50"
                      )}
                    >
                      <Reply className="h-3 w-3 shrink-0" />
                      <span className="truncate">{b.title || buttonLabel}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // BUTTONS & LIST VIEWS
  // ----------------------------------------------------------
  const content = (
    <div className="flex flex-col">
      {/* Header, Body, Footer */}
      <div className={cn(!inBubble && "px-3.5 py-2.5")}>
        {payload.header ? (
          <p className={cn("mb-1 break-words text-sm font-bold tracking-tight", isAgent ? "text-inherit" : "text-foreground")}>
            {payload.header}
          </p>
        ) : null}
        <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed", isAgent ? "text-inherit" : "text-foreground")}>
          {payload.body || <span className="opacity-70">{bodyLabel}</span>}
        </p>
        {payload.footer ? (
          <p className={cn("mt-1.5 break-words text-[11px]", isAgent ? "opacity-75" : "text-muted-foreground")}>
            {payload.footer}
          </p>
        ) : null}
      </div>

      {/* Buttons Render */}
      {payload.kind === "buttons" && (
        <>
          {channel === "instagram" ? (
            /* Instagram Direct Buttons */
            isAgent ? (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {payload.buttons.map((b, i) => (
                  <button
                    key={b.id || i}
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/20 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-xs transition-all shadow-2xs hover:bg-white/25 active:scale-[0.99]"
                  >
                    <Reply className="h-3 w-3 shrink-0 text-white/90" />
                    <span className="truncate">{b.title || buttonLabel}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {payload.buttons.map((b, i) => (
                  <button
                    key={b.id || i}
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 shadow-2xs transition-all hover:bg-purple-500/15"
                  >
                    <Reply className="h-3 w-3 shrink-0" />
                    <span className="truncate">{b.title || buttonLabel}</span>
                  </button>
                ))}
              </div>
            )
          ) : channel === "facebook" ? (
            /* Facebook Messenger Buttons */
            isAgent ? (
              <div className="mt-2.5 flex flex-col border-t border-white/25">
                {payload.buttons.map((b, i) => (
                  <button
                    key={b.id || i}
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-1.5 border-t border-white/25 py-2.5 px-3 text-sm font-semibold text-white transition-colors first:border-t-0 hover:bg-white/10"
                  >
                    <Reply className="h-3.5 w-3.5 shrink-0 text-white/90" />
                    <span className="truncate">{b.title || buttonLabel}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 flex flex-col border-t border-border/70">
                {payload.buttons.map((b, i) => (
                  <button
                    key={b.id || i}
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-1.5 border-t border-border/70 py-2.5 px-3 text-sm font-semibold text-[#0084ff] dark:text-[#3897f0] transition-colors first:border-t-0 hover:bg-muted/50"
                  >
                    <Reply className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{b.title || buttonLabel}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* WhatsApp Buttons */
            <div
              className={cn(
                "mt-2 flex flex-col border-t",
                isAgent
                  ? "border-black/10 dark:border-white/15"
                  : "border-border/70"
              )}
            >
              {payload.buttons.map((b, i) => (
                <button
                  key={b.id || i}
                  type="button"
                  disabled
                  className={cn(
                    "flex items-center justify-center gap-1.5 border-t py-2 px-3 text-sm font-medium transition-colors first:border-t-0",
                    isAgent
                      ? "border-black/10 dark:border-white/15 text-primary dark:text-[#53bdeb] hover:bg-black/5 dark:hover:bg-white/5"
                      : "border-border/70 text-primary hover:bg-muted/50"
                  )}
                >
                  <Reply className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{b.title || buttonLabel}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* List Render */}
      {payload.kind === "list" && (
        <div className="mt-2.5 flex flex-col">
          <button
            type="button"
            onClick={() => setListExpanded((prev) => !prev)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all shadow-2xs",
              isAgent
                ? channel === "instagram"
                  ? "bg-white/25 border border-white/30 text-white hover:bg-white/30"
                  : channel === "facebook"
                    ? "bg-white/20 border border-white/25 text-white hover:bg-white/25"
                    : "bg-black/10 dark:bg-white/15 text-primary dark:text-[#53bdeb] hover:bg-black/15"
                : channel === "instagram"
                  ? "bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                  : channel === "facebook"
                    ? "bg-[#0084ff]/10 border border-[#0084ff]/30 text-[#0084ff] dark:text-[#3897f0] hover:bg-[#0084ff]/20"
                    : "bg-muted border border-border text-foreground hover:bg-muted/80"
            )}
          >
            <List className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{payload.button_label || menuLabel}</span>
            {listExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-70" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )}
          </button>

          {/* Expandable list sections & rows preview */}
          {listExpanded && (
            <div
              className={cn(
                "mt-2 flex flex-col gap-1.5 rounded-xl p-2 text-xs animate-in fade-in-50 duration-150",
                isAgent
                  ? "bg-black/25 dark:bg-black/40 text-white border border-white/20"
                  : "bg-card border border-border text-card-foreground shadow-sm"
              )}
            >
              {(payload.sections ?? []).map((sec, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  {sec.title && (
                    <span className="block px-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
                      {sec.title}
                    </span>
                  )}
                  {sec.rows.map((row, rIdx) => (
                    <div
                      key={row.id || rIdx}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5",
                        isAgent ? "bg-white/10 dark:bg-white/5" : "bg-muted/60"
                      )}
                    >
                      <p className="font-semibold">{row.title}</p>
                      {row.description && (
                        <p className="text-[10px] opacity-75">{row.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // If inside a message bubble, render directly without extra card framing
  if (inBubble) {
    return <div className={cn("w-full min-w-[200px] max-w-[280px]", className)}>{content}</div>;
  }

  // Standalone card view (e.g. within InteractiveBuilder or managers)
  return (
    <div
      className={cn(
        "w-full max-w-[280px] overflow-hidden rounded-xl bg-card text-foreground shadow-xs ring-1 ring-border",
        className
      )}
    >
      {content}
    </div>
  );
}
