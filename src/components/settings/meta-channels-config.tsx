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
} from 'lucide-react';

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

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
import { SettingsPanelHead } from './settings-panel-head';
import type { MetaChannelConnection } from '@/types';

export function MetaChannelsConfig() {
  const { canEditSettings } = useAuth();

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<MetaChannelConnection[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);

  // Manual form state
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [connectInstagram, setConnectInstagram] = useState(true);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/channels/meta');
      if (!res.ok) throw new Error('Failed to load channels');
      const data = await res.json();
      setChannels(data.channels || []);
    } catch {
      toast.error('Failed to load connected Meta channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();

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
  }, [fetchChannels]);

  const handleOAuthConnect = () => {
    window.location.href = '/api/channels/meta/oauth/connect';
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageId || !accessToken) {
      toast.error('Page ID and Page Access Token are required');
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await fetch('/api/channels/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          pageName: pageName.trim() || `Page ${pageId}`,
          accessToken,
          connectInstagram,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect channel');
      }

      toast.success('Successfully connected Meta channel!');
      setPageId('');
      setPageName('');
      setAccessToken('');
      setShowManual(false);
      fetchChannels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleDelete = async (connectionId: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}?`)) return;

    try {
      const res = await fetch(`/api/channels/meta/${connectionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      toast.success(`Disconnected ${name}`);
      fetchChannels();
    } catch {
      toast.error('Failed to disconnect channel');
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Meta Channels (Instagram & Facebook)"
        description="Connect Facebook Pages and Instagram Professional accounts to receive messages, trigger automated flows, and reply directly from the unified CRM inbox."
      />

      {/* Connection Header & Action */}
      <Card className="border-border">
        <CardContent className="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Connected Accounts & Pages
            </h3>
            <p className="text-sm text-muted-foreground">
              You can connect multiple Facebook Pages and their linked Instagram business inboxes.
            </p>
          </div>
          {canEditSettings && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManual((prev) => !prev)}
                className="gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                {showManual ? 'Hide Manual Entry' : 'Manual Token'}
              </Button>
              <Button
                size="sm"
                onClick={handleOAuthConnect}
                className="gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white"
              >
                <FacebookIcon className="w-4 h-4" />
                Connect with Facebook
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Connection Form */}
      {showManual && canEditSettings && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Manual Channel Connection
            </CardTitle>
            <CardDescription>
              Connect a Facebook Page and its linked Instagram account using a Page ID and Page Access Token from the Meta Developer Graph API Explorer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pageId">Facebook Page ID *</Label>
                  <Input
                    id="pageId"
                    placeholder="e.g. 104829104829104"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pageName">Page / Brand Name (Optional)</Label>
                  <Input
                    id="pageName"
                    placeholder="e.g. Acme Support"
                    value={pageName}
                    onChange={(e) => setPageName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">Page Access Token *</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="EAAB..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The token will be encrypted using AES-256-GCM before storage.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="connectInstagram"
                  checked={connectInstagram}
                  onChange={(e) => setConnectInstagram(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="connectInstagram" className="text-sm font-normal cursor-pointer">
                  Automatically link connected Instagram Business Account if present on this Page
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManual(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submittingManual}>
                  {submittingManual ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

      {/* Connected Channels List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Active Channels</CardTitle>
            <CardDescription>
              Messages received on these channels appear in real time in your CRM Inbox.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchChannels}
            disabled={loading}
            title="Refresh channels"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Share2 className="w-10 h-10 text-muted-foreground mx-auto stroke-[1.5]" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No Meta channels connected yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click &ldquo;Connect with Facebook&rdquo; or enter a Page Access Token above to link your Instagram and Facebook inboxes.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {channels.map((c) => {
                const isIG = c.channel === 'instagram';
                return (
                  <div
                    key={c.id}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isIG
                            ? 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white'
                            : 'bg-[#1877F2] text-white'
                        }`}
                      >
                        {isIG ? (
                          <InstagramIcon className="w-5 h-5" />
                        ) : (
                          <FacebookIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {isIG
                              ? c.instagram_username
                                ? `@${c.instagram_username}`
                                : 'Instagram Account'
                              : c.page_name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              c.status === 'connected'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
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
                        onClick={() =>
                          handleDelete(
                            c.id,
                            isIG ? `@${c.instagram_username || 'Instagram'}` : c.page_name,
                          )
                        }
                        className="text-muted-foreground hover:text-destructive"
                        title="Disconnect channel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meta Requirements & Info Banner */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground">Meta Setup & Zero-Cost Notes:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>100% Free Messaging:</strong> Meta charges <strong>$0</strong> for receiving and sending direct messages on Instagram and Facebook Messenger within the standard 24-hour service window.
                </li>
                <li>
                  <strong>Instagram Business Account:</strong> To connect Instagram, your account must be an <strong>Instagram Professional/Business account</strong> linked to a Facebook Page in Meta Business Suite.
                </li>
                <li>
                  <strong>App Permissions:</strong> For production public access, ensure your Meta App has approved review for <code className="bg-muted px-1 py-0.5 rounded">pages_messaging</code>, <code className="bg-muted px-1 py-0.5 rounded">instagram_manage_messages</code>, and <code className="bg-muted px-1 py-0.5 rounded">instagram_manage_comments</code>.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
