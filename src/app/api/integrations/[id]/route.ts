import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  getRawIntegrationById,
  saveAccountIntegration,
  deleteAccountIntegration,
  IntegrationServiceError,
} from '@/lib/integrations/service';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const existing = await getRawIntegrationById(ctx.supabase, ctx.accountId, id);
    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const integration = await saveAccountIntegration(ctx.supabase, ctx.accountId, {
      id,
      provider_key: existing.integration.provider_key,
      display_name:
        typeof body.display_name === 'string'
          ? body.display_name
          : existing.integration.display_name,
      credentials:
        body.credentials && typeof body.credentials === 'object' ? body.credentials : undefined,
      public_config:
        body.public_config && typeof body.public_config === 'object'
          ? body.public_config
          : existing.integration.public_config,
      is_active:
        typeof body.is_active === 'boolean' ? body.is_active : existing.integration.is_active,
    });

    return NextResponse.json({ integration });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await context.params;
    await deleteAccountIntegration(ctx.supabase, ctx.accountId, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
