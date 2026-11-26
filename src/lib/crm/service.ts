import type { SupabaseClient } from '@supabase/supabase-js';
import { recordContactEvent } from '@/lib/context/events';
import { dispatchWebhookEvent } from '@/lib/webhooks/deliver';
import { validateCrmRecordData } from './validator';
import { CRM_COLLECTION_TEMPLATES } from './templates';
import type {
  CrmCollection,
  CrmCreatedByType,
  CrmField,
  CrmFilter,
  CrmQueryOptions,
  CrmQueryResult,
  CrmRecord,
  CrmUniqueConstraintRule,
} from './types';

export class CrmServiceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'crm_error') {
    super(message);
    this.name = 'CrmServiceError';
    this.status = status;
    this.code = code;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugifyCollectionName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base || !/^[a-z]/.test(base)) {
    return `col_${base || 'custom'}`.slice(0, 62);
  }
  return base.slice(0, 62);
}

// ============================================================
// Collections & Fields
// ============================================================

export async function listCollections(
  db: SupabaseClient,
  accountId: string,
): Promise<CrmCollection[]> {
  const { data: cols, error } = await db
    .from('crm_collections')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  if (error) throw new CrmServiceError(error.message, 500, 'db_error');
  const collections = (cols ?? []) as CrmCollection[];
  if (collections.length === 0) return [];

  const { data: fieldsData } = await db
    .from('crm_fields')
    .select('*')
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const fieldsByCol = new Map<string, CrmField[]>();
  for (const f of (fieldsData ?? []) as CrmField[]) {
    const arr = fieldsByCol.get(f.collection_id) ?? [];
    arr.push(f);
    fieldsByCol.set(f.collection_id, arr);
  }

  return collections.map((c) => ({
    ...c,
    fields: fieldsByCol.get(c.id) ?? [],
  }));
}

