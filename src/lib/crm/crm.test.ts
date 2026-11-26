import { describe, it, expect } from 'vitest';
import { validateCrmRecordData } from './validator';
import { formatCrmRecordsCsv, formatCrmRecordsJson } from './export';
import { slugifyCollectionName, formatCrmRecordsText } from './service';
import type { CrmCollection, CrmField, CrmRecord } from './types';

const sampleFields: CrmField[] = [
  {
    id: 'f1',
    account_id: 'acc1',
    collection_id: 'col1',
    key: 'service',
    label: 'Service',
    field_type: 'text',
    is_required: true,
    is_unique: false,
    options: [],
    relation_collection_id: null,
    default_value: null,
    sort_order: 0,
    show_in_table: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'f2',
    account_id: 'acc1',
    collection_id: 'col1',
    key: 'amount',
    label: 'Amount',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    options: [],
    relation_collection_id: null,
    default_value: null,
    sort_order: 1,
    show_in_table: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'f3',
    account_id: 'acc1',
    collection_id: 'col1',
    key: 'status',
    label: 'Status',
    field_type: 'select',
    is_required: true,
    is_unique: false,
    options: ['pending', 'confirmed', 'cancelled'],
    relation_collection_id: null,
    default_value: 'confirmed',
    sort_order: 2,
    show_in_table: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'f4',
    account_id: 'acc1',
    collection_id: 'col1',
    key: 'email',
    label: 'Email',
    field_type: 'email',
    is_required: false,
    is_unique: false,
    options: [],
    relation_collection_id: null,
    default_value: null,
    sort_order: 3,
    show_in_table: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const sampleCollection: CrmCollection = {
  id: 'col1',
  account_id: 'acc1',
  slug: 'appointments',
  name: 'Appointments',
  description: 'Bookings',
  icon: 'calendar',
  include_in_ai_context: true,
  ai_context_limit: 5,
  unique_constraints: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Dynamic CRM validator', () => {
  it('applies default values, coerces numbers, and validates required fields', () => {
    const res = validateCrmRecordData(sampleFields, {
      service: ' Dental Checkup ',
      amount: '150',
    });
    expect(res.valid).toBe(true);
    expect(res.data).toEqual({
      service: 'Dental Checkup',
      amount: 150,
      status: 'confirmed',
    });
  });

  it('rejects missing required fields, invalid select options, and bad emails', () => {
    const res = validateCrmRecordData(sampleFields, {
      status: 'unknown_status',
      email: 'not-an-email',
    });
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBe(3);
  });

  it('allows partial updates without required fields', () => {
    const res = validateCrmRecordData(sampleFields, { status: 'cancelled' }, { partial: true });
    expect(res.valid).toBe(true);
    expect(res.data).toEqual({ status: 'cancelled' });
  });
});

describe('Dynamic CRM helpers & export', () => {
  it('slugifies collection names safely', () => {
    expect(slugifyCollectionName('Appointment Bookings!')).toBe('appointment_bookings');
    expect(slugifyCollectionName('123 Orders')).toBe('col_123_orders');
  });

  it('formats records as RFC 4180 CSV and JSON', () => {
    const recs: CrmRecord[] = [
      {
        id: 'rec-1',
        account_id: 'acc1',
        collection_id: 'col1',
        contact_id: 'c1',
        data: { service: 'Dental, Cleaning', amount: 120, status: 'confirmed' },
        created_by_type: 'flow',
        created_by_ref: 'run-1',
        idempotency_key: null,
        created_at: '2026-11-26T10:00:00Z',
        updated_at: '2026-11-26T10:00:00Z',
        contact: { id: 'c1', name: 'Alice', phone: '+15551234', email: 'alice@example.com' },
      },
    ];

    const csv = formatCrmRecordsCsv(sampleCollection, sampleFields, recs);
    expect(csv).toContain('"Record ID","Contact Name","Contact Phone","Contact Email","Service","Amount","Status","Email"');
    expect(csv).toContain('"Dental, Cleaning"');
    expect(csv).toContain('"Alice"');

    const json = JSON.parse(formatCrmRecordsJson(sampleCollection, sampleFields, recs));
    expect(json.total).toBe(1);
    expect(json.collection.slug).toBe('appointments');

    const summary = formatCrmRecordsText('Appointments', sampleFields, recs);
    expect(summary).toContain('Service: Dental, Cleaning');
    expect(summary).toContain('Status: confirmed');
  });
});
