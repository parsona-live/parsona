"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, Conversation, ChannelType } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Link2,
  Unlink,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { LinkContactDialog } from "./link-contact-dialog";
import { ChannelIcon, AvatarChannelBadge } from "@/components/channels/channel-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface LinkedContactItem extends Contact {
  conversation_id?: string | null;
  channel?: string;
}

interface ContactSidebarProps {
  contact: Contact | null;
  conversation?: Conversation | null;
  onOpenConversation?: (conversationId: string) => void;
}

function isGenericOrHandle(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("@")) return true;
  if (
    trimmed === "Instagram User" ||
    trimmed === "Facebook User" ||
    trimmed === "Unknown" ||
    trimmed === "Contact"
  ) {
    return true;
  }
  // Check if string is only numbers or phone formatting symbols (+, -, space, parens)
  if (/^[\d\s\+\-\(\)]+$/.test(trimmed)) return true;
  return false;
}

function getChannelHandle(c: Contact | LinkedContactItem): string {
  if (c.ig_username) return `@${c.ig_username.replace(/^@/, "")}`;
  if (c.fb_name) return `FB: ${c.fb_name}`;
  if (c.phone) return c.phone;
  if (c.name && !isGenericOrHandle(c.name)) return c.name;
  if (c.ig_user_id) return `IG: ${c.ig_user_id}`;
  if (c.fb_page_scoped_id) return `FB: ${c.fb_page_scoped_id}`;
  return contactHandle(c) || "Channel";
}

function getContactChannel(
  c: Contact | LinkedContactItem,
  conversationChannel?: string,
): ChannelType {
  if (
    conversationChannel === "instagram" ||
    conversationChannel === "facebook" ||
    conversationChannel === "whatsapp"
  ) {
    return conversationChannel;
  }
  if (c.ig_user_id || c.ig_username) return "instagram";
  if (c.fb_page_scoped_id || c.fb_name) return "facebook";
  return "whatsapp";
}

function getChannelBrand(channel: ChannelType | string | null | undefined) {
  if (channel === "instagram") {
    return {
      name: "Instagram",
      color: "#E1306C",
      textClass: "text-[#E1306C]",
      bgClass: "bg-[#E1306C]/10",
      borderClass: "border-[#E1306C]/30",
      badgeClass: "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-xs",
    };
  }
  if (channel === "facebook") {
    return {
      name: "Facebook",
      color: "#0084FF",
      textClass: "text-[#0084FF]",
      bgClass: "bg-[#0084FF]/10",
      borderClass: "border-[#0084FF]/30",
      badgeClass: "bg-[#0084FF] text-white shadow-xs",
    };
  }
  return {
    name: "WhatsApp",
    color: "#25D366",
    textClass: "text-[#25D366]",
    bgClass: "bg-[#25D366]/10",
    borderClass: "border-[#25D366]/30",
    badgeClass: "bg-[#25D366] text-white shadow-xs",
  };
}

