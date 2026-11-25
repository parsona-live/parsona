'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SHIMMER_OUTLINE, SHIMMER_PRIMARY } from './shared'
import { EASE, FadeUp, TextReveal, useDownScrollReveal } from './motion'
import { InboxConsoleDemo } from './inbox-console-demo'
import { ShimmerLink } from '@/components/ui/shimmer-button'
import { RibbonFieldGradient } from '@/components/ui/ribbon-field-gradient'

export function HeroSection() {
  const {
    ref: proofBarRef,
    isVisible: proofBarVisible,
    instant: proofBarInstant,
  } = useDownScrollReveal<HTMLDivElement>(true)

  return (
    <section className="relative pt-14 pb-10 max-[720px]:pt-10 overflow-hidden bg-[var(--background)]">
      {/* Animated Parsona Ribbon Field Gradient + Architectural Grid (Hero header only, fades clean before dashboard preview) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 inset-x-0 h-[650px] max-[720px]:h-[580px] overflow-hidden"
      >
        <RibbonFieldGradient />

        {/* Soft Forest Green & Lavender ambient corner accents inside hero stage */}
        <div
          className="absolute top-[190px] -left-[120px] w-[480px] h-[440px] rounded-full blur-[110px] opacity-22 max-[720px]:opacity-14"
          style={{
            background:
              'radial-gradient(circle, rgba(11,59,46,0.9) 0%, rgba(24,121,78,0.35) 48%, transparent 74%)',
          }}
        />
        <div
          className="absolute top-[110px] -right-[110px] w-[500px] h-[440px] rounded-full blur-[110px] opacity-45 max-[720px]:opacity-25"
          style={{
            background:
              'radial-gradient(circle, #CFC3FF 0%, rgba(185,166,245,0.45) 48%, transparent 74%)',
          }}
        />

        {/* Masked architectural hairline grid */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(11,59,46,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,59,46,0.045) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 80% 65% at 50% 24%, #000 18%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 65% at 50% 24%, #000 18%, transparent 100%)',
          }}
        />

        {/* Minimal geometric orbital arcs & alignment ticks */}
        <svg
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1360px] h-[560px] opacity-55 max-[980px]:opacity-25"
          viewBox="0 0 1360 560"
          fill="none"
        >
          <circle cx="680" cy="270" r="290" stroke="#D4D8DF" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="680" cy="270" r="430" stroke="#D4D8DF" strokeWidth="1" />
          <path d="M230 120h12M236 114v12" stroke="#9FC2B4" strokeWidth="1.2" />
          <path d="M1118 140h12M1124 134v12" stroke="#B9A6F5" strokeWidth="1.2" />
          <circle cx="970" cy="270" r="3.5" fill="#CFC3FF" stroke="#43336F" strokeWidth="1" />
          <circle cx="390" cy="270" r="3" fill="#FFFFFF" stroke="#0B3B2E" strokeWidth="1.2" />
        </svg>

        {/* Smooth top highlight & bottom transition into solid #EBEDF1 above dashboard console */}
        <div
          className="absolute inset-x-0 top-0 h-20"
          style={{
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-48"
          style={{
            background:
              'linear-gradient(to bottom, rgba(235,237,241,0) 0%, rgba(235,237,241,0.78) 58%, #EBEDF1 100%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        {/* Centered Hero Copy Stack */}
        <div className="max-w-[860px] mx-auto text-center">
          <FadeUp trigger="mount" delay={0.04} distance={14}>
            <div
              className={`inline-flex items-center gap-2.5 ${MONO_FONT} font-medium text-[12px] tracking-[0.03em] text-[var(--brand-primary)] bg-white/92 backdrop-blur-sm border border-[var(--border)] rounded-full pl-2 pr-3.5 py-[5px] mb-6 shadow-[var(--shadow-card)]`}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-lavender)] text-[var(--accent-text)] px-2 py-[2px] text-[10.5px] font-semibold tracking-[0.05em]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-65" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--success)]" />
                </span>
                LIVE
              </span>
              <span>WhatsApp · Instagram · Facebook · Voice AI</span>
            </div>
          </FadeUp>

          <h1
            className={`${DISPLAY_FONT} text-[clamp(38px,4.8vw,62px)] font-bold tracking-[-0.045em] leading-[1.09] text-[var(--text-heading)]`}
          >
            <TextReveal text="The AI communication layer" trigger="mount" delay={0.08} />
            <br />
            <HighlightBubble
              bgClass="bg-[var(--accent-primary)]/85 border border-[var(--accent-hover)]/50 text-[#261A4D] shadow-[0_10px_28px_-10px_rgba(185,166,245,0.65)]"
              trigger="mount"
              delay={0.22}
            >
              for your business
            </HighlightBubble>
          </h1>

          <FadeUp trigger="mount" delay={0.32} distance={16}>
            <p className="mt-6 text-[18px] max-[720px]:text-[16.5px] text-[var(--text-body)] max-w-[695px] mx-auto leading-[1.6] text-pretty">
              Parsona brings WhatsApp, Instagram, Facebook and phone calls into one shared team
              inbox. AI agents handle customer messages and calls, while your team can manage
              leads, collaborate and automate follow-ups using built-in CRM and workflow
            </p>
          </FadeUp>

          <FadeUp trigger="mount" delay={0.42} distance={16}>
            <div className="flex items-center justify-center gap-3.5 flex-wrap mt-8">
              <ShimmerLink
                href="#waitlist"
                {...SHIMMER_PRIMARY}
                borderRadius="9999px"
                className="h-[52px] pl-6 pr-2.5 gap-3 font-semibold text-[15px] shadow-[var(--shadow-brand)]"
              >
                <span>Join the waitlist</span>
                <span
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[#30245A] grid place-items-center text-[15px] font-bold"
                >
                  →
                </span>
              </ShimmerLink>
              <ShimmerLink
                href="#inbox-demo"
                {...SHIMMER_OUTLINE}
                borderRadius="9999px"
                className={`${SHIMMER_OUTLINE.className} !h-[52px] !pl-3.5 !pr-6 !gap-2.5`}
              >
                <span
                  aria-hidden="true"
                  className="w-6 h-6 rounded-full bg-[var(--surface-green)] text-[var(--brand-primary)] grid place-items-center"
                >
                  <svg width="9" height="10" viewBox="0 0 10 12" fill="currentColor">
                    <path d="M1.5 1.2L9 6l-7.5 4.8V1.2z" />
                  </svg>
                </span>
                <span>Try the interactive demo</span>
              </ShimmerLink>
            </div>
          </FadeUp>

          <FadeUp trigger="mount" delay={0.5} distance={12}>
            <p
              className={`mt-5 inline-flex items-center justify-center gap-2 flex-wrap ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
              <span>Early access opening soon · Priority onboarding for founding teams.</span>
            </p>
          </FadeUp>
        </div>

        {/* Centered Studio Glass Bezel + Interactive Product Console */}
        <FadeUp delay={0.18} distance={28}>
          <div
            id="inbox-demo"
            className="scroll-mt-[88px] mt-11 max-[720px]:mt-8 p-3 max-[720px]:p-1.5 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white ring-1 ring-[#0B3B2E]/10 shadow-[0_32px_80px_-20px_rgba(11,59,46,0.14),0_10px_28px_-10px_rgba(8,8,8,0.06)]"
          >
            <InboxConsoleDemo embedded />
          </div>
        </FadeUp>

        {/* Trust / Waitlist Social Proof Bar */}
        <motion.div
          ref={proofBarRef}
          initial={{ opacity: 0, y: 18 }}
          animate={proofBarVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={proofBarInstant ? { duration: 0 } : { duration: 0.52, ease: EASE }}
          className="mt-10 max-[720px]:mt-8 flex items-center justify-between gap-5 flex-wrap px-6 py-4 max-[720px]:py-5 bg-white border border-[var(--border)] rounded-[16px] shadow-[var(--shadow-card)] max-[720px]:flex-col max-[720px]:items-center max-[720px]:text-center max-[720px]:gap-4"
        >
          <div className="flex items-center gap-4 flex-wrap max-[720px]:flex-col max-[720px]:items-center max-[720px]:gap-3">
            <div className="flex items-center -space-x-[10px]" aria-hidden="true">
              {[
                { initials: 'AS', bg: '#E6F0EC', text: '#0B3B2E' },
                { initials: 'MJ', bg: '#F3F0FF', text: '#43336F' },
                { initials: 'RK', bg: '#F5F6F8', text: '#080808' },
                { initials: 'IV', bg: '#CFC3FF', text: '#30245A' },
                { initials: 'DP', bg: '#0B3B2E', text: '#FFFFFF' },
              ].map((avatar, i) => (
                <motion.span
                  key={avatar.initials}
                  initial={{ opacity: 0, scale: 0.75, x: -8 }}
                  animate={
                    proofBarVisible ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.75, x: -8 }
                  }
                  transition={
                    proofBarInstant ? { duration: 0 } : { duration: 0.38, delay: 0.06 * i, ease: EASE }
                  }
                  className={`w-10 h-10 max-[720px]:w-9 max-[720px]:h-9 rounded-full border-2 border-white grid place-items-center ${MONO_FONT} font-semibold text-[11.5px]`}
                  style={{ backgroundColor: avatar.bg, color: avatar.text }}
                >
                  {avatar.initials}
                </motion.span>
              ))}
            </div>
            <p className="text-[15.5px] max-[720px]:text-[15px] text-[var(--text-secondary)]">
              <strong className="font-semibold text-[var(--text-heading)]">100+ teams</strong> have already
              joined the waitlist
            </p>
          </div>

          <ShimmerLink
            href="#waitlist"
            {...SHIMMER_OUTLINE}
            className={`${SHIMMER_OUTLINE.className} !h-10 !px-[18px] max-[720px]:w-full max-[720px]:!h-11 ${MONO_FONT} !font-medium !text-[13px]`}
          >
            <span>Join them</span>
            <span aria-hidden="true">→</span>
          </ShimmerLink>
        </motion.div>
      </div>
    </section>
  )
}
