import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { listCollections, createCollection, CrmServiceError } from '@/lib/crm/service';

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:read');
    const collections = await listCollections(ctx.supabase, ctx.accountId);
    return ok({ collections });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');
    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return fail('bad_request', 'Collection name is required', 400);
    }

    const collection = await createCollection(ctx.supabase, ctx.accountId, {
      name: body.name,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      description: typeof body.description === 'string' ? body.description : null,
      fields: Array.isArray(body.fields) ? body.fields : [],
    });

    return ok({ collection }, 201);
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}
