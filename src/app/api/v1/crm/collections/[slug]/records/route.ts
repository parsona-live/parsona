import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { queryRecords, createRecord, CrmServiceError } from '@/lib/crm/service';
import type { CrmFilter } from '@/lib/crm/types';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await requireApiKey(request, 'contacts:read');
    const { slug } = await params;
    const url = new URL(request.url);

    const page = Number(url.searchParams.get('page') ?? 1) || 1;
    const limit = Number(url.searchParams.get('limit') ?? 50) || 50;
    const contactId = url.searchParams.get('contact_id') ?? undefined;
    const search = url.searchParams.get('search') ?? undefined;

    let filters: CrmFilter[] | undefined;
    const rawFilters = url.searchParams.get('filters');
    if (rawFilters) {
      try {
        const parsed = JSON.parse(rawFilters);
        if (Array.isArray(parsed)) filters = parsed;
      } catch {
        return fail('bad_request', 'Invalid filters JSON', 400);
      }
    }

    const result = await queryRecords(ctx.supabase, ctx.accountId, slug, {
      page,
      limit,
      contactId,
      search,
      filters,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');
    const { slug } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      return fail('bad_request', 'Request body must include a data object', 400);
    }

    const result = await createRecord(ctx.supabase, ctx.accountId, slug, {
      contact_id: typeof body.contact_id === 'string' && body.contact_id ? body.contact_id : null,
      data: body.data,
      created_by_type: 'api',
      idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : null,
    });

    return ok(result, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}
