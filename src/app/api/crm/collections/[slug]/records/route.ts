import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { queryRecords, createRecord, CrmServiceError } from '@/lib/crm/service';
import type { CrmFilter } from '@/lib/crm/types';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('viewer');
    const { slug } = await params;
    const url = new URL(request.url);

    const page = Number(url.searchParams.get('page') ?? 1) || 1;
    const limit = Number(url.searchParams.get('limit') ?? 50) || 50;
    const search = url.searchParams.get('search') ?? undefined;
    const contactId = url.searchParams.get('contact_id') ?? undefined;
    const sortBy = url.searchParams.get('sort_by') ?? undefined;
    const sortDir = (url.searchParams.get('sort_dir') as 'asc' | 'desc' | null) ?? undefined;

    let filters: CrmFilter[] | undefined;
    const rawFilters = url.searchParams.get('filters');
    if (rawFilters) {
      try {
        const parsed = JSON.parse(rawFilters);
        if (Array.isArray(parsed)) filters = parsed;
      } catch {
        return NextResponse.json({ error: 'Invalid filters JSON' }, { status: 400 });
      }
    }

    const result = await queryRecords(ctx.supabase, ctx.accountId, slug, {
      page,
      limit,
      search,
      contactId,
      sortBy,
      sortDir,
      filters,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('agent');
    const { slug } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      return NextResponse.json({ error: 'Request body must include a data object' }, { status: 400 });
    }

    const result = await createRecord(ctx.supabase, ctx.accountId, slug, {
      contact_id: typeof body.contact_id === 'string' && body.contact_id ? body.contact_id : null,
      data: body.data,
      created_by_type: 'user',
      created_by_ref: ctx.userId,
      idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : null,
    });

    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
