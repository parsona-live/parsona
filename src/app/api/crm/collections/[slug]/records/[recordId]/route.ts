import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { updateRecord, deleteRecord, CrmServiceError } from '@/lib/crm/service';

interface Params {
  params: Promise<{ slug: string; recordId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('agent');
    const { slug, recordId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      return NextResponse.json({ error: 'Request body must include a data object' }, { status: 400 });
    }

    const record = await updateRecord(ctx.supabase, ctx.accountId, slug, recordId, {
      contact_id: body.contact_id !== undefined ? body.contact_id : undefined,
      data: body.data,
      updated_by_type: 'user',
    });

    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('agent');
    const { slug, recordId } = await params;
    await deleteRecord(ctx.supabase, ctx.accountId, slug, recordId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
