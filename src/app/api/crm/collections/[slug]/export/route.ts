import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { queryRecords, CrmServiceError } from '@/lib/crm/service';
import { formatCrmRecordsCsv, formatCrmRecordsJson } from '@/lib/crm/export';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('admin');
    const { slug } = await params;
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();

    const { collection, fields, records } = await queryRecords(
      ctx.supabase,
      ctx.accountId,
      slug,
      { page: 1, limit: 200 },
    );

    if (format === 'json') {
      const jsonStr = formatCrmRecordsJson(collection, fields, records);
      return new NextResponse(jsonStr, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${collection.slug}-export.json"`,
        },
      });
    }

    const csvStr = formatCrmRecordsCsv(collection, fields, records);
    return new NextResponse(csvStr, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${collection.slug}-export.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return toErrorResponse(error);
  }
}
