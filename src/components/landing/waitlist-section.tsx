'use client'

import React, { useState } from 'react'
import { BTN_DARK, DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { FadeUp, TextReveal } from './motion'

export function WaitlistSection() {
  const [wlName, setWlName] = useState('')
  const [wlEmail, setWlEmail] = useState('')
  const [wlPhone, setWlPhone] = useState('')
  const [wlErrors, setWlErrors] = useState<{ name?: string; email?: string; phone?: string }>({})
  const [wlSubmitted, setWlSubmitted] = useState(false)
  const [wlFirstName, setWlFirstName] = useState('')

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
    const phoneValid =
      /^[+\d][\d\s().-]*$/.test(wlPhone.trim()) &&
      phoneDigits.length >= 7 &&
      phoneDigits.length <= 15
    if (!phoneValid) {
      errors.phone = 'Enter a valid number, e.g. +91 98765 43210.'
    }

    setWlErrors(errors)

    if (Object.keys(errors).length === 0) {
      setWlFirstName(nameTrimmed.split(/\s+/)[0])
      setWlSubmitted(true)
    }
  }

  const inputBase =
    'w-full h-[52px] border-[1.5px] rounded-[12px] px-4 font-medium text-[16px] bg-[#F8FAF7] text-[#0E1512] focus:outline-[3px] focus:outline-[#1B6A55] focus:outline-offset-[2px] focus:bg-white'

  return (
    <section id="waitlist" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Waitlist" bgClass="bg-[#FFE1D6]" dotClass="bg-[#FF8A5B]" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(30px,3.7vw,46px)] font-bold tracking-[-0.035em] leading-[1.1] text-balance`}
            >
              <TextReveal text="Get early access." />
              <br />
              <HighlightBubble bgClass="bg-[#FFB99A]" delay={0.18}>
                Join the waitlist.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.16} distance={14}>
              <p className="mt-5 text-[19px] text-[#52625A] max-w-[560px] mx-auto">
                Leave your details and we will email you as soon as your invite is ready.
              </p>
            </FadeUp>
          </div>

          <FadeUp delay={0.14} distance={24}>
            <div className="mt-12 mx-auto max-w-[640px] bg-white border-[1.5px] border-[#0E1512] rounded-[24px] p-8 max-[720px]:px-5 max-[720px]:py-6 shadow-[8px_8px_0_#1FD27A] max-[720px]:shadow-[5px_5px_0_#1FD27A]">
            {!wlSubmitted ? (
              <form id="wl-form" noValidate onSubmit={handleWaitlistSubmit}>
                <div className="mb-[18px]">
                  <label
                    htmlFor="wl-name"
                    className={`block ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}
                  >
                    Full name
                  </label>
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
                      if (wlErrors.name) setWlErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    aria-invalid={!!wlErrors.name}
                    className={`${inputBase} ${wlErrors.name ? 'border-[#D92D20]' : 'border-[#0E1512]'}`}
                  />
                  <div
                    id="wl-name-e"
                    aria-live="polite"
                    className={`text-[#D92D20] ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
                  >
                    {wlErrors.name}
                  </div>
                </div>

                <div className="grid grid-cols-2 max-[720px]:grid-cols-1 gap-4 max-[720px]:gap-0">
                  <div className="mb-[18px]">
                    <label
                      htmlFor="wl-email"
                      className={`block ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}
                    >
                      Email
                    </label>
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
                        if (wlErrors.email) setWlErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      aria-invalid={!!wlErrors.email}
                      className={`${inputBase} ${wlErrors.email ? 'border-[#D92D20]' : 'border-[#0E1512]'}`}
                    />
                    <div
                      id="wl-email-e"
                      aria-live="polite"
                      className={`text-[#D92D20] ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
                    >
                      {wlErrors.email}
                    </div>
                  </div>

                  <div className="mb-[18px]">
                    <label
                      htmlFor="wl-phone"
                      className={`block ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[#52625A] mb-2`}
                    >
                      WhatsApp number
                    </label>
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
                        if (wlErrors.phone) setWlErrors((prev) => ({ ...prev, phone: undefined }))
                      }}
                      aria-invalid={!!wlErrors.phone}
                      className={`${inputBase} ${wlErrors.phone ? 'border-[#D92D20]' : 'border-[#0E1512]'}`}
                    />
                    <div
                      id="wl-phone-e"
                      aria-live="polite"
                      className={`text-[#D92D20] ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
                    >
                      {wlErrors.phone}
                    </div>
                  </div>
                </div>

                <button type="submit" className={`${BTN_DARK} w-full !h-[54px] !text-[16px] cursor-pointer`}>
                  Join waitlist
                </button>
                <p className={`${MONO_FONT} text-[12.5px] text-[#52625A] text-center mt-[14px]`}>
                  No spam. Only your invite and product news.
                </p>
              </form>
            ) : (
              <div id="wl-ok" className="text-center py-5">
                <div className="w-16 h-16 rounded-full bg-[#1FD27A] grid place-items-center mx-auto mb-[18px] border-[1.5px] border-[#0E1512]">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0E1512"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <h3 className={`${DISPLAY_FONT} text-[30px] font-bold tracking-[-0.035em] leading-[1.02]`}>
                  You’re on the list, <span id="wl-first">{wlFirstName}</span>.
                </h3>
                <p className="text-[#52625A] mt-[10px]">
                  We will email you when your invite is ready.
                </p>
              </div>
            )}
          </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

