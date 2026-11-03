import { NextResponse } from 'next/server';
import { requireRole, getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import type { EmailConfigData } from '@/lib/email/email-service';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from('email_configs')
      .select('*')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data || null });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json()) as Partial<EmailConfigData>;

    const provider = body.provider === 'smtp' ? 'smtp' : 'brevo';
    const fromEmail = body.from_email?.trim() || '';

    if (!fromEmail) {
      return NextResponse.json(
        { error: 'From Email is required' },
        { status: 400 }
      );
    }

    // Check existing
    const { data: existing } = await ctx.supabase
      .from('email_configs')
      .select('id, brevo_api_key, smtp_password')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    // Preserve existing secrets if user left them untouched or placeholder
    let brevoApiKey = body.brevo_api_key ?? null;
    if (brevoApiKey === '••••••••' || brevoApiKey === undefined) {
      brevoApiKey = existing?.brevo_api_key ?? null;
    }

    let smtpPassword = body.smtp_password ?? null;
    if (smtpPassword === '••••••••' || smtpPassword === undefined) {
      smtpPassword = existing?.smtp_password ?? null;
    }

    const payload = {
      account_id: ctx.accountId,
      provider,
      brevo_api_key: brevoApiKey,
      smtp_host: body.smtp_host ?? null,
      smtp_port: body.smtp_port ? Number(body.smtp_port) : 587,
      smtp_username: body.smtp_username ?? null,
      smtp_password: smtpPassword,
      smtp_encryption: body.smtp_encryption || 'tls',
      from_name: body.from_name ?? null,
      from_email: fromEmail,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing?.id) {
      result = await ctx.supabase
        .from('email_configs')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await ctx.supabase
        .from('email_configs')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: result.data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

