import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

interface Params {
  params: Promise<{ contactId: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('viewer');
    const { contactId } = await params;

    const { data, error } = await ctx.supabase
      .from('crm_records')
      .select('*, crm_collections(id, slug, name, icon)')
      .eq('account_id', ctx.accountId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ records: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}
