import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

export interface BusinessProfileData {
  business_name: string
  tagline: string
  category: string
  description: string
  website_url: string
  support_email: string
  support_phone: string
  operating_hours: string
  address: string
  booking_url: string
  sync_to_ai: boolean
}

const DEFAULT_PROFILE: BusinessProfileData = {
  business_name: '',
  tagline: '',
  category: '',
  description: '',
  website_url: '',
  support_email: '',
  support_phone: '',
  operating_hours: '',
  address: '',
  booking_url: '',
  sync_to_ai: true,
}

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    // 1. Try fetching from business_profiles table
    const { data: profile, error } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (!error && profile) {
      return NextResponse.json({ profile })
    }

    // 2. Fallback: check accounts.name and accounts.internal_notes
    const { data: account } = await supabase
      .from('accounts')
      .select('name, internal_notes')
      .eq('id', accountId)
      .maybeSingle()

    let fallbackData = { ...DEFAULT_PROFILE, business_name: account?.name || '' }

    if (account?.internal_notes) {
      try {
        const parsed = JSON.parse(account.internal_notes)
        if (parsed && typeof parsed === 'object' && parsed._is_business_profile) {
          fallbackData = { ...fallbackData, ...parsed }
        }
      } catch {
        // internal_notes was not JSON, ignore
      }
    }

    return NextResponse.json({ profile: fallbackData })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const profileData: BusinessProfileData = {
      business_name: typeof body.business_name === 'string' ? body.business_name.trim() : '',
      tagline: typeof body.tagline === 'string' ? body.tagline.trim() : '',
      category: typeof body.category === 'string' ? body.category.trim() : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      website_url: typeof body.website_url === 'string' ? body.website_url.trim() : '',
      support_email: typeof body.support_email === 'string' ? body.support_email.trim() : '',
      support_phone: typeof body.support_phone === 'string' ? body.support_phone.trim() : '',
      operating_hours: typeof body.operating_hours === 'string' ? body.operating_hours.trim() : '',
      address: typeof body.address === 'string' ? body.address.trim() : '',
      booking_url: typeof body.booking_url === 'string' ? body.booking_url.trim() : '',
      sync_to_ai: body.sync_to_ai !== false,
    }

    // Update account name if business_name is set
    if (profileData.business_name) {
      await supabase
        .from('accounts')
        .update({ name: profileData.business_name })
        .eq('id', accountId)
    }

    // Try saving to business_profiles table
    let savedToTable = false
    try {
      const { error: upsertErr } = await supabase
        .from('business_profiles')
        .upsert(
          {
            account_id: accountId,
            ...profileData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' },
        )

      if (!upsertErr) {
        savedToTable = true
      }
    } catch {
      // Table may not exist yet
    }

    // Also persist into accounts.internal_notes as a guaranteed fallback
    const fallbackPayload = JSON.stringify({
      _is_business_profile: true,
      ...profileData,
    })

    await supabase
      .from('accounts')
      .update({ internal_notes: fallbackPayload })
      .eq('id', accountId)

    // Sync to AI System Prompt if requested
    if (profileData.sync_to_ai) {
      try {
        const { data: aiConfig } = await supabase
          .from('ai_configs')
          .select('system_prompt')
          .eq('account_id', accountId)
          .maybeSingle()

        if (aiConfig) {
          const promptHeader = `[Business Profile: ${profileData.business_name || 'Business'}]
Category: ${profileData.category || 'General'}
About: ${profileData.description || 'N/A'}
Hours: ${profileData.operating_hours || 'N/A'}
Contact: ${profileData.support_email || ''} ${profileData.support_phone || ''}
Booking / Appointment URL: ${profileData.booking_url || 'N/A'}`

          let newPrompt = aiConfig.system_prompt || ''
          const profileTagRegex = /\[Business Profile:[\s\S]*?Booking \/ Appointment URL:[^\n]*/i

          if (profileTagRegex.test(newPrompt)) {
            newPrompt = newPrompt.replace(profileTagRegex, promptHeader)
          } else {
            newPrompt = `${promptHeader}\n\n${newPrompt}`.trim()
          }

          await supabase
            .from('ai_configs')
            .update({ system_prompt: newPrompt, updated_at: new Date().toISOString() })
            .eq('account_id', accountId)
        }
      } catch (aiErr) {
        console.error('[business-profile] sync to AI error:', aiErr)
      }
    }

    return NextResponse.json({
      success: true,
      savedToTable,
      profile: profileData,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

