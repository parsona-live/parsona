import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  listCollections,
  createCollection,
  createCollectionFromTemplate,
  CrmServiceError,
} from '@/lib/crm/service';
import { CRM_COLLECTION_TEMPLATES } from '@/lib/crm/templates';

export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const collections = await listCollections(ctx.supabase, ctx.accountId);
    return NextResponse.json({
      collections,
      templates: CRM_COLLECTION_TEMPLATES,
    });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body.template_id === 'string' && body.template_id.trim()) {
      const collection = await createCollectionFromTemplate(
        ctx.supabase,
        ctx.accountId,
        body.template_id.trim(),
      );
      return NextResponse.json({ collection }, { status: 201 });
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
    }

    const collection = await createCollection(ctx.supabase, ctx.accountId, {
      name: body.name,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      description: typeof body.description === 'string' ? body.description : null,
      icon: typeof body.icon === 'string' ? body.icon : undefined,
      include_in_ai_context:
        typeof body.include_in_ai_context === 'boolean' ? body.include_in_ai_context : true,
      ai_context_limit: typeof body.ai_context_limit === 'number' ? body.ai_context_limit : 5,
      unique_constraints: Array.isArray(body.unique_constraints) ? body.unique_constraints : [],
      fields: Array.isArray(body.fields) ? body.fields : [],
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
