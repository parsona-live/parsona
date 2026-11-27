import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { INTEGRATION_PROVIDERS } from '@/lib/integrations/catalog';
import { listAccountIntegrations, IntegrationServiceError } from '@/lib/integrations/service';

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:read');
    const integrations = await listAccountIntegrations(ctx.supabase, ctx.accountId);
    return ok({
      integrations,
      providers: INTEGRATION_PROVIDERS.map((p) => ({
        provider_key: p.provider_key,
        name: p.name,
        category: p.category,
        actions: p.actions.map((a) => ({
          key: a.key,
          label: a.label,
          description: a.description,
          inputFields: a.inputFields,
        })),
      })),
    });
  } catch (error) {
    if (error instanceof IntegrationServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}
