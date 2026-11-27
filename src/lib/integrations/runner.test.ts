import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeProviderAction, testIntegrationConnection } from './runner';

vi.mock('@/lib/webhooks/ssrf', () => ({
  isDeliverableUrl: vi.fn(async (url: string) => !url.includes('127.0.0.1') && !url.includes('localhost')),
}));

describe('integration runner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks private/localhost URLs via SSRF protection', async () => {
    const res = await testIntegrationConnection({
      providerKey: 'webhook_bridge',
      credentials: { webhook_url: 'http://127.0.0.1:8080/hook' },
      publicConfig: {},
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('SSRF');
  });

  it('generates Cal.com prefilled booking link without network call', async () => {
    const res = await executeProviderAction({
      providerKey: 'cal_com',
      credentials: { api_key: 'cal_test_123' },
      publicConfig: { booking_url: 'https://cal.com/acme/30min' },
      actionKey: 'get_booking_link',
      inputs: { name: 'Alex', email: 'alex@example.com' },
    });
    expect(res.success).toBe(true);
    expect((res.data as { url: string }).url).toBe(
      'https://cal.com/acme/30min?name=Alex&email=alex%40example.com',
    );
  });

  it('executes Google Sheets append_row with parsed array values', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, rowNumber: 5 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await executeProviderAction({
      providerKey: 'google_sheets',
      credentials: { webapp_url: 'https://script.google.com/macros/s/abc/exec' },
      publicConfig: { sheet_name: 'Leads' },
      actionKey: 'append_row',
      inputs: { values: '["Alex", "+919876543210"]' },
    });

    expect(res.success).toBe(true);
    expect(res.data).toEqual({ ok: true, rowNumber: 5 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({
      action: 'append_row',
      sheetName: 'Leads',
      values: ['Alex', '+919876543210'],
    });
  });

  it('executes custom_api saved action with path & body template interpolation', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ order_status: 'shipped' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await executeProviderAction({
      providerKey: 'custom_api',
      credentials: { auth_token: 'secret_tok' },
      publicConfig: { base_url: 'https://api.example.com/v1', auth_type: 'bearer' },
      actionKey: 'custom:get_order',
      inputs: { order_id: 'ORD-99' },
      customActions: [
        {
          id: 'act-1',
          integration_id: 'int-1',
          account_id: 'acc-1',
          name: 'Get Order',
          slug: 'get_order',
          description: null,
          method: 'GET',
          path_template: '/orders/{{order_id}}',
          headers_template: {},
          body_template: null,
          input_fields: [],
          created_at: '',
          updated_at: '',
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.data).toEqual({ order_status: 'shipped' });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      'https://api.example.com/v1/orders/ORD-99',
    );
  });
});
