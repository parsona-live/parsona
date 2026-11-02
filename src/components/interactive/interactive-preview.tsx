"use client";

import { List, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InteractiveMessagePayload } from "@/lib/whatsapp/interactive";

/**
 * WhatsApp-style read-only render of an interactive message. Used both
 * in the builder's live preview and by the inbox message bubble so a
 * sent buttons/list message shows the same way it does on the phone.
 *
 * Purely presentational — the buttons/rows are not clickable here (the
 * customer taps them on their own device). Kept namespace-free so it can
 * be dropped into the composer, the automation builder, and the
 * quick-replies manager without namespace coupling: the three fallback
 * labels shown for empty fields default to plain English, and a host
 * that has a translator can pass its own via `labels`.
 */
export interface InteractivePreviewLabels {
  /** Shown in place of an empty body. */
  body?: string;
  /** Shown in place of an untitled reply button. */
  button?: string;
  /** Shown in place of an empty list button label. */
  menu?: string;
}

export function InteractivePreview({
  payload,
  className,
  labels,
}: {
  payload: InteractiveMessagePayload;
  className?: string;
  labels?: InteractivePreviewLabels;
}) {
  const bodyLabel = labels?.body ?? "Message body…";
  const buttonLabel = labels?.button ?? "Button";
  const menuLabel = labels?.menu ?? "Menu";

  if (payload.kind === "carousel") {
    return (
      <div className={cn("flex flex-col gap-2 max-w-[280px] sm:max-w-[420px]", className)}>
        {/* Main message bubble */}
        {(payload.body || payload.header || payload.footer) && (
          <div className="overflow-hidden rounded-lg bg-card p-3 text-foreground shadow-sm ring-1 ring-border">
            {payload.header ? (
              <p className="mb-1 break-words text-sm font-semibold">{payload.header}</p>
            ) : null}
            <p className="whitespace-pre-wrap break-words text-sm">
              {payload.body || <span className="text-muted-foreground">{bodyLabel}</span>}
            </p>
            {payload.footer ? (
              <p className="mt-1 break-words text-[11px] text-muted-foreground">{payload.footer}</p>
            ) : null}
          </div>
        )}

        {/* Carousel horizontal cards slider */}
        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar sm:scrollbar-thin">
          {(payload.cards ?? []).map((card, idx) => (
            <div
              key={card.card_index ?? idx}
              className="flex w-[190px] shrink-0 flex-col overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border"
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
                <div className="flex-1" />
              )}
              {card.buttons && card.buttons.length > 0 ? (
                <div className="mt-auto flex flex-col border-t border-border">
                  {card.buttons.map((b, btnIdx) => (
                    <button
                      key={b.id || btnIdx}
                      type="button"
                      disabled
                      className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-xs font-medium text-primary first:border-t-0"
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
  return (
    <div
      className={cn(
        "w-full max-w-[260px] overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border",
        className,
      )}
    >
      <div className="px-3 py-2">
        {payload.header ? (
          <p className="mb-1 break-words text-sm font-semibold">
            {payload.header}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {payload.body || (
            <span className="text-muted-foreground">{bodyLabel}</span>
          )}
        </p>
        {payload.footer ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {payload.footer}
          </p>
        ) : null}
      </div>

      {payload.kind === "buttons" ? (
        <div className="flex flex-col border-t border-border">
          {payload.buttons.map((b, i) => (
            <button
              key={b.id || i}
              type="button"
              disabled
              className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary first:border-t-0"
            >
              <Reply className="h-3.5 w-3.5" />
              <span className="truncate">{b.title || buttonLabel}</span>
            </button>
          ))}
        </div>
      ) : payload.kind === "list" ? (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary"
        >
          <List className="h-3.5 w-3.5" />
          <span className="truncate">{payload.button_label || menuLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
