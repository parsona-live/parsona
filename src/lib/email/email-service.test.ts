import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendViaBrevo, dispatchEmail, type EmailConfigData } from './email-service';

describe('email-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects sending if Brevo API key is empty', async () => {
    const res = await sendViaBrevo('', 'from@test.com', 'Test', 'to@test.com', 'Subject', 'Body');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/API key is missing/i);
  });

  it('sends via Brevo REST API with properly structured JSON payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: '<test-message-id-123>' }),
    });
    global.fetch = fetchMock;

    const res = await sendViaBrevo(
      'xkeysib-mock-api-key',
      'sender@company.com',
      'Acme Support',
      'customer@domain.com',
      'Your order has shipped',
      'Hello customer,\nYour order is on the way!'
    );

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('<test-message-id-123>');
    expect(fetchMock).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.objectContaining({
      method: 'POST',
      headers: {
        'api-key': 'xkeysib-mock-api-key',
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
    }));

    const bodyArg = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(bodyArg.sender).toEqual({ name: 'Acme Support', email: 'sender@company.com' });
    expect(bodyArg.to).toEqual([{ email: 'customer@domain.com' }]);
    expect(bodyArg.subject).toBe('Your order has shipped');
    expect(bodyArg.htmlContent).toContain('<br/>');
  });

  it('dispatches through Brevo when provider is brevo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: '<brevo-dispatch-id>' }),
    });
    global.fetch = fetchMock;

    const config: EmailConfigData = {
      provider: 'brevo',
      brevo_api_key: 'xkeysib-key',
      from_name: 'CRM',
      from_email: 'crm@domain.com',
    };

    const res = await dispatchEmail(config, {
      toEmail: 'lead@domain.com',
      subject: 'Welcome',
      body: 'Welcome aboard!',
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('<brevo-dispatch-id>');
  });
});

