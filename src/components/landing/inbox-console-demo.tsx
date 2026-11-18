'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BTN_GREEN, DISPLAY_FONT, MONO_FONT } from './shared'

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
  suggestion?: string
  initialMessages: ThreadMessage[]
}

const INITIAL_CONTACTS: ContactThread[] = [
  {
    id: 'aanya',
    initials: 'AS',
    bg: '#FFD9C2',
    channel: 'WhatsApp',
    channelDot: 'bg-[#1FD27A]',
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
    suggestion:
      'Cash on delivery is available. I have added the kurta set to your cart. Want a tracking link once it ships?',
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
    ],
  },
  {
    id: 'rohit',
    initials: 'RK',
    bg: '#FFE9A8',
    channel: 'Instagram',
    channelDot: 'bg-[#FF8A5B]',
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
    suggestion:
      'The festive combo is ₹3,990 (save ₹800) with free express delivery. Want me to send the checkout link?',
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
    ],
  },
  {
    id: 'meera',
    initials: 'MJ',
    bg: '#CFE3F8',
    channel: 'Facebook',
    channelDot: 'bg-[#4C8DF0]',
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
    suggestion:
      'Of course! Monday 11:00 AM is available. Shall I move your booking and send a WhatsApp reminder?',
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
    ],
  },
  {
    id: 'dev',
    initials: 'DP',
    bg: '#DCE7DF',
    channel: 'WhatsApp',
    channelDot: 'bg-[#1FD27A]',
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
    bg: '#E3DCFA',
    channel: 'Instagram',
    channelDot: 'bg-[#FF8A5B]',
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

export function InboxConsoleDemo() {
  const [activeId, setActiveId] = useState<string>('aanya')
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>(() =>
    Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.initialMessages]))
  )
  const [suggestions, setSuggestions] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.suggestion ?? null]))
  )
  const [aanyaOrderStep, setAanyaOrderStep] = useState<'idle' | 'ready' | 'confirmed'>('idle')
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [composerMode, setComposerMode] = useState<'customer' | 'agent'>('customer')

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const sessionRef = useRef(0)

  const contact = INITIAL_CONTACTS.find((c) => c.id === activeId) ?? INITIAL_CONTACTS[0]
  const currentMessages = threads[contact.id] ?? []
  const currentMessagesCount = currentMessages.length
  const currentSuggestion = suggestions[contact.id]

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

  const handleSendSuggestion = () => {
    if (!currentSuggestion || isTyping) return
    const text = currentSuggestion
    const targetId = contact.id
    setSuggestions((prev) => ({ ...prev, [targetId]: null }))
    appendMessage(targetId, {
      id: uid(),
      sender: 'out',
      who: 'Parsona AI · Sent by Rohan',
      text,
    })

    if (targetId === 'aanya' && aanyaOrderStep === 'idle') {
      setIsTyping(true)
      schedule(() => {
        appendMessage('aanya', {
          id: uid(),
          sender: 'in',
          text: 'Yes please! Confirm COD for size M.',
        })
        setAanyaOrderStep('ready')
        setIsTyping(false)
      }, 650)
    }
  }

  const handleEditSuggestion = () => {
    if (!currentSuggestion) return
    setComposerMode('agent')
    setInputValue(currentSuggestion)
    inputRef.current?.focus()
  }

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

    if (composerMode === 'agent' && questionText === undefined) {
      setSuggestions((prev) => ({ ...prev, [targetId]: null }))
      appendMessage(targetId, {
        id: uid(),
        sender: 'out',
        who: 'Rohan · Team reply',
        text,
      })
      setComposerMode('customer')
      return
    }

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

  const handleReset = () => {
    sessionRef.current += 1
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setThreads(Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.initialMessages])))
    setSuggestions(Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.suggestion ?? null])))
    setAanyaOrderStep('idle')
    setIsTyping(false)
    setInputValue('')
    setComposerMode('customer')
  }

  const displayLtv =
    contact.id === 'aanya' && aanyaOrderStep === 'confirmed' ? '₹20,730' : contact.ltv
  const displayOrders =
    contact.id === 'aanya' && aanyaOrderStep === 'confirmed' ? contact.orders + 1 : contact.orders
  const displayStage =
    contact.id === 'aanya' && aanyaOrderStep === 'confirmed' ? 'Won' : contact.stage

  return (
    <div className="relative mt-9 max-[720px]:mt-7">
      <div
        className="bg-white border-[1.5px] border-[#0E1512] rounded-[22px] overflow-hidden shadow-[10px_10px_0_#0B3B2E] max-[720px]:shadow-[6px_6px_0_#0B3B2E]"
        aria-label="Interactive preview of the Parsona team inbox"
      >
        {/* Browser Bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D9E1DB] bg-[#FAFBF9]">
          <i className="w-[11px] h-[11px] rounded-full bg-[#D9E1DB]" />
          <i className="w-[11px] h-[11px] rounded-full bg-[#D9E1DB]" />
          <i className="w-[11px] h-[11px] rounded-full bg-[#D9E1DB]" />
          <span className={`mx-auto ${MONO_FONT} text-[12px] text-[#52625A]`}>
            app.parsona.com/inbox
          </span>
          <button
            type="button"
            onClick={handleReset}
            className={`${MONO_FONT} text-[11px] text-[#52625A] hover:text-[#0E1512] px-2 py-0.5 rounded-md border border-[#D9E1DB] bg-white hover:bg-[#EDF3EE] transition-colors cursor-pointer`}
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-[310px_minmax(0,1fr)_290px] min-h-[580px] max-[1100px]:grid-cols-[280px_minmax(0,1fr)] max-[720px]:grid-cols-1">
          {/* Left Conversation List (Desktop / Tablet) */}
          <aside className="border-r border-[#D9E1DB] max-[720px]:hidden">
            <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
              <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.02em]`}>Inbox</b>
              <span
                className={`min-w-[20px] h-5 rounded-[10px] bg-[#D92D20] text-white ${MONO_FONT} font-medium text-[11px] inline-grid place-items-center px-[6px]`}
              >
                11
              </span>
            </div>
            <div className={`flex gap-[6px] px-[18px] pb-3 ${MONO_FONT} font-medium text-[12px]`}>
              <span className="px-[9px] py-[5px] rounded-[7px] bg-[#0E1512] text-white">Mine 3</span>
              <span className="px-[9px] py-[5px] rounded-[7px] bg-[#F1F4F0] text-[#52625A]">
                Open 8
              </span>
              <span className="px-[9px] py-[5px] rounded-[7px] bg-[#F1F4F0] text-[#52625A]">
                AI 41
              </span>
            </div>

            {INITIAL_CONTACTS.map((c) => {
              const isSelected = c.id === activeId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveId(c.id)
                    setComposerMode('customer')
                  }}
                  className={`w-full text-left flex gap-3 px-[18px] py-[13px] border-t border-[#EDF1EC] items-center transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#E6F7EE]' : 'bg-white hover:bg-[#F6F8F5]'
                  }`}
                >
                  <div
                    className="relative w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] shrink-0 text-[#0E1512]"
                    style={{ background: c.bg }}
                  >
                    {c.initials}
                    <span
                      className={`absolute -right-[2px] -bottom-[2px] w-[14px] h-[14px] rounded-full border-2 border-white ${c.channelDot}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[14.5px] leading-[1.25] text-[#0E1512]">{c.name}</b>
                    <span className="block text-[13px] text-[#52625A] whitespace-nowrap overflow-hidden text-ellipsis">
                      {c.preview}
                    </span>
                  </div>
                  <div
                    className={`grid justify-items-end gap-[5px] ${MONO_FONT} text-[11.5px] text-[#52625A]`}
                  >
                    <span>{c.time}</span>
                    {c.unread && !isSelected && (
                      <span className="min-w-[20px] h-5 rounded-[10px] bg-[#D92D20] text-white font-medium text-[11px] inline-grid place-items-center px-[6px]">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </aside>

          {/* Center Interactive Thread */}
          <div className="flex flex-col bg-[#F6F8F5] min-w-0">
            {/* Thread Header */}
            <div className="flex items-center justify-between gap-3 px-5 max-[720px]:px-4 py-[14px] bg-white border-b border-[#D9E1DB]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="relative w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] shrink-0 text-[#0E1512]"
                  style={{ background: contact.bg }}
                >
                  {contact.initials}
                  <span
                    className={`absolute -right-[2px] -bottom-[2px] w-[14px] h-[14px] rounded-full border-2 border-white ${contact.channelDot}`}
                  />
                </div>
                <div className="min-w-0">
                  <b className="block text-[15.5px] leading-[1.2] text-[#0E1512] truncate">
                    {contact.name}
                  </b>
                  <small className={`block ${MONO_FONT} text-[12px] text-[#52625A] whitespace-nowrap truncate`}>
                    {contact.channel} · {contact.handle}
                  </small>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap justify-end shrink-0 max-[720px]:flex-col max-[720px]:items-end">
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] tracking-[0.02em] bg-[#0B3B2E] text-white whitespace-nowrap`}
                >
                  {isTyping ? 'AI typing…' : 'AI active'}
                </span>
                <span
                  className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] tracking-[0.02em] bg-[#D4F5E3] text-[#0B5F37] whitespace-nowrap`}
                >
                  Assigned: {contact.assignedTo}
                </span>
              </div>
            </div>

            {/* Scrollable Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 h-[330px] max-[720px]:h-[320px] overflow-y-auto no-scrollbar px-5 max-[720px]:px-4 py-5 flex flex-col gap-[11px]"
            >
              {currentMessages.map((msg) => {
                if (msg.sender === 'event') {
                  return (
                    <div
                      key={msg.id}
                      className={`self-center text-center ${MONO_FONT} text-[11.5px] text-[#52625A] border border-dashed border-[#B3C1B8] rounded-lg px-[11px] py-[5px] bg-white`}
                    >
                      {msg.text}
                    </div>
                  )
                }

                if (msg.sender === 'confirmed') {
                  return (
                    <div
                      key={msg.id}
                      className="max-w-[84%] max-[720px]:max-w-[94%] self-end bg-[#E6F7EE] border-[1.5px] border-[#1FD27A] rounded-[16px] rounded-tr-[4px] px-4 py-3 text-[14px]"
                    >
                      <span
                        className={`flex items-center gap-1.5 ${MONO_FONT} font-semibold text-[11px] uppercase tracking-[0.05em] text-[#0B5F37] mb-1`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#1FD27A" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12l3 3 5-6" stroke="#0E1512" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {msg.who}
                      </span>
                      <div className="font-semibold text-[#0E1512]">{msg.text}</div>
                      {msg.meta && (
                        <div className={`mt-1.5 pt-1.5 border-t border-[#1FD27A]/35 ${MONO_FONT} text-[11px] text-[#11503F]`}>
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
                      className="max-w-[80%] max-[720px]:max-w-[90%] px-[15px] py-[11px] rounded-[16px] rounded-tl-[4px] text-[14.5px] leading-[1.45] bg-white border border-[#D9E1DB] self-start text-[#0E1512]"
                    >
                      {msg.text}
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className="max-w-[80%] max-[720px]:max-w-[90%] px-[15px] py-[11px] rounded-[16px] rounded-tr-[4px] text-[14.5px] leading-[1.45] bg-[#D4F5E3] border border-[#AEE8C9] self-end text-[#0E1512]"
                  >
                    {msg.who && (
                      <span
                        className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.05em] uppercase text-[#0B3B2E] mb-1`}
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
                <div className="max-w-[84%] max-[720px]:max-w-[94%] self-end bg-white border-[1.5px] border-[#0B3B2E] rounded-[16px] rounded-tr-[4px] p-3.5 shadow-[4px_4px_0_#D4F5E3]">
                  <div className="flex items-center justify-between gap-3 text-[13.5px] mb-2.5">
                    <b className="text-[#0E1512]">Cotton Kurta Set (Size M)</b>
                    <span className={`${MONO_FONT} font-semibold text-[#0B5F37]`}>₹2,490 · COD</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    className={`${BTN_GREEN} w-full !h-9 !text-[13px] !rounded-[10px] cursor-pointer`}
                  >
                    Confirm COD Order &amp; Send Tracking
                  </button>
                </div>
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div
                  className="self-start flex gap-1 px-[14px] py-3 bg-white border border-[#D9E1DB] rounded-[16px] rounded-tl-[4px]"
                  role="status"
                  aria-label="Parsona AI is typing"
                >
                  <i className="w-[6px] h-[6px] rounded-full bg-[#98A89F] animate-[landing-blink_1.2s_infinite]" />
                  <i
                    className="w-[6px] h-[6px] rounded-full bg-[#98A89F] animate-[landing-blink_1.2s_infinite]"
                    style={{ animationDelay: '0.15s' }}
                  />
                  <i
                    className="w-[6px] h-[6px] rounded-full bg-[#98A89F] animate-[landing-blink_1.2s_infinite]"
                    style={{ animationDelay: '0.3s' }}
                  />
                </div>
              )}
            </div>

            {/* Interactive AI Suggestion Bar */}
            {currentSuggestion && (
              <div className="mx-5 max-[720px]:mx-4 mb-3 bg-[#0B3B2E] text-white rounded-[14px] px-4 py-[14px] flex gap-3 items-center flex-wrap">
                <div className="flex-1 min-w-[200px] text-[13.5px] leading-[1.45]">
                  <small
                    className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#7FE5B2] mb-[3px]`}
                  >
                    AI suggestion
                  </small>
                  {currentSuggestion}
                </div>
                <div className="flex items-center gap-2 max-[720px]:w-full">
                  <button
                    type="button"
                    onClick={handleSendSuggestion}
                    disabled={isTyping}
                    className={`${BTN_GREEN} !h-9 !text-[13px] !px-[14px] !rounded-[9px] max-[720px]:flex-1 cursor-pointer disabled:opacity-60`}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSuggestion}
                    disabled={isTyping}
                    className="inline-flex items-center justify-center h-9 px-[14px] rounded-[9px] font-semibold text-[13px] border-[1.5px] border-[#5E8F7E] text-white hover:bg-white hover:text-[#0E1512] transition-colors max-[720px]:flex-1 cursor-pointer disabled:opacity-60"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* Quick Q&A Chips + Interactive Input Bar */}
            <div className="bg-white border-t border-[#D9E1DB] px-5 max-[720px]:px-4 pt-2.5 pb-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className={`${MONO_FONT} text-[10.5px] uppercase tracking-[0.05em] text-[#52625A] shrink-0 mr-1`}>
                  Try asking:
                </span>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handleAskQuestion(q)}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-full bg-[#F3F5F0] hover:bg-[#DCE7DF] border border-[#D9E1DB] ${MONO_FONT} text-[11.5px] font-medium text-[#0B3B2E] transition-colors cursor-pointer disabled:opacity-50`}
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
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  maxLength={260}
                  placeholder={
                    composerMode === 'agent'
                      ? 'Edit reply and press Send…'
                      : 'Ask a customer question to test Parsona AI…'
                  }
                  aria-label="Ask Parsona AI a question"
                  className="flex-1 min-w-0 h-10 rounded-[10px] border-[1.5px] border-[#D9E1DB] focus:border-[#0B3B2E] bg-[#FAFBF9] focus:bg-white px-3.5 text-[14px] text-[#0E1512] placeholder:text-[#7B8A82] focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isTyping || !inputValue.trim()}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-[#0E1512] hover:bg-[#11503F] text-white font-semibold text-[13.5px] transition-colors cursor-pointer disabled:opacity-45 shrink-0"
                >
                  {composerMode === 'agent' ? 'Send reply' : 'Ask AI'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Customer Profile (Desktop) */}
          <aside className="border-l border-[#D9E1DB] px-5 py-[22px] flex flex-col gap-[18px] max-[1100px]:hidden">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full grid place-items-center font-bold text-[15px] shrink-0 text-[#0E1512]"
                style={{ background: contact.bg }}
              >
                {contact.initials}
              </div>
              <div>
                <b className={`block ${DISPLAY_FONT} text-[18px] tracking-[-0.02em] leading-[1.15]`}>
                  {contact.name}
                </b>
                <small className={`${MONO_FONT} text-[12px] text-[#52625A]`}>
                  Customer since {contact.since}
                </small>
              </div>
            </div>

            <div className="flex gap-[6px] flex-wrap">
              {contact.tags.map((tag) => (
                <span
                  key={tag.label}
                  className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] ${
                    tag.hot ? 'bg-[#FFE1D6] text-[#8A3A12]' : 'bg-[#DCE7DF] text-[#0B3B2E]'
                  }`}
                >
                  {tag.label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>
                  Lifetime value
                </small>
                <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.03em]`}>{displayLtv}</b>
              </div>
              <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Orders</small>
                <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.03em]`}>{displayOrders}</b>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Stage</small>
                <b className={`${DISPLAY_FONT} text-[16px] tracking-[-0.03em]`}>{displayStage}</b>
              </div>
              <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Returns</small>
                <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.03em]`}>
                  {contact.returns}
                </b>
              </div>
            </div>

            <div className="text-[13.5px] leading-[1.5] text-[#2A3731] border-t border-[#D9E1DB] pt-[14px]">
              <small
                className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#0B3B2E] mb-[6px]`}
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

