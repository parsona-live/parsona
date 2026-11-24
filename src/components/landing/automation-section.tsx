'use client'

import React from 'react'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { FadeUp, TextReveal } from './motion'

const RUN_LOG = [
  { time: '19:41:02', text: 'Comment matched “PRICE”', ok: true },
  { time: '19:41:03', text: 'DM sent to @rohit.k', ok: true },
  { time: '19:41:44', text: 'Customer replied: “around 15k”', ok: false },
  { time: '19:41:45', text: 'AI parsed budget = ₹15,000', ok: true },
  { time: '19:41:45', text: 'Condition met: over ₹10,000', ok: false },
  { time: '19:41:46', text: 'Tagged Hot lead, assigned to Rohan', ok: true },
]

const FLOW_TRIGGERS = [
  'Comment keyword',
  'Story reply',
  'New follower',
  'Order placed',
  'Cart abandoned',
  'Tag added',
  'Schedule',
]

const FLOW_ACTIONS = ['Send DM', 'Send template', 'Ask AI', 'Tag', 'Assign', 'Wait', 'Webhook']

export function AutomationSection() {
  return (
    <section id="automation" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Automation" count={1} />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="Describe it like a sentence." />
              <br />
              <HighlightBubble bgClass="bg-[var(--surface-green)] text-[var(--brand-primary)]" delay={0.24}>
                It runs like a machine.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.18} distance={14}>
              <p className="mt-5 text-[18px] max-[720px]:text-[17px] text-[var(--text-body)] max-w-[560px] mx-auto leading-[1.6]">
                Build a flow by stacking plain-language steps. Every run is logged, so you can see
                exactly what happened and when.
              </p>
            </FadeUp>
          </div>

          {/* Visual Flow Canvas */}
          <FadeUp delay={0.12} distance={26}>
            <div className="mt-14 bg-white [background-image:radial-gradient(#D4D8DF_1px,transparent_1.2px)] [background-size:16px_16px] border border-[var(--border)] rounded-[20px] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex justify-between items-center gap-4 flex-wrap px-6 py-[18px] max-[720px]:px-[18px] max-[720px]:py-4 bg-white border-b border-[var(--border)]">
              <div>
                <b className={`block ${DISPLAY_FONT} text-[20px] font-semibold tracking-[-0.025em] text-[var(--text-heading)]`}>
                  Comment to qualified lead
                </b>
                <small className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
                  Starts when someone comments a keyword on an Instagram post
                </small>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className={`${MONO_FONT} font-medium text-[12px] px-[11px] py-[5px] rounded-full bg-[var(--success-bg)] text-[var(--success)]`}>
                  ● Live
                </span>
                <span className={`${MONO_FONT} font-medium text-[12px] px-[11px] py-[5px] rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]`}>
                  1,284 runs this week
                </span>
                <span className={`${MONO_FONT} font-medium text-[12px] px-[11px] py-[5px] rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]`}>
                  Edited 2 days ago
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pt-[22px] px-[14px] pb-[14px]">
              <svg
                viewBox="0 0 1160 400"
                role="img"
                aria-label="Automation flow: Instagram comment triggers a pricing DM, AI asks for budget, then a condition splits hot leads to Sales and others to a delayed offer template"
                className={`block min-w-[980px] w-full h-auto ${MONO_FONT}`}
              >
                <path d="M214 150H254" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path pathLength={100} d="M214 150H254" fill="none" stroke="#0B3B2E" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="30 70" className="animate-[landing-fdash_2.4s_linear_infinite]" style={{ animationDelay: '0s' }} />
                <path d="M444 150H484" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path pathLength={100} d="M444 150H484" fill="none" stroke="#0B3B2E" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="30 70" className="animate-[landing-fdash_2.4s_linear_infinite]" style={{ animationDelay: '0.5s' }} />
                <path d="M674 150H714" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path pathLength={100} d="M674 150H714" fill="none" stroke="#8066A8" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="30 70" className="animate-[landing-fdash_2.4s_linear_infinite]" style={{ animationDelay: '1s' }} />
                <path d="M904 150H924V66H944" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path pathLength={100} d="M904 150H924V66H944" fill="none" stroke="#0B3B2E" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="14 86" className="animate-[landing-fdash_2.4s_linear_infinite]" style={{ animationDelay: '1.5s' }} />
                <path d="M904 150H924V232H944" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path pathLength={100} d="M904 150H924V232H944" fill="none" stroke="#8FA99B" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="14 86" className="animate-[landing-fdash_2.4s_linear_infinite]" style={{ animationDelay: '1.5s' }} />
                <path d="M1039 274V294" fill="none" stroke="#D4D8DF" strokeWidth="1.5" strokeDasharray="3 4" />
                <path pathLength={100} d="M1039 274V294" fill="none" stroke="#0B3B2E" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="40 60" className="animate-[landing-fdash_2.4s_linear_infinite]" style={{ animationDelay: '2.4s' }} />

                {/* Node Cards */}
                <g transform="translate(24 108)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#D4D8DF" strokeWidth="1.5" />
                  <rect x="14" y="12" width="59" height="18" rx="9" fill="#E6F0EC" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#0B3B2E] font-medium">TRIGGER</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">1,284</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Comment has “PRICE”</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">Instagram · any post</text>
                </g>

                <g transform="translate(254 108)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#D4D8DF" strokeWidth="1.5" />
                  <rect x="14" y="12" width="52" height="18" rx="9" fill="#0B3B2E" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#FFFFFF] font-medium">ACTION</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">1,241</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Send pricing card</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">DM · sent in 1.2 s</text>
                </g>

                <g transform="translate(484 108)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#CFC3FF" strokeWidth="1.5" />
                  <rect x="14" y="12" width="27" height="18" rx="9" fill="#CFC3FF" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#30245A] font-medium">AI</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">1,102</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Ask for budget</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">AI parses “around 15k”</text>
                </g>

                <g transform="translate(714 108)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#D4D8DF" strokeWidth="1.5" />
                  <rect x="14" y="12" width="72" height="18" rx="9" fill="#F3F0FF" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#43336F] font-medium">CONDITION</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">964</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Budget over ₹10,000?</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">Parsed budget: ₹15,000</text>
                </g>

                <g transform="translate(944 24)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#0B3B2E" strokeWidth="1.5" />
                  <rect x="14" y="12" width="52" height="18" rx="9" fill="#0B3B2E" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#FFFFFF] font-medium">ACTION</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">612</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Tag as Hot lead</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">Sales team · alert Rohan</text>
                </g>

                <g transform="translate(944 190)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#D4D8DF" strokeWidth="1.5" />
                  <rect x="14" y="12" width="40" height="18" rx="9" fill="#F5F6F8" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#353536] font-medium">WAIT</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">352</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Wait 1 day</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">Then continue the flow</text>
                </g>

                <g transform="translate(944 294)">
                  <rect width="190" height="84" rx="14" fill="#fff" stroke="#D4D8DF" strokeWidth="1.5" />
                  <rect x="14" y="12" width="52" height="18" rx="9" fill="#E6F0EC" />
                  <text x="21" y="24.5" className="text-[9.5px] tracking-[0.06em] fill-[#0B3B2E] font-medium">ACTION</text>
                  <text x="176" y="25" textAnchor="end" className="text-[10px] fill-[#52625A]">340</text>
                  <text x="14" y="52" className={`${DISPLAY_FONT} font-semibold text-[14px] tracking-[-0.01em] fill-[#080808]`}>Send offer template</text>
                  <text x="14" y="70" className="text-[10.5px] fill-[#52625A]">WhatsApp · approved</text>
                </g>

                <rect x="906" y="99" width="36" height="18" rx="9" fill="#E8F5ED" stroke="#18794E" strokeWidth="0.75" />
                <text x="924" y="111.5" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#18794E] font-medium">YES</text>
                <rect x="906" y="183" width="36" height="18" rx="9" fill="#F5F6F8" stroke="#D4D8DF" />
                <text x="924" y="195.5" textAnchor="middle" className="text-[9.5px] tracking-[0.06em] fill-[#52625A] font-medium">NO</text>

                {[
                  [24, 150],
                  [214, 150],
                  [254, 150],
                  [444, 150],
                  [484, 150],
                  [674, 150],
                  [714, 150],
                  [904, 150],
                  [944, 66],
                  [944, 232],
                  [1039, 274],
                  [1039, 294],
                ].map(([cx, cy], idx) => (
                  <circle key={idx} cx={cx} cy={cy} r="4.5" fill="#fff" stroke="#0B3B2E" strokeWidth="1.5" />
                ))}
              </svg>
            </div>
          </div>

          {/* Bottom Run Log + Stats + Triggers */}
          <div className="grid grid-cols-[1.1fr_1fr] max-[1100px]:grid-cols-1 gap-5 mt-5 items-start">
            <div className={`bg-white border border-[var(--border)] rounded-[18px] px-[26px] py-6 shadow-[var(--shadow-card)] ${MONO_FONT} text-[13px] leading-[1.95] text-[var(--text-body)]`}>
              <h4 className="font-medium text-[12px] tracking-[0.06em] uppercase text-[var(--text-secondary)] mb-3 flex justify-between gap-3">
                <span>Run log</span>
                <span>Today</span>
              </h4>
              {RUN_LOG.map((entry, idx) => (
                <p key={idx} className="grid grid-cols-[76px_1fr] gap-[10px]">
                  <time className="text-[var(--text-secondary)]">{entry.time}</time>
                  <span>
                    {entry.text}{' '}
                    {entry.ok && (
                      <em className="not-italic font-medium text-[var(--success)] bg-[var(--success-bg)] rounded-[5px] px-[6px] text-[11.5px]">
                        ok
                      </em>
                    )}
                  </span>
                </p>
              ))}
            </div>

            <div className="grid gap-5 content-start">
              <div className="grid grid-cols-3 max-[720px]:grid-cols-1 gap-3">
                <div className="bg-white border border-[var(--border)] rounded-[18px] px-[18px] py-4 shadow-[var(--shadow-card)]">
                  <b className={`block font-bold text-[30px] ${DISPLAY_FONT} tracking-[-0.04em] leading-[1.1] text-[var(--brand-primary)]`}>96%</b>
                  <small className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>runs completed</small>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[18px] px-[18px] py-4 shadow-[var(--shadow-card)]">
                  <b className={`block font-bold text-[30px] ${DISPLAY_FONT} tracking-[-0.04em] leading-[1.1] text-[var(--text-heading)]`}>1.2 s</b>
                  <small className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>avg first response</small>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[18px] px-[18px] py-4 shadow-[var(--shadow-card)]">
                  <b className={`block font-bold text-[30px] ${DISPLAY_FONT} tracking-[-0.04em] leading-[1.1] text-[var(--text-heading)]`}>0</b>
                  <small className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>retries needed today</small>
                </div>
              </div>

              <div className="bg-white border border-[var(--border)] rounded-[18px] px-6 py-[22px] shadow-[var(--shadow-card)]">
                <h4 className={`${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[var(--text-secondary)] mb-3`}>
                  Start a flow from
                </h4>
                <div className="flex gap-[6px] flex-wrap">
                  {FLOW_TRIGGERS.map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-body)]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <h4 className={`${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[var(--text-secondary)] mt-[18px] mb-3`}>
                  Then do
                </h4>
                <div className="flex gap-[6px] flex-wrap">
                  {FLOW_ACTIONS.map((chip) => (
                    <span
                      key={chip}
                      className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-body)]`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

