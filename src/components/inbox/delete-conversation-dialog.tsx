'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ChannelPillBadge } from '@/components/channels/channel-badge';
import type { Conversation } from '@/types';

interface DeleteConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  onDeleted?: (conversationId: string, contactDeleted: boolean) => void;
}

export function DeleteConversationDialog({
  open,
  onOpenChange,
  conversation,
  onDeleted,
}: DeleteConversationDialogProps) {
  const [deleteContact, setDeleteContact] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!conversation) return null;

  const contactName = conversation.contact?.name || conversation.contact?.phone || 'this contact';

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversation.id}?delete_contact=${deleteContact ? 'true' : 'false'}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete conversation');
      }

      toast.success(
        deleteContact
          ? 'Conversation deleted. Customer identity context preserved.'
          : 'Conversation thread deleted successfully.'
      );
      onOpenChange(false);
      onDeleted?.(conversation.id, deleteContact);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Conversation
          </DialogTitle>
          <DialogDescription className="text-sm">
            Are you sure you want to delete this chat with <strong className="text-foreground">{contactName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 p-2.5">
            <span className="font-medium text-foreground">Channel:</span>
            <ChannelPillBadge channel={conversation.channel} />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This action permanently deletes messages in this conversation thread. Customer identity mappings and shared context across channels remain safely preserved.
            </p>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors">
            <Checkbox
              checked={deleteContact}
              onCheckedChange={(checked) => setDeleteContact(Boolean(checked))}
            />
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Delete channel thread contact from inbox
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Deletes this thread entry while preserving customer identity and context for future chats.
              </span>
            </div>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="gap-2"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete Chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

