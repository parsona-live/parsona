'use client'

import React, { useEffect, useRef, useState } from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

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

type Tab = {
  id: string
  paneId: string
  title: string
  subtitle: string
  accent: string
  tint: string
  soon?: boolean
  icon: React.ReactNode
}

const PLATFORM_TABS: Tab[] = [
  {
    id: 'tab-0',
    paneId: 'pane-0',
    title: 'Team inbox',
    subtitle: 'Assign, note and reply together',
    accent: '#1FD27A',
    tint: '#E6F7EE',
    icon: (
      <svg {...iconProps}>
        <path d="M3 13l3-8h12l3 8v6H3z" />
        <path d="M3 13h5l1 3h6l1-3h5" />
      </svg>
    ),
  },
  {
    id: 'tab-1',
    paneId: 'pane-1',
    title: 'Broadcasts',
    subtitle: 'Segmented campaigns on approved templates',
    accent: '#FFD97A',
    tint: '#FFF6DD',
    icon: (
      <svg {...iconProps}>
        <path d="M4 10v4l12 5V5L4 10z" />
        <path d="M19 9a4 4 0 010 6" />
      </svg>
    ),
  },
  {
    id: 'tab-2',
    paneId: 'pane-2',
    title: 'CRM',
    subtitle: 'Profiles that build themselves',
    accent: '#B9A6FF',
    tint: '#F3EFFF',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="5" height="16" rx="1.5" />
        <rect x="10" y="4" width="5" height="10" rx="1.5" />
        <rect x="17" y="4" width="4" height="13" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'tab-3',
    paneId: 'pane-3',
    title: 'Flow builder',
    subtitle: 'Triggers, logic and delays',
    accent: '#FF9E7A',
    tint: '#FFF0E9',
    icon: (
      <svg {...iconProps}>
        <circle cx="5.5" cy="12" r="2.5" />
        <circle cx="18.5" cy="5.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
        <path d="M8 11l8.2-4.3M8 13l8.2 4.3" />
      </svg>
    ),
  },
  {
    id: 'tab-4',
    paneId: 'pane-4',
    title: 'AI agents',
    subtitle: 'Answers from your own content',
    accent: '#8FBBFF',
    tint: '#EAF2FF',
    icon: (
      <svg {...iconProps}>
        <rect x="5" y="8" width="14" height="11" rx="3" />
        <path d="M12 4v4M9.5 13v1.5M14.5 13v1.5" />
      </svg>
    ),
  },
  {
    id: 'tab-5',
    paneId: 'pane-5',
    title: 'Voice agent',
    subtitle: 'Answers calls, books and hands off',
    accent: '#F4A7C8',
    tint: '#FFEEF6',
    soon: true,
    icon: (
      <svg {...iconProps}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 18v3" />
      </svg>
    ),
  },
]

/* ------------------------------------------------------------------ */
/* Animation helpers                                                   */
/* ------------------------------------------------------------------ */

// Keyframes live here so the component is self-contained. Panes use `hidden`,
// and CSS animations restart whenever an element goes from display:none to
// visible, so every tab switch replays its own entrance.
const KEYFRAMES = `
@keyframes platform-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes platform-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes platform-wave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes platform-ping{0%{transform:scale(.85);opacity:.55}100%{transform:scale(2.1);opacity:0}}
@keyframes platform-dot{0%,100%{opacity:.35}50%{opacity:1}}
`

const RISE = 'animate-[platform-rise_0.5s_ease-out_both] motion-reduce:animate-none'
const delay = (i: number, step = 90) => ({ animationDelay: `${i * step}ms` })

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const PILL_TONES = {
  gray: 'bg-[#EEF2EE] text-[#2A3731]',
  warn: 'bg-[#FFF1CC] text-[#7A5400]',
  ok: 'bg-[#D4F5E3] text-[#0B5F37]',
  soon: 'bg-[#E5DEFF] text-[#3B2A8C]',
}

