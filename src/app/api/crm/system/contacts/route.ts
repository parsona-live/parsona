import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
    const search = (url.searchParams.get('search') ?? '').trim();
    const sortBy = url.searchParams.get('sort_by') || 'created_at';
    const sortDir = url.searchParams.get('sort_dir') === 'asc';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const ALLOWED_SORT = new Set(['created_at', 'name', 'phone', 'email', 'company']);
    const safeSort = ALLOWED_SORT.has(sortBy) ? sortBy : 'created_at';

    let query = ctx.supabase
      .from('contacts')
      .select(
        'id, name, phone, email, company, last_seen_channel, created_at, contact_group_members(contact_groups(id, name))',
        { count: 'exact' },
      )
      .eq('account_id', ctx.accountId)
      .is('linked_contact_id', null);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`,
      );
    }

    query = query.order(safeSort, { ascending: sortDir }).range(from, to);
    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const contacts = (data ?? []).map((row: any) => {
      const groups = (row.contact_group_members ?? [])
        .map((m: any) => m?.contact_groups?.name)
        .filter(Boolean);
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        company: row.company,
        last_seen_channel: row.last_seen_channel,
        created_at: row.created_at,
        groups,
      };
    });

    return NextResponse.json({ contacts, total: count ?? 0 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent');
    const body = await request.json().catch(() => null);
    if (!body || (!body.name && !body.phone && !body.email)) {
      return NextResponse.json(
        { error: 'Provide at least a name, phone, or email' },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from('contacts')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        name: typeof body.name === 'string' ? body.name.trim() || null : null,
        phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
        email: typeof body.email === 'string' ? body.email.trim() || null : null,
        company: typeof body.company === 'string' ? body.company.trim() || null : null,
      })
      .select('id, name, phone, email, company, last_seen_channel, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
