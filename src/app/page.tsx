import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LandingPageView } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'Parsona | WhatsApp, Instagram and Facebook conversations, automated',
  description: 'Parsona brings WhatsApp, Instagram and Facebook into one team inbox with broadcasts, a built-in CRM, a flow builder and AI agents.',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'%3E%3Crect width='100' height='100' rx='22' fill='%23080808'/%3E%3Cpath d='M62 71v-3c0-.39-.08-.78-.23-1.15-.15-.36-.37-.69-.65-.97-.28-.28-.61-.5-.97-.65-.37-.15-.76-.23-1.15-.23H47c-3.98 0-7.79-1.58-10.61-4.39C33.58 57.79 32 53.98 32 50c0-1.97.39-3.92 1.14-5.74.75-1.82 1.86-3.47 3.25-4.87 1.39-1.39 3.05-2.5 4.87-3.25C43.08 35.39 45.03 35 47 35h12c.39 0 .78-.08 1.15-.23.36-.15.69-.37.97-.65.28-.28.5-.61.65-.97.15-.36.23-.76.23-1.15v-3H47c-2.76 0-5.49.54-8.04 1.6-2.55 1.05-4.86 2.6-6.81 4.55-1.95 1.95-3.5 4.27-4.55 6.81C26.54 44.51 26 47.24 26 50c0 5.57 2.21 10.91 6.15 14.85C36.09 68.79 41.43 71 47 71h15Z' fill='%23CFC3FF'/%3E%3Cpath d='M38 50c0 2.39.95 4.68 2.63 6.36 1.69 1.69 3.98 2.64 6.37 2.64h15c1.59 0 3.12.63 4.24 1.76 1.13 1.13 1.76 2.65 1.76 4.24v6h6v-6c0-3.18-1.26-6.23-3.51-8.49C68.23 54.26 65.18 53 62 53H47c-.8 0-1.56-.32-2.12-.88A3 3 0 0 1 44 50c0-.8.32-1.56.88-2.12A3 3 0 0 1 47 47h14.77c3.18 0 6.46-1.26 8.71-3.51C72.74 41.23 74 38.18 74 35v-6h-6v6c0 1.59-.63 3.12-1.76 4.24A6 6 0 0 1 62 41H47c-1.18 0-2.35.23-3.45.68-1.09.45-2.08 1.12-2.92 1.96-.84.84-1.5 1.83-1.95 2.92A9 9 0 0 0 38 50Z' fill='%23CFC3FF'/%3E%3C/svg%3E",
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
