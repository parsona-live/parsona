import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  createCustomIntegrationAction,
  deleteCustomIntegrationAction,
  IntegrationServiceError,
} from '@/lib/integrations/service';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || typeof body.path_template !== 'string') {
      return NextResponse.json({ error: 'name and path_template are required' }, { status: 400 });
    }

    const action = await createCustomIntegrationAction(ctx.supabase, ctx.accountId, id, {
      name: body.name,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      method: body.method || 'POST',
      path_template: body.path_template,
      headers_template:
        body.headers_template && typeof body.headers_template === 'object'
          ? body.headers_template
          : {},
      body_template: body.body_template ?? null,
      input_fields: Array.isArray(body.input_fields) ? body.input_fields : [],
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');
    if (!actionId) {
      return NextResponse.json({ error: 'actionId query param is required' }, { status: 400 });
    }
    await deleteCustomIntegrationAction(ctx.supabase, ctx.accountId, id, actionId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
