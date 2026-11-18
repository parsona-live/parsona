'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { EASE, FadeUp, TextReveal, VIEWPORT } from './motion'

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
      stroke="#1B6A55"
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
        <SectionPill label="Pricing" count={3} bgClass="bg-[#E5DEFF]" dotClass="bg-[#7C5CFF]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              <TextReveal text="Pick a plan." />
              <br />
              <HighlightBubble bgClass="bg-[#CFC3FF]" delay={0.18}>
                Change it any time.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.16} distance={14}>
              <p className="mt-5 text-[19px] text-[#52625A] max-w-[560px] mx-auto">
                Early-access waitlist pricing in INR — lock in founding-team rates before public launch.
              </p>
            </FadeUp>
          </div>

          {/* Monthly / Yearly Toggle with sliding layout pill */}
          <FadeUp delay={0.2} distance={14} className="flex flex-col items-center mt-7">
            <div
              className="relative flex w-fit mx-auto border-[1.5px] border-[#0E1512] rounded-[12px] p-1 bg-white"
              role="group"
              aria-label="Billing period"
            >
              <button
                id="b-m"
                type="button"
                aria-pressed={!isYearly}
                onClick={() => setIsYearly(false)}
                className={`relative z-10 border-0 h-[38px] px-[18px] rounded-lg font-semibold text-[14.5px] cursor-pointer transition-colors focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] ${
                  !isYearly ? 'text-white' : 'text-[#0E1512]'
                }`}
              >
                {!isYearly && (
                  <motion.span
                    layoutId="pricing-billing-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-lg bg-[#0E1512]"
                  />
                )}
                Monthly
              </button>
              <button
                id="b-y"
                type="button"
                aria-pressed={isYearly}
                onClick={() => setIsYearly(true)}
                className={`relative z-10 border-0 h-[38px] px-[18px] rounded-lg font-semibold text-[14.5px] cursor-pointer transition-colors focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] ${
                  isYearly ? 'text-white' : 'text-[#0E1512]'
                }`}
              >
                {isYearly && (
                  <motion.span
                    layoutId="pricing-billing-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-lg bg-[#0E1512]"
                  />
                )}
                Yearly
                <em
                  className={`${MONO_FONT} font-medium text-[11px] not-italic ml-[6px] ${
                    isYearly ? 'text-[#1FD27A]' : 'text-[#1B6A55]'
                  }`}
                >
                  save 20%
                </em>
              </button>
            </div>
            <span className={`mt-3 ${MONO_FONT} text-[12px] text-[#52625A]`}>
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
                  className={`relative flex flex-col rounded-[22px] p-8 max-[720px]:p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 ${
                    tier.popular
                      ? 'border-[1.5px] border-[#0B3B2E] shadow-[0_14px_34px_-12px_rgba(11,59,46,0.18)]'
                      : 'bg-white border border-[#D9E1DB] shadow-[0_8px_24px_-14px_rgba(14,21,18,0.12)] hover:border-[#0E1512]'
                  }`}
                  style={
                    tier.popular
                      ? {
                          background:
                            'linear-gradient(180deg, #D5F5E4 0%, #EEFAF3 34%, #FFFFFF 70%)',
                        }
                      : undefined
                  }
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
                      className={`absolute -top-[14px] left-7 inline-block ${MONO_FONT} font-medium text-[11px] tracking-[0.08em] uppercase bg-[#0B2A20] text-white rounded-[7px] px-3 py-[5px] shadow-sm`}
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
                    className={`${DISPLAY_FONT} text-[22px] font-semibold tracking-[-0.025em] text-[#0E1512]`}
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
                            className={`${DISPLAY_FONT} text-[46px] font-bold tracking-[-0.045em] leading-none text-[#0E1512] tabular-nums inline-block`}
                          >
                            {price}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-[14px] text-[#52625A] font-medium">/ month</span>
                        {isYearly && tier.monthlyPrice && (
                          <span className={`${MONO_FONT} text-[12px] text-[#7B8A82] line-through ml-1`}>
                            {tier.monthlyPrice}
                          </span>
                        )}
                      </>
                    ) : (
                      <span
                        className={`${DISPLAY_FONT} text-[36px] font-bold tracking-[-0.04em] leading-[1.1] text-[#0E1512]`}
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
                    className="mt-3 text-[16px] font-semibold text-[#11503F]"
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
                    className="mt-2 text-[14.5px] leading-[1.5] text-[#52625A] min-h-[44px]"
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
                    className="mt-6 flex-1 border-t border-[#E4EAE6]"
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
                        className="flex items-start gap-3 py-[13px] border-b border-[#E4EAE6] text-[14.5px] leading-[1.45] text-[#1E2B25]"
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
                    <motion.a
                      href={tier.ctaHref}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full inline-flex items-center justify-center h-12 px-5 rounded-[12px] font-semibold text-[15px] transition-[background-color,color,border-color] duration-200 focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] ${
                        tier.popular
                          ? 'bg-[#0B3B2E] text-white border-[1.5px] border-[#0B3B2E] hover:bg-[#11503F]'
                          : 'bg-white text-[#0E1512] border border-[#C9D4CD] hover:border-[#0E1512] hover:bg-[#0E1512] hover:text-white'
                      }`}
                    >
                      {tier.ctaLabel}
                    </motion.a>
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