export async function getCollectionWithFields(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
): Promise<{ collection: CrmCollection; fields: CrmField[] }> {
  const isUuid = UUID_RE.test(slugOrId);
  const { data: col, error } = await db
    .from('crm_collections')
    .select('*')
    .eq('account_id', accountId)
    .eq(isUuid ? 'id' : 'slug', slugOrId)
    .maybeSingle();

  if (error) throw new CrmServiceError(error.message, 500, 'db_error');
  if (!col) throw new CrmServiceError(`Collection "${slugOrId}" not found.`, 404, 'not_found');

  const { data: fieldsData, error: fieldsErr } = await db
    .from('crm_fields')
    .select('*')
    .eq('account_id', accountId)
    .eq('collection_id', col.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (fieldsErr) throw new CrmServiceError(fieldsErr.message, 500, 'db_error');

  const fields = (fieldsData ?? []) as CrmField[];
  return {
    collection: { ...(col as CrmCollection), fields },
    fields,
  };
}

export async function createCollection(
  db: SupabaseClient,
  accountId: string,
  input: {
    name: string;
    slug?: string;
    description?: string | null;
    icon?: string;
    include_in_ai_context?: boolean;
    ai_context_limit?: number;
    unique_constraints?: CrmUniqueConstraintRule[];
    fields?: Array<{
      key: string;
      label: string;
      field_type: CrmField['field_type'];
      is_required?: boolean;
      is_unique?: boolean;
      options?: string[];
      relation_collection_id?: string | null;
      default_value?: unknown;
      sort_order?: number;
      show_in_table?: boolean;
    }>;
  },
): Promise<CrmCollection> {
  const slug = input.slug ? slugifyCollectionName(input.slug) : slugifyCollectionName(input.name);

  const { data: col, error } = await db
    .from('crm_collections')
    .insert({
      account_id: accountId,
      slug,
      name: input.name.trim(),
      description: input.description ?? null,
      icon: input.icon ?? 'table',
      include_in_ai_context: input.include_in_ai_context ?? true,
      ai_context_limit: input.ai_context_limit ?? 5,
      unique_constraints: input.unique_constraints ?? [],
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new CrmServiceError(`Collection with slug "${slug}" already exists.`, 409, 'duplicate_slug');
    }
    throw new CrmServiceError(error.message, 400, 'db_error');
  }

  let createdFields: CrmField[] = [];
  if (input.fields && input.fields.length > 0) {
    createdFields = await upsertFields(db, accountId, col.id, input.fields);
  }

  return { ...(col as CrmCollection), fields: createdFields };
}

export async function createCollectionFromTemplate(
  db: SupabaseClient,
  accountId: string,
  templateId: string,
): Promise<CrmCollection> {
  const tpl = CRM_COLLECTION_TEMPLATES.find((t) => t.id === templateId || t.slug === templateId);
  if (!tpl) {
    throw new CrmServiceError(`Template "${templateId}" not found.`, 404, 'template_not_found');
  }

  return createCollection(db, accountId, {
    name: tpl.name,
    slug: tpl.slug,
    description: tpl.description,
    icon: tpl.icon,
    include_in_ai_context: tpl.include_in_ai_context,
    unique_constraints: tpl.unique_constraints,
    fields: tpl.fields,
  });
}

export async function updateCollection(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
  patch: Partial<
    Pick<
      CrmCollection,
      'name' | 'description' | 'icon' | 'include_in_ai_context' | 'ai_context_limit' | 'unique_constraints'
    >
  >,
): Promise<CrmCollection> {
  const { collection } = await getCollectionWithFields(db, accountId, slugOrId);
  const { data, error } = await db
    .from('crm_collections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', collection.id)
    .eq('account_id', accountId)
    .select('*')
    .single();

  if (error) throw new CrmServiceError(error.message, 400, 'db_error');
  return data as CrmCollection;
}

export async function deleteCollection(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
): Promise<void> {
  const { collection } = await getCollectionWithFields(db, accountId, slugOrId);
  const { error } = await db
    .from('crm_collections')
    .delete()
    .eq('id', collection.id)
    .eq('account_id', accountId);

  if (error) throw new CrmServiceError(error.message, 400, 'db_error');
}

export async function upsertFields(
  db: SupabaseClient,
  accountId: string,
  collectionId: string,
  fields: Array<{
    id?: string;
    key: string;
    label: string;
    field_type: CrmField['field_type'];
    is_required?: boolean;
    is_unique?: boolean;
    options?: string[];
    relation_collection_id?: string | null;
    default_value?: unknown;
    sort_order?: number;
    show_in_table?: boolean;
  }>,
): Promise<CrmField[]> {
  const rows = fields.map((f, idx) => ({
    ...(f.id ? { id: f.id } : {}),
    account_id: accountId,
    collection_id: collectionId,
    key: slugifyCollectionName(f.key),
    label: f.label.trim(),
    field_type: f.field_type,
    is_required: Boolean(f.is_required),
    is_unique: Boolean(f.is_unique),
    options: f.options ?? [],
    relation_collection_id: f.relation_collection_id ?? null,
    default_value: f.default_value ?? null,
    sort_order: f.sort_order ?? idx,
    show_in_table: f.show_in_table ?? true,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await db
    .from('crm_fields')
    .upsert(rows, { onConflict: 'collection_id,key' })
    .select('*');

  if (error) throw new CrmServiceError(error.message, 400, 'db_error');
  return (data ?? []) as CrmField[];
}

export async function deleteField(
  db: SupabaseClient,
  accountId: string,
  fieldId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_fields')
    .delete()
    .eq('id', fieldId)
    .eq('account_id', accountId);

  if (error) throw new CrmServiceError(error.message, 400, 'db_error');
}

// ============================================================
// Records CRUD & Querying
// ============================================================

function applyFilterToQuery(query: any, filter: CrmFilter): any {
  const rawField = filter.field.trim();
  const isTopLevel =
    rawField === 'id' ||
    rawField === 'contact_id' ||
    rawField === 'created_at' ||
    rawField === 'updated_at';

  const colExpr = isTopLevel
    ? rawField
    : `data->>${rawField.replace(/^data\./, '')}`;

  switch (filter.operator) {
    case 'eq':
      return query.eq(colExpr, filter.value);
    case 'neq':
      return query.neq(colExpr, filter.value);
    case 'contains':
      return query.ilike(colExpr, `%${String(filter.value ?? '')}%`);
    case 'gt':
      return query.gt(colExpr, filter.value);
    case 'gte':
      return query.gte(colExpr, filter.value);
    case 'lt':
      return query.lt(colExpr, filter.value);
    case 'lte':
      return query.lte(colExpr, filter.value);
    case 'in':
      return query.in(colExpr, Array.isArray(filter.value) ? filter.value : [filter.value]);
    case 'is_null':
      return query.is(colExpr, null);
    default:
      return query;
  }
}

export async function queryRecords(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
  options: CrmQueryOptions = {},
): Promise<CrmQueryResult> {
  const { collection, fields } = await getCollectionWithFields(db, accountId, slugOrId);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db
    .from('crm_records')
    .select('*, contact:contacts(id, name, phone, email)', { count: 'exact' })
    .eq('account_id', accountId)
    .eq('collection_id', collection.id);

  if (options.contactId) {
    query = query.eq('contact_id', options.contactId);
  }

  if (options.filters && options.filters.length > 0) {
    for (const f of options.filters) {
      query = applyFilterToQuery(query, f);
    }
  }

  if (options.search && options.search.trim()) {
    const term = options.search.trim();
    // Search across first 5 text-like fields in data
    const searchable = fields
      .filter((f) => ['text', 'email', 'phone', 'select'].includes(f.field_type))
      .slice(0, 5);
    if (searchable.length > 0) {
      const orExpr = searchable
        .map((f) => `data->>${f.key}.ilike.%${term}%`)
        .join(',');
      query = query.or(orExpr);
    }
  }

  const sortBy = options.sortBy || 'created_at';
  const sortCol =
    sortBy === 'created_at' || sortBy === 'updated_at'
      ? sortBy
      : `data->>${sortBy.replace(/^data\./, '')}`;

  query = query
    .order(sortCol, { ascending: options.sortDir === 'asc' })
    .range(from, to);

  const { data, count, error } = await query;
  if (error) throw new CrmServiceError(error.message, 500, 'db_error');

  return {
    collection,
    fields,
    records: (data ?? []) as CrmRecord[],
    total: count ?? 0,
  };
}

/**
 * Enforce single-field `is_unique` and collection-level `unique_constraints`
 * (e.g. appointment date + time_slot conflict checks).
 */
async function checkUniqueConstraints(
  db: SupabaseClient,
  accountId: string,
  collection: CrmCollection,
  fields: CrmField[],
  data: Record<string, unknown>,
  excludeRecordId?: string,
): Promise<void> {
  // 1. Single-field unique checks
  for (const field of fields) {
    if (!field.is_unique) continue;
    const val = data[field.key];
    if (val === undefined || val === null || val === '') continue;

    let q = db
      .from('crm_records')
      .select('id')
      .eq('account_id', accountId)
      .eq('collection_id', collection.id)
      .eq(`data->>${field.key}`, String(val))
      .limit(1);

    if (excludeRecordId) q = q.neq('id', excludeRecordId);
    const { data: existing } = await q;
    if (existing && existing.length > 0) {
      throw new CrmServiceError(
        `A record with ${field.label || field.key} "${val}" already exists.`,
        409,
        'unique_conflict',
      );
    }
  }

  // 2. Composite unique / slot-conflict rules
  const rules = Array.isArray(collection.unique_constraints) ? collection.unique_constraints : [];
  for (const rule of rules) {
    if (!rule.fields || rule.fields.length === 0) continue;

    // Skip if current record matches an exclusion (e.g. status === 'cancelled')
    if (rule.exclude_where) {
      const excluded = Object.entries(rule.exclude_where).some(
        ([k, v]) => String(data[k] ?? '') === String(v),
      );
      if (excluded) continue;
    }

    let q = db
      .from('crm_records')
      .select('id, data')
      .eq('account_id', accountId)
      .eq('collection_id', collection.id);

    let allPresent = true;
    for (const fKey of rule.fields) {
      const val = data[fKey];
      if (val === undefined || val === null || val === '') {
        allPresent = false;
        break;
      }
      q = q.eq(`data->>${fKey}`, String(val));
    }
    if (!allPresent) continue;

    if (excludeRecordId) q = q.neq('id', excludeRecordId);

    const { data: matches } = await q;
    const conflicting = (matches ?? []).filter((m: any) => {
      if (!rule.exclude_where) return true;
      return !Object.entries(rule.exclude_where).some(
        ([k, v]) => String(m.data?.[k] ?? '') === String(v),
      );
    });

    if (conflicting.length > 0) {
      throw new CrmServiceError(
        rule.message || `Duplicate record for (${rule.fields.join(', ')}).`,
        409,
        'slot_conflict',
      );
    }
  }
}

export async function createRecord(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
  input: {
    contact_id?: string | null;
    data: Record<string, unknown>;
    created_by_type?: CrmCreatedByType;
    created_by_ref?: string | null;
    idempotency_key?: string | null;
  },
): Promise<{ record: CrmRecord; duplicate?: boolean }> {
  const { collection, fields } = await getCollectionWithFields(db, accountId, slugOrId);

  const validation = validateCrmRecordData(fields, input.data, { partial: false });
  if (!validation.valid) {
    throw new CrmServiceError(validation.errors.join(' '), 400, 'validation_error');
  }

  await checkUniqueConstraints(db, accountId, collection, fields, validation.data);

  const insertPayload: Record<string, unknown> = {
    account_id: accountId,
    collection_id: collection.id,
    contact_id: input.contact_id ?? null,
    data: validation.data,
    created_by_type: input.created_by_type ?? 'user',
    created_by_ref: input.created_by_ref ?? null,
  };
  if (input.idempotency_key) {
    insertPayload.idempotency_key = input.idempotency_key;
  }

  const { data: created, error } = await db
    .from('crm_records')
    .insert(insertPayload)
    .select('*, contact:contacts(id, name, phone, email)')
    .single();

  if (error) {
    if (error.code === '23505' && input.idempotency_key) {
      const { data: existing } = await db
        .from('crm_records')
        .select('*, contact:contacts(id, name, phone, email)')
        .eq('account_id', accountId)
        .eq('collection_id', collection.id)
        .eq('idempotency_key', input.idempotency_key)
        .maybeSingle();
      if (existing) {
        return { record: existing as CrmRecord, duplicate: true };
      }
    }
    throw new CrmServiceError(error.message, 400, 'db_error');
  }

  const record = created as CrmRecord;

  // Fire-and-forget Context Hub event + outbound webhook
  if (record.contact_id) {
    void recordContactEvent(db, {
      accountId,
      contactId: record.contact_id,
      eventType: `crm.${collection.slug}.created`,
      source: input.created_by_type ?? 'crm',
      sourceReference: record.id,
      payload: { collection: collection.name, ...record.data },
      idempotencyKey: `crm_rec_created_${record.id}`,
      summary: `Created ${collection.name} record`,
    }).catch((e) => console.warn('[crm] recordContactEvent failed:', e));
  }

  void dispatchWebhookEvent(db, accountId, 'crm.record.created', {
    collection_slug: collection.slug,
    record,
  }).catch(() => {});

  return { record };
}

export async function updateRecord(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
  recordId: string,
  input: {
    contact_id?: string | null;
    data: Record<string, unknown>;
    updated_by_type?: CrmCreatedByType;
  },
): Promise<CrmRecord> {
  const { collection, fields } = await getCollectionWithFields(db, accountId, slugOrId);

  const { data: existing, error: fetchErr } = await db
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .eq('account_id', accountId)
    .eq('collection_id', collection.id)
    .maybeSingle();

  if (fetchErr) throw new CrmServiceError(fetchErr.message, 500, 'db_error');
  if (!existing) throw new CrmServiceError('Record not found.', 404, 'not_found');

  const validation = validateCrmRecordData(fields, input.data, { partial: true });
  if (!validation.valid) {
    throw new CrmServiceError(validation.errors.join(' '), 400, 'validation_error');
  }

  const mergedData = { ...(existing.data as Record<string, unknown>), ...validation.data };
  await checkUniqueConstraints(db, accountId, collection, fields, mergedData, recordId);

  const updatePayload: Record<string, unknown> = {
    data: mergedData,
    updated_at: new Date().toISOString(),
  };
  if (input.contact_id !== undefined) {
    updatePayload.contact_id = input.contact_id;
  }

  const { data: updated, error } = await db
    .from('crm_records')
    .update(updatePayload)
    .eq('id', recordId)
    .eq('account_id', accountId)
    .select('*, contact:contacts(id, name, phone, email)')
    .single();

  if (error) throw new CrmServiceError(error.message, 400, 'db_error');
  const record = updated as CrmRecord;

  if (record.contact_id) {
    void recordContactEvent(db, {
      accountId,
      contactId: record.contact_id,
      eventType: `crm.${collection.slug}.updated`,
      source: input.updated_by_type ?? 'crm',
      sourceReference: record.id,
      payload: { collection: collection.name, ...validation.data },
      summary: `Updated ${collection.name} record`,
    }).catch((e) => console.warn('[crm] recordContactEvent failed:', e));
  }

  void dispatchWebhookEvent(db, accountId, 'crm.record.updated', {
    collection_slug: collection.slug,
    record,
  }).catch(() => {});

  return record;
}

export async function deleteRecord(
  db: SupabaseClient,
  accountId: string,
  slugOrId: string,
  recordId: string,
): Promise<void> {
  const { collection } = await getCollectionWithFields(db, accountId, slugOrId);

  const { data: existing } = await db
    .from('crm_records')
    .select('id, contact_id')
    .eq('id', recordId)
    .eq('account_id', accountId)
    .eq('collection_id', collection.id)
    .maybeSingle();

  if (!existing) throw new CrmServiceError('Record not found.', 404, 'not_found');

  const { error } = await db
    .from('crm_records')
    .delete()
    .eq('id', recordId)
    .eq('account_id', accountId);

  if (error) throw new CrmServiceError(error.message, 400, 'db_error');

  if (existing.contact_id) {
    void recordContactEvent(db, {
      accountId,
      contactId: existing.contact_id,
      eventType: `crm.${collection.slug}.deleted`,
      source: 'crm',
      sourceReference: recordId,
      payload: { collection: collection.name },
      summary: `Deleted ${collection.name} record`,
    }).catch(() => {});
  }

  void dispatchWebhookEvent(db, accountId, 'crm.record.deleted', {
    collection_slug: collection.slug,
    record_id: recordId,
  }).catch(() => {});
}

/**
 * Format CRM records into a concise human/AI-readable bulleted summary.
 */
export function formatCrmRecordsText(
  collectionName: string,
  fields: CrmField[],
  records: CrmRecord[],
): string {
  if (records.length === 0) return `No ${collectionName} records found.`;
  const topFields = [...fields]
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5);

  return records
    .map((rec, idx) => {
      const parts = topFields
        .map((f) => {
          const val = rec.data?.[f.key];
          return val !== undefined && val !== null && val !== ''
            ? `${f.label || f.key}: ${val}`
            : null;
        })
        .filter(Boolean);
      return `${idx + 1}. ${parts.join(' | ')} (id: ${rec.id})`;
    })
    .join('\n');
}
