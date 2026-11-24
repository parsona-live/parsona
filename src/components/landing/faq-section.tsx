'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DISPLAY_FONT, HighlightBubble, SectionPill } from './shared'
import { EASE, StaggerGroup, StaggerItem, TextReveal } from './motion'

const FAQ_ITEMS = [
  {
    q: 'When does early access open, and how does the waitlist work?',
    a: 'We onboard founding teams in weekly batches in the order they sign up. Joining the waitlist gives you priority workspace access, hands-on WhatsApp API setup support, and locked-in early-access pricing.',
  },
  {
    q: 'Do I need to pay or add a credit card to join the waitlist?',
    a: 'No. Joining the waitlist is completely free with zero commitment. You only pick a plan once your invite is ready and you have tested Parsona with your own team.',
  },
  {
    q: 'Will my existing WhatsApp Business number work with the official API?',
    a: 'Yes. Parsona connects through the official Meta WhatsApp Business API in about 10 minutes. You can bring an existing business number or set up a new one, with zero risk of unofficial-tool bans.',
  },
  {
    q: 'Can I review or edit AI replies before they go out to customers?',
    a: 'Yes. You choose per channel and per topic: AI draft suggestions only, automatic replies for FAQs like pricing and delivery, or full autopilot. A human teammate can take over any chat with one click.',
  },
  {
    q: 'Are Instagram, Facebook, and the upcoming Voice agent all in one inbox?',
    a: 'Yes. WhatsApp, Instagram DMs, story replies, comment-to-DM flows, and Facebook Messenger all land on one shared customer timeline from day one. Waitlist teams also get first access to Voice AI.',
  },
  {
    q: 'Can I bring in my existing contacts, product catalogue, or CRM data?',
    a: 'Yes. Upload a CSV or sync from your store or spreadsheet. Custom fields, tags, and order history are mapped automatically, and duplicates across channels are merged into one customer record.',
  },
  {
    q: 'How is my business and customer data protected?',
    a: 'All conversations and contact records are encrypted in transit and at rest, powered exclusively by official Meta APIs. Every plan includes role-based team access and audit logs, with regional hosting on Custom plans.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill
          label="Questions"
          count={FAQ_ITEMS.length}
        />

        <div>
          <div className="max-w-[820px] mx-auto text-center mb-10">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="Before you" />
              <br />
              <HighlightBubble bgClass="bg-[var(--surface-green)] text-[var(--brand-primary)]" delay={0.18}>
                join the waitlist.
              </HighlightBubble>
            </h2>
          </div>

          <StaggerGroup className="bg-white border border-[var(--border)] rounded-[18px] px-8 max-[720px]:px-5 shadow-[var(--shadow-card)]" stagger={0.06}>
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx
              return (
                <StaggerItem key={item.q}>
                  <div className={`${idx > 0 ? 'border-t border-[var(--border)]' : ''} py-6`}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                      className={`w-full text-left cursor-pointer flex justify-between gap-5 items-center ${DISPLAY_FONT} text-[20px] max-[720px]:text-[18px] tracking-[-0.02em] font-semibold leading-[1.3] text-[var(--text-heading)] focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px] focus-visible:rounded-lg`}
                    >
                      <span>{item.q}</span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.24, ease: EASE }}
                        aria-hidden="true"
                        className="shrink-0 w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] grid place-items-center text-[20px] font-normal leading-none text-[var(--text-primary)]"
                      >
                        +
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <p className="pt-[14px] text-[var(--text-body)] text-[16px] max-[720px]:text-[15px] max-w-[700px] leading-[1.6]">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerGroup>
        </div>
      </div>
    </section>
  )
}
