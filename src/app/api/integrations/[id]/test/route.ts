import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  decryptCredentials,
  getRawIntegrationById,
  IntegrationServiceError,
} from '@/lib/integrations/service';
import { testIntegrationConnection } from '@/lib/integrations/runner';
import type { ProviderKey } from '@/lib/integrations/catalog';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    // Allow testing unsaved credentials directly via id = 'preview'
    if (id === 'preview') {
      if (typeof body?.provider_key !== 'string') {
        return NextResponse.json({ error: 'provider_key is required' }, { status: 400 });
      }
      const result = await testIntegrationConnection({
        providerKey: body.provider_key as ProviderKey,
        credentials: body.credentials ?? {},
        publicConfig: body.public_config ?? {},
      });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    const existing = await getRawIntegrationById(ctx.supabase, ctx.accountId, id);
    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const savedCreds = decryptCredentials(existing.integration.encrypted_credentials);
    const mergedCreds = {
      ...savedCreds,
      ...(body?.credentials && typeof body.credentials === 'object' ? body.credentials : {}),
    };
    const mergedConfig = {
      ...(existing.integration.public_config ?? {}),
      ...(body?.public_config && typeof body.public_config === 'object' ? body.public_config : {}),
    };

    const result = await testIntegrationConnection({
      providerKey: existing.integration.provider_key,
      credentials: mergedCreds,
      publicConfig: mergedConfig,
    });

    await ctx.supabase
      .from('account_integrations')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: result.success ? 'ok' : 'error',
        last_test_error: result.error ?? null,
      })
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
