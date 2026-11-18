'use client'

import React, { useRef, useState } from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'

const PLATFORM_TABS = [
  {
    id: 'tab-0',
    paneId: 'pane-0',
    title: 'Team inbox',
    subtitle: 'Assign, note and reply together',
    accent: '#1FD27A',
    tint: '#E6F7EE',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="5.5" cy="12" r="2.5" />
        <circle cx="18.5" cy="5.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
        <path d="M8 11l8.200-4.300M8 13l8.200 4.300" />
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="8" width="14" height="11" rx="3" />
        <path d="M12 4v4M9.500 13v1.500M14.500 13v1.500" />
      </svg>
    ),
  },
]

function PaneFooter({ items, accent }: { items: string[]; accent: string }) {
  return (
    <div className="flex gap-[10px] flex-wrap mt-[26px] pt-5 border-t border-dashed border-[#C9D4CD]">
      {items.map((item) => (
        <span
          key={item}
          className={`inline-flex items-center gap-2 ${MONO_FONT} font-medium text-[12.5px] text-[#2A3731] bg-white border border-[#D9E1DB] rounded-full px-3 py-[6px]`}
        >
          <i
            className="w-2 h-2 rounded-full border border-[#0E1512] shrink-0"
            style={{ backgroundColor: accent }}
          />
          {item}
        </span>
      ))}
    </div>
  )
}

