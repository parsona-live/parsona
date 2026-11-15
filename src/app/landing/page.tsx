import { createClient } from '@/lib/supabase/server'
import { LandingPageView } from '@/components/landing/landing-page'

export default async function LandingRoute() {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  return <LandingPageView user={user} />
}

