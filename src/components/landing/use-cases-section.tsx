import React from 'react'
import Image from 'next/image'
import { BTN_GREEN, DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

const USE_CASES = [
  {
    title: 'D2C and retail',
    description: 'Catalogue on WhatsApp, cart recovery, COD confirmations and shipping updates.',
    image: '/images/use-cases/d2c-retail.jpg',
    alt: 'Boutique owner packing cotton kurta orders in a sunlit retail studio',
    chips: ['Cart recovery', 'Order updates'],
  },
  {
    title: 'Clinics and services',
    description: 'Bookings, reschedules and reminders on autopilot, with a human one tap away.',
    image: '/images/use-cases/clinics-services.jpg',
    alt: 'Smiling receptionist holding a tablet at a modern wellness clinic front desk',
    chips: ['Appointments', 'Reminders'],
  },
  {
    title: 'Agencies',
    description: 'Run many brands from one login with separate numbers, roles and reports.',
    image: '/images/use-cases/agencies.jpg',
    alt: 'Two agency teammates collaborating together at a shared screen in a bright studio',
    chips: ['Multi-brand', 'Roles'],
  },
]

export function UseCasesSection() {
  return (
    <section id="use-cases" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Use cases" count={3} bgClass="bg-[#FFE1D6]" dotClass="bg-[#FF8A5B]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              Whatever you sell,
              <br />
              <HighlightBubble bgClass="bg-[#FFB99A]">chat is the shop.</HighlightBubble>
            </h2>
            <p className="mt-5 text-[19px] text-[#52625A] max-w-[560px] mx-auto">
              Parsona fits how real businesses already talk to customers.
            </p>
          </div>

          <div className="grid grid-cols-3 max-[1100px]:grid-cols-1 gap-5 mt-14">
            {USE_CASES.map((item) => (
              <article
                key={item.title}
                className="group bg-white border-[1.5px] border-[#0E1512] rounded-[22px] pt-[14px] px-[14px] pb-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#DCE7DF]"
              >
                <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden border border-[#D9E1DB] bg-[#F3F5F0]">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    unoptimized
                    sizes="(max-width: 1100px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <h3 className={`${DISPLAY_FONT} text-[26px] font-bold tracking-[-0.035em] leading-[1.02] mt-5 mx-[10px] mb-2`}>
                  {item.title}
                </h3>
                <p className="mx-[10px] text-[#52625A] text-[15.5px]">{item.description}</p>
                <div className="flex gap-[6px] flex-wrap mt-4 mx-[10px]">
                  {item.chips.map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#DCE7DF] text-[#0B3B2E]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {/* 90-second Video Card */}
          <div className="mt-5 grid grid-cols-[1.4fr_1fr] max-[1100px]:grid-cols-1 rounded-[24px] overflow-hidden bg-[#0B3B2E] text-white">
            <div
              className={`relative aspect-video border-r-[1.5px] max-[1100px]:border-r-0 border-dashed border-[#5E8F7E] grid place-items-center text-center p-4 text-[#B6D6C8] ${MONO_FONT} font-medium text-[12px] leading-[1.5]`}
              style={{
                background: 'repeating-linear-gradient(135deg, #0F4A3A 0 14px, #11503F 14px 28px)',
              }}
            >
              <div>
                <span className="w-[68px] h-[68px] rounded-full bg-[#1FD27A] grid place-items-center mx-auto mb-3 shadow-[0_0_0_10px_rgba(31,210,122,0.2)]">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#0E1512" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                VIDEO 16:9
                <br />
                90-second product walkthrough
              </div>
            </div>
            <div className="p-9 max-[720px]:px-[22px] max-[720px]:py-[26px] self-center">
              <h3 className={`${DISPLAY_FONT} text-[clamp(26px,3vw,38px)] font-bold tracking-[-0.035em] leading-[1.02]`}>
                See it in 90 seconds.
              </h3>
              <p className="text-[#B6D6C8] mt-3 mb-[22px]">
                From first Instagram comment to a paid WhatsApp order, no tab switching.
              </p>
              <a href="#pricing" className={BTN_GREEN}>
                Start free trial
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

