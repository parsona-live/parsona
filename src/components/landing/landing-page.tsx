'use client'

import React from 'react'
import { MotionConfig } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import './landing-theme.css'
import { Navbar } from './navbar'
import { HeroSection } from './hero-section'
import { ChannelsSection } from './channels-section'
import { PlatformSection } from './platform-section'
import { AutomationSection } from './automation-section'
import { UseCasesSection } from './use-cases-section'
//import { ReliabilitySection } from './reliability-section'
//import { CustomersSection } from './customers-section'
import { PricingSection } from './pricing-section'
import { FaqSection } from './faq-section'
import { WaitlistSection } from './waitlist-section'
import { CtaSection } from './cta-section'
import { Footer } from './footer'

interface LandingPageViewProps {
  user?: User | null
}

export const LandingPageView: React.FC<LandingPageViewProps> = () => {
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page-root w-full min-h-screen bg-[#F3F5F0] text-[#0E1512] [font-family:var(--font-body)] text-[16px] leading-[1.55] antialiased overflow-x-hidden">
        <Navbar />

        <main id="top">
          <HeroSection />
          <ChannelsSection />
          <PlatformSection />
          <AutomationSection />
          <UseCasesSection />
          <PricingSection />
          <FaqSection />
          <WaitlistSection />
          <CtaSection />
        </main>

        <Footer />
      </div>
    </MotionConfig>
  )
}
