import React from 'react'
import { BTN_DARK, BTN_GREEN, BTN_OUTLINE, DISPLAY_FONT, HighlightBubble, MONO_FONT } from './shared'

const INBOX_CONVERSATIONS = [
  {
    initials: 'AS',
    bg: '#FFD9C2',
    channelColor: 'bg-[#1FD27A]',
    name: 'Aanya Sharma',
    preview: 'Can I pay on delivery?',
    time: '2m',
    unread: 2,
    active: true,
  },
  {
    initials: 'RK',
    bg: '#FFE9A8',
    channelColor: 'bg-[#FF8A5B]',
    name: 'Rohit Kapoor',
    preview: 'What is the combo price?',
    time: '6m',
    unread: 1,
    active: false,
  },
  {
    initials: 'MJ',
    bg: '#CFE3F8',
    channelColor: 'bg-[#4C8DF0]',
    name: 'Meera Joshi',
    preview: 'Can I move my slot to Monday?',
    time: '14m',
    active: false,
  },
  {
    initials: 'DP',
    bg: '#DCE7DF',
    channelColor: 'bg-[#1FD27A]',
    name: 'Dev Patel',
    preview: 'Invoice received, thank you',
    time: '1h',
    active: false,
  },
  {
    initials: 'IV',
    bg: '#E3DCFA',
    channelColor: 'bg-[#FF8A5B]',
    name: 'Isha Verma',
    preview: 'AI: It ships in 2 to 3 days',
    time: '2h',
    active: false,
  },
]

