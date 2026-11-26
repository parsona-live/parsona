import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { updateRecord, deleteRecord, CrmServiceError } from '@/lib/crm/service';

interface Params {
  params: Promise<{ slug: string; recordId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');
    const { slug, recordId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      return fail('bad_request', 'Request body must include a data object', 400);
    }

    const record = await updateRecord(ctx.supabase, ctx.accountId, slug, recordId, {
      contact_id: body.contact_id !== undefined ? body.contact_id : undefined,
      data: body.data,
      updated_by_type: 'api',
    });

    return ok({ record });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');
    const { slug, recordId } = await params;
    await deleteRecord(ctx.supabase, ctx.accountId, slug, recordId);
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return fail(error.code, error.message, error.status);
    }
    return toApiErrorResponse(error);
  }
}
