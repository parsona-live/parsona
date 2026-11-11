'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { GitMerge, Loader2, Search, AlertTriangle, Check } from 'lucide-react';
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
import type { Contact } from '@/types';

interface MergeContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryContact: Contact;
  onMerged?: () => void;
}

export function MergeContactDialog({
  open,
  onOpenChange,
  primaryContact,
  onMerged,
}: MergeContactDialogProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
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
          .select('id, name, phone, email, ig_username, fb_name')
          .neq('id', primaryContact.id)
          .limit(20);

        if (search.trim()) {
          const q = search.trim();
          query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,ig_username.ilike.%${q}%`);
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

  const handleMerge = async () => {
    if (!selectedContactId) return;

    setMerging(true);
    try {
      const res = await fetch(`/api/contacts/${primaryContact.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secondaryContactId: selectedContactId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to merge contacts');
      }

      toast.success('Contacts merged successfully! Conversations consolidated.');
      onOpenChange(false);
      onMerged?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Merge Contact Profile
          </DialogTitle>
          <DialogDescription>
            Merge a duplicate WhatsApp, Instagram, or Facebook contact into{' '}
            <span className="font-semibold text-foreground">
              {primaryContact.name || primaryContact.phone || 'this contact'}
            </span>
            . All past messages, conversations, and social handles will be consolidated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or @handle..."
              className="pl-9"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 border rounded-lg p-2 divide-y divide-border/50">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching contacts...
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">
                No matching contacts found.
              </p>
            ) : (
              contacts.map((c) => {
                const isSelected = selectedContactId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedContactId(c.id)}
                    className={`w-full text-left p-2 rounded-md flex items-center justify-between text-xs transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/30 text-foreground'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{c.name || 'Unnamed'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.phone ? `Phone: ${c.phone}` : ''}
                        {c.ig_username ? ` • IG: @${c.ig_username}` : ''}
                        {c.email ? ` • ${c.email}` : ''}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              This action cannot be undone. The secondary contact will be deleted, and all its conversations will be reassigned to the primary contact.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedContactId || merging}
            className="gap-2"
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4" />
                Confirm Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
