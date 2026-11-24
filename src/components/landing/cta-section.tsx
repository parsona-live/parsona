'use client'

import React from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SHIMMER_OUTLINE, SHIMMER_PRIMARY } from './shared'
import { FadeUp, StaggerGroup, StaggerItem, TextReveal } from './motion'
import { ShimmerLink } from '@/components/ui/shimmer-button'

const ONBOARDING_STEPS = [
  {
    num: '1',
    bg: '#0B3B2E',
    text: '#FFFFFF',
    title: 'Connect your number',
    desc: 'We guide you through the official setup.',
    time: '10 min',
  },
  {
    num: '2',
    bg: '#CFC3FF',
    text: '#30245A',
    title: 'Import your contacts',
    desc: 'CSV upload or store sync, duplicates merged.',
    time: '5 min',
  },
  {
    num: '3',
    bg: '#E6F0EC',
    text: '#0B3B2E',
    title: 'Switch on your first flow',
    desc: 'Start from a ready-made template.',
    time: 'Today',
  },
]

export function CtaSection() {
  return (
    <section className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        <FadeUp distance={26}>
          <div
            className="grid grid-cols-[1.15fr_1fr] max-[1100px]:grid-cols-1 gap-12 items-center p-14 max-[1100px]:px-8 max-[1100px]:py-10 max-[720px]:px-[22px] max-[720px]:py-[30px] bg-white border border-[var(--border)] rounded-[24px] shadow-[var(--shadow-card)] overflow-hidden"
          >
          <div>
            <div className="flex items-center mb-[26px]">
              <span className="inline-flex w-[42px] h-[42px] rounded-full bg-white border-2 border-white -mr-2 shadow-[0_0_0_1px_var(--border)] items-center justify-center overflow-hidden">
                <svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
                  <circle cx="24" cy="24" r="24" fill="#25D366" />
                  <path
                    d="M24 11a13 13 0 00-11.200 19.600L11.500 36l5.600-1.500A13 13 0 1024 11z"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                  />
                </svg>
              </span>
              <span className="inline-flex w-[42px] h-[42px] rounded-full bg-white border-2 border-white -mr-2 shadow-[0_0_0_1px_var(--border)] items-center justify-center overflow-hidden">
                <svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
                  <rect width="48" height="48" rx="13" fill="url(#igg)" />
                  <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
                  <circle cx="24" cy="24" r="6.5" fill="none" stroke="#fff" strokeWidth="3" />
                </svg>
              </span>
              <span className="inline-flex w-[42px] h-[42px] rounded-full bg-white border-2 border-white -mr-2 shadow-[0_0_0_1px_var(--border)] items-center justify-center overflow-hidden">
                <svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
                  <circle cx="24" cy="24" r="24" fill="#1877F2" />
                  <path
                    clipPath="url(#fbc)"
                    d="M26.700 48V30h6l.9-7h-6.900v-4.500c0-2 .6-3.400 3.500-3.400H34V9c-.6-.1-2.800-.3-5.300-.3-5.300 0-8.800 3.200-8.800 9V23h-6v7h6v18z"
                    fill="#fff"
                  />
                </svg>
              </span>
              <span
                className={`inline-flex items-center justify-center rounded-full ml-[18px] px-[14px] py-[7px] ${MONO_FONT} font-medium text-[12px] bg-[var(--surface-lavender)] text-[var(--accent-text)]`}
              >
                + AI, CRM, flows
              </span>
            </div>

            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.3vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="Start with one number." />
              <br />
              <HighlightBubble bgClass="bg-[var(--surface-green)] text-[var(--brand-primary)]" delay={0.22}>
                Grow to every channel.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.18} distance={14}>
              <p className="mt-5 max-w-[520px] text-[var(--text-body)] text-[18px] max-[720px]:text-[17px] leading-[1.6]">
                Connect WhatsApp in about 10 minutes, then add Instagram, Facebook and soon voice
                calls when you are ready.
              </p>
            </FadeUp>
            <div className="flex gap-3 flex-wrap mt-[30px]">
              <ShimmerLink href="#waitlist" {...SHIMMER_PRIMARY}>
                Join the waitlist →
              </ShimmerLink>
              <ShimmerLink href="#pricing" {...SHIMMER_OUTLINE}>
                View plans
              </ShimmerLink>
            </div>
            <div className="flex gap-[10px] flex-wrap mt-6">
              {['Early access soon', 'Priority onboarding', 'Official WhatsApp API'].map((item) => (
                <span
                  key={item}
                  className={`inline-flex items-center gap-2 ${MONO_FONT} font-medium text-[12px] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-body)] rounded-full px-3 py-[6px]`}
                >
                  <i className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-[18px] px-7 py-6 max-[720px]:p-5">
            <h4 className={`${MONO_FONT} font-medium text-[12px] tracking-[0.07em] uppercase text-[var(--text-secondary)] mb-[6px]`}>
              What happens next
            </h4>
            <StaggerGroup stagger={0.09} delay={0.1}>
              {ONBOARDING_STEPS.map((step, idx) => (
                <StaggerItem
                  key={step.num}
                  className={`grid grid-cols-[40px_1fr_auto] max-[720px]:grid-cols-[40px_1fr] gap-[14px] items-center py-4 ${
                    idx > 0 ? 'border-t border-[var(--border)]' : ''
                  }`}
                >
                  <span
                    className={`w-10 h-10 rounded-[10px] grid place-items-center ${MONO_FONT} font-semibold text-[15px]`}
                    style={{ backgroundColor: step.bg, color: step.text }}
                  >
                    {step.num}
                  </span>
                  <div>
                    <b className={`block ${DISPLAY_FONT} text-[18px] font-semibold tracking-[-0.02em] leading-[1.2] text-[var(--text-heading)]`}>
                      {step.title}
                    </b>
                    <small className="text-[var(--text-secondary)] text-[14px]">{step.desc}</small>
                  </div>
                  <em className={`max-[720px]:hidden ${MONO_FONT} font-medium text-[11.5px] not-italic bg-white border border-[var(--border)] rounded-full px-[10px] py-1 text-[var(--brand-primary)]`}>
                    {step.time}
                  </em>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </div>
        </FadeUp>
      </div>
    </section>
  )
}

