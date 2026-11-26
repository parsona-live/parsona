'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, ArrowRight, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const categoryColors: Record<string, string> = {
  Marketing: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25',
  Utility: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25',
  Authentication: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25',
};

const CATEGORIES = ['all', 'Marketing', 'Utility', 'Authentication'] as const;

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step1ChooseTemplate({ selectedTemplate, onSelect, onNext, onBack }: Step1Props) {
  const t = useTranslations('Broadcasts.wizard');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORIES)[number]>('all');

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (categoryFilter !== 'all' && tpl.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        (tpl.body_text ?? '').toLowerCase().includes(q)
      );
    });
  }, [templates, search, categoryFilter]);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const supabase = createClient();
        // Only APPROVED templates can be sent via Meta — anything else
        // would 400 at broadcast time. Hide them rather than letting
        // the user pick a template that will fail.
        const { data, error: fetchError } = await supabase
          .from('message_templates')
          .select('*')
          .eq('status', 'APPROVED')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setTemplates(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('chooseTemplate.errorLoad'));
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('chooseTemplate.title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('chooseTemplate.subtitle')}
          </p>
        </div>

        {templates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="h-8 rounded-md pl-8 text-xs"
              />
            </div>
            <div className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'rounded-sm px-2 py-0.5 text-xs font-medium capitalize transition-colors',
                    categoryFilter === cat
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('chooseTemplate.noTemplates')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('chooseTemplate.createFirst')}</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-border bg-card/40 text-center">
          <p className="text-sm font-medium text-foreground">No matching templates</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const catColor = categoryColors[template.category] ?? categoryColors.Utility;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template)}
                className={cn(
                  'group relative flex min-w-0 flex-col justify-between gap-2.5 overflow-hidden rounded-lg border p-3.5 text-left transition-all',
                  isSelected
                    ? 'border-zinc-900 bg-muted/60 ring-1 ring-zinc-900/20 dark:border-zinc-100 dark:ring-zinc-100/20'
                    : 'border-border bg-background/60 hover:border-zinc-400/50 hover:bg-muted/30 dark:hover:border-zinc-600',
                )}
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <h3
                      title={template.name}
                      className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-foreground"
                    >
                      {template.name}
                    </h3>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                        catColor,
                      )}
                    >
                      {template.category}
                    </span>
                  </div>
                  <p className="line-clamp-3 break-words text-xs leading-relaxed text-muted-foreground">
                    {template.body_text}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{template.language ?? 'en_US'}</span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <Check className="h-3 w-3 text-emerald-500" />
                      Selected
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={onBack} className="h-8 rounded-md border-border text-xs">
          {t('back')}
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          disabled={!selectedTemplate}
          className="h-8 gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {t('next')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
