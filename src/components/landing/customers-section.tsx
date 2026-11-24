import React from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

const QUOTES = [
  {
    text: 'The comment-to-DM flow paid for the subscription by itself. Instagram leads roughly tripled.',
    initials: 'VS',
    name: 'Vikram Singh',
    role: 'Founder, Lumen',
    bgClass: 'bg-white',
  },
  {
    text: 'Our marketing team builds automations without asking engineering. The rule sentences just make sense.',
    initials: 'TA',
    name: 'Tara Ahmed',
    role: 'Growth lead, Orbitly',
    bgClass: 'bg-[#F3EFFF]',
  },
  {
    text: 'Finally a CRM that fills itself in. Every chat becomes a clean contact record with no typing.',
    initials: 'DJ',
    name: 'Dev Joshi',
    role: 'Sales director, Haveli',
    bgClass: 'bg-[#FFF6DD]',
  },
]

export function CustomersSection() {
  return (
    <section id="customers" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Customers" count={4} />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              New messages from
              <br />
              <HighlightBubble bgClass="bg-[var(--accent-primary)] text-[#30245A]">happy teams.</HighlightBubble>
            </h2>
          </div>

          <div className="grid grid-cols-[1.25fr_1fr] max-[1100px]:grid-cols-1 gap-5 mt-14">
            {/* Featured Quote */}
            <div className="bg-[var(--brand-primary)] text-white rounded-[20px] p-11 max-[720px]:px-[26px] max-[720px]:py-[30px] flex flex-col justify-between gap-9 shadow-[var(--shadow-brand)]">
              <q className={`${DISPLAY_FONT} text-[clamp(28px,3.4vw,42px)] tracking-[-0.035em] leading-[1.12] font-semibold [quotes:none] text-white`}>
                We moved support out of three apps. First reply time went from hours to minutes in
                the first week.
              </q>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] text-[#30245A] grid place-items-center font-bold text-[13px] shrink-0">
                  NP
                </div>
                <div>
                  <b className="block text-[15.5px] leading-[1.2] text-white">Nisha Patel</b>
                  <small className={`${MONO_FONT} text-[12px] text-[var(--footer-text)]`}>
                    Head of CX, Kindred · via WhatsApp
                  </small>
                </div>
              </div>
            </div>

            {/* Smaller Quotes Column */}
            <div className="grid gap-4">
              {QUOTES.map((q) => (
                <div
                  key={q.name}
                  className="bg-white border border-[var(--border)] rounded-[18px] px-6 py-[22px] shadow-[var(--shadow-card)]"
                >
                  <p className="text-[16px] leading-[1.5] text-[var(--text-body)]">{q.text}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-[34px] h-[34px] rounded-full bg-[var(--surface-green)] text-[var(--brand-primary)] grid place-items-center font-bold text-[11px] shrink-0">
                      {q.initials}
                    </div>
                    <div>
                      <b className="block text-[14px] leading-[1.2] text-[var(--text-heading)]">{q.name}</b>
                      <small className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>{q.role}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

