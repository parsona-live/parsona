import type { CrmCollection, CrmField, CrmRecord } from './types';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Format dynamic CRM records into RFC 4180 CSV text.
 */
export function formatCrmRecordsCsv(
  collection: CrmCollection,
  fields: CrmField[],
  records: CrmRecord[],
): string {
  const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  const headers = [
    'Record ID',
    'Contact Name',
    'Contact Phone',
    'Contact Email',
    ...sortedFields.map((f) => f.label || f.key),
    'Created By',
    'Created At',
    'Updated At',
  ];

  const rows = records.map((rec) => {
    const fieldValues = sortedFields.map((f) => escapeCsvField(rec.data?.[f.key]));
    return [
      escapeCsvField(rec.id),
      escapeCsvField(rec.contact?.name || ''),
      escapeCsvField(rec.contact?.phone || ''),
      escapeCsvField(rec.contact?.email || ''),
      ...fieldValues,
      escapeCsvField(rec.created_by_type),
      escapeCsvField(rec.created_at),
      escapeCsvField(rec.updated_at),
    ].join(',');
  });

  return [headers.map(escapeCsvField).join(','), ...rows].join('\r\n');
}

/**
 * Format dynamic CRM records into a structured JSON export payload.
 */
export function formatCrmRecordsJson(
  collection: CrmCollection,
  fields: CrmField[],
  records: CrmRecord[],
): string {
  return JSON.stringify(
    {
      collection: {
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
      },
      fields: fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.field_type,
      })),
      exported_at: new Date().toISOString(),
      total: records.length,
      records,
    },
    null,
    2,
  );
}
