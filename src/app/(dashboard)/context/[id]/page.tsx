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
  Sparkles,
  Phone,
  Mail,
  Building2,
  Calendar,
  History,
  Send,
  Loader2,
  ExternalLink,
  Save,
  Trash2,
  Plus,
  Clock,
  Flame,
  Zap,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Target,
  TrendingUp,
  BrainCircuit,
  HelpCircle,
  FileText,
} from 'lucide-react'
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
        <Loader2 className="size-8 text-purple-400 animate-spin" />
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/context')}
          className="text-xs text-muted-foreground hover:text-foreground -ml-2"
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
            className="h-8 gap-1.5 text-xs text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
          >
            {refreshingAi ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Analyzing Intelligence...
              </>
            ) : (
              <>
                <BrainCircuit className="size-3.5" />
                Refresh Intelligence
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => router.push(`/inbox?contactId=${contact.id}`)}
            className="h-8 gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white"
          >
            <MessageSquare className="size-3.5" />
            Open in Inbox
          </Button>
        </div>
      </div>

      {/* 2. Executive Hero Banner */}
      <div className="p-6 rounded-3xl border border-border bg-card/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <Avatar className="size-16 border-2 border-purple-500/30 shadow-md">
            {contact.avatar_url && <AvatarImage src={contact.avatar_url} />}
            <AvatarFallback className="bg-purple-500/10 text-purple-400 font-bold text-lg">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{contact.name || 'Unnamed Customer'}</h1>
              {intentCategory === 'ready_to_convert' || (intentScore !== null && intentScore >= 75) ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 font-semibold text-xs py-0.5">
                  <Flame className="size-3 text-emerald-400 fill-emerald-400/20" />
                  {intentScore ? `${intentScore}/100 ` : ''}Hot Lead
                </Badge>
              ) : intentCategory === 'support_needed' ? (
                <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1 font-semibold text-xs py-0.5">
                  <AlertTriangle className="size-3 text-rose-400" />
                  Needs Attention
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 font-semibold text-xs py-0.5">
                  <Zap className="size-3 text-amber-400 fill-amber-400/20" />
                  {intentScore ? `${intentScore}/100 ` : ''}Evaluating
                </Badge>
              )}
            </div>

            {/* Direct Contact Identifiers */}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {contact.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="size-3 text-emerald-400" />
                  {contact.phone}
                </span>
              )}
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3 text-blue-400" />
                  {contact.email}
                </span>
              )}
              {contact.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3 text-purple-400" />
                  {contact.company}
                </span>
              )}
            </div>

            {/* Connected Channel Pills */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {channels.whatsapp && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                  WA: {socialHandles.whatsapp}
                </span>
              )}
              {channels.instagram && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[11px] font-medium">
                  IG: {socialHandles.instagram}
                </span>
              )}
              {channels.facebook && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-medium">
                  FB: {socialHandles.facebook}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Milestone Box */}
        {contact.last_business_action && (
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border min-w-[200px] text-right">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Current Milestone
            </p>
            <p className="text-sm font-bold text-foreground mt-0.5 flex items-center justify-end gap-1.5">
              <Calendar className="size-4 text-purple-400" />
              {contact.last_business_action}
            </p>
            {contact.last_business_action_at && (
              <p className="text-[10px] text-muted-foreground mt-1">
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
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border">
          <TabsTrigger value="overview" className="gap-1.5 text-xs rounded-lg">
            <Sparkles className="size-3.5 text-purple-400" />
            Executive Dossier
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5 text-xs rounded-lg">
            <BrainCircuit className="size-3.5 text-emerald-400" />
            Customer Memory ({memories.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5 text-xs rounded-lg">
            <History className="size-3.5 text-blue-400" />
            Milestones & Timeline ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="transcripts" className="gap-1.5 text-xs rounded-lg">
            <MessageSquare className="size-3.5 text-pink-400" />
            Conversations ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5 text-xs rounded-lg">
            <FileText className="size-3.5 text-muted-foreground" />
            CRM Profile
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE DOSSIER */}
        <TabsContent value="overview" className="space-y-6">
          {/* Executive Summary Card */}
          <div className="p-6 rounded-2xl border border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="size-4 text-purple-400" />
              <h3 className="text-sm font-bold text-foreground">Executive Intent Summary</h3>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{intentSummary}</p>
            {intelligence?.next_best_action && (
              <div className="mt-4 pt-3 border-t border-purple-500/20 flex items-center gap-2 text-xs">
                <span className="font-semibold text-purple-400">Recommended Next Best Action:</span>
                <span className="text-foreground font-medium">{intelligence.next_best_action}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buying Signals */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-foreground">Observed Buying Signals</h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                  {intelligence?.signals?.length || 0} Detected
                </Badge>
              </div>

              {!intelligence?.signals || intelligence.signals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">
                  No explicit buying signals recorded yet. They will appear here once detected in conversation.
                </p>
              ) : (
                <div className="space-y-2">
                  {intelligence.signals.map((sig, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-muted/30 border border-border text-xs flex items-center gap-2.5"
                    >
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      <span className="text-foreground font-medium">{sig.signal}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Objections */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-foreground">Open Objections & Blockers</h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                  {intelligence?.objections?.length || 0} Tracked
                </Badge>
              </div>

              {!intelligence?.objections || intelligence.objections.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">
                  No active customer objections or purchase blockers detected.
                </p>
              ) : (
                <div className="space-y-2">
                  {intelligence.objections.map((obj, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">{obj.description}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">Type: {obj.type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase border-amber-500/30 text-amber-400">
                        {obj.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Behavioral & Reply Analytics */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-purple-400" />
              Behavioral & Communication Velocity
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Response Speed</p>
                <p className="text-base font-bold text-foreground mt-0.5 capitalize">
                  {intelligence?.response_behavior?.responsiveness || 'Moderate'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {intelligence?.response_behavior?.avg_response_minutes
                    ? `~${intelligence.response_behavior.avg_response_minutes} min avg reply gap`
                    : 'Typical reply rhythm'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Customer Sentiment</p>
                <p className="text-base font-bold text-foreground mt-0.5 capitalize">
                  {intelligence?.sentiment || contact.sentiment || 'Neutral'}
                </p>
                <p className="text-[10px] text-muted-foreground">Conversation tone</p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Preferred Channel</p>
                <p className="text-base font-bold text-foreground mt-0.5 uppercase">
                  {intelligence?.response_behavior?.preferred_channel || 'WhatsApp'}
                </p>
                <p className="text-[10px] text-muted-foreground">Highest reply rate</p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total Turns</p>
                <p className="text-base font-bold text-foreground mt-0.5">
                  {(intelligence?.response_behavior?.inbound_count || 0) +
                    (intelligence?.response_behavior?.outbound_count || 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Across all channels</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: CUSTOMER MEMORY ENGINE */}
        <TabsContent value="memory" className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BrainCircuit className="size-4 text-emerald-400" />
                  Structured Customer Memory
                </h3>
                <p className="text-xs text-muted-foreground">
                  Persistent facts, preferences, and requirements. The AI will never ask for these again.
                </p>
              </div>

              {/* Add Memory Form */}
              <div className="flex items-center gap-2">
                <Input
                  value={newMemKey}
                  onChange={(e) => setNewMemKey(e.target.value)}
                  placeholder="Key (e.g. budget, address)"
                  className="h-8 text-xs w-36 bg-muted/40"
                />
                <Input
                  value={newMemVal}
                  onChange={(e) => setNewMemVal(e.target.value)}
                  placeholder="Value"
                  className="h-8 text-xs w-48 bg-muted/40"
                />
                <Button
                  size="sm"
                  onClick={handleAddMemory}
                  disabled={addingMemory}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                >
                  <Plus className="size-3.5" />
                  Add Fact
                </Button>
              </div>
            </div>

            {memories.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl">
                <BrainCircuit className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No structured memories recorded yet. Add facts above or let the AI extract them naturally from customer chats.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {memories.map((mem) => {
                  const authBadge =
                    mem.authority === 'human_business_edit'
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : mem.authority === 'verified_system'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'

                  return (
                    <div
                      key={mem.id}
                      className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground uppercase">
                            {mem.memory_key}
                          </span>
                          <Badge variant="outline" className={`text-[9px] py-0 border ${authBadge}`}>
                            {mem.authority.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground/90 font-medium mt-1 truncate">
                          "{mem.memory_value}"
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="size-7 text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: TIMELINE & MILESTONES */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="size-4 text-blue-400" />
              Event-Sourced Activity Stream
            </h3>

            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">No events logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {activities.map((act) => {
                  const channelColor =
                    act.channel === 'whatsapp'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : act.channel === 'instagram'
                      ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                      : act.channel === 'facebook'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/30'

                  return (
                    <div key={act.id} className="relative group">
                      <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-background border-2 border-purple-500" />
                      <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold px-1.5 py-0 border ${channelColor}`}>
                              {act.channel}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground capitalize">
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
                        <p className="text-xs text-foreground/90 mt-1">{act.summary}</p>
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
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Cross-Platform Transcripts</h3>
              <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('all')}
                  className={`h-7 px-2.5 text-xs rounded-md ${activeChatChannel === 'all' ? 'bg-background shadow-xs font-medium' : 'text-muted-foreground'}`}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('whatsapp')}
                  className={`h-7 px-2.5 text-xs rounded-md ${activeChatChannel === 'whatsapp' ? 'bg-background shadow-xs text-emerald-400 font-medium' : 'text-muted-foreground'}`}
                >
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('instagram')}
                  className={`h-7 px-2.5 text-xs rounded-md ${activeChatChannel === 'instagram' ? 'bg-background shadow-xs text-pink-400 font-medium' : 'text-muted-foreground'}`}
                >
                  Instagram
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveChatChannel('facebook')}
                  className={`h-7 px-2.5 text-xs rounded-md ${activeChatChannel === 'facebook' ? 'bg-background shadow-xs text-blue-400 font-medium' : 'text-muted-foreground'}`}
                >
                  Facebook
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto p-2">
              {filteredMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-6 text-center">No messages in this channel view.</p>
              ) : (
                filteredMessages.map((m) => {
                  const isUser = m.sender_type === 'customer'
                  return (
                    <div key={m.id} className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
                      <div
                        className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-muted/70 text-foreground rounded-bl-xs'
                            : 'bg-purple-600 text-white rounded-br-xs'
                        }`}
                      >
                        <p>{m.content_text}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {m.channel?.toUpperCase()} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4 max-w-xl">
            <h3 className="text-sm font-semibold text-foreground">Core CRM Record</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-muted border-border text-foreground h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-muted border-border text-foreground h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email Address</Label>
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-muted border-border text-foreground h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Company</Label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="bg-muted border-border text-foreground h-9 text-xs"
                />
              </div>

              <Button
                size="sm"
                onClick={saveContactDetails}
                disabled={savingDetails}
                className="h-8 text-xs bg-purple-600 hover:bg-purple-500 text-white gap-1 mt-2"
              >
                <Save className="size-3.5" />
                {savingDetails ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
