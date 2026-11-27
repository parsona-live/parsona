'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Play,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_PROVIDERS,
  type IntegrationCategory,
  type IntegrationProviderDef,
  type ProviderKey,
} from '@/lib/integrations/catalog';
import type { SanitizedIntegration } from '@/lib/integrations/service';
import { ProviderLogo } from '@/components/integrations/provider-logo';

interface CardItem {
  provider: IntegrationProviderDef;
  integration?: SanitizedIntegration;
  cardKey: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<SanitizedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | IntegrationCategory>('all');

  // Side panel state
  const [activeCard, setActiveCard] = useState<CardItem | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Custom API endpoint creator inside side panel
  const [newActionName, setNewActionName] = useState('');
  const [newActionMethod, setNewActionMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('POST');
  const [newActionPath, setNewActionPath] = useState('');
  const [addingAction, setAddingAction] = useState(false);

  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integrations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load integrations');
      setIntegrations(data.integrations ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const cards = useMemo<CardItem[]>(() => {
    const items: CardItem[] = [];
    for (const provider of INTEGRATION_PROVIDERS) {
      const matches = integrations.filter((i) => i.provider_key === provider.provider_key);
      if (matches.length === 0) {
        items.push({ provider, cardKey: provider.provider_key });
      } else {
        matches.forEach((integration) => {
          items.push({ provider, integration, cardKey: integration.id });
        });
      }
    }

    return items.filter((item) => {
      if (category !== 'all' && item.provider.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = (item.integration?.display_name || item.provider.name).toLowerCase().includes(q);
        const descMatch = item.provider.description.toLowerCase().includes(q);
        const catMatch = item.provider.categoryLabel.toLowerCase().includes(q);
        return nameMatch || descMatch || catMatch;
      }
      return true;
    });
  }, [integrations, category, search]);

  function openSetupPanel(item: CardItem, createNewCustom = false) {
    const provider = item.provider;
    const existing = createNewCustom ? undefined : item.integration;
    setActiveCard(createNewCustom ? { provider, cardKey: `new_${Date.now()}` } : item);
    setDisplayName(existing?.display_name || provider.name);
    setCredentials({});
    const initialConfig: Record<string, string> = {};
    for (const f of provider.configFields) {
      const savedVal = existing?.public_config?.[f.key];
      initialConfig[f.key] =
        typeof savedVal === 'string'
          ? savedVal
          : savedVal != null
            ? String(savedVal)
            : f.defaultValue || '';
    }
    setPublicConfig(initialConfig);
    setRevealedSecrets({});
    setTestResult(null);
    setNewActionName('');
    setNewActionPath('');
  }

  async function handleSave() {
    if (!activeCard) return;
    setSaving(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCard.integration?.id,
          provider_key: activeCard.provider.provider_key,
          display_name: displayName.trim() || activeCard.provider.name,
          credentials,
          public_config: publicConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save credential');
      toast.success(`${displayName || activeCard.provider.name} saved`);
      await loadIntegrations();
      setActiveCard((prev) => (prev ? { ...prev, integration: data.integration } : null));
      setCredentials({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(targetItem?: CardItem) {
    const card = targetItem || activeCard;
    if (!card) return;
    setTesting(true);
    setTestResult(null);
    try {
      const endpoint = card.integration?.id
        ? `/api/integrations/${card.integration.id}/test`
        : '/api/integrations/preview/test';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_key: card.provider.provider_key,
          credentials: targetItem ? undefined : credentials,
          public_config: targetItem ? card.integration?.public_config : publicConfig,
        }),
      });
      const data = await res.json();
      const ok = Boolean(res.ok && data.success);
      const message = ok
        ? data.data?.message || 'Connection verified!'
        : data.error || 'Connection test failed';
      if (targetItem) {
        if (ok) toast.success(message);
        else toast.error(message);
        await loadIntegrations();
      } else {
        setTestResult({ ok, message });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      if (targetItem) toast.error(msg);
      else setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleActive(integration: SanitizedIntegration) {
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !integration.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(integration.is_active ? 'Integration disabled' : 'Integration enabled');
      await loadIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete(integration: SanitizedIntegration) {
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete integration');
      toast.success(`Removed ${integration.display_name}`);
      if (activeCard?.integration?.id === integration.id) setActiveCard(null);
      await loadIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleAddCustomAction() {
    if (!activeCard?.integration?.id || !newActionName.trim() || !newActionPath.trim()) return;
    setAddingAction(true);
    try {
      const res = await fetch(`/api/integrations/${activeCard.integration.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newActionName.trim(),
          method: newActionMethod,
          path_template: newActionPath.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add custom endpoint');
      toast.success('Custom endpoint added');
      setNewActionName('');
      setNewActionPath('');
      await loadIntegrations();
      setActiveCard((prev) =>
        prev && prev.integration
          ? {
              ...prev,
              integration: {
                ...prev.integration,
                custom_actions: [...(prev.integration.custom_actions ?? []), data.action],
              },
            }
          : prev,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add endpoint');
    } finally {
      setAddingAction(false);
    }
  }

  async function handleDeleteCustomAction(integrationId: string, actionId: string) {
    try {
      const res = await fetch(
        `/api/integrations/${integrationId}/actions?actionId=${encodeURIComponent(actionId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to remove endpoint');
      await loadIntegrations();
      setActiveCard((prev) =>
        prev && prev.integration
          ? {
              ...prev,
              integration: {
                ...prev.integration,
                custom_actions: (prev.integration.custom_actions ?? []).filter((a) => a.id !== actionId),
              },
            }
          : prev,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove endpoint');
    }
  }

  const customApiProvider = INTEGRATION_PROVIDERS.find(
    (p) => p.provider_key === ('custom_api' as ProviderKey),
  )!;

  return (
    <div className="min-h-full bg-background text-foreground px-6 py-6">
      <div className="max-w-[1600px] mx-auto space-y-5">
        {/* Header & Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">External Integrations</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect credentials once and use them across Flows, Public API, and MCP tools.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search integrations..."
                className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => openSetupPanel({ provider: customApiProvider, cardKey: 'new_custom' }, true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Custom API Tool
            </Button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
          {INTEGRATION_CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-secondary text-secondary-foreground border border-border shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 5-Column Responsive Card Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading integrations...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {cards.map((item) => {
              const { provider, integration } = item;
              const isConnected = Boolean(integration?.has_credentials && integration?.is_active);
              const isDisabled = Boolean(integration && !integration.is_active);
              const isSelected = activeCard?.cardKey === item.cardKey;

              return (
                <div
                  key={item.cardKey}
                  className={`group relative flex flex-col justify-between rounded-md border bg-card p-4 transition-all min-h-[176px] ${
                    isSelected
                      ? 'border-primary ring-1 ring-primary/30 shadow-sm'
                      : 'border-border hover:border-primary/60 hover:shadow-xs'
                  }`}
                >
                  {/* Subtle corner brackets on hover/selected */}
                  <span
                    className={`pointer-events-none absolute -top-px -left-px h-2.5 w-2.5 border-t-2 border-l-2 border-primary transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <span
                    className={`pointer-events-none absolute -top-px -right-px h-2.5 w-2.5 border-t-2 border-r-2 border-primary transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <span
                    className={`pointer-events-none absolute -bottom-px -left-px h-2.5 w-2.5 border-b-2 border-l-2 border-primary transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <span
                    className={`pointer-events-none absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-primary transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />

                  <div>
                    {/* Top Row: Brand Icon + Status + Menu */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <ProviderLogo providerKey={provider.provider_key} size="sm" />
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        )}
                        {isDisabled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Disabled
                          </span>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="Integration options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openSetupPanel(item)}>
                            {integration ? 'Configure Credentials' : 'Setup Credential'}
                          </DropdownMenuItem>
                          {integration && (
                            <>
                              <DropdownMenuItem onClick={() => handleTest(item)}>
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(integration)}>
                                {integration.is_active ? 'Disable' : 'Enable'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(integration)}
                                className="text-destructive focus:text-destructive"
                              >
                                Remove
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Title & 2-Line Description */}
                    <h3 className="text-sm font-semibold text-foreground mb-1 truncate">
                      {integration?.display_name || provider.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {provider.description}
                    </p>
                  </div>

                  {/* CTA Button: always visible, muted/low-opacity by default, primary on hover/selected */}
                  <div className="mt-3.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openSetupPanel(item)}
                      className={
                        isSelected
                          ? 'w-full h-8 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-all'
                          : 'w-full h-8 bg-muted/60 text-muted-foreground border border-border/70 opacity-75 group-hover:opacity-100 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary hover:bg-primary/90 text-xs font-medium transition-all'
                      }
                    >
                      {integration ? 'Configure' : 'Setup Credential'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Side Panel (Fields Only) */}
      <Sheet open={Boolean(activeCard)} onOpenChange={(open) => !open && setActiveCard(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          {activeCard && (
            <>
              <SheetHeader className="px-6 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <ProviderLogo providerKey={activeCard.provider.provider_key} size="md" />
                  <div className="min-w-0">
                    <SheetTitle className="text-base font-semibold text-foreground truncate">
                      {activeCard.provider.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground truncate">
                      {activeCard.provider.categoryLabel}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Display Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Connection Name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={activeCard.provider.name}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Credential Fields */}
                {activeCard.provider.credentialFields.map((field) => {
                  const masked = activeCard.integration?.masked_credentials?.[field.key];
                  const isRevealed = Boolean(revealedSecrets[field.key]);
                  const isSecret = field.type === 'password';
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium">
                          {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <div className="flex items-center gap-2">
                          {activeCard.provider.appsScriptSnippet && field.key === 'webapp_url' && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(activeCard.provider.appsScriptSnippet || '');
                                toast.success('Apps Script copied to clipboard');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <Copy className="w-3 h-3" /> Copy Apps Script
                            </button>
                          )}
                          {masked && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                              {masked}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          type={isSecret && !isRevealed ? 'password' : 'text'}
                          value={credentials[field.key] ?? ''}
                          onChange={(e) =>
                            setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          placeholder={
                            masked ? 'Leave blank to keep saved secret' : field.placeholder || ''
                          }
                          className="h-9 text-sm pr-9"
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedSecrets((prev) => ({ ...prev, [field.key]: !isRevealed }))
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Config Fields */}
                {activeCard.provider.configFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    {field.type === 'select' && field.options ? (
                      <Select
                        value={publicConfig[field.key] || field.defaultValue || ''}
                        onValueChange={(val) =>
                          setPublicConfig((prev) => ({ ...prev, [field.key]: val ?? '' }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        value={publicConfig[field.key] ?? ''}
                        onChange={(e) =>
                          setPublicConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className="text-sm"
                      />
                    ) : (
                      <Input
                        value={publicConfig[field.key] ?? ''}
                        onChange={(e) =>
                          setPublicConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className="h-9 text-sm"
                      />
                    )}
                    {field.helpText && (
                      <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}

                {/* Custom API Saved Endpoints (only when editing an existing Custom API) */}
                {activeCard.provider.provider_key === 'custom_api' && activeCard.integration && (
                  <div className="pt-2 border-t border-border space-y-2.5">
                    <Label className="text-xs font-medium">Custom Endpoints</Label>
                    {(activeCard.integration.custom_actions ?? []).length > 0 && (
                      <div className="space-y-1.5">
                        {activeCard.integration.custom_actions!.map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px]">
                                {act.method}
                              </span>
                              <span className="font-medium truncate">{act.name}</span>
                              <span className="text-muted-foreground font-mono truncate">
                                {act.path_template}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomAction(activeCard.integration!.id, act.id)}
                              className="text-muted-foreground hover:text-destructive p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-12 gap-1.5">
                      <Input
                        value={newActionName}
                        onChange={(e) => setNewActionName(e.target.value)}
                        placeholder="Action name"
                        className="col-span-5 h-8 text-xs"
                      />
                      <Select
                        value={newActionMethod}
                        onValueChange={(v) => setNewActionMethod((v ?? 'POST') as typeof newActionMethod)}
                      >
                        <SelectTrigger className="col-span-3 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={newActionPath}
                        onChange={(e) => setNewActionPath(e.target.value)}
                        placeholder="/path"
                        className="col-span-4 h-8 text-xs font-mono"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={addingAction || !newActionName.trim() || !newActionPath.trim()}
                      onClick={handleAddCustomAction}
                      className="w-full h-8 text-xs"
                    >
                      {addingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      Add Endpoint
                    </Button>
                  </div>
                )}

                {testResult && (
                  <div
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                      testResult.ok
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              <SheetFooter className="px-6 py-4 border-t border-border flex-row items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTest()}
                  disabled={testing || saving}
                  className="h-9 text-xs gap-1.5"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Test Connection
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveCard(null)}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-xs px-4"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Save
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
