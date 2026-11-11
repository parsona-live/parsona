import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin')
    const { id } = await params
    const body = await req.json()

    const { data, error } = await ctx.supabase
      .from('comment_to_dm_rules')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ rule: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('admin')
    const { id } = await params

    const { error } = await ctx.supabase
      .from('comment_to_dm_rules')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

