'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Bot, RotateCcw, Send, Loader2, UserCircle2, ArrowRight, CheckCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  handoff?: boolean;
}

function FormattedWhatsAppText({ text }: { text?: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const formatted = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\*(.*?)\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
          .replace(/_(.*?)_/g, '<em class="italic">$1</em>')
          .replace(/~(.*?)~/g, '<del class="line-through text-slate-500">$1</del>');
        return (
          <p
            key={idx}
            className="whitespace-pre-wrap leading-relaxed text-[13px] text-[#111b21]"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      })}
    </div>
  );
}

export function AiPlayground({ onGoToSetup }: { onGoToSetup?: () => void }) {
  const t = useTranslations('Agents.playground');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/ai/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ai_not_configured') {
          toast.error(t('notConfigured'));
        } else {
          toast.error(data.error ?? t('noReply'));
        }
        setTurns(turns);
        setInput(text);
        return;
      }
      setTurns([
        ...next,
        {
          role: 'assistant',
          content:
            typeof data.reply === 'string' && data.reply.trim()
              ? data.reply
              : '',
          handoff: Boolean(data.handoff),
        },
      ]);
    } catch {
      toast.error(t('unreachable'));
      setTurns(turns);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 bg-[#f0f2f5] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-[#111b21] truncate">
              {t('title')}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-[#00a884] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00a884] animate-pulse" />
              <span>online</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTurns([])}
          disabled={turns.length === 0 || sending}
          className="text-slate-500 hover:text-[#111b21] hover:bg-slate-200/60"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t('reset')}
        </Button>
      </div>

      {/* Chat Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-3"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'radial-gradient(#d1d7db 0.8px, transparent 0.8px)',
          backgroundSize: '16px 16px',
        }}
      >
        {/* Encryption Notice */}
        <div className="flex justify-center pt-1 pb-1">
          <div className="max-w-[90%] rounded-lg bg-[#ffeecd] px-3 py-1.5 text-center text-[10.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] leading-relaxed flex items-center justify-center gap-1.5">
            <span>🔒 Messages are end-to-end encrypted.</span>
          </div>
        </div>

        {/* Date Stamp */}
        <div className="flex justify-center my-1">
          <span className="rounded-md bg-white/90 border border-slate-200/50 px-2.5 py-0.5 text-[10px] text-[#54656f] font-semibold uppercase tracking-wider shadow-2xs">
            TODAY
          </span>
        </div>

        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-[#54656f]">
            <Bot className="mb-2 h-8 w-8 text-[#00a884]/60" />
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs">
              {t('emptyDesc')}
            </p>
            {onGoToSetup && (
              <Button
                variant="link"
                size="sm"
                onClick={onGoToSetup}
                className="mt-1 h-auto p-0 text-xs text-[#00a884]"
              >
                {t('goToSetup')} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {turns.map((turn, i) => {
          if (turn.role === 'user') {
            return (
              <div key={i} className="flex justify-end animate-in fade-in-50">
                <div className="max-w-[82%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative">
                  <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#667781]">
                    <span>{getTimeString()}</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div key={i} className="flex flex-col items-start gap-1 max-w-[88%] animate-in fade-in-50">
                <div className="w-full rounded-lg rounded-tl-none bg-white p-3 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] space-y-2">
                  {turn.content && <FormattedWhatsAppText text={turn.content} />}
                  {turn.handoff && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 pt-1.5 border-t border-[#e9edef]">
                      <UserCircle2 className="h-3.5 w-3.5" />
                      <span>{t('handoff')}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-[#667781] text-right mt-0.5">
                    {getTimeString()}
                  </div>
                </div>
              </div>
            );
          }
        })}

        {sending && (
          <div className="flex flex-col items-start gap-1 max-w-[88%] animate-in fade-in-50">
            <div className="w-full rounded-lg rounded-tl-none bg-white p-3 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#00a884]" />
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#667781]" />
              <span className="text-xs text-[#667781]">{t('thinking')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-slate-200 bg-[#f0f2f5] p-3 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          rows={1}
          className="flex-1 resize-none rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-[#111b21] placeholder-[#667781] outline-none focus:border-[#00a884]/50"
        />
        <Button
          size="sm"
          onClick={send}
          disabled={!input.trim() || sending}
          className="h-9 w-9 shrink-0 rounded-full p-0 bg-[#00a884] hover:bg-[#008f6f]"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
