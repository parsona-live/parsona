'use client';

import { useState } from 'react';
import { Eraser, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Conversation } from '@/types';

interface ClearChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  onCleared?: (conversationId: string) => void;
}

export function ClearChatDialog({
  open,
  onOpenChange,
  conversation,
  onCleared,
}: ClearChatDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!conversation) return null;

  const contactName = conversation.contact?.name || conversation.contact?.phone || 'this contact';

  const handleClear = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/clear`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear chat history');
      }

      toast.success('Chat history cleared successfully.');
      onOpenChange(false);
      onCleared?.(conversation.id);
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
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Eraser className="h-5 w-5 text-amber-500" />
            Clear Chat History
          </DialogTitle>
          <DialogDescription className="text-sm">
            Are you sure you want to clear all messages for <strong className="text-foreground">{contactName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/40 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="leading-relaxed">
              All sent and received messages will be permanently erased. The conversation and contact profile will remain in your CRM.
            </p>
          </div>
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
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={loading}
            className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Clear All Messages
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

