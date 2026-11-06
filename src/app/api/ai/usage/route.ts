import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { resolveTimeZone, zonedDayKey, zonedDayStart, zonedLastNDayKeys } from '@/lib/ai/usage-days'
import { fetchPagesUpTo } from '@/lib/supabase/paged-query'
import { getT } from '@/lib/i18n/translate'
import { getActualCost } from '@/lib/ai/cost'

const t = getT('Api')

// Rows are aggregated in-process over a bounded window. An active
// account writes a handful of rows per conversation, so 30 days sits
// comfortably under this cap; we surface `truncated` when it doesn't so
// the UI can say "showing a partial window" rather than under-reporting
// silently.
const MAX_ROWS = 10_000
const DEFAULT_WINDOW_DAYS = 30

interface UsageRow {
  id?: string
  created_at: string
  mode: 'auto_reply' | 'draft'
  provider: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost?: number | null
}

/**
 * GET /api/ai/usage?days=30&tz=Europe/Vilnius  (admin+)
 *
 * Token-spend summary for the account's BYO key over the last `days`
 * (1–90, default 30): totals, per-mode + per-model breakdowns, and a
 * zero-filled daily series for charting. Admin-only, mirroring the
 * `ai_usage_log` SELECT policy — spend is billing-class.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const url = new URL(request.url)
    const rawDays = Number(url.searchParams.get('days'))
    // Guard `>= 1`, not just `isFinite`: a missing/blank param is
    // Number(null)/Number('') === 0, which is finite — without the lower
    // bound the default would never apply and the window would collapse
    // to a single day.
    const days =
      Number.isFinite(rawDays) && rawDays >= 1
        ? Math.min(90, Math.floor(rawDays))
        : DEFAULT_WINDOW_DAYS

    const timeZone = resolveTimeZone(url.searchParams.get('tz'))
    const dayKeys = zonedLastNDayKeys(days, timeZone)
    const since = zonedDayStart(dayKeys[0], timeZone)

    let all: UsageRow[]
    try {
      all = await fetchPagesUpTo<UsageRow>(
        (from, to) =>
          supabase
            .from('ai_usage_log')
            .select(
              'id, created_at, mode, provider, model, prompt_tokens, completion_tokens, total_tokens, cost',
            )
            .eq('account_id', accountId)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to),
        MAX_ROWS + 1,
      )
    } catch (queryErr: any) {
      // If DB has not applied migration 070 (cost column), retry without cost
      const msg = String(queryErr?.message || '')
      if (msg.includes('cost') || queryErr?.code === '42703') {
        try {
          all = await fetchPagesUpTo<UsageRow>(
            (from, to) =>
              supabase
                .from('ai_usage_log')
                .select(
                  'id, created_at, mode, provider, model, prompt_tokens, completion_tokens, total_tokens',
                )
                .eq('account_id', accountId)
                .gte('created_at', since.toISOString())
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .range(from, to),
            MAX_ROWS + 1,
          )
        } catch (fallbackError) {
          console.error('[ai/usage GET] fetch fallback error:', fallbackError)
          return NextResponse.json(
            { error: t('ai.loadUsageFailed') },
            { status: 500 },
          )
        }
      } else {
        console.error('[ai/usage GET] fetch error:', queryErr)
        return NextResponse.json(
          { error: t('ai.loadUsageFailed') },
          { status: 500 },
        )
      }
    }

    const truncated = all.length > MAX_ROWS
    const rows = truncated ? all.slice(0, MAX_ROWS) : all

    // Totals & Actual Costs from API responses only (no synthetic calculation).
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let totalReportedCostUsd = 0
    let callsWithCost = 0

    // Per-mode + per-model tallies.
    const byMode = {
      auto_reply: { calls: 0, tokens: 0, cost: null as number | null },
      draft: { calls: 0, tokens: 0, cost: null as number | null },
    }
    const modelMap = new Map<
      string,
      { model: string; provider: string; calls: number; tokens: number; cost: number | null }
    >()

    // Zero-filled daily buckets so the chart shows quiet days as gaps,
    // not missing points. Oldest → newest, in the caller's time zone.
    const daily = new Map<string, { date: string; tokens: number; calls: number }>()
    for (const key of dayKeys) {
      daily.set(key, { date: key, tokens: 0, calls: 0 })
    }

    // Detailed recent logs for request-level inspection (up to 50 latest calls).
    // If the provider returned no cost (e.g. historical data or unsupported provider),
    // cost is set to null (never an estimated number).
    const recentLogs: Array<{
      id?: string
      created_at: string
      mode: string
      provider: string
      model: string
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
      cost: number | null
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rowCost = getActualCost(r.cost)

      promptTokens += r.prompt_tokens
      completionTokens += r.completion_tokens
      totalTokens += r.total_tokens

      if (rowCost !== null) {
        totalReportedCostUsd += rowCost
        callsWithCost += 1
      }

      // `mode` is DB-CHECK-constrained to these two values.
      if (byMode[r.mode]) {
        byMode[r.mode].calls += 1
        byMode[r.mode].tokens += r.total_tokens
        if (rowCost !== null) {
          byMode[r.mode].cost = Number(((byMode[r.mode].cost ?? 0) + rowCost).toFixed(6))
        }
      }

      const mk = `${r.provider}:${r.model}`
      const m =
        modelMap.get(mk) ??
        { model: r.model, provider: r.provider, calls: 0, tokens: 0, cost: null }
      m.calls += 1
      m.tokens += r.total_tokens
      if (rowCost !== null) {
        m.cost = Number(((m.cost ?? 0) + rowCost).toFixed(6))
      }
      modelMap.set(mk, m)

      const bucket = daily.get(zonedDayKey(r.created_at, timeZone))
      if (bucket) {
        bucket.tokens += r.total_tokens
        bucket.calls += 1
      }

      if (i < 50) {
        recentLogs.push({
          id: (r as any).id,
          created_at: r.created_at,
          mode: r.mode,
          provider: r.provider,
          model: r.model,
          prompt_tokens: r.prompt_tokens,
          completion_tokens: r.completion_tokens,
          total_tokens: r.total_tokens,
          cost: rowCost,
        })
      }
    }

    const byModel = [...modelMap.values()].sort((a, b) => b.tokens - a.tokens)

    return NextResponse.json({
      window_days: days,
      time_zone: timeZone,
      truncated,
      totals: {
        calls: rows.length,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        // Only return actual cost if provider reported cost on any calls
        cost: callsWithCost > 0 ? Number(totalReportedCostUsd.toFixed(6)) : null,
        avg_cost_per_call:
          callsWithCost > 0
            ? Number((totalReportedCostUsd / callsWithCost).toFixed(6))
            : null,
      },
      by_mode: byMode,
      by_model: byModel,
      daily: [...daily.values()],
      recent_logs: recentLogs,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
