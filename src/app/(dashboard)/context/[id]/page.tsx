'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Mail,
  Building2,
  Calendar,
  History,
  Loader2,
  Save,
  Trash2,
  Plus,
  Clock,
  Flame,
  Zap,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  FileText,
  Database,
} from 'lucide-react'
import { ChannelIcon } from '@/components/channels/channel-badge'
import { toast } from 'sonner'
import { getOmnichannelProfile, type OmnichannelProfileDetails } from '@/lib/contacts/omnichannel-profile'
import type {
  ContactIntelligenceSnapshot,
  ContactMemory,
  IntentCategory,
} from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CustomerContextDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const contactId = resolvedParams.id
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [refreshingAi, setRefreshingAi] = useState(false)
  const [profile, setProfile] = useState<OmnichannelProfileDetails | null>(null)
  const [intelligence, setIntelligence] = useState<ContactIntelligenceSnapshot | null>(null)
  const [memories, setMemories] = useState<ContactMemory[]>([])
  const [crmRecords, setCrmRecords] = useState<Array<{
    id: string
    data: Record<string, unknown>
    created_at: string
    created_by_type: string
    crm_collections?: { id: string; slug: string; name: string } | null
  }>>([])

  // Edit fields
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)

  // New Memory creation
  const [newMemKey, setNewMemKey] = useState('')
  const [newMemVal, setNewMemVal] = useState('')
  const [addingMemory, setAddingMemory] = useState(false)

  // Sub-channel transcript filter
  const [activeChatChannel, setActiveChatChannel] = useState<'all' | 'whatsapp' | 'instagram' | 'facebook'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch omnichannel profile
    const profileData = await getOmnichannelProfile(supabase, contactId)
    if (profileData) {
      setProfile(profileData)
      setEditName(profileData.contact.name || '')
      setEditPhone(profileData.contact.phone || '')
      setEditEmail(profileData.contact.email || '')
      setEditCompany(profileData.contact.company || '')
    }

    // 2. Fetch latest intelligence snapshot
    const intelRes = await fetch(`/api/context/${contactId}/intelligence`)
      .then((r) => r.json())
      .catch(() => null)
    if (intelRes?.snapshot) {
      setIntelligence(intelRes.snapshot)
    }

    // 3. Fetch active customer memories
    const memRes = await fetch(`/api/context/${contactId}/memories`)
      .then((r) => r.json())
      .catch(() => null)
    if (memRes?.memories) {
      setMemories(memRes.memories)
    }

    // 4. Fetch dynamic CRM records linked to this contact
    const crmRes = await fetch(`/api/crm/contacts/${contactId}/records`)
      .then((r) => r.json())
      .catch(() => null)
    if (crmRes?.records) {
      setCrmRecords(crmRes.records)
    }

    setLoading(false)
  }, [supabase, contactId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleRefreshIntelligence() {
    setRefreshingAi(true)
    try {
      const res = await fetch(`/api/context/${contactId}/intelligence`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.snapshot) {
        setIntelligence(data.snapshot)
        toast.success('Customer intelligence refreshed successfully')
        // Also reload memories and profile to capture newly extracted facts
        loadData()
      } else {
        toast.error(data.error || 'Failed to refresh intelligence')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error refreshing intelligence')
    } finally {
      setRefreshingAi(false)
    }
  }

  async function handleAddMemory() {
    if (!newMemKey.trim() || !newMemVal.trim()) {
      toast.error('Please provide both memory key and value')
      return
    }
    setAddingMemory(true)
    try {
      const res = await fetch(`/api/context/${contactId}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newMemKey, value: newMemVal }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Saved memory '${newMemKey}'`)
        setNewMemKey('')
        setNewMemVal('')
        loadData()
      } else {
        toast.error(data.skippedReason || 'Failed to save memory')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error adding memory')
    } finally {
      setAddingMemory(false)
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    try {
      const res = await fetch(`/api/context/${contactId}/memories?memoryId=${memoryId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Memory deleted')
        setMemories((prev) => prev.filter((m) => m.id !== memoryId))
      }
    } catch {
      toast.error('Failed to delete memory')
    }
  }

  async function saveContactDetails() {
    if (!profile) return
    setSavingDetails(true)
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        company: editCompany.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    setSavingDetails(false)
    if (error) {
      toast.error('Failed to update contact details')
    } else {
      toast.success('Contact profile updated')
      loadData()
    }
  }

  function getInitials(name?: string | null): string {
    if (!name) return '?'
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-7 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <h3 className="text-sm font-semibold text-foreground">Customer context not found</h3>
        <Button variant="outline" size="sm" onClick={() => router.push('/context')} className="mt-4">
          <ArrowLeft className="size-4 mr-2" />
          Back to Context Hub
        </Button>
      </div>
    )
  }

  const { contact, channels, socialHandles, activities, messages } = profile
  const intentCategory: IntentCategory = intelligence?.intent_category || contact.intent_category || 'information_seeking'
  const intentScore = intelligence?.intent_score ?? contact.intent_score ?? null
  const intentSummary = intelligence?.intent_summary || contact.intent_summary || 'Customer initiated inquiry across connected channels.'

  const filteredMessages = messages.filter((m) => {
    if (activeChatChannel === 'all') return true
    return m.channel === activeChatChannel
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 pb-12">
      {/* 1. Navigation Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/context')}
          className="text-xs text-muted-foreground hover:text-foreground -ml-2 rounded-md"
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Back to Context Hub
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshIntelligence}
            disabled={refreshingAi}
            className="h-8 gap-1.5 text-xs rounded-md"
          >
            <RefreshCw className={`size-3.5 ${refreshingAi ? 'animate-spin' : ''}`} />
            {refreshingAi ? 'Analyzing...' : 'Refresh Intelligence'}
          </Button>

          <Button
            size="sm"
            onClick={() => router.push(`/inbox?contactId=${contact.id}`)}
            className="h-8 gap-1.5 text-xs rounded-md"
          >
            <MessageSquare className="size-3.5" />
            Open in Inbox
          </Button>
        </div>
      </div>

      {/* 2. Executive Hero Card */}
      <div className="p-5 rounded-md border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <Avatar className="size-14 rounded-md border border-border">
            {contact.avatar_url && <AvatarImage src={contact.avatar_url} />}
            <AvatarFallback className="rounded-md bg-muted text-foreground font-semibold text-base">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground">{contact.name || 'Unnamed Customer'}</h1>
              {intentCategory === 'ready_to_convert' || (intentScore !== null && intentScore >= 75) ? (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 font-medium text-[11px] py-0.5 rounded">
                  <Flame className="size-3 text-emerald-500" />
                  {intentScore ? `${intentScore}/100 ` : ''}Hot Lead
                </Badge>
              ) : intentCategory === 'support_needed' ? (
                <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30 gap-1 font-medium text-[11px] py-0.5 rounded">
                  <AlertTriangle className="size-3 text-rose-500" />
                  Needs Attention
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 font-medium text-[11px] py-0.5 rounded">
                  <Zap className="size-3 text-amber-500" />
                  {intentScore ? `${intentScore}/100 ` : ''}Evaluating
                </Badge>
              )}
            </div>

            {/* Direct Contact Identifiers */}
            <div className="flex items-center gap-3.5 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {contact.phone && (
                <span className="flex items-center gap-1.5 font-mono">
                  <Phone className="size-3 text-muted-foreground" />
                  {contact.phone}
                </span>
              )}
              {contact.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3 text-muted-foreground" />
                  {contact.email}
                </span>
              )}
              {contact.company && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-muted-foreground" />
                  {contact.company}
                </span>
              )}
            </div>

            {/* Connected Channel Pills with proper brand icons */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {channels.whatsapp && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#25D366]/10 text-foreground border border-[#25D366]/25 text-[11px] font-medium font-mono">
                  <ChannelIcon channel="whatsapp" size="xs" className="text-[#25D366]" />
                  <span>{socialHandles.whatsapp}</span>
                </span>
              )}
              {channels.instagram && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#E4405F]/10 text-foreground border border-[#E4405F]/25 text-[11px] font-medium">
                  <ChannelIcon channel="instagram" size="xs" className="text-[#E4405F]" />
                  <span>{socialHandles.instagram}</span>
                </span>
              )}
              {channels.facebook && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0084FF]/10 text-foreground border border-[#0084FF]/25 text-[11px] font-medium">
                  <ChannelIcon channel="facebook" size="xs" className="text-[#0084FF]" />
                  <span>{socialHandles.facebook}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Milestone Box */}
        {contact.last_business_action && (
          <div className="p-3 rounded-md bg-muted/40 border border-border min-w-[200px] md:text-right">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Current Milestone
            </p>
            <p className="text-xs font-semibold text-foreground mt-1 flex items-center md:justify-end gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              {contact.last_business_action}
            </p>
            {contact.last_business_action_at && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(contact.last_business_action_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Dossier Navigation Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="bg-muted/60 p-1 rounded-md border border-border flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs rounded">
            <TrendingUp className="size-3.5" />
            Executive Dossier
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5 text-xs rounded">
            <FileText className="size-3.5" />
            Memory ({memories.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5 text-xs rounded">
            <History className="size-3.5" />
            Timeline ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="transcripts" className="gap-1.5 text-xs rounded">
            <MessageSquare className="size-3.5" />
            Conversations ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5 text-xs rounded">
            <Building2 className="size-3.5" />
            CRM Profile
          </TabsTrigger>
          <TabsTrigger value="crm_records" className="gap-1.5 text-xs rounded">
            <Database className="size-3.5" />
            CRM Records ({crmRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE DOSSIER */}
        <TabsContent value="overview" className="space-y-5">
          {/* Executive Summary Card */}
          <div className="p-5 rounded-md border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-1.5">Executive Intent Summary</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{intentSummary}</p>
            {intelligence?.next_best_action && (
              <div className="mt-3.5 pt-3 border-t border-border flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">Recommended Next Action:</span>
                <span className="text-muted-foreground">{intelligence.next_best_action}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Buying Signals */}
            <div className="p-5 rounded-md border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-foreground">Observed Buying Signals</h3>
                </div>
                <Badge variant="secondary" className="text-[10px] rounded">
                  {intelligence?.signals?.length || 0} Detected
                </Badge>
              </div>

              {!intelligence?.signals || intelligence.signals.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">
                  No explicit buying signals recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {intelligence.signals.map((sig, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md bg-muted/40 border border-border/70 text-xs flex items-center gap-2"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      <span className="text-foreground font-medium">{sig.signal}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Objections */}
            <div className="p-5 rounded-md border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Open Objections & Blockers</h3>
                </div>
                <Badge variant="secondary" className="text-[10px] rounded">
                  {intelligence?.objections?.length || 0} Tracked
                </Badge>
              </div>

              {!intelligence?.objections || intelligence.objections.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">
                  No active customer objections or blockers detected.
                </p>
              ) : (
                <div className="space-y-2">
                  {intelligence.objections.map((obj, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md bg-muted/40 border border-border/70 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{obj.description}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">Type: {obj.type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase rounded">
                        {obj.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Behavioral & Reply Analytics */}
          <div className="p-5 rounded-md border border-border bg-card space-y-3.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Behavioral & Communication Velocity
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="p-3 rounded-md bg-muted/40 border border-border/70">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Response Speed</p>
                <p className="text-sm font-semibold text-foreground mt-1 capitalize">
                  {intelligence?.response_behavior?.responsiveness || 'Moderate'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {intelligence?.response_behavior?.avg_response_minutes
                    ? `~${intelligence.response_behavior.avg_response_minutes} min avg reply gap`
                    : 'Typical reply rhythm'}
                </p>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border border-border/70">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Sentiment</p>
                <p className="text-sm font-semibold text-foreground mt-1 capitalize">
                  {intelligence?.sentiment || contact.sentiment || 'Neutral'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Conversation tone</p>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border border-border/70">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Preferred Channel</p>
                <p className="text-sm font-semibold text-foreground mt-1 uppercase flex items-center gap-1.5">
                  <ChannelIcon
                    channel={intelligence?.response_behavior?.preferred_channel || 'whatsapp'}
                    size="xs"
                  />
                  {intelligence?.response_behavior?.preferred_channel || 'WhatsApp'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Highest reply rate</p>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border border-border/70">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total Turns</p>
                <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
                  {(intelligence?.response_behavior?.inbound_count || 0) +
                    (intelligence?.response_behavior?.outbound_count || 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Across all channels</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: CUSTOMER MEMORY ENGINE */}
        <TabsContent value="memory" className="space-y-5">
          <div className="p-5 rounded-md border border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Structured Customer Memory
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Persistent facts, preferences, and requirements remembered across chats and flows.
                </p>
              </div>

              {/* Add Memory Form */}
              <div className="flex items-center gap-2">
                <Input
                  value={newMemKey}
                  onChange={(e) => setNewMemKey(e.target.value)}
                  placeholder="Key (e.g. budget)"
                  className="h-8 text-xs w-36 rounded-md"
                />
                <Input
                  value={newMemVal}
                  onChange={(e) => setNewMemVal(e.target.value)}
                  placeholder="Value"
                  className="h-8 text-xs w-44 rounded-md"
                />
                <Button
                  size="sm"
                  onClick={handleAddMemory}
                  disabled={addingMemory}
                  className="h-8 text-xs gap-1 rounded-md"
                >
                  <Plus className="size-3.5" />
                  Add Fact
                </Button>
              </div>
            </div>

            {memories.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-md">
                <p className="text-xs text-muted-foreground">
                  No structured memories recorded yet. Add facts above or let the AI extract them from chats.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3 rounded-md border border-border bg-muted/30 flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {mem.memory_key}
                        </span>
                        <Badge variant="secondary" className="text-[9px] py-0 rounded font-normal">
                          {mem.authority.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {mem.memory_value}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="size-7 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: TIMELINE & MILESTONES */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="p-5 rounded-md border border-border bg-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              Activity Timeline
            </h3>

            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No events logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
                {activities.map((act) => {
                  const isSocial =
                    act.channel === 'whatsapp' || act.channel === 'instagram' || act.channel === 'facebook'

                  return (
                    <div key={act.id} className="relative">
                      <div className="absolute -left-[19px] top-2 size-2.5 rounded-full bg-background border-2 border-muted-foreground" />
                      <div className="p-3 rounded-md border border-border/80 bg-muted/20">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {isSocial ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium capitalize">
                                <ChannelIcon channel={act.channel} size="xs" />
                                {act.channel}
                              </span>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] uppercase px-1.5 py-0 rounded">
                                {act.channel}
                              </Badge>
                            )}
                            <span className="text-xs font-medium text-foreground capitalize">
                              {act.event_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(act.created_at).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{act.summary}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 4: CONVERSATIONS TRANSCRIPT */}
        <TabsContent value="transcripts" className="space-y-4">
          <div className="p-5 rounded-md border border-border bg-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Cross-Platform Transcripts</h3>
              <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-card">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('all')}
                  className={`h-7 px-2.5 text-xs rounded ${activeChatChannel === 'all' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('whatsapp')}
                  className={`h-7 px-2.5 text-xs rounded gap-1.5 ${activeChatChannel === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-muted-foreground'}`}
                >
                  <ChannelIcon channel="whatsapp" size="xs" className="text-[#25D366]" />
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('instagram')}
                  className={`h-7 px-2.5 text-xs rounded gap-1.5 ${activeChatChannel === 'instagram' ? 'bg-pink-500/10 text-pink-500 font-medium' : 'text-muted-foreground'}`}
                >
                  <ChannelIcon channel="instagram" size="xs" className="text-[#E4405F]" />
                  Instagram
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('facebook')}
                  className={`h-7 px-2.5 text-xs rounded gap-1.5 ${activeChatChannel === 'facebook' ? 'bg-blue-500/10 text-blue-500 font-medium' : 'text-muted-foreground'}`}
                >
                  <ChannelIcon channel="facebook" size="xs" className="text-[#0084FF]" />
                  Facebook
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto p-2">
              {filteredMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No messages in this channel view.</p>
              ) : (
                filteredMessages.map((m) => {
                  const isUser = m.sender_type === 'customer'
                  return (
                    <div key={m.id} className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
                      <div
                        className={`max-w-[75%] p-3 rounded-lg text-xs leading-relaxed ${
                          isUser
                            ? 'bg-muted text-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        <p>{m.content_text}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1 px-1">
                        {m.channel && <ChannelIcon channel={m.channel} size="xs" />}
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: CRM PROFILE */}
        <TabsContent value="profile" className="space-y-4">
          <div className="p-5 rounded-md border border-border bg-card space-y-4 max-w-xl">
            <h3 className="text-sm font-semibold text-foreground">Core CRM Record</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="h-9 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email Address</Label>
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-9 text-xs rounded-md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Company</Label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="h-9 text-xs rounded-md"
                />
              </div>

              <Button
                size="sm"
                onClick={saveContactDetails}
                disabled={savingDetails}
                className="h-8 text-xs gap-1.5 mt-2 rounded-md"
              >
                <Save className="size-3.5" />
                {savingDetails ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* TAB 6: DYNAMIC CRM RECORDS */}
        <TabsContent value="crm_records" className="space-y-4">
          <div className="p-5 rounded-md border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Dynamic CRM Records</h3>
                <p className="text-xs text-muted-foreground">
                  Bookings, orders, tickets, and custom records linked to this customer (automatically used by AI).
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => router.push('/crm')}
              >
                Open Dynamic CRM
              </Button>
            </div>
            {crmRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                No dynamic CRM records linked to this customer yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {crmRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-md border border-border/70 bg-muted/30 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {rec.crm_collections?.name || rec.crm_collections?.slug || 'Collection'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          via {rec.created_by_type} · {new Date(rec.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {Object.entries(rec.data || {}).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-muted-foreground">{k}: </span>
                          <span className="font-medium text-foreground">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
