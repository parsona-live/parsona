"use client";

import { cn } from "@/lib/utils";
import type {
  ChannelType,
  Message,
  MessageReaction,
  MessageTemplate,
  TemplateButton,
} from "@/types";
import type { InteractiveMessagePayload } from "@/lib/whatsapp/interactive";
import {
  Clock,
  Check,
  CheckCheck,
  Contact,
  XCircle,
  MapPin,
  LayoutTemplate,
  CornerDownLeft,
  Sparkles,
  Reply,
  ExternalLink,
  Phone,
  Copy,
  type LucideIcon,
  Sparkle,
} from "lucide-react";
import { format } from "date-fns";
import { ReplyQuote } from "./reply-quote";
import { MessageReactions } from "./message-reactions";
import { LinkifyText } from "@/lib/inbox/linkify-text";
import { ChannelIcon } from "@/components/channels/channel-badge";
import {
  MediaAudioBubble,
  MediaDocumentBubble,
  MediaImageBubble,
  MediaUnavailable,
  MediaVideoBubble,
} from "./message-media";
import { InteractivePreview } from "@/components/interactive/interactive-preview";
import {
  templateMessageView,
  type TemplateMessageHeader,
} from "@/lib/whatsapp/template-message-view";
import { useTranslations } from "next-intl";

interface MessageBubbleProps {
  message: Message;
  channel?: ChannelType;
  template?: MessageTemplate | null;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  onToggleReaction?: (emoji: string) => void;
  /**
   * Opens the thread's media viewer on this message. Only images and videos
   * call it; omitted when the parent renders no viewer, in which case media
   * stays inline and non-clickable.
   */
  onOpenMedia?: (messageId: string) => void;
}

/** Safely extracts and parses an interactive payload from message data */
function parseInteractivePayload(
  raw: unknown,
  contentText?: string | null
): InteractiveMessagePayload | null {
  if (raw) {
    if (typeof raw === "object") return raw as InteractiveMessagePayload;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === "object" &&
          ("kind" in parsed || "buttons" in parsed || "cards" in parsed || "sections" in parsed)
        ) {
          return parsed as InteractiveMessagePayload;
        }
      } catch {}
    }
  }
  if (contentText && contentText.trim().startsWith("{") && contentText.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(contentText);
      if (
        parsed &&
        typeof parsed === "object" &&
        ("kind" in parsed || "buttons" in parsed || "cards" in parsed || "sections" in parsed)
      ) {
        return parsed as InteractiveMessagePayload;
      }
    } catch {}
  }
  return null;
}

/** Channel-specific bubble styling and badges */
function getBubbleClasses({
  channel,
  isAgent,
}: {
  channel: ChannelType;
  isAgent: boolean;
}) {
  switch (channel) {
    case "instagram":
      return {
        bubble: isAgent
          ? "rounded-[22px] rounded-br-[4px] bg-[#7000ff] dark:bg-[#6228d7] text-white shadow-xs font-normal"
          : "rounded-[22px] rounded-bl-[4px] bg-[#efefef] text-[#111827] dark:bg-[#262626] dark:text-[#f9fafb] shadow-xs",
        metaText: isAgent ? "text-white/85" : "text-[#111827]/60 dark:text-[#f9fafb]/60",
        badgeAi: isAgent
          ? "bg-white/20 text-white border border-white/25"
          : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
        badgeHuman: isAgent
          ? "bg-white/20 text-white border-white/30"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
        linkClass: isAgent ? "text-white underline underline-offset-2 hover:opacity-85 font-medium" : undefined,
      };
    case "facebook":
      return {
        bubble: isAgent
          ? "rounded-[20px] rounded-br-[4px] bg-[#0084ff] text-white shadow-xs font-normal"
          : "rounded-[20px] rounded-bl-[4px] bg-[#e4e6eb] text-[#050505] dark:bg-[#3a3b3c] dark:text-[#e4e6eb] shadow-xs",
        metaText: isAgent ? "text-white/85" : "text-[#050505]/60 dark:text-[#e4e6eb]/60",
        badgeAi: isAgent
          ? "bg-white/20 text-white border border-white/25"
          : "bg-[#0084ff]/10 text-[#0084ff] dark:text-[#3897f0]",
        badgeHuman: isAgent
          ? "bg-white/20 text-white border-white/30"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
        linkClass: isAgent ? "text-white underline underline-offset-2 hover:opacity-85 font-medium" : undefined,
      };
    case "whatsapp":
    default:
      return {
        bubble: isAgent
          ? "rounded-2xl rounded-br-xs bg-[#dcf8c6] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] shadow-xs"
          : "rounded-2xl rounded-bl-xs bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] shadow-xs",
        metaText: isAgent ? "text-black/60 dark:text-white/70" : "text-muted-foreground",
        badgeAi: isAgent
          ? "bg-black/10 text-black/70 dark:bg-white/20 dark:text-white/80"
          : "bg-primary/10 text-primary",
        badgeHuman: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
        linkClass: undefined,
      };
  }
}

