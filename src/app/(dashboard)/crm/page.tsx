'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { toast } from 'sonner';
import type { CrmCollection, CrmCollectionTemplate, CrmField, CrmFieldType, CrmRecord } from '@/lib/crm/types';
import { WorkspaceShell, type WorkspaceNavSection } from '@/components/layout/workspace-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Database,
  Plus,
  Download,
  Search,
  Settings2,
  Trash2,
  Pencil,
  Loader2,
  Sparkles,
  Calendar,
  ShoppingBag,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  Table2,
  Code2,
  Bot,
  KeyRound,
  Link2,
  RefreshCw,
  ArrowUpDown,
  ArrowRight,
} from 'lucide-react';

const FIELD_TYPES: CrmFieldType[] = [
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'email',
  'phone',
  'url',
  'relation',
  'json',
];

type CrmView = 'records' | 'schema' | 'export';

export default function DynamicCrmPage() {
  const supabase = createClient();

  const isAdmin = useCan('edit-settings');
  const canWriteRecords = useCan('send-messages');

  const [collections, setCollections] = useState<CrmCollection[]>([]);
  const [templates, setTemplates] = useState<CrmCollectionTemplate[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>('');
  const [activeView, setActiveView] = useState<CrmView>('records');
  const [loadingCols, setLoadingCols] = useState(true);

  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [fields, setFields] = useState<CrmField[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [contacts, setContacts] = useState<Array<{ id: string; name: string | null; phone: string | null }>>([]);

  // Create Collection Modal
  const [showNewCol, setShowNewCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [creatingCol, setCreatingCol] = useState(false);

  // Schema / Fields Form
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CrmFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldUnique, setNewFieldUnique] = useState(false);
  const [savingSchema, setSavingSchema] = useState(false);

  // Create / Edit Record Modal
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CrmRecord | null>(null);
  const [recordContactId, setRecordContactId] = useState('');
  const [recordFormData, setRecordFormData] = useState<Record<string, unknown>>({});
  const [savingRecord, setSavingRecord] = useState(false);

  const activeCollection = collections.find((c) => c.slug === activeSlug) || null;

  const loadCollections = useCallback(async () => {
    setLoadingCols(true);
    try {
      const res = await fetch('/api/crm/collections');
      const data = await res.json();
      const cols = (data.collections ?? []) as CrmCollection[];
      setCollections(cols);
      setTemplates(data.templates ?? []);
      if (cols.length > 0 && !cols.some((c) => c.slug === activeSlug)) {
        setActiveSlug(cols[0].slug);
      }
    } catch {
      toast.error('Failed to load CRM collections');
    } finally {
      setLoadingCols(false);
    }
  }, [activeSlug]);

  const loadRecords = useCallback(async () => {
    if (!activeSlug) {
      setRecords([]);
      setFields([]);
      setTotal(0);
      return;
    }
    setLoadingRecs(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/crm/collections/${activeSlug}/records?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRecords(data.records ?? []);
        setFields(data.fields ?? []);
        setTotal(data.total ?? 0);
        setSelectedIds(new Set());
      }
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoadingRecs(false);
    }
  }, [activeSlug, page, search, sortBy, sortDir]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    supabase
      .from('contacts')
      .select('id, name, phone')
      .is('linked_contact_id', null)
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setContacts(data);
      });
  }, [supabase]);

  async function handleCreateFromTemplate(templateId: string) {
    setCreatingCol(true);
    try {
      const res = await fetch('/api/crm/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create collection');
        return;
      }
      toast.success(`Created "${data.collection.name}" collection`);
      setShowNewCol(false);
      await loadCollections();
      setActiveSlug(data.collection.slug);
      setActiveView('records');
    } finally {
      setCreatingCol(false);
    }
  }

  async function handleCreateCustomCollection() {
    if (!newColName.trim()) return;
    setCreatingCol(true);
    try {
      const res = await fetch('/api/crm/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColName.trim(),
          description: newColDesc.trim() || null,
          fields: [
            { key: 'title', label: 'Title', field_type: 'text', is_required: true, show_in_table: true },
            { key: 'status', label: 'Status', field_type: 'text', is_required: false, show_in_table: true },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create collection');
        return;
      }
      toast.success(`Created "${data.collection.name}"`);
      setNewColName('');
      setNewColDesc('');
      setShowNewCol(false);
      await loadCollections();
      setActiveSlug(data.collection.slug);
      setActiveView('records');
    } finally {
      setCreatingCol(false);
    }
  }

  async function handleAddField() {
    if (!activeSlug || !newFieldLabel.trim()) return;
    setSavingSchema(true);
    try {
      const key = newFieldLabel
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const options =
        newFieldType === 'select'
          ? newFieldOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const res = await fetch(`/api/crm/collections/${activeSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: [
            {
              key,
              label: newFieldLabel.trim(),
              field_type: newFieldType,
              is_required: newFieldRequired,
              is_unique: newFieldUnique,
              options,
              sort_order: fields.length,
              show_in_table: true,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add field');
        return;
      }
      toast.success(`Added field "${newFieldLabel}"`);
      setNewFieldLabel('');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      setNewFieldUnique(false);
      await loadCollections();
      await loadRecords();
    } finally {
      setSavingSchema(false);
    }
  }

  async function handleDeleteField(fieldId: string) {
    if (!activeSlug) return;
    const res = await fetch(`/api/crm/collections/${activeSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_field_id: fieldId }),
    });
    if (res.ok) {
      toast.success('Field removed');
      await loadCollections();
      await loadRecords();
    }
  }

  async function handleToggleAiContext(checked: boolean) {
    if (!activeSlug) return;
    const res = await fetch(`/api/crm/collections/${activeSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_in_ai_context: checked }),
    });
    if (res.ok) {
      toast.success(checked ? 'Enabled in AI & Context Hub' : 'Excluded from AI Context');
      await loadCollections();
    }
  }

  function openNewRecordModal() {
    setEditingRecord(null);
    setRecordContactId('');
    const defaults: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.default_value !== null && f.default_value !== undefined) {
        defaults[f.key] = f.default_value;
      }
    }
    setRecordFormData(defaults);
    setRecordModalOpen(true);
  }

  function openEditRecordModal(rec: CrmRecord) {
    setEditingRecord(rec);
    setRecordContactId(rec.contact_id || '');
    setRecordFormData({ ...(rec.data || {}) });
    setRecordModalOpen(true);
  }

  async function handleSaveRecord() {
    if (!activeSlug) return;
    setSavingRecord(true);
    try {
      const url = editingRecord
        ? `/api/crm/collections/${activeSlug}/records/${editingRecord.id}`
        : `/api/crm/collections/${activeSlug}/records`;
      const method = editingRecord ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: recordContactId || null,
          data: recordFormData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save record');
        return;
      }
      toast.success(editingRecord ? 'Record updated' : 'Record created');
      setRecordModalOpen(false);
      await loadRecords();
    } finally {
      setSavingRecord(false);
    }
  }

  async function handleDeleteRecord(recordId: string) {
    if (!activeSlug) return;
    const res = await fetch(`/api/crm/collections/${activeSlug}/records/${recordId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Record deleted');
      await loadRecords();
    } else {
      toast.error('Failed to delete record');
    }
  }

  async function handleBulkDelete() {
    if (!activeSlug || selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/crm/collections/${activeSlug}/records/${id}`, { method: 'DELETE' }),
        ),
      );
      toast.success(`Deleted ${ids.length} record${ids.length === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      await loadRecords();
    } catch {
      toast.error('Failed to delete selected records');
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleAllRows(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(records.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport(format: 'csv' | 'json') {
    if (!activeSlug) return;
    window.open(`/api/crm/collections/${activeSlug}/export?format=${format}`, '_blank');
  }

  const allSelected = records.length > 0 && selectedIds.size === records.length;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const sections: WorkspaceNavSection[] = [
    {
      title: 'Collections',
      items: collections.map((col) => ({
        id: `col-${col.slug}`,
        label: col.name,
        icon:
          col.slug === 'appointments'
            ? Calendar
            : col.slug === 'orders'
              ? ShoppingBag
              : col.slug === 'tickets'
                ? LifeBuoy
                : Database,
        badge: col.fields?.length ?? 0,
        active: activeSlug === col.slug,
        onClick: () => {
          setActiveSlug(col.slug);
          setPage(1);
        },
      })),
    },
    ...(activeCollection
      ? [
          {
            title: 'Workspace',
            items: [
              {
                id: 'view-records',
                label: 'Records',
                icon: Table2,
                badge: total,
                active: activeView === 'records',
                onClick: () => setActiveView('records'),
              },
              ...(isAdmin
                ? [
                    {
                      id: 'view-schema',
                      label: 'Schema & Fields',
                      icon: Settings2,
                      badge: fields.length,
                      active: activeView === 'schema',
                      onClick: () => setActiveView('schema'),
                    },
                    {
                      id: 'view-export',
                      label: 'Export & API',
                      icon: Code2,
                      active: activeView === 'export',
                      onClick: () => setActiveView('export'),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  const viewTitle =
    activeView === 'schema'
      ? 'Schema & Fields'
      : activeView === 'export'
        ? 'Export & API'
        : activeCollection?.name || 'Dynamic CRM';

  return (
    <>
      <WorkspaceShell
        sidebarTitle="CRM Collections"
        sections={sections}
        noPadding={activeView === 'records' && Boolean(activeCollection) && !loadingCols}
        breadcrumbs={[
          { label: 'CRM', onClick: () => setActiveView('records') },
          { label: activeCollection?.name || 'Collections' },
          ...(activeCollection ? [{ label: viewTitle }] : []),
        ]}
        title={viewTitle}
        subtitle={activeCollection?.description || 'Define custom tables, connect Flows, and feed AI Context Hub.'}
        sidebarFooter={
          isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-1.5 h-8 text-xs"
              onClick={() => setShowNewCol(true)}
            >
              <Plus className="h-3.5 w-3.5" /> New Collection
            </Button>
          ) : null
        }
        headerActions={
          <>
            {activeCollection && isAdmin && (
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-8 text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            )}
            {activeCollection && canWriteRecords ? (
              <Button size="sm" onClick={openNewRecordModal} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Insert
              </Button>
            ) : isAdmin && !activeCollection ? (
              <Button size="sm" onClick={() => setShowNewCol(true)} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Collection
              </Button>
            ) : null}
          </>
        }
      >
        {loadingCols ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading collections...
          </div>
        ) : collections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-4 bg-card">
            <Sparkles className="h-8 w-8 text-primary mx-auto" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Start your Dynamic CRM</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Launch a ready-to-use collection in one click, or build your own custom table from scratch.
              </p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {templates.map((tpl) => (
                  <Button
                    key={tpl.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateFromTemplate(tpl.id)}
                    disabled={creatingCol}
                    className="gap-2"
                  >
                    {tpl.id === 'appointments' && <Calendar className="h-4 w-4 text-sky-500" />}
                    {tpl.id === 'orders' && <ShoppingBag className="h-4 w-4 text-emerald-500" />}
                    {tpl.id === 'tickets' && <LifeBuoy className="h-4 w-4 text-amber-500" />}
                    {tpl.name}
                  </Button>
                ))}
                <Button size="sm" onClick={() => setShowNewCol(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Custom Collection
                </Button>
              </div>
            )}
          </div>
        ) : (
          activeCollection && (
            <>
              {activeView === 'records' && (
                <div className="flex flex-1 flex-col min-w-0">
                  {/* Supabase-style Table Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder={`Filter ${activeCollection.name} by any text field...`}
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                          }}
                          className="pl-8 h-7.5 text-xs bg-background border-border"
                        />
                      </div>

                      {selectedIds.size > 0 && canWriteRecords && (
                        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs">
                          <span className="font-medium text-foreground">
                            {selectedIds.size} selected
                          </span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                          >
                            {bulkDeleting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 h-7.5">
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        <select
                          className="bg-transparent text-xs text-foreground focus:outline-none"
                          value={`${sortBy}:${sortDir}`}
                          onChange={(e) => {
                            const [col, dir] = e.target.value.split(':');
                            setSortBy(col);
                            setSortDir((dir as 'asc' | 'desc') || 'desc');
                            setPage(1);
                          }}
                        >
                          <option value="created_at:desc" className="bg-popover">Sort: Newest</option>
                          <option value="created_at:asc" className="bg-popover">Sort: Oldest</option>
                          {fields.map((fld) => (
                            <option key={fld.id} value={`${fld.key}:asc`} className="bg-popover">
                              Sort: {fld.label} (A-Z)
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7.5 w-7.5"
                        onClick={loadRecords}
                        title="Refresh"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingRecs ? 'animate-spin' : ''}`} />
                      </Button>

                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('csv')}
                          className="h-7.5 px-2.5 text-xs gap-1"
                        >
                          <Download className="h-3.5 w-3.5" /> CSV
                        </Button>
                      )}

                      {canWriteRecords && (
                        <Button size="sm" onClick={openNewRecordModal} className="h-7.5 px-2.5 text-xs gap-1">
                          <Plus className="h-3.5 w-3.5" /> Insert
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Horizontally Scrollable Fixed-Column Supabase Grid */}
                  <div className="flex-1 overflow-x-auto bg-background">
                    <table className="w-max min-w-full border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-card text-left">
                        <tr className="border-b border-border">
                          <th className="w-10 min-w-[40px] max-w-[40px] border-r border-border px-2.5 py-2 text-center">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(v) => toggleAllRows(Boolean(v))}
                              aria-label="Select all rows"
                            />
                          </th>
                          <th className="w-[170px] min-w-[170px] max-w-[170px] border-r border-border px-3 py-2 font-medium text-foreground">
                            <div className="flex items-center gap-1.5">
                              <KeyRound className="h-3 w-3 text-emerald-500 shrink-0" />
                              <span className="truncate">id</span>
                              <span className="text-[11px] font-normal text-muted-foreground">uuid</span>
                            </div>
                          </th>
                          <th className="w-[200px] min-w-[200px] max-w-[200px] border-r border-border px-3 py-2 font-medium text-foreground">
                            <div className="flex items-center gap-1.5">
                              <Link2 className="h-3 w-3 text-emerald-500 shrink-0" />
                              <span className="truncate">contact_id</span>
                              <span className="text-[11px] font-normal text-muted-foreground">uuid</span>
                            </div>
                          </th>
                          {fields.map((fld) => (
                            <th
                              key={fld.id}
                              className="w-[190px] min-w-[190px] max-w-[190px] border-r border-border px-3 py-2 font-medium text-foreground"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="truncate">{fld.key}</span>
                                <span className="text-[11px] font-normal text-muted-foreground shrink-0">
                                  {fld.field_type}
                                </span>
                              </div>
                            </th>
                          ))}
                          <th className="w-[120px] min-w-[120px] max-w-[120px] border-r border-border px-3 py-2 font-medium text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>source</span>
                              <span className="text-[11px] font-normal text-muted-foreground">text</span>
                            </div>
                          </th>
                          <th className="w-[180px] min-w-[180px] max-w-[180px] border-r border-border px-3 py-2 font-medium text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>created_at</span>
                              <span className="text-[11px] font-normal text-muted-foreground">timestamptz</span>
                            </div>
                          </th>
                          {isAdmin && (
                            <th className="w-12 min-w-[48px] px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setActiveView('schema')}
                                className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Add column in Schema & Fields"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {loadingRecs ? (
                          <tr>
                            <td
                              colSpan={fields.length + 6}
                              className="py-10 text-center text-muted-foreground border-b border-border"
                            >
                              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                              Loading records...
                            </td>
                          </tr>
                        ) : records.length === 0 ? (
                          <tr>
                            <td
                              colSpan={fields.length + 6}
                              className="py-10 text-center text-muted-foreground border-b border-border"
                            >
                              No records yet. Click <strong>Insert</strong> to add a row or connect a Flow.
                            </td>
                          </tr>
                        ) : (
                          records.map((rec) => {
                            const isChecked = selectedIds.has(rec.id);
                            return (
                              <tr
                                key={rec.id}
                                className={`border-b border-border transition-colors hover:bg-muted/40 ${
                                  isChecked ? 'bg-accent/50' : ''
                                }`}
                              >
                                <td className="w-10 min-w-[40px] max-w-[40px] border-r border-border px-2.5 py-2 text-center">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggleRow(rec.id)}
                                    aria-label={`Select row ${rec.id}`}
                                  />
                                </td>
                                <td className="w-[170px] min-w-[170px] max-w-[170px] border-r border-border px-3 py-2 font-mono text-[11px] text-foreground/90 truncate">
                                  {rec.id}
                                </td>
                                <td className="w-[200px] min-w-[200px] max-w-[200px] border-r border-border px-3 py-2">
                                  {rec.contact ? (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="truncate text-foreground font-medium" title={rec.contact.id}>
                                        {rec.contact.name || rec.contact.phone || rec.contact.id}
                                      </span>
                                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground">
                                        <ArrowRight className="h-3 w-3" />
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-mono text-[11px] text-muted-foreground">NULL</span>
                                  )}
                                </td>
                                {fields.map((fld) => {
                                  const val = rec.data?.[fld.key];
                                  const isEmpty = val === undefined || val === null || val === '';
                                  return (
                                    <td
                                      key={fld.id}
                                      className="w-[190px] min-w-[190px] max-w-[190px] border-r border-border px-3 py-2 truncate"
                                      title={isEmpty ? 'NULL' : String(val)}
                                    >
                                      {isEmpty ? (
                                        <span className="font-mono text-[11px] text-muted-foreground">NULL</span>
                                      ) : fld.field_type === 'select' ? (
                                        <Badge variant="secondary" className="text-[11px] font-normal">
                                          {String(val)}
                                        </Badge>
                                      ) : typeof val === 'boolean' ? (
                                        <span className="font-mono text-[11px]">{val ? 'true' : 'false'}</span>
                                      ) : typeof val === 'object' ? (
                                        <span className="font-mono text-[11px]">{JSON.stringify(val)}</span>
                                      ) : (
                                        <span className="text-foreground">{String(val)}</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="w-[120px] min-w-[120px] max-w-[120px] border-r border-border px-3 py-2">
                                  <Badge variant="outline" className="text-[10px]">
                                    {rec.created_by_type}
                                  </Badge>
                                </td>
                                <td className="w-[180px] min-w-[180px] max-w-[180px] border-r border-border px-3 py-2 font-mono text-[11px] text-muted-foreground truncate">
                                  {new Date(rec.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                                </td>
                                <td className="w-20 min-w-[80px] px-2 py-1.5 text-right">
                                  {canWriteRecords && (
                                    <div className="inline-flex items-center gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => openEditRecordModal(rec)}
                                        title="Edit row"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteRecord(rec.id)}
                                        title="Delete row"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Supabase-style Bottom Pagination Footer */}
                  <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
                    <span>
                      {total} record{total === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span>
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'schema' && isAdmin && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        Include in AI &amp; Context Hub
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Allow AI Auto-Reply &amp; Flow AI nodes to read a customer&apos;s records from this collection.
                      </div>
                    </div>
                    <Switch
                      checked={activeCollection.include_in_ai_context}
                      onCheckedChange={handleToggleAiContext}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                      <h3 className="text-sm font-semibold">Existing Fields</h3>
                      <div className="space-y-2">
                        {fields.map((fld) => (
                          <div
                            key={fld.id}
                            className="flex items-center justify-between p-2.5 rounded-md border border-border/70 text-xs"
                          >
                            <div>
                              <span className="font-semibold">{fld.label}</span>{' '}
                              <span className="text-muted-foreground font-mono">({fld.key})</span>
                              <div className="text-[11px] text-muted-foreground">
                                Type: {fld.field_type}
                                {fld.is_required ? ' · Required' : ''}
                                {fld.is_unique ? ' · Unique' : ''}
                                {fld.options?.length ? ` · [${fld.options.join(', ')}]` : ''}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteField(fld.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-5 space-y-4 h-fit">
                      <h3 className="text-sm font-semibold">Add New Field</h3>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label className="text-xs">Field Label</Label>
                          <Input
                            placeholder="e.g. Doctor Name"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <select
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as CrmFieldType)}
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft} value={ft}>
                                {ft}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {newFieldType === 'select' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Options (comma-separated)</Label>
                          <Input
                            placeholder="pending, confirmed, cancelled"
                            value={newFieldOptions}
                            onChange={(e) => setNewFieldOptions(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newFieldRequired}
                            onChange={(e) => setNewFieldRequired(e.target.checked)}
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newFieldUnique}
                            onChange={(e) => setNewFieldUnique(e.target.checked)}
                          />
                          Unique
                        </label>
                        <Button size="sm" onClick={handleAddField} disabled={savingSchema || !newFieldLabel.trim()} className="ml-auto">
                          {savingSchema ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                          Add Field
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'export' && isAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold">Export Collection Data</h3>
                    <p className="text-xs text-muted-foreground">
                      Download all records from <strong>{activeCollection.name}</strong> including linked contact info.
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" /> Download CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('json')} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" /> Download JSON
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold">Public REST API v1</h3>
                    <p className="text-xs text-muted-foreground">
                      Access or create records from external apps using your API key:
                    </p>
                    <pre className="rounded-md bg-muted p-3 text-[11px] font-mono overflow-x-auto">
{`GET  /api/v1/crm/collections/${activeCollection.slug}/records
POST /api/v1/crm/collections/${activeCollection.slug}/records`}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </WorkspaceShell>

      {/* New Collection Modal */}
      <Dialog open={showNewCol} onOpenChange={setShowNewCol}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create CRM Collection</DialogTitle>
            <DialogDescription>
              Start from a template or create a custom collection table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">1-Click Templates</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {templates.map((tpl) => (
                  <Button
                    key={tpl.id}
                    variant="outline"
                    className="justify-start h-auto py-2.5 px-3 text-left"
                    disabled={creatingCol}
                    onClick={() => handleCreateFromTemplate(tpl.id)}
                  >
                    <div>
                      <div className="text-xs font-semibold">{tpl.name}</div>
                      <div className="text-[10px] text-muted-foreground">{tpl.fields.length} fields</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs font-medium">Or Create Custom Collection</Label>
              <Input
                placeholder="Collection Name (e.g. Properties, Leads)"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewCol(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomCollection} disabled={creatingCol || !newColName.trim()}>
              {creatingCol ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Create Custom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Record Modal */}
      <Dialog open={recordModalOpen} onOpenChange={setRecordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Edit Record' : `New ${activeCollection?.name} Record`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label className="text-xs">Linked Contact (Optional)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                value={recordContactId}
                onChange={(e) => setRecordContactId(e.target.value)}
              >
                <option value="">No linked contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone || c.id}
                  </option>
                ))}
              </select>
            </div>

            {fields.map((fld) => (
              <div key={fld.id} className="space-y-1">
                <Label className="text-xs">
                  {fld.label} {fld.is_required ? <span className="text-destructive">*</span> : null}
                </Label>
                {fld.field_type === 'select' ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                    value={String(recordFormData[fld.key] ?? '')}
                    onChange={(e) => setRecordFormData({ ...recordFormData, [fld.key]: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {(fld.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : fld.field_type === 'boolean' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={Boolean(recordFormData[fld.key])}
                      onCheckedChange={(v) => setRecordFormData({ ...recordFormData, [fld.key]: v })}
                    />
                  </div>
                ) : (
                  <Input
                    type={
                      fld.field_type === 'number'
                        ? 'number'
                        : fld.field_type === 'date'
                          ? 'date'
                          : fld.field_type === 'datetime'
                            ? 'datetime-local'
                            : 'text'
                    }
                    className="h-9 text-xs"
                    value={String(recordFormData[fld.key] ?? '')}
                    onChange={(e) => setRecordFormData({ ...recordFormData, [fld.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecord} disabled={savingRecord}>
              {savingRecord ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
