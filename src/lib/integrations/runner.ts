import type { SupabaseClient } from '@supabase/supabase-js';
import { isDeliverableUrl } from '@/lib/webhooks/ssrf';
import {
  decryptCredentials,
  getRawIntegrationById,
  type CustomIntegrationActionRow,
} from './service';
import type { ProviderKey } from './catalog';

export interface IntegrationExecutionResult {
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  const deliverable = await isDeliverableUrl(rawUrl);
  if (!deliverable) {
    throw new Error('Blocked unsafe or private network URL (SSRF protection)');
  }
  return parsed;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit & { allowRedirect?: boolean } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  await assertSafeUrl(url);
  const { allowRedirect = false, ...fetchInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...fetchInit,
      redirect: allowRedirect ? 'follow' : 'manual',
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    return { ok: res.ok, status: res.status, data: parsed };
  } finally {
    clearTimeout(timer);
  }
}

function parseArrayOrCsv(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall back to CSV split
    }
  }
  return trimmed.split(',').map((s) => s.trim());
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw };
    }
  }
  return {};
}

function interpolateTemplateString(str: string, inputs: Record<string, unknown>): string {
  return str.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const val = inputs[key];
    return val != null ? String(val) : '';
  });
}

function interpolateTemplateValue(val: unknown, inputs: Record<string, unknown>): unknown {
  if (typeof val === 'string') return interpolateTemplateString(val, inputs);
  if (Array.isArray(val)) return val.map((item) => interpolateTemplateValue(item, inputs));
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = interpolateTemplateValue(v, inputs);
    }
    return out;
  }
  return val;
}

