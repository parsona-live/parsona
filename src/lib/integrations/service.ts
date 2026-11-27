import type { SupabaseClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { getIntegrationProvider, type ProviderKey } from './catalog';

export interface CustomIntegrationActionRow {
  id: string;
  integration_id: string;
  account_id: string;
  name: string;
  slug: string;
  description: string | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path_template: string;
  headers_template: Record<string, string>;
  body_template: unknown;
  input_fields: Array<{
    key: string;
    label: string;
    type?: 'text' | 'textarea' | 'json';
    placeholder?: string;
    required?: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export interface AccountIntegrationRow {
  id: string;
  account_id: string;
  provider_key: ProviderKey;
  display_name: string;
  category: string;
  encrypted_credentials: string;
  public_config: Record<string, unknown>;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SanitizedIntegration {
  id: string;
  account_id: string;
  provider_key: ProviderKey;
  display_name: string;
  category: string;
  public_config: Record<string, unknown>;
  has_credentials: boolean;
  masked_credentials: Record<string, string>;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
  custom_actions?: CustomIntegrationActionRow[];
}

export class IntegrationServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'INTEGRATION_ERROR') {
    super(message);
    this.name = 'IntegrationServiceError';
    this.status = status;
    this.code = code;
  }
}

export function decryptCredentials(encrypted: string): Record<string, string> {
  if (!encrypted) return {};
  try {
    const raw = decrypt(encrypted);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v;
        else if (v != null) out[k] = String(v);
      }
      return out;
    }
  } catch {
    // Fallback if plaintext JSON was somehow stored in dev
  }
  return {};
}

export function encryptCredentials(creds: Record<string, string>): string {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (typeof v === 'string' && v.trim() !== '') {
      cleaned[k] = v.trim();
    }
  }
  return encrypt(JSON.stringify(cleaned));
}

export function maskSecretValue(val: string): string {
  if (!val) return '';
  if (val.length <= 6) return '••••••';
  return `${val.slice(0, 3)}••••${val.slice(-3)}`;
}

export function sanitizeIntegration(
  row: AccountIntegrationRow,
  customActions?: CustomIntegrationActionRow[],
): SanitizedIntegration {
  const decrypted = decryptCredentials(row.encrypted_credentials);
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(decrypted)) {
    masked[k] = maskSecretValue(v);
  }
  return {
    id: row.id,
    account_id: row.account_id,
    provider_key: row.provider_key,
    display_name: row.display_name,
    category: row.category,
    public_config: row.public_config ?? {},
    has_credentials: Object.keys(decrypted).length > 0,
    masked_credentials: masked,
    is_active: row.is_active,
    last_tested_at: row.last_tested_at,
    last_test_status: row.last_test_status,
    last_test_error: row.last_test_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(customActions ? { custom_actions: customActions } : {}),
  };
}

export async function listAccountIntegrations(
  supabase: SupabaseClient,
  accountId: string,
): Promise<SanitizedIntegration[]> {
  const { data: rows, error } = await supabase
    .from('account_integrations')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new IntegrationServiceError(`Failed to load integrations: ${error.message}`, 500);
  }

  const integrationRows = (rows ?? []) as AccountIntegrationRow[];
  if (integrationRows.length === 0) return [];

  const { data: actionsData } = await supabase
    .from('custom_integration_actions')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  const actionsByIntegration = new Map<string, CustomIntegrationActionRow[]>();
  for (const action of (actionsData ?? []) as CustomIntegrationActionRow[]) {
    const list = actionsByIntegration.get(action.integration_id) ?? [];
    list.push(action);
    actionsByIntegration.set(action.integration_id, list);
  }

  return integrationRows.map((row) =>
    sanitizeIntegration(row, actionsByIntegration.get(row.id) ?? []),
  );
}

export async function getRawIntegrationById(
  supabase: SupabaseClient,
  accountId: string,
  integrationId: string,
): Promise<{ integration: AccountIntegrationRow; customActions: CustomIntegrationActionRow[] } | null> {
  const { data, error } = await supabase
    .from('account_integrations')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', integrationId)
    .maybeSingle();

  if (error) {
    throw new IntegrationServiceError(`Failed to fetch integration: ${error.message}`, 500);
  }
  if (!data) return null;

  const { data: actionsData } = await supabase
    .from('custom_integration_actions')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  return {
    integration: data as AccountIntegrationRow,
    customActions: (actionsData ?? []) as CustomIntegrationActionRow[],
  };
}

