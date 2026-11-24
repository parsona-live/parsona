'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { BTN_OUTLINE, DISPLAY_FONT, HighlightBubble, MONO_FONT } from './shared'
import { EASE, FadeUp, TextReveal, VIEWPORT } from './motion'
import { InboxConsoleDemo } from './inbox-console-demo'

export function HeroSection() {
  return (
    <section className="relative pt-16 pb-10 max-[720px]:pt-12 overflow-hidden bg-gradient-to-b from-white via-[#F5F6F8] to-[var(--background)]">
      {/* Subtle SaaS Atmospheric & Architectural Background Graphics */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Masked architectural grid */}
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(212,216,223,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,216,223,0.45) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 85% 60% at 50% 18%, #000 18%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 85% 60% at 50% 18%, #000 18%, transparent 100%)',
          }}
        />

        {/* Atmospheric side glows framing the centered console bezel */}
        <div
          className="absolute top-[220px] -left-[120px] w-[520px] h-[680px] rounded-full blur-[120px] opacity-30 max-[720px]:opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(11,59,46,0.9) 0%, rgba(24,121,78,0.45) 45%, transparent 72%)',
          }}
        />
        <div
          className="absolute top-[200px] -right-[120px] w-[540px] h-[680px] rounded-full blur-[120px] opacity-55 max-[720px]:opacity-35"
          style={{
            background:
              'radial-gradient(circle, #CFC3FF 0%, rgba(185,166,245,0.55) 45%, transparent 72%)',
          }}
        />

        {/* Minimal geometric orbital arcs & crosshairs */}
        <svg
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1360px] h-[640px] opacity-60 max-[980px]:opacity-30"
          viewBox="0 0 1360 640"
          fill="none"
        >
          <circle cx="680" cy="300" r="320" stroke="#D4D8DF" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="680" cy="300" r="460" stroke="#D4D8DF" strokeWidth="1" />
          <path d="M210 120h12M216 114v12" stroke="#ACADB1" strokeWidth="1.2" />
          <path d="M1138 140h12M1144 134v12" stroke="#ACADB1" strokeWidth="1.2" />
          <circle cx="1000" cy="300" r="3.5" fill="#CFC3FF" stroke="#43336F" strokeWidth="1" />
          <circle cx="360" cy="300" r="3" fill="#FFFFFF" stroke="#0B3B2E" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        {/* Centered Hero Copy Stack */}
        <div className="max-w-[820px] mx-auto text-center">
          <FadeUp trigger="mount" delay={0.04} distance={14}>
            <div
              className={`inline-flex items-center gap-2.5 ${MONO_FONT} font-medium text-[12px] tracking-[0.04em] text-[var(--brand-primary)] bg-white/90 border border-[var(--border)] rounded-full pl-3 pr-4 py-[6px] mb-6 shadow-[var(--shadow-card)]`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
              </span>
              <span>WhatsApp · Instagram · Facebook · Voice AI</span>
            </div>
          </FadeUp>

          <h1
            className={`${DISPLAY_FONT} text-[clamp(36px,4.5vw,58px)] font-bold tracking-[-0.042em] leading-[1.1] text-[var(--text-heading)]`}
          >
            <TextReveal text="The AI communication layer" trigger="mount" delay={0.08} />
            <br />
            <HighlightBubble
              bgClass="bg-[var(--accent-primary)]/75 text-[#30245A]"
              trigger="mount"
              delay={0.22}
            >
              for your business
            </HighlightBubble>
          </h1>

          <FadeUp trigger="mount" delay={0.32} distance={16}>
            <p className="mt-6 text-[18px] max-[720px]:text-[16.5px] text-[var(--text-body)] max-w-[660px] mx-auto leading-[1.6]">
              Parsona brings WhatsApp, Instagram, Facebook and phone calls into one shared team
              inbox. AI agents handle customer messages and calls, while your team can manage
              leads, collaborate and automate follow-ups using built-in CRM and workflow
            </p>
          </FadeUp>

          <FadeUp trigger="mount" delay={0.42} distance={16}>
            <div className="flex items-center justify-center gap-3.5 flex-wrap mt-8">
              <motion.a
                href="#waitlist"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-3 h-[50px] pl-6 pr-2.5 rounded-full bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] active:bg-[var(--brand-active)] text-white font-semibold text-[15px] transition-colors duration-200 whitespace-nowrap shadow-[var(--shadow-brand)] focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px]"
              >
                <span>Join the waitlist</span>
                <span
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[#30245A] grid place-items-center text-[15px] font-bold"
                >
                  →
                </span>
              </motion.a>
              <motion.a
                href="#inbox-demo"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`${BTN_OUTLINE} !rounded-full !h-[50px] !px-6`}
              >
                Try the interactive demo
              </motion.a>
            </div>
          </FadeUp>

          <FadeUp trigger="mount" delay={0.5} distance={12}>
            <p className={`mt-5 ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
              Early access opening soon · Priority onboarding for founding teams.
            </p>
          </FadeUp>
        </div>

        {/* Centered Frosted Outer Bezel + Interactive Product Console */}
        <FadeUp delay={0.18} distance={28}>
          <div
            id="inbox-demo"
            className="scroll-mt-[88px] mt-12 max-[720px]:mt-9 p-2.5 max-[720px]:p-1.5 rounded-[26px] bg-white/65 backdrop-blur-md border border-white/90 shadow-[0_24px_64px_-16px_rgba(8,8,8,0.14)]"
          >
            <InboxConsoleDemo embedded />
          </div>
        </FadeUp>

        {/* Trust / Waitlist Social Proof Bar */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.52, ease: EASE }}
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
                  whileInView={{ opacity: 1, scale: 1, x: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.38, delay: 0.06 * i, ease: EASE }}
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

          <motion.a
            href="#waitlist"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`${BTN_OUTLINE} !h-10 !px-[18px] max-[720px]:w-full max-[720px]:!h-11 ${MONO_FONT} !font-medium !text-[13px]`}
          >
            <span>Join them</span>
            <span aria-hidden="true">→</span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
