'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChannelIcon } from '@/components/channels/channel-badge'
import { cn } from '@/lib/utils'
import type { PhoneHealth } from '@/lib/whatsapp/phone-health'
import type { MetaChannelConnection } from '@/types'

const DOT_CLASS = {
  GREEN: 'bg-emerald-500',
  YELLOW: 'bg-amber-500',
  RED: 'bg-rose-500',
  UNKNOWN: 'bg-muted-foreground/60',
} as const

export function ChannelHealthStrip() {
  const [waHealth, setWaHealth] = useState<PhoneHealth | null>(null)
  const [metaChannels, setMetaChannels] = useState<MetaChannelConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      fetch('/api/whatsapp/health').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/channels/meta').then((r) => (r.ok ? r.json() : null)),
    ]).then(([waRes, metaRes]) => {
      if (cancelled) return
      if (waRes.status === 'fulfilled' && waRes.value) {
        setWaHealth(waRes.value as PhoneHealth)
      }
      if (metaRes.status === 'fulfilled' && metaRes.value?.channels) {
        setMetaChannels(metaRes.value.channels as MetaChannelConnection[])
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const igConn = metaChannels.find((c) => c.channel === 'instagram' && c.status === 'connected')
  const fbConn = metaChannels.find((c) => c.channel === 'facebook' && c.status === 'connected')

  const waDot =
    waHealth?.state === 'connected'
      ? DOT_CLASS.GREEN
      : waHealth?.state === 'disconnected'
        ? DOT_CLASS.RED
        : DOT_CLASS.UNKNOWN

  const igDot = igConn ? DOT_CLASS.GREEN : DOT_CLASS.UNKNOWN
  const fbDot = fbConn ? DOT_CLASS.GREEN : DOT_CLASS.UNKNOWN

  return (
    <div className="flex items-center gap-2">
      {/* WhatsApp Health Pill */}
      <Link
        href="/settings?tab=whatsapp"
        title="WhatsApp Cloud API Connection"
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChannelIcon channel="whatsapp" className="size-3.5 text-emerald-500" />
        <span className={cn('size-1.5 shrink-0 rounded-full', waDot)} aria-hidden />
        <span className="font-medium text-foreground">WhatsApp</span>
        <span className="hidden md:inline text-muted-foreground tabular-nums">
          {waHealth?.displayPhoneNumber || (loading ? 'Checking...' : 'Not Connected')}
        </span>
      </Link>

      {/* Instagram Direct Health Pill */}
      <Link
        href="/settings?tab=channels"
        title="Instagram Professional Direct Connection"
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChannelIcon channel="instagram" className="size-3.5 text-pink-500" />
        <span className={cn('size-1.5 shrink-0 rounded-full', igDot)} aria-hidden />
        <span className="font-medium text-foreground">Instagram</span>
        <span className="hidden md:inline text-muted-foreground">
          {igConn?.instagram_username ? `@${igConn.instagram_username}` : (loading ? 'Checking...' : 'Not Connected')}
        </span>
      </Link>

      {/* Facebook Messenger Health Pill */}
      <Link
        href="/settings?tab=channels"
        title="Facebook Messenger Connection"
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChannelIcon channel="facebook" className="size-3.5 text-blue-500" />
        <span className={cn('size-1.5 shrink-0 rounded-full', fbDot)} aria-hidden />
        <span className="font-medium text-foreground">Messenger</span>
        <span className="hidden md:inline text-muted-foreground">
          {fbConn?.page_name || (loading ? 'Checking...' : 'Not Connected')}
        </span>
      </Link>
    </div>
  )
}
