'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  GitBranch,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Megaphone,
  Menu,
  MoreVertical,
  PanelRight,
  Paperclip,
  Pause,
  Phone,
  Play,
  Plus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  UserPlus,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { DISPLAY_FONT, MONO_FONT } from './shared'
import { ParsonaLogoMark } from '@/components/ui/parsona-logo'

type ChannelType = 'WhatsApp' | 'Instagram' | 'Messenger'

type ThreadMessage = {
  id: string
  sender: 'in' | 'out' | 'event' | 'appointment'
  text: string
  slots?: string[]
  appointment?: {
    clinic: string
    date: string
    time: string
    followUp: string
  }
  time?: string
  isAi?: boolean
  read?: boolean
}

type ConnectedChannel = {
  channel: ChannelType
  label: string
  sublabel: string
  active?: boolean
}

type ContactThread = {
  id: string
  initials: string
  avatarBg: string
  avatarText: string
  channel: ChannelType
  channelTopic: string
  name: string
  handle: string
  phone: string
  email: string
  since: string
  preview: string
  timeAgo: string
  statusDot: 'green' | 'amber'
  windowLeft: string
  aiPausedInitially?: boolean
  appointmentType: string
  appointmentDate: string
  appointmentTime: string
  clinicName: string
  appointmentStatus: string
  leadStage: string
  connectedChannels: ConnectedChannel[]
  initialMessages: ThreadMessage[]
  aiDraftSuggestion: string
}

const CLINIC_NAME = 'Krishna Skin & Hair Clinic'
const CLINIC_LOCATION = 'Noida, UP'
const ADMIN_NAME = 'Dr. Arjun Mehta'

