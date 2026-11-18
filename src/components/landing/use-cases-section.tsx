'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { BTN_GREEN, DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { EASE, FadeUp, StaggerGroup, StaggerItem, TextReveal } from './motion'

export function UseCasesSection() {
  return (
    <section id="use-cases" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Use cases" count={6} bgClass="bg-[#FFE1D6]" dotClass="bg-[#FF8A5B]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              <TextReveal text="Whatever you sell," />
              <br />
              <HighlightBubble bgClass="bg-[#FFB99A]" delay={0.2}>
                chat is the shop.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.16} distance={14}>
              <p className="mt-5 text-[19px] text-[#52625A] max-w-[560px] mx-auto">
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
            {/* 1. D2C & Retail — Wide Featured Bento Card (7 cols) */}
            <StaggerItem className="col-span-7 max-[980px]:col-span-1 flex">
              <article className="group flex-1 grid grid-cols-[1.08fr_1fr] max-[720px]:grid-cols-1 gap-5 bg-white border-[1.5px] border-[#0E1512] rounded-[22px] p-[14px] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#DCE7DF]">
                <div className="relative aspect-[4/3] max-[720px]:aspect-[16/10] h-full min-h-[220px] rounded-[16px] overflow-hidden border border-[#D9E1DB] bg-[#F3F5F0]">
                  <Image
                    src="/images/use-cases/d2c-retail.jpg"
                    alt="Boutique owner packing cotton kurta orders in a sunlit retail studio"
                    fill
                    unoptimized
                    sizes="(max-width: 980px) 100vw, 40vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-col justify-between py-2 pr-2 max-[720px]:px-2">
                  <div>
                    <span
                      className={`inline-block ${MONO_FONT} font-medium text-[11px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full bg-[#D4F5E3] text-[#0B5F37] mb-3`}
                    >
                      Commerce
                    </span>
                    <h3
                      className={`${DISPLAY_FONT} text-[28px] max-[720px]:text-[24px] font-bold tracking-[-0.035em] leading-[1.05] mb-2.5`}
                    >
                      D2C and retail
                    </h3>
                    <p className="text-[#52625A] text-[15.5px] leading-[1.55]">
                      Catalogue on WhatsApp, abandoned cart recovery, instant COD confirmations and
                      live shipping updates in one thread.
                    </p>
                  </div>
                  <div className="flex gap-[6px] flex-wrap mt-5">
                    {['Cart recovery', 'COD verify', 'Order updates'].map((chip) => (
                      <span
                        key={chip}
                        className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#DCE7DF] text-[#0B3B2E]`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </StaggerItem>

            {/* 2. Real Estate — Interactive Property Card Bento (5 cols) */}
            <StaggerItem className="col-span-5 max-[980px]:col-span-1 flex">
              <article className="flex-1 flex flex-col justify-between bg-[#E6F7EE] border-[1.5px] border-[#0E1512] rounded-[22px] p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#0B3B2E]">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-block ${MONO_FONT} font-medium text-[11px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full bg-[#0B3B2E] text-white`}
                    >
                      High-ticket leads
                    </span>
                    <span className={`${MONO_FONT} text-[11.5px] text-[#0B5F37]`}>
                      Auto-qualified · 24/7
                    </span>
                  </div>

                  {/* Mini Real Estate WhatsApp Lead Card */}
                  <div className="bg-white border-[1.5px] border-[#0E1512] rounded-[16px] p-3.5 shadow-[4px_4px_0_#1FD27A] mb-5">
                    <div className="flex items-center justify-between gap-2 text-[13px] mb-2">
                      <b className="text-[#0E1512]">3 BHK · Baner Skyview</b>
                      <span className={`${MONO_FONT} text-[11px] px-2 py-0.5 rounded bg-[#D4F5E3] text-[#0B5F37]`}>
                        Hot lead
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[12.5px] text-[#52625A]">
                      <div className="flex items-center justify-between bg-[#F6F8F5] rounded-lg px-2.5 py-1.5">
                        <span>Floorplan &amp; brochure PDF</span>
                        <span className={`${MONO_FONT} text-[11px] text-[#0B5F37]`}>Sent ✓</span>
                      </div>
                      <div className="flex items-center justify-between bg-[#F6F8F5] rounded-lg px-2.5 py-1.5">
                        <span>Site visit · Sat 11:00 AM</span>
                        <span className={`${MONO_FONT} text-[11px] text-[#0B3B2E]`}>Confirmed</span>
                      </div>
                    </div>
                  </div>

                  <h3
                    className={`${DISPLAY_FONT} text-[26px] font-bold tracking-[-0.035em] leading-[1.05] mb-2`}
                  >
                    Real estate
                  </h3>
                  <p className="text-[#2A3731] text-[15px] leading-[1.55]">
                    Capture Meta ad leads, qualify budget and BHK preference, drop brochures on
                    WhatsApp and book site visits automatically.
                  </p>
                </div>

                <div className="flex gap-[6px] flex-wrap mt-4">
                  {['Site visits', 'Brochure drop', 'Lead scoring'].map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-white border border-[#AEE8C9] text-[#0B3B2E]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            </StaggerItem>

            {/* 3. Clinics & Services (4 cols) */}
            <StaggerItem className="col-span-4 max-[980px]:col-span-1 flex">
              <article className="group flex-1 flex flex-col bg-white border-[1.5px] border-[#0E1512] rounded-[22px] pt-[14px] px-[14px] pb-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#DCE7DF]">
                <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden border border-[#D9E1DB] bg-[#F3F5F0]">
                  <Image
                    src="/images/use-cases/clinics-services.jpg"
                    alt="Smiling receptionist holding a tablet at a modern wellness clinic front desk"
                    fill
                    unoptimized
                    sizes="(max-width: 980px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <h3
                  className={`${DISPLAY_FONT} text-[25px] font-bold tracking-[-0.035em] leading-[1.05] mt-5 mx-[10px] mb-2`}
                >
                  Clinics and services
                </h3>
                <p className="mx-[10px] text-[#52625A] text-[15px] flex-1">
                  Bookings, reschedules and appointment reminders on autopilot, with a human one tap
                  away.
                </p>
                <div className="flex gap-[6px] flex-wrap mt-4 mx-[10px]">
                  {['Appointments', 'Reminders'].map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#DCE7DF] text-[#0B3B2E]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            </StaggerItem>

            {/* 4. Agencies (4 cols) */}
            <StaggerItem className="col-span-4 max-[980px]:col-span-1 flex">
              <article className="group flex-1 flex flex-col bg-white border-[1.5px] border-[#0E1512] rounded-[22px] pt-[14px] px-[14px] pb-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#DCE7DF]">
                <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden border border-[#D9E1DB] bg-[#F3F5F0]">
                  <Image
                    src="/images/use-cases/agencies.jpg"
                    alt="Two agency teammates collaborating together at a shared screen in a bright studio"
                    fill
                    unoptimized
                    sizes="(max-width: 980px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <h3
                  className={`${DISPLAY_FONT} text-[25px] font-bold tracking-[-0.035em] leading-[1.05] mt-5 mx-[10px] mb-2`}
                >
                  Agencies
                </h3>
                <p className="mx-[10px] text-[#52625A] text-[15px] flex-1">
                  Run many client brands from one login with separate WhatsApp numbers, roles and
                  reports.
                </p>
                <div className="flex gap-[6px] flex-wrap mt-4 mx-[10px]">
                  {['Multi-brand', 'Roles'].map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#DCE7DF] text-[#0B3B2E]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            </StaggerItem>

            {/* 5. Education & Coaching — Tinted Bento Card (4 cols) */}
            <StaggerItem className="col-span-4 max-[980px]:col-span-1 flex">
              <article className="flex-1 flex flex-col justify-between bg-[#F3EFFF] border-[1.5px] border-[#0E1512] rounded-[22px] p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#CFC3FF]">
                <div>
                  <span
                    className={`inline-block ${MONO_FONT} font-medium text-[11px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full bg-[#CFC3FF] text-[#2A1B66] mb-4`}
                  >
                    EdTech &amp; Institutes
                  </span>

                  {/* Mini Admission Flow Preview */}
                  <div className="bg-white border-[1.5px] border-[#0E1512] rounded-[16px] p-3.5 shadow-[4px_4px_0_#CFC3FF] mb-5 space-y-2">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <b className="text-[#0E1512]">Cohort Inquiry · IG DM</b>
                      <span className={`${MONO_FONT} text-[10.5px] text-[#5C3FD6]`}>AI replied</span>
                    </div>
                    <div className="text-[12.5px] text-[#52625A] bg-[#F8F6FF] rounded-lg px-2.5 py-1.5">
                      Syllabus sent → Demo class booked for Wed 6 PM
                    </div>
                    <div className="flex items-center justify-between text-[11.5px] text-[#52625A]">
                      <span>Fee reminder template</span>
                      <span className={`${MONO_FONT} text-[#0B5F37]`}>Scheduled</span>
                    </div>
                  </div>

                  <h3
                    className={`${DISPLAY_FONT} text-[25px] font-bold tracking-[-0.035em] leading-[1.05] mb-2`}
                  >
                    Coaching &amp; education
                  </h3>
                  <p className="text-[#3A3252] text-[15px] leading-[1.55]">
                    Answer course questions instantly, book counselling calls and automate batch and
                    fee reminders.
                  </p>
                </div>

                <div className="flex gap-[6px] flex-wrap mt-4">
                  {['Admissions', 'Demo calls', 'Fee reminders'].map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-white border border-[#CFC3FF] text-[#2A1B66]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            </StaggerItem>

            {/* 6. Hospitality, Salons & Local Teams — Full-Width Dark Bento Strip (12 cols) */}
            <StaggerItem className="col-span-12 max-[980px]:col-span-1">
              <article className="bg-[#0B3B2E] text-white border-[1.5px] border-[#0E1512] rounded-[22px] p-8 max-[720px]:p-6 shadow-[8px_8px_0_#1FD27A] max-[720px]:shadow-[5px_5px_0_#1FD27A] flex items-center justify-between gap-8 max-[980px]:flex-col max-[980px]:items-start">
                <div className="max-w-[680px]">
                  <span
                    className={`inline-block ${MONO_FONT} font-medium text-[11px] uppercase tracking-[0.07em] px-2.5 py-1 rounded-full bg-[#11503F] text-[#7FE5B2] mb-3`}
                  >
                    Salons · Travel · Automotive · Local teams
                  </span>
                  <h3
                    className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold tracking-[-0.035em] leading-[1.08]`}
                  >
                    Built for every service business that closes on chat.
                  </h3>
                  <p className="text-[#B6D6C8] text-[15.5px] mt-2.5 leading-[1.55]">
                    Whether you confirm salon slots, share travel itineraries, book test drives or
                    collect Google reviews — Parsona keeps every follow-up moving automatically.
                  </p>
                  <div className="flex gap-2 flex-wrap mt-4">
                    {['Rebooking', 'Itineraries', 'Test drives', 'Review links'].map((chip) => (
                      <span
                        key={chip}
                        className={`${MONO_FONT} font-medium text-[12px] px-[10px] py-1 rounded-[7px] bg-[#11503F] border border-[#1B6A55] text-[#D4F5E3]`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                <motion.a
                  href="#waitlist"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className={`${BTN_GREEN} shrink-0 max-[720px]:w-full`}
                >
                  Join the waitlist →
                </motion.a>
              </article>
            </StaggerItem>
          </StaggerGroup>
        </div>
      </div>
    </section>
  )
}
