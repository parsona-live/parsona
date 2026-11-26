export type CrmFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'email'
  | 'phone'
  | 'url'
  | 'relation'
  | 'json';

export type CrmCreatedByType = 'user' | 'flow' | 'api' | 'ai' | 'mcp';

export interface CrmUniqueConstraintRule {
  fields: string[];
  exclude_where?: Record<string, string | number | boolean>;
  message?: string;
}

export interface CrmCollection {
  id: string;
  account_id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  include_in_ai_context: boolean;
  ai_context_limit: number;
  unique_constraints: CrmUniqueConstraintRule[];
  created_at: string;
  updated_at: string;
  fields?: CrmField[];
}

export interface CrmField {
  id: string;
  account_id: string;
  collection_id: string;
  key: string;
  label: string;
  field_type: CrmFieldType;
  is_required: boolean;
  is_unique: boolean;
  options: string[];
  relation_collection_id: string | null;
  default_value: unknown;
  sort_order: number;
  show_in_table: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmRecord {
  id: string;
  account_id: string;
  collection_id: string;
  contact_id: string | null;
  data: Record<string, unknown>;
  created_by_type: CrmCreatedByType;
  created_by_ref: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export type CrmFilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'is_null';

export interface CrmFilter {
  field: string;
  operator: CrmFilterOperator;
  value?: unknown;
}

export interface CrmQueryOptions {
  filters?: CrmFilter[];
  contactId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CrmQueryResult {
  collection: CrmCollection;
  fields: CrmField[];
  records: CrmRecord[];
  total: number;
}

export interface CrmCollectionTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  include_in_ai_context: boolean;
  unique_constraints: CrmUniqueConstraintRule[];
  fields: Array<{
    key: string;
    label: string;
    field_type: CrmFieldType;
    is_required?: boolean;
    is_unique?: boolean;
    options?: string[];
    default_value?: unknown;
    show_in_table?: boolean;
  }>;
}
