"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, Conversation } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  GitMerge,
  Share2,
  Link2,
  Unlink,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { LinkContactDialog } from "./link-contact-dialog";
import { ChannelIcon, ChannelPillBadge } from "@/components/channels/channel-badge";
import { toast } from "sonner";

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

interface LinkedContactItem extends Contact {
  conversation_id?: string | null;
  channel?: string;
}

interface ContactSidebarProps {
  contact: Contact | null;
  conversation?: Conversation | null;
  onOpenConversation?: (conversationId: string) => void;
}

export function ContactSidebar({ contact, conversation, onOpenConversation }: ContactSidebarProps) {
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
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, and linked channels in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }

    // Fetch linked channels
    try {
      const res = await fetch(`/api/contacts/${contact.id}/linked`);
      if (res.ok) {
        const json = await res.json();
        setLinkedContacts(json.linked || []);
      }
    } catch {
      // Best-effort
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleUnlink = async (targetId: string) => {
    setUnlinkingId(targetId);
    try {
      const res = await fetch(`/api/contacts/${targetId}/unlink`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to unlink contact');
      toast.success('Channel unlinked successfully');
      fetchContactData();
    } catch {
      toast.error('Failed to unlink channel');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleCopyPhone = useCallback(async () => {
    // Copies whatever the row displays — a BSUID-only contact has no
    // phone number to copy, but its @username still identifies them.
    const handle = contact ? contactHandle(contact) : '';
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
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
    if (!contact?.created_at) return null;
    try {
      return `Customer since ${format(new Date(contact.created_at), "MMM yyyy")}`;
    } catch {
      return null;
    }
  }, [contact?.created_at]);

  if (!contact) {
    return (
      <div className="flex h-full w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const initials = (contact.name || contactHandle(contact) || "AS")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AS";

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Header row (Image 2 reference) */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#fed7aa] text-base font-bold text-[#9a3412] dark:bg-[#7c2d12]/50 dark:text-[#fed7aa] shadow-2xs">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold text-foreground leading-tight">
                {displayName}
              </h3>
              {customerSince && (
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {customerSince}
                </p>
              )}
              {contact.company && (
                <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
              )}
            </div>
          </div>

          {/* Tags row: only show if contact actually has tags */}
          {tags.length > 0 && (
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
          )}

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">
                {contactHandle(contact)}
              </span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Connected Channels & Omnichannel Links */}
          <div className="mt-4 rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                Connected Channels
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

            {/* Current contact channel pill */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <ChannelIcon
                  channel={contact.ig_user_id ? 'instagram' : contact.fb_page_scoped_id ? 'facebook' : 'whatsapp'}
                  size="sm"
                  className={contact.ig_user_id ? 'text-pink-500' : contact.fb_page_scoped_id ? 'text-blue-500' : 'text-emerald-500'}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {contact.name || contactHandle(contact)}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {contact.ig_username ? `@${contact.ig_username}` : contact.fb_name || contactHandle(contact)} (Active)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                This Thread
              </span>
            </div>

            {/* Linked contacts list */}
            {linkedContacts.length > 0 ? (
              <div className="space-y-1.5">
                {linkedContacts.map((linked) => (
                  <div
                    key={linked.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-card/60 border border-border/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChannelIcon
                        channel={linked.channel}
                        size="sm"
                        className={linked.channel === 'instagram' ? 'text-pink-500' : linked.channel === 'facebook' ? 'text-blue-500' : 'text-emerald-500'}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {linked.name || linked.phone || 'Contact'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {linked.ig_username ? `@${linked.ig_username}` : linked.fb_name || linked.phone || ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {linked.conversation_id && onOpenConversation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenConversation(linked.conversation_id!)}
                          title="Open conversation thread"
                          className="h-6 w-6 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlink(linked.id)}
                        disabled={unlinkingId === linked.id}
                        title="Unlink channel"
                        className="h-6 w-6 p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Unlink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground px-1 py-1">
                No other channels linked yet. Auto-links when phone or email matches in chat.
              </p>
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

          {/* Active Deals */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {tSidebar("deals")}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
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

          {/* Notes */}
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
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