export function ContactSidebar({
  contact,
  conversation,
  onOpenConversation,
}: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContactItem[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const activeContactIdRef = useRef<string | null>(null);

  const activeChannel = conversation?.channel || (contact ? getContactChannel(contact) : "whatsapp");

  // Reset avatar failed state on contact change
  useEffect(() => {
    setAvatarFailed(false);
  }, [contact?.id, contact?.avatar_url]);

  // Exact connected channels for this customer: at most 1 active + at most 1 per other channel platform
  const connectedChannels = useMemo(() => {
    if (!contact) return [];

    const activePlatform = activeChannel;
    const activeEntry = {
      id: contact.id,
      channel: activePlatform,
      brand: getChannelBrand(activePlatform),
      handle: getChannelHandle(contact),
      name: contact.name && !isGenericOrHandle(contact.name) ? contact.name : getChannelHandle(contact),
      avatarUrl: contact.avatar_url,
      conversationId: conversation?.id || null,
      isActive: true,
    };

    // For other linked contacts, only pick those for different channel platforms and at most 1 per platform
    const seenPlatforms = new Set<string>([activePlatform]);
    const others: Array<{
      id: string;
      channel: ChannelType;
      brand: ReturnType<typeof getChannelBrand>;
      handle: string;
      name: string;
      avatarUrl?: string | null;
      conversationId?: string | null;
      isActive: boolean;
    }> = [];

    for (const linked of linkedContacts) {
      if (!linked || linked.id === contact.id) continue;
      const platform = getContactChannel(linked, linked.channel);
      // Skip if already have an entry for this platform (prevents duplicate cards)
      if (seenPlatforms.has(platform)) continue;

      seenPlatforms.add(platform);
      others.push({
        id: linked.id,
        channel: platform,
        brand: getChannelBrand(platform),
        handle: getChannelHandle(linked),
        name: linked.name && !isGenericOrHandle(linked.name) ? linked.name : getChannelHandle(linked),
        avatarUrl: linked.avatar_url,
        conversationId: linked.conversation_id || null,
        isActive: false,
      });
    }

    return [activeEntry, ...others];
  }, [contact, activeChannel, conversation, linkedContacts]);

  // Real Name: look for the first non-generic, non-handle name across the cluster
  const realName = useMemo(() => {
    if (contact?.name && !isGenericOrHandle(contact.name)) return contact.name;
    const found = linkedContacts.find((c) => !isGenericOrHandle(c.name));
    return found?.name || null;
  }, [contact, linkedContacts]);

  // Handle for the active channel
  const activeHandle = useMemo(() => {
    if (!contact) return "";
    return getChannelHandle(contact);
  }, [contact]);

  // Main heading: Real Name if known, else handle or fallback
  const headerTitle = realName || contact?.name || activeHandle || "Customer";

  // Unified phone number across all connected channels
  const unifiedPhone = useMemo(() => {
    if (contact?.phone && contact.phone.trim() !== "") return contact.phone;
    return linkedContacts.find((c) => c.phone && c.phone.trim() !== "")?.phone || null;
  }, [contact, linkedContacts]);

  // Unified email across all connected channels
  const unifiedEmail = useMemo(() => {
    if (contact?.email && contact.email.trim() !== "") return contact.email;
    return linkedContacts.find((c) => c.email && c.email.trim() !== "")?.email || null;
  }, [contact, linkedContacts]);

  const initials = useMemo(() => {
    const text = realName || contact?.name || activeHandle || "CU";
    return (
      text
        .replace(/^@/, "")
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "CU"
    );
  }, [realName, contact, activeHandle]);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;
    const currentId = contact.id;
    activeContactIdRef.current = currentId;
    setLoadingLinked(true);
    setLoadingDetails(true);

    const supabase = createClient();

    // 1. Fetch linked channels first
    let clusterIds = [contact.id];
    if (contact.linked_contact_id) {
      clusterIds.push(contact.linked_contact_id);
    }

    try {
      const res = await fetch(`/api/contacts/${contact.id}/linked`);
      if (activeContactIdRef.current === currentId && res.ok) {
        const json = await res.json();
        if (activeContactIdRef.current === currentId) {
          const links: LinkedContactItem[] = json.linked || [];
          setLinkedContacts(links);
          clusterIds = Array.from(new Set([contact.id, ...clusterIds, ...links.map((l) => l.id)]));
        }
      }
    } catch {
      // Best-effort
    } finally {
      if (activeContactIdRef.current === currentId) {
        setLoadingLinked(false);
      }
    }

    if (activeContactIdRef.current !== currentId) return;

    // 2. Fetch deals, notes, and tags unified across connected contacts
    try {
      const [dealsRes, notesRes, tagsRes] = await Promise.all([
        supabase
          .from("deals")
          .select("*, stage:pipeline_stages(*)")
          .in("contact_id", clusterIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("contact_notes")
          .select("*")
          .in("contact_id", clusterIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("contact_tags")
          .select("id, tag_id, tags(*)")
          .in("contact_id", clusterIds),
      ]);

      if (activeContactIdRef.current !== currentId) return;

      // Deduplicate deals
      if (dealsRes.data) {
        const seenDealIds = new Set<string>();
        const uniqueDeals: Deal[] = [];
        for (const d of dealsRes.data) {
          if (!seenDealIds.has(d.id)) {
            seenDealIds.add(d.id);
            uniqueDeals.push(d);
          }
        }
        setDeals(uniqueDeals);
      }

      // Deduplicate notes
      if (notesRes.data) {
        const seenNoteIds = new Set<string>();
        const uniqueNotes: ContactNote[] = [];
        for (const n of notesRes.data) {
          if (!seenNoteIds.has(n.id)) {
            seenNoteIds.add(n.id);
            uniqueNotes.push(n);
          }
        }
        setNotes(uniqueNotes);
      }

      // Deduplicate tags by tag_id
      if (tagsRes.data) {
        const seenTagIds = new Set<string>();
        const mapped: (Tag & { contact_tag_id: string })[] = [];
        for (const ct of tagsRes.data) {
          if (ct.tags && !seenTagIds.has(ct.tag_id)) {
            seenTagIds.add(ct.tag_id);
            mapped.push({
              ...(ct.tags as unknown as Tag),
              contact_tag_id: ct.id as string,
            });
          }
        }
        setTags(mapped);
      }
    } finally {
      if (activeContactIdRef.current === currentId) {
        setLoadingDetails(false);
      }
    }
  }, [contact]);

  useEffect(() => {
    setLinkedContacts([]);
    setLoadingLinked(true);
    setLoadingDetails(true);
    fetchContactData();
  }, [fetchContactData]);

  const handleUnlink = async (targetId: string) => {
    setUnlinkingId(targetId);
    try {
      const res = await fetch(`/api/contacts/${targetId}/unlink`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to unlink contact");
      toast.success("Channel unlinked successfully");
      fetchContactData();
    } catch {
      toast.error("Failed to unlink channel");
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleCopy = useCallback(async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const targetContactId = contact.linked_contact_id || contact.id;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: targetContactId,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  const customerSince = useMemo(() => {
    const dates = [contact?.created_at, ...linkedContacts.map((c) => c.created_at)]
      .map((d) => (d ? new Date(d).getTime() : null))
      .filter((t): t is number => t !== null && !isNaN(t));

    if (dates.length === 0) return null;
    const earliest = new Date(Math.min(...dates));
    try {
      return `Customer since ${format(earliest, "MMM yyyy")}`;
    } catch {
      return null;
    }
  }, [contact?.created_at, linkedContacts]);

  if (!contact) {
    return (
      <div className="flex h-full w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const activeBrand = getChannelBrand(activeChannel);

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Header row: Single clean avatar + Name + Real Name */}
          <div className="flex items-center gap-3">
            {/* Single clean avatar with active channel badge */}
            <div className="relative shrink-0">
              {contact.avatar_url && !avatarFailed ? (
                <img
                  src={contact.avatar_url}
                  alt={headerTitle}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-border shadow-xs"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#fed7aa] text-base font-bold text-[#9a3412] dark:bg-[#7c2d12]/50 dark:text-[#fed7aa] shadow-2xs">
                  {initials}
                </div>
              )}
              <AvatarChannelBadge channel={activeChannel} size="md" />
            </div>

            {/* Name / Handle / Channel details */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold text-foreground leading-tight">
                {headerTitle}
              </h3>

              {/* Subtitle with active handle & channel in brand color */}
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <ChannelIcon channel={activeChannel} size="xs" className={activeBrand.textClass} />
                <span className="truncate font-mono">{activeHandle}</span>
              </div>

              {customerSince && (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {customerSince}
                </p>
              )}
              {contact.company && (
                <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
              )}
            </div>
          </div>

          {/* Tags row */}
          {loadingDetails && tags.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
          ) : tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.contact_tag_id}
                  className="rounded-lg px-2.5 py-1 font-mono text-xs font-medium border"
                  style={{
                    backgroundColor: `${tag.color}15`,
                    color: tag.color,
                    borderColor: `${tag.color}35`,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}

          {/* Unified Phone & Email */}
          <div className="mt-4 space-y-2">
            {unifiedPhone ? (
              <button
                onClick={() => handleCopy(unifiedPhone)}
                title="Click to copy phone number"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="flex-1 text-left font-mono">{unifiedPhone}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) : null}

            {unifiedEmail ? (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{unifiedEmail}</span>
              </div>
            ) : null}
          </div>

          {/* Connected Channels: directly beneath Phone & Email */}
          <div className="mt-4 rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                Connected Channels ({connectedChannels.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLinkOpen(true)}
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary"
              >
                <Plus className="h-3 w-3" />
                Connect
              </Button>
            </div>

            {/* Skeleton loader while loading connected channels */}
            {loadingLinked && linkedContacts.length === 0 ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {connectedChannels.map((c) => {
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
                        c.isActive
                          ? "bg-card shadow-2xs"
                          : "bg-card/70 hover:bg-card border-border/60",
                      )}
                      style={{
                        borderColor: c.isActive ? `${c.brand.color}50` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Official brand badge circle with crisp white icon */}
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-1 ring-border/40",
                            c.brand.badgeClass,
                          )}
                        >
                          <ChannelIcon
                            channel={c.channel}
                            size="sm"
                            className={cn(
                              "text-white",
                              c.channel === "instagram" ? "stroke-[2.25]" : "fill-current",
                            )}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate font-mono">
                            {c.handle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.isActive ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: `${c.brand.color}15`,
                              borderColor: `${c.brand.color}35`,
                              color: c.brand.color,
                            }}
                          >
                            Active Thread
                          </span>
                        ) : (
                          <>
                            {c.conversationId && onOpenConversation && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenConversation(c.conversationId!)}
                                title="Open conversation thread"
                                className="h-7 w-7 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlink(c.id)}
                              disabled={unlinkingId === c.id}
                              title="Unlink channel"
                              className="h-7 w-7 p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <LinkContactDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            primaryContact={contact}
            onLinked={fetchContactData}
          />

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Active Deals (unified across customer cluster) */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {tSidebar("deals")}
            </div>
            <div className="mt-2 space-y-2">
              {loadingDetails && deals.length === 0 ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div key={deal.id} className="rounded-lg bg-muted px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{deal.title}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Notes (unified across customer cluster) */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              {tSidebar("notes")}
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {loadingDetails && notes.length === 0 ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="rounded-lg bg-muted px-3 py-2">
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {note.note_text}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
