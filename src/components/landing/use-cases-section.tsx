'use client'

import React from 'react'
import Image from 'next/image'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill, SHIMMER_ACCENT } from './shared'
import { FadeUp, StaggerGroup, StaggerItem, TextReveal } from './motion'
import { ShimmerLink } from '@/components/ui/shimmer-button'

const ROW_TWO_CARDS = [
  {
    title: 'Clinics and services',
    description:
      'Bookings, reschedules and appointment reminders on autopilot, with a human one tap away.',
    image: '/images/use-cases/clinics-services.jpg',
    alt: 'Smiling receptionist holding a tablet at a modern wellness clinic front desk',
    chips: ['Appointments', 'Reminders'],
  },
  {
    title: 'Agencies',
    description:
      'Run many client brands from one login with separate WhatsApp numbers, roles and reports.',
    image: '/images/use-cases/agencies.jpg',
    alt: 'Two agency teammates collaborating together at a shared screen in a bright studio',
    chips: ['Multi-brand', 'Roles'],
  },
  {
    title: 'Coaching & education',
    description:
      'Answer course questions instantly, book counselling calls and automate batch and fee reminders.',
    image: '/images/use-cases/coaching-education.jpg',
    alt: 'Mentor guiding students over laptops in a bright modern coaching studio',
    chips: ['Admissions', 'Demo calls', 'Fee reminders'],
  },
]

