'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { BTN_DARK, BTN_OUTLINE, DISPLAY_FONT, HighlightBubble, MONO_FONT } from './shared'
import { EASE, FadeUp, TextReveal, VIEWPORT } from './motion'
import { InboxConsoleDemo } from './inbox-console-demo'

export function HeroSection() {
  return (
    <section className="pt-11">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-center max-[980px]:grid-cols-1 max-[980px]:gap-9">
          {/* Left Copy */}
          <div>
            <div className="relative">
              <FadeUp trigger="mount" delay={0.04} distance={14}>
                <div
                  className={`inline-flex items-center gap-[10px] ${MONO_FONT} font-medium text-[12px] tracking-[0.04em] text-[var(--brand-primary)] bg-white border border-[var(--border)] rounded-full px-3.5 py-[6px] mb-5 shadow-[var(--shadow-card)]`}
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                  WhatsApp · Instagram · Facebook · Calling
                </div>
              </FadeUp>
              <h1
                className={`${DISPLAY_FONT} text-[clamp(40px,4.8vw,64px)] font-bold tracking-[-0.045em] leading-[1.1] text-balance text-[var(--text-heading)]`}
              >
                <TextReveal text="Every message answered." trigger="mount" delay={0.08} />
                <br />
                <TextReveal text="Every lead" trigger="mount" delay={0.22} />{' '}
                <HighlightBubble bgClass="bg-[var(--accent-primary)] text-[#30245A]" trigger="mount" delay={0.34}>
                  followed up.
                </HighlightBubble>
              </h1>
            </div>

            <div className="mt-6">
              <FadeUp trigger="mount" delay={0.36} distance={16}>
                <p className="text-[18px] max-[720px]:text-[17px] text-[var(--text-body)] max-w-[540px] leading-[1.6]">
                  Parsona puts WhatsApp, Instagram, Facebook and soon voice calls into one team inbox,
                  then takes over the repetitive work with broadcasts, a built-in CRM, a flow builder
                  and AI agents that know your catalogue.
                </p>
              </FadeUp>
              <FadeUp trigger="mount" delay={0.46} distance={16}>
                <div className="flex gap-3 flex-wrap mt-7">
                  <motion.a
                    href="#waitlist"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={BTN_DARK}
                  >
                    Join the waitlist →
                  </motion.a>
                  <motion.a
                    href="#platform"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={BTN_OUTLINE}
                  >
                    See it working
                  </motion.a>
                </div>
              </FadeUp>
              <FadeUp trigger="mount" delay={0.54} distance={12}>
                <p className={`mt-4 ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
                  Early access opening soon · Priority onboarding for founding teams.
                </p>
              </FadeUp>
            </div>
          </div>

          {/* Right Animated Message Flow Diagram */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.18, ease: EASE }}
            className="w-full max-w-[460px] ml-auto max-[980px]:mx-auto bg-white [background-image:radial-gradient(#D4D8DF_1px,transparent_1.2px)] [background-size:16px_16px] border border-[var(--border)] rounded-[20px] shadow-[var(--shadow-card)] overflow-hidden"
            role="img"
            aria-label="Diagram: WhatsApp, Instagram, Facebook and upcoming Voice calls flow into the Parsona inbox, CRM, flows and AI agent"
          >
            <svg viewBox="0 0 440 460" aria-hidden="true" className={`block w-full h-auto ${MONO_FONT}`}>
              <defs>
                <linearGradient id="igg" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#FEDA75" />
                  <stop offset="0.25" stopColor="#FA7E1E" />
                  <stop offset="0.5" stopColor="#D62976" />
                  <stop offset="0.75" stopColor="#962FBF" />
                  <stop offset="1" stopColor="#4F5BD5" />
                </linearGradient>
                <clipPath id="fbc">
                  <circle cx="24" cy="24" r="24" />
                </clipPath>
              </defs>

              <text x="24" y="30" className="text-[10.5px] tracking-[0.07em] fill-[#52625A]">
                INCOMING MESSAGES + CALLS
              </text>
              <circle cx="366" cy="26" r="4" fill="#18794E" className="animate-[landing-fblink_1.6s_ease-in-out_infinite]" />
              <text x="376" y="30" className="text-[10.5px] tracking-[0.07em] fill-[#52625A]">
                LIVE
              </text>

              {/* Channel Badges */}
              <g transform="translate(52 44)">
                <rect width="54" height="54" rx="12" fill="#F5F6F8" stroke="#D4D8DF" />
                <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="24" fill="#25D366" />
                  <path
                    transform="translate(9 9) scale(1.25)"
                    fill="#fff"
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                  />
                </svg>
              </g>
              <g transform="translate(146 44)">
                <rect width="54" height="54" rx="12" fill="#F5F6F8" stroke="#D4D8DF" />
                <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                  <rect width="48" height="48" rx="13" fill="url(#igg)" />
                  <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
                  <circle cx="24" cy="24" r="6.5" fill="none" stroke="#fff" strokeWidth="3" />
                  <circle cx="31.5" cy="16.5" r="1.9" fill="#fff" />
                </svg>
              </g>
              <g transform="translate(240 44)">
                <rect width="54" height="54" rx="12" fill="#F5F6F8" stroke="#D4D8DF" />
                <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="24" fill="#1877F2" />
                  <path
                    clipPath="url(#fbc)"
                    d="M26.7 48V30h6l.9-7h-6.9v-4.5c0-2 .6-3.4 3.5-3.4H34V9c-.6-.1-2.8-.3-5.3-.3-5.3 0-8.8 3.2-8.8 9V23h-6v7h6v18z"
                    fill="#fff"
                  />
                </svg>
              </g>
              <g transform="translate(334 44)">
                <rect
                  width="54"
                  height="54"
                  rx="12"
                  fill="#F3F0FF"
                  stroke="#CFC3FF"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <circle cx="27" cy="27" r="17" fill="#CFC3FF" />
                <svg
                  x="18"
                  y="18"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0B3B2E"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                </svg>
              </g>

              <text x="79" y="116" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#52625A]">
                WHATSAPP
              </text>
              <text x="173" y="116" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#52625A]">
                INSTAGRAM
              </text>
              <text x="267" y="116" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#52625A]">
                FACEBOOK
              </text>
              <text x="361" y="114" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#52625A]">
                <tspan x="361" dy="0">CALLING</tspan>
                <tspan x="361" dy="11" className="text-[8px] tracking-[0.05em] font-semibold fill-[#43336F]">
                  (COMING NEXT)
                </tspan>
              </text>

              {/* Animated Connectors */}
              <path d="M79 126V150H140" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M79 126V150H140"
                fill="none"
                stroke="#25D366"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '0s' }}
              />
              <path d="M173 126V150H140" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M173 126V150H140"
                fill="none"
                stroke="#D62976"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '-0.5s' }}
              />
              <path d="M267 126V150H140" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M267 126V150H140"
                fill="none"
                stroke="#1877F2"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '-1s' }}
              />
              <path d="M361 131V150H140" fill="none" stroke="#CFC3FF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M361 131V150H140"
                fill="none"
                stroke="#CFC3FF"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '-1.5s' }}
              />
              <path d="M140 150V202" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 150V202"
                fill="none"
                stroke="#0B3B2E"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '1s' }}
              />

              <circle cx="140" cy="150" r="3.5" fill="#fff" stroke="#ACADB1" strokeWidth="1.5" />
              <rect x="40" y="176" width="360" height="268" rx="12" fill="none" stroke="#D4D8DF" strokeWidth="1.5" />
              <rect x="52" y="169" width="78" height="15" fill="#fff" />
              <text x="60" y="181" className="text-[11.5px] tracking-[0.06em] fill-[#080808]">
                PARSONA
              </text>

              <path d="M140 246V262" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 246V262"
                fill="none"
                stroke="#0B3B2E"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '1.6s' }}
              />
              <path d="M140 306V322" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 306V322"
                fill="none"
                stroke="#0B3B2E"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '2.2s' }}
              />
              <path d="M140 366V382" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 366V382"
                fill="none"
                stroke="#8066A8"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '2.8s' }}
              />

              {/* Nodes */}
              <g transform="translate(118 202)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#0B3B2E"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '0s' }}
                />
                <rect width="44" height="44" rx="11" fill="#0B3B2E" />
                <g transform="translate(10 10)" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 13l3-8h12l3 8v6H3z" />
                  <path d="M3 13h5l1 3h6l1-3h5" />
                </g>
              </g>
              <text x="178" y="221" className="text-[12px] tracking-[0.06em] fill-[#080808] font-medium">
                INBOX
              </text>
              <text x="178" y="237" className="text-[10.5px] fill-[#52625A]">
                One shared thread
              </text>

              <g transform="translate(118 262)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#0B3B2E"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '1s' }}
                />
                <rect width="44" height="44" rx="11" fill="#E6F0EC" stroke="#0B3B2E" strokeWidth="1" />
                <g transform="translate(10 10)" fill="none" stroke="#0B3B2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="5" height="16" rx="1.5" />
                  <rect x="10" y="4" width="5" height="10" rx="1.5" />
                  <rect x="17" y="4" width="4" height="13" rx="1.5" />
                </g>
              </g>
              <text x="178" y="281" className="text-[12px] tracking-[0.06em] fill-[#080808] font-medium">
                CRM
              </text>
              <text x="178" y="297" className="text-[10.5px] fill-[#52625A]">
                Profile + deals
              </text>

              <g transform="translate(118 322)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#0B3B2E"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '2s' }}
                />
                <rect width="44" height="44" rx="11" fill="#F5F6F8" stroke="#D4D8DF" strokeWidth="1" />
                <g transform="translate(10 10)" fill="none" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="12" r="2.5" />
                  <circle cx="18.5" cy="5.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                  <path d="M8 11l8.2-4.3M8 13l8.2 4.3" />
                </g>
              </g>
              <text x="178" y="341" className="text-[12px] tracking-[0.06em] fill-[#080808] font-medium">
                FLOWS
              </text>
              <text x="178" y="357" className="text-[10.5px] fill-[#52625A]">
                Triggers + rules
              </text>

              <g transform="translate(118 382)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#CFC3FF"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '3s' }}
                />
                <rect width="44" height="44" rx="11" fill="#CFC3FF" />
                <g transform="translate(10 10)" fill="none" stroke="#30245A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="8" width="14" height="11" rx="3" />
                  <path d="M12 4v4M9.5 13v1.5M14.5 13v1.5" />
                  <circle cx="12" cy="3.5" r="1" fill="#30245A" />
                </g>
              </g>
              <text x="178" y="401" className="text-[12px] tracking-[0.06em] fill-[#080808] font-medium">
                AI AGENT
              </text>
              <text x="178" y="417" className="text-[10.5px] fill-[#52625A]">
                Replies + handoff
              </text>

              <path d="M312 404H335V224H312" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M312 404H335V224H312"
                fill="none"
                stroke="#0B3B2E"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="10 90"
                className="animate-[landing-fdash_3.6s_linear_infinite]"
                style={{ animationDelay: '3.2s' }}
              />
              <polygon points="304,224 313,219 313,229" fill="#0B3B2E" />
              <text
                transform="translate(358 314) rotate(90)"
                textAnchor="middle"
                className="text-[10.5px] tracking-[0.07em] fill-[#52625A]"
              >
                SHARED CONTEXT
              </text>
            </svg>
          </motion.div>
        </div>

        {/* Interactive Product Console Preview (Desktop & Mobile) */}
        <FadeUp delay={0.12} distance={28}>
          <InboxConsoleDemo />
        </FadeUp>

        {/* Trust / Waitlist Social Proof Bar */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.52, ease: EASE }}
          className="mt-[72px] max-[720px]:mt-12 flex items-center justify-between gap-5 flex-wrap py-[22px] max-[720px]:py-6 border-y border-[var(--border)] max-[720px]:flex-col max-[720px]:items-center max-[720px]:text-center max-[720px]:gap-4"
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

