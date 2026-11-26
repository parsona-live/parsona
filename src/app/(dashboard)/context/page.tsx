'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Users,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Flame,
  Zap,
  Snowflake,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react'
import { ChannelIcon } from '@/components/channels/channel-badge'
import type { Contact, IntentCategory, Tag } from '@/types'

const PAGE_SIZE = 24

interface ContactCardData extends Contact {
  tags?: Tag[]
  last_message_text?: string | null
  last_message_at?: string | null
}

export default function ContextHubPage() {
  const router = useRouter()
  const supabase = createClient()

  const [contacts, setContacts] = useState<ContactCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram' | 'facebook'>('all')
  const [intentFilter, setIntentFilter] = useState<'all' | 'hot' | 'warm' | 'cold' | 'attention'>('all')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Real KPI statistics
  const [kpis, setKpis] = useState({
    total: 0,
    highIntent: 0,
    needsAttention: 0,
    activeCustomers: 0,
  })

  const fetchSeq = useRef(0)

  const loadKpis = useCallback(async () => {
    // 1. Total Contacts
    const { count: total } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('linked_contact_id', null)

    // 2. High Intent Leads (ready_to_convert or intent_score >= 75)
    const { count: highIntent } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('linked_contact_id', null)
      .or('intent_category.eq.ready_to_convert,intent_score.gte.75')

    // 3. Needs Attention (support_needed, at_risk, or canceled)
    const { count: attention } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('linked_contact_id', null)
      .or('intent_category.eq.support_needed,last_business_action.ilike.%cancel%,last_business_action.ilike.%fail%')

    // 4. Active / Engaged
    const { count: active } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('linked_contact_id', null)
      .or('intent_category.eq.customer_active,last_business_action.ilike.%completed%,last_business_action.ilike.%booked%')

    setKpis({
      total: total || 0,
      highIntent: highIntent || 0,
      needsAttention: attention || 0,
      activeCustomers: active || 0,
    })
  }, [supabase])

  const fetchUnifiedContacts = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .is('linked_contact_id', null)
      .order('updated_at', { ascending: false })
      .range(from, to)

    // Filter by channel
    if (channelFilter === 'whatsapp') {
      query = query.neq('phone', '')
    } else if (channelFilter === 'instagram') {
      query = query.not('ig_user_id', 'is', null)
    } else if (channelFilter === 'facebook') {
      query = query.not('fb_page_scoped_id', 'is', null)
    }

    // Filter by Intent / Stage
    if (intentFilter === 'hot') {
      query = query.or('intent_category.eq.ready_to_convert,intent_score.gte.75')
    } else if (intentFilter === 'warm') {
      query = query.or('intent_category.eq.purchase_evaluation,intent_category.eq.information_seeking')
    } else if (intentFilter === 'cold') {
      query = query.or('intent_category.eq.inactive,intent_category.eq.unknown')
    } else if (intentFilter === 'attention') {
      query = query.or('intent_category.eq.support_needed,last_business_action.ilike.%cancel%,last_business_action.ilike.%fail%')
    }

    // Search query
    const term = search.trim()
    if (term) {
      query = query.or(
        `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,ig_username.ilike.%${term}%,fb_name.ilike.%${term}%,intent_summary.ilike.%${term}%,last_business_action.ilike.%${term}%`,
      )
    }

    const { data, count, error } = await query
    if (seq !== fetchSeq.current) return

    if (error || !data) {
      setContacts([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    setTotalCount(count ?? 0)

    // Fetch tags, linked channels, & latest conversation previews for contacts
    const contactIds = data.map((c) => c.id)
    const [tagsRes, linkedRes] = await Promise.all([
      supabase
        .from('contact_tags')
        .select('contact_id, tags(id, name, color)')
        .in('contact_id', contactIds),
      supabase
        .from('contacts')
        .select('*')
        .in('linked_contact_id', contactIds),
    ])

    const linkedByRoot: Record<string, Contact[]> = {}
    const allRelevantIds = [...contactIds]
    linkedRes.data?.forEach((child: any) => {
      if (child.linked_contact_id) {
        if (!linkedByRoot[child.linked_contact_id]) linkedByRoot[child.linked_contact_id] = []
        linkedByRoot[child.linked_contact_id].push(child)
        allRelevantIds.push(child.id)
      }
    })

    const { data: convsData } = await supabase
      .from('conversations')
      .select('contact_id, last_message_text, last_message_at')
      .in('contact_id', allRelevantIds)
      .order('last_message_at', { ascending: false })

    const tagsByContact: Record<string, Tag[]> = {}
    tagsRes.data?.forEach((ct: any) => {
      if (ct.tags) {
        if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = []
        tagsByContact[ct.contact_id].push(ct.tags)
      }
    })

    const lastMsgByContact: Record<string, { text?: string | null; at?: string | null }> = {}
    convsData?.forEach((conv: any) => {
      if (!lastMsgByContact[conv.contact_id]) {
        lastMsgByContact[conv.contact_id] = {
          text: conv.last_message_text,
          at: conv.last_message_at,
        }
      }
    })

    const enriched: ContactCardData[] = data.map((c) => {
      const children = linkedByRoot[c.id] || []
      const mergedPhone = c.phone || children.find((x) => x.phone && x.phone !== '')?.phone || ''
      const mergedIgUser = c.ig_username || children.find((x) => x.ig_username)?.ig_username || null
      const mergedIgId = c.ig_user_id || children.find((x) => x.ig_user_id)?.ig_user_id || null
      const mergedFbName = c.fb_name || children.find((x) => x.fb_name)?.fb_name || null
      const mergedFbId = c.fb_page_scoped_id || children.find((x) => x.fb_page_scoped_id)?.fb_page_scoped_id || null
      const mergedAvatar = c.avatar_url || children.find((x) => x.avatar_url)?.avatar_url || null

      const allTags = [...(tagsByContact[c.id] || [])]
      for (const child of children) {
        if (tagsByContact[child.id]) {
          for (const t of tagsByContact[child.id]) {
            if (!allTags.some((x) => x.id === t.id)) allTags.push(t)
          }
        }
      }

      let latestMsg = lastMsgByContact[c.id]
      for (const child of children) {
        const cMsg = lastMsgByContact[child.id]
        if (cMsg?.at && (!latestMsg?.at || new Date(cMsg.at) > new Date(latestMsg.at))) {
          latestMsg = cMsg
        }
      }

      return {
        ...c,
        phone: mergedPhone,
        ig_username: mergedIgUser,
        ig_user_id: mergedIgId,
        fb_name: mergedFbName,
        fb_page_scoped_id: mergedFbId,
        avatar_url: mergedAvatar,
        tags: allTags,
        last_message_text: latestMsg?.text ?? null,
        last_message_at: latestMsg?.at ?? null,
      }
    })

    setContacts(enriched)
    setLoading(false)
  }, [supabase, page, search, channelFilter, intentFilter])

  useEffect(() => {
    fetchUnifiedContacts()
  }, [fetchUnifiedContacts])

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  function getInitials(name?: string | null): string {
    if (!name) return '?'
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  function renderIntentBadge(category?: IntentCategory | null, score?: number | null) {
    if (category === 'ready_to_convert' || (score !== null && score !== undefined && score >= 75)) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 font-semibold text-[11px] py-0.5">
          <Flame className="size-3 text-emerald-400 fill-emerald-400/20" />
          {score ? `${score}/100 ` : ''}Hot Lead
        </Badge>
      )
    }
    if (category === 'support_needed') {
      return (
        <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1 font-semibold text-[11px] py-0.5">
          <AlertTriangle className="size-3 text-rose-400" />
          Needs Attention
        </Badge>
      )
    }
    if (category === 'purchase_evaluation') {
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 font-semibold text-[11px] py-0.5">
          <Zap className="size-3 text-amber-400 fill-amber-400/20" />
          {score ? `${score}/100 ` : ''}Evaluating
        </Badge>
      )
    }
    if (category === 'customer_active') {
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1 font-semibold text-[11px] py-0.5">
          <CheckCircle2 className="size-3 text-blue-400" />
          Active Customer
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground border-border text-[11px] py-0.5 rounded">
        {category ? category.replace(/_/g, ' ') : 'Inquiry'}
      </Badge>
    )
  }

  function renderSocialBadge(channel: 'whatsapp' | 'instagram' | 'facebook', title: string) {
    if (channel === 'instagram') {
      return (
        <span
          title={title}
          className="size-4.5 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center ring-2 ring-card shadow-xs"
        >
          <ChannelIcon channel="instagram" size="xs" className="h-2.5 w-2.5 text-white stroke-[2.2]" />
        </span>
      )
    }
    if (channel === 'facebook') {
      return (
        <span
          title={title}
          className="size-4.5 rounded-full bg-[#0084FF] text-white flex items-center justify-center ring-2 ring-card shadow-xs"
        >
          <ChannelIcon channel="facebook" size="xs" className="h-2.5 w-2.5 text-white" />
        </span>
      )
    }
    return (
      <span
        title={title}
        className="size-4.5 rounded-full bg-[#25D366] text-white flex items-center justify-center ring-2 ring-card shadow-xs"
      >
        <ChannelIcon channel="whatsapp" size="xs" className="h-2.5 w-2.5 text-white" />
      </span>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Customer Context Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unified customer memory, intent signals, business milestones, and connected channels.
          </p>
        </div>

        {/* Global View Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadKpis()
              fetchUnifiedContacts()
            }}
            className="h-8 gap-1.5 text-xs rounded-md"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>

          <div className="flex items-center border border-border rounded-md p-0.5 bg-card">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('cards')}
              className={`h-7 px-2.5 text-xs rounded ${viewMode === 'cards' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'}`}
            >
              <LayoutGrid className="size-3.5 mr-1" />
              Cards
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('table')}
              className={`h-7 px-2.5 text-xs rounded ${viewMode === 'table' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'}`}
            >
              <List className="size-3.5 mr-1" />
              Table
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-md border border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Contacts</p>
            <p className="text-2xl font-semibold text-foreground mt-0.5 tabular-nums">{kpis.total}</p>
          </div>
          <div className="size-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="size-4" />
          </div>
        </div>

        <div className="p-4 rounded-md border border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Flame className="size-3.5 text-emerald-500" /> High Intent Leads
            </p>
            <p className="text-2xl font-semibold text-foreground mt-0.5 tabular-nums">{kpis.highIntent}</p>
          </div>
          <div className="size-9 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <TrendingUp className="size-4" />
          </div>
        </div>

        <div className="p-4 rounded-md border border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-rose-500" /> Needs Attention
            </p>
            <p className="text-2xl font-semibold text-foreground mt-0.5 tabular-nums">{kpis.needsAttention}</p>
          </div>
          <div className="size-9 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-500">
            <Clock className="size-4" />
          </div>
        </div>

        <div className="p-4 rounded-md border border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Target className="size-3.5 text-blue-500" /> Active / Converted
            </p>
            <p className="text-2xl font-semibold text-foreground mt-0.5 tabular-nums">{kpis.activeCustomers}</p>
          </div>
          <div className="size-9 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500">
            <CheckCircle2 className="size-4" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Universal Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Search name, phone, handle, or intent..."
            className="pl-9 h-9 text-xs rounded-md"
          />
        </div>

        {/* Intent Temperature Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIntentFilter('all'); setPage(0); }}
            className={`h-8 px-2.5 text-xs rounded-md ${intentFilter === 'all' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'}`}
          >
            All Leads
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIntentFilter('hot'); setPage(0); }}
            className={`h-8 px-2.5 text-xs rounded-md ${intentFilter === 'hot' ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-muted-foreground'}`}
          >
            <Flame className="size-3 mr-1 text-emerald-500" />
            Hot
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIntentFilter('warm'); setPage(0); }}
            className={`h-8 px-2.5 text-xs rounded-md ${intentFilter === 'warm' ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-muted-foreground'}`}
          >
            <Zap className="size-3 mr-1 text-amber-500" />
            Evaluating
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIntentFilter('attention'); setPage(0); }}
            className={`h-8 px-2.5 text-xs rounded-md ${intentFilter === 'attention' ? 'bg-rose-500/10 text-rose-500 font-medium' : 'text-muted-foreground'}`}
          >
            <AlertTriangle className="size-3 mr-1 text-rose-500" />
            Attention
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIntentFilter('cold'); setPage(0); }}
            className={`h-8 px-2.5 text-xs rounded-md ${intentFilter === 'cold' ? 'bg-blue-500/10 text-blue-500 font-medium' : 'text-muted-foreground'}`}
          >
            <Snowflake className="size-3 mr-1 text-blue-500" />
            Cold
          </Button>
        </div>

        {/* Channel Selector with proper brand icons */}
        <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-card shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setChannelFilter('all'); setPage(0); }}
            className={`h-7 px-2.5 text-[11px] rounded ${channelFilter === 'all' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'}`}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setChannelFilter('whatsapp'); setPage(0); }}
            className={`h-7 px-2 text-[11px] rounded gap-1.5 ${channelFilter === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-muted-foreground'}`}
            title="WhatsApp"
          >
            <ChannelIcon channel="whatsapp" size="xs" className="text-[#25D366]" />
            <span>WhatsApp</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setChannelFilter('instagram'); setPage(0); }}
            className={`h-7 px-2 text-[11px] rounded gap-1.5 ${channelFilter === 'instagram' ? 'bg-pink-500/10 text-pink-500 font-medium' : 'text-muted-foreground'}`}
            title="Instagram"
          >
            <ChannelIcon channel="instagram" size="xs" className="text-[#E4405F]" />
            <span>Instagram</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setChannelFilter('facebook'); setPage(0); }}
            className={`h-7 px-2 text-[11px] rounded gap-1.5 ${channelFilter === 'facebook' ? 'bg-blue-500/10 text-blue-500 font-medium' : 'text-muted-foreground'}`}
            title="Facebook Messenger"
          >
            <ChannelIcon channel="facebook" size="xs" className="text-[#0084FF]" />
            <span>Facebook</span>
          </Button>
        </div>
      </div>

      {/* 4. Main Cards View / Table View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-md border border-border bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-16 text-center">
          <Users className="size-9 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No customer profiles found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or filter tabs to view more customer profiles.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => {
            const hasWa = Boolean(c.phone && c.phone !== '')
            const hasIg = Boolean(c.ig_user_id || c.ig_username)
            const hasFb = Boolean(c.fb_page_scoped_id || c.fb_name)

            return (
              <div
                key={c.id}
                onClick={() => router.push(`/context/${c.id}`)}
                className="group relative p-4 rounded-md border border-border bg-card hover:border-foreground/25 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Avatar, Name, Intent Badge */}
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="size-10 rounded-md border border-border">
                          {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                          <AvatarFallback className="rounded-md bg-muted text-foreground font-semibold text-xs">
                            {getInitials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Overlapping Connected Channel Icon Badges */}
                        <div className="absolute -bottom-1 -right-1 flex items-center -space-x-1">
                          {hasWa && renderSocialBadge('whatsapp', `WhatsApp: ${c.phone}`)}
                          {hasIg && renderSocialBadge('instagram', `Instagram: ${c.ig_username ? `@${c.ig_username}` : c.ig_user_id}`)}
                          {hasFb && renderSocialBadge('facebook', `Facebook: ${c.fb_name || c.fb_page_scoped_id}`)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate group-hover:underline">
                          {c.name || 'Unnamed Customer'}
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">
                          {c.phone || c.email || (c.ig_username ? `@${c.ig_username}` : c.fb_name || '-')}
                        </p>
                      </div>
                    </div>

                    {renderIntentBadge(c.intent_category, c.intent_score)}
                  </div>

                  {/* Business Milestone Badge */}
                  {c.last_business_action && (
                    <div className="mb-2.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted border border-border/80 text-[11px] font-medium text-foreground">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span className="truncate max-w-[230px]">{c.last_business_action}</span>
                      </div>
                    </div>
                  )}

                  {/* Executive Intent Summary */}
                  <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">
                    {c.intent_summary || c.last_action_summary || 'Customer initiated inquiry across connected channels.'}
                  </div>

                  {/* Next Best Action */}
                  {c.next_best_action && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1 truncate">
                      <ArrowRight className="size-3 text-foreground shrink-0" />
                      <span className="font-medium text-foreground shrink-0">Next:</span>
                      <span className="truncate">{c.next_best_action}</span>
                    </div>
                  )}
                </div>

                {/* Footer Strip */}
                <div className="pt-2.5 mt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>
                      {c.last_action_at
                        ? new Date(c.last_action_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                        : 'Recently'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/inbox?contactId=${c.id}`)
                      }}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <MessageSquare className="size-3 mr-1" />
                      Inbox
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="text-xs text-muted-foreground">Customer</TableHead>
                <TableHead className="text-xs text-muted-foreground">Channels</TableHead>
                <TableHead className="text-xs text-muted-foreground">Intent & Temperature</TableHead>
                <TableHead className="text-xs text-muted-foreground">Business Milestone</TableHead>
                <TableHead className="text-xs text-muted-foreground">Recommended Next Action</TableHead>
                <TableHead className="text-xs text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => {
                const hasWa = Boolean(c.phone && c.phone !== '')
                const hasIg = Boolean(c.ig_user_id || c.ig_username)
                const hasFb = Boolean(c.fb_page_scoped_id || c.fb_name)

                return (
                  <TableRow
                    key={c.id}
                    onClick={() => router.push(`/context/${c.id}`)}
                    className="border-border hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 rounded-md">
                          {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                          <AvatarFallback className="rounded-md bg-muted text-foreground text-xs font-semibold">
                            {getInitials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{c.name || 'Unnamed'}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {c.phone || c.email || (c.ig_username ? `@${c.ig_username}` : c.fb_name || '-')}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {hasWa && (
                          <span
                            title={`WhatsApp: ${c.phone}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 text-[10px] font-medium"
                          >
                            <ChannelIcon channel="whatsapp" size="xs" />
                          </span>
                        )}
                        {hasIg && (
                          <span
                            title={`Instagram: ${c.ig_username ? `@${c.ig_username}` : c.ig_user_id}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E4405F]/10 text-[#E4405F] border border-[#E4405F]/20 text-[10px] font-medium"
                          >
                            <ChannelIcon channel="instagram" size="xs" />
                          </span>
                        )}
                        {hasFb && (
                          <span
                            title={`Facebook: ${c.fb_name || c.fb_page_scoped_id}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0084FF]/10 text-[#0084FF] border border-[#0084FF]/20 text-[10px] font-medium"
                          >
                            <ChannelIcon channel="facebook" size="xs" />
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>{renderIntentBadge(c.intent_category, c.intent_score)}</TableCell>

                    <TableCell className="text-xs text-foreground font-medium">
                      {c.last_business_action || <span className="text-muted-foreground">-</span>}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {c.next_best_action || c.intent_summary || '-'}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/context/${c.id}`)
                        }}
                        className="h-7 text-xs"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 5. Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} contacts
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 text-xs border-border"
            >
              <ChevronLeft className="size-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs border-border"
            >
              Next
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
