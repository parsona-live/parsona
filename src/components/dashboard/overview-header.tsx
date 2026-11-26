'use client'

import { useRouter } from 'next/navigation'
import { Briefcase, ChevronDown, Plus, Radio, UserPlus, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  OVERVIEW_RANGES,
  minutesBetween,
  needsSetup,
  type DashboardOverview,
  type OverviewRange,
} from '@/lib/dashboard/overview'
import { Skeleton } from './skeleton'
import { useFormatDuration } from './use-format-duration'
import { ChannelIcon } from '@/components/channels/channel-badge'
import { cn } from '@/lib/utils'

interface ChannelOption {
  key: string
  label: string
  channel: 'all' | 'whatsapp' | 'instagram' | 'facebook'
  color?: string
}

const CHANNELS: ChannelOption[] = [
  { key: 'all', label: 'All Channels', channel: 'all' },
  { key: 'whatsapp', label: 'WhatsApp', channel: 'whatsapp', color: 'text-emerald-500' },
  { key: 'instagram', label: 'Instagram', channel: 'instagram', color: 'text-pink-500' },
  { key: 'facebook', label: 'Messenger', channel: 'facebook', color: 'text-blue-500' },
]

const NEW_ITEMS = [
  { key: 'newContact', href: '/contacts', icon: UserPlus },
  { key: 'newDeal', href: '/pipelines', icon: Briefcase },
  { key: 'newBroadcast', href: '/broadcasts/new', icon: Radio },
  { key: 'newAutomation', href: '/automations/new', icon: Zap },
] as const

function partOfDay(date: Date): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export function OverviewHeader({
  data,
  now,
  name,
  range,
  onRangeChange,
  channel = 'all',
  onChannelChange,
}: {
  data: DashboardOverview | null
  now: number
  name: string | null
  range: OverviewRange
  onRangeChange: (range: OverviewRange) => void
  channel?: string
  onChannelChange?: (channel: string) => void
}) {
  const t = useTranslations('Dashboard.overview.header')
  const router = useRouter()
  const formatDuration = useFormatDuration()
  const firstName = name?.trim().split(/\s+/)[0] || null

  let context: string | null = null
  if (data) {
    const a = data.attention
    if (needsSetup(data.setup)) context = t('contextSetup')
    else if (a.waiting > 0 && a.oldestWaitingSince)
      context = t('contextWaiting', {
        count: a.waiting,
        wait: formatDuration(minutesBetween(a.oldestWaitingSince, now)),
      })
    else context = t('contextClear')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {data ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {firstName
                  ? t(`greeting.${partOfDay(new Date(now))}`, { name: firstName })
                  : t(`greetingNoName.${partOfDay(new Date(now))}`)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{context}</p>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-56" />
              <Skeleton className="mt-2 h-4 w-80" />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onChannelChange ? (
            <Tabs value={channel} onValueChange={onChannelChange}>
              <TabsList aria-label="Filter by channel" className="h-8">
                {CHANNELS.map(({ key, label, channel: chKey, color }) => (
                  <TabsTrigger key={key} value={key} className="flex items-center gap-1.5 px-2.5 text-xs">
                    {chKey !== 'all' ? <ChannelIcon channel={chKey} className={cn('size-3.5', color)} /> : null}
                    <span>{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
          <Tabs value={String(range)} onValueChange={(v) => onRangeChange(Number(v) as OverviewRange)}>
            <TabsList aria-label={t('rangeLabel')} className="h-8">
              {OVERVIEW_RANGES.map((r) => (
                <TabsTrigger key={r} value={String(r)} className="px-2.5 text-xs">
                  {t(`range.${r}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ size: 'sm' })}>
              <Plus aria-hidden />
              {t('new')}
              <ChevronDown className="opacity-70" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {NEW_ITEMS.map(({ key, href, icon: Icon }) => (
                <DropdownMenuItem key={key} onClick={() => router.push(href)}>
                  <Icon aria-hidden />
                  {t(key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
