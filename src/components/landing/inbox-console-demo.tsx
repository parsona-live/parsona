'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DISPLAY_FONT, MONO_FONT } from './shared'

type ThreadMessage = {
  id: string
  sender: 'in' | 'out' | 'event' | 'confirmed'
  who?: string
  text: string
  meta?: string
}

type ContactThread = {
  id: string
  initials: string
  bg: string
  channel: 'WhatsApp' | 'Instagram' | 'Facebook'
  channelDot: string
  name: string
  handle: string
  preview: string
  time: string
  unread?: number
  assignedTo: string
  since: string
  tags: Array<{ label: string; hot?: boolean }>
  ltv: string
  orders: number
  stage: string
  returns: number
  summary: string
  initialMessages: ThreadMessage[]
}

const INITIAL_CONTACTS: ContactThread[] = [
  {
    id: 'aanya',
    initials: 'AS',
    bg: '#E6F0EC',
    channel: 'WhatsApp',
    channelDot: 'bg-[#25D366]',
    name: 'Aanya Sharma',
    handle: '+91 98•• ••210',
    preview: 'Can I pay on delivery?',
    time: '2m',
    unread: 2,
    assignedTo: 'Rohan',
    since: 'Mar 2025',
    tags: [
      { label: 'Hot lead', hot: true },
      { label: 'Diwali buyer' },
      { label: 'COD' },
    ],
    ltv: '₹18,240',
    orders: 6,
    stage: 'Negotiation',
    returns: 0,
    summary:
      'Repeat buyer asking about cash on delivery for kurta set (M). Low return risk. Best next step: confirm order and share the tracking link.',
    initialMessages: [
      {
        id: 'e1',
        sender: 'event',
        text: 'Instagram story reply → catalogue sent · Mon 10:12',
      },
      {
        id: 'm1',
        sender: 'in',
        text: 'Hi, is the cotton kurta set available in M? I need it by Friday.',
      },
      {
        id: 'm2',
        sender: 'out',
        who: 'Parsona AI',
        text: 'Hi Aanya! Yes, size M is in stock and reaches you by Thursday. Shall I hold it?',
      },
      {
        id: 'm3',
        sender: 'in',
        text: 'Yes please. Can I pay on delivery?',
      },
      {
        id: 'm4',
        sender: 'out',
        who: 'Parsona AI · Payments',
        text: 'Yes! Cash on delivery is available at ₹0 extra fee. I have reserved the kurta set in size M for you.',
      },
    ],
  },
  {
    id: 'rohit',
    initials: 'RK',
    bg: '#F3F0FF',
    channel: 'Instagram',
    channelDot: 'bg-[#D62976]',
    name: 'Rohit Kapoor',
    handle: '@rohit.k',
    preview: 'What is the combo price?',
    time: '6m',
    unread: 1,
    assignedTo: 'Rohan',
    since: 'Aug 2025',
    tags: [{ label: 'IG Comment', hot: true }, { label: 'Combo' }],
    ltv: '₹6,400',
    orders: 2,
    stage: 'Qualified',
    returns: 0,
    summary:
      'Commented "PRICE" on festive reel. Budget parsed around ₹15,000. High intent for festive combo pack.',
    initialMessages: [
      {
        id: 're1',
        sender: 'event',
        text: 'Commented "PRICE" on reel → DM triggered · 6m ago',
      },
      {
        id: 'rm1',
        sender: 'in',
        text: 'What is the combo price? Looking for around 15k for family gifts.',
      },
      {
        id: 'rm2',
        sender: 'out',
        who: 'Parsona AI · Catalogue',
        text: 'The festive combo is ₹3,990 (save ₹800) with free express delivery. Want me to send the checkout link?',
      },
    ],
  },
  {
    id: 'meera',
    initials: 'MJ',
    bg: '#EAF2FF',
    channel: 'Facebook',
    channelDot: 'bg-[#1877F2]',
    name: 'Meera Joshi',
    handle: 'Messenger',
    preview: 'Can I move my slot to Monday?',
    time: '14m',
    assignedTo: 'Priya',
    since: 'Jan 2025',
    tags: [{ label: 'Booking' }, { label: 'VIP' }],
    ltv: '₹12,500',
    orders: 4,
    stage: 'Booked',
    returns: 0,
    summary:
      'Requesting to reschedule consultation from Saturday to Monday morning. 11:00 AM slot is open.',
    initialMessages: [
      {
        id: 'me1',
        sender: 'event',
        text: 'Appointment reminder delivered · Today 09:00',
      },
      {
        id: 'mm1',
        sender: 'in',
        text: 'Can I move my slot to Monday?',
      },
      {
        id: 'mm2',
        sender: 'out',
        who: 'Parsona AI · Bookings',
        text: 'Of course! Monday 11:00 AM is available. Shall I move your booking and send a WhatsApp reminder?',
      },
    ],
  },
  {
    id: 'dev',
    initials: 'DP',
    bg: '#F5F6F8',
    channel: 'WhatsApp',
    channelDot: 'bg-[#25D366]',
    name: 'Dev Patel',
    handle: '+91 97•• ••841',
    preview: 'Invoice received, thank you',
    time: '1h',
    assignedTo: 'Priya',
    since: 'Nov 2024',
    tags: [{ label: 'Repeat' }, { label: 'Paid' }],
    ltv: '₹24,100',
    orders: 8,
    stage: 'Won',
    returns: 0,
    summary: 'Order #4815 paid via UPI and GST invoice auto-sent through WhatsApp template.',
    initialMessages: [
      {
        id: 'de1',
        sender: 'event',
        text: 'Approved template: GST Invoice #4815 sent',
      },
      {
        id: 'dm1',
        sender: 'in',
        text: 'Invoice received, thank you',
      },
    ],
  },
  {
    id: 'isha',
    initials: 'IV',
    bg: '#E5DEFF',
    channel: 'Instagram',
    channelDot: 'bg-[#D62976]',
    name: 'Isha Verma',
    handle: '@isha.v',
    preview: 'AI: It ships in 2 to 3 days',
    time: '2h',
    assignedTo: 'AI Agent',
    since: 'Oct 2025',
    tags: [{ label: 'AI resolved' }],
    ltv: '₹4,290',
    orders: 1,
    stage: 'Support',
    returns: 0,
    summary: 'AI answered Pune delivery SLA from shipping policy with 96% confidence.',
    initialMessages: [
      {
        id: 'im1',
        sender: 'in',
        text: 'Do you ship to Pune, and how long does it take?',
      },
      {
        id: 'im2',
        sender: 'out',
        who: 'Parsona AI · Shipping policy',
        text: 'Yes! Delivery to Pune takes 2 to 3 working days, and shipping is free above ₹999.',
      },
    ],
  },
]

