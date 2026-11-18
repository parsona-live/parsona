'use client'

import React, { useEffect, useRef, useState } from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type ChannelName = 'WhatsApp' | 'Instagram' | 'Facebook' | 'Voice'

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#0E1512',
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
    borderClass: 'border-l-[5px] border-l-[#1FD27A]',
    iconBg: 'bg-[#D4F5E3]',
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
    borderClass: 'border-l-[5px] border-l-[#FF8A5B]',
    iconBg: 'bg-[#FFE1D6]',
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="#0E1512" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    description:
      'Messenger, page comments and click-to-Messenger ad replies, routed to the right teammate.',
    borderClass: 'border-l-[5px] border-l-[#4C8DF0]',
    iconBg: 'bg-[#D9E6FB]',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3C6.8 3 3 6.6 3 11.2c0 2.6 1.3 4.8 3.3 6.3V21l3.2-1.8c.8.2 1.6.3 2.5.3 5.2 0 9-3.6 9-8.2S17.2 3 12 3z" />
      </svg>
    ),
  },
  {
    name: 'Voice',
    description:
      'A voice AI agent that answers calls, books and reschedules, then hands off to your team. Every call is saved on the same customer record.',
    borderClass: 'border-l-[5px] border-l-[#F4A7C8]',
    iconBg: 'bg-[#FBD9E8]',
    soon: true,
    icon: (
      <svg {...iconProps}>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
      </svg>
    ),
  },
]

