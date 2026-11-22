"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import { applyInboxFilter, type InboxFilter } from "@/lib/inbox/inbox-filters";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus, Tag, Profile } from "@/types";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Filter,
  Plus,
  ArrowUpDown,
  X,
  MoreVertical,
  Trash2,
  Eraser,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationListSkeleton } from "@/components/skeletons/page-skeletons";

import { AvatarChannelBadge, ChannelIcon } from "@/components/channels/channel-badge";
import { DeleteConversationDialog } from "./delete-conversation-dialog";
import { ClearChatDialog } from "./clear-chat-dialog";
import { NewConversationDialog } from "./new-conversation-dialog";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  resyncToken?: number;
  initialFilter?: InboxFilter;
  onDeleteConversation?: (conversationId: string, contactDeleted: boolean) => void;
  onClearConversation?: (conversationId: string) => void;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-emerald-500",
  pending: "bg-amber-500",
  closed: "bg-red-500",
};

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300",
  "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  "bg-lime-100 text-lime-600 dark:bg-lime-900/40 dark:text-lime-300",
  "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
];

function getAvatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[Math.abs(hash)];
}

type SortOption = "newest" | "oldest" | "unread";

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  initialFilter = "all",
  onDeleteConversation,
  onClearConversation,
}: ConversationListProps) {
  const t = useTranslations("Inbox.conversationList");
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram' | 'facebook'>('all');
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [now, setNow] = useState(() => Date.now());

  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [clearTarget, setClearTarget] = useState<Conversation | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const channelScrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch profiles for teammate name resolution
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, avatar_url, role")
        .order("full_name");
      if (!cancelled && data) setProfiles(data as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      if (p.user_id) map.set(p.user_id, p.full_name);
    }
    return map;
  }, [profiles]);

  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch conversations:", error);
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken]);

  // Load tag definitions
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      const co = c.contact?.company?.trim();
      if (co) set.add(co);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  // Channel counts
  const channelCounts = useMemo(() => {
    let all = conversations.length;
    let whatsapp = 0;
    let instagram = 0;
    let facebook = 0;
    for (const c of conversations) {
      const ch = c.channel || "whatsapp";
      if (ch === "whatsapp") whatsapp++;
      else if (ch === "instagram") instagram++;
      else if (ch === "facebook") facebook++;
    }
    return { all, whatsapp, instagram, facebook };
  }, [conversations]);

  const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = useMemo(() => [
    { label: t("filterAll") || "All Conversations", value: "all" },
    { label: t("filterMine") || "Mine (Assigned to you)", value: "mine" },
    { label: t("filterUnread") || "Unread", value: "unread" },
    { label: t("filterWaiting") || "Waiting for reply", value: "waiting" },
    { label: t("filterUnassigned") || "Unassigned", value: "unassigned" },
    { label: t("filterExpiring") || "Reply window closing", value: "expiring" },
    { label: t("filterOpen") || "Open", value: "open" },
    { label: t("filterPending") || "Pending", value: "pending" },
    { label: t("filterClosed") || "Closed", value: "closed" },
  ], [t]);

  const filtered = useMemo(() => {
    let result = applyInboxFilter(conversations, filter, now, currentUserId);

    // Contact-based filters
    if (selectedTagIds.length > 0 || selectedCompany !== null) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      );
    }

    // Omnichannel channel filter
    if (channelFilter !== "all") {
      result = result.filter((c) => (c.channel || "whatsapp") === channelFilter);
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    // Sorting
    if (sortBy === "oldest") {
      result = [...result].sort((a, b) =>
        (a.last_message_at ?? "").localeCompare(b.last_message_at ?? "")
      );
    } else if (sortBy === "unread") {
      result = [...result].sort(
        (a, b) => (b.unread_count || 0) - (a.unread_count || 0)
      );
    } else {
      // newest
      result = [...result].sort((a, b) =>
        (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "")
      );
    }

    return result;
  }, [
    conversations,
    filter,
    channelFilter,
    now,
    search,
    selectedTagIds,
    selectedCompany,
    currentUserId,
    sortBy,
  ]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  }, []);

  const hasContactFilters = selectedTagIds.length > 0 || selectedCompany !== null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const activeFilterOption = FILTER_OPTIONS.find((o) => o.value === filter);

  const scrollChannelsRight = () => {
    if (channelScrollRef.current) {
      channelScrollRef.current.scrollBy({ left: 100, behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-80">
      {/* Conversation List Header matching Image (compact) */}
      <div className="space-y-2 border-b border-border p-2.5 bg-card">
        {/* Top row: WhatsApp, Instagram, Facebook Logos + "Inbox" + Count Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-1.5 shrink-0">
            <div
              title="WhatsApp"
              className="relative z-30 flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white ring-2 ring-card shadow-2xs"
            >
              <ChannelIcon channel="whatsapp" size="xs" className="h-3.5 w-3.5 text-white" />
            </div>
            <div
              title="Instagram"
              className="relative z-20 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white ring-2 ring-card shadow-2xs"
            >
              <ChannelIcon channel="instagram" size="xs" className="h-3.5 w-3.5 text-white stroke-[2.25]" />
            </div>
            <div
              title="Facebook / Messenger"
              className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#0084FF] text-white ring-2 ring-card shadow-2xs"
            >
              <ChannelIcon channel="facebook" size="xs" className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <h1 className="text-base font-bold text-foreground tracking-tight">Inbox</h1>
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-2xs">
            {conversations.length}
          </span>
        </div>

        {/* Second row: Search conversations input with Ctrl K */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={handleSearchChange}
            placeholder={t("searchPlaceholder") || "Search conversations..."}
            className="h-8 rounded-lg border-border/70 bg-muted/40 pl-8 pr-12 text-xs text-foreground placeholder-muted-foreground focus:border-primary/50 shadow-2xs"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/70 bg-muted/80 px-1 py-0.5 text-[9px] font-mono font-medium text-muted-foreground shadow-2xs">
            Ctrl K
          </kbd>
        </div>

        {/* Third row: Channel Pills with counts & right scroll arrow */}
        <div className="relative flex items-center">
          <div
            ref={channelScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar scroll-smooth flex-1 pr-5"
          >
            {(
              [
                { key: 'all', label: 'All', count: channelCounts.all },
                { key: 'whatsapp', label: 'WhatsApp', count: channelCounts.whatsapp },
                { key: 'instagram', label: 'Instagram', count: channelCounts.instagram },
                { key: 'facebook', label: 'Messenger', count: channelCounts.facebook },
              ] as const
            ).map((ch) => {
              const isSelected = channelFilter === ch.key;
              const selectedStyle =
                ch.key === 'whatsapp'
                  ? 'bg-[#25D366] text-white shadow-xs border-transparent'
                  : ch.key === 'instagram'
                    ? 'bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-xs border-transparent'
                    : ch.key === 'facebook'
                      ? 'bg-[#0084FF] text-white shadow-xs border-transparent'
                      : 'bg-primary text-primary-foreground shadow-xs border-transparent';

              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setChannelFilter(ch.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] transition-colors shrink-0 font-medium border",
                    isSelected
                      ? selectedStyle
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-border/40"
                  )}
                >
                  {ch.key === "whatsapp" && (
                    <ChannelIcon channel="whatsapp" size="xs" className={isSelected ? "text-white" : "text-[#25D366]"} />
                  )}
                  {ch.key === "instagram" && (
                    <ChannelIcon channel="instagram" size="xs" className={isSelected ? "text-white stroke-[2.25]" : "text-[#ee2a7b] stroke-[2.25]"} />
                  )}
                  {ch.key === "facebook" && (
                    <ChannelIcon channel="facebook" size="xs" className={isSelected ? "text-white" : "text-[#0084FF]"} />
                  )}
                  <span className={isSelected ? "text-white font-semibold" : ""}>{ch.label}</span>
                  <span
                    className={cn(
                      "flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold",
                      isSelected
                        ? "bg-white/25 text-white"
                        : "bg-muted-foreground/15 text-foreground"
                    )}
                  >
                    {ch.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={scrollChannelsRight}
            aria-label="Scroll channels"
            className="absolute right-0 flex h-5 w-4 items-center justify-center bg-gradient-to-l from-card via-card to-transparent text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Fourth row: "All Conversations ⌵" on left, "⇅ Newest" on right */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {/* Status / Category Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 h-6 font-medium text-xs text-foreground/90 hover:text-foreground transition-colors cursor-pointer px-1 rounded hover:bg-muted">
              <span>{activeFilterOption?.label || "All Conversations"}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 border-border bg-popover shadow-lg rounded-xl p-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Filter Conversations
              </div>
              <DropdownMenuSeparator className="bg-border" />
              {FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "text-xs flex items-center justify-between cursor-pointer rounded-lg py-1 px-2",
                    filter === opt.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-popover-foreground hover:bg-muted"
                  )}
                >
                  <span>{opt.label}</span>
                  {filter === opt.value && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 h-6 font-medium text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1 rounded hover:bg-muted">
              <ArrowUpDown className="h-3 w-3" />
              <span>{sortBy === "newest" ? "Newest" : sortBy === "oldest" ? "Oldest" : "Unread"}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 border-border bg-popover shadow-lg rounded-xl p-1">
              <DropdownMenuItem
                onClick={() => setSortBy("newest")}
                className={cn(
                  "text-xs cursor-pointer rounded-lg py-1 px-2",
                  sortBy === "newest" ? "bg-primary/10 text-primary font-medium" : "text-popover-foreground"
                )}
              >
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("oldest")}
                className={cn(
                  "text-xs cursor-pointer rounded-lg py-1 px-2",
                  sortBy === "oldest" ? "bg-primary/10 text-primary font-medium" : "text-popover-foreground"
                )}
              >
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("unread")}
                className={cn(
                  "text-xs cursor-pointer rounded-lg py-1 px-2",
                  sortBy === "unread" ? "bg-primary/10 text-primary font-medium" : "text-popover-foreground"
                )}
              >
                Unread first
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Selected Contact Filters (Tags / Company) chips */}
        {hasContactFilters && (
          <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/40">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground hover:bg-muted/70"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag?.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="max-w-24 truncate">{tag?.name ?? "Tag"}</span>
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selectedCompany && (
              <button
                onClick={() => setSelectedCompany(null)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground hover:bg-muted/70"
              >
                <span className="max-w-24 truncate">{selectedCompany}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={clearContactFilters}
              className="px-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Conversation Items */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <ConversationListSkeleton count={8} />
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noConversations") || "No conversations found"}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                onDeleteClick={(c) => setDeleteTarget(c)}
                onClearClick={(c) => setClearTarget(c)}
                t={t}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <DeleteConversationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        conversation={deleteTarget}
        onDeleted={(convId, contactDeleted) => {
          onDeleteConversation?.(convId, contactDeleted);
        }}
      />

      <ClearChatDialog
        open={Boolean(clearTarget)}
        onOpenChange={(open) => !open && setClearTarget(null)}
        conversation={clearTarget}
        onCleared={(convId) => {
          onClearConversation?.(convId);
        }}
      />

      <NewConversationDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        conversations={conversations}
        onSelect={handleSelect}
        onConversationCreated={(newConv) => {
          onConversationsLoaded([newConv, ...conversations]);
        }}
      />
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  onDeleteClick: (conversation: Conversation) => void;
  onClearClick: (conversation: Conversation) => void;
  t: ReturnType<typeof useTranslations>;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDeleteClick,
  onClearClick,
  t,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const isGenericName = !contact?.name || contact.name === 'Instagram User' || contact.name === 'Facebook User';
  const displayName = (!isGenericName ? contact!.name : null) ||
    (contact?.ig_username ? `@${contact.ig_username.replace(/^@/, '')}` : null) ||
    (contact?.fb_name ? contact.fb_name : null) ||
    contact?.phone ||
    t("unknown") ||
    "Unknown";
  const initials = displayName.replace(/^@/, '').charAt(0).toUpperCase() || "U";
  const avatarColor = getAvatarColor(contact?.id || displayName);

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
      addSuffix: false,
    })
    : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer group relative",
        isActive && "border-l-2 border-primary bg-muted/70"
      )}
    >
      {/* Avatar with Channel Badge */}
      <span className="relative shrink-0">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
            avatarColor
          )}
        >
          {contact?.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
        <AvatarChannelBadge channel={conversation.channel} />
      </span>

      {/* Content */}
      <span className="min-w-0 flex-1 block">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Conversation actions"
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 border-border bg-popover"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={() => onClearClick(conversation)}
                  className="text-xs gap-2 cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Clear Chat
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => onDeleteClick(conversation)}
                  className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </span>

        {/* Message preview row */}
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate block text-xs text-muted-foreground">
            {conversation.last_message_text || t("noMessagesYet") || "No messages yet"}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {conversation.unread_count > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {conversation.unread_count}
              </span>
            )}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_COLORS[conversation.status]
              )}
              title={
                conversation.status === "open"
                  ? t("filterOpen") || "Open"
                  : conversation.status === "pending"
                    ? t("filterPending") || "Pending"
                    : t("filterClosed") || "Closed"
              }
            />
          </span>
        </span>
      </span>
    </div>
  );
}