const QUICK_QUESTIONS = [
  'Delivery to Pune?',
  'Return policy?',
  'Combo price?',
  'Talk to human',
] as const

const uid = () => Math.random().toString(36).slice(2, 10)

function IconReset({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function getSmartAiReply(question: string): { who: string; text: string } {
  const q = question.toLowerCase()
  if (q.includes('pune') || q.includes('ship') || q.includes('deliver')) {
    return {
      who: 'Parsona AI · Shipping policy',
      text: 'Delivery to Pune and major metros takes 2 to 3 working days, and shipping is free above ₹999. Tracking links are sent automatically on WhatsApp.',
    }
  }
  if (q.includes('return') || q.includes('refund') || q.includes('exchange')) {
    return {
      who: 'Parsona AI · Return policy',
      text: 'We offer easy 7-day exchanges and returns. For damaged items or refunds, I immediately hand the thread over to Rohan with your full order history.',
    }
  }
  if (q.includes('combo') || q.includes('price') || q.includes('cost') || q.includes('discount')) {
    return {
      who: 'Parsona AI · Catalogue',
      text: 'The cotton kurta set is ₹2,490 and the festive combo pack is ₹3,990 (save ₹800). Both qualify for free express shipping and COD.',
    }
  }
  if (q.includes('human') || q.includes('agent') || q.includes('person') || q.includes('support')) {
    return {
      who: 'Parsona AI · Handoff to Rohan',
      text: 'Done! I have assigned this chat to Rohan with a full summary of your conversation. He usually replies in under 2 minutes.',
    }
  }
  if (q.includes('cod') || q.includes('cash') || q.includes('upi') || q.includes('pay')) {
    return {
      who: 'Parsona AI · Payments',
      text: 'Yes, both Cash on Delivery (₹0 extra fee) and instant UPI links are supported right inside WhatsApp.',
    }
  }
  return {
    who: 'Parsona AI · Knowledge base',
    text: 'Size M is ready to dispatch today with free shipping and COD available. Would you like me to confirm your order and share the tracking link?',
  }
}

export function InboxConsoleDemo({ embedded = false }: { embedded?: boolean } = {}) {
  const [activeId, setActiveId] = useState<string>('aanya')
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>(() =>
    Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.initialMessages]))
  )
  const [aanyaOrderStep, setAanyaOrderStep] = useState<'ready' | 'confirmed'>('ready')
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const sessionRef = useRef(0)

  const contact = INITIAL_CONTACTS.find((c) => c.id === activeId) ?? INITIAL_CONTACTS[0]
  const currentMessages = threads[contact.id] ?? []
  const currentMessagesCount = currentMessages.length

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [currentMessagesCount, isTyping, aanyaOrderStep, activeId])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const session = sessionRef.current
    const id = setTimeout(() => {
      if (session === sessionRef.current) fn()
    }, ms)
    timersRef.current.push(id)
  }, [])

  const appendMessage = useCallback((contactId: string, msg: ThreadMessage) => {
    setThreads((prev) => ({
      ...prev,
      [contactId]: [...(prev[contactId] ?? []), msg],
    }))
  }, [])

  const handleConfirmOrder = () => {
    if (aanyaOrderStep !== 'ready' || isTyping) return
    setIsTyping(true)
    schedule(() => {
      appendMessage('aanya', {
        id: uid(),
        sender: 'confirmed',
        who: 'Order #4822 Confirmed',
        text: 'Cotton Kurta Set (M) · ₹2,490 · Cash on Delivery',
        meta: 'WhatsApp tracking template queued · CRM updated to Won',
      })
      setAanyaOrderStep('confirmed')
      setIsTyping(false)
    }, 600)
  }

  const handleAskQuestion = (questionText?: string) => {
    const text = (questionText ?? inputValue).trim()
    if (!text || isTyping) return

    const targetId = contact.id
    if (questionText === undefined) setInputValue('')

    appendMessage(targetId, {
      id: uid(),
      sender: 'in',
      text,
    })
    setIsTyping(true)

    const aiReply = getSmartAiReply(text)
    schedule(() => {
      appendMessage(targetId, {
        id: uid(),
        sender: 'out',
        who: aiReply.who,
        text: aiReply.text,
      })
      setIsTyping(false)
    }, 650)
  }

  const handleResetConversation = () => {
    sessionRef.current += 1
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setThreads((prev) => ({ ...prev, [contact.id]: contact.initialMessages }))
    if (contact.id === 'aanya') setAanyaOrderStep('ready')
    setIsTyping(false)
    setInputValue('')
  }

  const handleReset = () => {
    sessionRef.current += 1
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setThreads(Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.initialMessages])))
    setAanyaOrderStep('ready')
    setIsTyping(false)
    setInputValue('')
  }

  const hasConversationChanged =
    currentMessages.length !== contact.initialMessages.length ||
    (contact.id === 'aanya' && aanyaOrderStep !== 'ready')

  const displayLtv =
    contact.id === 'aanya' && aanyaOrderStep === 'confirmed' ? '₹20,730' : contact.ltv
  const displayOrders =
    contact.id === 'aanya' && aanyaOrderStep === 'confirmed' ? contact.orders + 1 : contact.orders
  const displayStage =
    contact.id === 'aanya' && aanyaOrderStep === 'confirmed' ? 'Won' : contact.stage

  return (
    <div className={embedded ? 'relative' : 'relative mt-9 max-[720px]:mt-7'}>
      <div
        className="bg-white border border-[var(--border)] rounded-[20px] overflow-hidden shadow-[var(--shadow-card)]"
        aria-label="Interactive preview of the Parsona team inbox"
      >
        {/* Browser Bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-secondary)]">
          <i className="w-[10px] h-[10px] rounded-full bg-[var(--border-strong)]" />
          <i className="w-[10px] h-[10px] rounded-full bg-[var(--border-strong)]" />
          <i className="w-[10px] h-[10px] rounded-full bg-[var(--border-strong)]" />
          <span className={`mx-auto ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
            app.parsona.com/inbox
          </span>
          <button
            type="button"
            onClick={handleReset}
            title="Reset entire inbox demo"
            className={`inline-flex items-center gap-1.5 ${MONO_FONT} text-[11px] font-medium text-[var(--brand-primary)] hover:text-[var(--text-primary)] px-2.5 py-1 rounded-md border border-[var(--border)] bg-white hover:bg-[var(--surface-green)] transition-colors cursor-pointer shrink-0`}
          >
            <IconReset className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-[310px_minmax(0,1fr)_290px] min-h-[580px] max-[1100px]:grid-cols-[280px_minmax(0,1fr)] max-[720px]:grid-cols-1">
          {/* Left Conversation List (Desktop / Tablet) */}
          <aside className="border-r border-[var(--border)] max-[720px]:hidden">
            <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
              <b className={`${DISPLAY_FONT} text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-heading)]`}>Inbox</b>
              <span
                className={`min-w-[20px] h-5 rounded-full bg-[var(--error)] text-white ${MONO_FONT} font-medium text-[11px] inline-grid place-items-center px-[6px]`}
              >
                11
              </span>
            </div>
            <div className={`flex gap-[6px] px-[18px] pb-3 ${MONO_FONT} font-medium text-[12px]`}>
              <span className="px-[9px] py-[5px] rounded-[8px] bg-[var(--brand-primary)] text-white">Mine 3</span>
              <span className="px-[9px] py-[5px] rounded-[8px] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                Open 8
              </span>
              <span className="px-[9px] py-[5px] rounded-[8px] bg-[var(--surface-lavender)] text-[var(--accent-text)]">
                AI 41
              </span>
            </div>

            {INITIAL_CONTACTS.map((c) => {
              const isSelected = c.id === activeId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left flex gap-3 px-[18px] py-[13px] border-t border-[var(--border)] items-center transition-colors cursor-pointer ${
                    isSelected ? 'bg-[var(--surface-green)]' : 'bg-white hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  <div
                    className="relative w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] shrink-0 text-[var(--text-heading)]"
                    style={{ background: c.bg }}
                  >
                    {c.initials}
                    <span
                      className={`absolute -right-[2px] -bottom-[2px] w-[14px] h-[14px] rounded-full border-2 border-white ${c.channelDot}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[14.5px] leading-[1.25] text-[var(--text-heading)]">{c.name}</b>
                    <span className="block text-[13px] text-[var(--text-secondary)] whitespace-nowrap overflow-hidden text-ellipsis">
                      {c.preview}
                    </span>
                  </div>
                  <div
                    className={`grid justify-items-end gap-[5px] ${MONO_FONT} text-[11.5px] text-[var(--text-secondary)]`}
                  >
                    <span>{c.time}</span>
                    {c.unread && !isSelected && (
                      <span className="min-w-[20px] h-5 rounded-full bg-[var(--error)] text-white font-medium text-[11px] inline-grid place-items-center px-[6px]">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </aside>

          {/* Center Interactive Thread */}
          <div className="flex flex-col bg-[var(--surface-secondary)] min-w-0">
            {/* Thread Header */}
            <div className="flex items-center justify-between gap-3 px-5 max-[720px]:px-4 py-[14px] bg-white border-b border-[var(--border)]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="relative w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] shrink-0 text-[var(--text-heading)]"
                  style={{ background: contact.bg }}
                >
                  {contact.initials}
                  <span
                    className={`absolute -right-[2px] -bottom-[2px] w-[14px] h-[14px] rounded-full border-2 border-white ${contact.channelDot}`}
                  />
                </div>
                <div className="min-w-0">
                  <b className="block text-[15.5px] leading-[1.2] text-[var(--text-heading)] truncate">
                    {contact.name}
                  </b>
                  <small className={`block ${MONO_FONT} text-[12px] text-[var(--text-secondary)] whitespace-nowrap truncate`}>
                    {contact.channel} · {contact.handle}
                  </small>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap justify-end shrink-0 max-[720px]:flex-col max-[720px]:items-end">
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2.5 py-[3px] rounded-full tracking-[0.02em] bg-[var(--accent-primary)] text-[#30245A] whitespace-nowrap`}
                >
                  {isTyping ? 'AI typing…' : 'AI active'}
                </span>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2.5 py-[3px] rounded-full tracking-[0.02em] bg-[var(--surface-green)] text-[var(--brand-primary)] whitespace-nowrap`}
                >
                  Assigned: {contact.assignedTo}
                </span>
              </div>
            </div>

            {/* Scrollable Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 h-[390px] max-[720px]:h-[360px] overflow-y-auto no-scrollbar px-5 max-[720px]:px-4 py-5 flex flex-col gap-[11px]"
            >
              {currentMessages.map((msg) => {
                if (msg.sender === 'event') {
                  return (
                    <div
                      key={msg.id}
                      className={`self-center text-center ${MONO_FONT} text-[11.5px] text-[var(--text-secondary)] border border-dashed border-[var(--border-strong)] rounded-lg px-[11px] py-[5px] bg-white`}
                    >
                      {msg.text}
                    </div>
                  )
                }

                if (msg.sender === 'confirmed') {
                  return (
                    <div
                      key={msg.id}
                      className="max-w-[84%] max-[720px]:max-w-[94%] self-end bg-[var(--success-bg)] border border-[var(--success)]/30 rounded-[14px] rounded-tr-[4px] px-4 py-3 text-[14px]"
                    >
                      <span
                        className={`flex items-center gap-1.5 ${MONO_FONT} font-semibold text-[11px] uppercase tracking-[0.05em] text-[var(--success)] mb-1`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--success)" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12l3 3 5-6" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {msg.who}
                      </span>
                      <div className="font-semibold text-[var(--text-heading)]">{msg.text}</div>
                      {msg.meta && (
                        <div className={`mt-1.5 pt-1.5 border-t border-[var(--success)]/20 ${MONO_FONT} text-[11px] text-[var(--brand-primary)]`}>
                          {msg.meta}
                        </div>
                      )}
                    </div>
                  )
                }

                if (msg.sender === 'in') {
                  return (
                    <div
                      key={msg.id}
                      className="max-w-[80%] max-[720px]:max-w-[90%] px-[15px] py-[11px] rounded-[14px] rounded-tl-[4px] text-[14.5px] leading-[1.45] bg-white border border-[var(--border)] self-start text-[var(--text-body)]"
                    >
                      {msg.text}
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className="max-w-[80%] max-[720px]:max-w-[90%] px-[15px] py-[11px] rounded-[14px] rounded-tr-[4px] text-[14.5px] leading-[1.45] bg-[var(--surface-green)] border border-[var(--brand-primary)]/15 self-end text-[var(--text-primary)]"
                  >
                    {msg.who && (
                      <span
                        className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.05em] uppercase text-[var(--brand-primary)] mb-1`}
                      >
                        {msg.who}
                      </span>
                    )}
                    {msg.text}
                  </div>
                )
              })}

              {/* Interactive Order Confirm Step (Aanya flow) */}
              {contact.id === 'aanya' && aanyaOrderStep === 'ready' && !isTyping && (
                <div className="max-w-[84%] max-[720px]:max-w-[94%] self-end bg-white border border-[var(--border)] rounded-[14px] rounded-tr-[4px] p-3.5 shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between gap-3 text-[13.5px] mb-2.5">
                    <b className="text-[var(--text-heading)]">Cotton Kurta Set (Size M)</b>
                    <span className={`${MONO_FONT} font-semibold text-[var(--brand-primary)]`}>₹2,490 · COD</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    className="w-full h-9 text-[13px] rounded-[10px] bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold transition-colors cursor-pointer"
                  >
                    Confirm COD Order &amp; Send Tracking
                  </button>
                </div>
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div
                  className="self-start flex gap-1 px-[14px] py-3 bg-white border border-[var(--border)] rounded-[14px] rounded-tl-[4px]"
                  role="status"
                  aria-label="Parsona AI is typing"
                >
                  <i className="w-[6px] h-[6px] rounded-full bg-[var(--text-muted)] animate-[landing-blink_1.2s_infinite]" />
                  <i
                    className="w-[6px] h-[6px] rounded-full bg-[var(--text-muted)] animate-[landing-blink_1.2s_infinite]"
                    style={{ animationDelay: '0.15s' }}
                  />
                  <i
                    className="w-[6px] h-[6px] rounded-full bg-[var(--text-muted)] animate-[landing-blink_1.2s_infinite]"
                    style={{ animationDelay: '0.3s' }}
                  />
                </div>
              )}
            </div>

            {/* Quick Q&A Chips + Interactive Input Bar */}
            <div className="bg-white border-t border-[var(--border)] px-5 max-[720px]:px-4 pt-2.5 pb-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`${MONO_FONT} text-[10.5px] uppercase tracking-[0.05em] text-[var(--text-secondary)]`}>
                  Try asking:
                </span>
                <button
                  type="button"
                  onClick={handleResetConversation}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full border ${MONO_FONT} text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    hasConversationChanged
                      ? 'bg-[var(--surface-green)] border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-[var(--surface-green)]'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-green)] hover:text-[var(--brand-primary)]'
                  }`}
                >
                  <IconReset className="w-3 h-3" />
                  <span>Reset conversation</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handleAskQuestion(q)}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-green)] border border-[var(--border)] ${MONO_FONT} text-[11.5px] font-medium text-[var(--brand-primary)] transition-colors cursor-pointer disabled:opacity-50`}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAskQuestion()
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  maxLength={260}
                  placeholder="Ask a customer question to test Parsona AI…"
                  aria-label="Ask Parsona AI a question"
                  className="flex-1 min-w-0 h-10 rounded-[10px] border border-[var(--border)] focus:border-[var(--brand-primary)] bg-white px-3.5 text-[14px] text-[var(--text-body)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-3 focus:ring-[var(--focus-ring)]/15 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isTyping || !inputValue.trim()}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold text-[13.5px] transition-colors cursor-pointer disabled:opacity-45 shrink-0"
                >
                  Ask AI
                </button>
              </form>
            </div>
          </div>

          {/* Right Customer Profile (Desktop) */}
          <aside className="border-l border-[var(--border)] px-5 py-[22px] flex flex-col gap-[18px] max-[1100px]:hidden">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full grid place-items-center font-bold text-[15px] shrink-0 text-[var(--text-heading)]"
                style={{ background: contact.bg }}
              >
                {contact.initials}
              </div>
              <div>
                <b className={`block ${DISPLAY_FONT} text-[17px] font-semibold tracking-[-0.02em] leading-[1.15] text-[var(--text-heading)]`}>
                  {contact.name}
                </b>
                <small className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}>
                  Customer since {contact.since}
                </small>
              </div>
            </div>

            <div className="flex gap-[6px] flex-wrap">
              {contact.tags.map((tag) => (
                <span
                  key={tag.label}
                  className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-full ${
                    tag.hot ? 'bg-[var(--surface-lavender)] text-[var(--accent-text)]' : 'bg-[var(--surface-green)] text-[var(--brand-primary)]'
                  }`}
                >
                  {tag.label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div className="bg-[var(--surface-secondary)] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[var(--text-secondary)]`}>
                  Lifetime value
                </small>
                <b className={`${DISPLAY_FONT} text-[19px] font-semibold tracking-[-0.03em] text-[var(--text-heading)]`}>{displayLtv}</b>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[var(--text-secondary)]`}>Orders</small>
                <b className={`${DISPLAY_FONT} text-[19px] font-semibold tracking-[-0.03em] text-[var(--text-heading)]`}>{displayOrders}</b>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div className="bg-[var(--surface-secondary)] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[var(--text-secondary)]`}>Stage</small>
                <b className={`${DISPLAY_FONT} text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-heading)]`}>{displayStage}</b>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[var(--text-secondary)]`}>Returns</small>
                <b className={`${DISPLAY_FONT} text-[19px] font-semibold tracking-[-0.03em] text-[var(--text-heading)]`}>
                  {contact.returns}
                </b>
              </div>
            </div>

            <div className="text-[13.5px] leading-[1.5] text-[var(--text-body)] border-t border-[var(--border)] pt-[14px]">
              <small
                className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.06em] uppercase text-[var(--brand-primary)] mb-[6px]`}
              >
                AI summary
              </small>
              {contact.summary}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

