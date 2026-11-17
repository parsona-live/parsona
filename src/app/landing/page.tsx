import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LandingPageView } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'Parsona | WhatsApp, Instagram and Facebook conversations, automated',
  description: 'Parsona brings WhatsApp, Instagram and Facebook into one team inbox with broadcasts, a built-in CRM, a flow builder and AI agents.',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%231FD27A'/%3E%3Cpath d='M11 25V7h8a5.500 5.500 0 010 11h-8' fill='none' stroke='%230E1512' stroke-width='3.400' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
  },
}

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
