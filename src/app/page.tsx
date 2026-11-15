import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPageView } from '@/components/landing/landing-page'

export default async function RootPage() {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  // If user is authenticated, redirect directly to dashboard (original behavior)
  if (user) {
    redirect('/dashboard')
  }

  // If guest, render the landing page
  return <LandingPageView user={null} />
}