export async function executeProviderAction(params: {
  providerKey: ProviderKey;
  credentials: Record<string, string>;
  publicConfig: Record<string, unknown>;
  actionKey: string;
  inputs: Record<string, unknown>;
  customActions?: CustomIntegrationActionRow[];
}): Promise<IntegrationExecutionResult> {
  const { providerKey, credentials, publicConfig, actionKey, inputs, customActions = [] } = params;

  try {
    switch (providerKey) {
      case 'cal_com': {
        const apiKey = credentials.api_key;
        if (!apiKey) return { success: false, error: 'Missing Cal.com API key' };
        const defaultEventTypeId = String(publicConfig.event_type_id ?? '');

        if (actionKey === 'get_booking_link') {
          const base = String(publicConfig.booking_url ?? '').trim();
          if (!base) return { success: false, error: 'Public Booking Link is not configured' };
          const url = new URL(base);
          if (inputs.name) url.searchParams.set('name', String(inputs.name));
          if (inputs.email) url.searchParams.set('email', String(inputs.email));
          return { success: true, status: 200, data: { url: url.toString() } };
        }

        if (actionKey === 'get_slots') {
          const eventTypeId = String(inputs.event_type_id || defaultEventTypeId).trim();
          if (!eventTypeId) return { success: false, error: 'Event Type ID is required' };
          const qs = new URLSearchParams({
            eventTypeId,
            startTime: String(inputs.start_date || ''),
            endTime: String(inputs.end_date || ''),
            timeZone: String(publicConfig.time_zone || 'UTC'),
          });
          const res = await fetchJsonWithTimeout(`https://api.cal.com/v2/slots/available?${qs.toString()}`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'cal-api-version': '2024-08-13',
            },
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Cal.com API error (${res.status})` };
        }

        if (actionKey === 'create_booking') {
          const eventTypeId = Number(inputs.event_type_id || defaultEventTypeId);
          if (!eventTypeId) return { success: false, error: 'Event Type ID is required' };
          const payload = {
            start: String(inputs.start || ''),
            eventTypeId,
            attendee: {
              name: String(inputs.name || 'Guest'),
              email: String(inputs.email || ''),
              timeZone: String(publicConfig.time_zone || 'UTC'),
              ...(inputs.phone ? { phoneNumber: String(inputs.phone) } : {}),
            },
            ...(inputs.notes ? { bookingFieldsResponses: { notes: String(inputs.notes) } } : {}),
          };
          const res = await fetchJsonWithTimeout('https://api.cal.com/v2/bookings', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'cal-api-version': '2024-08-13',
            },
            body: JSON.stringify(payload),
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Cal.com booking failed (${res.status})` };
        }

        if (actionKey === 'cancel_booking') {
          const uid = encodeURIComponent(String(inputs.booking_uid || '').trim());
          if (!uid) return { success: false, error: 'booking_uid is required' };
          const res = await fetchJsonWithTimeout(`https://api.cal.com/v2/bookings/${uid}/cancel`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'cal-api-version': '2024-08-13',
            },
            body: JSON.stringify({
              cancellationReason: String(inputs.reason || 'Cancelled via flow'),
            }),
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Cal.com cancel failed (${res.status})` };
        }

        return { success: false, error: `Unknown Cal.com action: ${actionKey}` };
      }

      case 'calendly': {
        const token = credentials.access_token;
        if (!token) return { success: false, error: 'Missing Calendly access token' };

        if (actionKey === 'get_scheduling_link') {
          const base = String(publicConfig.scheduling_url ?? '').trim();
          if (!base) return { success: false, error: 'Default Scheduling URL is not configured' };
          const url = new URL(base);
          if (inputs.name) url.searchParams.set('name', String(inputs.name));
          if (inputs.email) url.searchParams.set('email', String(inputs.email));
          return { success: true, status: 200, data: { url: url.toString() } };
        }

        if (actionKey === 'list_events') {
          const meRes = await fetchJsonWithTimeout('https://api.calendly.com/users/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!meRes.ok) {
            return { success: false, status: meRes.status, error: 'Calendly authentication failed' };
          }
          const userUri = (meRes.data as { resource?: { uri?: string } })?.resource?.uri;
          if (!userUri) return { success: false, error: 'Could not resolve Calendly user URI' };
          const qs = new URLSearchParams({
            user: userUri,
            status: 'active',
            count: String(inputs.count || '10'),
          });
          if (inputs.invitee_email) qs.set('invitee_email', String(inputs.invitee_email));
          const res = await fetchJsonWithTimeout(`https://api.calendly.com/scheduled_events?${qs.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Calendly API error (${res.status})` };
        }

        if (actionKey === 'cancel_event') {
          const uuid = encodeURIComponent(String(inputs.event_uuid || '').trim());
          if (!uuid) return { success: false, error: 'event_uuid is required' };
          const res = await fetchJsonWithTimeout(`https://api.calendly.com/scheduled_events/${uuid}/cancellation`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: String(inputs.reason || 'Cancelled via flow') }),
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Calendly cancel failed (${res.status})` };
        }

        return { success: false, error: `Unknown Calendly action: ${actionKey}` };
      }

      case 'google_sheets': {
        const webappUrl = credentials.webapp_url;
        if (!webappUrl) return { success: false, error: 'Missing Google Sheets Apps Script Web App URL' };
        const sheetName = String(inputs.sheet_name || publicConfig.sheet_name || '').trim() || undefined;

        const payload: Record<string, unknown> = { action: actionKey, sheetName };
        if (actionKey === 'append_row') {
          payload.values = parseArrayOrCsv(inputs.values);
        } else if (actionKey === 'lookup_row') {
          payload.columnIndex = Number(inputs.column_index ?? 0);
          payload.matchValue = String(inputs.match_value ?? '');
        } else if (actionKey === 'update_row') {
          payload.rowNumber = Number(inputs.row_number ?? 0);
          payload.values = parseArrayOrCsv(inputs.values);
        } else {
          return { success: false, error: `Unknown Google Sheets action: ${actionKey}` };
        }

        const res = await fetchJsonWithTimeout(webappUrl, {
          method: 'POST',
          allowRedirect: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return res.ok
          ? { success: true, status: res.status, data: res.data }
          : { success: false, status: res.status, data: res.data, error: `Google Sheets error (${res.status})` };
      }

      case 'google_calendar': {
        const webappUrl = credentials.webapp_url;
        if (!webappUrl) return { success: false, error: 'Missing Google Calendar Apps Script Web App URL' };
        const calendarId = String(publicConfig.calendar_id || '').trim() || undefined;

        const payload: Record<string, unknown> = {
          action: actionKey,
          calendarId,
          title: inputs.title,
          startTime: inputs.start_time,
          endTime: inputs.end_time,
          guestEmail: inputs.guest_email,
          description: inputs.description,
        };

        const res = await fetchJsonWithTimeout(webappUrl, {
          method: 'POST',
          allowRedirect: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return res.ok
          ? { success: true, status: res.status, data: res.data }
          : { success: false, status: res.status, data: res.data, error: `Google Calendar error (${res.status})` };
      }

      case 'razorpay': {
        const keyId = credentials.key_id;
        const keySecret = credentials.key_secret;
        if (!keyId || !keySecret) return { success: false, error: 'Missing Razorpay Key ID or Secret' };
        const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

        if (actionKey === 'create_payment_link') {
          const amountMajor = Number(inputs.amount || 0);
          if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
            return { success: false, error: 'Valid positive amount is required' };
          }
          const payload = {
            amount: Math.round(amountMajor * 100),
            currency: String(publicConfig.currency || 'INR'),
            description: String(inputs.description || 'Payment'),
            customer: {
              name: String(inputs.customer_name || ''),
              contact: String(inputs.customer_phone || ''),
              ...(inputs.customer_email ? { email: String(inputs.customer_email) } : {}),
            },
            notify: { sms: false, email: Boolean(inputs.customer_email) },
          };
          const res = await fetchJsonWithTimeout('https://api.razorpay.com/v1/payment_links', {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Razorpay error (${res.status})` };
        }

        if (actionKey === 'fetch_payment_link') {
          const plinkId = encodeURIComponent(String(inputs.payment_link_id || '').trim());
          if (!plinkId) return { success: false, error: 'payment_link_id is required' };
          const res = await fetchJsonWithTimeout(`https://api.razorpay.com/v1/payment_links/${plinkId}`, {
            headers: { Authorization: authHeader },
          });
          return res.ok
            ? { success: true, status: res.status, data: res.data }
            : { success: false, status: res.status, data: res.data, error: `Razorpay fetch failed (${res.status})` };
        }

        return { success: false, error: `Unknown Razorpay action: ${actionKey}` };
      }

      case 'slack': {
        const webhookUrl = credentials.webhook_url;
        if (!webhookUrl) return { success: false, error: 'Missing Slack Webhook URL' };
        if (actionKey !== 'send_notification') {
          return { success: false, error: `Unknown Slack action: ${actionKey}` };
        }
        const res = await fetchJsonWithTimeout(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: String(inputs.text || '') }),
        });
        return res.ok
          ? { success: true, status: res.status, data: { ok: true, status: res.status } }
          : { success: false, status: res.status, data: res.data, error: `Slack webhook failed (${res.status})` };
      }

      case 'webhook_bridge': {
        const webhookUrl = credentials.webhook_url;
        if (!webhookUrl) return { success: false, error: 'Missing Webhook URL' };
        if (actionKey !== 'trigger_workflow') {
          return { success: false, error: `Unknown Webhook Bridge action: ${actionKey}` };
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (credentials.secret_token) {
          headers['X-Webhook-Secret'] = credentials.secret_token;
        }
        const payload = parseJsonObject(inputs.payload);
        const res = await fetchJsonWithTimeout(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        return res.ok
          ? { success: true, status: res.status, data: res.data }
          : { success: false, status: res.status, data: res.data, error: `Webhook failed (${res.status})` };
      }

      case 'custom_api': {
        const baseUrl = String(publicConfig.base_url || '').trim().replace(/\/+$/, '');
        if (!baseUrl) return { success: false, error: 'Custom API Base URL is not configured' };

        const authType = String(publicConfig.auth_type || 'none');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authType === 'bearer' && credentials.auth_token) {
          headers.Authorization = `Bearer ${credentials.auth_token}`;
        } else if (authType === 'header' && credentials.auth_token) {
          const headerName = String(publicConfig.auth_header_name || 'X-API-Key').trim();
          headers[headerName] = credentials.auth_token;
        } else if (authType === 'basic') {
          const user = String(publicConfig.auth_header_name || '').trim();
          const pass = credentials.basic_password || credentials.auth_token || '';
          headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
        }

        let method = String(inputs.method || 'POST').toUpperCase();
        let path = String(inputs.path || '/');
        let body: unknown = inputs.body ? parseJsonObject(inputs.body) : undefined;

        if (actionKey !== 'request') {
          const slug = actionKey.startsWith('custom:') ? actionKey.slice('custom:'.length) : actionKey;
          const customAction = customActions.find((a) => a.slug === slug || a.id === slug);
          if (!customAction) {
            return { success: false, error: `Custom action "${actionKey}" not found` };
          }
          method = customAction.method;
          path = interpolateTemplateString(customAction.path_template, inputs);
          for (const [hk, hv] of Object.entries(customAction.headers_template ?? {})) {
            headers[hk] = interpolateTemplateString(String(hv), inputs);
          }
          if (customAction.body_template != null) {
            body = interpolateTemplateValue(customAction.body_template, inputs);
          }
        }

        const normalizedPath = path.startsWith('http://') || path.startsWith('https://')
          ? path
          : `${baseUrl}/${path.replace(/^\/+/, '')}`;

        const res = await fetchJsonWithTimeout(normalizedPath, {
          method,
          headers,
          ...(method !== 'GET' && method !== 'DELETE' && body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
        });
        return res.ok
          ? { success: true, status: res.status, data: res.data }
          : { success: false, status: res.status, data: res.data, error: `Custom API failed (${res.status})` };
      }

      default:
        return { success: false, error: `Unsupported provider: ${providerKey}` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function testIntegrationConnection(params: {
  providerKey: ProviderKey;
  credentials: Record<string, string>;
  publicConfig: Record<string, unknown>;
}): Promise<IntegrationExecutionResult> {
  const { providerKey, credentials, publicConfig } = params;

  try {
    switch (providerKey) {
      case 'cal_com': {
        if (!credentials.api_key) return { success: false, error: 'API Key is required' };
        const res = await fetchJsonWithTimeout('https://api.cal.com/v2/me', {
          headers: { Authorization: `Bearer ${credentials.api_key}`, 'cal-api-version': '2024-08-13' },
        });
        return res.ok
          ? { success: true, status: res.status, data: { message: 'Connected to Cal.com' } }
          : { success: false, status: res.status, error: `Cal.com rejected credentials (${res.status})` };
      }
      case 'calendly': {
        if (!credentials.access_token) return { success: false, error: 'Personal Access Token is required' };
        const res = await fetchJsonWithTimeout('https://api.calendly.com/users/me', {
          headers: { Authorization: `Bearer ${credentials.access_token}` },
        });
        return res.ok
          ? { success: true, status: res.status, data: { message: 'Connected to Calendly' } }
          : { success: false, status: res.status, error: `Calendly rejected token (${res.status})` };
      }
      case 'google_sheets':
      case 'google_calendar': {
        if (!credentials.webapp_url) return { success: false, error: 'Web App URL is required' };
        const res = await fetchJsonWithTimeout(credentials.webapp_url, {
          method: 'POST',
          allowRedirect: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ping',
            sheetName: publicConfig.sheet_name || undefined,
            calendarId: publicConfig.calendar_id || undefined,
          }),
        });
        return res.ok
          ? { success: true, status: res.status, data: res.data }
          : { success: false, status: res.status, error: `Apps Script ping failed (${res.status})` };
      }
      case 'razorpay': {
        if (!credentials.key_id || !credentials.key_secret) {
          return { success: false, error: 'Key ID and Key Secret are required' };
        }
        const authHeader = `Basic ${Buffer.from(`${credentials.key_id}:${credentials.key_secret}`).toString('base64')}`;
        const res = await fetchJsonWithTimeout('https://api.razorpay.com/v1/payment_links?count=1', {
          headers: { Authorization: authHeader },
        });
        return res.ok
          ? { success: true, status: res.status, data: { message: 'Connected to Razorpay' } }
          : { success: false, status: res.status, error: `Razorpay rejected keys (${res.status})` };
      }
      case 'slack': {
        if (!credentials.webhook_url) return { success: false, error: 'Slack Webhook URL is required' };
        await assertSafeUrl(credentials.webhook_url);
        return { success: true, status: 200, data: { message: 'Slack webhook URL verified (ready to send)' } };
      }
      case 'webhook_bridge': {
        if (!credentials.webhook_url) return { success: false, error: 'Webhook URL is required' };
        await assertSafeUrl(credentials.webhook_url);
        return { success: true, status: 200, data: { message: 'Webhook URL validated (SSRF check passed)' } };
      }
      case 'custom_api': {
        const baseUrl = String(publicConfig.base_url || '').trim();
        if (!baseUrl) return { success: false, error: 'Base URL is required' };
        await assertSafeUrl(baseUrl);
        return { success: true, status: 200, data: { message: 'Custom API Base URL validated' } };
      }
      default:
        return { success: false, error: `Unsupported provider: ${providerKey}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeAccountIntegration(params: {
  supabase: SupabaseClient;
  accountId: string;
  integrationId: string;
  actionKey: string;
  inputs: Record<string, unknown>;
}): Promise<IntegrationExecutionResult> {
  const found = await getRawIntegrationById(params.supabase, params.accountId, params.integrationId);
  if (!found) {
    return { success: false, error: 'Integration not found' };
  }
  if (!found.integration.is_active) {
    return { success: false, error: `Integration "${found.integration.display_name}" is disabled` };
  }
  const credentials = decryptCredentials(found.integration.encrypted_credentials);
  return executeProviderAction({
    providerKey: found.integration.provider_key,
    credentials,
    publicConfig: found.integration.public_config ?? {},
    actionKey: params.actionKey,
    inputs: params.inputs,
    customActions: found.customActions,
  });
}
