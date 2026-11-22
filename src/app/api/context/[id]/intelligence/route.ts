import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { evaluateCustomerIntelligence } from '@/lib/context/intelligence'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: contactId } = await params

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's account_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'No account associated with user' }, { status: 400 })
  }

  try {
    const snapshot = await evaluateCustomerIntelligence(
      supabase,
      profile.account_id,
      contactId,
      { forceRefresh: true },
    )
    return NextResponse.json({ success: true, snapshot })
  } catch (error: any) {
    console.error('[POST /api/context/:id/intelligence] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to evaluate intelligence' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: contactId } = await params

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'No account associated' }, { status: 400 })
  }

  const { data: snapshot } = await supabase
    .from('contact_intelligence_snapshots')
    .select('*')
    .eq('account_id', profile.account_id)
    .eq('contact_id', contactId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ snapshot })
}
