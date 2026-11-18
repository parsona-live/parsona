import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LandingPageView } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'Parsona | WhatsApp, Instagram and Facebook conversations, automated',
  description: 'Parsona brings WhatsApp, Instagram and Facebook into one team inbox with broadcasts, a built-in CRM, a flow builder and AI agents.',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1500 1500'%3E%3Crect width='1500' height='1500' rx='360' fill='%230B3B2E'/%3E%3Cpath fill='%23EEEDEA' d='M993.83 764.91c-24.5-9.52-50.62-14.14-76.9-14.14H765.31v286.47c0-158.22-128.27-286.47-286.49-286.47v-.02c79.11 0 150.73-32.06 202.57-83.91 51.86-51.83 83.92-123.45 83.92-202.56 0 1.89.02 3.77.05 5.65 4 206.65 270.38 287.33 391.4 119.78 2.95-4.08 5.82-8.23 8.6-12.44C1098.67 423.63 946.06 315.95 768.16 314.81 526.88 313.27 329.36 509.47 329.36 750.75c0 240.77 195.18 435.97 435.95 435.97 183.95 0 341.29-113.93 405.31-275.09-41.24-66.17-103.19-118.11-176.79-146.72Z'/%3E%3C/svg%3E",
  },
}

export default async function RootPage() {
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
