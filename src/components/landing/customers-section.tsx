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
        <SectionPill label="Customers" count={4} bgClass="bg-[#D4F5E3]" dotClass="bg-[#1FD27A]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              New messages from
              <br />
              <HighlightBubble bgClass="bg-[#1FD27A]">happy teams.</HighlightBubble>
            </h2>
          </div>

          <div className="grid grid-cols-[1.25fr_1fr] max-[1100px]:grid-cols-1 gap-5 mt-14">
            {/* Featured Quote */}
            <div className="bg-[#1FD27A] rounded-[24px] p-11 max-[720px]:px-[26px] max-[720px]:py-[30px] flex flex-col justify-between gap-9">
              <q className={`${DISPLAY_FONT} text-[clamp(28px,3.4vw,46px)] tracking-[-0.035em] leading-[1.08] font-semibold [quotes:none]`}>
                We moved support out of three apps. First reply time went from hours to minutes in
                the first week.
              </q>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0E1512] text-white grid place-items-center font-bold text-[13px] shrink-0">
                  NP
                </div>
                <div>
                  <b className="block text-[15.5px] leading-[1.2]">Nisha Patel</b>
                  <small className={`${MONO_FONT} text-[12px]`}>
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
                  className={`${q.bgClass} border-[1.5px] border-[#0E1512] rounded-[20px_20px_20px_4px] px-6 py-[22px]`}
                >
                  <p className="text-[16px] leading-[1.5]">{q.text}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-[34px] h-[34px] rounded-full bg-[#0E1512] text-white grid place-items-center font-bold text-[11px] shrink-0">
                      {q.initials}
                    </div>
                    <div>
                      <b className="block text-[14px] leading-[1.2]">{q.name}</b>
                      <small className={`${MONO_FONT} text-[12px]`}>{q.role}</small>
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

