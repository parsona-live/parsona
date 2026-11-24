'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill, SHIMMER_OUTLINE, SHIMMER_PRIMARY } from './shared'
import { EASE, FadeUp, TextReveal, VIEWPORT } from './motion'
import { ShimmerLink } from '@/components/ui/shimmer-button'

interface PricingTier {
  name: string
  monthlyPrice?: string
  yearlyPrice?: string
  customHeadline?: string
  highlight: string
  description: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  popular?: boolean
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    monthlyPrice: '₹1,499',
    yearlyPrice: '₹1,199',
    highlight: '2,000 contacts · 1 WhatsApp number',
    description: 'For solo founders and small shops starting with WhatsApp automation.',
    features: [
      '1 official WhatsApp Business number',
      'Up to 3 team members in shared inbox',
      '2,000 contacts with tags & notes',
      'Basic rule-based flow automations',
      'Order & delivery template updates',
      'Email support & standard onboarding',
    ],
    ctaLabel: 'Join the Waitlist',
    ctaHref: '#waitlist',
  },
  {
    name: 'Growth',
    monthlyPrice: '₹4,999',
    yearlyPrice: '₹3,999',
    highlight: '5,000 AI replies · 25,000 contacts',
    description: 'For growing teams handling high volume across WhatsApp, Instagram & Facebook.',
    features: [
      'Everything in Starter',
      '3 WhatsApp numbers + Instagram & Facebook',
      'Up to 10 team members',
      'Full visual flow builder & broadcast campaigns',
      'Built-in CRM pipeline & automated stages',
      'Priority live chat support',
    ],
    ctaLabel: 'Join the Waitlist',
    ctaHref: '#waitlist',
    popular: true,
  },
  {
    name: 'Custom',
    customHeadline: 'Contact sales',
    highlight: 'Unlimited channels & custom AI volume',
    description: 'For agencies, multi-brand businesses, and complex custom workflows.',
    features: [
      'Unlimited WhatsApp, Instagram & Facebook',
      'Unlimited team members & contacts',
      'Full flow builder, webhooks & API access',
      'CRM pipeline with custom objects',
      'Multi-brand workspace & custom integrations',
      'Dedicated account manager & SLA',
    ],
    ctaLabel: 'Contact Sales',
    ctaHref: '#waitlist',
  },
]

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand-primary)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 mt-[3px]"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <section id="pricing" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Pricing" count={3} />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="Pick a plan." />
              <br />
              <HighlightBubble bgClass="bg-[var(--accent-primary)] text-[#30245A]" delay={0.18}>
                Change it any time.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.16} distance={14}>
              <p className="mt-5 text-[18px] max-[720px]:text-[17px] text-[var(--text-body)] max-w-[560px] mx-auto leading-[1.6]">
                Early-access waitlist pricing in INR — lock in founding-team rates before public launch.
              </p>
            </FadeUp>
          </div>

          {/* Monthly / Yearly Toggle with sliding layout pill */}
          <FadeUp delay={0.2} distance={14} className="flex flex-col items-center mt-7">
            <div
              className="relative flex w-fit mx-auto border border-[var(--border)] rounded-[12px] p-1 bg-white shadow-[var(--shadow-card)]"
              role="group"
              aria-label="Billing period"
            >
              <button
                id="b-m"
                type="button"
                aria-pressed={!isYearly}
                onClick={() => setIsYearly(false)}
                className={`relative z-10 border-0 h-[38px] px-[18px] rounded-[8px] font-semibold text-[14px] cursor-pointer transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px] ${
                  !isYearly ? 'text-white' : 'text-[var(--text-secondary)]'
                }`}
              >
                {!isYearly && (
                  <motion.span
                    layoutId="pricing-billing-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-[8px] bg-[var(--brand-primary)]"
                  />
                )}
                Monthly
              </button>
              <button
                id="b-y"
                type="button"
                aria-pressed={isYearly}
                onClick={() => setIsYearly(true)}
                className={`relative z-10 border-0 h-[38px] px-[18px] rounded-[8px] font-semibold text-[14px] cursor-pointer transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px] ${
                  isYearly ? 'text-white' : 'text-[var(--text-secondary)]'
                }`}
              >
                {isYearly && (
                  <motion.span
                    layoutId="pricing-billing-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-[8px] bg-[var(--brand-primary)]"
                  />
                )}
                Yearly
                <em
                  className={`${MONO_FONT} font-medium text-[11px] not-italic ml-[6px] ${
                    isYearly ? 'text-[var(--accent-primary)]' : 'text-[var(--success)]'
                  }`}
                >
                  save 20%
                </em>
              </button>
            </div>
            <span className={`mt-3 ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
              PRICES IN INR{isYearly ? ' · BILLED ANNUALLY' : ''}
            </span>
          </FadeUp>

          {/* 3-Column Pricing Cards with internal element-by-element choreography */}
          <div className="mt-12 grid grid-cols-3 max-[980px]:grid-cols-1 gap-6 items-stretch">
            {PRICING_TIERS.map((tier, cardIndex) => {
              const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice
              const baseDelay = cardIndex * 0.1

              return (
                <motion.article
                  key={tier.name}
                  initial="hidden"
                  whileInView="visible"
                  viewport={VIEWPORT}
                  variants={{
                    hidden: { opacity: 0, y: 28, scale: 0.98 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        duration: 0.5,
                        delay: baseDelay,
                        ease: EASE,
                        when: 'beforeChildren',
                      },
                    },
                  }}
                  className={`relative flex flex-col rounded-[18px] p-8 max-[720px]:p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 bg-white ${
                    tier.popular
                      ? 'border-[1.5px] border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/15 shadow-[var(--shadow-brand)]'
                      : 'border border-[var(--border)] shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {tier.popular && (
                    <motion.span
                      variants={{
                        hidden: { opacity: 0, y: -10, scale: 0.9 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: { duration: 0.4, ease: EASE },
                        },
                      }}
                      className={`absolute -top-[13px] left-7 inline-block ${MONO_FONT} font-semibold text-[11px] tracking-[0.07em] uppercase bg-[var(--accent-primary)] text-[#30245A] rounded-full px-3 py-[4px] shadow-xs`}
                    >
                      Most popular
                    </motion.span>
                  )}

                  {/* Tier Title */}
                  <motion.h3
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.36, ease: EASE },
                      },
                    }}
                    className={`${DISPLAY_FONT} text-[22px] font-semibold tracking-[-0.025em] text-[var(--text-heading)]`}
                  >
                    {tier.name}
                  </motion.h3>

                  {/* Price / Custom Headline */}
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.4, delay: 0.06, ease: EASE },
                      },
                    }}
                    className="mt-3 flex items-baseline gap-2 flex-wrap"
                  >
                    {price ? (
                      <>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={price}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.22, ease: EASE }}
                            className={`${DISPLAY_FONT} text-[44px] font-bold tracking-[-0.04em] leading-none text-[var(--text-heading)] tabular-nums inline-block`}
                          >
                            {price}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-[14px] text-[var(--text-secondary)] font-medium">/ month</span>
                        {isYearly && tier.monthlyPrice && (
                          <span className={`${MONO_FONT} text-[12px] text-[var(--text-muted)] line-through ml-1`}>
                            {tier.monthlyPrice}
                          </span>
                        )}
                      </>
                    ) : (
                      <span
                        className={`${DISPLAY_FONT} text-[34px] font-bold tracking-[-0.035em] leading-[1.1] text-[var(--text-heading)]`}
                      >
                        {tier.customHeadline}
                      </span>
                    )}
                  </motion.div>

                  {/* Highlight Metric */}
                  <motion.p
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.36, delay: 0.1, ease: EASE },
                      },
                    }}
                    className="mt-3 text-[15px] font-semibold text-[var(--brand-primary)]"
                  >
                    {tier.highlight}
                  </motion.p>

                  {/* Short Description */}
                  <motion.p
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.36, delay: 0.14, ease: EASE },
                      },
                    }}
                    className="mt-2 text-[14.5px] leading-[1.5] text-[var(--text-secondary)] min-h-[44px]"
                  >
                    {tier.description}
                  </motion.p>

                  {/* Feature List with Sequential Row Choreography */}
                  <motion.ul
                    variants={{
                      hidden: {},
                      visible: {
                        transition: {
                          delayChildren: 0.16,
                          staggerChildren: 0.05,
                        },
                      },
                    }}
                    className="mt-6 flex-1 border-t border-[var(--border)]"
                  >
                    {tier.features.map((feature) => (
                      <motion.li
                        key={feature}
                        variants={{
                          hidden: { opacity: 0, x: -12 },
                          visible: {
                            opacity: 1,
                            x: 0,
                            transition: { duration: 0.34, ease: EASE },
                          },
                        }}
                        className="flex items-start gap-3 py-[13px] border-b border-[var(--border)] text-[14.5px] leading-[1.45] text-[var(--text-body)]"
                      >
                        <CheckIcon />
                        <span>{feature}</span>
                      </motion.li>
                    ))}
                  </motion.ul>

                  {/* Bottom CTA Button */}
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.38, delay: 0.32, ease: EASE },
                      },
                    }}
                    className="mt-7 pt-1"
                  >
                    <ShimmerLink
                      href={tier.ctaHref}
                      {...(tier.popular ? SHIMMER_PRIMARY : SHIMMER_OUTLINE)}
                      className={`${tier.popular ? SHIMMER_PRIMARY.className : SHIMMER_OUTLINE.className} w-full`}
                    >
                      {tier.ctaLabel}
                    </ShimmerLink>
                  </motion.div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
