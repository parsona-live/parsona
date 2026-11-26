import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  getCollectionWithFields,
  updateCollection,
  deleteCollection,
  upsertFields,
  deleteField,
  CrmServiceError,
} from '@/lib/crm/service';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('viewer');
    const { slug } = await params;
    const result = await getCollectionWithFields(ctx.supabase, ctx.accountId, slug);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('admin');
    const { slug } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { collection } = await getCollectionWithFields(ctx.supabase, ctx.accountId, slug);

    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = body.description;
    if (typeof body.icon === 'string') patch.icon = body.icon;
    if (typeof body.include_in_ai_context === 'boolean') {
      patch.include_in_ai_context = body.include_in_ai_context;
    }
    if (typeof body.ai_context_limit === 'number') {
      patch.ai_context_limit = body.ai_context_limit;
    }
    if (Array.isArray(body.unique_constraints)) {
      patch.unique_constraints = body.unique_constraints;
    }

    if (Object.keys(patch).length > 0) {
      await updateCollection(ctx.supabase, ctx.accountId, collection.id, patch);
    }

    if (Array.isArray(body.fields)) {
      await upsertFields(ctx.supabase, ctx.accountId, collection.id, body.fields);
    }

    if (typeof body.delete_field_id === 'string' && body.delete_field_id) {
      await deleteField(ctx.supabase, ctx.accountId, body.delete_field_id);
    }

    const updated = await getCollectionWithFields(ctx.supabase, ctx.accountId, collection.id);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('admin');
    const { slug } = await params;
    await deleteCollection(ctx.supabase, ctx.accountId, slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
