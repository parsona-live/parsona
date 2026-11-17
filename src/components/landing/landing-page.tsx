'use client'

import React, { useState, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import './landing.css'

interface LandingPageViewProps {
  user?: User | null
}

export function LandingPageView({ user }: LandingPageViewProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [isYearly, setIsYearly] = useState(false)

  // Waitlist form state
  const [wlName, setWlName] = useState('')
  const [wlEmail, setWlEmail] = useState('')
  const [wlPhone, setWlPhone] = useState('')
  const [wlErrors, setWlErrors] = useState<{ name?: string; email?: string; phone?: string }>({})
  const [wlSubmitted, setWlSubmitted] = useState(false)
  const [wlFirstName, setWlFirstName] = useState('')

  const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([])

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIndex = (index + 1) % 5
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + 5) % 5
    } else {
      return
    }
    e.preventDefault()
    setActiveTab(nextIndex)
    tabButtonsRef.current[nextIndex]?.focus()
  }

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: { name?: string; email?: string; phone?: string } = {}

    const nameTrimmed = wlName.trim()
    if (nameTrimmed.length < 2) {
      errors.name = 'Please enter your name.'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    if (!emailRegex.test(wlEmail.trim())) {
      errors.email = 'Enter a valid email address.'
    }

    const phoneDigits = wlPhone.replace(/\D/g, '')
    const phoneValid = /^[+\d][\d\s().-]*$/.test(wlPhone.trim()) && phoneDigits.length >= 7 && phoneDigits.length <= 15
    if (!phoneValid) {
      errors.phone = 'Enter a valid number, e.g. +91 98765 43210.'
    }

    setWlErrors(errors)

    if (Object.keys(errors).length === 0) {
      const first = nameTrimmed.split(/\s+/)[0]
      setWlFirstName(first)
      setWlSubmitted(true)
    }
  }

  return (
    <div className="landing-page-root">
      {/* TOP BAR */}
      <header className="top">
        <div className="wrap top-i">
          <a href="#top" className="logo" aria-label="Parsona home">
            <span className="mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 21V4h6.5a4.5 4.5 0 010 9H7" />
              </svg>
            </span>
            Parsona
          </a>

          <nav className={`nav ${mobileMenuOpen ? 'open' : ''}`} id="nav" aria-label="Main">
            <a href="#channels" onClick={() => setMobileMenuOpen(false)}>Channels</a>
            <a href="#platform" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            <a href="#automation" onClick={() => setMobileMenuOpen(false)}>Automation</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          </nav>

          <div className="status">
            <span className="dot"></span>All systems normal
          </div>

          <div className="top-r">
            <a href={user ? "/dashboard" : "/login"} className="login">
              {user ? "Dashboard" : "Log in"}
            </a>
            <a href="#waitlist" className="btn btn-o btn-sm">Join waitlist</a>
            <a href="#pricing" className="btn btn-k btn-sm">Start free</a>
          </div>

          <button
            className="burger"
            id="burger"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <div className="hero-grid">
              <div className="hero-l">
                <div className="hero-top">
                  <div className="eyebrow">
                    <span className="dot"></span>WhatsApp · Instagram · Facebook
                  </div>
                  <h1>
                    Every message answered.<br />
                    Every lead <span className="bubble">followed up.</span>
                  </h1>
                </div>

                <div className="hero-b">
                  <div>
                    <p className="lead">
                      Parsona puts all three apps into one team inbox, then takes over the repetitive work with broadcasts, a built-in CRM, a flow builder and AI agents that know your catalogue.
                    </p>
                    <div className="row">
                      <a href="#pricing" className="btn btn-k">Start 14-day free trial</a>
                      <a href="#platform" className="btn btn-o">See it working</a>
                    </div>
                    <p className="fine">No credit card. Official WhatsApp API connected in about 10 minutes.</p>
                  </div>
                </div>
              </div>

              {/* FLOW DIAGRAM */}
              <div className="flow" role="img" aria-label="Diagram: WhatsApp, Instagram and Facebook messages flow into the Parsona inbox, CRM, flows and AI agent">
                <svg viewBox="0 0 440 460" aria-hidden="true">
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
                  <text className="fl-t" x="24" y="30">INCOMING MESSAGES</text>
                  <circle className="live" cx="366" cy="26" r="4" fill="#1FD27A" />
                  <text className="fl-t" x="376" y="30">LIVE</text>
                  <g transform="translate(83 44)">
                    <rect width="54" height="54" rx="12" fill="#F1F4F0" stroke="#D9E1DB" />
                    <svg x="10" y="10" width="34" height="34" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="24" fill="#25D366" />
                      <path transform="translate(9 9) scale(1.25)" fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
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
                      <path clipPath="url(#fbc)" d="M26.7 48V30h6l.9-7h-6.9v-4.5c0-2 .6-3.4 3.5-3.4H34V9c-.6-.1-2.8-.3-5.3-.3-5.3 0-8.8 3.2-8.8 9V23h-6v7h6v18z" fill="#fff" />
                    </svg>
                  </g>
                  <text className="fl-l" x="110" y="116" textAnchor="middle">WHATSAPP</text>
                  <text className="fl-l" x="220" y="116" textAnchor="middle">INSTAGRAM</text>
                  <text className="fl-l" x="330" y="116" textAnchor="middle">FACEBOOK</text>
                  <path className="base" d="M110 126V150H140" />
                  <path className="pulse pa" pathLength={100} d="M110 126V150H140" style={{ animationDelay: '0s', animationDuration: '2.6s' }} />
                  <path className="base" d="M220 126V150H140" />
                  <path className="pulse pb" pathLength={100} d="M220 126V150H140" style={{ animationDelay: '-.5s', animationDuration: '2.6s' }} />
                  <path className="base" d="M330 126V150H140" />
                  <path className="pulse pc" pathLength={100} d="M330 126V150H140" style={{ animationDelay: '-1s', animationDuration: '2.6s' }} />
                  <path className="base" d="M140 150V202" />
                  <path className="pulse pd" pathLength={100} d="M140 150V202" style={{ animationDelay: '1s', animationDuration: '2.6s' }} />
                  <circle cx="140" cy="150" r="3.5" fill="#fff" stroke="#B3C1B8" strokeWidth="1.5" />
                  <rect x="40" y="176" width="360" height="268" rx="8" fill="none" stroke="#C9D4CD" strokeWidth="1.5" />
                  <rect x="52" y="169" width="78" height="15" fill="#fff" />
                  <text className="fl-g" x="60" y="181">PARSONA</text>
                  <path className="base" d="M140 246V262" />
                  <path className="pulse pd" pathLength={100} d="M140 246V262" style={{ animationDelay: '1.6s', animationDuration: '2.6s' }} />
                  <path className="base" d="M140 306V322" />
                  <path className="pulse pd" pathLength={100} d="M140 306V322" style={{ animationDelay: '2.2s', animationDuration: '2.6s' }} />
                  <path className="base" d="M140 366V382" />
                  <path className="pulse pd" pathLength={100} d="M140 366V382" style={{ animationDelay: '2.8s', animationDuration: '2.6s' }} />
                  <g transform="translate(118 202)">
                    <rect className="ring" x="-4" y="-4" width="52" height="52" rx="14" stroke="#1FD27A" style={{ animationDelay: '0s' }} />
                    <rect width="44" height="44" rx="11" fill="#1FD27A" stroke="#0E1512" strokeWidth="1.5" />
                    <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 13l3-8h12l3 8v6H3z" />
                      <path d="M3 13h5l1 3h6l1-3h5" />
                    </g>
                  </g>
                  <text className="fl-n" x="178" y="221">INBOX</text>
                  <text className="fl-s" x="178" y="237">One shared thread</text>
                  <g transform="translate(118 262)">
                    <rect className="ring" x="-4" y="-4" width="52" height="52" rx="14" stroke="#B9A6FF" style={{ animationDelay: '1s' }} />
                    <rect width="44" height="44" rx="11" fill="#B9A6FF" stroke="#0E1512" strokeWidth="1.5" />
                    <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="5" height="16" rx="1.5" />
                      <rect x="10" y="4" width="5" height="10" rx="1.5" />
                      <rect x="17" y="4" width="4" height="13" rx="1.5" />
                    </g>
                  </g>
                  <text className="fl-n" x="178" y="281">CRM</text>
                  <text className="fl-s" x="178" y="297">Profile + deals</text>
                  <g transform="translate(118 322)">
                    <rect className="ring" x="-4" y="-4" width="52" height="52" rx="14" stroke="#FF9E7A" style={{ animationDelay: '2s' }} />
                    <rect width="44" height="44" rx="11" fill="#FF9E7A" stroke="#0E1512" strokeWidth="1.5" />
                    <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5.5" cy="12" r="2.5" />
                      <circle cx="18.5" cy="5.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                      <path d="M8 11l8.2-4.3M8 13l8.2 4.3" />
                    </g>
                  </g>
                  <text className="fl-n" x="178" y="341">FLOWS</text>
                  <text className="fl-s" x="178" y="357">Triggers + rules</text>
                  <g transform="translate(118 382)">
                    <rect className="ring" x="-4" y="-4" width="52" height="52" rx="14" stroke="#8FBBFF" style={{ animationDelay: '3s' }} />
                    <rect width="44" height="44" rx="11" fill="#8FBBFF" stroke="#0E1512" strokeWidth="1.5" />
                    <g transform="translate(10 10)" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="8" width="14" height="11" rx="3" />
                      <path d="M12 4v4M9.5 13v1.5M14.5 13v1.5" />
                      <circle cx="12" cy="3.5" r="1" fill="#0E1512" />
                    </g>
                  </g>
                  <text className="fl-n" x="178" y="401">AI AGENT</text>
                  <text className="fl-s" x="178" y="417">Replies + handoff</text>
                  <path className="base" d="M312 404H335V224H312" />
                  <path className="pulse pl" pathLength={100} d="M312 404H335V224H312" style={{ animationDelay: '3.2s', animationDuration: '3.6s' }} />
                  <polygon points="304,224 313,219 313,229" fill="#8FBBFF" />
                  <text className="fl-t" transform="translate(358 314) rotate(90)" textAnchor="middle">SHARED CONTEXT</text>
                </svg>
              </div>
            </div>

            {/* CONSOLE PREVIEW */}
            <div className="stage">
              <div className="console" role="img" aria-label="Preview of the Parsona team inbox showing a WhatsApp conversation with an AI suggested reply and customer profile">
                <div className="c-bar">
                  <i></i><i></i><i></i><span>app.parsona.com/inbox</span>
                </div>
                <div className="c-body" aria-hidden="true">
                  <aside className="c-list">
                    <div className="c-h">
                      <b>Inbox</b><span className="badge">11</span>
                    </div>
                    <div className="c-tabs">
                      <span className="on">Mine 3</span>
                      <span>Open 8</span>
                      <span>AI 41</span>
                    </div>
                    <div className="ci on">
                      <div className="av" style={{ background: '#FFD9C2' }}>AS<span className="cd wa"></span></div>
                      <div className="cm"><b>Aanya Sharma</b><span>Can I pay on delivery?</span></div>
                      <div className="cr"><span>2m</span><span className="badge">2</span></div>
                    </div>
                    <div className="ci">
                      <div className="av" style={{ background: '#FFE9A8' }}>RK<span className="cd ig"></span></div>
                      <div className="cm"><b>Rohit Kapoor</b><span>What is the combo price?</span></div>
                      <div className="cr"><span>6m</span><span className="badge">1</span></div>
                    </div>
                    <div className="ci">
                      <div className="av" style={{ background: '#CFE3F8' }}>MJ<span className="cd fb"></span></div>
                      <div className="cm"><b>Meera Joshi</b><span>Can I move my slot to Monday?</span></div>
                      <div className="cr"><span>14m</span></div>
                    </div>
                    <div className="ci">
                      <div className="av" style={{ background: '#DCE7DF' }}>DP<span className="cd wa"></span></div>
                      <div className="cm"><b>Dev Patel</b><span>Invoice received, thank you</span></div>
                      <div className="cr"><span>1h</span></div>
                    </div>
                    <div className="ci">
                      <div className="av" style={{ background: '#E3DCFA' }}>IV<span className="cd ig"></span></div>
                      <div className="cm"><b>Isha Verma</b><span>AI: It ships in 2 to 3 days</span></div>
                      <div className="cr"><span>2h</span></div>
                    </div>
                  </aside>

                  <div className="c-thread">
                    <div className="t-h">
                      <div className="av" style={{ background: '#FFD9C2' }}>AS<span className="cd wa"></span></div>
                      <div><b>Aanya Sharma</b><small>WhatsApp · +91 98•• ••210</small></div>
                      <div className="sp">
                        <span className="tag tg-ai">AI drafting</span>
                        <span className="tag tg-wa" style={{ margin: 0 }}>Assigned: Rohan</span>
                      </div>
                    </div>
                    <div className="msgs">
                      <div className="event">Instagram story reply → catalogue sent · Mon 10:12</div>
                      <div className="m in">Hi, is the cotton kurta set available in M? I need it by Friday.</div>
                      <div className="m out">
                        <span className="who">Parsona AI</span>Hi Aanya! Yes, size M is in stock and reaches you by Thursday. Shall I hold it?
                      </div>
                      <div className="m in">Yes please. Can I pay on delivery?</div>
                      <div className="typing"><i></i><i></i><i></i></div>
                    </div>
                    <div className="suggest">
                      <div>
                        <small>AI suggestion</small>
                        Cash on delivery is available. I have added the kurta set to your cart. Want a tracking link once it ships?
                      </div>
                      <span className="btn btn-g">Send</span>
                      <span className="btn btn-o">Edit</span>
                    </div>
                  </div>

                  <aside className="c-prof">
                    <div className="p-top">
                      <div className="av" style={{ background: '#FFD9C2' }}>AS</div>
                      <div><b>Aanya Sharma</b><small>Customer since Mar 2025</small></div>
                    </div>
                    <div className="chips">
                      <span className="chip hot">Hot lead</span>
                      <span className="chip">Diwali buyer</span>
                      <span className="chip">COD</span>
                    </div>
                    <div className="kv">
                      <div><small>Lifetime value</small><b>₹18,240</b></div>
                      <div><small>Orders</small><b>6</b></div>
                    </div>
                    <div className="kv">
                      <div><small>Stage</small><b style={{ fontSize: 16 }}>Negotiation</b></div>
                      <div><small>Returns</small><b>0</b></div>
                    </div>
                    <div className="sum">
                      <small>AI summary</small>
                      Repeat buyer asking about cash on delivery for kurta set (M). Low return risk. Best next step: confirm order and share the tracking link.
                    </div>
                  </aside>
                </div>
              </div>
            </div>

            {/* TRUST LOGOS */}
            <div className="trust">
              <span>Trusted by 12,000+ teams</span>
              <div className="logos">
                <div className="lg"><i></i>Logo 1</div>
                <div className="lg"><i></i>Logo 2</div>
                <div className="lg"><i></i>Logo 3</div>
                <div className="lg"><i></i>Logo 4</div>
                <div className="lg"><i></i>Logo 5</div>
                <div className="lg"><i></i>Logo 6</div>
              </div>
            </div>
          </div>
        </section>

        {/* CHANNELS */}
        <section className="sec" id="channels">
          <div className="wrap row2">
            <div className="gut"><i></i>Channels<span className="badge">3</span></div>
            <div>
              <div className="sec-h">
                <h2>One customer. Three apps.<br /><span className="bubble">One timeline.</span></h2>
                <p className="lead">People do not stay on one channel, so your records should not either. Parsona merges every message, comment and order into a single history per customer.</p>
              </div>

              <div className="t-grid">
                <ul className="chdef">
                  <li>
                    <span className="ico" style={{ background: '#D4F5E3' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 20.5l1.7-5.5A8.4 8.4 0 1121 11.5z" />
                      </svg>
                    </span>
                    <div>
                      <b>WhatsApp</b>
                      <span>Official Business API with approved templates, catalogue messages, order updates and click-to-chat links.</span>
                    </div>
                  </li>
                  <li>
                    <span className="ico" style={{ background: '#FFE1D6' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17" cy="7" r="1" fill="#0E1512" />
                      </svg>
                    </span>
                    <div>
                      <b>Instagram</b>
                      <span>DMs, story replies and comment-to-DM flows that start the moment someone types a keyword.</span>
                    </div>
                  </li>
                  <li>
                    <span className="ico" style={{ background: '#D9E6FB' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3C6.8 3 3 6.6 3 11.2c0 2.6 1.3 4.8 3.3 6.3V21l3.2-1.8c.8.2 1.6.3 2.5.3 5.2 0 9-3.6 9-8.2S17.2 3 12 3z" />
                      </svg>
                    </span>
                    <div>
                      <b>Facebook</b>
                      <span>Messenger, page comments and click-to-Messenger ad replies, routed to the right teammate.</span>
                    </div>
                  </li>
                </ul>

                <div className="tl">
                  <div className="tl-h">
                    <b>Aanya Sharma</b>
                    <span className="tag tg-ai" style={{ margin: 0 }}>3 channels · 1 history</span>
                  </div>
                  <ol>
                    <li className="ig">
                      <time>Mon 10:12</time>
                      <p><span className="tag tg-ig">Instagram</span>Replied to the <em>Diwali edit</em> story. A flow sent the catalogue.</p>
                    </li>
                    <li className="ig">
                      <time>Mon 10:14</time>
                      <p><span className="tag tg-ig">Instagram</span>Asked the price of the kurta set. AI answered and moved the chat to WhatsApp.</p>
                    </li>
                    <li className="wa">
                      <time>Mon 18:40</time>
                      <p><span className="tag tg-wa">WhatsApp</span>Placed <em>order #4821</em> for ₹2,490 and paid by UPI.</p>
                    </li>
                    <li className="wa">
                      <time>Wed 09:05</time>
                      <p><span className="tag tg-wa">WhatsApp</span>Delivery update sent with an approved template.</p>
                    </li>
                    <li className="fb">
                      <time>Fri 11:30</time>
                      <p><span className="tag tg-fb">Facebook</span>Commented &quot;Loved it!&quot; on the page post. A flow sent a review link.</p>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM */}
        <section className="sec" id="platform">
          <div className="wrap row2">
            <div className="gut"><i></i>Platform<span className="badge">5</span></div>
            <div>
              <div className="sec-h">
                <h2>Everything a conversation touches, in<br /><span className="bubble">one workbench.</span></h2>
                <p className="lead">Inbox, campaigns, CRM, automation and AI read from the same customer record, so nothing is copied between tools.</p>
              </div>

              <div className="pf">
                <div className="pf-nav" role="tablist" aria-label="Platform modules">
                  <button
                    ref={(el) => { tabButtonsRef.current[0] = el }}
                    role="tab"
                    id="tab-0"
                    aria-selected={activeTab === 0}
                    aria-controls="pane-0"
                    tabIndex={activeTab === 0 ? 0 : -1}
                    onClick={() => setActiveTab(0)}
                    onKeyDown={(e) => handleTabKeyDown(e, 0)}
                  >
                    <i className="ti">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 13l3-8h12l3 8v6H3z" />
                        <path d="M3 13h5l1 3h6l1-3h5" />
                      </svg>
                    </i>
                    <div>
                      <b>Team inbox</b>
                      <span>Assign, note and reply together</span>
                    </div>
                  </button>

                  <button
                    ref={(el) => { tabButtonsRef.current[1] = el }}
                    role="tab"
                    id="tab-1"
                    aria-selected={activeTab === 1}
                    aria-controls="pane-1"
                    tabIndex={activeTab === 1 ? 0 : -1}
                    onClick={() => setActiveTab(1)}
                    onKeyDown={(e) => handleTabKeyDown(e, 1)}
                  >
                    <i className="ti">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 10v4l12 5V5L4 10z" />
                        <path d="M19 9a4 4 0 010 6" />
                      </svg>
                    </i>
                    <div>
                      <b>Broadcasts</b>
                      <span>Segmented campaigns on approved templates</span>
                    </div>
                  </button>

                  <button
                    ref={(el) => { tabButtonsRef.current[2] = el }}
                    role="tab"
                    id="tab-2"
                    aria-selected={activeTab === 2}
                    aria-controls="pane-2"
                    tabIndex={activeTab === 2 ? 0 : -1}
                    onClick={() => setActiveTab(2)}
                    onKeyDown={(e) => handleTabKeyDown(e, 2)}
                  >
                    <i className="ti">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="5" height="16" rx="1.5" />
                        <rect x="10" y="4" width="5" height="10" rx="1.5" />
                        <rect x="17" y="4" width="4" height="13" rx="1.5" />
                      </svg>
                    </i>
                    <div>
                      <b>CRM</b>
                      <span>Profiles that build themselves</span>
                    </div>
                  </button>

                  <button
                    ref={(el) => { tabButtonsRef.current[3] = el }}
                    role="tab"
                    id="tab-3"
                    aria-selected={activeTab === 3}
                    aria-controls="pane-3"
                    tabIndex={activeTab === 3 ? 0 : -1}
                    onClick={() => setActiveTab(3)}
                    onKeyDown={(e) => handleTabKeyDown(e, 3)}
                  >
                    <i className="ti">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="5.5" cy="12" r="2.5" />
                        <circle cx="18.5" cy="5.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                        <path d="M8 11l8.200-4.300M8 13l8.200 4.300" />
                      </svg>
                    </i>
                    <div>
                      <b>Flow builder</b>
                      <span>Triggers, logic and delays</span>
                    </div>
                  </button>

                  <button
                    ref={(el) => { tabButtonsRef.current[4] = el }}
                    role="tab"
                    id="tab-4"
                    aria-selected={activeTab === 4}
                    aria-controls="pane-4"
                    tabIndex={activeTab === 4 ? 0 : -1}
                    onClick={() => setActiveTab(4)}
                    onKeyDown={(e) => handleTabKeyDown(e, 4)}
                  >
                    <i className="ti">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="5" y="8" width="14" height="11" rx="3" />
                        <path d="M12 4v4M9.500 13v1.500M14.500 13v1.500" />
                      </svg>
                    </i>
                    <div>
                      <b>AI agents</b>
                      <span>Answers from your own content</span>
                    </div>
                  </button>
                </div>

                <div className="pf-pane">
                  {/* Pane 0: Inbox */}
                  <div role="tabpanel" id="pane-0" aria-labelledby="tab-0" hidden={activeTab !== 0}>
                    <span className="kick">TEAM INBOX</span>
                    <h3>A shared inbox with a clock on every chat</h3>
                    <p>See who owns what, which replies are due and what the team said privately, across all three channels.</p>
                    <div className="mock">
                      <div className="mc mrow"><div className="grow"><b>Aanya Sharma</b><small>Can I pay on delivery?</small></div><span className="pill">Rohan</span><span className="pill warn">due in 4m</span></div>
                      <div className="mc mrow"><div className="grow"><b>Rohit Kapoor</b><small>What is the combo price?</small></div><span className="pill">Unassigned</span><span className="pill warn">due in 11m</span></div>
                      <div className="mc mrow"><div className="grow"><b>Meera Joshi</b><small>Can I move my slot to Monday?</small></div><span className="pill">Priya</span><span className="pill live">on track</span></div>
                      <div className="mc mrow"><div className="grow"><b>Internal note · Priya</b><small>&quot;Offered free alteration. Please honour it.&quot;</small></div><span className="pill">private</span></div>
                    </div>
                    <div className="pf-foot">
                      <span>42 s average first reply</span>
                      <span>3 channels, 1 inbox</span>
                      <span>Private team notes</span>
                    </div>
                  </div>

                  {/* Pane 1: Broadcasts */}
                  <div role="tabpanel" id="pane-1" aria-labelledby="tab-1" hidden={activeTab !== 1}>
                    <span className="kick">BROADCASTS</span>
                    <h3>Send to the right 12,480 people, not everyone</h3>
                    <p>Filter by tag, purchase or last chat, pick an approved template and schedule it. Replies land in the inbox.</p>
                    <div className="mock cols2">
                      <div className="mc">
                        <div className="col-h">Preview</div>
                        <div className="wbub">Hi {'{{first_name}}'}, your favourite tote is back in stock. Want first pick before it goes public?<small>Template · Approved</small></div>
                      </div>
                      <div className="mc">
                        <div className="col-h">Audience and schedule</div>
                        <div className="mrow" style={{ marginBottom: 10 }}><div className="grow"><b>Tag: Diwali buyers</b><small>12,480 contacts</small></div><span className="pill">Fri 6:00 pm</span></div>
                        <div className="col-h" style={{ marginTop: 14 }}>Last campaign</div>
                        <div className="bars" aria-hidden="true"><i style={{ height: '30%' }}></i><i style={{ height: '48%' }}></i><i style={{ height: '42%' }}></i><i style={{ height: '70%' }}></i><i style={{ height: '60%' }}></i><i style={{ height: '92%' }}></i></div>
                        <div className="mrow" style={{ marginTop: 12 }}><span className="pill live">98% delivered</span><span className="pill">64% read</span></div>
                      </div>
                    </div>
                    <div className="pf-foot">
                      <span>98% delivered, 64% read</span>
                      <span>Approved templates only</span>
                      <span>Replies land in the inbox</span>
                    </div>
                  </div>

                  {/* Pane 2: CRM */}
                  <div role="tabpanel" id="pane-2" aria-labelledby="tab-2" hidden={activeTab !== 2}>
                    <span className="kick">BUILT-IN CRM</span>
                    <h3>A pipeline that fills itself in from chat</h3>
                    <p>Tags, orders and stage changes are logged from conversations. Drag a deal forward and the next flow starts.</p>
                    <div className="mock cols3">
                      <div className="mc"><div className="col-h">New</div><div className="deal">Priya Nair<small>₹12,000 · Instagram</small></div><div className="deal">Dev Patel<small>₹4,000 · WhatsApp</small></div></div>
                      <div className="mc"><div className="col-h">Negotiation</div><div className="deal">Aanya Sharma<small>₹2,490 · WhatsApp</small></div><div className="deal">Karan Shah<small>₹28,000 · Facebook</small></div></div>
                      <div className="mc"><div className="col-h">Won</div><div className="deal">Neha Rao<small>₹9,000 · WhatsApp</small></div><div className="deal">Arjun Mehta<small>₹15,500 · Instagram</small></div></div>
                    </div>
                    <div className="pf-foot">
                      <span>Logged straight from chat</span>
                      <span>Drag a deal, start a flow</span>
                      <span>Custom fields and tags</span>
                    </div>
                  </div>

                  {/* Pane 3: Flows */}
                  <div role="tabpanel" id="pane-3" aria-labelledby="tab-3" hidden={activeTab !== 3}>
                    <span className="kick">FLOW BUILDER</span>
                    <h3>Three flows running while the team sleeps</h3>
                    <p>Every flow is a plain-language rule. Switch it on, watch the runs, switch it off.</p>
                    <div className="mock">
                      <div className="mc mrow"><div className="grow"><b>Comment &quot;PRICE&quot; → pricing DM</b><small>Instagram · 1,284 runs this week</small></div><span className="pill live">Live</span></div>
                      <div className="mc mrow"><div className="grow"><b>Abandoned cart → reminder</b><small>WhatsApp · 436 runs this week</small></div><span className="pill live">Live</span></div>
                      <div className="mc mrow"><div className="grow"><b>Order shipped → tracking link</b><small>WhatsApp · 2,018 runs this week</small></div><span className="pill live">Live</span></div>
                      <div className="mc mrow"><div className="grow"><b>Review request after delivery</b><small>Facebook · Draft</small></div><span className="pill">Paused</span></div>
                    </div>
                    <div className="pf-foot">
                      <span>No-code builder</span>
                      <span>Branches, delays, retries</span>
                      <span>Every run logged</span>
                    </div>
                  </div>

                  {/* Pane 4: AI */}
                  <div role="tabpanel" id="pane-4" aria-labelledby="tab-4" hidden={activeTab !== 4}>
                    <span className="kick">AI AGENTS</span>
                    <h3>Answers that cite your own policies</h3>
                    <p>Agents read your catalogue, FAQs and shipping rules. When unsure, they hand over with the full thread.</p>
                    <div className="mock">
                      <div className="mc">
                        <div className="col-h">Customer asked</div>
                        <div className="wbub">Do you ship to Pune, and how long does it take?</div>
                      </div>
                      <div className="mc">
                        <div className="col-h">Parsona AI replied</div>
                        <div className="wbub" style={{ background: '#D4F5E3' }}>Yes. Delivery to Pune takes 2 to 3 working days, and shipping is free above ₹999.</div>
                        <div className="src">Source: Shipping policy · confidence 96%</div>
                      </div>
                      <div className="mc mrow"><div className="grow"><b>Handoff rule</b><small>Refunds, damaged items and anything below 70% confidence go to a person.</small></div><span className="pill live">On</span></div>
                    </div>
                    <div className="pf-foot">
                      <span>Cites your own policies</span>
                      <span>Hands off below 70% confidence</span>
                      <span>Replies 24 / 7</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AUTOMATION */}
        <section className="sec" id="automation">
          <div className="wrap row2">
            <div className="gut"><i></i>Automation<span className="badge">1</span></div>
            <div>
              <div className="sec-h">
                <h2>Describe it like a sentence.<br /><span className="bubble">It runs like a machine.</span></h2>
                <p className="lead">Build a flow by stacking plain-language steps. Every run is logged, so you can see exactly what happened and when.</p>
              </div>

              <div className="af">
                <div className="af-bar">
                  <div><b>Comment to qualified lead</b><small>Starts when someone comments a keyword on an Instagram post</small></div>
                  <div className="af-pills">
                    <span className="af-pill live">● Live</span>
                    <span className="af-pill">1,284 runs this week</span>
                    <span className="af-pill">Edited 2 days ago</span>
                  </div>
                </div>
                <div className="af-scroll">
                  <svg viewBox="0 0 1160 400" role="img" aria-label="Automation flow: Instagram comment triggers a pricing DM, AI asks for budget, then a condition splits hot leads to Sales and others to a delayed offer template">
                    <path className="base" d="M214 150H254" />
                    <path className="pulse" pathLength={100} d="M214 150H254" style={{ stroke: '#FF8A5B', strokeDasharray: '30 70', animationDelay: '0s' }} />
                    <path className="base" d="M444 150H484" />
                    <path className="pulse" pathLength={100} d="M444 150H484" style={{ stroke: '#1FD27A', strokeDasharray: '30 70', animationDelay: '.5s' }} />
                    <path className="base" d="M674 150H714" />
                    <path className="pulse" pathLength={100} d="M674 150H714" style={{ stroke: '#8FBBFF', strokeDasharray: '30 70', animationDelay: '1s' }} />
                    <path className="base" d="M904 150H924V66H944" />
                    <path className="pulse" pathLength={100} d="M904 150H924V66H944" style={{ stroke: '#B9A6FF', strokeDasharray: '14 86', animationDelay: '1.5s' }} />
                    <path className="base" d="M904 150H924V232H944" />
                    <path className="pulse" pathLength={100} d="M904 150H924V232H944" style={{ stroke: '#B9A6FF', strokeDasharray: '14 86', animationDelay: '1.5s' }} />
                    <path className="base" d="M1039 274V294" />
                    <path className="pulse" pathLength={100} d="M1039 274V294" style={{ stroke: '#FFD97A', strokeDasharray: '40 60', animationDelay: '2.4s' }} />

                    <g transform="translate(24 108)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#FF8A5B" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="59" height="18" rx="6" fill="#FF8A5B" />
                      <text className="an-c" x="21" y="24.5">TRIGGER</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">1,284</text>
                      <text className="an-t" x="14" y="52">Comment has “PRICE”</text>
                      <text className="an-d" x="14" y="70">Instagram · any post</text>
                    </g>
                    <g transform="translate(254 108)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#1FD27A" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="52" height="18" rx="6" fill="#1FD27A" />
                      <text className="an-c" x="21" y="24.5">ACTION</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">1,241</text>
                      <text className="an-t" x="14" y="52">Send pricing card</text>
                      <text className="an-d" x="14" y="70">DM · sent in 1.2 s</text>
                    </g>
                    <g transform="translate(484 108)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#8FBBFF" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="27" height="18" rx="6" fill="#8FBBFF" />
                      <text className="an-c" x="21" y="24.5">AI</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">1,102</text>
                      <text className="an-t" x="14" y="52">Ask for budget</text>
                      <text className="an-d" x="14" y="70">AI parses “around 15k”</text>
                    </g>
                    <g transform="translate(714 108)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#B9A6FF" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="72" height="18" rx="6" fill="#B9A6FF" />
                      <text className="an-c" x="21" y="24.5">CONDITION</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">964</text>
                      <text className="an-t" x="14" y="52">Budget over ₹10,000?</text>
                      <text className="an-d" x="14" y="70">Parsed budget: ₹15,000</text>
                    </g>
                    <g transform="translate(944 24)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#1FD27A" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="52" height="18" rx="6" fill="#1FD27A" />
                      <text className="an-c" x="21" y="24.5">ACTION</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">612</text>
                      <text className="an-t" x="14" y="52">Tag as Hot lead</text>
                      <text className="an-d" x="14" y="70">Sales team · alert Rohan</text>
                    </g>
                    <g transform="translate(944 190)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#FFD97A" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="40" height="18" rx="6" fill="#FFD97A" />
                      <text className="an-c" x="21" y="24.5">WAIT</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">352</text>
                      <text className="an-t" x="14" y="52">Wait 1 day</text>
                      <text className="an-d" x="14" y="70">Then continue the flow</text>
                    </g>
                    <g transform="translate(944 294)">
                      <rect x="4" y="5" width="190" height="84" rx="14" fill="#1FD27A" opacity=".45" />
                      <rect width="190" height="84" rx="14" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                      <rect x="14" y="12" width="52" height="18" rx="6" fill="#1FD27A" />
                      <text className="an-c" x="21" y="24.5">ACTION</text>
                      <text className="an-r" x="176" y="25" textAnchor="end">340</text>
                      <text className="an-t" x="14" y="52">Send offer template</text>
                      <text className="an-d" x="14" y="70">WhatsApp · approved</text>
                    </g>

                    <rect x="906" y="99" width="36" height="18" rx="9" fill="#D4F5E3" stroke="#AEE8C9" />
                    <text className="an-c" x="924" y="111.5" textAnchor="middle">YES</text>
                    <rect x="906" y="183" width="36" height="18" rx="9" fill="#FFE1D6" stroke="#F2B79C" />
                    <text className="an-c" x="924" y="195.5" textAnchor="middle">NO</text>

                    <circle cx="24" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="214" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="254" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="444" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="484" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="674" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="714" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="904" cy="150" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="944" cy="66" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="944" cy="232" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="1039" cy="274" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                    <circle cx="1039" cy="294" r="5" fill="#fff" stroke="#0E1512" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              <div className="af-grid">
                <div className="af-log">
                  <h4><span>Run log</span><span>Today</span></h4>
                  <p><time>19:41:02</time><span>Comment matched “PRICE” <em>ok</em></span></p>
                  <p><time>19:41:03</time><span>DM sent to @rohit.k <em>ok</em></span></p>
                  <p><time>19:41:44</time><span>Customer replied: “around 15k”</span></p>
                  <p><time>19:41:45</time><span>AI parsed budget = ₹15,000 <em>ok</em></span></p>
                  <p><time>19:41:45</time><span>Condition met: over ₹10,000</span></p>
                  <p><time>19:41:46</time><span>Tagged Hot lead, assigned to Rohan <em>ok</em></span></p>
                </div>

                <div className="af-side">
                  <div className="af-stats">
                    <div className="af-stat"><b>96%</b><small>runs completed</small></div>
                    <div className="af-stat"><b>1.2 s</b><small>avg first response</small></div>
                    <div className="af-stat"><b>0</b><small>retries needed today</small></div>
                  </div>
                  <div className="af-trg">
                    <h4>Start a flow from</h4>
                    <div className="chips">
                      <span className="chip">Comment keyword</span>
                      <span className="chip">Story reply</span>
                      <span className="chip">New follower</span>
                      <span className="chip">Order placed</span>
                      <span className="chip">Cart abandoned</span>
                      <span className="chip">Tag added</span>
                      <span className="chip">Schedule</span>
                    </div>
                    <h4 style={{ marginTop: 18 }}>Then do</h4>
                    <div className="chips">
                      <span className="chip">Send DM</span>
                      <span className="chip">Send template</span>
                      <span className="chip">Ask AI</span>
                      <span className="chip">Tag</span>
                      <span className="chip">Assign</span>
                      <span className="chip">Wait</span>
                      <span className="chip">Webhook</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section className="sec" id="usecases">
          <div className="wrap row2">
            <div className="gut"><i></i>Use cases<span className="badge">3</span></div>
            <div>
              <div className="sec-h">
                <h2>Whatever you sell,<br /><span className="bubble">chat is the shop.</span></h2>
                <p className="lead">Parsona fits how real businesses already talk to customers.</p>
              </div>

              <div className="uc">
                <article>
                  <div className="ph">
                    <div>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="3" />
                        <circle cx="9" cy="10" r="2" />
                        <path d="M21 16l-5-5-8 9" />
                      </svg>
                      IMAGE 4:3<br />Boutique owner packing orders
                    </div>
                  </div>
                  <h3>D2C and retail</h3>
                  <p>Catalogue on WhatsApp, cart recovery, COD confirmations and shipping updates.</p>
                  <div className="chips">
                    <span className="chip">Cart recovery</span>
                    <span className="chip">Order updates</span>
                  </div>
                </article>

                <article>
                  <div className="ph">
                    <div>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="3" />
                        <circle cx="9" cy="10" r="2" />
                        <path d="M21 16l-5-5-8 9" />
                      </svg>
                      IMAGE 4:3<br />Clinic reception with tablet
                    </div>
                  </div>
                  <h3>Clinics and services</h3>
                  <p>Bookings, reschedules and reminders on autopilot, with a human one tap away.</p>
                  <div className="chips">
                    <span className="chip">Appointments</span>
                    <span className="chip">Reminders</span>
                  </div>
                </article>

                <article>
                  <div className="ph">
                    <div>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="3" />
                        <circle cx="9" cy="10" r="2" />
                        <path d="M21 16l-5-5-8 9" />
                      </svg>
                      IMAGE 4:3<br />Agency team at a shared screen
                    </div>
                  </div>
                  <h3>Agencies</h3>
                  <p>Run many brands from one login with separate numbers, roles and reports.</p>
                  <div className="chips">
                    <span className="chip">Multi-brand</span>
                    <span className="chip">Roles</span>
                  </div>
                </article>
              </div>

              <div className="vid">
                <div className="ph">
                  <div>
                    <span className="play">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#0E1512" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                    VIDEO 16:9<br />90-second product walkthrough
                  </div>
                </div>
                <div>
                  <h3>See it in 90 seconds.</h3>
                  <p>From first Instagram comment to a paid WhatsApp order, no tab switching.</p>
                  <a href="#pricing" className="btn btn-g">Start free trial</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RELIABILITY */}
        <section className="sec" id="reliability">
          <div className="wrap row2">
            <div className="gut"><i></i>Reliability</div>
            <div>
              <div className="sec-h">
                <h2>Built to stay up when<br /><span className="bubble">sales are on.</span></h2>
              </div>
              <div className="rel">
                <div className="rel-h">
                  <b><span className="dot"></span>All systems operational</b>
                  <span>Last 60 days · message delivery</span>
                </div>
                <div className="up" id="up" aria-hidden="true">
                  {Array.from({ length: 60 }).map((_, d) => (
                    <i key={d} className={d === 17 || d === 44 ? 'd' : undefined} />
                  ))}
                </div>
                <div className="up-l">
                  <span>60 days ago</span>
                  <span>Today</span>
                </div>
                <div className="figs">
                  <div><b>12,000+</b><span>Businesses on Parsona</span></div>
                  <div><b>50M+</b><span>Messages every month</span></div>
                  <div><b>99.95%</b><span>Uptime over the last year</span></div>
                  <div><b>40+</b><span>Countries served</span></div>
                </div>
                <p className="secure">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B3B2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3l8 3v6c0 4.5-3.400 8.200-8 9-4.600-.8-8-4.500-8-9V6z" />
                  </svg>
                  Encryption in transit and at rest, role-based access and audit logs on every plan.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CUSTOMERS */}
        <section className="sec" id="customers">
          <div className="wrap row2">
            <div className="gut"><i></i>Customers<span className="badge">4</span></div>
            <div>
              <div className="sec-h">
                <h2>New messages from<br /><span className="bubble">happy teams.</span></h2>
              </div>
              <div className="voices">
                <div className="big">
                  <q>We moved support out of three apps. First reply time went from hours to minutes in the first week.</q>
                  <div className="who">
                    <div className="av">NP</div>
                    <div>
                      <b>Nisha Patel</b>
                      <small>Head of CX, Kindred · via WhatsApp</small>
                    </div>
                  </div>
                </div>
                <div className="small-col">
                  <div className="vb">
                    <p>The comment-to-DM flow paid for the subscription by itself. Instagram leads roughly tripled.</p>
                    <div className="who">
                      <div className="av">VS</div>
                      <div>
                        <b>Vikram Singh</b>
                        <small>Founder, Lumen</small>
                      </div>
                    </div>
                  </div>
                  <div className="vb">
                    <p>Our marketing team builds automations without asking engineering. The rule sentences just make sense.</p>
                    <div className="who">
                      <div className="av">TA</div>
                      <div>
                        <b>Tara Ahmed</b>
                        <small>Growth lead, Orbitly</small>
                      </div>
                    </div>
                  </div>
                  <div className="vb">
                    <p>Finally a CRM that fills itself in. Every chat becomes a clean contact record with no typing.</p>
                    <div className="who">
                      <div className="av">DJ</div>
                      <div>
                        <b>Dev Joshi</b>
                        <small>Sales director, Haveli</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="sec" id="pricing">
          <div className="wrap row2">
            <div className="gut"><i></i>Pricing<span className="badge">3</span></div>
            <div>
              <div className="sec-h">
                <h2>Pick a plan.<br /><span className="bubble">Change it any time.</span></h2>
                <p className="lead">Every plan starts with a 14-day free trial, so you can connect a number and test real conversations first.</p>
              </div>

              <div className="seg" role="group" aria-label="Billing period">
                <button
                  id="b-m"
                  aria-pressed={!isYearly}
                  onClick={() => setIsYearly(false)}
                >
                  Monthly
                </button>
                <button
                  id="b-y"
                  aria-pressed={isYearly}
                  onClick={() => setIsYearly(true)}
                >
                  Yearly<em>save 20%</em>
                </button>
              </div>

              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col"><span className="mono" style={{ fontSize: 12, color: 'var(--mute)' }}>PRICES IN INR</span></th>
                      <th scope="col">
                        <b>Starter</b>
                        <small>Solo founders and small shops</small>
                        <div className="pr">
                          <span className="p" data-m="1499" data-y="1199">
                            {isYearly ? '₹1,199' : '₹1,499'}
                          </span>
                          <small>/ month</small>
                        </div>
                        <a href="#waitlist" className="btn btn-o btn-sm">Start free trial</a>
                      </th>
                      <th scope="col" className="hot">
                        <span className="flag">Most popular</span>
                        <b>Growth</b>
                        <small>Teams that are scaling</small>
                        <div className="pr">
                          <span className="p" data-m="4999" data-y="3999">
                            {isYearly ? '₹3,999' : '₹4,999'}
                          </span>
                          <small>/ month</small>
                        </div>
                        <a href="#waitlist" className="btn btn-k btn-sm">Start free trial</a>
                      </th>
                      <th scope="col">
                        <b>Scale</b>
                        <small>Agencies and enterprises</small>
                        <div className="pr">Custom</div>
                        <a href="#waitlist" className="btn btn-o btn-sm">Talk to sales</a>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">WhatsApp numbers</th>
                      <td>1</td>
                      <td className="hot">3</td>
                      <td>Unlimited</td>
                    </tr>
                    <tr>
                      <th scope="row">Instagram and Facebook</th>
                      <td className="no">Not included</td>
                      <td className="hot yes">Included</td>
                      <td className="yes">Included</td>
                    </tr>
                    <tr>
                      <th scope="row">Team members</th>
                      <td>3</td>
                      <td className="hot">10</td>
                      <td>Unlimited</td>
                    </tr>
                    <tr>
                      <th scope="row">Contacts</th>
                      <td>2,000</td>
                      <td className="hot">25,000</td>
                      <td>Unlimited</td>
                    </tr>
                    <tr>
                      <th scope="row">Flow builder</th>
                      <td>Basic rules</td>
                      <td className="hot">Full builder</td>
                      <td>Full builder and API</td>
                    </tr>
                    <tr>
                      <th scope="row">Broadcast campaigns</th>
                      <td className="no">Not included</td>
                      <td className="hot yes">Included</td>
                      <td className="yes">Included</td>
                    </tr>
                    <tr>
                      <th scope="row">Built-in CRM</th>
                      <td>Contacts and tags</td>
                      <td className="hot">Pipeline</td>
                      <td>Pipeline and custom objects</td>
                    </tr>
                    <tr>
                      <th scope="row">AI agent replies</th>
                      <td className="no">Not included</td>
                      <td className="hot">5,000 / month</td>
                      <td>Custom volume</td>
                    </tr>
                    <tr>
                      <th scope="row">Support</th>
                      <td>Email</td>
                      <td className="hot">Live chat</td>
                      <td>Dedicated manager and SLA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec" id="faq">
          <div className="wrap row2">
            <div className="gut"><i></i>Questions<span className="badge">4</span></div>
            <div>
              <div className="sec-h" style={{ marginBottom: 40 }}>
                <h2>Before you<br /><span className="bubble">send the first message.</span></h2>
              </div>
              <div className="faq">
                <details>
                  <summary>Do I need the official WhatsApp Business API?</summary>
                  <p>Yes, and Parsona guides you through it: connect your number, verify your business and get message templates approved. Most teams are sending within a day.</p>
                </details>
                <details>
                  <summary>Can I review AI replies before they go out?</summary>
                  <p>You choose per channel: suggestions only, auto-reply on selected topics, or full auto-reply. A person can take over any chat with one click.</p>
                </details>
                <details>
                  <summary>Can I bring in my existing contacts?</summary>
                  <p>Upload a CSV or sync from your store. Custom fields and tags are mapped for you, and duplicates are merged into a single timeline.</p>
                </details>
                <details>
                  <summary>How is customer data protected?</summary>
                  <p>Data is encrypted in transit and at rest. Role-based access and audit logs come with every plan, and regional hosting is available on Scale.</p>
                </details>
              </div>
            </div>
          </div>
        </section>

        {/* WAITLIST */}
        <section className="sec" id="waitlist">
          <div className="wrap row2">
            <div className="gut"><i></i>Waitlist</div>
            <div>
              <div className="sec-h">
                <h2>Get early access.<br /><span className="bubble">Join the waitlist.</span></h2>
                <p className="lead">Leave your details and we will email you as soon as your invite is ready.</p>
              </div>
              <div className="wl">
                {!wlSubmitted ? (
                  <form id="wl-form" noValidate onSubmit={handleWaitlistSubmit}>
                    <div className="f">
                      <label htmlFor="wl-name">Full name</label>
                      <input
                        id="wl-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Aanya Sharma"
                        required
                        value={wlName}
                        onChange={(e) => {
                          setWlName(e.target.value)
                          if (wlErrors.name) setWlErrors(prev => ({ ...prev, name: undefined }))
                        }}
                        aria-invalid={!!wlErrors.name}
                      />
                      <div className="err" id="wl-name-e" aria-live="polite">
                        {wlErrors.name}
                      </div>
                    </div>

                    <div className="two">
                      <div className="f">
                        <label htmlFor="wl-email">Email</label>
                        <input
                          id="wl-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          required
                          value={wlEmail}
                          onChange={(e) => {
                            setWlEmail(e.target.value)
                            if (wlErrors.email) setWlErrors(prev => ({ ...prev, email: undefined }))
                          }}
                          aria-invalid={!!wlErrors.email}
                        />
                        <div className="err" id="wl-email-e" aria-live="polite">
                          {wlErrors.email}
                        </div>
                      </div>

                      <div className="f">
                        <label htmlFor="wl-phone">WhatsApp number</label>
                        <input
                          id="wl-phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+91 98765 43210"
                          required
                          value={wlPhone}
                          onChange={(e) => {
                            setWlPhone(e.target.value)
                            if (wlErrors.phone) setWlErrors(prev => ({ ...prev, phone: undefined }))
                          }}
                          aria-invalid={!!wlErrors.phone}
                        />
                        <div className="err" id="wl-phone-e" aria-live="polite">
                          {wlErrors.phone}
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-k">Join waitlist</button>
                    <p className="note">No spam. Only your invite and product news.</p>
                  </form>
                ) : (
                  <div className="wl-ok" id="wl-ok">
                    <div className="tick">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </div>
                    <h3>You’re on the list, <span id="wl-first">{wlFirstName}</span>.</h3>
                    <p>We will email you when your invite is ready.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="sec">
          <div className="wrap">
            <div className="cta2">
              <div>
                <div className="logos3">
                  <span className="lg3">
                    <svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true">
                      <circle cx="24" cy="24" r="24" fill="#25D366" />
                      <path d="M24 11a13 13 0 00-11.200 19.600L11.500 36l5.600-1.500A13 13 0 1024 11z" fill="none" stroke="#fff" strokeWidth="3" />
                    </svg>
                  </span>
                  <span className="lg3">
                    <svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true">
                      <rect width="48" height="48" rx="13" fill="url(#igg)" />
                      <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
                      <circle cx="24" cy="24" r="6.500" fill="none" stroke="#fff" strokeWidth="3" />
                    </svg>
                  </span>
                  <span className="lg3">
                    <svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true">
                      <circle cx="24" cy="24" r="24" fill="#1877F2" />
                      <path clipPath="url(#fbc)" d="M26.700 48V30h6l.9-7h-6.900v-4.500c0-2 .6-3.400 3.500-3.400H34V9c-.6-.1-2.800-.3-5.300-.3-5.300 0-8.800 3.200-8.800 9V23h-6v7h6v18z" fill="#fff" />
                    </svg>
                  </span>
                  <span className="lg3 more">+ AI, CRM, flows</span>
                </div>
                <h2>Start with one number.<br /><span className="bubble">Grow to every channel.</span></h2>
                <p className="lead">Connect WhatsApp in about 10 minutes, then add Instagram and Facebook when you are ready. Your first automation can be live today.</p>
                <div className="row">
                  <a href="#pricing" className="btn btn-k">Start 14-day free trial</a>
                  <a href="#waitlist" className="btn btn-o">Join waitlist</a>
                </div>
                <div className="assure">
                  <span>No credit card</span>
                  <span>Cancel any time</span>
                  <span>Official WhatsApp API</span>
                </div>
              </div>
              <div className="steps">
                <h4>What happens next</h4>
                <ul>
                  <li style={{ ['--c' as any]: '#1FD27A' }}>
                    <span className="n">1</span>
                    <div><b>Connect your number</b><small>We guide you through the official setup.</small></div>
                    <em className="t">10 min</em>
                  </li>
                  <li style={{ ['--c' as any]: '#B9A6FF' }}>
                    <span className="n">2</span>
                    <div><b>Import your contacts</b><small>CSV upload or store sync, duplicates merged.</small></div>
                    <em className="t">5 min</em>
                  </li>
                  <li style={{ ['--c' as any]: '#FF9E7A' }}>
                    <span className="n">3</span>
                    <div><b>Switch on your first flow</b><small>Start from a ready-made template.</small></div>
                    <em className="t">Today</em>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="fg">
            <div>
              <a href="#top" className="logo">
                <span className="mark">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1512" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 21V4h6.5a4.5 4.5 0 010 9H7" />
                  </svg>
                </span>
                Parsona
              </a>
              <p>Business conversations on WhatsApp, Instagram and Facebook, with inbox, CRM, campaigns and AI in one place.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#platform">Team inbox</a></li>
                <li><a href="#platform">Broadcasts</a></li>
                <li><a href="#platform">CRM</a></li>
                <li><a href="#automation">Flow builder</a></li>
                <li><a href="#platform">AI agents</a></li>
              </ul>
            </div>
            <div>
              <h4>Channels</h4>
              <ul>
                <li><a href="#channels">WhatsApp</a></li>
                <li><a href="#channels">Instagram</a></li>
                <li><a href="#channels">Facebook</a></li>
              </ul>
            </div>
            <div>
              <h4>Resources</h4>
              <ul>
                <li><a href="#">Help centre</a></li>
                <li><a href="#">API docs</a></li>
                <li><a href="#">Templates</a></li>
                <li><a href="#">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="fbot">
            <span>© 2026 Parsona. All rights reserved.</span>
            <span>WhatsApp, Instagram and Facebook are trademarks of their respective owners.</span>
          </div>
        </div>
        <div className="mega" aria-hidden="true">Parsona</div>
      </footer>
    </div>
  )
}