export function PlatformSection() {
  const [activeTab, setActiveTab] = useState(0)
  const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([])

  const current = PLATFORM_TABS[activeTab]

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIndex = (index + 1) % PLATFORM_TABS.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + PLATFORM_TABS.length) % PLATFORM_TABS.length
    } else {
      return
    }
    e.preventDefault()
    setActiveTab(nextIndex)
    tabButtonsRef.current[nextIndex]?.focus()
  }

  const cardStyle = { borderLeftColor: current.accent }
  const cardCls =
    'bg-white border-[1.5px] border-[#D9E1DB] border-l-4 rounded-[14px] text-[#0E1512] px-4 py-[14px]'
  const pillBase = `${MONO_FONT} font-medium text-[11.5px] px-[9px] py-1 rounded-[7px] whitespace-nowrap`

  return (
    <section id="platform" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Platform" count={5} bgClass="bg-[#E5DEFF]" dotClass="bg-[#7C5CFF]" />

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
              Inbox, campaigns, CRM, automation and AI read from the same customer record, so
              nothing is copied between tools.
            </p>
          </div>

          <div
            className="mt-14 grid grid-cols-[300px_minmax(0,1fr)] max-[1100px]:grid-cols-1 bg-white border-[1.5px] border-[#0E1512] rounded-[24px] overflow-hidden transition-shadow duration-250"
            style={{ boxShadow: `8px 8px 0 ${current.accent}` }}
          >
            {/* Left / Top Tab Navigation */}
            <div
              className="flex flex-col max-[1100px]:flex-row max-[1100px]:overflow-x-auto gap-[6px] p-[14px] bg-[#FAFBF9] border-r-[1.5px] max-[1100px]:border-r-0 max-[1100px]:border-b-[1.5px] border-[#0E1512]"
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
                    className={`flex gap-[14px] items-center text-left border-[1.5px] rounded-[16px] px-[14px] py-3 text-[#0E1512] max-[1100px]:min-w-[250px] transition-[background-color,border-color,box-shadow] duration-200 cursor-pointer focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] ${
                      selected
                        ? 'bg-white border-[#0E1512]'
                        : 'bg-transparent border-transparent hover:bg-white hover:border-[#D9E1DB]'
                    }`}
                    style={selected ? { boxShadow: `4px 4px 0 ${tab.accent}` } : undefined}
                  >
                    <i
                      className="w-11 h-11 rounded-[12px] grid place-items-center shrink-0 border-[1.5px] border-[#0E1512]"
                      style={{ backgroundColor: tab.accent }}
                    >
                      {tab.icon}
                    </i>
                    <div>
                      <b className={`block ${DISPLAY_FONT} text-[18px] tracking-[-0.02em] leading-[1.15]`}>
                        {tab.title}
                      </b>
                      <span className="block text-[13px] leading-[1.35] text-[#52625A] mt-[2px]">
                        {tab.subtitle}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Right Tab Panel */}
            <div
              className="px-10 py-9 max-[720px]:px-5 max-[720px]:py-7 min-h-[560px] text-[#0E1512]"
              style={{
                background: `linear-gradient(180deg, ${current.tint}, #ffffff 260px)`,
              }}
            >
              {/* Pane 0: Inbox */}
              <div role="tabpanel" id="pane-0" aria-labelledby="tab-0" hidden={activeTab !== 0}>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11.5px] tracking-[0.07em] px-[11px] py-[5px] rounded-full border-[1.5px] border-[#0E1512] mb-4`}
                  style={{ backgroundColor: current.accent }}
                >
                  TEAM INBOX
                </span>
                <h3 className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold max-w-[600px] leading-[1.08] tracking-[-0.035em]`}>
                  A shared inbox with a clock on every chat
                </h3>
                <p className="mt-3 text-[#52625A] max-w-[560px] text-[16.5px]">
                  See who owns what, which replies are due and what the team said privately, across
                  all three channels.
                </p>
                <div className="mt-7 grid gap-3">
                  <div className={`${cardCls} flex items-center gap-[14px] text-[14.5px]`} style={cardStyle}>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[14.5px]">Aanya Sharma</b>
                      <small className="text-[#52625A] text-[13px]">Can I pay on delivery?</small>
                    </div>
                    <span className={`${pillBase} bg-[#EEF2EE] text-[#2A3731]`}>Rohan</span>
                    <span className={`${pillBase} bg-[#FFF1CC] text-[#7A5400]`}>due in 4m</span>
                  </div>
                  <div className={`${cardCls} flex items-center gap-[14px] text-[14.5px]`} style={cardStyle}>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[14.5px]">Rohit Kapoor</b>
                      <small className="text-[#52625A] text-[13px]">What is the combo price?</small>
                    </div>
                    <span className={`${pillBase} bg-[#EEF2EE] text-[#2A3731]`}>Unassigned</span>
                    <span className={`${pillBase} bg-[#FFF1CC] text-[#7A5400]`}>due in 11m</span>
                  </div>
                  <div className={`${cardCls} flex items-center gap-[14px] text-[14.5px]`} style={cardStyle}>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[14.5px]">Meera Joshi</b>
                      <small className="text-[#52625A] text-[13px]">Can I move my slot to Monday?</small>
                    </div>
                    <span className={`${pillBase} bg-[#EEF2EE] text-[#2A3731]`}>Priya</span>
                    <span className={`${pillBase} bg-[#D4F5E3] text-[#0B5F37]`}>on track</span>
                  </div>
                  <div className={`${cardCls} flex items-center gap-[14px] text-[14.5px]`} style={cardStyle}>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[14.5px]">Internal note · Priya</b>
                      <small className="text-[#52625A] text-[13px]">&quot;Offered free alteration. Please honour it.&quot;</small>
                    </div>
                    <span className={`${pillBase} bg-[#EEF2EE] text-[#2A3731]`}>private</span>
                  </div>
                </div>
                <PaneFooter
                  items={['42 s average first reply', '3 channels, 1 inbox', 'Private team notes']}
                  accent={current.accent}
                />
              </div>

              {/* Pane 1: Broadcasts */}
              <div role="tabpanel" id="pane-1" aria-labelledby="tab-1" hidden={activeTab !== 1}>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11.5px] tracking-[0.07em] px-[11px] py-[5px] rounded-full border-[1.5px] border-[#0E1512] mb-4`}
                  style={{ backgroundColor: current.accent }}
                >
                  BROADCASTS
                </span>
                <h3 className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold max-w-[600px] leading-[1.08] tracking-[-0.035em]`}>
                  Send to the right 12,480 people, not everyone
                </h3>
                <p className="mt-3 text-[#52625A] max-w-[560px] text-[16.5px]">
                  Filter by tag, purchase or last chat, pick an approved template and schedule it.
                  Replies land in the inbox.
                </p>
                <div className="mt-7 grid grid-cols-[1.1fr_1fr] max-[720px]:grid-cols-1 gap-3">
                  <div className={cardCls} style={cardStyle}>
                    <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}>
                      Preview
                    </div>
                    <div className="bg-[#F6F8F5] border border-[#D9E1DB] text-[#0E1512] rounded-[14px_14px_14px_4px] px-[14px] py-3 text-[14px] max-w-[340px]">
                      Hi {'{{first_name}}'}, your favourite tote is back in stock. Want first pick
                      before it goes public?
                      <small className={`block mt-[6px] text-[#52625A] ${MONO_FONT} text-[11px]`}>
                        Template · Approved
                      </small>
                    </div>
                  </div>
                  <div className={cardCls} style={cardStyle}>
                    <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}>
                      Audience and schedule
                    </div>
                    <div className="flex items-center gap-[14px] text-[14.5px] mb-[10px]">
                      <div className="flex-1 min-w-0">
                        <b className="block text-[14.5px]">Tag: Diwali buyers</b>
                        <small className="text-[#52625A] text-[13px]">12,480 contacts</small>
                      </div>
                      <span className={`${pillBase} bg-[#EEF2EE] text-[#2A3731]`}>Fri 6:00 pm</span>
                    </div>
                    <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mt-[14px] mb-2`}>
                      Last campaign
                    </div>
                    <div className="flex items-end gap-[7px] h-[92px] mt-2" aria-hidden="true">
                      {[30, 48, 42, 70, 60, 92].map((h, idx) => (
                        <i
                          key={idx}
                          className="flex-1 rounded-t-[5px] block"
                          style={{
                            height: `${h}%`,
                            backgroundColor: current.accent,
                            opacity: idx % 2 === 0 ? 0.6 : 1,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-[14px] text-[14.5px] mt-3">
                      <span className={`${pillBase} bg-[#D4F5E3] text-[#0B5F37]`}>98% delivered</span>
                      <span className={`${pillBase} bg-[#EEF2EE] text-[#2A3731]`}>64% read</span>
                    </div>
                  </div>
                </div>
                <PaneFooter
                  items={['98% delivered, 64% read', 'Approved templates only', 'Replies land in the inbox']}
                  accent={current.accent}
                />
              </div>

              {/* Pane 2: CRM */}
              <div role="tabpanel" id="pane-2" aria-labelledby="tab-2" hidden={activeTab !== 2}>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11.5px] tracking-[0.07em] px-[11px] py-[5px] rounded-full border-[1.5px] border-[#0E1512] mb-4`}
                  style={{ backgroundColor: current.accent }}
                >
                  BUILT-IN CRM
                </span>
                <h3 className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold max-w-[600px] leading-[1.08] tracking-[-0.035em]`}>
                  A pipeline that fills itself in from chat
                </h3>
                <p className="mt-3 text-[#52625A] max-w-[560px] text-[16.5px]">
                  Tags, orders and stage changes are logged from conversations. Drag a deal forward
                  and the next flow starts.
                </p>
                <div className="mt-7 grid grid-cols-3 max-[720px]:grid-cols-1 gap-3">
                  {[
                    {
                      stage: 'New',
                      deals: [
                        { name: 'Priya Nair', meta: '₹12,000 · Instagram' },
                        { name: 'Dev Patel', meta: '₹4,000 · WhatsApp' },
                      ],
                    },
                    {
                      stage: 'Negotiation',
                      deals: [
                        { name: 'Aanya Sharma', meta: '₹2,490 · WhatsApp' },
                        { name: 'Karan Shah', meta: '₹28,000 · Facebook' },
                      ],
                    },
                    {
                      stage: 'Won',
                      deals: [
                        { name: 'Neha Rao', meta: '₹9,000 · WhatsApp' },
                        { name: 'Arjun Mehta', meta: '₹15,500 · Instagram' },
                      ],
                    },
                  ].map((col) => (
                    <div key={col.stage} className={cardCls} style={cardStyle}>
                      <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}>
                        {col.stage}
                      </div>
                      {col.deals.map((deal) => (
                        <div
                          key={deal.name}
                          className="bg-[#F6F8F5] border border-[#D9E1DB] rounded-[10px] px-[11px] py-[9px] mt-2 text-[14px] text-[#0E1512]"
                        >
                          {deal.name}
                          <small className={`block ${MONO_FONT} text-[11.5px] text-[#52625A]`}>
                            {deal.meta}
                          </small>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <PaneFooter
                  items={['Logged straight from chat', 'Drag a deal, start a flow', 'Custom fields and tags']}
                  accent={current.accent}
                />
              </div>

              {/* Pane 3: Flows */}
              <div role="tabpanel" id="pane-3" aria-labelledby="tab-3" hidden={activeTab !== 3}>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11.5px] tracking-[0.07em] px-[11px] py-[5px] rounded-full border-[1.5px] border-[#0E1512] mb-4`}
                  style={{ backgroundColor: current.accent }}
                >
                  FLOW BUILDER
                </span>
                <h3 className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold max-w-[600px] leading-[1.08] tracking-[-0.035em]`}>
                  Three flows running while the team sleeps
                </h3>
                <p className="mt-3 text-[#52625A] max-w-[560px] text-[16.5px]">
                  Every flow is a plain-language rule. Switch it on, watch the runs, switch it off.
                </p>
                <div className="mt-7 grid gap-3">
                  {[
                    { name: 'Comment "PRICE" → pricing DM', meta: 'Instagram · 1,284 runs this week', live: true },
                    { name: 'Abandoned cart → reminder', meta: 'WhatsApp · 436 runs this week', live: true },
                    { name: 'Order shipped → tracking link', meta: 'WhatsApp · 2,018 runs this week', live: true },
                    { name: 'Review request after delivery', meta: 'Facebook · Draft', live: false },
                  ].map((flow) => (
                    <div key={flow.name} className={`${cardCls} flex items-center gap-[14px] text-[14.5px]`} style={cardStyle}>
                      <div className="flex-1 min-w-0">
                        <b className="block text-[14.5px]">{flow.name}</b>
                        <small className="text-[#52625A] text-[13px]">{flow.meta}</small>
                      </div>
                      <span
                        className={`${pillBase} ${
                          flow.live ? 'bg-[#D4F5E3] text-[#0B5F37]' : 'bg-[#EEF2EE] text-[#2A3731]'
                        }`}
                      >
                        {flow.live ? 'Live' : 'Paused'}
                      </span>
                    </div>
                  ))}
                </div>
                <PaneFooter
                  items={['No-code builder', 'Branches, delays, retries', 'Every run logged']}
                  accent={current.accent}
                />
              </div>

              {/* Pane 4: AI Agents */}
              <div role="tabpanel" id="pane-4" aria-labelledby="tab-4" hidden={activeTab !== 4}>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11.5px] tracking-[0.07em] px-[11px] py-[5px] rounded-full border-[1.5px] border-[#0E1512] mb-4`}
                  style={{ backgroundColor: current.accent }}
                >
                  AI AGENTS
                </span>
                <h3 className={`${DISPLAY_FONT} text-[clamp(24px,2.6vw,34px)] font-bold max-w-[600px] leading-[1.08] tracking-[-0.035em]`}>
                  Answers that cite your own policies
                </h3>
                <p className="mt-3 text-[#52625A] max-w-[560px] text-[16.5px]">
                  Agents read your catalogue, FAQs and shipping rules. When unsure, they hand over
                  with the full thread.
                </p>
                <div className="mt-7 grid gap-3">
                  <div className={cardCls} style={cardStyle}>
                    <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}>
                      Customer asked
                    </div>
                    <div className="bg-[#F6F8F5] border border-[#D9E1DB] text-[#0E1512] rounded-[14px_14px_14px_4px] px-[14px] py-3 text-[14px] max-w-[340px]">
                      Do you ship to Pune, and how long does it take?
                    </div>
                  </div>
                  <div className={cardCls} style={cardStyle}>
                    <div className={`${MONO_FONT} font-medium text-[11px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}>
                      Parsona AI replied
                    </div>
                    <div className="bg-[#D4F5E3] border border-[#D9E1DB] text-[#0E1512] rounded-[14px_14px_14px_4px] px-[14px] py-3 text-[14px] max-w-[340px]">
                      Yes. Delivery to Pune takes 2 to 3 working days, and shipping is free above
                      ₹999.
                    </div>
                    <div className={`inline-flex gap-[6px] items-center ${MONO_FONT} text-[11.5px] text-[#52625A] mt-2`}>
                      Source: Shipping policy · confidence 96%
                    </div>
                  </div>
                  <div className={`${cardCls} flex items-center gap-[14px] text-[14.5px]`} style={cardStyle}>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[14.5px]">Handoff rule</b>
                      <small className="text-[#52625A] text-[13px]">
                        Refunds, damaged items and anything below 70% confidence go to a person.
                      </small>
                    </div>
                    <span className={`${pillBase} bg-[#D4F5E3] text-[#0B5F37]`}>On</span>
                  </div>
                </div>
                <PaneFooter
                  items={['Cites your own policies', 'Hands off below 70% confidence', 'Replies 24 / 7']}
                  accent={current.accent}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

