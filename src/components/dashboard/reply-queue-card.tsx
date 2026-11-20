'use client'

import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ChannelIcon } from '@/components/channels/channel-badge'

import { buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  minutesBetween,
  waitTone,
  type DashboardOverview,
} from '@/lib/dashboard/overview'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { initialsOf } from './initials'
import { Skeleton } from './skeleton'
import { useFormatDuration } from './use-format-duration'

const WAIT_CLASS = {
  critical: 'text-status-critical',
  warning: 'text-status-warning',
  normal: 'text-muted-foreground',
} as const

const WINDOW_WARNING_MINUTES = 120

export function ReplyQueueCard({ data, now }: { data: DashboardOverview | null; now: number }) {
  const t = useTranslations('Dashboard.overview.queue')
  const formatDuration = useFormatDuration()
  const names = new Map((data?.replies.team ?? []).map((m) => [m.userId, m.name]))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
        <CardAction>
          <Link href="/inbox?filter=waiting" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {t('openInbox')}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2">
        {!data ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data.attention.queue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={t('empty')} hint={t('emptyHint')} className="mx-2 flex-1" />
        ) : (
          <ul className="space-y-0.5">
            {data.attention.queue.map((q) => {
              const waited = minutesBetween(q.waitingSince, now)
              const windowLeft = (new Date(q.windowClosesAt).getTime() - now) / 60_000
              const name = q.contactName || q.contactPhone || t('unknownContact')
              const assignee = q.assignedAgentId ? names.get(q.assignedAgentId) : null
              return (
                <li key={q.conversationId}>
                  <Link
                    href={`/inbox?c=${q.conversationId}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="relative">
                      <Avatar>
                        {q.avatarUrl ? <AvatarImage src={q.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5 shadow-xs">
                        <ChannelIcon channel={q.channel || 'whatsapp'} className="size-3" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{q.preview || t('noPreview')}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {windowLeft > 0 ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 h-4 gap-1',
                              windowLeft <= 120
                                ? 'border-status-critical/60 text-status-critical animate-pulse bg-status-critical/10'
                                : windowLeft <= 360
                                  ? 'border-status-warning/60 text-status-warning bg-status-warning/10'
                                  : 'border-status-good/40 text-status-good bg-status-good/5',
                            )}
                          >
                            <Clock className="size-2.5" />
                            <span>{formatDuration(windowLeft)} left</span>
                          </Badge>
                        ) : null}
                        {q.handedOff ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {t('handedOff')}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          WAIT_CLASS[waitTone(waited, data.replyTargetMinutes)],
                        )}
                      >
                        {formatDuration(waited)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {assignee ?? (q.assignedAgentId ? t('assigned') : t('unassigned'))}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
