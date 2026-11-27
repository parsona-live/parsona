'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { VariableDropdown } from './fields';
import { getIntegrationProvider, type IntegrationActionInputField } from '@/lib/integrations/catalog';
import type { SanitizedIntegration } from '@/lib/integrations/service';

export function IntegrationActionForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [integrations, setIntegrations] = useState<SanitizedIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/integrations', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { integrations: [] }))
      .then((d) => {
        if (active) setIntegrations(d.integrations ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const integrationId = String(config.integration_id ?? '');
  const actionKey = String(config.action_key ?? '');
  const targetVar = String(config.target_var ?? 'integration_res');
  const inputs = (config.inputs as Record<string, string> | undefined) ?? {};

  const selectedIntegration = useMemo(
    () => integrations.find((i) => i.id === integrationId),
    [integrations, integrationId],
  );

  const providerDef = useMemo(
    () =>
      getIntegrationProvider(
        selectedIntegration?.provider_key || String(config.provider_key ?? ''),
      ),
    [selectedIntegration, config.provider_key],
  );

  const availableActions = useMemo(() => {
    const builtIn = providerDef?.actions ?? [];
    const custom = (selectedIntegration?.custom_actions ?? []).map((ca) => ({
      key: `custom:${ca.slug}`,
      label: `${ca.name} (${ca.method} ${ca.path_template})`,
      description: ca.description || 'Custom API endpoint',
      inputFields: (ca.input_fields ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        type: (f.type || 'text') as 'text' | 'textarea' | 'json',
        placeholder: f.placeholder,
        required: f.required,
      })),
    }));
    return [...custom, ...builtIn];
  }, [providerDef, selectedIntegration]);

  const selectedAction = useMemo(
    () => availableActions.find((a) => a.key === actionKey),
    [availableActions, actionKey],
  );

  function updateInput(fieldKey: string, value: string) {
    onChange({
      inputs: {
        ...inputs,
        [fieldKey]: value,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Connected Integration</Label>
          <a
            href="/integrations"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
          >
            Manage Integrations <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading integrations...
          </div>
        ) : integrations.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              No integrations configured yet. Open{' '}
              <a href="/integrations" className="underline font-medium">
                External Integrations
              </a>{' '}
              to connect Cal.com, Google Sheets, Razorpay, or Custom APIs.
            </span>
          </div>
        ) : (
          <Select
            value={integrationId}
            onValueChange={(id) => {
              const found = integrations.find((i) => i.id === id);
              const def = found ? getIntegrationProvider(found.provider_key) : undefined;
              const firstAction =
                found?.custom_actions?.[0]
                  ? `custom:${found.custom_actions[0].slug}`
                  : def?.actions?.[0]?.key ?? '';
              onChange({
                integration_id: id,
                provider_key: found?.provider_key ?? '',
                action_key: firstAction,
                inputs: {},
              });
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Choose a connected integration..." />
            </SelectTrigger>
            <SelectContent>
              {integrations.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.display_name} ({item.provider_key})
                  {!item.is_active ? ' [Disabled]' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedIntegration && availableActions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Action</Label>
          <Select
            value={actionKey}
            onValueChange={(val) => onChange({ action_key: val, inputs: {} })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select an action..." />
            </SelectTrigger>
            <SelectContent>
              {availableActions.map((act) => (
                <SelectItem key={act.key} value={act.key}>
                  {act.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAction?.description && (
            <p className="text-[11px] text-muted-foreground">{selectedAction.description}</p>
          )}
        </div>
      )}

      {selectedAction && selectedAction.inputFields.length > 0 && (
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Action Parameters
          </p>
          {selectedAction.inputFields.map((field: IntegrationActionInputField) => {
            const val = inputs[field.key] ?? field.defaultValue ?? '';
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </Label>
                  {field.type !== 'select' && (
                    <VariableDropdown
                      onSelect={(token) => updateInput(field.key, `${val}${token}`)}
                    />
                  )}
                </div>
                {field.type === 'select' && field.options ? (
                  <Select value={val} onValueChange={(v) => updateInput(field.key, v ?? '')}>
                    <SelectTrigger className="h-8 text-xs">
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
                ) : field.type === 'textarea' || field.type === 'json' ? (
                  <Textarea
                    value={val}
                    onChange={(e) => updateInput(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="text-xs font-mono"
                  />
                ) : (
                  <Input
                    value={val}
                    onChange={(e) => updateInput(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="h-8 text-xs"
                  />
                )}
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Save Response JSON To Variable</Label>
        <Input
          value={targetVar}
          onChange={(e) => onChange({ target_var: e.target.value })}
          placeholder="integration_res"
          className="h-8 text-xs font-mono"
        />
        <p className="text-[11px] text-muted-foreground">
          Access fields in later nodes via{' '}
          <code className="px-1 py-0.5 rounded bg-muted text-foreground">
            {`{{vars.${targetVar || 'integration_res'}}}`}
          </code>
        </p>
      </div>
    </div>
  );
}
