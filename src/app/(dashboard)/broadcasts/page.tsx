'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Radio, Plus, Search, Send, CheckCheck, Eye, Users, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { BroadcastsPageSkeleton } from "@/components/skeletons/page-skeletons";
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

/**
 * Poll cadence while any broadcast is sending. Kept modest so we don't
 * beat on Supabase — the aggregate trigger in migration 003 keeps
 * counts consistent; we just need to surface the freshest snapshot.
 */
const POLL_INTERVAL_MS = 5_000;

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  /** Tailwind bg class for the fill, e.g. "bg-emerald-500" */
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div className="flex items-center gap-2" title={`${value.toLocaleString()} / ${total.toLocaleString()}`}>
      <span className="w-9 text-right text-xs font-medium tabular-nums text-foreground">
        {pct}%
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const STATUS_FILTERS = ['all', 'completed', 'sending', 'draft', 'failed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function BroadcastsPage() {
  const router = useRouter();
  const t = useTranslations('Broadcasts.page');
  const tStatus = useTranslations('Broadcasts.status');
  const tGate = useTranslations('GatedButton');
  const canCreate = useCan('send-messages');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Used to kick off polling only while something is actively sending.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchBroadcasts() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBroadcasts(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts],
  );

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchBroadcasts, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    // Pause polling while the tab is hidden — keeps Supabase cold when
    // the user is away, and ensures a fresh fetch the moment they
    // refocus so they don't see stale data on return.
    function handleVisibilityChange() {
      if (!anySending) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchBroadcasts();
        startPolling();
      }
    }

    if (anySending && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anySending]);

  const stats = useMemo(() => {
    const totalCampaigns = broadcasts.length;
    const sendingCount = broadcasts.filter((b) => b.status === 'sending').length;
    const totalRecipients = broadcasts.reduce((sum, b) => sum + (b.total_recipients || 0), 0);
    const totalDelivered = broadcasts.reduce((sum, b) => sum + (b.delivered_count || 0), 0);
    const totalRead = broadcasts.reduce((sum, b) => sum + (b.read_count || 0), 0);
    return {
      totalCampaigns,
      sendingCount,
      totalRecipients,
      deliveryRate: percent(totalDelivered, totalRecipients),
      readRate: percent(totalRead, totalDelivered),
      totalDelivered,
      totalRead,
    };
  }, [broadcasts]);

  const filteredBroadcasts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return broadcasts.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.template_name.toLowerCase().includes(q)
      );
    });
  }, [broadcasts, search, statusFilter]);

  if (loading) {
    return <BroadcastsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top indeterminate progress bar: only visible while a broadcast
          is mid-send. Pure CSS animation so no extra deps. */}
      {anySending && (
        <div
          role="progressbar"
          aria-label={t('broadcastInProgress')}
          className="broadcast-indeterminate fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-muted"
        >
          <div className="broadcast-indeterminate-bar h-0.5 bg-emerald-500" />
          <style jsx>{`
            .broadcast-indeterminate-bar {
              width: 33%;
              transform: translateX(-100%);
              animation: broadcast-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1)
                infinite;
            }
            @keyframes broadcast-slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(400%);
              }
            }
          `}</style>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <GatedButton
          size="sm"
          canAct={canCreate}
          gateReason={tGate('reasons.createBroadcasts')}
          onClick={() => router.push('/broadcasts/new')}
          className="h-8 gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('newBroadcast')}
        </GatedButton>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Campaigns</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Send className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {stats.totalCampaigns}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {stats.sendingCount > 0 ? `${stats.sendingCount} sending now` : 'All campaigns'}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t('table.recipients')}</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Users className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {stats.totalRecipients.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total reached</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Delivery Rate</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-500">
              <CheckCheck className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {stats.deliveryRate}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {stats.totalDelivered.toLocaleString()} delivered
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Read Rate</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-blue-500/12 text-blue-500">
              <Eye className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {stats.readRate}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {stats.totalRead.toLocaleString()} read
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      {broadcasts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns or templates..."
              className="h-8 rounded-md pl-8 text-xs"
            />
          </div>

          <div className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  statusFilter === f
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {broadcasts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground">
            <Radio className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{t('noBroadcastsYet')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('createFirst')}
          </p>
          <GatedButton
            size="sm"
            canAct={canCreate}
            gateReason={tGate('reasons.createBroadcasts')}
            onClick={() => router.push('/broadcasts/new')}
            className="mt-4 h-8 gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('newBroadcast')}
          </GatedButton>
        </div>
      ) : filteredBroadcasts.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-border bg-card text-center">
          <p className="text-sm font-medium text-foreground">No matching campaigns</p>
          <p className="mt-1 text-xs text-muted-foreground">Try clearing your search or status filter.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-7 text-xs"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('table.name')}</TableHead>
                  <TableHead className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:table-cell">{t('table.template')}</TableHead>
                  <TableHead className="hidden text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                    {t('table.recipients')}
                  </TableHead>
                  <TableHead className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">{t('table.delivery')}</TableHead>
                  <TableHead className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">{t('table.read')}</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('table.status')}</TableHead>
                  <TableHead className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">{t('table.date')}</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBroadcasts.map((broadcast) => {
                  const status = getBroadcastStatus(broadcast.status);
                  return (
                    <TableRow
                      key={broadcast.id}
                      className="group cursor-pointer border-border transition-colors hover:bg-muted/40"
                      onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                    >
                      <TableCell className="font-medium text-foreground">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{broadcast.name}</p>
                          <p className="truncate text-xs text-muted-foreground md:hidden">{broadcast.template_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {broadcast.template_name}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right text-sm font-medium text-foreground tabular-nums sm:table-cell">
                        {broadcast.total_recipients.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell
                          value={broadcast.delivered_count}
                          total={broadcast.total_recipients}
                          color="bg-emerald-500"
                        />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell
                          value={broadcast.read_count}
                          total={broadcast.total_recipients}
                          color="bg-blue-500"
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                        >
                          {status.pulse && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                            </span>
                          )}
                          {tStatus(status.label)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground tabular-nums sm:table-cell">
                        {new Date(broadcast.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
