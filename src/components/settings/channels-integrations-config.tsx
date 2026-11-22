'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Share2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  ShieldCheck,
  KeyRound,
  Zap,
  Phone,
  HelpCircle,
  Check,
  ArrowRight,
  Sparkles,
  Link2,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { SettingsPanelHead } from './settings-panel-head';
import { WhatsAppConfig } from './whatsapp-config';
import { ChannelIcon, ChannelPillBadge } from '@/components/channels/channel-badge';
import type { MetaChannelConnection } from '@/types';

interface WhatsAppStatusData {
  configured: boolean;
  connected: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  registered?: boolean;
}

export function ChannelsIntegrationsConfig() {
  const { accountId, canEditSettings } = useAuth();
  const supabase = createClient();

  // WhatsApp states
  const [waLoading, setWaLoading] = useState(true);
  const [waStatus, setWaStatus] = useState<WhatsAppStatusData | null>(null);

  // Meta states
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaChannels, setMetaChannels] = useState<MetaChannelConnection[]>([]);

  // Drawers
  const [waDrawerOpen, setWaDrawerOpen] = useState(false);
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);
  const [metaDrawerInitialFocus, setMetaDrawerInitialFocus] = useState<'facebook' | 'instagram'>('facebook');

  // Meta Manual Entry State
  const [showManualMeta, setShowManualMeta] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualPageId, setManualPageId] = useState('');
  const [manualPageName, setManualPageName] = useState('');
  const [manualAccessToken, setManualAccessToken] = useState('');
  const [manualConnectInstagram, setManualConnectInstagram] = useState(true);

  // Channel deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch WhatsApp status
  const fetchWhatsAppStatus = useCallback(async () => {
    if (!accountId) return;
    try {
      setWaLoading(true);
      const [rowRes, healthRes] = await Promise.allSettled([
        supabase
          .from('whatsapp_config')
          .select('phone_number_id, waba_id, registered_at')
          .eq('account_id', accountId)
          .maybeSingle(),
        fetch('/api/whatsapp/config', { cache: 'no-store' }).then((r) => r.json()),
      ]);

      const row = rowRes.status === 'fulfilled' ? rowRes.value.data : null;
      const health = healthRes.status === 'fulfilled' ? healthRes.value : null;

      const isConfigured = !!row?.phone_number_id;
      const isConnected = !!health?.connected;

      setWaStatus({
        configured: isConfigured,
        connected: isConnected,
        phoneNumberId: row?.phone_number_id || undefined,
        wabaId: row?.waba_id || undefined,
        displayPhoneNumber: health?.phone_info?.display_phone_number,
        verifiedName: health?.phone_info?.verified_name,
        registered: !!row?.registered_at,
      });
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    } finally {
      setWaLoading(false);
    }
  }, [accountId, supabase]);

  // Fetch Meta channels
  const fetchMetaChannels = useCallback(async () => {
    try {
      setMetaLoading(true);
      const res = await fetch('/api/channels/meta');
      if (!res.ok) throw new Error('Failed to load channels');
      const data = await res.json();
      setMetaChannels(data.channels || []);
    } catch {
      toast.error('Failed to load connected Meta channels');
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchWhatsAppStatus();
    fetchMetaChannels();
  }, [fetchWhatsAppStatus, fetchMetaChannels]);

  useEffect(() => {
    refreshAll();

    // Check if redirected from OAuth with status
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'connected') {
        const count = params.get('count') || '1';
        toast.success(`Successfully connected ${count} Meta channel(s)!`);
        window.history.replaceState(null, '', '/settings?tab=channels');
      } else if (params.get('error')) {
        toast.error(`Meta connection failed: ${params.get('error')}`);
        window.history.replaceState(null, '', '/settings?tab=channels');
      }
    }
  }, [refreshAll]);

  // Handle Meta OAuth Connect
  const handleOAuthConnect = () => {
    window.location.href = '/api/channels/meta/oauth/connect';
  };

  // Handle Manual Meta Channel submit
  const handleManualMetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPageId.trim() || !manualAccessToken.trim()) {
      toast.error('Facebook Page ID and Page Access Token are required');
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await fetch('/api/channels/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: manualPageId.trim(),
          pageName: manualPageName.trim() || `Page ${manualPageId.trim()}`,
          accessToken: manualAccessToken.trim(),
          connectInstagram: manualConnectInstagram,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect Meta channel');
      }

      toast.success('Successfully connected Meta channel!');
      setManualPageId('');
      setManualPageName('');
      setManualAccessToken('');
      setShowManualMeta(false);
      setMetaDrawerOpen(false);
      fetchMetaChannels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSubmittingManual(false);
    }
  };

  // Disconnect Meta Channel
  const handleDeleteChannel = async (connectionId: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}? Incoming messages will no longer sync.`)) {
      return;
    }

    setDeletingId(connectionId);
    try {
      const res = await fetch(`/api/channels/meta/${connectionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      toast.success(`Disconnected ${name}`);
      fetchMetaChannels();
    } catch {
      toast.error('Failed to disconnect channel');
    } finally {
      setDeletingId(null);
    }
  };

  // Group Meta channels
  const facebookChannels = metaChannels.filter((c) => c.channel === 'facebook');
  const instagramChannels = metaChannels.filter((c) => c.channel === 'instagram');

  const totalConnected =
    (waStatus?.connected ? 1 : 0) +
    facebookChannels.length +
    instagramChannels.length;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Channels & Integrations"
        description="Connect your messaging channels. Customer inquiries from WhatsApp, Facebook, and Instagram flow straight into your unified CRM Inbox."
      />

      {/* TOP STATUS BAR */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-xs">
        <CardContent className="py-4 px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5 items-center">
              <div className="flex items-center justify-center size-7 rounded-full bg-[#25D366] text-white ring-2 ring-background shrink-0 shadow-2xs">
                <ChannelIcon channel="whatsapp" size="xs" className="size-3.5 text-white" />
              </div>
              <div className="flex items-center justify-center size-7 rounded-full bg-[#0084FF] text-white ring-2 ring-background shrink-0 shadow-2xs">
                <ChannelIcon channel="facebook" size="xs" className="size-3.5 text-white" />
              </div>
              <div className="flex items-center justify-center size-7 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white ring-2 ring-background shrink-0 shadow-2xs">
                <ChannelIcon channel="instagram" size="xs" className="size-3.5 text-white stroke-[2.25]" />
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                Unified Channel Hub
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {totalConnected} {totalConnected === 1 ? 'channel' : 'channels'} active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                All connected numbers and pages sync live chats into your Inbox.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={waLoading || metaLoading}
            className="gap-1.5 text-xs shrink-0 h-8"
          >
            <RefreshCw className={`size-3.5 ${waLoading || metaLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* 3 CHANNEL CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: WHATSAPP */}
        <Card className="flex flex-col justify-between border-border transition-all duration-200 hover:border-emerald-500/40 hover:shadow-md bg-card/75">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* Channel Icon Badge */}
              <div className="flex items-center justify-center size-12 rounded-xl bg-[#25D366] text-white shadow-xs shrink-0 ring-1 ring-black/5 dark:ring-white/10">
                <ChannelIcon channel="whatsapp" size="md" className="size-6 text-white" />
              </div>

              {/* Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  waLoading
                    ? 'bg-muted text-muted-foreground border-border'
                    : waStatus?.connected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                    : waStatus?.configured
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    waStatus?.connected
                      ? 'bg-emerald-500 animate-pulse'
                      : waStatus?.configured
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground/60'
                  }`}
                />
                {waLoading
                  ? 'Checking...'
                  : waStatus?.connected
                  ? 'Connected'
                  : waStatus?.configured
                  ? 'Action Required'
                  : 'Not Setup'}
              </span>
            </div>

            <div className="mt-3.5 space-y-0.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">WhatsApp Business</CardTitle>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                  WABA API
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                Official Meta Cloud API for broadcasts and conversations.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-3.5">
            <div className="rounded-lg bg-muted/30 border border-border/60 p-3 text-xs min-h-[64px] flex flex-col justify-center">
              {waLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Checking connection...
                </div>
              ) : waStatus?.connected ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span className="truncate">{waStatus.verifiedName || 'Business Account'}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">LIVE</span>
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px] truncate">
                    {waStatus.displayPhoneNumber || `ID: ${waStatus.phoneNumberId}`}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {waStatus?.configured
                    ? 'Saved credentials need re-validation with Meta.'
                    : 'Connect your Phone Number ID and token to begin messaging.'}
                </p>
              )}
            </div>

            {canEditSettings && (
              <Button
                variant={waStatus?.connected ? 'outline' : 'default'}
                size="sm"
                className={`w-full gap-2 text-xs font-medium h-9 ${
                  !waStatus?.connected ? 'bg-[#25D366] hover:bg-[#20ba5a] text-white' : ''
                }`}
                onClick={() => setWaDrawerOpen(true)}
              >
                <ChannelIcon channel="whatsapp" size="xs" className="size-4" />
                {waStatus?.connected ? 'Configure WhatsApp' : 'Connect WhatsApp'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* CARD 2: FACEBOOK PAGE */}
        <Card className="flex flex-col justify-between border-border transition-all duration-200 hover:border-[#0084FF]/40 hover:shadow-md bg-card/75">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* Channel Icon Badge */}
              <div className="flex items-center justify-center size-12 rounded-xl bg-[#0084FF] text-white shadow-xs shrink-0 ring-1 ring-black/5 dark:ring-white/10">
                <ChannelIcon channel="facebook" size="md" className="size-6 text-white" />
              </div>

              {/* Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  metaLoading
                    ? 'bg-muted text-muted-foreground border-border'
                    : facebookChannels.length > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    facebookChannels.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'
                  }`}
                />
                {metaLoading
                  ? 'Checking...'
                  : facebookChannels.length > 0
                  ? `${facebookChannels.length} Connected`
                  : 'Not Connected'}
              </span>
            </div>

            <div className="mt-3.5 space-y-0.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">Facebook Messenger</CardTitle>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                  Page Inbox
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                Receive Facebook Page inquiries directly in CRM Inbox.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-3.5">
            <div className="rounded-lg bg-muted/30 border border-border/60 p-3 text-xs min-h-[64px] flex flex-col justify-center">
              {metaLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading channels...
                </div>
              ) : facebookChannels.length > 0 ? (
                <div className="space-y-1">
                  <div className="font-semibold text-foreground truncate">
                    {facebookChannels[0].page_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    Page ID: {facebookChannels[0].page_id}
                    {facebookChannels.length > 1 && ` · +${facebookChannels.length - 1} more`}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Connect via 1-click Meta OAuth or a Page Access Token.
                </p>
              )}
            </div>

            {canEditSettings && (
              <Button
                variant={facebookChannels.length > 0 ? 'outline' : 'default'}
                size="sm"
                className={`w-full gap-2 text-xs font-medium h-9 ${
                  facebookChannels.length === 0 ? 'bg-[#0084FF] hover:bg-[#0073e6] text-white' : ''
                }`}
                onClick={() => {
                  setMetaDrawerInitialFocus('facebook');
                  setMetaDrawerOpen(true);
                }}
              >
                <ChannelIcon channel="facebook" size="xs" className="size-4" />
                {facebookChannels.length > 0 ? 'Manage Facebook' : 'Connect Facebook'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* CARD 3: INSTAGRAM DIRECT */}
        <Card className="flex flex-col justify-between border-border transition-all duration-200 hover:border-pink-500/40 hover:shadow-md bg-card/75">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* Channel Icon Badge */}
              <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-xs shrink-0 ring-1 ring-black/5 dark:ring-white/10">
                <ChannelIcon channel="instagram" size="md" className="size-6 text-white stroke-[2.25]" />
              </div>

              {/* Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  metaLoading
                    ? 'bg-muted text-muted-foreground border-border'
                    : instagramChannels.length > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    instagramChannels.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'
                  }`}
                />
                {metaLoading
                  ? 'Checking...'
                  : instagramChannels.length > 0
                  ? `${instagramChannels.length} Connected`
                  : 'Not Connected'}
              </span>
            </div>

            <div className="mt-3.5 space-y-0.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">Instagram Direct</CardTitle>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                  Direct DM
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                Instagram Direct messages, comments, and story replies.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-3.5">
            <div className="rounded-lg bg-muted/30 border border-border/60 p-3 text-xs min-h-[64px] flex flex-col justify-center">
              {metaLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading channels...
                </div>
              ) : instagramChannels.length > 0 ? (
                <div className="space-y-1">
                  <div className="font-semibold text-foreground truncate">
                    {instagramChannels[0].instagram_username
                      ? `@${instagramChannels[0].instagram_username}`
                      : 'Instagram Account'}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Linked to Page: <span className="font-mono">{instagramChannels[0].page_name}</span>
                    {instagramChannels.length > 1 && ` · +${instagramChannels.length - 1} more`}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    Linked via your Facebook Page
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium shrink-0">
                    <Link2 className="size-2.5" />
                    Auto-links
                  </span>
                </div>
              )}
            </div>

            {canEditSettings && (
              <Button
                variant={instagramChannels.length > 0 ? 'outline' : 'default'}
                size="sm"
                className={`w-full gap-2 text-xs font-medium h-9 ${
                  instagramChannels.length === 0
                    ? 'bg-gradient-to-r from-[#ee2a7b] to-[#6228d7] hover:opacity-95 text-white'
                    : ''
                }`}
                onClick={() => {
                  setMetaDrawerInitialFocus('instagram');
                  setMetaDrawerOpen(true);
                }}
              >
                <ChannelIcon channel="instagram" size="xs" className="size-4" />
                {instagramChannels.length > 0 ? 'Manage Instagram' : 'Connect via Facebook'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ACTIVE CONNECTED CHANNELS TABLE */}
      <Card className="border-border">
        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between border-b border-border/60">
          <div>
            <CardTitle className="text-sm font-semibold">Active Channels</CardTitle>
            <CardDescription className="text-xs">
              All active platform inboxes delivering messages into your CRM.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchMetaChannels}
            disabled={metaLoading}
            className="size-8"
            title="Refresh channels"
          >
            <RefreshCw className={`size-3.5 ${metaLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {metaLoading && waLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading connected channels...
            </div>
          ) : totalConnected === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-xs font-medium text-foreground">No channels connected yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use the cards above to connect WhatsApp, Facebook, or Instagram.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {/* WhatsApp Active Row */}
              {waStatus?.configured && (
                <div className="py-3 px-5 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-[#25D366] text-white shrink-0 shadow-2xs">
                      <ChannelIcon channel="whatsapp" size="xs" className="size-4 text-white" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {waStatus.verifiedName || 'WhatsApp Cloud API'}
                        </span>
                        <ChannelPillBadge channel="whatsapp" showLabel={false} />
                        <span
                          className={`text-[10px] font-medium px-2 py-0.2 rounded-full ${
                            waStatus.connected
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {waStatus.connected ? 'connected' : 'reconnection needed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {waStatus.displayPhoneNumber || `Phone ID: ${waStatus.phoneNumberId}`}
                      </p>
                    </div>
                  </div>

                  {canEditSettings && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWaDrawerOpen(true)}
                      className="text-xs h-7 px-2.5"
                    >
                      Configure
                    </Button>
                  )}
                </div>
              )}

              {/* Meta Active Rows (Facebook and Instagram) */}
              {metaChannels.map((c) => {
                const isIG = c.channel === 'instagram';
                const isDeleting = deletingId === c.id;
                return (
                  <div
                    key={c.id}
                    className="py-3 px-5 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center size-8 rounded-lg text-white shrink-0 shadow-2xs ${
                          isIG
                            ? 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]'
                            : 'bg-[#0084FF]'
                        }`}
                      >
                        {isIG ? (
                          <ChannelIcon channel="instagram" size="xs" className="size-4 text-white stroke-[2.25]" />
                        ) : (
                          <ChannelIcon channel="facebook" size="xs" className="size-4 text-white" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {isIG
                              ? c.instagram_username
                                ? `@${c.instagram_username}`
                                : 'Instagram Account'
                              : c.page_name}
                          </span>
                          <ChannelPillBadge channel={c.channel} showLabel={false} />
                          <span
                            className={`text-[10px] font-medium px-2 py-0.2 rounded-full ${
                              c.status === 'connected'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {isIG ? (
                            <>
                              Linked to Page: <span className="font-mono">{c.page_name}</span> (ID: {c.instagram_business_id})
                            </>
                          ) : (
                            <>
                              Page ID: <span className="font-mono">{c.page_id}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {canEditSettings && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() =>
                          handleDeleteChannel(
                            c.id,
                            isIG
                              ? `@${c.instagram_username || 'Instagram'}`
                              : c.page_name
                          )
                        }
                        disabled={isDeleting}
                        title="Disconnect channel"
                      >
                        {isDeleting ? (
                          <Loader2 className="size-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DRAWER 1: WHATSAPP CONFIGURATION (SPACIOUS & COMPACT) */}
      <Sheet open={waDrawerOpen} onOpenChange={setWaDrawerOpen}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-[700px] data-[side=right]:md:max-w-[800px] overflow-y-auto p-6 sm:p-8">
          <SheetHeader className="mb-6 pb-4 border-b border-border/60 pr-10">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-9 rounded-xl bg-[#25D366] text-white shadow-xs shrink-0 mt-0.5">
                <ChannelIcon channel="whatsapp" size="xs" className="size-5 text-white" />
              </div>
              <div className="space-y-1">
                <SheetTitle className="text-lg font-semibold text-foreground">
                  WhatsApp Cloud API Configuration
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Credentials, webhook verification, and connection diagnostics.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <WhatsAppConfig
            showHeader={false}
            onSaved={() => {
              fetchWhatsAppStatus();
            }}
          />
        </SheetContent>
      </Sheet>

      {/* DRAWER 2: META CHANNELS (COMPACT & PROPORTIONAL) */}
      <Sheet open={metaDrawerOpen} onOpenChange={setMetaDrawerOpen}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-[620px] data-[side=right]:md:max-w-[700px] overflow-y-auto p-6 sm:p-8">
          <SheetHeader className="mb-6 pb-4 border-b border-border/60 pr-10">
            <div className="flex items-start gap-3.5">
              <div className="flex items-center -space-x-1.5 shrink-0 mt-0.5">
                <div className="flex items-center justify-center size-9 rounded-xl bg-[#0084FF] text-white shadow-xs ring-2 ring-background">
                  <ChannelIcon channel="facebook" size="xs" className="size-4.5 text-white" />
                </div>
                <div className="flex items-center justify-center size-9 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-xs ring-2 ring-background">
                  <ChannelIcon channel="instagram" size="xs" className="size-4.5 text-white stroke-[2.25]" />
                </div>
              </div>
              <div className="space-y-1">
                <SheetTitle className="text-lg font-semibold text-foreground">
                  {metaDrawerInitialFocus === 'instagram'
                    ? 'Connect Instagram via Facebook'
                    : 'Connect Facebook & Instagram'}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Connecting a Facebook Page automatically links any attached Instagram Business account.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5">
            {/* 1-Click Meta OAuth Card */}
            <Card className="border-border bg-gradient-to-b from-primary/5 to-transparent">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Meta 1-Click Sign In</span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Authorizes your Facebook Pages and automatically imports any linked Instagram Business inboxes.
                  </p>
                </div>

                <Button
                  onClick={handleOAuthConnect}
                  size="default"
                  className="w-full gap-2.5 bg-[#0084FF] hover:bg-[#0073e6] text-white font-medium text-sm h-11 shadow-sm"
                >
                  <ChannelIcon channel="facebook" size="sm" className="size-4.5 text-white" />
                  Connect with Facebook
                </Button>
              </CardContent>
            </Card>

            {/* Manual Token Collapsible Toggle */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualMeta((prev) => !prev)}
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-9 px-3 border-border"
              >
                <span className="flex items-center gap-2 truncate">
                  <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>Advanced: Facebook Page Token Entry</span>
                </span>
                <span className="text-[11px] font-medium text-primary shrink-0 ml-2">
                  {showManualMeta ? 'Hide Form' : 'Configure manually'}
                </span>
              </Button>
            </div>

            {showManualMeta && (
              <Card className="border-primary/20 bg-primary/5 animate-in fade-in-50 duration-150">
                <CardContent className="p-4">
                  <form onSubmit={handleManualMetaSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="manualPageId" className="text-xs">Facebook Page ID *</Label>
                        <Input
                          id="manualPageId"
                          placeholder="e.g. 104829104829104"
                          value={manualPageId}
                          onChange={(e) => setManualPageId(e.target.value)}
                          required
                          className="text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="manualPageName" className="text-xs">Page Name (Optional)</Label>
                        <Input
                          id="manualPageName"
                          placeholder="e.g. Acme Support"
                          value={manualPageName}
                          onChange={(e) => setManualPageName(e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="manualAccessToken" className="text-xs">Page Access Token *</Label>
                      <Input
                        id="manualAccessToken"
                        type="password"
                        placeholder="EAAB..."
                        value={manualAccessToken}
                        onChange={(e) => setManualAccessToken(e.target.value)}
                        required
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="checkbox"
                        id="manualConnectInstagram"
                        checked={manualConnectInstagram}
                        onChange={(e) => setManualConnectInstagram(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary size-3.5"
                      />
                      <Label htmlFor="manualConnectInstagram" className="text-xs font-normal cursor-pointer text-muted-foreground">
                        Automatically link connected Instagram Business Account on this Page
                      </Label>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowManualMeta(false)}
                        className="text-xs h-8"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={submittingManual} className="text-xs h-8">
                        {submittingManual ? (
                          <>
                            <Loader2 className="size-3 animate-spin mr-1.5" />
                            Connecting...
                          </>
                        ) : (
                          'Save Channel'
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Quick Instagram Hint */}
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3.5 flex items-start gap-2.5 border border-border/50">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-medium text-foreground">Instagram requirement: </span>
                Must be an <strong>Instagram Professional</strong> account linked to your Facebook Page in Instagram Settings.
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
