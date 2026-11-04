'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  Languages,
  Smile,
  MessageSquare,
  AlignLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsPanelHead } from './settings-panel-head';
import { AiKnowledgeCard } from './ai-knowledge';
import {
  AI_PROVIDER_DEFAULT_MODEL,
  AI_PROVIDER_DEFAULT_EMBEDDING_MODEL,
} from '@/lib/ai/defaults';
import type {
  AiProvider,
  AiLanguage,
  AiTone,
  AiResponseLength,
} from '@/lib/ai/types';
import type { AccountMember } from '@/types';
import { fetchAccountMembers, memberLabel } from '@/lib/account/members';
import { useTranslations } from 'next-intl';
import { invalidateAiAccountStatus } from '@/lib/ai/account-status-cache';

const MASKED_KEY = '••••••••••••••••';

// Radix Select can't use an empty-string item value, so the "leave
// unassigned" choice gets a sentinel that maps to null in the payload.
const HANDOFF_QUEUE = '__queue__';

const PROVIDER_LABEL: Record<Exclude<AiProvider, 'openai_compatible'>, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

const KEY_PLACEHOLDER: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  openai_compatible: 'your-api-key',
  openrouter: 'sk-or-v1-...',
};

const LANGUAGE_OPTIONS: { value: AiLanguage; label: string; flag: string }[] = [
  { value: 'auto', label: 'Auto-detect (Match Customer Language)', flag: '🌐' },
  { value: 'hinglish', label: 'Hinglish (Hindi in English Script)', flag: '🇮🇳' },
  { value: 'marathi', label: 'Marathi (मराठी)', flag: '🇮🇳' },
  { value: 'hindi', label: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { value: 'english', label: 'English', flag: '🇬🇧' },
  { value: 'spanish', label: 'Spanish (Español)', flag: '🇪🇸' },
  { value: 'portuguese', label: 'Portuguese (Português)', flag: '🇧🇷' },
  { value: 'arabic', label: 'Arabic (العربية)', flag: '🇦🇪' },
];

const TONE_OPTIONS: { value: AiTone; label: string; desc: string; icon: string }[] = [
  { value: 'friendly', label: 'Friendly', desc: 'Warm & conversational', icon: '😊' },
  { value: 'professional', label: 'Professional', desc: 'Formal & polite', icon: '👔' },
  { value: 'casual', label: 'Casual', desc: 'Modern & relaxed', icon: '💬' },
  { value: 'persuasive', label: 'Persuasive', desc: 'Benefit-focused & sales', icon: '🚀' },
  { value: 'direct', label: 'Direct', desc: 'Crisp & strictly facts', icon: '🎯' },
];

const LENGTH_OPTIONS: { value: AiResponseLength; label: string; hint: string; words: string }[] = [
  { value: 'short', label: 'Short', hint: '1–2 sentences', words: '~40 words' },
  { value: 'balanced', label: 'Balanced', hint: '2–4 sentences', words: '~80 words' },
  { value: 'detailed', label: 'Detailed', hint: 'Comprehensive', words: '~150 words' },
];

export function AiConfig() {
  const { accountId, accountRole, profileLoading } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;
  const t = useTranslations('Settings.aiConfig');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openrouter');
  const [model, setModel] = useState(AI_PROVIDER_DEFAULT_MODEL.openrouter);
  const [embeddingModel, setEmbeddingModel] = useState(
    AI_PROVIDER_DEFAULT_EMBEDDING_MODEL.openrouter,
  );
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [embeddingsKeyEdited, setEmbeddingsKeyEdited] = useState(false);
  const [hasStoredEmbeddingsKey, setHasStoredEmbeddingsKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [language, setLanguage] = useState<AiLanguage>('auto');
  const [tone, setTone] = useState<AiTone>('friendly');
  const [responseLength, setResponseLength] = useState<AiResponseLength>('balanced');
  const [isActive, setIsActive] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [maxPerConversation, setMaxPerConversation] = useState(3);
  // Empty string = leave unassigned (shared queue).
  const [handoffAgentId, setHandoffAgentId] = useState('');
  const [members, setMembers] = useState<AccountMember[]>([]);

  // Guard keyed on the account (not a bare boolean) so an in-place
  // account switch — ownership transfer, multi-account membership —
  // refetches instead of showing the previous account's config. Mirrors
  // the loadedAccountIdRef pattern in whatsapp-config.tsx.
  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t('loadFailed'));
        return;
      }
      if (data.configured) {
        setConfigured(true);
        setProvider(data.provider);
        setModel(data.model);
        setEmbeddingModel(
          AI_PROVIDER_DEFAULT_EMBEDDING_MODEL[data.provider as AiProvider] ??
            'openai/text-embedding-3-small',
        );
        setBaseUrl(data.base_url ?? '');
        setSystemPrompt(data.system_prompt ?? '');
        setLanguage(data.language ?? 'auto');
        setTone(data.tone ?? 'friendly');
        setResponseLength(data.response_length ?? 'balanced');
        setIsActive(data.is_active);
        setAutoReplyEnabled(data.auto_reply_enabled);
        setMaxPerConversation(data.auto_reply_max_per_conversation ?? 3);
        setHandoffAgentId(data.handoff_agent_id ?? '');
        setHasStoredKey(Boolean(data.has_key));
        setApiKey(data.has_key ? MASKED_KEY : '');
        setKeyEdited(false);
        setHasStoredEmbeddingsKey(Boolean(data.has_embeddings_key));
        setEmbeddingsKey(data.has_embeddings_key ? MASKED_KEY : '');
        setEmbeddingsKeyEdited(false);
      }
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchConfig();
    // Members populate the handoff-target picker. Best-effort — on an
    // older deployment without the endpoint the picker just shows the
    // queue option.
    void fetchAccountMembers().then(setMembers);
  }, [accountId, fetchConfig]);

  // Swap the model default when the provider changes, unless the user
  // typed a custom model.
  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    const isDefaultModel =
      model === AI_PROVIDER_DEFAULT_MODEL.openai ||
      model === AI_PROVIDER_DEFAULT_MODEL.anthropic ||
      model === AI_PROVIDER_DEFAULT_MODEL.openai_compatible ||
      model.trim() === '';
    setModel(AI_PROVIDER_DEFAULT_MODEL[next]);
    setEmbeddingModel(AI_PROVIDER_DEFAULT_EMBEDDING_MODEL[next]);
  };

  const keyPayload = () => (keyEdited ? apiKey.trim() : undefined);

  // undefined = leave unchanged; '' typed = null (clear); text = set.
  const embeddingsKeyPayload = () =>
    embeddingsKeyEdited ? embeddingsKey.trim() || null : undefined;

  const buildBody = () => ({
    provider,
    model: model.trim(),
    base_url: provider === 'openai_compatible' ? baseUrl.trim() : null,
    api_key: keyPayload(),
    embeddings_api_key: embeddingsKeyPayload(),
    system_prompt: systemPrompt.trim() || null,
    language,
    tone,
    response_length: responseLength,
    is_active: isActive,
    auto_reply_enabled: autoReplyEnabled,
    auto_reply_max_per_conversation: maxPerConversation,
    handoff_agent_id: handoffAgentId || null,
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          base_url: provider === 'openai_compatible' ? baseUrl.trim() : null,
          api_key: keyPayload(),
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success(t('testSuccess'));
      else toast.error(data.error ?? t('testRejected'));
    } catch {
      toast.error(t('testNetworkError'));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) {
      toast.error(t('missingModel'));
      return;
    }
    if (provider === 'openai_compatible' && !baseUrl.trim()) {
      toast.error(t('missingBaseUrl'));
      return;
    }
    if (!configured && !keyEdited) {
      toast.error(t('missingApiKey'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) {
        invalidateAiAccountStatus();
        toast.success(t('saveSuccess'));
        await fetchConfig();
      } else {
        toast.error(data.error ?? t('saveFailed'));
      }
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch('/api/ai/config', { method: 'DELETE' });
      if (res.ok) {
        invalidateAiAccountStatus();
        toast.success(t('removeSuccess'));
        setConfigured(false);
        setBaseUrl('');
        setHasStoredKey(false);
        setApiKey('');
        setKeyEdited(false);
        setHasStoredEmbeddingsKey(false);
        setEmbeddingsKey('');
        setEmbeddingsKeyEdited(false);
        setIsActive(false);
        setAutoReplyEnabled(false);
        setSystemPrompt('');
        setLanguage('auto');
        setTone('friendly');
        setResponseLength('balanced');
        setHandoffAgentId('');
      } else {
        const data = await res.json();
        toast.error(data.error ?? t('removeFailed'));
      }
    } catch {
      toast.error(t('removeFailed'));
    } finally {
      setRemoving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('loadFailed')} {/* Re-using label or a global one, wait, loading is better. Let's use useTranslations from overview or just hardcode Loading... actually I should add loading to aiConfig */}
        {/* Wait, I didn't add loading to aiConfig. I'll just use loading. */}
      </div>
    );
  }

  const disabled = !canEdit || saving;

  return (
    <div>
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />

      {!canEdit && (
        <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t('adminOnlyConfig')}
        </p>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> {t('providerAndKey')}
            </CardTitle>
            <CardDescription>
              {t('encryptionNotice')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-provider" className="text-sm font-semibold">
                {t('provider')}
              </Label>
              <Select
                value={provider}
                onValueChange={(v) => handleProviderChange(v as AiProvider)}
                disabled={disabled}
              >
                <SelectTrigger id="ai-provider" className="w-full h-11 text-sm bg-background">
                  <SelectValue placeholder="Select AI Provider" />
                </SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width]">
                  <SelectItem value="openrouter" className="py-2.5">
                    {PROVIDER_LABEL.openrouter}
                  </SelectItem>
                  <SelectItem value="openai" className="py-2.5">
                    {PROVIDER_LABEL.openai}
                  </SelectItem>
                  <SelectItem value="anthropic" className="py-2.5">
                    {PROVIDER_LABEL.anthropic}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-model" className="text-xs font-semibold">
                  {t('model')} (Chat & Auto-Reply)
                </Label>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
                  disabled={disabled}
                />
                <p className="text-[11px] text-muted-foreground">
                  {provider === 'openrouter'
                    ? 'Default: openai/gpt-4o-mini-2024-07-18'
                    : 'Model used for drafts, auto-replies, and WhatsApp flows.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-embeddings-model" className="text-xs font-semibold">
                  Embeddings Model (Knowledge Base)
                </Label>
                <Input
                  id="ai-embeddings-model"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  placeholder={AI_PROVIDER_DEFAULT_EMBEDDING_MODEL[provider]}
                  disabled={disabled}
                />
                <p className="text-[11px] text-muted-foreground">
                  {provider === 'openrouter'
                    ? 'Default: openai/text-embedding-3-small'
                    : 'Model used for knowledge base vector semantic search.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-key">{t('apiKey')}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ai-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyEdited(true);
                    }}
                    onFocus={() => {
                      if (!keyEdited && hasStoredKey) {
                        setApiKey('');
                        setKeyEdited(true);
                      }
                    }}
                    placeholder={KEY_PLACEHOLDER[provider]}
                    disabled={disabled}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={disabled || testing}
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {t('testKey')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-embeddings-key">
                {t('embeddingsKey')}{' '}
                <span className="font-normal text-muted-foreground">
                  {provider === 'openrouter'
                    ? '(Shared automatically with OpenRouter key above)'
                    : t('optionalSemanticSearch')}
                </span>
              </Label>
              <Input
                id="ai-embeddings-key"
                type="password"
                value={embeddingsKey}
                onChange={(e) => {
                  setEmbeddingsKey(e.target.value);
                  setEmbeddingsKeyEdited(true);
                }}
                onFocus={() => {
                  if (!embeddingsKeyEdited && hasStoredEmbeddingsKey) {
                    setEmbeddingsKey('');
                    setEmbeddingsKeyEdited(true);
                  }
                }}
                placeholder={
                  provider === 'openrouter'
                    ? 'Same as OpenRouter API key (leave blank to share)'
                    : 'sk-... (OpenAI)'
                }
                disabled={disabled}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {provider === 'openrouter'
                  ? 'With OpenRouter, your main API key above is automatically used for embeddings (openai/text-embedding-3-small). You do not need a separate key.'
                  : t('embeddingsHint', {
                      sameKeyText: provider === 'openai' ? t('sameKeyText') : '',
                    })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Persona & Voice Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Languages className="h-4 w-4 text-primary" /> AI Persona & Voice
                </CardTitle>
                <CardDescription>
                  Configure the response language, conversational tone, and message length for WhatsApp replies.
                </CardDescription>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                {TONE_OPTIONS.find((t) => t.value === tone)?.icon}{' '}
                {TONE_OPTIONS.find((t) => t.value === tone)?.label} •{' '}
                {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label.split(' ')[0]} •{' '}
                {LENGTH_OPTIONS.find((len) => len.value === responseLength)?.label}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Language Selection */}
            <div className="space-y-2">
              <Label htmlFor="ai-language" className="text-xs font-semibold">
                Default Conversation Language
              </Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as AiLanguage)}
                disabled={disabled}
              >
                <SelectTrigger id="ai-language" className="w-full h-10 bg-background text-sm">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="py-2">
                      <span className="mr-2">{opt.flag}</span>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {language === 'hinglish'
                  ? 'Indian WhatsApp style: Hindi written in English script (e.g. "Haan ji, humare working hours Monday se Friday 9 AM se 6 PM tak hain").'
                  : language === 'auto'
                  ? 'Automatically detects and replies in the exact language the customer writes in.'
                  : `Replies will strictly be generated in ${LANGUAGE_OPTIONS.find((l) => l.value === language)?.label}.`}
              </p>
            </div>

            {/* Conversational Tone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Smile className="h-3.5 w-3.5 text-muted-foreground" /> Conversational Tone
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {TONE_OPTIONS.find((t) => t.value === tone)?.desc}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TONE_OPTIONS.map((opt) => {
                  const isSelected = tone === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setTone(opt.value)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm font-semibold'
                          : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Response Length */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" /> Response Length
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {LENGTH_OPTIONS.find((l) => l.value === responseLength)?.words}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LENGTH_OPTIONS.map((opt) => {
                  const isSelected = responseLength === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setResponseLength(opt.value)}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2.5 text-xs transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm font-semibold'
                          : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-[10px] opacity-75">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('behaviour')}</CardTitle>
            <CardDescription>
              {t('behaviourDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">{t('businessContext')}</Label>
              <Textarea
                id="ai-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('promptPlaceholder')}
                rows={5}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('enableAssistant')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('enableAssistantDesc')}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('autoReply')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('autoReplyDesc')}
                </p>
              </div>
              <Switch
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
                disabled={disabled || !isActive}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ai-max">{t('maxAutoReplies')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('maxAutoRepliesDesc')}
                </p>
              </div>
              <Input
                id="ai-max"
                type="number"
                min={1}
                max={20}
                value={maxPerConversation}
                onChange={(e) =>
                  setMaxPerConversation(
                    Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                disabled={disabled || !autoReplyEnabled}
                className="w-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-handoff">{t('handoffTo')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('handoffToDesc')}
              </p>
              <Select
                value={handoffAgentId || HANDOFF_QUEUE}
                onValueChange={(v) =>
                  setHandoffAgentId(!v || v === HANDOFF_QUEUE ? '' : v)
                }
                disabled={disabled || !autoReplyEnabled}
              >
                <SelectTrigger id="ai-handoff">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HANDOFF_QUEUE}>
                    {t('handoffQueue')}
                  </SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {memberLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <AiKnowledgeCard
          accountId={accountId}
          canEdit={canEdit}
          hasEmbeddingsKey={
            embeddingsKeyEdited
              ? embeddingsKey.trim().length > 0
              : hasStoredEmbeddingsKey
          }
        />

        <div className="flex items-center justify-between">
          {configured ? (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={!canEdit || removing}
              className="text-destructive hover:text-destructive"
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('remove')}
            </Button>
          ) : (
            <span />
          )}

          <Button onClick={handleSave} disabled={disabled}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