/** InteractivePreview with the empty-state labels in the UI language and platform theme. */
function LocalizedInteractivePreview({
  payload,
  channel = "whatsapp",
  isAgent = false,
}: {
  payload: InteractiveMessagePayload;
  channel?: ChannelType;
  isAgent?: boolean;
}) {
  const t = useTranslations("Interactive");
  return (
    <InteractivePreview
      payload={payload}
      channel={channel}
      isAgent={isAgent}
      inBubble={true}
      labels={{
        body: t("previewBody"),
        button: t("previewButton"),
        menu: t("previewMenu"),
      }}
    />
  );
}

const TEMPLATE_BUTTON_ICONS: Record<TemplateButton["type"], LucideIcon> = {
  QUICK_REPLY: Reply,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
};

function TemplateHeader({
  header,
  message,
  t,
}: {
  header: TemplateMessageHeader;
  message: Message;
  t: ReturnType<typeof useTranslations>;
}) {
  if (header.type === "text") {
    return (
      <p className="mt-1 break-words text-sm font-semibold">{header.text}</p>
    );
  }
  if (!header.url) {
    const label =
      header.type === "image"
        ? t("photo")
        : header.type === "video"
          ? t("video")
          : t("document");
    return (
      <div className="mt-1">
        <MediaUnavailable label={label} t={t} />
      </div>
    );
  }
  const media = { ...message, media_url: header.url };
  return (
    <div className="mt-1">
      {header.type === "image" ? (
        <MediaImageBubble message={media} t={t} />
      ) : header.type === "video" ? (
        <MediaVideoBubble message={media} t={t} />
      ) : (
        <MediaDocumentBubble message={media} t={t} />
      )}
    </div>
  );
}

function failureReason(message: Message): string | null {
  if (message.status !== "failed" || !message.error_title) return null;
  return message.error_details
    ? `${message.error_title} — ${message.error_details}`
    : message.error_title;
}

function StatusIcon({
  status,
  title,
  isAgent = true,
  channel = "whatsapp",
}: {
  status?: Message["status"];
  /** Tooltip for the failed state — Meta's reason, when we have one. */
  title?: string | null;
  isAgent?: boolean;
  channel?: ChannelType | string | null;
}) {
  if (!status) return null;

  const isSocialOutbound = isAgent && (channel === "instagram" || channel === "facebook");

  switch (status) {
    case "sending":
      return (
        <span className="inline-flex" title="Sending">
          <Clock
            className={cn(
              "h-3 w-3 animate-pulse",
              isSocialOutbound
                ? "text-white/70"
                : isAgent
                  ? "text-black/60 dark:text-white/70"
                  : "text-muted-foreground"
            )}
          />
        </span>
      );
    case "sent":
      return (
        <span className="inline-flex" title="Sent">
          <Check
            className={cn(
              "h-3 w-3",
              isSocialOutbound
                ? "text-white/85"
                : isAgent
                  ? "text-black/60 dark:text-white/75"
                  : "text-muted-foreground"
            )}
          />
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex" title="Delivered">
          <CheckCheck
            className={cn(
              "h-3 w-3",
              isSocialOutbound
                ? "text-white/85"
                : isAgent
                  ? "text-black/60 dark:text-white/75"
                  : "text-muted-foreground"
            )}
          />
        </span>
      );
    case "read":
      return (
        <span className="inline-flex" title="Read">
          <CheckCheck
            className={cn(
              "h-3 w-3",
              isSocialOutbound
                ? "text-white font-bold"
                : isAgent
                  ? "text-[#53bdeb]"
                  : "text-blue-500"
            )}
          />
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex" title={title ?? "Failed"}>
          <XCircle className="h-3 w-3 text-red-400" />
        </span>
      );
    default:
      return null;
  }
}

