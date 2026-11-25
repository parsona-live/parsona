'use client'

import React, { useState } from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { FadeUp, TextReveal, useDownScrollReveal } from './motion'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type ChannelName = 'WhatsApp' | 'Instagram' | 'Facebook' | 'Voice'

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#0B3B2E',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const CHANNELS: {
  name: ChannelName
  description: string
  borderClass: string
  iconBg: string
  soon?: boolean
  icon: React.ReactNode
}[] = [
  {
    name: 'WhatsApp',
    description:
      'Official Business API with approved templates, appointment reminders, service lists and click-to-chat links.',
    borderClass: 'border-l-[4px] border-l-[var(--brand-primary)]',
    iconBg: 'bg-[var(--surface-green)]',
    icon: (
      <svg {...iconProps}>
        <path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 20.5l1.7-5.5A8.4 8.4 0 1121 11.5z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    description:
      'DMs, story replies and comment-to-DM flows that start the moment someone types a keyword.',
    borderClass: 'border-l-[4px] border-l-[var(--border-dark)]',
    iconBg: 'bg-[var(--surface-secondary)]',
    icon: (
      <svg {...iconProps} stroke="#080808">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="#080808" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    description:
      'Messenger, page comments and click-to-Messenger ad replies, routed to the right teammate.',
    borderClass: 'border-l-[4px] border-l-[var(--text-secondary)]',
    iconBg: 'bg-[var(--surface-secondary)]',
    icon: (
      <svg {...iconProps} stroke="#080808">
        <path d="M12 3C6.8 3 3 6.6 3 11.2c0 2.6 1.3 4.8 3.3 6.3V21l3.2-1.8c.8.2 1.6.3 2.5.3 5.2 0 9-3.6 9-8.2S17.2 3 12 3z" />
      </svg>
    ),
  },
  {
    name: 'Voice',
    description:
      'A voice AI agent that answers calls, books and reschedules, then hands off to your team. Every call is saved on the same customer record.',
    borderClass: 'border-l-[4px] border-l-[var(--accent-primary)]',
    iconBg: 'bg-[var(--surface-lavender)]',
    soon: true,
    icon: (
      <svg {...iconProps} stroke="#43336F">
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
      </svg>
    ),
  },
]

const TAGS: Record<ChannelName, { dot: string; tag: string }> = {
  Instagram: { dot: 'bg-[#080808]', tag: 'bg-[var(--surface-secondary)] text-[var(--text-body)]' },
  WhatsApp: { dot: 'bg-[#25D366]', tag: 'bg-[var(--surface-green)] text-[var(--brand-primary)]' },
  Facebook: { dot: 'bg-[#1877F2]', tag: 'bg-[var(--info-bg)] text-[var(--info)]' },
  Voice: { dot: 'bg-[var(--accent-primary)]', tag: 'bg-[var(--surface-lavender)] text-[var(--accent-text)]' },
}

const TIMELINE_EVENTS: {
  channel: ChannelName
  time: string
  preview?: boolean
  body: React.ReactNode
}[] = [
  {
    channel: 'Instagram',
    time: 'Mon 10:12',
    body: (
      <>
        Commented <em className="not-italic font-semibold">“SMILE”</em> on the whitening offer. A flow
        moved the chat to WhatsApp.
      </>
    ),
  },
  {
    channel: 'Instagram',
    time: 'Mon 10:14',
    body: 'Asked for a check-up slot. AI offered Thursday 4 pm on WhatsApp.',
  },
  {
    channel: 'WhatsApp',
    time: 'Mon 18:40',
    body: (
      <>
        Booked a <em className="not-italic font-semibold">cleaning</em> for Thursday 4 pm and paid the
        advance by UPI.
      </>
    ),
  },
  {
    channel: 'WhatsApp',
    time: 'Wed 09:05',
    body: 'Appointment reminder sent with an approved template.',
  },
  {
    channel: 'Facebook',
    time: 'Fri 11:30',
    body: 'Commented "Loved it!" on the clinic page post. A flow sent a review link.',
  },
  {
    channel: 'Voice',
    time: 'Sat 14:20',
    preview: true,
    body: 'Called to reschedule. The voice agent booked Monday 11 am and saved the call summary here.',
  },
]

/* ------------------------------------------------------------------ */
/* Animation helpers                                                   */
/* ------------------------------------------------------------------ */

// Keyframes live here so the component is self-contained.
const KEYFRAMES = `
@keyframes channels-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes channels-pop{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes channels-line{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes channels-ping{0%{transform:scale(.85);opacity:.5}100%{transform:scale(2);opacity:0}}
`

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function ChannelsSection() {
  const { ref: listRef, isVisible: listIn, instant: listInstant } =
    useDownScrollReveal<HTMLUListElement>(true, 0.12)
  const { ref: tlRef, isVisible: tlIn, instant: tlInstant } =
    useDownScrollReveal<HTMLDivElement>(true, 0.12)
  // Hover / tap a channel to spotlight its activity in the timeline.
  const [focus, setFocus] = useState<ChannelName | null>(null)

  const rise = (on: boolean, instant: boolean) =>
    on
      ? instant
        ? 'opacity-100'
        : 'animate-[channels-rise_0.5s_ease-out_both] motion-reduce:animate-none'
      : 'opacity-0 motion-reduce:opacity-100'

  return (
    <section id="channels" className="pt-[120px] max-[980px]:pt-[88px]">
      <style>{KEYFRAMES}</style>
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Channels" count={CHANNELS.length} />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="One customer. Three apps and a phone line." />
              <br />
              <HighlightBubble bgClass="bg-[var(--surface-green)] text-[var(--brand-primary)]" delay={0.28}>
                One timeline.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.18} distance={14}>
              <p className="mt-5 text-[18px] max-[720px]:text-[17px] text-[var(--text-body)] max-w-[560px] mx-auto leading-[1.6]">
                People do not stay on one channel, so your records should not either. Parsona merges
                every message, comment, order and, soon, every call into a single history per customer.
              </p>
            </FadeUp>
          </div>

          <div className="grid grid-cols-[1fr_1.05fr] gap-14 max-[980px]:gap-8 mt-14 max-[720px]:mt-8 items-start max-[980px]:grid-cols-1">
            {/* Channel list */}
            <div>
              <ul ref={listRef} className="grid gap-3">
                {CHANNELS.map((ch, i) => {
                  const pressed = focus === ch.name
                  return (
                    <li
                      key={ch.name}
                      className={`rounded-[16px] border border-[var(--border)] bg-white shadow-[var(--shadow-card)] overflow-hidden ${ch.borderClass} ${rise(listIn, listInstant)}`}
                      style={listInstant ? undefined : { animationDelay: `${i * 100}ms` }}
                    >
                      <button
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => setFocus((prev) => (prev === ch.name ? null : ch.name))}
                        onMouseEnter={() => setFocus(ch.name)}
                        onMouseLeave={() => setFocus(null)}
                        onFocus={() => setFocus(ch.name)}
                        onBlur={() => setFocus(null)}
                        className={`w-full text-left py-4 px-4 grid grid-cols-[44px_1fr] gap-4 cursor-pointer transition-colors duration-200 focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:-outline-offset-2 ${
                          pressed ? 'bg-[var(--surface-secondary)]' : 'hover:bg-[var(--surface-secondary)]'
                        }`}
                      >
                        <span className={`relative w-11 h-11 rounded-[12px] grid place-items-center ${ch.iconBg}`}>
                          {ch.soon && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 rounded-[12px] bg-[var(--accent-primary)] animate-[channels-ping_2s_ease-out_infinite] motion-reduce:animate-none"
                            />
                          )}
                          <span className="relative">{ch.icon}</span>
                        </span>
                        <span className="block">
                          <b className={`block ${DISPLAY_FONT} text-[20px] tracking-[-0.02em] leading-[1.2] text-[var(--text-heading)]`}>
                            {ch.name}
                            {ch.soon && (
                              <em
                                className={`ml-2 align-middle not-italic ${MONO_FONT} font-medium text-[10px] tracking-[0.05em] uppercase px-[8px] py-[2px] rounded-full bg-[var(--surface-lavender)] text-[var(--accent-text)]`}
                              >
                                Coming soon
                              </em>
                            )}
                          </b>
                          <span className="block text-[15px] text-[var(--text-secondary)] mt-1">{ch.description}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className={`mt-3 ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
                Hover or tap a channel to highlight its activity in the timeline.
              </p>
            </div>

            {/* Customer timeline */}
            <div
              ref={tlRef}
              className="bg-white border border-[var(--border)] rounded-[20px] pt-7 px-7 pb-2 max-[720px]:pt-[22px] max-[720px]:px-5 max-[720px]:pb-1 shadow-[var(--shadow-card)]"
            >
              <div className="flex justify-between items-center gap-3 flex-wrap pb-[18px] border-b border-[var(--border)]">
                <b className={`${DISPLAY_FONT} text-[22px] tracking-[-0.025em] text-[var(--text-heading)]`}>Aanya Sharma</b>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2.5 py-[3px] rounded-full tracking-[0.02em] bg-[var(--brand-primary)] text-white`}
                >
                  3 apps + voice · 1 history
                </span>
              </div>

              <ol className="list-none relative py-2">
                {/* The vertical line draws itself downward */}
                <span
                  aria-hidden="true"
                  className={`absolute left-[11px] top-[22px] bottom-[22px] w-[2px] bg-[var(--border)] origin-top ${
                    tlIn
                      ? tlInstant
                        ? 'scale-y-100'
                        : 'animate-[channels-line_1.1s_ease-out_both] motion-reduce:animate-none'
                      : 'scale-y-0 motion-reduce:scale-y-100'
                  }`}
                />
                {TIMELINE_EVENTS.map((ev, idx) => {
                  const t = TAGS[ev.channel]
                  const dim = focus !== null && focus !== ev.channel
                  return (
                    <li
                      key={idx}
                      className={rise(tlIn, tlInstant)}
                      style={tlInstant ? undefined : { animationDelay: `${150 + idx * 140}ms` }}
                    >
                      <div
                        className={`relative py-[14px] pl-10 transition-opacity duration-300 ${
                          dim ? 'opacity-30' : 'opacity-100'
                        }`}
                      >
                        <span
                          className={`absolute left-[3px] top-5 w-[18px] h-[18px] rounded-full border-4 border-white shadow-[0_0_0_1px_var(--border-strong)] ${t.dot} ${
                            ev.preview ? 'border-dashed' : ''
                          } ${
                            tlIn
                              ? tlInstant
                                ? 'scale-100'
                                : 'animate-[channels-pop_0.45s_ease-out_both] motion-reduce:animate-none'
                              : 'scale-0 motion-reduce:scale-100'
                          }`}
                          style={tlInstant ? undefined : { animationDelay: `${150 + idx * 140}ms` }}
                          aria-hidden="true"
                        />
                        <time className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
                          {ev.time}
                          {ev.preview && ' · Preview'}
                        </time>
                        <p className="text-[15px] text-[var(--text-body)] mt-[2px]">
                          <span
                            className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[2px] rounded-full mr-[6px] tracking-[0.02em] ${t.tag}`}
                          >
                            {ev.channel}
                          </span>
                          {ev.body}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
