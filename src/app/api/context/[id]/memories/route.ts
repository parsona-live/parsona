import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getActiveCustomerMemories, upsertCustomerMemory, deleteCustomerMemory } from '@/lib/context/memory'

interface RouteParams {
  params: Promise<{ id: string }>
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

  const memories = await getActiveCustomerMemories(supabase, profile.account_id, contactId)
  return NextResponse.json({ memories })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: contactId } = await params
  const body = await req.json().catch(() => ({}))

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

  const { key, value, valueType = 'string' } = body
  if (!key || !value) {
    return NextResponse.json({ error: 'Missing memory key or value' }, { status: 400 })
  }

  const result = await upsertCustomerMemory(supabase, {
    accountId: profile.account_id,
    contactId,
    memoryKey: key,
    memoryValue: value,
    valueType,
    sourceType: 'human_business_edit',
    authority: 'human_business_edit',
    confidence: 1.0,
  })

  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { searchParams } = new URL(req.url)
  const memoryId = searchParams.get('memoryId')
  if (!memoryId) {
    return NextResponse.json({ error: 'Missing memoryId parameter' }, { status: 400 })
  }

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

  const success = await deleteCustomerMemory(supabase, profile.account_id, memoryId)
  return NextResponse.json({ success })
}
