/**
 * Email dispatching service supporting Brevo REST API and Custom SMTP.
 */

export interface EmailConfigData {
  id?: string;
  account_id?: string;
  provider: 'brevo' | 'smtp';
  brevo_api_key?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | string | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  smtp_encryption?: 'tls' | 'ssl' | 'none' | null;
  from_name?: string | null;
  from_email: string;
}

export interface SendEmailPayload {
  toEmail: string;
  subject: string;
  body: string;
  html?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using Brevo (Sendinblue) transactional email REST API.
 * Uses native fetch - works seamlessly across Node.js, Serverless, and Edge runtimes.
 */
export async function sendViaBrevo(
  apiKey: string,
  fromEmail: string,
  fromName: string | undefined | null,
  toEmail: string,
  subject: string,
  body: string,
  html?: string
): Promise<SendEmailResult> {
  try {
    const cleanApiKey = apiKey.trim();
    if (!cleanApiKey) {
      return { success: false, error: 'Brevo API key is missing' };
    }

    const payload = {
      sender: {
        name: (fromName || fromEmail || 'CRM').trim(),
        email: fromEmail.trim(),
      },
      to: [
        {
          email: toEmail.trim(),
        },
      ],
      subject: subject || 'No Subject',
      htmlContent: html || body.replace(/\n/g, '<br/>'),
      textContent: body,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': cleanApiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        data?.message || data?.error || `Brevo API returned status ${res.status}`;
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: data?.messageId || `brevo-${Date.now()}`,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Send email using Custom SMTP. Dynamically imports nodemailer if available.
 */
export async function sendViaSmtp(
  config: {
    host: string;
    port: number | string;
    username?: string | null;
    password?: string | null;
    encryption?: 'tls' | 'ssl' | 'none' | null;
    fromEmail: string;
    fromName?: string | null;
  },
  toEmail: string,
  subject: string,
  body: string,
  html?: string
): Promise<SendEmailResult> {
  try {
    let nodemailer: any;
    try {
      nodemailer = await (Function('return import("nodemailer")')() as Promise<any>);
    } catch {
      return {
        success: false,
        error:
          'Custom SMTP requires nodemailer to be installed. Alternatively, switch to the Brevo API provider which works natively with zero setup.',
      };
    }
    const port = Number(config.port) || 587;
    const isSecure = config.encryption === 'ssl' || port === 465;

    const transporter = nodemailer.createTransport({
      host: config.host,
      port,
      secure: isSecure,
      auth:
        config.username && config.password
          ? {
              user: config.username,
              pass: config.password,
            }
          : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: config.fromName
        ? `"${config.fromName}" <${config.fromEmail}>`
        : config.fromEmail,
      to: toEmail,
      subject,
      text: body,
      html: html || body.replace(/\n/g, '<br/>'),
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Unified email sender: dispatches based on the configured provider.
 */
export async function dispatchEmail(
  config: EmailConfigData,
  payload: SendEmailPayload
): Promise<SendEmailResult> {
  if (config.provider === 'brevo') {
    if (!config.brevo_api_key) {
      return { success: false, error: 'Brevo API key is not configured.' };
    }
    return sendViaBrevo(
      config.brevo_api_key,
      config.from_email,
      config.from_name,
      payload.toEmail,
      payload.subject,
      payload.body,
      payload.html
    );
  }

  if (config.provider === 'smtp') {
    if (!config.smtp_host) {
      return { success: false, error: 'SMTP host is not configured.' };
    }
    return sendViaSmtp(
      {
        host: config.smtp_host,
        port: config.smtp_port || 587,
        username: config.smtp_username,
        password: config.smtp_password,
        encryption: config.smtp_encryption || 'tls',
        fromEmail: config.from_email,
        fromName: config.from_name,
      },
      payload.toEmail,
      payload.subject,
      payload.body,
      payload.html
    );
  }

  return { success: false, error: `Unknown email provider: ${config.provider}` };
}