export function UseCasesSection() {
  return (
    <section id="use-cases" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Use cases" count={6} />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="Whatever you sell," />
              <br />
              <HighlightBubble bgClass="bg-[var(--accent-primary)] text-[#30245A]" delay={0.2}>
                chat is the shop.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.16} distance={14}>
              <p className="mt-5 text-[18px] max-[720px]:text-[17px] text-[var(--text-body)] max-w-[560px] mx-auto leading-[1.6]">
                Parsona fits how real businesses already talk to customers — from D2C and real
                estate to clinics, agencies and coaching teams.
              </p>
            </FadeUp>
          </div>

          {/* 6-Card Responsive Bento Grid */}
          <StaggerGroup
            stagger={0.08}
            className="grid grid-cols-12 max-[980px]:grid-cols-1 gap-5 mt-14"
          >
            {/* 1. D2C & Retail — Wide Horizontal Split Bento Card (7 cols) */}
            <StaggerItem className="col-span-7 max-[980px]:col-span-1 flex">
              <article className="group flex-1 grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] max-[720px]:grid-cols-1 gap-5 bg-white border border-[var(--border)] rounded-[18px] p-[14px] overflow-hidden shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-dropdown)]">
                <div className="relative w-full h-full min-h-[260px] max-[720px]:min-h-0 max-[720px]:aspect-[4/3] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
                  <Image
                    src="/images/use-cases/d2c-retail.jpg"
                    alt="Boutique owner packing cotton kurta orders in a sunlit retail studio"
                    fill
                    unoptimized
                    sizes="(max-width: 980px) 100vw, 40vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="min-w-0 flex flex-col justify-between py-2 pr-2 max-[720px]:px-2">
                  <div>
                    <span
                      className={`inline-block ${MONO_FONT} font-medium text-[11px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full bg-[var(--surface-green)] text-[var(--brand-primary)] mb-3`}
                    >
                      Commerce
                    </span>
                    <h3
                      className={`${DISPLAY_FONT} text-[26px] max-[720px]:text-[22px] font-semibold tracking-[-0.03em] leading-[1.15] mb-2.5 text-[var(--text-heading)]`}
                    >
                      D2C and retail
                    </h3>
                    <p className="text-[var(--text-secondary)] text-[15px] leading-[1.55]">
                      Catalogue on WhatsApp, abandoned cart recovery, instant COD confirmations and
                      live shipping updates in one thread.
                    </p>
                  </div>
                  <div className="flex gap-[6px] flex-wrap mt-5">
                    {['Cart recovery', 'COD verify', 'Order updates'].map((chip) => (
                      <span
                        key={chip}
                        className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[8px] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-body)]`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </StaggerItem>

            {/* 2. Real Estate — Featured Photo Bento Card (5 cols) */}
            <StaggerItem className="col-span-5 max-[980px]:col-span-1 flex">
              <article className="group flex-1 flex flex-col bg-[var(--surface-green)] border border-[var(--border)] rounded-[18px] pt-[14px] px-[14px] pb-6 overflow-hidden shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-dropdown)]">
                <div className="relative w-full aspect-[16/10] rounded-[12px] overflow-hidden border border-[var(--border)] bg-white">
                  <Image
                    src="/images/use-cases/real-estate.jpg"
                    alt="Sunlit modern architectural apartment living room for real estate listings"
                    fill
                    unoptimized
                    sizes="(max-width: 980px) 100vw, 38vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span
                    className={`absolute top-3 left-3 inline-flex items-center gap-1.5 ${MONO_FONT} font-medium text-[10.5px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full bg-[var(--brand-primary)]/92 text-white backdrop-blur-[4px]`}
                  >
                    <i className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                    Auto-qualified · 24/7
                  </span>
                </div>
                <h3
                  className={`${DISPLAY_FONT} text-[24px] font-semibold tracking-[-0.03em] leading-[1.15] mt-5 mx-[10px] mb-2 text-[var(--text-heading)]`}
                >
                  Real estate
                </h3>
                <p className="mx-[10px] text-[var(--text-body)] text-[15px] leading-[1.55] flex-1">
                  Capture Meta ad leads, qualify budget and BHK preference, drop brochures on
                  WhatsApp and book site visits automatically.
                </p>
                <div className="flex gap-[6px] flex-wrap mt-4 mx-[10px]">
                  {['Site visits', 'Brochure drop', 'Lead scoring'].map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[8px] bg-white border border-[var(--border)] text-[var(--brand-primary)]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            </StaggerItem>

            {/* 3, 4, 5. Clinics, Agencies, Coaching & Education (4 cols each) */}
            {ROW_TWO_CARDS.map((card) => (
              <StaggerItem key={card.title} className="col-span-4 max-[980px]:col-span-1 flex">
                <article className="group flex-1 flex flex-col bg-white border border-[var(--border)] rounded-[18px] pt-[14px] px-[14px] pb-6 overflow-hidden shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-dropdown)]">
                  <div className="relative w-full aspect-[4/3] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
                    <Image
                      src={card.image}
                      alt={card.alt}
                      fill
                      unoptimized
                      sizes="(max-width: 980px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <h3
                    className={`${DISPLAY_FONT} text-[22px] font-semibold tracking-[-0.03em] leading-[1.15] mt-5 mx-[10px] mb-2 text-[var(--text-heading)]`}
                  >
                    {card.title}
                  </h3>
                  <p className="mx-[10px] text-[var(--text-secondary)] text-[15px] leading-[1.55] flex-1">
                    {card.description}
                  </p>
                  <div className="flex gap-[6px] flex-wrap mt-4 mx-[10px]">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[8px] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-body)]`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </article>
              </StaggerItem>
            ))}

            {/* 6. Salons, Travel, Automotive & Local Teams — Full-Width Dark Bento Strip (12 cols) */}
            <StaggerItem className="col-span-12 max-[980px]:col-span-1">
              <article className="bg-[var(--footer-background)] text-white border border-[var(--footer-border)] rounded-[20px] p-8 max-[720px]:p-6 shadow-[var(--shadow-brand)] flex items-center justify-between gap-8 max-[980px]:flex-col max-[980px]:items-start">
                <div className="max-w-[680px]">
                  <span
                    className={`inline-block ${MONO_FONT} font-medium text-[11px] uppercase tracking-[0.07em] px-2.5 py-1 rounded-full bg-[var(--footer-surface)] text-[var(--accent-primary)] mb-3`}
                  >
                    Salons · Travel · Automotive · Local teams
                  </span>
                  <h3
                    className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,30px)] font-semibold tracking-[-0.03em] leading-[1.15] text-white`}
                  >
                    Built for every service business that closes on chat.
                  </h3>
                  <p className="text-[var(--footer-text)] text-[15.5px] mt-2.5 leading-[1.55]">
                    Whether you confirm salon slots, share travel itineraries, book test drives or
                    collect Google reviews — Parsona keeps every follow-up moving automatically.
                  </p>
                  <div className="flex gap-2 flex-wrap mt-4">
                    {['Rebooking', 'Itineraries', 'Test drives', 'Review links'].map((chip) => (
                      <span
                        key={chip}
                        className={`${MONO_FONT} font-medium text-[12px] px-[10px] py-1 rounded-[8px] bg-[var(--footer-surface)] border border-[var(--footer-border)] text-[var(--footer-links)]`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                <ShimmerLink
                  href="#waitlist"
                  {...SHIMMER_ACCENT}
                  className={`${SHIMMER_ACCENT.className} shrink-0 max-[720px]:w-full`}
                >
                  Join the waitlist →
                </ShimmerLink>
              </article>
            </StaggerItem>
          </StaggerGroup>
        </div>
      </div>
    </section>
  )
}
