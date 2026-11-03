import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { dispatchEmail, type EmailConfigData } from '@/lib/email/email-service';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json();
    const testToEmail = body.toEmail?.trim();

    if (!testToEmail) {
      return NextResponse.json(
        { error: 'Recipient test email address is required' },
        { status: 400 }
      );
    }

    let config: EmailConfigData = body.config;

    // If config fields are masked or missing, fetch saved config from database
    if (
      !config ||
      config.brevo_api_key === '••••••••' ||
      config.smtp_password === '••••••••' ||
      !config.from_email
    ) {
      const { data: savedConfig, error } = await ctx.supabase
        .from('email_configs')
        .select('*')
        .eq('account_id', ctx.accountId)
        .maybeSingle();

      if (error || !savedConfig) {
        return NextResponse.json(
          { error: 'Email configuration not found or incomplete' },
          { status: 400 }
        );
      }

      config = {
        ...savedConfig,
        ...(config || {}),
        brevo_api_key:
          config?.brevo_api_key && config.brevo_api_key !== '••••••••'
            ? config.brevo_api_key
            : savedConfig.brevo_api_key,
        smtp_password:
          config?.smtp_password && config.smtp_password !== '••••••••'
            ? config.smtp_password
            : savedConfig.smtp_password,
      };
    }

    const testSubject = `[Test Email] Verification from ${config.from_name || 'CRM'}`;
    const testBody = `Hello! This is a test message sent from your CRM to verify your email integration.\n\nProvider: ${config.provider.toUpperCase()}\nTimestamp: ${new Date().toISOString()}\n\nIf you received this message, your email integration is working properly!`;

    const result = await dispatchEmail(config, {
      toEmail: testToEmail,
      subject: testSubject,
      body: testBody,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send test email' },
        { status: 400 }
      );
    }

    // Mark as verified in database if saved
    await ctx.supabase
      .from('email_configs')
      .update({
        is_verified: true,
        last_tested_at: new Date().toISOString(),
      })
      .eq('account_id', ctx.accountId);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Test email successfully sent!',
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

