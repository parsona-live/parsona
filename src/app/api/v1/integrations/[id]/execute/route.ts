import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { executeAccountIntegration } from '@/lib/integrations/runner';
import { IntegrationServiceError } from '@/lib/integrations/service';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.action_key !== 'string') {
      return fail('bad_request', 'action_key is required', 400);
    }

    const result = await executeAccountIntegration({
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      integrationId: id,
      actionKey: body.action_key,
      inputs: body.inputs && typeof body.inputs === 'object' ? body.inputs : {},
    });

    if (!result.success) {
      return fail('integration_error', result.error || 'Integration execution failed', 400);
    }
    return ok(result);
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}
