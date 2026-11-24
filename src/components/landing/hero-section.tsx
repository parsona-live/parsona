'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { BTN_DARK, BTN_OUTLINE, DISPLAY_FONT, HighlightBubble, MONO_FONT } from './shared'
import { EASE, FadeUp, TextReveal, VIEWPORT } from './motion'
import { InboxConsoleDemo } from './inbox-console-demo'
import { ParsonaLogoMark } from '@/components/ui/parsona-logo'

export function HeroSection() {
  return (
    <section className="relative pt-14 pb-4 max-[980px]:pt-10 overflow-hidden">
      {/* Subtle SaaS Architectural Background Graphics */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Masked architectural grid */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(212,216,223,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,216,223,0.55) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 85% 65% at 50% 22%, #000 20%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 85% 65% at 50% 22%, #000 20%, transparent 100%)',
          }}
        />

        {/* Soft ambient brand glows (Lavender + Forest Green) */}
        <div
          className="absolute -top-28 right-[8%] w-[520px] h-[520px] rounded-full blur-[110px] opacity-45"
          style={{ background: 'radial-gradient(circle, #CFC3FF 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[120px] -left-32 w-[440px] h-[440px] rounded-full blur-[110px] opacity-20"
          style={{ background: 'radial-gradient(circle, #0B3B2E 0%, transparent 72%)' }}
        />

        {/* Minimal geometric vector arcs & crosshairs */}
        <svg
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1360px] h-[640px] opacity-65 max-[980px]:opacity-35"
          viewBox="0 0 1360 640"
          fill="none"
        >
          <circle cx="1020" cy="280" r="240" stroke="#D4D8DF" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="1020" cy="280" r="340" stroke="#D4D8DF" strokeWidth="1" />
          <circle cx="220" cy="180" r="180" stroke="#D4D8DF" strokeWidth="1" strokeDasharray="3 5" />
          {/* Precision crosshairs */}
          <path d="M192 96h12M198 90v12" stroke="#ACADB1" strokeWidth="1.2" />
          <path d="M680 72h12M686 66v12" stroke="#ACADB1" strokeWidth="1.2" />
          <path d="M1248 164h12M1254 158v12" stroke="#ACADB1" strokeWidth="1.2" />
          <circle cx="1020" cy="40" r="3.5" fill="#CFC3FF" stroke="#43336F" strokeWidth="1" />
          <circle cx="780" cy="280" r="3" fill="#FFFFFF" stroke="#0B3B2E" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        <div className="grid grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] gap-10 items-center max-[980px]:grid-cols-1 max-[980px]:gap-10">
          {/* Left Copy */}
          <div>
            <div className="relative">
              <FadeUp trigger="mount" delay={0.04} distance={14}>
                <div
                  className={`inline-flex items-center gap-2.5 ${MONO_FONT} font-medium text-[12px] tracking-[0.04em] text-[var(--brand-primary)] bg-white border border-[var(--border)] rounded-full pl-2.5 pr-3.5 py-[5px] mb-6 shadow-[var(--shadow-card)]`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
                  </span>
                  <span>WhatsApp · Instagram · Facebook · Voice AI</span>
                </div>
              </FadeUp>
              <h1
                className={`${DISPLAY_FONT} text-[clamp(36px,3.8vw,52px)] font-bold tracking-[-0.04em] leading-[1.12] text-[var(--text-heading)]`}
              >
                <TextReveal text="The" trigger="mount" delay={0.08} />{' '}
                <HighlightBubble
                  bgClass="bg-[var(--accent-primary)] text-[#30245A]"
                  trigger="mount"
                  delay={0.18}
                >
                  AI communication
                </HighlightBubble>
                <br />
                <TextReveal text="layer for your business" trigger="mount" delay={0.3} />
              </h1>
            </div>

            <div className="mt-6">
              <FadeUp trigger="mount" delay={0.36} distance={16}>
                <p className="text-[17.5px] max-[720px]:text-[16.5px] text-[var(--text-body)] max-w-[540px] leading-[1.6]">
                  Parsona brings WhatsApp, Instagram, Facebook and phone calls into one shared team
                  inbox. AI agents handle customer messages and calls, while your team can manage
                  leads, collaborate and automate follow-ups using built-in CRM and workflow
                </p>
              </FadeUp>
              <FadeUp trigger="mount" delay={0.46} distance={16}>
                <div className="flex gap-3 flex-wrap mt-8">
                  <motion.a
                    href="#waitlist"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`${BTN_DARK} !h-[46px] !px-6 shadow-[var(--shadow-brand)]`}
                  >
                    Join the waitlist →
                  </motion.a>
                  <motion.a
                    href="#inbox-demo"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`${BTN_OUTLINE} !h-[46px] !px-6`}
                  >
                    Try the interactive demo
                  </motion.a>
                </div>
              </FadeUp>
              <FadeUp trigger="mount" delay={0.54} distance={12}>
                <p className={`mt-5 ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
                  Early access opening soon · Priority onboarding for founding teams.
                </p>
              </FadeUp>
            </div>
          </div>

          {/* Right Animated Monochrome Architecture Card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.18, ease: EASE }}
            className="w-full max-w-[468px] ml-auto max-[980px]:mx-auto bg-white border border-[var(--border)] rounded-[20px] shadow-[var(--shadow-dropdown)] overflow-hidden"
            role="img"
            aria-label="Diagram: WhatsApp, Instagram, Facebook and upcoming Voice calls flow into the Parsona inbox, CRM, flows and AI agent"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#F5F6F8] border-b border-[#D4D8DF]">
              <div className="flex items-center gap-2">
                <ParsonaLogoMark variant="primary" size={22} className="rounded-[6px]" />
                <span className={`${MONO_FONT} text-[10.5px] font-medium tracking-[0.07em] text-[#353536]`}>
                  INCOMING MESSAGES + CALLS
                </span>
              </div>
              <span className={`inline-flex items-center gap-1.5 ${MONO_FONT} text-[10.5px] font-medium px-2.5 py-0.5 rounded-full bg-[#080808] text-white`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-[landing-fblink_1.6s_ease-in-out_infinite]" />
                LIVE
              </span>
            </div>

            <div className="[background-image:radial-gradient(#D4D8DF_1px,transparent_1.2px)] [background-size:16px_16px]">
              <svg viewBox="0 0 440 422" aria-hidden="true" className={`block w-full h-auto ${MONO_FONT}`}>
                {/* Monochrome Channel Badges */}
                <g transform="translate(52 18)">
                  <rect width="54" height="54" rx="12" fill="#FFFFFF" stroke="#D4D8DF" />
                  <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="24" fill="#080808" />
                    <path
                      transform="translate(9 9) scale(1.25)"
                      fill="#FFFFFF"
                      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                    />
                  </svg>
                </g>
                <g transform="translate(146 18)">
                  <rect width="54" height="54" rx="12" fill="#FFFFFF" stroke="#D4D8DF" />
                  <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                    <rect width="48" height="48" rx="13" fill="#353536" />
                    <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#FFFFFF" strokeWidth="3" />
                    <circle cx="24" cy="24" r="6.5" fill="none" stroke="#FFFFFF" strokeWidth="3" />
                    <circle cx="31.5" cy="16.5" r="1.9" fill="#FFFFFF" />
                  </svg>
                </g>
                <g transform="translate(240 18)">
                  <rect width="54" height="54" rx="12" fill="#FFFFFF" stroke="#D4D8DF" />
                  <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="24" fill="#52525B" />
                    <path
                      d="M26.7 48V30h6l.9-7h-6.9v-4.5c0-2 .6-3.4 3.5-3.4H34V9c-.6-.1-2.8-.3-5.3-.3-5.3 0-8.8 3.2-8.8 9V23h-6v7h6v18z"
                      fill="#FFFFFF"
                    />
                  </svg>
                </g>
                <g transform="translate(334 18)">
                  <rect
                    width="54"
                    height="54"
                    rx="12"
                    fill="#F5F6F8"
                    stroke="#ACADB1"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <circle cx="27" cy="27" r="17" fill="#D4D8DF" />
                  <svg
                    x="18"
                    y="18"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#080808"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                  </svg>
                </g>

                <text x="79" y="90" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#353536]">
                  WHATSAPP
                </text>
                <text x="173" y="90" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#353536]">
                  INSTAGRAM
                </text>
                <text x="267" y="90" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#353536]">
                  FACEBOOK
                </text>
                <text x="361" y="88" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#353536]">
                  <tspan x="361" dy="0">CALLING</tspan>
                  <tspan x="361" dy="11" className="text-[7.5px] tracking-[0.04em] font-semibold fill-[#626B65]">
                    (COMING NEXT)
                  </tspan>
                </text>

                {/* Animated Monochrome Connectors */}
                <path d="M79 100V122H106" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M79 100V122H106"
                  fill="none"
                  stroke="#080808"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '0s' }}
                />
                <path d="M173 100V122H106" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M173 100V122H106"
                  fill="none"
                  stroke="#353536"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '-0.5s' }}
                />
                <path d="M267 100V122H106" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M267 100V122H106"
                  fill="none"
                  stroke="#52525B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '-1s' }}
                />
                <path d="M361 106V122H106" fill="none" stroke="#ACADB1" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M361 106V122H106"
                  fill="none"
                  stroke="#71717A"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '-1.5s' }}
                />
                <path d="M106 122V168" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M106 122V168"
                  fill="none"
                  stroke="#080808"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '1s' }}
                />

                <circle cx="106" cy="122" r="3.5" fill="#fff" stroke="#71717A" strokeWidth="1.5" />

                {/* Parsona Monochrome Engine Container */}
                <rect x="28" y="144" width="384" height="260" rx="14" fill="#FFFFFF" fillOpacity="0.94" stroke="#D4D8DF" strokeWidth="1.2" />
                <rect x="42" y="136" width="80" height="16" rx="4" fill="#080808" />
                <text x="82" y="147.5" textAnchor="middle" className="text-[9.5px] tracking-[0.08em] fill-[#FFFFFF] font-medium">
                  PARSONA
                </text>

                {/* Subtle Module Row Cards */}
                <rect x="46" y="162" width="286" height="54" rx="12" fill="#F5F6F8" fillOpacity="0.55" stroke="#EBEDF1" />
                <rect x="46" y="220" width="286" height="54" rx="12" fill="#F5F6F8" fillOpacity="0.55" stroke="#EBEDF1" />
                <rect x="46" y="278" width="286" height="54" rx="12" fill="#F5F6F8" fillOpacity="0.55" stroke="#EBEDF1" />
                <rect x="46" y="336" width="286" height="54" rx="12" fill="#F5F6F8" fillOpacity="0.55" stroke="#EBEDF1" />

                <path d="M106 211V225" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M106 211V225"
                  fill="none"
                  stroke="#080808"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '1.6s' }}
                />
                <path d="M106 269V283" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M106 269V283"
                  fill="none"
                  stroke="#353536"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '2.2s' }}
                />
                <path d="M106 327V341" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M106 327V341"
                  fill="none"
                  stroke="#52525B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="animate-[landing-fdash_2.6s_linear_infinite]"
                  style={{ animationDelay: '2.8s' }}
                />

                {/* Monochrome Nodes */}
                <g transform="translate(84 167)">
                  <rect
                    x="-3"
                    y="-3"
                    width="50"
                    height="50"
                    rx="13"
                    fill="none"
                    stroke="#080808"
                    strokeWidth="1.6"
                    className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                    style={{ animationDelay: '0s' }}
                  />
                  <rect width="44" height="44" rx="11" fill="#080808" />
                  <g transform="translate(10 10)" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 13l3-8h12l3 8v6H3z" />
                    <path d="M3 13h5l1 3h6l1-3h5" />
                  </g>
                </g>
                <text x="142" y="186" className="text-[12px] tracking-[0.05em] fill-[#080808] font-semibold">
                  INBOX
                </text>
                <text x="142" y="202" className="text-[10.5px] fill-[#626B65]">
                  One shared thread
                </text>

                <g transform="translate(84 225)">
                  <rect
                    x="-3"
                    y="-3"
                    width="50"
                    height="50"
                    rx="13"
                    fill="none"
                    stroke="#353536"
                    strokeWidth="1.6"
                    className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                    style={{ animationDelay: '1s' }}
                  />
                  <rect width="44" height="44" rx="11" fill="#353536" />
                  <g transform="translate(10 10)" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="5" height="16" rx="1.5" />
                    <rect x="10" y="4" width="5" height="10" rx="1.5" />
                    <rect x="17" y="4" width="4" height="13" rx="1.5" />
                  </g>
                </g>
                <text x="142" y="244" className="text-[12px] tracking-[0.05em] fill-[#080808] font-semibold">
                  CRM
                </text>
                <text x="142" y="260" className="text-[10.5px] fill-[#626B65]">
                  Profile + deals
                </text>

                <g transform="translate(84 283)">
                  <rect
                    x="-3"
                    y="-3"
                    width="50"
                    height="50"
                    rx="13"
                    fill="none"
                    stroke="#52525B"
                    strokeWidth="1.6"
                    className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                    style={{ animationDelay: '2s' }}
                  />
                  <rect width="44" height="44" rx="11" fill="#FFFFFF" stroke="#D4D8DF" strokeWidth="1" />
                  <g transform="translate(10 10)" fill="none" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="5.5" cy="12" r="2.5" />
                    <circle cx="18.5" cy="5.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                    <path d="M8 11l8.2-4.3M8 13l8.2 4.3" />
                  </g>
                </g>
                <text x="142" y="302" className="text-[12px] tracking-[0.05em] fill-[#080808] font-semibold">
                  FLOWS
                </text>
                <text x="142" y="318" className="text-[10.5px] fill-[#626B65]">
                  Triggers + rules
                </text>

                <g transform="translate(84 341)">
                  <rect
                    x="-3"
                    y="-3"
                    width="50"
                    height="50"
                    rx="13"
                    fill="none"
                    stroke="#080808"
                    strokeWidth="1.6"
                    className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                    style={{ animationDelay: '3s' }}
                  />
                  <rect width="44" height="44" rx="11" fill="#D4D8DF" />
                  <g transform="translate(10 10)" fill="none" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="8" width="14" height="11" rx="3" />
                    <path d="M12 4v4M9.5 13v1.5M14.5 13v1.5" />
                    <circle cx="12" cy="3.5" r="1" fill="#080808" />
                  </g>
                </g>
                <text x="142" y="360" className="text-[12px] tracking-[0.05em] fill-[#080808] font-semibold">
                  AI AGENT
                </text>
                <text x="142" y="376" className="text-[10.5px] fill-[#626B65]">
                  Replies + handoff
                </text>

                <path d="M336 363H374V189H344" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path
                  pathLength={100}
                  d="M336 363H374V189H344"
                  fill="none"
                  stroke="#080808"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="10 90"
                  className="animate-[landing-fdash_3.6s_linear_infinite]"
                  style={{ animationDelay: '3.2s' }}
                />
                <polygon points="337,189 346,184 346,194" fill="#080808" />
                <text
                  transform="translate(390 276) rotate(90)"
                  textAnchor="middle"
                  className="text-[9.5px] tracking-[0.07em] fill-[#52525B]"
                >
                  SHARED CONTEXT
                </text>
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Interactive Product Console Preview (Desktop & Mobile) */}
        <FadeUp delay={0.12} distance={28}>
          <div id="inbox-demo" className="scroll-mt-[88px]">
            <InboxConsoleDemo />
          </div>
        </FadeUp>

        {/* Trust / Waitlist Social Proof Bar */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.52, ease: EASE }}
          className="mt-14 max-[720px]:mt-10 flex items-center justify-between gap-5 flex-wrap px-6 py-4 max-[720px]:py-5 bg-white border border-[var(--border)] rounded-[16px] shadow-[var(--shadow-card)] max-[720px]:flex-col max-[720px]:items-center max-[720px]:text-center max-[720px]:gap-4"
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
