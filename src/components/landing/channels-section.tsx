import React from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

const CHANNELS = [
  {
    name: 'WhatsApp',
    description:
      'Official Business API with approved templates, catalogue messages, order updates and click-to-chat links.',
    borderClass: 'border-l-[5px] border-l-[#1FD27A]',
    iconBg: 'bg-[#D4F5E3]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3C6.8 3 3 6.6 3 11.2c0 2.6 1.3 4.8 3.3 6.3V21l3.2-1.8c.8.2 1.6.3 2.5.3 5.2 0 9-3.6 9-8.2S17.2 3 12 3z" />
      </svg>
    ),
  },
]

const TIMELINE_EVENTS = [
  {
    dotBg: 'bg-[#FF8A5B]',
    tagBg: 'bg-[#FFE1D6] text-[#8A3A12]',
    channel: 'Instagram',
    time: 'Mon 10:12',
    body: (
      <>
        Replied to the <em className="not-italic font-semibold">Diwali edit</em> story. A flow sent the catalogue.
      </>
    ),
  },
  {
    dotBg: 'bg-[#FF8A5B]',
    tagBg: 'bg-[#FFE1D6] text-[#8A3A12]',
    channel: 'Instagram',
    time: 'Mon 10:14',
    body: 'Asked the price of the kurta set. AI answered and moved the chat to WhatsApp.',
  },
  {
    dotBg: 'bg-[#1FD27A]',
    tagBg: 'bg-[#D4F5E3] text-[#0B5F37]',
    channel: 'WhatsApp',
    time: 'Mon 18:40',
    body: (
      <>
        Placed <em className="not-italic font-semibold">order #4821</em> for ₹2,490 and paid by UPI.
      </>
    ),
  },
  {
    dotBg: 'bg-[#1FD27A]',
    tagBg: 'bg-[#D4F5E3] text-[#0B5F37]',
    channel: 'WhatsApp',
    time: 'Wed 09:05',
    body: 'Delivery update sent with an approved template.',
  },
  {
    dotBg: 'bg-[#4C8DF0]',
    tagBg: 'bg-[#D9E6FB] text-[#1F4F94]',
    channel: 'Facebook',
    time: 'Fri 11:30',
    body: 'Commented "Loved it!" on the page post. A flow sent a review link.',
  },
]

export function ChannelsSection() {
  return (
    <section id="channels" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Channels" count={3} bgClass="bg-[#D4F5E3]" dotClass="bg-[#1FD27A]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              One customer. Three apps.
              <br />
              <HighlightBubble bgClass="bg-[#1FD27A]">One timeline.</HighlightBubble>
            </h2>
            <p className="mt-5 text-[19px] text-[#52625A] max-w-[560px] mx-auto">
              People do not stay on one channel, so your records should not either. Parsona merges
              every message, comment and order into a single history per customer.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_1.05fr] gap-14 mt-14 items-start max-[980px]:grid-cols-1">
            <ul className="grid gap-0 border-t-[1.5px] border-[#0E1512]">
              {CHANNELS.map((ch) => (
                <li
                  key={ch.name}
                  className={`py-5 pl-4 border-b border-[#D9E1DB] grid grid-cols-[44px_1fr] gap-4 ${ch.borderClass}`}
                >
                  <span className={`w-11 h-11 rounded-[12px] grid place-items-center ${ch.iconBg}`}>
                    {ch.icon}
                  </span>
                  <div>
                    <b className={`block ${DISPLAY_FONT} text-[21px] tracking-[-0.02em] leading-[1.2]`}>
                      {ch.name}
                    </b>
                    <span className="text-[15px] text-[#52625A]">{ch.description}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="bg-white border-[1.5px] border-[#0E1512] rounded-[22px] pt-7 px-7 pb-2 max-[720px]:pt-[22px] max-[720px]:px-5 max-[720px]:pb-1 shadow-[8px_8px_0_#DCE7DF]">
              <div className="flex justify-between items-center gap-3 flex-wrap pb-[18px] border-b border-[#D9E1DB]">
                <b className={`${DISPLAY_FONT} text-[22px] tracking-[-0.025em]`}>Aanya Sharma</b>
                <span className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] tracking-[0.02em] bg-[#0B3B2E] text-white`}>
                  3 channels · 1 history
                </span>
              </div>

              <ol className="list-none relative py-2 before:content-[''] before:absolute before:left-[11px] before:top-[22px] before:bottom-[22px] before:w-[2px] before:bg-[#D9E1DB]">
                {TIMELINE_EVENTS.map((ev, idx) => (
                  <li key={idx} className="relative py-[14px] pl-10">
                    <span
                      className={`absolute left-[3px] top-5 w-[18px] h-[18px] rounded-full border-4 border-white shadow-[0_0_0_1.5px_#0E1512] ${ev.dotBg}`}
                      aria-hidden="true"
                    />
                    <time className={`${MONO_FONT} text-[12px] text-[#52625A]`}>{ev.time}</time>
                    <p className="text-[15px] mt-[2px]">
                      <span
                        className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] mr-[6px] tracking-[0.02em] ${ev.tagBg}`}
                      >
                        {ev.channel}
                      </span>
                      {ev.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