export function HeroSection() {
  return (
    <section className="pt-11">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-center max-[980px]:grid-cols-1 max-[980px]:gap-9">
          {/* Left Copy */}
          <div>
            <div className="relative">
              <div
                className={`inline-flex items-center gap-[10px] ${MONO_FONT} font-medium text-[13px] tracking-[0.04em] text-[#0B3B2E] bg-[#DCE7DF] rounded-lg px-3 py-[7px] mb-5`}
              >
                <span className="w-2 h-2 rounded-full bg-[#1FD27A] shadow-[0_0_0_3px_rgba(31,210,122,0.25)]" />
                WhatsApp · Instagram · Facebook
              </div>
              <h1
                className={`${DISPLAY_FONT} text-[clamp(34px,3.7vw,54px)] font-bold tracking-[-0.045em] leading-[1.1] text-balance text-[#0E1512]`}
              >
                Every message answered.
                <br />
                Every lead <HighlightBubble>followed up.</HighlightBubble>
              </h1>
            </div>

            <div className="mt-6">
              <p className="text-[19px] text-[#52625A] max-w-[540px]">
                Parsona puts all three apps into one team inbox, then takes over the repetitive work
                with broadcasts, a built-in CRM, a flow builder and AI agents that know your
                catalogue.
              </p>
              <div className="flex gap-3 flex-wrap mt-7">
                <a href="#pricing" className={BTN_DARK}>
                  Start 14-day free trial
                </a>
                <a href="#platform" className={BTN_OUTLINE}>
                  See it working
                </a>
              </div>
              <p className={`mt-4 ${MONO_FONT} text-[13px] text-[#52625A]`}>
                No credit card. Official WhatsApp API connected in about 10 minutes.
              </p>
            </div>
          </div>

          {/* Right Animated Message Flow Diagram */}
          <div
            className="w-full max-w-[460px] ml-auto max-[980px]:mx-auto bg-white [background-image:radial-gradient(#D3DCD6_1px,transparent_1.2px)] [background-size:16px_16px] border-[1.5px] border-[#0E1512] rounded-[22px] shadow-[8px_8px_0_#0B3B2E] overflow-hidden"
            role="img"
            aria-label="Diagram: WhatsApp, Instagram and Facebook messages flow into the Parsona inbox, CRM, flows and AI agent"
          >
            <svg viewBox="0 0 440 460" aria-hidden="true" className={`block w-full h-auto ${MONO_FONT}`}>
              <defs>
                <linearGradient id="igg" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#FEDA75" />
                  <stop offset="0.25" stopColor="#FA7E1E" />
                  <stop offset="0.5" stopColor="#D62976" />
                  <stop offset="0.75" stopColor="#962FBF" />
                  <stop offset="1" stopColor="#4F5BD5" />
                </linearGradient>
                <clipPath id="fbc">
                  <circle cx="24" cy="24" r="24" />
                </clipPath>
              </defs>

              <text x="24" y="30" className="text-[10.5px] tracking-[0.07em] fill-[#52625A]">
                INCOMING MESSAGES
              </text>
              <circle cx="366" cy="26" r="4" fill="#1FD27A" className="animate-[landing-fblink_1.6s_ease-in-out_infinite]" />
              <text x="376" y="30" className="text-[10.5px] tracking-[0.07em] fill-[#52625A]">
                LIVE
              </text>

              {/* Channel Badges */}
              <g transform="translate(83 44)">
                <rect width="54" height="54" rx="12" fill="#F1F4F0" stroke="#D9E1DB" />
                <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="24" fill="#25D366" />
                  <path
                    transform="translate(9 9) scale(1.25)"
                    fill="#fff"
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                  />
                </svg>
              </g>
              <g transform="translate(193 44)">
                <rect width="54" height="54" rx="12" fill="#F1F4F0" stroke="#D9E1DB" />
                <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                  <rect width="48" height="48" rx="13" fill="url(#igg)" />
                  <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
                  <circle cx="24" cy="24" r="6.5" fill="none" stroke="#fff" strokeWidth="3" />
                  <circle cx="31.5" cy="16.5" r="1.9" fill="#fff" />
                </svg>
              </g>
              <g transform="translate(303 44)">
                <rect width="54" height="54" rx="12" fill="#F1F4F0" stroke="#D9E1DB" />
                <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="24" fill="#1877F2" />
                  <path
                    clipPath="url(#fbc)"
                    d="M26.7 48V30h6l.9-7h-6.9v-4.5c0-2 .6-3.4 3.5-3.4H34V9c-.6-.1-2.8-.3-5.3-.3-5.3 0-8.8 3.2-8.8 9V23h-6v7h6v18z"
                    fill="#fff"
                  />
                </svg>
              </g>

              <text x="110" y="116" textAnchor="middle" className="text-[10px] tracking-[0.06em] fill-[#52625A]">
                WHATSAPP
              </text>
              <text x="220" y="116" textAnchor="middle" className="text-[10px] tracking-[0.06em] fill-[#52625A]">
                INSTAGRAM
              </text>
              <text x="330" y="116" textAnchor="middle" className="text-[10px] tracking-[0.06em] fill-[#52625A]">
                FACEBOOK
              </text>

              {/* Animated Connectors */}
              <path d="M110 126V150H140" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M110 126V150H140"
                fill="none"
                stroke="#25D366"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '0s' }}
              />
              <path d="M220 126V150H140" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M220 126V150H140"
                fill="none"
                stroke="#D62976"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '-0.5s' }}
              />
              <path d="M330 126V150H140" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M330 126V150H140"
                fill="none"
                stroke="#1877F2"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '-1s' }}
              />
              <path d="M140 150V202" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 150V202"
                fill="none"
                stroke="#1FD27A"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '1s' }}
              />

              <circle cx="140" cy="150" r="3.5" fill="#fff" stroke="#B3C1B8" strokeWidth="1.5" />
              <rect x="40" y="176" width="360" height="268" rx="8" fill="none" stroke="#C9D4CD" strokeWidth="1.5" />
              <rect x="52" y="169" width="78" height="15" fill="#fff" />
              <text x="60" y="181" className="text-[11.5px] tracking-[0.06em] fill-[#0E1512]">
                PARSONA
              </text>

              <path d="M140 246V262" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 246V262"
                fill="none"
                stroke="#1FD27A"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '1.6s' }}
              />
              <path d="M140 306V322" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 306V322"
                fill="none"
                stroke="#1FD27A"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '2.2s' }}
              />
              <path d="M140 366V382" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M140 366V382"
                fill="none"
                stroke="#1FD27A"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="animate-[landing-fdash_2.6s_linear_infinite]"
                style={{ animationDelay: '2.8s' }}
              />

              {/* Nodes */}
              <g transform="translate(118 202)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#1FD27A"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '0s' }}
                />
                <rect width="44" height="44" rx="11" fill="#1FD27A" stroke="#0E1512" strokeWidth="1.5" />
                <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 13l3-8h12l3 8v6H3z" />
                  <path d="M3 13h5l1 3h6l1-3h5" />
                </g>
              </g>
              <text x="178" y="221" className="text-[12px] tracking-[0.06em] fill-[#0E1512] font-medium">
                INBOX
              </text>
              <text x="178" y="237" className="text-[10.5px] fill-[#52625A]">
                One shared thread
              </text>

              <g transform="translate(118 262)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#B9A6FF"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '1s' }}
                />
                <rect width="44" height="44" rx="11" fill="#B9A6FF" stroke="#0E1512" strokeWidth="1.5" />
                <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="5" height="16" rx="1.5" />
                  <rect x="10" y="4" width="5" height="10" rx="1.5" />
                  <rect x="17" y="4" width="4" height="13" rx="1.5" />
                </g>
              </g>
              <text x="178" y="281" className="text-[12px] tracking-[0.06em] fill-[#0E1512] font-medium">
                CRM
              </text>
              <text x="178" y="297" className="text-[10.5px] fill-[#52625A]">
                Profile + deals
              </text>

              <g transform="translate(118 322)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#FF9E7A"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '2s' }}
                />
                <rect width="44" height="44" rx="11" fill="#FF9E7A" stroke="#0E1512" strokeWidth="1.5" />
                <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="12" r="2.5" />
                  <circle cx="18.5" cy="5.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                  <path d="M8 11l8.2-4.3M8 13l8.2 4.3" />
                </g>
              </g>
              <text x="178" y="341" className="text-[12px] tracking-[0.06em] fill-[#0E1512] font-medium">
                FLOWS
              </text>
              <text x="178" y="357" className="text-[10.5px] fill-[#52625A]">
                Triggers + rules
              </text>

              <g transform="translate(118 382)">
                <rect
                  x="-4"
                  y="-4"
                  width="52"
                  height="52"
                  rx="14"
                  fill="none"
                  stroke="#8FBBFF"
                  strokeWidth="2"
                  className="opacity-0 animate-[landing-fring_4s_ease-in-out_infinite]"
                  style={{ animationDelay: '3s' }}
                />
                <rect width="44" height="44" rx="11" fill="#8FBBFF" stroke="#0E1512" strokeWidth="1.5" />
                <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="8" width="14" height="11" rx="3" />
                  <path d="M12 4v4M9.5 13v1.5M14.5 13v1.5" />
                  <circle cx="12" cy="3.5" r="1" fill="#0E1512" />
                </g>
              </g>
              <text x="178" y="401" className="text-[12px] tracking-[0.06em] fill-[#0E1512] font-medium">
                AI AGENT
              </text>
              <text x="178" y="417" className="text-[10.5px] fill-[#52625A]">
                Replies + handoff
              </text>

              <path d="M312 404H335V224H312" fill="none" stroke="#B3C1B8" strokeWidth="1.5" strokeDasharray="3 4" />
              <path
                pathLength={100}
                d="M312 404H335V224H312"
                fill="none"
                stroke="#4C8DF0"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="10 90"
                className="animate-[landing-fdash_3.6s_linear_infinite]"
                style={{ animationDelay: '3.2s' }}
              />
              <polygon points="304,224 313,219 313,229" fill="#8FBBFF" />
              <text
                transform="translate(358 314) rotate(90)"
                textAnchor="middle"
                className="text-[10.5px] tracking-[0.07em] fill-[#52625A]"
              >
                SHARED CONTEXT
              </text>
            </svg>
          </div>
        </div>

        {/* Product Console Preview */}
        <div className="relative mt-9 max-[720px]:mt-7">
          <div
            className="bg-white border-[1.5px] border-[#0E1512] rounded-[22px] overflow-hidden shadow-[10px_10px_0_#0B3B2E] max-[720px]:shadow-[6px_6px_0_#0B3B2E]"
            role="img"
            aria-label="Preview of the Parsona team inbox showing a WhatsApp conversation with an AI suggested reply and customer profile"
          >
            {/* Browser Bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D9E1DB] bg-[#FAFBF9]">
              <i className="w-[11px] h-[11px] rounded-full bg-[#D9E1DB]" />
              <i className="w-[11px] h-[11px] rounded-full bg-[#D9E1DB]" />
              <i className="w-[11px] h-[11px] rounded-full bg-[#D9E1DB]" />
              <span className={`mx-auto ${MONO_FONT} text-[12px] text-[#52625A]`}>
                app.parsona.com/inbox
              </span>
            </div>

            <div
              className="grid grid-cols-[310px_minmax(0,1fr)_290px] min-h-[560px] max-[1100px]:grid-cols-[290px_minmax(0,1fr)] max-[720px]:grid-cols-1"
              aria-hidden="true"
            >
              {/* Left Conversation List */}
              <aside className="border-r border-[#D9E1DB] max-[720px]:hidden">
                <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
                  <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.02em]`}>Inbox</b>
                  <span className={`min-w-[20px] h-5 rounded-[10px] bg-[#D92D20] text-white ${MONO_FONT} font-medium text-[11px] inline-grid place-items-center px-[6px]`}>
                    11
                  </span>
                </div>
                <div className={`flex gap-[6px] px-[18px] pb-3 ${MONO_FONT} font-medium text-[12px]`}>
                  <span className="px-[9px] py-[5px] rounded-[7px] bg-[#0E1512] text-white">Mine 3</span>
                  <span className="px-[9px] py-[5px] rounded-[7px] bg-[#F1F4F0] text-[#52625A]">Open 8</span>
                  <span className="px-[9px] py-[5px] rounded-[7px] bg-[#F1F4F0] text-[#52625A]">AI 41</span>
                </div>
                {INBOX_CONVERSATIONS.map((c) => (
                  <div
                    key={c.name}
                    className={`flex gap-3 px-[18px] py-[13px] border-t border-[#EDF1EC] items-center ${c.active ? 'bg-[#E6F7EE]' : ''}`}
                  >
                    <div
                      className="relative w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] shrink-0"
                      style={{ background: c.bg }}
                    >
                      {c.initials}
                      <span className={`absolute -right-[2px] -bottom-[2px] w-[14px] h-[14px] rounded-full border-2 border-white ${c.channelColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[14.5px] leading-[1.25]">{c.name}</b>
                      <span className="block text-[13px] text-[#52625A] whitespace-nowrap overflow-hidden text-ellipsis">
                        {c.preview}
                      </span>
                    </div>
                    <div className={`grid justify-items-end gap-[5px] ${MONO_FONT} text-[11.5px] text-[#52625A]`}>
                      <span>{c.time}</span>
                      {c.unread && (
                        <span className="min-w-[20px] h-5 rounded-[10px] bg-[#D92D20] text-white font-medium text-[11px] inline-grid place-items-center px-[6px]">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </aside>

              {/* Center Thread */}
              <div className="flex flex-col bg-[#F6F8F5] min-w-0">
                <div className="flex items-center gap-3 px-5 py-[14px] bg-white border-b border-[#D9E1DB]">
                  <div className="relative w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] shrink-0 bg-[#FFD9C2]">
                    AS
                    <span className="absolute -right-[2px] -bottom-[2px] w-[14px] h-[14px] rounded-full border-2 border-white bg-[#1FD27A]" />
                  </div>
                  <div>
                    <b className="block text-[15.5px] leading-[1.2]">Aanya Sharma</b>
                    <small className={`${MONO_FONT} text-[12px] text-[#52625A]`}>
                      WhatsApp · +91 98•• ••210
                    </small>
                  </div>
                  <div className="ml-auto flex gap-2 flex-wrap justify-end">
                    <span className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] tracking-[0.02em] bg-[#0B3B2E] text-white`}>
                      AI drafting
                    </span>
                    <span className={`inline-block ${MONO_FONT} font-medium text-[11px] px-2 py-[3px] rounded-[6px] tracking-[0.02em] bg-[#D4F5E3] text-[#0B5F37]`}>
                      Assigned: Rohan
                    </span>
                  </div>
                </div>

                <div className="flex-1 px-5 py-[22px] flex flex-col gap-[11px]">
                  <div className={`self-center ${MONO_FONT} text-[12px] text-[#52625A] border border-dashed border-[#B3C1B8] rounded-lg px-[11px] py-[5px] bg-white`}>
                    Instagram story reply → catalogue sent · Mon 10:12
                  </div>
                  <div className="max-w-[78%] max-[720px]:max-w-[92%] px-[15px] py-[11px] rounded-[16px] rounded-tl-[4px] text-[14.5px] leading-[1.45] bg-white border border-[#D9E1DB] self-start">
                    Hi, is the cotton kurta set available in M? I need it by Friday.
                  </div>
                  <div className="max-w-[78%] max-[720px]:max-w-[92%] px-[15px] py-[11px] rounded-[16px] rounded-tr-[4px] text-[14.5px] leading-[1.45] bg-[#D4F5E3] border border-[#AEE8C9] self-end">
                    <span className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.05em] uppercase text-[#0B3B2E] mb-1`}>
                      Parsona AI
                    </span>
                    Hi Aanya! Yes, size M is in stock and reaches you by Thursday. Shall I hold it?
                  </div>
                  <div className="max-w-[78%] max-[720px]:max-w-[92%] px-[15px] py-[11px] rounded-[16px] rounded-tl-[4px] text-[14.5px] leading-[1.45] bg-white border border-[#D9E1DB] self-start">
                    Yes please. Can I pay on delivery?
                  </div>
                  <div className="self-start flex gap-1 px-[14px] py-3 bg-white border border-[#D9E1DB] rounded-[16px] rounded-tl-[4px]">
                    <i className="w-[6px] h-[6px] rounded-full bg-[#98A89F] animate-[landing-blink_1.2s_infinite]" />
                    <i className="w-[6px] h-[6px] rounded-full bg-[#98A89F] animate-[landing-blink_1.2s_infinite]" style={{ animationDelay: '0.15s' }} />
                    <i className="w-[6px] h-[6px] rounded-full bg-[#98A89F] animate-[landing-blink_1.2s_infinite]" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>

                {/* AI Suggestion Bar */}
                <div className="mx-5 mb-4 bg-[#0B3B2E] text-white rounded-[14px] px-4 py-[14px] flex gap-[14px] items-center flex-wrap">
                  <div className="flex-1 min-w-[200px] text-[14px]">
                    <small className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#7FE5B2] mb-[3px]`}>
                      AI suggestion
                    </small>
                    Cash on delivery is available. I have added the kurta set to your cart. Want a
                    tracking link once it ships?
                  </div>
                  <span className={`${BTN_GREEN} !h-9 !text-[13px] !px-[14px] !rounded-[9px]`}>
                    Send
                  </span>
                  <span className="inline-flex items-center justify-center h-9 px-[14px] rounded-[9px] font-semibold text-[13px] border-[1.5px] border-[#5E8F7E] text-white hover:bg-white hover:text-[#0E1512] transition-colors">
                    Edit
                  </span>
                </div>
              </div>

              {/* Right Customer Profile */}
              <aside className="border-l border-[#D9E1DB] px-5 py-[22px] flex flex-col gap-[18px] max-[1100px]:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full grid place-items-center font-bold text-[15px] shrink-0 bg-[#FFD9C2]">
                    AS
                  </div>
                  <div>
                    <b className={`block ${DISPLAY_FONT} text-[18px] tracking-[-0.02em] leading-[1.15]`}>
                      Aanya Sharma
                    </b>
                    <small className={`${MONO_FONT} text-[12px] text-[#52625A]`}>
                      Customer since Mar 2025
                    </small>
                  </div>
                </div>
                <div className="flex gap-[6px] flex-wrap">
                  <span className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#FFE1D6] text-[#8A3A12]`}>
                    Hot lead
                  </span>
                  <span className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#DCE7DF] text-[#0B3B2E]`}>
                    Diwali buyer
                  </span>
                  <span className={`${MONO_FONT} font-medium text-[12px] px-[9px] py-1 rounded-[7px] bg-[#DCE7DF] text-[#0B3B2E]`}>
                    COD
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-[10px]">
                  <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                    <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Lifetime value</small>
                    <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.03em]`}>₹18,240</b>
                  </div>
                  <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                    <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Orders</small>
                    <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.03em]`}>6</b>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-[10px]">
                  <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                    <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Stage</small>
                    <b className={`${DISPLAY_FONT} text-[16px] tracking-[-0.03em]`}>Negotiation</b>
                  </div>
                  <div className="bg-[#F4F7F3] rounded-[12px] px-3 py-[11px]">
                    <small className={`block ${MONO_FONT} text-[11px] text-[#52625A]`}>Returns</small>
                    <b className={`${DISPLAY_FONT} text-[20px] tracking-[-0.03em]`}>0</b>
                  </div>
                </div>
                <div className="text-[13.5px] leading-[1.5] text-[#2A3731] border-t border-[#D9E1DB] pt-[14px]">
                  <small className={`block ${MONO_FONT} font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#0B3B2E] mb-[6px]`}>
                    AI summary
                  </small>
                  Repeat buyer asking about cash on delivery for kurta set (M). Low return risk.
                  Best next step: confirm order and share the tracking link.
                </div>
              </aside>
            </div>
          </div>
        </div>

        {/* Trust / Waitlist Social Proof Bar */}
        <div className="mt-[72px] max-[720px]:mt-12 flex items-center justify-between gap-5 flex-wrap py-[22px] max-[720px]:py-6 border-y border-[#D9E1DB] max-[720px]:flex-col max-[720px]:items-center max-[720px]:text-center max-[720px]:gap-4">
          <div className="flex items-center gap-4 flex-wrap max-[720px]:flex-col max-[720px]:items-center max-[720px]:gap-3">
            <div className="flex items-center -space-x-[10px]" aria-hidden="true">
              {[
                { initials: 'AS', bg: '#FFD9C2' },
                { initials: 'MJ', bg: '#CFE3F8' },
                { initials: 'RK', bg: '#FFE9A8' },
                { initials: 'IV', bg: '#E3DCFA' },
                { initials: 'DP', bg: '#D4F5E3' },
              ].map((avatar) => (
                <span
                  key={avatar.initials}
                  className={`w-10 h-10 max-[720px]:w-9 max-[720px]:h-9 rounded-full border-[1.5px] border-[#0E1512] grid place-items-center ${MONO_FONT} font-semibold text-[11.5px] text-[#0E1512]`}
                  style={{ backgroundColor: avatar.bg }}
                >
                  {avatar.initials}
                </span>
              ))}
            </div>
            <p className="text-[15.5px] max-[720px]:text-[15px] text-[#52625A]">
              <strong className="font-semibold text-[#0E1512]">100+ teams</strong> have already
              joined the waitlist
            </p>
          </div>

          <a
            href="#waitlist"
            className={`inline-flex items-center justify-center gap-1.5 h-10 px-[18px] max-[720px]:w-full max-[720px]:h-11 rounded-[12px] bg-white border-[1.5px] border-[#0E1512] ${MONO_FONT} font-medium text-[13px] text-[#0E1512] hover:bg-[#0E1512] hover:text-white transition-colors whitespace-nowrap focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px]`}
          >
            <span>Join them</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}

