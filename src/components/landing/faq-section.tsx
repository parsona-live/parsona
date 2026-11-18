'use client'

import React from 'react'
import { DISPLAY_FONT, HighlightBubble, SectionPill } from './shared'
import { StaggerGroup, StaggerItem, TextReveal } from './motion'

const FAQ_ITEMS = [
  {
    q: 'Do I need the official WhatsApp Business API?',
    a: 'Yes, and Parsona guides you through it: connect your number, verify your business and get message templates approved. Most teams are sending within a day.',
  },
  {
    q: 'Can I review AI replies before they go out?',
    a: 'You choose per channel: suggestions only, auto-reply on selected topics, or full auto-reply. A person can take over any chat with one click.',
  },
  {
    q: 'Can I bring in my existing contacts?',
    a: 'Upload a CSV or sync from your store. Custom fields and tags are mapped for you, and duplicates are merged into a single timeline.',
  },
  {
    q: 'How is customer data protected?',
    a: 'Data is encrypted in transit and at rest. Role-based access and audit logs come with every plan, and regional hosting is available on Scale.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Questions" count={4} bgClass="bg-[#FFE9A8]" dotClass="bg-[#F2B233]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center mb-10">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              <TextReveal text="Before you" />
              <br />
              <HighlightBubble bgClass="bg-[#FFD97A]" delay={0.18}>
                send the first message.
              </HighlightBubble>
            </h2>
          </div>

          <StaggerGroup className="border-t-[1.5px] border-[#0E1512]" stagger={0.07}>
            {FAQ_ITEMS.map((item) => (
              <StaggerItem key={item.q}>
                <details className="border-b border-[#D9E1DB] py-6">
                  <summary
                    className={`landing-faq-summary cursor-pointer list-none flex justify-between gap-5 items-center ${DISPLAY_FONT} text-[24px] max-[720px]:text-[20px] tracking-[-0.025em] font-semibold leading-[1.15] focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] focus-visible:rounded-lg`}
                  >
                    {item.q}
                  </summary>
                  <p className="mt-[14px] text-[#52625A] text-[17px] max-w-[680px]">{item.a}</p>
                </details>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  )
}

