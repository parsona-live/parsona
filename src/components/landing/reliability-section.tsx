import React from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

const STATS = [
  { value: '12,000+', label: 'Businesses on Parsona', color: 'text-[#0B8F55]' },
  { value: '50M+', label: 'Messages every month', color: 'text-[#6B4CE6]' },
  { value: '99.95%', label: 'Uptime over the last year', color: 'text-[#D9622B]' },
  { value: '40+', label: 'Countries served', color: 'text-[#2F6FD6]' },
]

export function ReliabilitySection() {
  return (
    <section id="reliability" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Reliability" bgClass="bg-[#D9E6FB]" dotClass="bg-[#4C8DF0]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              Built to stay up when
              <br />
              <HighlightBubble bgClass="bg-[#BBD3FA]">sales are on.</HighlightBubble>
            </h2>
          </div>

          <div className="mt-14 bg-white border-[1.5px] border-[#0E1512] rounded-[24px] p-8">
            <div className="flex items-center justify-between gap-[14px] flex-wrap">
              <b className={`flex items-center gap-[10px] ${DISPLAY_FONT} text-[24px] tracking-[-0.025em]`}>
                <span className="w-2 h-2 rounded-full bg-[#1FD27A] shadow-[0_0_0_3px_rgba(31,210,122,0.25)]" />
                All systems operational
              </b>
              <span className={`${MONO_FONT} text-[12.5px] text-[#52625A]`}>
                Last 60 days · message delivery
              </span>
            </div>

            {/* 60-day Uptime Bars (30 on mobile) */}
            <div
              id="up"
              aria-hidden="true"
              className="grid grid-cols-[repeat(60,1fr)] max-[720px]:grid-cols-[repeat(30,1fr)] gap-[3px] mt-6 mb-2 h-[54px]"
            >
              {Array.from({ length: 60 }).map((_, d) => (
                <i
                  key={d}
                  className={`rounded-[3px] block ${
                    d === 17 || d === 44 ? 'bg-[#F2B233]' : 'bg-[#1FD27A]'
                  } ${d < 30 ? 'max-[720px]:hidden' : ''}`}
                />
              ))}
            </div>

            <div className={`flex justify-between ${MONO_FONT} text-[11.5px] text-[#52625A]`}>
              <span>60 days ago</span>
              <span>Today</span>
            </div>

            <div className="grid grid-cols-4 max-[980px]:grid-cols-2 max-[720px]:grid-cols-1 gap-5 mt-8 pt-7 border-t border-[#D9E1DB]">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <b
                    className={`block ${DISPLAY_FONT} text-[clamp(38px,4.4vw,60px)] font-bold tracking-[-0.05em] leading-none ${stat.color}`}
                  >
                    {stat.value}
                  </b>
                  <span className="block mt-2 text-[15px] text-[#52625A]">{stat.label}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[14.5px] text-[#52625A] flex gap-[10px] items-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0B3B2E"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <path d="M12 3l8 3v6c0 4.5-3.400 8.200-8 9-4.600-.8-8-4.500-8-9V6z" />
              </svg>
              Encryption in transit and at rest, role-based access and audit logs on every plan.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

