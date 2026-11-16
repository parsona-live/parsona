"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Contact, Conversation } from "@/types";
import { CONVERSATION_SELECT, normalizeConversation } from "@/lib/inbox/conversations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { ChannelIcon } from "@/components/channels/channel-badge";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
  onConversationCreated?: (conv: Conversation) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  conversations,
  onSelect,
  onConversationCreated,
}: NewConversationDialogProps) {
  const { user, accountId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("name", { ascending: true })
        .limit(50);

      if (cancelled) return;
      setLoading(false);

      if (error) {
        console.error("Failed to fetch contacts for new chat:", error);
        return;
      }

      setContacts((data as Contact[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      const name = c.name?.toLowerCase() ?? "";
      const phone = c.phone?.toLowerCase() ?? "";
      const username = c.wa_username?.toLowerCase() ?? "";
      return name.includes(q) || phone.includes(q) || username.includes(q);
    });
  }, [contacts, search]);

  const handlePickContact = useCallback(
    async (contact: Contact) => {
      // 1. Check if conversation already exists in active list
      const existing = conversations.find(
        (c) => c.contact_id === contact.id || c.contact?.id === contact.id
      );

      if (existing) {
        onSelect(existing);
        onOpenChange(false);
        return;
      }

      // 2. Otherwise create a new conversation row
      if (!user || !accountId) return;
      setCreating(contact.id);

      try {
        const supabase = createClient();
        const { data: newRow, error } = await supabase
          .from("conversations")
          .insert({
            account_id: accountId,
            user_id: user.id,
            contact_id: contact.id,
            status: "open",
            channel: contact.ig_user_id ? "instagram" : contact.fb_page_scoped_id ? "facebook" : "whatsapp",
          })
          .select(CONVERSATION_SELECT)
          .single();

        if (error || !newRow) {
          console.error("Failed to create conversation:", error);
          toast.error("Failed to start new chat");
          return;
        }

        const normalized = normalizeConversation(newRow);
        onConversationCreated?.(normalized);
        onSelect(normalized);
        onOpenChange(false);
        toast.success(`Chat started with ${contact.name || contactHandle(contact)}`);
      } catch (err) {
        console.error("Error creating conversation:", err);
        toast.error("Failed to start new chat");
      } finally {
        setCreating(null);
      }
    },
    [conversations, user, accountId, onSelect, onOpenChange, onConversationCreated]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-border/70">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            New Conversation
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select a contact to start messaging or resume a thread.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or username..."
              className="h-9 pl-9 text-xs rounded-lg border-border bg-muted/50"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="max-h-72 p-2">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs">Loading contacts...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-xs">No contacts found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((c) => {
                const displayName = c.name || contactHandle(c);
                const isSelected = creating === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePickContact(c)}
                    disabled={isSelected}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-muted/70 transition-colors cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {contactHandle(c)}
                        {c.company ? ` · ${c.company}` : ""}
                      </p>
                    </div>
                    <ChannelIcon
                      channel={c.ig_user_id ? "instagram" : c.fb_page_scoped_id ? "facebook" : "whatsapp"}
                      size="xs"
                      className="shrink-0 text-muted-foreground group-hover:text-foreground"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
