import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { INTEGRATION_PROVIDERS } from '@/lib/integrations/catalog';
import {
  listAccountIntegrations,
  saveAccountIntegration,
  IntegrationServiceError,
} from '@/lib/integrations/service';

export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const integrations = await listAccountIntegrations(ctx.supabase, ctx.accountId);
    return NextResponse.json({
      integrations,
      providers: INTEGRATION_PROVIDERS,
    });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json().catch(() => null);
    if (!body || typeof body.provider_key !== 'string') {
      return NextResponse.json({ error: 'provider_key is required' }, { status: 400 });
    }

    const integration = await saveAccountIntegration(ctx.supabase, ctx.accountId, {
      id: typeof body.id === 'string' ? body.id : undefined,
      provider_key: body.provider_key,
      display_name: typeof body.display_name === 'string' ? body.display_name : undefined,
      credentials:
        body.credentials && typeof body.credentials === 'object' ? body.credentials : undefined,
      public_config:
        body.public_config && typeof body.public_config === 'object' ? body.public_config : undefined,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
    });

    return NextResponse.json({ integration }, { status: body.id ? 200 : 201 });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
