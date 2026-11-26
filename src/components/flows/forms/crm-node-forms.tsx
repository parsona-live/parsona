'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { VariableDropdown } from './fields';
import type { CrmCollection } from '@/lib/crm/types';
import type { CrmFetchFilterConfig } from '@/lib/flows/types';

function useCrmCollections() {
  const [collections, setCollections] = useState<CrmCollection[]>([]);
  useEffect(() => {
    let active = true;
    fetch('/api/crm/collections')
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((d) => {
        if (active) setCollections(d.collections ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return collections;
}

export function CrmFetchForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const collections = useCrmCollections();
  const slug = String(config.collection_slug ?? '');
  const selectedCol = collections.find((c) => c.slug === slug);
  const filters = (Array.isArray(config.filters) ? config.filters : []) as CrmFetchFilterConfig[];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Target Collection</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
          value={slug}
          onChange={(e) => onChange({ collection_slug: e.target.value })}
        >
          <option value="">Select a CRM collection...</option>
          {collections.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Filters</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              onChange({
                filters: [...filters, { field: 'contact_id', operator: 'eq', value: '{{contact.id}}' }],
              })
            }
          >
            <Plus className="mr-1 h-3 w-3" /> Add Filter
          </Button>
        </div>

        {filters.map((f, idx) => (
          <div key={idx} className="space-y-1 rounded-md border border-border/60 p-2 bg-muted/20">
            <div className="grid grid-cols-[1fr_72px_28px] gap-1.5 items-center">
              <Input
                className="h-8 text-xs"
                placeholder="field (e.g. status)"
                list={`crm-fields-${slug}`}
                value={f.field}
                onChange={(e) => {
                  const next = [...filters];
                  next[idx] = { ...f, field: e.target.value };
                  onChange({ filters: next });
                }}
              />
              <select
                className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
                value={f.operator}
                onChange={(e) => {
                  const next = [...filters];
                  next[idx] = { ...f, operator: e.target.value as CrmFetchFilterConfig['operator'] };
                  onChange({ filters: next });
                }}
              >
                <option value="eq">=</option>
                <option value="neq">!=</option>
                <option value="contains">~</option>
                <option value="gte">&gt;=</option>
                <option value="lte">&lt;=</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onChange({ filters: filters.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                className="h-8 text-xs flex-1"
                placeholder="Value or {{contact.id}}"
                value={f.value}
                onChange={(e) => {
                  const next = [...filters];
                  next[idx] = { ...f, value: e.target.value };
                  onChange({ filters: next });
                }}
              />
              <VariableDropdown
                onSelect={(tag) => {
                  const next = [...filters];
                  next[idx] = { ...f, value: `${f.value || ''}${tag}` };
                  onChange({ filters: next });
                }}
              />
            </div>
          </div>
        ))}

        {selectedCol?.fields && (
          <datalist id={`crm-fields-${slug}`}>
            <option value="contact_id" />
            {selectedCol.fields.map((fld) => (
              <option key={fld.id} value={fld.key} />
            ))}
          </datalist>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Save to Variable</Label>
          <Input
            className="h-8 text-xs"
            value={String(config.target_var ?? 'crm_records')}
            onChange={(e) => onChange({ target_var: e.target.value })}
            placeholder="crm_records"
          />
          <p className="text-[10px] text-muted-foreground">
            Also sets _count &amp; _text
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Limit</Label>
          <Input
            type="number"
            min={1}
            max={50}
            className="h-8 text-xs"
            value={Number(config.limit ?? 5)}
            onChange={(e) => onChange({ limit: Number(e.target.value) || 5 })}
          />
        </div>
      </div>
    </div>
  );
}

export function CrmMutateForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const collections = useCrmCollections();
  const slug = String(config.collection_slug ?? '');
  const operation = String(config.operation ?? 'create');
  const selectedCol = collections.find((c) => c.slug === slug);
  const mappings = (config.field_mappings ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Operation</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
            value={operation}
            onChange={(e) => onChange({ operation: e.target.value })}
          >
            <option value="create">Create Record</option>
            <option value="update">Update Record</option>
            <option value="upsert">Upsert Record</option>
            <option value="delete">Delete Record</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Collection</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
            value={slug}
            onChange={(e) => onChange({ collection_slug: e.target.value })}
          >
            <option value="">Select...</option>
            {collections.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {operation !== 'create' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Record ID</Label>
            <VariableDropdown
              onSelect={(tag) =>
                onChange({ record_id: `${String(config.record_id ?? '')}${tag}` })
              }
            />
          </div>
          <Input
            className="h-8 text-xs"
            placeholder="{{vars.existing_record.id}}"
            value={String(config.record_id ?? '')}
            onChange={(e) => onChange({ record_id: e.target.value })}
          />
        </div>
      )}

      {operation !== 'delete' && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Field Mappings</Label>
          {selectedCol?.fields && selectedCol.fields.length > 0 ? (
            <div className="space-y-2.5">
              {selectedCol.fields.map((fld) => {
                const isDateField = fld.field_type === 'date' || fld.field_type === 'datetime';
                const currentDateToken =
                  fld.field_type === 'datetime' ? '{{current_datetime}}' : '{{current_date}}';
                return (
                  <div key={fld.id} className="space-y-1 rounded-md border border-border/60 p-2 bg-muted/10">
                    <div className="flex items-center justify-between text-[11px] gap-1">
                      <span className="font-medium truncate">
                        {fld.label} {fld.is_required ? <span className="text-destructive">*</span> : null}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isDateField && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            title="Fill with current date at runtime"
                            onClick={() =>
                              onChange({
                                field_mappings: { ...mappings, [fld.key]: currentDateToken },
                              })
                            }
                          >
                            <CalendarClock className="mr-1 h-3 w-3" />
                            {fld.field_type === 'datetime' ? 'Now' : 'Current Date'}
                          </Button>
                        )}
                        <VariableDropdown
                          onSelect={(tag) =>
                            onChange({
                              field_mappings: {
                                ...mappings,
                                [fld.key]: `${mappings[fld.key] ?? ''}${tag}`,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <Input
                      className="h-8 text-xs"
                      placeholder={
                        isDateField
                          ? `YYYY-MM-DD or ${currentDateToken}`
                          : `Value or {{vars.${fld.key}}}`
                      }
                      value={mappings[fld.key] ?? ''}
                      onChange={(e) =>
                        onChange({
                          field_mappings: { ...mappings, [fld.key]: e.target.value },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select a collection with fields to map values.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs font-medium">Save Result to Variable</Label>
        <Input
          className="h-8 text-xs"
          placeholder="saved_record"
          value={String(config.save_result_var ?? 'saved_record')}
          onChange={(e) => onChange({ save_result_var: e.target.value })}
        />
      </div>
    </div>
  );
}
