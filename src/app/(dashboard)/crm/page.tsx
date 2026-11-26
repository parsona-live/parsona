'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { toast } from 'sonner';
import type { CrmCollection, CrmCollectionTemplate, CrmField, CrmFieldType, CrmRecord } from '@/lib/crm/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function DynamicCrmPage() {
  const supabase = createClient();

  const isAdmin = useCan('edit-settings');
  const canWriteRecords = useCan('send-messages');

  const [collections, setCollections] = useState<CrmCollection[]>([]);
  const [templates, setTemplates] = useState<CrmCollectionTemplate[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>('');
  const [loadingCols, setLoadingCols] = useState(true);

  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [fields, setFields] = useState<CrmField[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Contacts for linking records
  const [contacts, setContacts] = useState<Array<{ id: string; name: string | null; phone: string | null }>>([]);

  // Create Collection Modal
  const [showNewCol, setShowNewCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [creatingCol, setCreatingCol] = useState(false);

  // Schema / Fields Editor Modal
  const [showSchemaModal, setShowSchemaModal] = useState(false);
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
        limit: '25',
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/crm/collections/${activeSlug}/records?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRecords(data.records ?? []);
        setFields(data.fields ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoadingRecs(false);
    }
  }, [activeSlug, page, search]);

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

  function handleExport(format: 'csv' | 'json') {
    if (!activeSlug) return;
    window.open(`/api/crm/collections/${activeSlug}/export?format=${format}`, '_blank');
  }

  const visibleFields = fields.filter((f) => f.show_in_table !== false);
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Dynamic CRM Collections
          </h1>
          <p className="text-sm text-muted-foreground">
            Create custom tables (Appointments, Orders, Tickets), manage records, connect Flows, and feed AI context.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowNewCol(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Collection
          </Button>
        )}
      </div>

      {/* Collection Tabs */}
      {loadingCols ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading collections...
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-4 bg-card">
          <Sparkles className="h-8 w-8 text-primary mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Start your Dynamic CRM</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Launch a ready-to-use collection in one click, or build your own custom table from scratch.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {templates.map((tpl) => (
                <Button
                  key={tpl.id}
                  variant="outline"
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
              <Button onClick={() => setShowNewCol(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Custom Collection
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
            {collections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  setActiveSlug(col.slug);
                  setPage(1);
                }}
                className={cn(
                  'px-3.5 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap',
                  activeSlug === col.slug
                    ? 'border-primary text-foreground bg-muted/40'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {col.name}
              </button>
            ))}
          </div>

          {activeCollection && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${activeCollection.name}...`}
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setShowSchemaModal(true)}>
                        <Settings2 className="mr-1.5 h-4 w-4" /> Fields ({fields.length})
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                        <Download className="mr-1.5 h-4 w-4" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                        <Download className="mr-1.5 h-4 w-4" /> JSON
                      </Button>
                    </>
                  )}
                  {canWriteRecords && (
                    <Button size="sm" onClick={openNewRecordModal}>
                      <Plus className="mr-1.5 h-4 w-4" /> Add Record
                    </Button>
                  )}
                </div>
              </div>

              {/* Records Table */}
              <div className="rounded-md border border-border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      {visibleFields.map((fld) => (
                        <TableHead key={fld.id}>{fld.label}</TableHead>
                      ))}
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRecs ? (
                      <TableRow>
                        <TableCell colSpan={visibleFields.length + 3} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Loading records...
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleFields.length + 3} className="text-center py-8 text-muted-foreground">
                          No records yet. Add one manually or connect a Flow!
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="text-xs font-medium">
                            {rec.contact ? (
                              <span>{rec.contact.name || rec.contact.phone || rec.contact.email}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {visibleFields.map((fld) => {
                            const val = rec.data?.[fld.key];
                            return (
                              <TableCell key={fld.id} className="text-xs">
                                {val === undefined || val === null || val === '' ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : fld.field_type === 'select' ? (
                                  <Badge variant="secondary" className="text-[11px]">
                                    {String(val)}
                                  </Badge>
                                ) : typeof val === 'boolean' ? (
                                  val ? 'Yes' : 'No'
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {rec.created_by_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canWriteRecords && (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditRecordModal(rec)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteRecord(rec.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {total} total record{total === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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

      {/* Schema / Fields Modal */}
      <Dialog open={showSchemaModal} onOpenChange={setShowSchemaModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Fields — {activeCollection?.name}</DialogTitle>
            <DialogDescription>
              Configure columns, validation, and AI Context Hub visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {activeCollection && (
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                <div>
                  <div className="text-xs font-semibold">Include in AI &amp; Context Hub</div>
                  <div className="text-[11px] text-muted-foreground">
                    Allow AI Auto-Reply &amp; Flow AI nodes to read a customer&apos;s records from this collection.
                  </div>
                </div>
                <Switch
                  checked={activeCollection.include_in_ai_context}
                  onCheckedChange={handleToggleAiContext}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium">Existing Fields</Label>
              {fields.map((fld) => (
                <div
                  key={fld.id}
                  className="flex items-center justify-between p-2.5 rounded-md border text-xs"
                >
                  <div>
                    <span className="font-semibold">{fld.label}</span>{' '}
                    <span className="text-muted-foreground font-mono">({fld.key})</span>
                    <div className="text-[11px] text-muted-foreground">
                      Type: {fld.field_type}
                      {fld.is_required ? ' · Required' : ''}
                      {fld.is_unique ? ' · Unique' : ''}
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

            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs font-medium">Add New Field</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Field Label (e.g. Doctor Name)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
                <select
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
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
              {newFieldType === 'select' && (
                <Input
                  placeholder="Options (comma-separated, e.g. pending, confirmed, cancelled)"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                />
              )}
              <div className="flex items-center gap-4 text-xs">
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
    </div>
  );
}