const INITIAL_CONTACTS: ContactThread[] = [
  {
    id: 'pooja',
    initials: 'PK',
    avatarBg: '#E6F0EC',
    avatarText: '#0B3B2E',
    channel: 'WhatsApp',
    channelTopic: 'WhatsApp · Skin consultation',
    name: 'Pooja Khanna',
    handle: '+91 98123 45678',
    phone: '+91 98123 45678',
    email: 'pooja.khanna@example.com',
    since: 'Nov 2026',
    preview: 'Appointment for skin consultation',
    timeAgo: '2m',
    statusDot: 'green',
    windowLeft: '22h left',
    aiPausedInitially: false,
    appointmentType: 'Skin Consultation',
    appointmentDate: '27 Nov 2026',
    appointmentTime: '4:00 PM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Confirmed',
    leadStage: 'Appointment Booked',
    connectedChannels: [
      { channel: 'WhatsApp', label: 'abu bakar', sublabel: '+91 98123 45678', active: true },
      { channel: 'Instagram', label: 'abu bakar', sublabel: '@abubakar.com' },
    ],
    aiDraftSuggestion:
      'Ji Pooja ji, Krishna Skin & Hair Clinic, Noida mein aapki 27 Nov, 4:00 PM ki appointment confirmed hai. Consultation se 10 min pehle pahunchne ki koshish karein.',
    initialMessages: [
      { id: 'pe1', sender: 'event', text: 'WhatsApp · Skin consultation' },
      {
        id: 'pm1',
        sender: 'in',
        text: 'Namaste, mujhe skin consultation ke liye appointment book karna hai.',
        time: '15:42',
      },
      {
        id: 'pm2',
        sender: 'out',
        text: 'Namaste Pooja ji! Aapki madad kar sakte hain. Aap kis date aur time par aana chahengi?',
        slots: ['27 November – 4:00 PM', '28 November – 11:30 AM', '30 November – 12:00 PM'],
        time: '15:42',
        isAi: true,
        read: true,
      },
      {
        id: 'pm3',
        sender: 'in',
        text: '27 November, 4 PM theek hai.',
        time: '15:44',
      },
      {
        id: 'pm4',
        sender: 'appointment',
        text: 'Appointment Confirmed',
        appointment: {
          clinic: CLINIC_NAME,
          date: '27 November 2026',
          time: '4:00 PM',
          followUp: 'Kya aapko consultation se related aur koi information chahiye?',
        },
        time: '15:44',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'amit',
    initials: 'AR',
    avatarBg: '#F3F0FF',
    avatarText: '#43336F',
    channel: 'Instagram',
    channelTopic: 'Instagram · Chemical peel query',
    name: 'Amit Raj',
    handle: '@amit.raj',
    phone: '+91 98114 22890',
    email: 'amit.raj@example.com',
    since: 'Nov 2026',
    preview: 'Chemical peel treatment cost?',
    timeAgo: '14m',
    statusDot: 'green',
    windowLeft: '23h left',
    appointmentType: 'Chemical Peel Consult',
    appointmentDate: '28 Nov 2026',
    appointmentTime: '11:30 AM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Pending Slot',
    leadStage: 'Qualified Lead',
    connectedChannels: [
      { channel: 'Instagram', label: 'Amit Raj', sublabel: '@amit.raj', active: true },
      { channel: 'WhatsApp', label: 'Amit Raj', sublabel: '+91 98114 22890' },
    ],
    aiDraftSuggestion:
      'Hi Amit! Chemical peel sessions start at ₹2,500 depending on skin type. Shall I book a quick assessment with Dr. Arjun Mehta?',
    initialMessages: [
      { id: 'ae1', sender: 'event', text: 'Instagram · Treatment inquiry' },
      { id: 'am1', sender: 'in', text: 'Chemical peel treatment cost?', time: '15:20' },
      {
        id: 'am2',
        sender: 'out',
        text: 'Namaste Amit! Chemical peel sessions at Krishna Skin & Hair Clinic start at ₹2,500 after a brief skin evaluation with Dr. Arjun Mehta. Would you like available slots?',
        time: '15:20',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'neha',
    initials: 'NS',
    avatarBg: '#E6F0EC',
    avatarText: '#0B3B2E',
    channel: 'WhatsApp',
    channelTopic: 'WhatsApp · Follow-up session',
    name: 'Neha Sharma',
    handle: '+91 98765 31204',
    phone: '+91 98765 31204',
    email: 'neha.sharma@example.com',
    since: 'Sep 2026',
    preview: 'Next treatment session',
    timeAgo: '38m',
    statusDot: 'green',
    windowLeft: '21h left',
    appointmentType: 'Laser Toning Session 3',
    appointmentDate: '30 Nov 2026',
    appointmentTime: '12:00 PM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Confirmed',
    leadStage: 'Returning Patient',
    connectedChannels: [
      { channel: 'WhatsApp', label: 'Neha Sharma', sublabel: '+91 98765 31204', active: true },
    ],
    aiDraftSuggestion:
      'Hi Neha ji, your Session 3 is scheduled for 30 Nov at 12:00 PM. Please avoid direct sun exposure 24 hours prior.',
    initialMessages: [
      { id: 'ne1', sender: 'event', text: 'WhatsApp · Follow-up care' },
      { id: 'nm1', sender: 'in', text: 'Next treatment session kab hai?', time: '14:55' },
      {
        id: 'nm2',
        sender: 'out',
        text: 'Hi Neha ji! Your next laser toning session with Dr. Arjun Mehta is confirmed for 30 November at 12:00 PM.',
        time: '14:55',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'rakesh',
    initials: 'RS',
    avatarBg: '#EAF2FF',
    avatarText: '#275D9B',
    channel: 'Messenger',
    channelTopic: 'Messenger · Clinic details',
    name: 'Rakesh Singh',
    handle: 'FB: Rakesh Singh',
    phone: '+91 98180 77412',
    email: 'rakesh.singh@example.com',
    since: 'Nov 2026',
    preview: 'Clinic address and timings?',
    timeAgo: '1h',
    statusDot: 'green',
    windowLeft: '20h left',
    appointmentType: 'General Dermatology',
    appointmentDate: 'TBD',
    appointmentTime: 'TBD',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Inquiry',
    leadStage: 'New Lead',
    connectedChannels: [
      { channel: 'Messenger', label: 'Rakesh Singh', sublabel: 'FB: Rakesh Singh', active: true },
      { channel: 'WhatsApp', label: 'Rakesh Singh', sublabel: '+91 98180 77412' },
    ],
    aiDraftSuggestion:
      'Krishna Skin & Hair Clinic is in Sector 18, Noida, UP. Timings: Mon–Sat, 10:00 AM – 7:30 PM.',
    initialMessages: [
      { id: 're1', sender: 'event', text: 'Messenger · Clinic location' },
      { id: 'rm1', sender: 'in', text: 'Clinic address and timings?', time: '14:15' },
      {
        id: 'rm2',
        sender: 'out',
        text: 'Namaste Rakesh ji! Krishna Skin & Hair Clinic is located in Sector 18, Noida, UP. We are open Mon–Sat from 10:00 AM to 7:30 PM.',
        time: '14:16',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'suman',
    initials: 'SP',
    avatarBg: '#E6F0EC',
    avatarText: '#0B3B2E',
    channel: 'WhatsApp',
    channelTopic: 'WhatsApp · Hair fall care',
    name: 'Suman Patel',
    handle: '+91 98991 54022',
    phone: '+91 98991 54022',
    email: 'suman.patel@example.com',
    since: 'Nov 2026',
    preview: 'Hair fall treatment available?',
    timeAgo: '2h',
    statusDot: 'green',
    windowLeft: '19h left',
    appointmentType: 'Hair Fall & PRP Consult',
    appointmentDate: '28 Nov 2026',
    appointmentTime: '11:30 AM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Slot Offered',
    leadStage: 'Qualified Lead',
    connectedChannels: [
      { channel: 'WhatsApp', label: 'Suman Patel', sublabel: '+91 98991 54022', active: true },
      { channel: 'Instagram', label: 'Suman Patel', sublabel: '@suman.patel' },
    ],
    aiDraftSuggestion:
      'Yes Suman ji, we offer scalp analysis, PRP therapy, and medical hair regrowth plans by Dr. Arjun Mehta.',
    initialMessages: [
      { id: 'se1', sender: 'event', text: 'WhatsApp · Hair consultation' },
      { id: 'sm1', sender: 'in', text: 'Hair fall treatment available?', time: '13:10' },
      {
        id: 'sm2',
        sender: 'out',
        text: 'Yes Suman ji! We provide trichology evaluation, PRP sessions, and targeted hair regrowth care. Would you like to book a consultation?',
        time: '13:11',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'vikram',
    initials: 'VK',
    avatarBg: '#F3F0FF',
    avatarText: '#43336F',
    channel: 'Instagram',
    channelTopic: 'Instagram · Reschedule',
    name: 'Vikram Kumar',
    handle: '@vikram.k',
    phone: '+91 97170 61904',
    email: 'vikram.kumar@example.com',
    since: 'Oct 2026',
    preview: 'Reschedule appointment',
    timeAgo: '3h',
    statusDot: 'amber',
    windowLeft: '17h left',
    appointmentType: 'Acne Scar Review',
    appointmentDate: '30 Nov 2026',
    appointmentTime: '12:00 PM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Reschedule Requested',
    leadStage: 'Appointment Booked',
    connectedChannels: [
      { channel: 'Instagram', label: 'Vikram Kumar', sublabel: '@vikram.k', active: true },
      { channel: 'WhatsApp', label: 'Vikram Kumar', sublabel: '+91 97170 61904' },
    ],
    aiDraftSuggestion:
      'Sure Vikram! We have moved your appointment to 30 November at 12:00 PM with Dr. Arjun Mehta.',
    initialMessages: [
      { id: 've1', sender: 'event', text: 'Instagram · Reschedule request' },
      { id: 'vm1', sender: 'in', text: 'Can I reschedule my appointment to Monday?', time: '12:05' },
      {
        id: 'vm2',
        sender: 'out',
        text: 'Of course, Vikram! 30 November at 12:00 PM is available. Shall I confirm this slot?',
        time: '12:06',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'anjali',
    initials: 'AV',
    avatarBg: '#E6F0EC',
    avatarText: '#0B3B2E',
    channel: 'WhatsApp',
    channelTopic: 'WhatsApp · Skin allergy',
    name: 'Anjali Verma',
    handle: '+91 99102 88341',
    phone: '+91 99102 88341',
    email: 'anjali.verma@example.com',
    since: 'Nov 2026',
    preview: 'Skin allergy consultation',
    timeAgo: '4h',
    statusDot: 'green',
    windowLeft: '15h left',
    appointmentType: 'Skin Allergy Evaluation',
    appointmentDate: '27 Nov 2026',
    appointmentTime: '5:30 PM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Confirmed',
    leadStage: 'Appointment Booked',
    connectedChannels: [
      { channel: 'WhatsApp', label: 'Anjali Verma', sublabel: '+91 99102 88341', active: true },
    ],
    aiDraftSuggestion:
      'Dr. Arjun Mehta has a priority slot open at 5:30 PM for skin allergy care. Please bring any creams currently in use.',
    initialMessages: [
      { id: 'ane1', sender: 'event', text: 'WhatsApp · Priority triage' },
      { id: 'anm1', sender: 'in', text: 'Skin allergy consultation ke liye slot mil jayega?', time: '11:22' },
      {
        id: 'anm2',
        sender: 'out',
        text: 'Ji Anjali ji, aaj 5:30 PM ka priority slot Dr. Arjun Mehta ke saath available hai. Confirm kar doon?',
        time: '11:23',
        isAi: true,
        read: true,
      },
    ],
  },
  {
    id: 'manoj',
    initials: 'MD',
    avatarBg: '#F5F6F8',
    avatarText: '#353536',
    channel: 'WhatsApp',
    channelTopic: 'WhatsApp · Video consult',
    name: 'Manoj Dubey',
    handle: '+91 98105 44910',
    phone: '+91 98105 44910',
    email: 'manoj.dubey@example.com',
    since: 'Nov 2026',
    preview: 'Online consultation available?',
    timeAgo: '5h',
    statusDot: 'green',
    windowLeft: '14h left',
    appointmentType: 'Online Video Consultation',
    appointmentDate: '28 Nov 2026',
    appointmentTime: '4:00 PM',
    clinicName: CLINIC_NAME,
    appointmentStatus: 'Confirmed',
    leadStage: 'Appointment Booked',
    connectedChannels: [
      { channel: 'WhatsApp', label: 'Manoj Dubey', sublabel: '+91 98105 44910', active: true },
    ],
    aiDraftSuggestion:
      'Yes Manoj ji, online video consultations with Dr. Arjun Mehta are available daily from 4:00 PM – 6:00 PM.',
    initialMessages: [
      { id: 'mae1', sender: 'event', text: 'WhatsApp · Tele-dermatology' },
      { id: 'mam1', sender: 'in', text: 'Online consultation available?', time: '10:15' },
      {
        id: 'mam2',
        sender: 'out',
        text: 'Ji haan Manoj ji! Video consultations with Dr. Arjun Mehta are available and digital prescriptions are shared right here on WhatsApp.',
        time: '10:16',
        isAi: true,
        read: true,
      },
    ],
  },
]

const uid = () => Math.random().toString(36).slice(2, 10)

function ChannelBadgeIcon({
  channel,
  size = 14,
}: {
  channel: ChannelType
  size?: number
}) {
  if (channel === 'WhatsApp') {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-full bg-[#25D366] text-white grid place-items-center shrink-0 shadow-xs"
        aria-label="WhatsApp"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6A12 12 0 0 0 12 24c6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.5Zm-8.5 18.5c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.9 9.9 0 0 1 2 12c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10Zm5.5-7.5c-.3-.2-1.8-.9-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.5-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3Z" />
        </svg>
      </span>
    )
  }

  if (channel === 'Instagram') {
    return (
      <span
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 52%, #8134AF 100%)',
        }}
        className="rounded-full text-white grid place-items-center shrink-0 shadow-xs"
        aria-label="Instagram"
      >
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
    )
  }

  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-[#0084FF] text-white grid place-items-center shrink-0 shadow-xs"
      aria-label="Messenger"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.14 2 11.26c0 2.9 1.45 5.48 3.72 7.18V22l3.4-1.87c.9.25 1.88.39 2.88.39 5.52 0 10-4.14 10-9.26C22 6.14 17.52 2 12 2Zm1 12.46-2.55-2.72-4.97 2.72 5.47-5.8 2.61 2.72 4.91-2.72-5.47 5.8Z" />
      </svg>
    </span>
  )
}

function getSmartClinicReply(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('peel') || q.includes('cost') || q.includes('price') || q.includes('fee')) {
    return 'Chemical peel sessions start at ₹2,500 and skin consultations with Dr. Arjun Mehta are available daily in Sector 18, Noida.'
  }
  if (q.includes('hair') || q.includes('prp') || q.includes('allergy')) {
    return 'Yes! Dr. Arjun Mehta handles both hair fall (PRP & trichology) and skin allergy consultations. Available slots: 27 Nov 4:00 PM or 28 Nov 11:30 AM.'
  }
  if (q.includes('address') || q.includes('timing') || q.includes('noida') || q.includes('where')) {
    return 'Krishna Skin & Hair Clinic is located in Sector 18, Noida, UP. Timings: Monday to Saturday, 10:00 AM – 7:30 PM.'
  }
  if (q.includes('online') || q.includes('video')) {
    return 'Ji haan! Online video consultations are available between 4:00 PM and 6:00 PM with digital prescriptions sent on WhatsApp.'
  }
  return 'Thank you! Krishna Skin & Hair Clinic team & Dr. Arjun Mehta have noted your message — would you like to confirm a 27 Nov 4:00 PM slot?'
}

export function InboxConsoleDemo({ embedded = false }: { embedded?: boolean } = {}) {
  const [activeId, setActiveId] = useState<string>('pooja')
  const [channelFilter, setChannelFilter] = useState<'All' | ChannelType>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>(() =>
    Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.initialMessages])),
  )
  const [aiPausedMap, setAiPausedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, Boolean(c.aiPausedInitially)])),
  )
  const [notesMap, setNotesMap] = useState<Record<string, string[]>>({})
  const [noteInput, setNoteInput] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const sessionRef = useRef(0)

  const contact = INITIAL_CONTACTS.find((c) => c.id === activeId) ?? INITIAL_CONTACTS[0]
  const currentMessages = threads[contact.id] ?? []
  const isAiPaused = Boolean(aiPausedMap[contact.id])
  const currentNotes = notesMap[contact.id] ?? []

  const filteredContacts = useMemo(() => {
    return INITIAL_CONTACTS.filter((c) => {
      const matchesChannel = channelFilter === 'All' || c.channel === channelFilter
      const q = searchQuery.trim().toLowerCase()
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q)
      return matchesChannel && matchesQuery
    })
  }, [channelFilter, searchQuery])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [currentMessages.length, isTyping, activeId])

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

  const handleSendMessage = (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()
    if (!text || isTyping) return

    const targetId = contact.id
    if (overrideText === undefined) setInputValue('')

    setThreads((prev) => ({
      ...prev,
      [targetId]: [
        ...(prev[targetId] ?? []),
        { id: uid(), sender: 'in', text, time: '15:46' },
      ],
    }))

    setIsTyping(true)
    schedule(() => {
      setThreads((prev) => ({
        ...prev,
        [targetId]: [
          ...(prev[targetId] ?? []),
          {
            id: uid(),
            sender: 'out',
            text: getSmartClinicReply(text),
            time: '15:46',
            isAi: !aiPausedMap[targetId],
            read: true,
          },
        ],
      }))
      setIsTyping(false)
    }, 650)
  }

  const handleDraftWithAi = () => {
    setInputValue(contact.aiDraftSuggestion)
  }

  const handleToggleAi = () => {
    setAiPausedMap((prev) => ({ ...prev, [contact.id]: !prev[contact.id] }))
  }

  const handleAddNote = () => {
    const note = noteInput.trim()
    if (!note) return
    setNotesMap((prev) => ({
      ...prev,
      [contact.id]: [...(prev[contact.id] ?? []), note],
    }))
    setNoteInput('')
  }

  const handleResetConversation = () => {
    sessionRef.current += 1
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setThreads((prev) => ({ ...prev, [contact.id]: contact.initialMessages }))
    setAiPausedMap((prev) => ({ ...prev, [contact.id]: Boolean(contact.aiPausedInitially) }))
    setInputValue('')
    setIsTyping(false)
  }

  const handleResetAll = () => {
    sessionRef.current += 1
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setActiveId('pooja')
    setChannelFilter('All')
    setSearchQuery('')
    setThreads(Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, c.initialMessages])))
    setAiPausedMap(Object.fromEntries(INITIAL_CONTACTS.map((c) => [c.id, Boolean(c.aiPausedInitially)])))
    setNotesMap({})
    setNoteInput('')
    setInputValue('')
    setIsTyping(false)
  }

  const handleCopyPhone = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(contact.phone).catch(() => {})
    }
    setCopiedPhone(true)
    schedule(() => setCopiedPhone(false), 1400)
  }

  const waCount = INITIAL_CONTACTS.filter((c) => c.channel === 'WhatsApp').length
  const igCount = INITIAL_CONTACTS.filter((c) => c.channel === 'Instagram').length

  return (
    <div className={embedded ? 'relative' : 'relative mt-9 max-[720px]:mt-7'}>
      <div
        className="bg-white text-[var(--text-primary)] border border-[var(--border)] rounded-[20px] overflow-hidden shadow-[var(--shadow-card)]"
        aria-label="Interactive preview of Parsona.live clinic dashboard inbox"
      >
        {/* Light Browser Bar + Demo Reset */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <i className="w-[10px] h-[10px] rounded-full bg-[var(--border-strong)]" />
            <i className="w-[10px] h-[10px] rounded-full bg-[var(--border-strong)]" />
            <i className="w-[10px] h-[10px] rounded-full bg-[var(--border-strong)]" />
          </div>
          <span className={`${MONO_FONT} text-[11.5px] text-[var(--text-secondary)]`}>
            app.parsona.live/inbox
          </span>
          <button
            type="button"
            onClick={handleResetAll}
            title="Reset dashboard preview"
            className={`inline-flex items-center gap-1.5 ${MONO_FONT} text-[11px] font-medium text-[var(--brand-primary)] hover:text-[var(--text-primary)] px-2.5 py-1 rounded-md border border-[var(--border)] bg-white hover:bg-[var(--surface-green)] transition-colors cursor-pointer shrink-0`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Light Parsona.live Dashboard App Shell */}
        <div className="grid grid-cols-[200px_minmax(0,1fr)] max-[1140px]:grid-cols-1 min-h-[600px]">
          {/* Column 1: Left Workspace Navigation Sidebar */}
          <aside className="bg-[var(--surface-secondary)] border-r border-[var(--border)] flex flex-col justify-between max-[1140px]:hidden">
            <div>
              {/* Brand Header: Parsona Dashboard / Parsona.live */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border)] bg-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ParsonaLogoMark variant="primary" size={28} className="rounded-[8px] shrink-0" />
                  <div className="min-w-0 leading-tight">
                    <span className={`block ${DISPLAY_FONT} text-[12.5px] font-bold text-[var(--text-heading)] truncate`}>
                      Parsona Dashboard
                    </span>
                    <span className={`block ${MONO_FONT} text-[9.5px] tracking-[0.06em] uppercase text-[var(--brand-primary)]`}>
                      parsona.live
                    </span>
                  </div>
                </div>
                <Menu className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
              </div>

              {/* Navigation Items */}
              <nav aria-label="Dashboard navigation" className="px-2 py-2.5 space-y-0.5 text-[12.5px]">
                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)]">
                  <LayoutDashboard className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Dashboard</span>
                </div>

                {/* Active Inbox Item */}
                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-green)] border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] font-semibold">
                  <Inbox className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                  <span>Inbox</span>
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)]">
                  <span className="flex items-center gap-2.5">
                    <Bell className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Notifications</span>
                  </span>
                  <span className="w-4 h-4 rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-semibold grid place-items-center">
                    2
                  </span>
                </div>

                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)]">
                  <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Patients</span>
                </div>

                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)]">
                  <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Context Hub</span>
                </div>

                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)]">
                  <GitBranch className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Pipelines</span>
                </div>

                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)]">
                  <Megaphone className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Broadcasts</span>
                </div>

                {/* Automation Group */}
                <div className="pt-1">
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[var(--text-heading)] font-medium">
                    <span className="flex items-center gap-2.5">
                      <Zap className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                      <span>Automation</span>
                    </span>
                    <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                  <div className="ml-3 pl-2.5 border-l border-[var(--border)] space-y-0.5 text-[12px]">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md text-[var(--text-secondary)]">
                      <Zap className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>Automations</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 rounded-md text-[var(--text-secondary)]">
                      <span className="flex items-center gap-2">
                        <Workflow className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>Flows</span>
                      </span>
                      <span className="px-1.5 py-[1px] rounded text-[9.5px] font-semibold bg-[var(--surface-lavender)] text-[var(--accent-text)]">
                        Beta
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5 text-[var(--text-secondary)]">
                  <span className="flex items-center gap-2.5">
                    <Puzzle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Integrations</span>
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                </div>

                {/* Settings Group */}
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[var(--text-heading)] font-medium">
                    <span className="flex items-center gap-2.5">
                      <Settings className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                      <span>Settings</span>
                    </span>
                    <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                  <div className="ml-3 pl-2.5 border-l border-[var(--border)] space-y-0.5 text-[12px]">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md text-[var(--text-secondary)]">
                      <LayoutGrid className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>Overview</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md text-[var(--text-secondary)]">
                      <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>Plans &amp; Billing</span>
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            {/* Bottom Clinic Workspace Card */}
            <div className="px-3 py-2.5 border-t border-[var(--border)] bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-[var(--surface-green)] border border-[var(--border)] grid place-items-center text-[10px] font-bold text-[var(--brand-primary)] shrink-0">
                  KS
                </span>
                <div className="min-w-0 leading-tight">
                  <span className="block text-[10.5px] font-semibold text-[var(--text-heading)] truncate">
                    {CLINIC_NAME}
                  </span>
                  <span className="block text-[9.5px] text-[var(--text-secondary)] truncate">
                    {CLINIC_LOCATION}
                  </span>
                </div>
              </div>
              <span className="px-1.5 py-[2px] rounded text-[9px] font-semibold uppercase tracking-[0.04em] bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning)]/25 shrink-0">
                Admin
              </span>
            </div>
          </aside>

          {/* Right Workspace Area (Top App Bar + 3 Columns) */}
          <div className="flex flex-col min-w-0">
            {/* Top App Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="hidden max-[1140px]:inline-flex items-center gap-1.5 mr-1 shrink-0">
                  <ParsonaLogoMark variant="primary" size={22} className="rounded-[6px]" />
                  <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    Parsona Dashboard /
                  </span>
                </span>
                <b className={`${DISPLAY_FONT} text-[14.5px] font-semibold text-[var(--text-heading)]`}>
                  Inbox
                </b>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-[2px] rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] truncate">
                  {CLINIC_NAME} · {CLINIC_LOCATION}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Sun className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                <div className="flex items-center gap-2 pl-2.5 border-l border-[var(--border)]">
                  <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-semibold grid place-items-center">
                    AM
                  </span>
                  <span className="text-[12px] font-medium text-[var(--text-heading)] max-[640px]:hidden">
                    {ADMIN_NAME}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Patient Pill Switcher (<720px) */}
            <div className="hidden max-[720px]:flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-secondary)] overflow-x-auto no-scrollbar">
              {INITIAL_CONTACTS.map((c) => {
                const isSelected = c.id === activeId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] whitespace-nowrap border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--surface-green)] border-[var(--brand-primary)]/30 text-[var(--brand-primary)] font-semibold'
                        : 'bg-white border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <ChannelBadgeIcon channel={c.channel} size={13} />
                    <span>{c.name}</span>
                  </button>
                )
              })}
            </div>

            {/* 3-Column Body: Conversations List | Chat Center | Patient CRM */}
            <div className="flex-1 grid grid-cols-[248px_minmax(0,1fr)_272px] max-[1020px]:grid-cols-[235px_minmax(0,1fr)] max-[720px]:grid-cols-1">
              {/* Column 2: Conversations List */}
              <section
                aria-label="Patient conversations list"
                className="bg-white border-r border-[var(--border)] flex flex-col max-[720px]:hidden"
              >
                <div className="px-3 pt-3 pb-2.5 space-y-2.5 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-1.5">
                      <ChannelBadgeIcon channel="WhatsApp" size={16} />
                      <ChannelBadgeIcon channel="Messenger" size={16} />
                      <ChannelBadgeIcon channel="Instagram" size={16} />
                    </div>
                    <b className="text-[13.5px] font-semibold text-[var(--text-heading)]">Inbox</b>
                    <span className="px-1.5 py-[1px] rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-semibold">
                      {INITIAL_CONTACTS.length}
                    </span>
                  </div>

                  {/* Search Input */}
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search patients..."
                      aria-label="Search patient conversations"
                      className="w-full h-8 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[var(--brand-primary)] pl-8 pr-11 text-[11.5px] text-[var(--text-body)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                    />
                    <span
                      className={`absolute right-2 ${MONO_FONT} text-[9.5px] text-[var(--text-muted)] bg-white border border-[var(--border)] rounded px-1 py-[1px]`}
                    >
                      Ctrl K
                    </span>
                  </div>

                  {/* Channel Filter Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]">
                    <button
                      type="button"
                      onClick={() => setChannelFilter('All')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border whitespace-nowrap transition-colors cursor-pointer ${
                        channelFilter === 'All'
                          ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white font-medium'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span>All</span>
                      <span className="opacity-85">{INITIAL_CONTACTS.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelFilter('WhatsApp')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border whitespace-nowrap transition-colors cursor-pointer ${
                        channelFilter === 'WhatsApp'
                          ? 'bg-[var(--surface-green)] border-[var(--brand-primary)]/40 text-[var(--brand-primary)] font-semibold'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <ChannelBadgeIcon channel="WhatsApp" size={11} />
                      <span>WhatsApp</span>
                      <span className="opacity-75">{waCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelFilter('Instagram')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border whitespace-nowrap transition-colors cursor-pointer ${
                        channelFilter === 'Instagram'
                          ? 'bg-[var(--surface-lavender)] border-[var(--accent-hover)] text-[var(--accent-text)] font-semibold'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <ChannelBadgeIcon channel="Instagram" size={11} />
                      <span>Instagram</span>
                      <span className="opacity-75">{igCount}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      All <ChevronDown className="w-3 h-3" />
                    </span>
                    <span className="inline-flex items-center gap-1">⇅ Newest</span>
                  </div>
                </div>

                {/* Patient Thread List */}
                <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[var(--border)]/70">
                  {filteredContacts.map((c) => {
                    const isSelected = c.id === activeId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--surface-green)] border-l-2 border-l-[var(--brand-primary)]'
                            : 'bg-white hover:bg-[var(--surface-secondary)] border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <span
                            className="w-9 h-9 rounded-full grid place-items-center text-[12px] font-semibold border border-[var(--border)]"
                            style={{ backgroundColor: c.avatarBg, color: c.avatarText }}
                          >
                            {c.initials}
                          </span>
                          <span className="absolute -right-0.5 -bottom-0.5 ring-2 ring-white rounded-full">
                            <ChannelBadgeIcon channel={c.channel} size={13} />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <b className="text-[12.5px] font-semibold text-[var(--text-heading)] truncate">
                              {c.name}
                            </b>
                            <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                              {c.timeAgo}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[11px] text-[var(--text-secondary)] truncate">
                              {c.preview}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                c.statusDot === 'green' ? 'bg-[var(--success)]' : 'bg-[#D6A85C]'
                              }`}
                            />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Column 3: Center Chat Thread */}
              <div className="flex flex-col bg-[var(--surface-secondary)] min-w-0">
                {/* Thread Header */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <span
                        className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold border border-[var(--border)]"
                        style={{ backgroundColor: contact.avatarBg, color: contact.avatarText }}
                      >
                        {contact.initials}
                      </span>
                      <span className="absolute -right-0.5 -bottom-0.5 ring-2 ring-white rounded-full">
                        <ChannelBadgeIcon channel={contact.channel} size={12} />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <b className="text-[13px] font-semibold text-[var(--text-heading)] truncate">
                          {contact.name}
                        </b>
                        <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--success-bg)] border border-[var(--success)]/25 text-[var(--success)] text-[10.5px] font-medium">
                          <Clock className="w-2.5 h-2.5" />
                          {contact.windowLeft}
                        </span>
                      </div>
                      <span className="block text-[11px] text-[var(--text-secondary)] truncate">
                        {contact.handle}
                      </span>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="p-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] max-[720px]:hidden">
                      <PanelRight className="w-3.5 h-3.5" />
                    </span>
                    <button
                      type="button"
                      onClick={handleResetConversation}
                      title="Reset current conversation"
                      aria-label="Reset current conversation"
                      className="p-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-green)] text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--success)]/30 bg-[var(--success-bg)] text-[var(--success)] text-[11px] font-semibold">
                      <i className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                      Confirmed
                      <ChevronDown className="w-3 h-3 opacity-75" />
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border)] bg-white text-[var(--text-body)] text-[11px] font-medium">
                      <UserPlus className="w-3 h-3 text-[var(--brand-primary)]" />
                      {ADMIN_NAME.split(' ').slice(0, 2).join(' ')}
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </span>
                    <span className="p-1 text-[var(--text-muted)]">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Scrollable Message Canvas */}
                <div
                  ref={scrollRef}
                  className="flex-1 h-[396px] max-[720px]:h-[340px] overflow-y-auto no-scrollbar px-5 max-[720px]:px-3.5 py-4 flex flex-col gap-2.5"
                >
                  {currentMessages.map((msg) => {
                    if (msg.sender === 'event') {
                      return (
                        <div
                          key={msg.id}
                          className={`self-center my-0.5 px-3 py-1 rounded-full bg-white border border-dashed border-[var(--border-strong)] ${MONO_FONT} text-[10.5px] font-medium text-[var(--text-secondary)]`}
                        >
                          {msg.text}
                        </div>
                      )
                    }

                    if (msg.sender === 'appointment' && msg.appointment) {
                      return (
                        <div
                          key={msg.id}
                          className="max-w-[80%] max-[720px]:max-w-[92%] self-end rounded-[14px] rounded-tr-[4px] bg-white border border-[var(--success)]/35 p-3.5 text-[12.5px] text-[var(--text-body)] shadow-[var(--shadow-card)]"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--success)] mb-2">
                            <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] grid place-items-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                            <span>{msg.text}</span>
                          </div>
                          <div className="rounded-lg bg-[var(--surface-green)] border border-[var(--brand-primary)]/12 px-3 py-2 space-y-1 text-[12px]">
                            <div className="font-semibold text-[var(--brand-primary)]">
                              {msg.appointment.clinic}
                            </div>
                            <div className="text-[var(--text-heading)]">
                              Date: <strong>{msg.appointment.date}</strong>
                            </div>
                            <div className="text-[var(--text-heading)]">
                              Time: <strong>{msg.appointment.time}</strong>
                            </div>
                          </div>
                          <p className="mt-2 text-[var(--text-body)] leading-[1.45]">
                            {msg.appointment.followUp}
                          </p>
                          <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9.5px] text-[var(--text-muted)]">
                            {msg.isAi && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-[var(--surface-lavender)] text-[var(--accent-text)] font-semibold text-[9px]">
                                <Sparkles className="w-2.5 h-2.5" />
                                AI
                              </span>
                            )}
                            {msg.time && <span>{msg.time}</span>}
                            <CheckCheck className="w-3 h-3 text-[var(--brand-primary)]" />
                          </div>
                        </div>
                      )
                    }

                    if (msg.sender === 'in') {
                      return (
                        <div
                          key={msg.id}
                          className="max-w-[74%] max-[720px]:max-w-[88%] self-start rounded-[14px] rounded-tl-[4px] bg-white border border-[var(--border)] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[var(--text-body)] shadow-xs"
                        >
                          <p>{msg.text}</p>
                          {msg.time && (
                            <span className="block mt-1 text-[9.5px] text-[var(--text-muted)]">
                              {msg.time}
                            </span>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div
                        key={msg.id}
                        className="max-w-[78%] max-[720px]:max-w-[88%] self-end rounded-[14px] rounded-tr-[4px] bg-[var(--brand-primary)] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-white shadow-[var(--shadow-brand)]"
                      >
                        <p>{msg.text}</p>
                        {msg.slots && msg.slots.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/15 space-y-1 text-[11.5px]">
                            <span className="block text-[10px] uppercase tracking-[0.05em] text-[#B6D6C8] font-medium">
                              Available slots:
                            </span>
                            {msg.slots.map((slot) => (
                              <div
                                key={slot}
                                className="flex items-center gap-1.5 text-white/95 bg-white/10 rounded-md px-2 py-1"
                              >
                                <Calendar className="w-3 h-3 text-[#CFC3FF] shrink-0" />
                                <span>{slot}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9.5px] text-white/75">
                          {msg.isAi && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-white/15 text-[#E5DEFF] font-semibold text-[9px]">
                              <Sparkles className="w-2.5 h-2.5" />
                              AI
                            </span>
                          )}
                          {msg.time && <span>{msg.time}</span>}
                          {msg.read ? (
                            <CheckCheck className="w-3 h-3 text-[#CFC3FF]" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {isTyping && (
                    <div
                      className="self-end flex gap-1 px-3.5 py-2.5 bg-[var(--brand-primary)] rounded-[14px] rounded-tr-[4px]"
                      role="status"
                      aria-label="Parsona AI is typing"
                    >
                      <i className="w-1.5 h-1.5 rounded-full bg-white/80 animate-[landing-blink_1.2s_infinite]" />
                      <i
                        className="w-1.5 h-1.5 rounded-full bg-white/80 animate-[landing-blink_1.2s_infinite]"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <i
                        className="w-1.5 h-1.5 rounded-full bg-white/80 animate-[landing-blink_1.2s_infinite]"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </div>
                  )}
                </div>

                {/* AI Assistant Status Bar + Composer */}
                <div className="bg-white border-t border-[var(--border)] px-3.5 pt-2 pb-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border)]/70">
                    <span className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-heading)]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isAiPaused ? 'bg-[var(--text-disabled)]' : 'bg-[var(--success)]'
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {isAiPaused ? 'AI Assistant is Paused' : 'AI Assistant is Active'}
                      </span>
                      {!isAiPaused && (
                        <span className="px-2 py-[1px] rounded-full bg-[var(--success-bg)] text-[var(--success)] text-[10px] font-semibold">
                          Active
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAi}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-green)] hover:border-[var(--brand-primary)]/40 text-[11px] font-medium text-[var(--brand-primary)] transition-colors cursor-pointer"
                    >
                      {isAiPaused ? (
                        <>
                          <Play className="w-2.5 h-2.5" />
                          <span>Resume AI</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-2.5 h-2.5" />
                          <span>Pause AI</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Composer Row */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSendMessage()
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="p-1.5 text-[var(--text-muted)] max-[640px]:hidden">
                      <Paperclip className="w-3.5 h-3.5" />
                    </span>
                    <span className="p-1.5 text-[var(--text-muted)] max-[640px]:hidden">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                    <span className="p-1.5 text-[var(--text-muted)] max-[640px]:hidden">
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </span>
                    <button
                      type="button"
                      onClick={handleDraftWithAi}
                      title="Draft reply with Parsona AI"
                      aria-label="Draft reply with Parsona AI"
                      className="p-1.5 rounded-md bg-[var(--surface-lavender)] text-[var(--accent-text)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="submit"
                      disabled={isTyping || !inputValue.trim()}
                      aria-label="Send message"
                      className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] disabled:opacity-55 text-white grid place-items-center transition-colors cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      maxLength={260}
                      placeholder="Type a message or test clinic AI reply..."
                      aria-label="Type a message"
                      className="flex-1 min-w-0 h-8 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[var(--brand-primary)] px-3 text-[12px] text-[var(--text-body)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                    />
                  </form>

                  <p className="text-[10.5px] text-[var(--text-secondary)]">
                    Tap{' '}
                    <button
                      type="button"
                      onClick={handleDraftWithAi}
                      className="text-[var(--accent-text)] font-semibold hover:underline cursor-pointer"
                    >
                      ✨
                    </button>{' '}
                    to draft a reply with AI — or send a patient question to test live clinic booking
                  </p>
                </div>
              </div>

              {/* Column 4: Right Patient CRM & Appointment Details Panel */}
              <aside
                aria-label="Patient CRM details"
                className="bg-white border-l border-[var(--border)] p-4 flex flex-col gap-3.5 max-[1020px]:hidden"
              >
                {/* Patient Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                  <div className="relative shrink-0">
                    <span
                      className="w-11 h-11 rounded-full grid place-items-center text-[13px] font-bold border border-[var(--border)]"
                      style={{ backgroundColor: contact.avatarBg, color: contact.avatarText }}
                    >
                      {contact.initials}
                    </span>
                    <span className="absolute -right-0.5 -bottom-0.5 ring-2 ring-white rounded-full">
                      <ChannelBadgeIcon channel={contact.channel} size={15} />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <b className={`block ${DISPLAY_FONT} text-[14px] font-semibold text-[var(--text-heading)] truncate`}>
                      {contact.name}
                    </b>
                    <span className="block text-[11px] text-[var(--text-secondary)] truncate">
                      {contact.handle}
                    </span>
                    <span className="block text-[10.5px] text-[var(--text-muted)] mt-0.5">
                      Patient since {contact.since}
                    </span>
                  </div>
                </div>

                {/* Phone & Email */}
                <div className="space-y-1.5 pb-3 border-b border-[var(--border)] text-[11.5px]">
                  <div className="flex items-center justify-between gap-2 text-[var(--text-heading)]">
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      <Phone className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                      <span className="truncate font-medium">{contact.phone}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      aria-label="Copy phone number"
                      className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-pointer shrink-0"
                    >
                      {copiedPhone ? (
                        <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)] truncate">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                </div>

                {/* Connected Channels */}
                <div className="space-y-1.5 pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.06em] uppercase text-[var(--text-secondary)]">
                    <span>Connected Channels ({contact.connectedChannels.length})</span>
                    <span className="text-[var(--brand-primary)] normal-case tracking-normal font-semibold">
                      + Connect
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {contact.connectedChannels.map((ch) => (
                      <div
                        key={ch.channel}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border ${
                          ch.active
                            ? 'bg-[var(--surface-green)] border-[var(--brand-primary)]/25'
                            : 'bg-[var(--surface-secondary)] border-[var(--border)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChannelBadgeIcon channel={ch.channel} size={17} />
                          <div className="min-w-0 leading-tight">
                            <span className="block text-[11px] font-semibold text-[var(--text-heading)] truncate">
                              {ch.label}
                            </span>
                            <span className="block text-[10px] text-[var(--text-secondary)] truncate">
                              {ch.sublabel}
                            </span>
                          </div>
                        </div>
                        {ch.active && (
                          <span className="px-2 py-[2px] rounded-full bg-white border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-[9.5px] font-semibold shrink-0">
                            Active Thread
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Appointment & Lead Record */}
                <div className="pb-3 border-b border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase text-[var(--text-secondary)]">
                      <Calendar className="w-3 h-3 text-[var(--brand-primary)]" />
                      <span>Appointment Record</span>
                    </div>
                    <span className="px-2 py-[2px] rounded-full bg-[var(--success-bg)] text-[var(--success)] text-[10px] font-semibold">
                      {contact.appointmentStatus}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] p-2.5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-secondary)]">Type</span>
                      <strong className="text-[var(--text-heading)] font-semibold text-right">
                        {contact.appointmentType}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-secondary)]">Date &amp; Time</span>
                      <strong className="text-[var(--text-heading)] font-semibold text-right">
                        {contact.appointmentDate} · {contact.appointmentTime}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-secondary)]">Clinic</span>
                      <strong className="text-[var(--text-heading)] font-semibold truncate text-right">
                        {contact.clinicName}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)]">
                      <span className="text-[var(--text-secondary)]">Lead stage</span>
                      <span className="px-2 py-[1px] rounded-full bg-[var(--surface-lavender)] text-[var(--accent-text)] font-semibold text-[10px]">
                        {contact.leadStage}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex-1 flex flex-col justify-end">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase text-[var(--text-secondary)] mb-1.5">
                    <FileText className="w-3 h-3" />
                    <span>Notes</span>
                  </div>

                  {currentNotes.length > 0 && (
                    <div className="space-y-1.5 mb-2 max-h-16 overflow-y-auto no-scrollbar">
                      {currentNotes.map((n, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-[var(--surface-secondary)] border border-[var(--border)] text-[11px] text-[var(--text-body)]"
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-stretch gap-1.5">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddNote()
                        }
                      }}
                      placeholder="Add a clinical note..."
                      aria-label="Add a clinical note"
                      className="flex-1 min-w-0 h-8 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[var(--brand-primary)] px-2.5 text-[11.5px] text-[var(--text-body)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      aria-label="Save note"
                      className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white grid place-items-center transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
