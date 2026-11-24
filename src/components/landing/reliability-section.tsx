import React from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

const STATS = [
  { value: '12,000+', label: 'Businesses on Parsona', color: 'text-[var(--brand-primary)]' },
  { value: '50M+', label: 'Messages every month', color: 'text-[var(--accent-text)]' },
  { value: '99.95%', label: 'Uptime over the last year', color: 'text-[var(--success)]' },
  { value: '40+', label: 'Countries served', color: 'text-[var(--text-heading)]' },
]

export function ReliabilitySection() {
  return (
    <section id="reliability" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Reliability" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              Built to stay up when
              <br />
              <HighlightBubble bgClass="bg-[var(--surface-green)] text-[var(--brand-primary)]">sales are on.</HighlightBubble>
            </h2>
          </div>

          <div className="mt-14 bg-white border border-[var(--border)] rounded-[20px] p-8 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-[14px] flex-wrap">
              <b className={`flex items-center gap-[10px] ${DISPLAY_FONT} text-[22px] tracking-[-0.025em] text-[var(--text-heading)]`}>
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)]" />
                All systems operational
              </b>
              <span className={`${MONO_FONT} text-[12.5px] text-[var(--text-secondary)]`}>
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
                    d === 17 || d === 44 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
                  } ${d < 30 ? 'max-[720px]:hidden' : ''}`}
                />
              ))}
            </div>

            <div className={`flex justify-between ${MONO_FONT} text-[11.5px] text-[var(--text-secondary)]`}>
              <span>60 days ago</span>
              <span>Today</span>
            </div>

            <div className="grid grid-cols-4 max-[980px]:grid-cols-2 max-[720px]:grid-cols-1 gap-5 mt-8 pt-7 border-t border-[var(--border)]">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <b
                    className={`block ${DISPLAY_FONT} text-[clamp(32px,4.4vw,48px)] font-bold tracking-[-0.04em] leading-none ${stat.color}`}
                  >
                    {stat.value}
                  </b>
                  <span className="block mt-2 text-[15px] text-[var(--text-secondary)]">{stat.label}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[14.5px] text-[var(--text-secondary)] flex gap-[10px] items-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand-primary)"
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

