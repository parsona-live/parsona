'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Save,
  Server,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';

export function EmailSettings() {
  const { accountId, canEditSettings } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [provider, setProvider] = useState<'brevo' | 'smtp'>('brevo');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');

  // SMTP specific
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState<'tls' | 'ssl' | 'none'>('tls');

  // Status
  const [isVerified, setIsVerified] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  // Test send input
  const [testToEmail, setTestToEmail] = useState('');

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const res = await fetch('/api/email/config');
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            const cfg = data.config;
            setProvider(cfg.provider || 'brevo');
            setBrevoApiKey(cfg.brevo_api_key ? '••••••••' : '');
            setFromName(cfg.from_name || '');
            setFromEmail(cfg.from_email || '');
            setSmtpHost(cfg.smtp_host || '');
            setSmtpPort(String(cfg.smtp_port || 587));
            setSmtpUsername(cfg.smtp_username || '');
            setSmtpPassword(cfg.smtp_password ? '••••••••' : '');
            setSmtpEncryption(cfg.smtp_encryption || 'tls');
            setIsVerified(!!cfg.is_verified);
            setLastTestedAt(cfg.last_tested_at || null);
          }
        }
      } catch (err) {
        console.error('Failed to load email config:', err);
      } finally {
        setLoading(false);
      }
    }

    if (accountId) {
      loadConfig();
    }
  }, [accountId]);

  async function handleSave() {
    if (!canEditSettings) {
      toast.error('Only administrators can update email configuration');
      return;
    }
    if (!fromEmail.trim()) {
      toast.error('From Email is required');
      return;
    }
    if (provider === 'brevo' && !brevoApiKey.trim()) {
      toast.error('Brevo API key is required');
      return;
    }
    if (provider === 'smtp' && !smtpHost.trim()) {
      toast.error('SMTP Host is required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          brevo_api_key: brevoApiKey,
          from_name: fromName,
          from_email: fromEmail,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_username: smtpUsername,
          smtp_password: smtpPassword,
          smtp_encryption: smtpEncryption,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      toast.success('Email settings saved successfully');
      if (data.config) {
        setIsVerified(!!data.config.is_verified);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!testToEmail.trim()) {
      toast.error('Please enter a destination email address for the test');
      return;
    }
    if (!fromEmail.trim()) {
      toast.error('Please specify a valid From Email first');
      return;
    }

    try {
      setTesting(true);
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testToEmail.trim(),
          config: {
            provider,
            brevo_api_key: brevoApiKey,
            from_name: fromName,
            from_email: fromEmail,
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_username: smtpUsername,
            smtp_password: smtpPassword,
            smtp_encryption: smtpEncryption,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Test email failed');
      }

      toast.success('Test email sent successfully! Please check your inbox.');
      setIsVerified(true);
      setLastTestedAt(new Date().toISOString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Email delivery failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Email Settings"
        description="Centralized email delivery configuration for all flows and automations. Choose between Brevo API or standard SMTP."
      />

      {/* Provider Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setProvider('brevo')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            provider === 'brevo'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          <Zap className="h-4 w-4" />
          Brevo API (Recommended)
        </button>

        <button
          type="button"
          onClick={() => setProvider('smtp')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            provider === 'smtp'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          <Server className="h-4 w-4" />
          Custom SMTP
        </button>
      </div>

      {/* Verification Status Card */}
      <div
        className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
          isVerified
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
            : 'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {isVerified ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <div>
            <p className="font-semibold">
              {isVerified
                ? 'Email Configuration Active & Verified'
                : 'Configuration Not Yet Verified'}
            </p>
            <p className="text-xs opacity-90">
              {lastTestedAt
                ? `Last test verified on ${new Date(lastTestedAt).toLocaleString()}`
                : 'Use the test tool below to verify delivery after entering your credentials.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {provider === 'brevo' ? 'Brevo API Configuration' : 'Custom SMTP Configuration'}
          </CardTitle>
          <CardDescription>
            {provider === 'brevo'
              ? 'Send transactional emails reliably through Brevo REST API using your Brevo account.'
              : 'Connect standard SMTP credentials (such as Gmail, Amazon SES, Mailgun, or self-hosted SMTP).'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {provider === 'brevo' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brevo-api-key" className="text-xs font-medium">
                    Brevo API Key (v3)
                  </Label>
                  <a
                    href="https://app.brevo.com/settings/keys/api"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Get API key from Brevo
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="brevo-api-key"
                  type="password"
                  placeholder="xkeysib-..."
                  value={brevoApiKey}
                  onChange={(e) => setBrevoApiKey(e.target.value)}
                  disabled={!canEditSettings}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Your transactional API key found under Brevo Dashboard &gt; SMTP &amp; API &gt; API Keys.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="from-name" className="text-xs font-medium">
                    Default Sender Name
                  </Label>
                  <Input
                    id="from-name"
                    placeholder="e.g., Acme Support"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="from-email" className="text-xs font-medium">
                    Verified Sender Email
                  </Label>
                  <Input
                    id="from-email"
                    type="email"
                    placeholder="support@yourdomain.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    disabled={!canEditSettings}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must be an authorized sender/domain in your Brevo account.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="smtp-host" className="text-xs font-medium">
                    SMTP Host
                  </Label>
                  <Input
                    id="smtp-host"
                    placeholder="e.g., smtp.gmail.com or smtp-relay.brevo.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port" className="text-xs font-medium">
                    SMTP Port
                  </Label>
                  <Input
                    id="smtp-port"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-user" className="text-xs font-medium">
                    Username
                  </Label>
                  <Input
                    id="smtp-user"
                    placeholder="your-email@example.com"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-pass" className="text-xs font-medium">
                    Password / App Key
                  </Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    placeholder="••••••••"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-enc" className="text-xs font-medium">
                    Encryption
                  </Label>
                  <Select
                    value={smtpEncryption}
                    onValueChange={(val) => setSmtpEncryption(val as any)}
                    disabled={!canEditSettings}
                  >
                    <SelectTrigger id="smtp-enc" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (STARTTLS - Port 587)</SelectItem>
                      <SelectItem value="ssl">SSL (Direct - Port 465)</SelectItem>
                      <SelectItem value="none">None (Port 25)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-from-name" className="text-xs font-medium">
                    From Name
                  </Label>
                  <Input
                    id="smtp-from-name"
                    placeholder="Your Business Name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-from-email" className="text-xs font-medium">
                    From Email
                  </Label>
                  <Input
                    id="smtp-from-email"
                    type="email"
                    placeholder="noreply@domain.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || !canEditSettings}
              className="flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection / Delivery Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Test Email Delivery</CardTitle>
          <CardDescription>
            Send a sample test email to verify that your credentials and sender address are working properly before running flows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="test-recipient" className="text-xs font-medium">
                Test Recipient Email
              </Label>
              <Input
                id="test-recipient"
                type="email"
                placeholder="your.personal@email.com"
                value={testToEmail}
                onChange={(e) => setTestToEmail(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSendTest}
              disabled={testing || !testToEmail.trim()}
              variant="outline"
              className="flex items-center gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

