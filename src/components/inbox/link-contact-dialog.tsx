'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Link2, Loader2, Search, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { ChannelIcon } from '@/components/channels/channel-badge';
import type { Contact } from '@/types';

interface LinkContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryContact: Contact;
  onLinked?: () => void;
}

export function LinkContactDialog({
  open,
  onOpenChange,
  primaryContact,
  onLinked,
}: LinkContactDialogProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setContacts([]);
      setSelectedContactId(null);
      return;
    }

    const fetchCandidates = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        let query = supabase
          .from('contacts')
          .select('id, name, phone, email, ig_username, fb_name, avatar_url')
          .neq('id', primaryContact.id)
          .limit(20);

        if (search.trim()) {
          const q = search.trim();
          query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,ig_username.ilike.%${q}%,fb_name.ilike.%${q}%`);
        }

        const { data } = await query;
        setContacts((data || []) as Contact[]);
      } catch {
        toast.error('Failed to search candidate contacts');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchCandidates, 200);
    return () => clearTimeout(timer);
  }, [open, search, primaryContact.id]);

  const handleLink = async () => {
    if (!selectedContactId) return;

    setLinking(true);
    try {
      const res = await fetch(`/api/contacts/${primaryContact.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetContactId: selectedContactId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link contacts');
      }

      toast.success('Contacts linked! Both profiles and chats are preserved with shared AI context.');
      onOpenChange(false);
      onLinked?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setLinking(false);
    }
  };

  const getChannel = (c: Contact) => {
    if (c.ig_username) return 'instagram';
    if (c.fb_name) return 'facebook';
    return 'whatsapp';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Connect Channels & Link Contact
          </DialogTitle>
          <DialogDescription>
            Link another channel or profile to <strong className="text-foreground">{primaryContact.name || primaryContact.phone || 'this contact'}</strong>. Both conversations remain active in your inbox, while AI and agent view full cross-channel context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, phone, email, or handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-md border border-border p-2">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching contacts...
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-center py-6 text-muted-foreground">
                No matching contacts found.
              </p>
            ) : (
              contacts.map((c) => {
                const channel = getChannel(c);
                const isSelected = selectedContactId === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedContactId(c.id)}
                    className={`flex items-center justify-between w-full p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 text-xs font-semibold">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          c.name?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">{c.name || c.phone || 'Unknown'}</p>
                          <ChannelIcon channel={channel} size="xs" />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.phone || c.email || (c.ig_username ? `@${c.ig_username}` : c.fb_name) || ''}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={linking}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleLink}
            disabled={!selectedContactId || linking}
            className="gap-2"
          >
            {linking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Link Channels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

