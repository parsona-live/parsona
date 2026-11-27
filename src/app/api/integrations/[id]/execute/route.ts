import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { executeAccountIntegration } from '@/lib/integrations/runner';
import { IntegrationServiceError } from '@/lib/integrations/service';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.action_key !== 'string') {
      return NextResponse.json({ error: 'action_key is required' }, { status: 400 });
    }

    const result = await executeAccountIntegration({
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      integrationId: id,
      actionKey: body.action_key,
      inputs: body.inputs && typeof body.inputs === 'object' ? body.inputs : {},
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