function MessageContent({
  message,
  template,
  t,
  isAgent,
  channel = "whatsapp",
  linkClass,
  onOpenMedia,
}: {
  message: Message;
  template: MessageTemplate | null;
  t: ReturnType<typeof useTranslations>;
  /** Outbound bubbles sit on the primary fill — badges must invert. */
  isAgent: boolean;
  channel?: ChannelType;
  linkClass?: string;
  onOpenMedia?: (messageId: string) => void;
}) {
  // Passed to the media bubbles as a no-arg callback; `undefined` when the
  // parent wired up no viewer, which is what makes them non-clickable.
  const openMedia = onOpenMedia ? () => onOpenMedia(message.id) : undefined;

  switch (message.content_type) {
    case "text": {
      const parsedInteractive = parseInteractivePayload(
        message.interactive_payload,
        message.content_text
      );
      if (parsedInteractive) {
        return (
          <LocalizedInteractivePreview
            payload={parsedInteractive}
            channel={channel}
            isAgent={isAgent}
          />
        );
      }
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          <LinkifyText text={message.content_text ?? ""} isAgent={isAgent} linkClassName={linkClass} />
        </p>
      );
    }

    case "image":
      return (
        <div>
          {message.media_url ? (
            <MediaImageBubble message={message} onOpen={openMedia} t={t} />
          ) : (
            <MediaUnavailable label={t("photo")} t={t} />
          )}
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              <LinkifyText text={message.content_text} isAgent={isAgent} linkClassName={linkClass} />
            </p>
          )}
        </div>
      );

    case "video": {
      const isReel =
        message.media_type === "reel" ||
        message.media_type === "ig_reel" ||
        Boolean(message.media_url && /instagram\.com\/(reel|p|tv)\//i.test(message.media_url)) ||
        (message.channel === "instagram" && message.content_text?.includes("Reel"));

      if (isReel) {
        const reelUrl = message.media_url || null;
        const caption =
          message.content_text && message.content_text !== "Shared an Instagram Reel"
            ? message.content_text
            : null;

        return (
          <div className="flex flex-col gap-2 min-w-[240px] max-w-[320px]">
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              isAgent ? "text-white" : "text-purple-600 dark:text-purple-400"
            )}>
              <ChannelIcon channel="instagram" size="xs" className={cn("h-3.5 w-3.5 stroke-[2.25]", isAgent ? "text-white" : "text-purple-500")} />
              <span>Instagram Reel</span>
            </div>

            {caption && (
              <p className="whitespace-pre-wrap break-words text-sm">
                <LinkifyText text={caption} isAgent={isAgent} linkClassName={linkClass} />
              </p>
            )}

            {reelUrl ? (
              <div
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-2.5",
                  isAgent
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-border/70 bg-card text-card-foreground shadow-xs",
                )}
              >
                <span className={cn("text-[11px] font-medium truncate", isAgent ? "text-white/80" : "opacity-75")}>
                  {reelUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
                <a
                  href={reelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold text-white transition-all shadow-sm",
                    "bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] hover:opacity-95 active:scale-[0.98]",
                  )}
                >
                  <ChannelIcon channel="instagram" size="xs" className="h-3.5 w-3.5 text-white stroke-[2.25]" />
                  <span>View Reel</span>
                  <ExternalLink className="h-3.5 w-3.5 text-white/90" />
                </a>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <span>Reel link unavailable</span>
              </div>
            )}
          </div>
        );
      }

      return (
        <div>
          {message.media_url ? (
            <MediaVideoBubble message={message} onOpen={openMedia} t={t} />
          ) : (
            <MediaUnavailable label={t("video")} t={t} />
          )}
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              <LinkifyText text={message.content_text} isAgent={isAgent} linkClassName={linkClass} />
            </p>
          )}
        </div>
      );
    }

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <MediaAudioBubble message={message} t={t} />
          ) : (
            <MediaUnavailable label={t("audio")} t={t} />
          )}
        </div>
      );

    case "document":
      if (!message.media_url) {
        return <MediaUnavailable label={message.content_text || t("document")} t={t} />;
      }
      return <MediaDocumentBubble message={message} t={t} />;

    case "template": {
      // Templates are almost always outbound, where the bubble fill IS
      // `primary` — so the old `bg-primary/20 text-primary` chip was
      // primary-on-primary and invisible. Paired with a null
      // content_text (issue #483) that rendered a bubble with nothing
      // in it at all. Invert on the primary fill, and fall back to the
      // template's name when we have no stored body (legacy rows sent
      // before the fix).
      const view = templateMessageView(message, template);
      return (
        <div>
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
              isAgent
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary/20 text-primary",
            )}
          >
            <LayoutTemplate className="h-3 w-3" />
            {t("template")}
          </span>
          {view.header && (
            <TemplateHeader header={view.header} message={message} t={t} />
          )}
          {message.content_text ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              <LinkifyText text={message.content_text} isAgent={isAgent} />
            </p>
          ) : (
            message.template_name && (
              <p className="mt-1 break-words text-sm italic opacity-80">
                {message.template_name}
              </p>
            )
          )}
          {view.footer && (
            <p
              className={cn(
                "mt-1 break-words text-[11px]",
                isAgent ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {view.footer}
            </p>
          )}
          {view.buttons.length > 0 && (
            <div
              className={cn(
                "mt-2 flex flex-col border-t",
                isAgent ? "border-primary-foreground/20" : "border-border",
              )}
            >
              {view.buttons.map((button, i) => {
                const Icon = TEMPLATE_BUTTON_ICONS[button.type];
                return (
                  <span
                    key={i}
                    className={cn(
                      "flex items-center justify-center gap-1.5 border-t py-1.5 text-sm font-medium first:border-t-0",
                      isAgent
                        ? "border-primary-foreground/20 text-primary-foreground"
                        : "border-border text-primary",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{button.text}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "location":
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{message.content_text || t("locationShared")}</span>
        </div>
      );

    case "contacts":
      return (
        <div className="flex items-center gap-2 text-sm">
          <Contact className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{message.content_text || t("contactShared")}</span>
        </div>
      );

    case "interactive": {
      // Outbound with payload (or payload parsed from text) -> render buttons/list/carousel.
      const parsed = parseInteractivePayload(
        message.interactive_payload,
        message.content_text
      );
      if (parsed) {
        return (
          <LocalizedInteractivePreview
            payload={parsed}
            channel={channel}
            isAgent={isAgent}
          />
        );
      }
      if (message.sender_type === "customer") {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <CornerDownLeft className="h-3 w-3" />
              {t("buttonReply")}
            </span>
            <p className="whitespace-pre-wrap break-words text-sm">
              <LinkifyText
                text={message.content_text || t("interactiveReply")}
                isAgent={isAgent}
                linkClassName={linkClass}
              />
            </p>
          </div>
        );
      }
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          <LinkifyText
            text={message.content_text || t("interactiveReply")}
            isAgent={isAgent}
            linkClassName={linkClass}
          />
        </p>
      );
    }

    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          <LinkifyText
            text={message.content_text || t("unsupported")}
            isAgent={isAgent}
            linkClassName={linkClass}
          />
        </p>
      );
  }
}

export function MessageBubble({
  message,
  channel,
  template = null,
  reply,
  reactions,
  onToggleReaction,
  onOpenMedia,
}: MessageBubbleProps) {
  const t = useTranslations("Inbox.bubble");

  const effectiveChannel: ChannelType = (message.channel || channel || "whatsapp") as ChannelType;
  const isAgent = message.sender_type === "agent" || message.sender_type === "bot";
  const isSystem = (message as any).sender_type === "system";
  const time = format(new Date(message.created_at), "HH:mm");
  const failure = isAgent && !isSystem ? failureReason(message) : null;
  const bubbleStyles = getBubbleClasses({ channel: effectiveChannel, isAgent });

  // Row alignment + width cap are owned by <MessageActions> so its hover
  // group matches the bubble's content area, not the full row.
  return (
    <div
      className={cn(
        "flex flex-col",
        isSystem ? "items-center" : isAgent ? "items-end" : "items-start",
      )}
    >
      {isSystem ? (
        <div className="my-2 max-w-[85%] rounded-lg bg-muted/60 px-3 py-1.5 text-center">
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
            <LinkifyText text={message.content_text ?? ""} isAgent={false} />
          </p>
          <span className="mt-0.5 block text-[9px] text-muted-foreground/70">
            {time}
          </span>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "relative px-3 py-2",
              bubbleStyles.bubble
            )}
          >
            {reply && (
              <ReplyQuote
                authorLabel={reply.authorLabel}
                preview={reply.preview}
                onPrimary={isAgent}
              />
            )}
            <MessageContent
              message={message}
              template={template}
              t={t}
              isAgent={isAgent}
              channel={effectiveChannel}
              linkClass={bubbleStyles.linkClass}
              onOpenMedia={onOpenMedia}
            />
            <div
              className={cn(
                "mt-1 flex items-center gap-1",
                isAgent ? "justify-end" : "justify-start",
              )}
            >
              {message.is_human_agent_tag && (
                <span
                  title="Delivered using Meta 7-Day Human Agent Tag"
                  className={cn(
                    "inline-flex items-center px-1.5 py-px rounded text-[8px] font-medium border",
                    bubbleStyles.badgeHuman
                  )}
                >
                  Human Agent
                </span>
              )}
              {message.ai_generated && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase leading-none tracking-wide",
                    bubbleStyles.badgeAi
                  )}
                  title={t("aiBadgeTitle")}
                >
                  <Sparkle className="h-2.5 w-2.5" />
                  {t("aiBadge")}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px]",
                  bubbleStyles.metaText
                )}
              >
                {time}
              </span>
              {isAgent && (
                <StatusIcon
                  status={message.status}
                  title={failure}
                  isAgent={isAgent}
                  channel={effectiveChannel}
                />
              )}
            </div>
          </div>
        </>
      )}
      {failure && !isSystem && (
        <p
          className="mt-0.5 px-1 text-[10px] leading-tight text-muted-foreground"
          title={failure}
        >
          {t("notDelivered")}: {failure}
        </p>
      )}
      {reactions && reactions.length > 0 && onToggleReaction && !isSystem && effectiveChannel === "whatsapp" && (
        <MessageReactions
          reactions={reactions}
          onToggle={onToggleReaction}
        />
      )}
    </div>
  );
}