function Pill({ tone = 'gray', children }: { tone?: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return (
    <span
      className={`${MONO_FONT} font-medium text-[11.5px] px-[9px] py-1 rounded-[7px] whitespace-nowrap ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}>
      {children}
    </div>
  )
}

function Bubble({ tone = 'in', children }: { tone?: 'in' | 'out'; children: React.ReactNode }) {
  return (
    <div
      className={`border border-[#D9E1DB] text-[#0E1512] rounded-[14px_14px_14px_4px] px-[14px] py-3 text-[14px] max-w-[340px] ${tone === 'out' ? 'bg-[#D4F5E3]' : 'bg-[#F6F8F5]'
        }`}
    >
      {children}
    </div>
  )
}

function PaneHead({
  kicker,
  title,
  accent,
  children,
}: {
  kicker: string
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <>
      <span
        className={`inline-block ${MONO_FONT} font-medium text-[11.5px] tracking-[0.07em] px-[11px] py-[5px] rounded-full border-[1.5px] border-[#0E1512] mb-4`}
        style={{ backgroundColor: accent }}
      >
        {kicker}
      </span>
      <h3
        className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold max-w-[600px] leading-[1.08] tracking-[-0.035em]`}
      >
        {title}
      </h3>
      <p className="mt-3 text-[#52625A] max-w-[560px] text-[16.5px] max-[720px]:text-[15.5px]">{children}</p>
    </>
  )
}

function PaneFooter({ items, accent }: { items: string[]; accent: string }) {
  return (
    <div className="flex gap-[10px] flex-wrap mt-[26px] pt-5 max-[720px]:mt-5 max-[720px]:pt-4 border-t border-dashed border-[#C9D4CD]">
      {items.map((item) => (
        <span
          key={item}
          className={`inline-flex items-center gap-2 ${MONO_FONT} font-medium text-[12.5px] text-[#2A3731] bg-white border border-[#D9E1DB] rounded-full px-3 py-[6px]`}
        >
          <i className="w-2 h-2 rounded-full border border-[#0E1512] shrink-0" style={{ backgroundColor: accent }} />
          {item}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function PlatformSection() {
  const [activeTab, setActiveTab] = useState(0)
  const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([])
  const navRef = useRef<HTMLDivElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const touch = useRef({ x: 0, y: 0 })

  const current = PLATFORM_TABS[activeTab]
  const last = PLATFORM_TABS.length - 1

  // On phones, keep the selected tab centred in the horizontal strip.
  useEffect(() => {
    const nav = navRef.current
    const btn = tabButtonsRef.current[activeTab]
    if (!nav || !btn || !window.matchMedia('(max-width: 720px)').matches) return
    nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' })
  }, [activeTab])

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIndex = (index + 1) % PLATFORM_TABS.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextIndex = (index - 1 + PLATFORM_TABS.length) % PLATFORM_TABS.length
    else return
    e.preventDefault()
    setActiveTab(nextIndex)
    tabButtonsRef.current[nextIndex]?.focus()
  }

  // Swipe left / right on the panel to change tab (phones only).
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!window.matchMedia('(max-width: 720px)').matches) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return
    setActiveTab((i) => Math.min(last, Math.max(0, i + (dx < 0 ? 1 : -1))))
  }

  const goNext = () => {
    setActiveTab((i) => Math.min(last, i + 1))
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cardStyle = { borderLeftColor: current.accent }
  const card =
    'bg-white border-[1.5px] border-[#D9E1DB] border-l-4 rounded-[14px] text-[#0E1512] px-4 py-[14px]'
  // Row cards: on phones the pills wrap under the text instead of squeezing it.
  const rowCard = `${card} flex items-center gap-[14px] text-[14.5px] max-[720px]:flex-wrap max-[720px]:gap-y-2`
  const rowText = 'flex-1 min-w-0 max-[720px]:basis-full'

  const NextButton = ({ index }: { index: number }) => {
    const cls =
      'hidden max-[720px]:flex items-center justify-center w-full h-12 mt-[18px] rounded-[12px] border-[1.5px] border-[#0E1512] bg-[#0E1512] text-white font-semibold text-[15px] active:translate-y-px'
    if (index === last) {
      return (
        <a href="#waitlist" className={cls}>
          Get voice early access →
        </a>
      )
    }
    return (
      <button type="button" onClick={goNext} className={cls}>
        Next: {PLATFORM_TABS[index + 1].title} →
      </button>
    )
  }

  return (
    <section id="platform" className="pt-[120px] max-[980px]:pt-[88px]">
      <style>{KEYFRAMES}</style>
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Platform" count={PLATFORM_TABS.length} bgClass="bg-[#E5DEFF]" dotClass="bg-[#7C5CFF]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              Everything a conversation touches, in
              <br />
              <HighlightBubble bgClass="bg-[#CFC3FF]">one workbench.</HighlightBubble>
            </h2>
            <p className="mt-5 text-[19px] text-[#52625A] max-w-[560px] mx-auto">
              Inbox, campaigns, CRM, automation, AI and soon voice read from the same customer
              record, so nothing is copied between tools.
            </p>
          </div>

          <div
            ref={boxRef}
            className="mt-14 max-[720px]:mt-8 scroll-mt-[84px] grid grid-cols-[300px_minmax(0,1fr)] max-[1100px]:grid-cols-1 bg-white border-[1.5px] border-[#0E1512] rounded-[24px] max-[720px]:rounded-[20px] overflow-hidden transition-shadow duration-250"
            style={{ boxShadow: `8px 8px 0 ${current.accent}` }}
          >
            {/* Left / top tab navigation */}
            <div
              ref={navRef}
              className="flex flex-col max-[1100px]:flex-row max-[1100px]:overflow-x-auto max-[720px]:snap-x max-[720px]:gap-2 max-[720px]:px-3 max-[720px]:pt-3 max-[720px]:pb-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-[6px] p-[14px] bg-[#FAFBF9] border-r-[1.5px] max-[1100px]:border-r-0 max-[1100px]:border-b-[1.5px] border-[#0E1512] relative"
              role="tablist"
              aria-label="Platform modules"
            >
              {PLATFORM_TABS.map((tab, i) => {
                const selected = activeTab === i
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabButtonsRef.current[i] = el
                    }}
                    type="button"
                    role="tab"
                    id={tab.id}
                    aria-selected={selected}
                    aria-controls={tab.paneId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveTab(i)}
                    onKeyDown={(e) => handleTabKeyDown(e, i)}
                    style={{ ['--sh' as string]: tab.accent } as React.CSSProperties}
                    className={`flex gap-[14px] items-center text-left border-[1.5px] rounded-[16px] px-[14px] py-3 text-[#0E1512] shrink-0 min-[721px]:max-[1100px]:min-w-[250px] max-[720px]:flex-col max-[720px]:w-[88px] max-[720px]:gap-[7px] max-[720px]:px-[6px] max-[720px]:pt-[10px] max-[720px]:pb-[9px] max-[720px]:text-center max-[720px]:rounded-[14px] max-[720px]:snap-center transition-[background-color,border-color,box-shadow] duration-200 cursor-pointer focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] ${selected
                        ? 'bg-white border-[#0E1512] shadow-[4px_4px_0_var(--sh)] max-[720px]:shadow-[0_4px_0_var(--sh)]'
                        : 'bg-transparent border-transparent hover:bg-white hover:border-[#D9E1DB]'
                      }`}
                  >
                    <i
                      className="w-11 h-11 max-[720px]:w-10 max-[720px]:h-10 rounded-[12px] grid place-items-center shrink-0 border-[1.5px] border-[#0E1512]"
                      style={{ backgroundColor: tab.accent }}
                    >
                      {tab.icon}
                    </i>
                    <div>
                      <b
                        className={`block ${DISPLAY_FONT} text-[18px] max-[720px]:text-[13px] tracking-[-0.02em] leading-[1.15]`}
                      >
                        {tab.title}
                        {tab.soon && (
                          <em
                            className={`ml-2 max-[720px]:ml-0 max-[720px]:mt-[5px] max-[720px]:block max-[720px]:w-max max-[720px]:mx-auto align-middle not-italic ${MONO_FONT} font-medium text-[10px] tracking-[0.05em] uppercase px-[7px] py-[2px] rounded-[6px] bg-[#E5DEFF] text-[#3B2A8C]`}
                          >
                            Soon
                          </em>
                        )}
                      </b>
                      <span className="block max-[720px]:hidden text-[13px] leading-[1.35] text-[#52625A] mt-[2px]">
                        {tab.subtitle}
                      </span>
                    </div>
                  </button>
                )
              })}
              <span aria-hidden="true" className="hidden max-[720px]:block shrink-0 w-3" />
            </div>

            {/* Right tab panel */}
            <div
              className="px-10 py-9 max-[720px]:px-4 max-[720px]:py-6 min-h-[560px] max-[720px]:min-h-0 text-[#0E1512] transition-[background] duration-300"
              style={{ background: `linear-gradient(180deg, ${current.tint}, #ffffff 260px)` }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* Pane 0: Inbox */}
              <div role="tabpanel" id="pane-0" aria-labelledby="tab-0" hidden={activeTab !== 0}>
                <PaneHead kicker="TEAM INBOX" title="A shared inbox with a clock on every chat" accent={current.accent}>
                  See who owns what, which replies are due and what the team said privately, across
                  all three channels.
                </PaneHead>
                <div className="mt-7 max-[720px]:mt-5 grid gap-3">
                  {[
                    { n: 'Aanya Sharma', m: 'Can I get an appointment today?', who: 'Rohan', tag: 'due in 4m', tone: 'warn' as const },
                    { n: 'Rohit Kapoor', m: 'Do you do teeth whitening?', who: 'Unassigned', tag: 'due in 11m', tone: 'warn' as const },
                    { n: 'Meera Joshi', m: 'Can I move my slot to Monday?', who: 'Priya', tag: 'on track', tone: 'ok' as const },
                    { n: 'Internal note · Priya', m: '"Offered a free follow-up check. Please honour it."', who: 'private', tag: '', tone: 'gray' as const },
                  ].map((r, i) => (
                    <div key={r.n} className={`${rowCard} ${RISE}`} style={{ ...cardStyle, ...delay(i) }}>
                      <div className={rowText}>
                        <b className="block text-[14.5px]">{r.n}</b>
                        <small className="text-[#52625A] text-[13px]">{r.m}</small>
                      </div>
                      <Pill>{r.who}</Pill>
                      {r.tag && <Pill tone={r.tone}>{r.tag}</Pill>}
                    </div>
                  ))}
                </div>
                <PaneFooter
                  items={['42 s average first reply', '3 channels, 1 inbox', 'Private team notes']}
                  accent={current.accent}
                />
                <NextButton index={0} />
              </div>

              {/* Pane 1: Broadcasts */}
              <div role="tabpanel" id="pane-1" aria-labelledby="tab-1" hidden={activeTab !== 1}>
                <PaneHead kicker="BROADCASTS" title="Send to the right 12,480 people, not everyone" accent={current.accent}>
                  Filter by tag, purchase or last chat, pick an approved template and schedule it.
                  Replies land in the inbox.
                </PaneHead>
                <div className="mt-7 max-[720px]:mt-5 grid grid-cols-[1.1fr_1fr] max-[720px]:grid-cols-1 gap-3">
                  <div className={`${card} ${RISE}`} style={cardStyle}>
                    <Label>Preview</Label>
                    <Bubble>
                      Hi {'{{first_name}}'}, it is time for your 6-month dental check-up. Want a slot
                      this week?
                      <small className={`block mt-[6px] text-[#52625A] ${MONO_FONT} text-[11px]`}>
                        Template · Approved
                      </small>
                    </Bubble>
                  </div>
                  <div className={`${card} ${RISE}`} style={{ ...cardStyle, ...delay(1) }}>
                    <Label>Audience and schedule</Label>
                    <div className="flex items-center gap-[14px] text-[14.5px] mb-[10px]">
                      <div className="flex-1 min-w-0">
                        <b className="block text-[14.5px]">Tag: Due for check-up</b>
                        <small className="text-[#52625A] text-[13px]">12,480 contacts</small>
                      </div>
                      <Pill>Fri 6:00 pm</Pill>
                    </div>
                    <div className="mt-[14px]">
                      <Label>Last campaign</Label>
                    </div>
                    <div className="flex items-end gap-[7px] h-[92px] mt-2" aria-hidden="true">
                      {[30, 48, 42, 70, 60, 92].map((h, idx) => (
                        <i
                          key={idx}
                          className="flex-1 rounded-t-[5px] block origin-bottom animate-[platform-grow_0.6s_ease-out_both] motion-reduce:animate-none"
                          style={{
                            height: `${h}%`,
                            backgroundColor: current.accent,
                            opacity: idx % 2 === 0 ? 0.6 : 1,
                            animationDelay: `${200 + idx * 80}ms`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-[14px] mt-3">
                      <Pill tone="ok">98% delivered</Pill>
                      <Pill>64% read</Pill>
                    </div>
                  </div>
                </div>
                <PaneFooter
                  items={['98% delivered, 64% read', 'Approved templates only', 'Replies land in the inbox']}
                  accent={current.accent}
                />
                <NextButton index={1} />
              </div>

              {/* Pane 2: CRM */}
              <div role="tabpanel" id="pane-2" aria-labelledby="tab-2" hidden={activeTab !== 2}>
                <PaneHead kicker="BUILT-IN CRM" title="A pipeline that fills itself in from chat" accent={current.accent}>
                  Tags, orders and stage changes are logged from conversations. Drag a deal forward
                  and the next flow starts.
                </PaneHead>
                <div className="mt-7 max-[720px]:mt-5 grid grid-cols-3 max-[720px]:grid-cols-1 gap-3">
                  {[
                    { stage: 'New', deals: [['Priya Nair', '₹12,000 · Instagram'], ['Dev Patel', '₹4,000 · WhatsApp']] },
                    { stage: 'Booking', deals: [['Aanya Sharma', '₹2,490 · WhatsApp'], ['Karan Shah', '₹28,000 · Facebook']] },
                    { stage: 'Treated', deals: [['Neha Rao', '₹9,000 · WhatsApp'], ['Arjun Mehta', '₹15,500 · Instagram']] },
                  ].map((col, ci) => (
                    <div key={col.stage} className={`${card} ${RISE}`} style={{ ...cardStyle, ...delay(ci, 120) }}>
                      <Label>{col.stage}</Label>
                      {col.deals.map(([name, meta], di) => (
                        <div
                          key={name}
                          className={`bg-[#F6F8F5] border border-[#D9E1DB] rounded-[10px] px-[11px] py-[9px] mt-2 text-[14px] text-[#0E1512] ${RISE}`}
                          style={delay(ci * 2 + di + 2, 90)}
                        >
                          {name}
                          <small className={`block ${MONO_FONT} text-[11.5px] text-[#52625A]`}>{meta}</small>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <PaneFooter
                  items={['Logged straight from chat', 'Drag a deal, start a flow', 'Custom fields and tags']}
                  accent={current.accent}
                />
                <NextButton index={2} />
              </div>

              {/* Pane 3: Flows */}
              <div role="tabpanel" id="pane-3" aria-labelledby="tab-3" hidden={activeTab !== 3}>
                <PaneHead kicker="FLOW BUILDER" title="Three flows running while the team sleeps" accent={current.accent}>
                  Every flow is a plain-language rule. Switch it on, watch the runs, switch it off.
                </PaneHead>
                <div className="mt-7 max-[720px]:mt-5 grid gap-3">
                  {[
                    { name: 'Comment "SMILE" → WhatsApp booking chat', meta: 'Instagram · 486 runs this week', live: true },
                    { name: 'Appointment reminder → confirm', meta: 'WhatsApp · 436 runs this week', live: true },
                    { name: 'Booking confirmed → clinic location', meta: 'WhatsApp · 2,018 runs this week', live: true },
                    { name: 'Review request after visit', meta: 'Facebook · Draft', live: false },
                  ].map((flow, i) => (
                    <div key={flow.name} className={`${rowCard} ${RISE}`} style={{ ...cardStyle, ...delay(i) }}>
                      <div className={rowText}>
                        <b className="block text-[14.5px]">{flow.name}</b>
                        <small className="text-[#52625A] text-[13px]">{flow.meta}</small>
                      </div>
                      <Pill tone={flow.live ? 'ok' : 'gray'}>
                        {flow.live && (
                          <i
                            className="inline-block w-[6px] h-[6px] rounded-full bg-[#1FD27A] mr-[6px] align-middle animate-[platform-dot_1.6s_ease-in-out_infinite] motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        )}
                        {flow.live ? 'Live' : 'Paused'}
                      </Pill>
                    </div>
                  ))}
                </div>
                <PaneFooter
                  items={['No-code builder', 'Branches, delays, retries', 'Every run logged']}
                  accent={current.accent}
                />
                <NextButton index={3} />
              </div>

              {/* Pane 4: AI agents */}
              <div role="tabpanel" id="pane-4" aria-labelledby="tab-4" hidden={activeTab !== 4}>
                <PaneHead kicker="AI AGENTS" title="Answers that cite your own policies" accent={current.accent}>
                  Agents read your services, FAQs and clinic timings. When unsure, they hand over
                  with the full thread.
                </PaneHead>
                <div className="mt-7 max-[720px]:mt-5 grid gap-3">
                  <div className={`${card} ${RISE}`} style={cardStyle}>
                    <Label>Customer asked</Label>
                    <Bubble>Do you do root canals, and how long does it take?</Bubble>
                  </div>
                  <div className={`${card} ${RISE}`} style={{ ...cardStyle, ...delay(3, 220) }}>
                    <Label>Parsona AI replied</Label>
                    <Bubble tone="out">
                      Yes. A root canal usually takes 1 to 2 visits of about an hour each. I can book
                      the first one this week.
                    </Bubble>
                    <div className={`${MONO_FONT} text-[11.5px] text-[#52625A] mt-2`}>
                      Source: Clinic services guide · confidence 96%
                    </div>
                  </div>
                  <div className={`${rowCard} ${RISE}`} style={{ ...cardStyle, ...delay(5, 220) }}>
                    <div className={rowText}>
                      <b className="block text-[14.5px]">Handoff rule</b>
                      <small className="text-[#52625A] text-[13px]">
                        Emergencies, complaints and anything below 70% confidence go to a person.
                      </small>
                    </div>
                    <Pill tone="ok">On</Pill>
                  </div>
                </div>
                <PaneFooter
                  items={['Cites your own policies', 'Hands off below 70% confidence', 'Replies 24 / 7']}
                  accent={current.accent}
                />
                <NextButton index={4} />
              </div>

              {/* Pane 5: Voice agent (coming soon) */}
              <div role="tabpanel" id="pane-5" aria-labelledby="tab-5" hidden={activeTab !== 5}>
                <PaneHead kicker="VOICE AGENT · COMING SOON" title="The same agent, now on the phone" accent={current.accent}>
                  Voice answers calls, books appointments and hands off to your team. It uses the
                  same services, policies and customer record as your chat agent.
                </PaneHead>
                <div className="mt-7 max-[720px]:mt-5 grid gap-3">
                  {/* Live call preview */}
                  <div className={`${card} ${RISE}`} style={cardStyle}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="relative grid place-items-center w-9 h-9 rounded-full border-[1.5px] border-[#0E1512] shrink-0" style={{ backgroundColor: current.accent }}>
                        <span
                          className="absolute inset-0 rounded-full animate-[platform-ping_1.8s_ease-out_infinite] motion-reduce:animate-none"
                          style={{ backgroundColor: current.accent }}
                          aria-hidden="true"
                        />
                        <svg className="relative" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                        </svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <Label>Preview · Incoming call</Label>
                      </div>
                      <div className="flex items-center gap-[3px] h-7" aria-hidden="true">
                        {[10, 22, 16, 26, 12, 20].map((h, i) => (
                          <i
                            key={i}
                            className="block w-1 rounded-sm origin-center animate-[platform-wave_1.1s_ease-in-out_infinite] motion-reduce:animate-none"
                            style={{ height: h, backgroundColor: current.accent, animationDelay: `${i * 100}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className={RISE} style={delay(1, 350)}>
                      <Bubble>Hi, can I move my slot to Monday?</Bubble>
                    </div>
                    <div className={`mt-2 ${RISE}`} style={delay(3, 350)}>
                      <Bubble tone="out">Sure, Meera. I have Monday at 11 am open. Shall I confirm it?</Bubble>
                    </div>
                  </div>
                  <div className={`${rowCard} ${RISE}`} style={{ ...cardStyle, ...delay(5, 350) }}>
                    <div className={rowText}>
                      <b className="block text-[14.5px]">Call summary saved to Meera Joshi</b>
                      <small className="text-[#52625A] text-[13px]">
                        Same timeline as WhatsApp, Instagram and Facebook.
                      </small>
                    </div>
                    <Pill tone="soon">Soon</Pill>
                  </div>
                  <div className={`${rowCard} ${RISE}`} style={{ ...cardStyle, ...delay(6, 350) }}>
                    <div className={rowText}>
                      <b className="block text-[14.5px]">Flow: missed call → WhatsApp follow-up</b>
                      <small className="text-[#52625A] text-[13px]">
                        Built in the same flow builder as your chat automations.
                      </small>
                    </div>
                    <Pill tone="soon">Soon</Pill>
                  </div>
                </div>
                <PaneFooter
                  items={['Books and reschedules', 'Hands off to a person', 'Same customer record']}
                  accent={current.accent}
                />
                <NextButton index={5} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}