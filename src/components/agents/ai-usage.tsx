'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { BarChart3, Bot, PencilLine, DollarSign, Activity, FileText, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/dashboard/skeleton';
import { BarChart } from '@/components/tremor/bar-chart';
import { formatCompactNumber } from '@/lib/currency';
import { formatAiCost } from '@/lib/ai/cost';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';

interface UsageResponse {
  window_days: number;
  truncated: boolean;
  totals: {
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number | null;
    avg_cost_per_call?: number | null;
  };
  by_mode: {
    auto_reply: { calls: number; tokens: number; cost?: number | null };
    draft: { calls: number; tokens: number; cost?: number | null };
  };
  by_model: {
    model: string;
    provider: string;
    calls: number;
    tokens: number;
    cost?: number | null;
  }[];
  daily: { date: string; tokens: number; calls: number }[];
  recent_logs?: Array<{
    id?: string;
    created_at: string;
    mode: string;
    provider: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number | null;
  }>;
}

const WINDOWS = [7, 30, 90] as const;

/**
 * Token-spend dashboard for the account's BYO key. Admin-only (spend is
 * billing-class), mirroring the `ai_usage_log` SELECT policy and the
 * `GET /api/ai/usage` route. Renders nothing for non-admins.
 */
export function AiUsageCard() {
  const t = useTranslations('Agents.usage');
  const { accountId, accountRole, profileLoading } = useAuth();
  const canView = accountRole ? canEditSettings(accountRole) : false;

  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageResponse | null>(null);
  const loadedRef = useRef<string | null>(null);

  const fetchUsage = useCallback(async (windowDays: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(windowDays),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const res = await fetch(`/api/ai/usage?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? t('loadFailed'));
        setData(null);
        return;
      }
      setData(json as UsageResponse);
    } catch {
      toast.error(t('loadFailed'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canView || !accountId) return;
    // Refetch on account switch or window change.
    const key = `${accountId}:${days}`;
    if (loadedRef.current === key) return;
    loadedRef.current = key;
    void fetchUsage(days);
  }, [canView, accountId, days, fetchUsage]);

  if (profileLoading || !canView) return null;

  // The category label doubles as the data key so the chart tooltip
  // shows the translated series name.
  const tokensLabel = t('tokens');
  const chartData =
    data?.daily.map((d) => ({
      day: format(parseISO(d.date), 'MMM d'),
      [tokensLabel]: d.tokens,
    })) ?? [];
  const hasSpend = (data?.totals.total_tokens ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> {t('title')}
            </CardTitle>
            <CardDescription>
              {t('description')}
            </CardDescription>
          </div>
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger className="w-32 flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {t('window', { days: w })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading || !data ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !hasSpend ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <BarChart3 className="h-8 w-8 opacity-40" />
            <p>{t('empty', { days: data.window_days })}</p>
            <p className="text-xs">
              {t('emptyHint')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label={t('actualCost')}
                value={
                  data.totals.cost !== null && data.totals.cost !== undefined
                    ? formatAiCost(data.totals.cost, true)
                    : '—'
                }
                subvalue={
                  data.totals.cost === null || data.totals.cost === undefined
                    ? t('noCostReported')
                    : undefined
                }
                icon={DollarSign}
                accent={data.totals.cost !== null && data.totals.cost !== undefined}
              />
              <Stat
                label={t('avgCostPerCall')}
                value={
                  data.totals.avg_cost_per_call !== null && data.totals.avg_cost_per_call !== undefined
                    ? formatAiCost(data.totals.avg_cost_per_call, false)
                    : '—'
                }
                icon={Activity}
              />
              <Stat
                label={t('totalTokens')}
                value={formatCompactNumber(data.totals.total_tokens)}
                subvalue={`${formatCompactNumber(data.totals.prompt_tokens)} in · ${formatCompactNumber(data.totals.completion_tokens)} out`}
                icon={BarChart3}
              />
              <Stat
                label={t('llmCalls')}
                value={String(data.totals.calls)}
                icon={Layers}
              />
              <Stat
                label={t('autoReply')}
                value={formatCompactNumber(data.by_mode.auto_reply.tokens)}
                subvalue={
                  data.by_mode.auto_reply.cost !== null && data.by_mode.auto_reply.cost !== undefined
                    ? `${data.by_mode.auto_reply.calls} calls · ${formatAiCost(data.by_mode.auto_reply.cost, false)}`
                    : `${data.by_mode.auto_reply.calls} calls`
                }
                icon={Bot}
              />
              <Stat
                label={t('drafts')}
                value={formatCompactNumber(data.by_mode.draft.tokens)}
                subvalue={
                  data.by_mode.draft.cost !== null && data.by_mode.draft.cost !== undefined
                    ? `${data.by_mode.draft.calls} calls · ${formatAiCost(data.by_mode.draft.cost, false)}`
                    : `${data.by_mode.draft.calls} calls`
                }
                icon={PencilLine}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('tokensPerDay')}
              </p>
              <BarChart
                data={chartData}
                index="day"
                categories={[tokensLabel]}
                colors={['violet']}
                valueFormatter={(v) => formatCompactNumber(v)}
                showLegend={false}
                yAxisWidth={48}
                className="h-[200px]"
              />
            </div>

            {data.by_model.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t('byModel')}
                </p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.by_model.map((m) => (
                    <li
                      key={`${m.provider}:${m.model}`}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-foreground font-medium">{m.model}</span>{' '}
                        <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                          {m.provider}
                        </Badge>
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0 tabular-nums text-muted-foreground">
                        <span>
                          {t('modelCalls', {
                            tokens: formatCompactNumber(m.tokens),
                            count: m.calls,
                          })}
                        </span>
                        {m.cost !== null && m.cost !== undefined ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatAiCost(m.cost, false)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.recent_logs && data.recent_logs.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {t('requestLogs')}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('requestLogsHint')}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {data.recent_logs.length} latest calls
                  </span>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <div className="max-h-[320px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs">
                        <TableRow className="text-xs">
                          <TableHead className="py-2">Time</TableHead>
                          <TableHead className="py-2">Feature</TableHead>
                          <TableHead className="py-2">Provider & Model</TableHead>
                          <TableHead className="py-2 text-right">Prompt</TableHead>
                          <TableHead className="py-2 text-right">Comp.</TableHead>
                          <TableHead className="py-2 text-right">Total Tok.</TableHead>
                          <TableHead className="py-2 text-right">Cost (API)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {data.recent_logs.map((log, idx) => (
                          <TableRow key={log.id ?? idx} className="hover:bg-muted/30">
                            <TableCell className="py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {format(parseISO(log.created_at), 'MMM d, HH:mm:ss')}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant={
                                  log.mode === 'auto_reply'
                                    ? 'default'
                                    : log.mode === 'draft'
                                      ? 'secondary'
                                      : 'outline'
                                }
                                className="text-[10px] px-1.5 py-0 h-4 uppercase font-semibold"
                              >
                                {log.mode === 'auto_reply'
                                  ? 'Auto-Reply'
                                  : log.mode === 'draft'
                                    ? 'Draft'
                                    : log.mode}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 max-w-[200px] truncate">
                              <span className="font-medium text-foreground">{log.model}</span>
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                ({log.provider})
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                              {formatCompactNumber(log.prompt_tokens)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                              {formatCompactNumber(log.completion_tokens)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums font-medium">
                              {formatCompactNumber(log.total_tokens)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums">
                              {log.cost !== null && log.cost !== undefined ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatAiCost(log.cost, false)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {data.truncated && (
              <p className="text-xs text-muted-foreground">
                {t('partialWindow')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  subvalue,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  subvalue?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        accent ? 'border-primary/40 bg-primary/5' : 'border-border'
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className={`h-3.5 w-3.5 ${accent ? 'text-primary' : ''}`} />}
        {label}
      </p>
      <p className="mt-1 text-base sm:text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {subvalue && (
        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums truncate">
          {subvalue}
        </p>
      )}
    </div>
  );
}