export interface UpsertIntegrationInput {
  id?: string;
  provider_key: string;
  display_name?: string;
  credentials?: Record<string, string>;
  public_config?: Record<string, unknown>;
  is_active?: boolean;
}

export async function saveAccountIntegration(
  supabase: SupabaseClient,
  accountId: string,
  input: UpsertIntegrationInput,
): Promise<SanitizedIntegration> {
  const provider = getIntegrationProvider(input.provider_key);
  if (!provider) {
    throw new IntegrationServiceError(`Unsupported integration provider: ${input.provider_key}`, 400);
  }

  const displayName = (input.display_name || provider.name).trim();
  const publicConfig = input.public_config ?? {};
  const isActive = typeof input.is_active === 'boolean' ? input.is_active : true;

  if (input.id) {
    const existing = await getRawIntegrationById(supabase, accountId, input.id);
    if (!existing) {
      throw new IntegrationServiceError('Integration not found', 404);
    }
    const existingCreds = decryptCredentials(existing.integration.encrypted_credentials);
    const mergedCreds: Record<string, string> = { ...existingCreds };
    if (input.credentials) {
      for (const [k, v] of Object.entries(input.credentials)) {
        if (typeof v === 'string' && v.trim() !== '') {
          mergedCreds[k] = v.trim();
        }
      }
    }

    const { data: updated, error } = await supabase
      .from('account_integrations')
      .update({
        display_name: displayName,
        encrypted_credentials: encryptCredentials(mergedCreds),
        public_config: publicConfig,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('account_id', accountId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new IntegrationServiceError(`Failed to update integration: ${error?.message ?? 'Unknown error'}`, 500);
    }
    return sanitizeIntegration(updated as AccountIntegrationRow, existing.customActions);
  }

  const creds = input.credentials ?? {};
  const { data: inserted, error } = await supabase
    .from('account_integrations')
    .insert({
      account_id: accountId,
      provider_key: provider.provider_key,
      display_name: displayName,
      category: provider.category,
      encrypted_credentials: encryptCredentials(creds),
      public_config: publicConfig,
      is_active: isActive,
    })
    .select('*')
    .single();

  if (error || !inserted) {
    throw new IntegrationServiceError(`Failed to create integration: ${error?.message ?? 'Unknown error'}`, 500);
  }

  return sanitizeIntegration(inserted as AccountIntegrationRow, []);
}

export async function deleteAccountIntegration(
  supabase: SupabaseClient,
  accountId: string,
  integrationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('account_integrations')
    .delete()
    .eq('id', integrationId)
    .eq('account_id', accountId);

  if (error) {
    throw new IntegrationServiceError(`Failed to delete integration: ${error.message}`, 500);
  }
}

export async function createCustomIntegrationAction(
  supabase: SupabaseClient,
  accountId: string,
  integrationId: string,
  input: {
    name: string;
    slug?: string;
    description?: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path_template: string;
    headers_template?: Record<string, string>;
    body_template?: unknown;
    input_fields?: Array<{
      key: string;
      label: string;
      type?: 'text' | 'textarea' | 'json';
      placeholder?: string;
      required?: boolean;
    }>;
  },
): Promise<CustomIntegrationActionRow> {
  const existing = await getRawIntegrationById(supabase, accountId, integrationId);
  if (!existing) {
    throw new IntegrationServiceError('Integration not found', 404);
  }

  const slug =
    (input.slug || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'custom_action';

  const { data, error } = await supabase
    .from('custom_integration_actions')
    .insert({
      integration_id: integrationId,
      account_id: accountId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      method: input.method,
      path_template: input.path_template.trim(),
      headers_template: input.headers_template ?? {},
      body_template: input.body_template ?? null,
      input_fields: input.input_fields ?? [],
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new IntegrationServiceError(`Failed to create custom action: ${error?.message ?? 'Unknown'}`, 400);
  }
  return data as CustomIntegrationActionRow;
}

export async function deleteCustomIntegrationAction(
  supabase: SupabaseClient,
  accountId: string,
  integrationId: string,
  actionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('custom_integration_actions')
    .delete()
    .eq('id', actionId)
    .eq('integration_id', integrationId)
    .eq('account_id', accountId);

  if (error) {
    throw new IntegrationServiceError(`Failed to delete custom action: ${error.message}`, 500);
  }
}