const TAGS: Record<ChannelName, { dot: string; tag: string }> = {
  Instagram: { dot: 'bg-[#FF8A5B]', tag: 'bg-[#FFE1D6] text-[#8A3A12]' },
  WhatsApp: { dot: 'bg-[#1FD27A]', tag: 'bg-[#D4F5E3] text-[#0B5F37]' },
  Facebook: { dot: 'bg-[#4C8DF0]', tag: 'bg-[#D9E6FB] text-[#1F4F94]' },
  Voice: { dot: 'bg-[#F4A7C8]', tag: 'bg-[#FBD9E8] text-[#8A2A5B]' },
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

// Plays once, when the section scrolls into view.
function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(
    () => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined',
  )
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function ChannelsSection() {
  const [listRef, listIn] = useInView<HTMLUListElement>()
  const [tlRef, tlIn] = useInView<HTMLDivElement>()
  // Hover / tap a channel to spotlight its activity in the timeline.
  const [focus, setFocus] = useState<ChannelName | null>(null)

  const rise = (on: boolean) =>
    on
      ? 'animate-[channels-rise_0.5s_ease-out_both] motion-reduce:animate-none'
      : 'opacity-0 motion-reduce:opacity-100'

  return (
    <section id="channels" className="pt-[120px] max-[980px]:pt-[88px]">
      <style>{KEYFRAMES}</style>
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Channels" count={CHANNELS.length} bgClass="bg-[#D4F5E3]" dotClass="bg-[#1FD27A]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              One customer. Three apps and a phone line.
              <br />
              <HighlightBubble bgClass="bg-[#1FD27A]">One timeline.</HighlightBubble>
            </h2>
            <p className="mt-5 text-[19px] max-[720px]:text-[17px] text-[#52625A] max-w-[560px] mx-auto">
              People do not stay on one channel, so your records should not either. Parsona merges
              every message, comment, order and, soon, every call into a single history per customer.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_1.05fr] gap-14 max-[980px]:gap-8 mt-14 max-[720px]:mt-8 items-start max-[980px]:grid-cols-1">
            {/* Channel list */}
            <div>
              <ul ref={listRef} className="grid gap-0 border-t-[1.5px] border-[#0E1512]">
                {CHANNELS.map((ch, i) => {
                  const pressed = focus === ch.name
                  return (
                    <li
                      key={ch.name}
                      className={`border-b border-[#D9E1DB] ${ch.borderClass} ${rise(listIn)}`}
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <button
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => setFocus((prev) => (prev === ch.name ? null : ch.name))}
                        onMouseEnter={() => setFocus(ch.name)}
                        onMouseLeave={() => setFocus(null)}
                        onFocus={() => setFocus(ch.name)}
                        onBlur={() => setFocus(null)}
                        className={`w-full text-left py-5 pl-4 pr-3 max-[720px]:py-4 grid grid-cols-[44px_1fr] gap-4 cursor-pointer transition-colors duration-200 focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:-outline-offset-2 ${
                          pressed ? 'bg-[#F6F8F5]' : 'hover:bg-[#F6F8F5]'
                        }`}
                      >
                        <span className={`relative w-11 h-11 rounded-[12px] grid place-items-center ${ch.iconBg}`}>
                          {ch.soon && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 rounded-[12px] bg-[#F4A7C8] animate-[channels-ping_2s_ease-out_infinite] motion-reduce:animate-none"
                            />
                          )}
                          <span className="relative">{ch.icon}</span>
                        </span>
                        <span className="block">
                          <b className={`block ${DISPLAY_FONT} text-[21px] tracking-[-0.02em] leading-[1.2]`}>
                            {ch.name}
                            {ch.soon && (
                              <em
                                className={`ml-2 align-middle not-italic ${MONO_FONT} font-medium text-[10px] tracking-[0.05em] uppercase px-[7px] py-[2px] rounded-[6px] bg-[#E5DEFF] text-[#3B2A8C]`}
                              >
                                Coming soon
                              </em>
                            )}
                          </b>
                          <span className="block text-[15px] text-[#52625A]">{ch.description}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className={`mt-3 ${MONO_FONT} text-[12px] text-[#52625A]`}>
                Hover or tap a channel to highlight its activity in the timeline.
              </p>
            </div>

            {/* Customer timeline */}
            <div
              ref={tlRef}
              className="bg-white border-[1.5px] border-[#0E1512] rounded-[22px] pt-7 px-7 pb-2 max-[720px]:pt-[22px] max-[720px]:px-5 max-[720px]:pb-1 shadow-[8px_8px_0_#DCE7DF] max-[720px]:shadow-[5px_5px_0_#DCE7DF]"
            >
              <div className="flex justify-between items-center gap-3 flex-wrap pb-[18px] border-b border-[#D9E1DB]">
                <b className={`${DISPLAY_FONT} text-[22px] tracking-[-0.025em]`}>Aanya Sharma</b>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] tracking-[0.02em] bg-[#0B3B2E] text-white`}
                >
                  3 apps + voice · 1 history
                </span>
              </div>

              <ol className="list-none relative py-2">
                {/* The vertical line draws itself downward */}
                <span
                  aria-hidden="true"
                  className={`absolute left-[11px] top-[22px] bottom-[22px] w-[2px] bg-[#D9E1DB] origin-top ${
                    tlIn
                      ? 'animate-[channels-line_1.1s_ease-out_both] motion-reduce:animate-none'
                      : 'scale-y-0 motion-reduce:scale-y-100'
                  }`}
                />
                {TIMELINE_EVENTS.map((ev, idx) => {
                  const t = TAGS[ev.channel]
                  const dim = focus !== null && focus !== ev.channel
                  return (
                    <li
                      key={idx}
                      className={rise(tlIn)}
                      style={{ animationDelay: `${150 + idx * 140}ms` }}
                    >
                      <div
                        className={`relative py-[14px] pl-10 transition-opacity duration-300 ${
                          dim ? 'opacity-30' : 'opacity-100'
                        }`}
                      >
                        <span
                          className={`absolute left-[3px] top-5 w-[18px] h-[18px] rounded-full border-4 border-white shadow-[0_0_0_1.5px_#0E1512] ${t.dot} ${
                            ev.preview ? 'border-dashed' : ''
                          } ${
                            tlIn
                              ? 'animate-[channels-pop_0.45s_ease-out_both] motion-reduce:animate-none'
                              : 'scale-0 motion-reduce:scale-100'
                          }`}
                          style={{ animationDelay: `${150 + idx * 140}ms` }}
                          aria-hidden="true"
                        />
                        <time className={`${MONO_FONT} text-[12px] text-[#52625A]`}>
                          {ev.time}
                          {ev.preview && ' · Preview'}
                        </time>
                        <p className="text-[15px] mt-[2px]">
                          <span
                            className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] mr-[6px] tracking-[0.02em] ${t.tag}`}
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
