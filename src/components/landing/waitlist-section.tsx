'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BTN_DARK, DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { EASE, FadeUp, TextReveal } from './motion'

export function WaitlistSection() {
  const [wlName, setWlName] = useState('')
  const [wlEmail, setWlEmail] = useState('')
  const [wlPhone, setWlPhone] = useState('')
  const [wlWebsite, setWlWebsite] = useState('') // honeypot
  const [wlErrors, setWlErrors] = useState<{
    name?: string
    email?: string
    phone?: string
    form?: string
  }>({})
  const [wlSubmitting, setWlSubmitting] = useState(false)
  const [wlSubmitted, setWlSubmitted] = useState(false)
  const [wlFirstName, setWlFirstName] = useState('')

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (wlSubmitting) return

    const errors: { name?: string; email?: string; phone?: string; form?: string } = {}

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
    if (Object.keys(errors).length > 0) return

    setWlSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameTrimmed,
          email: wlEmail.trim(),
          phone: wlPhone.trim(),
          website: wlWebsite,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        field?: 'name' | 'email' | 'phone'
        error?: string
      }

      if (!res.ok || !data.ok) {
        if (data.field) {
          setWlErrors({ [data.field]: data.error || 'Please check this field.' })
        } else {
          setWlErrors({
            form: data.error || 'Something went wrong saving your spot. Please try again.',
          })
        }
        return
      }

      setWlFirstName(nameTrimmed.split(/\s+/)[0])
      setWlSubmitted(true)
    } catch {
      setWlErrors({
        form: 'Unable to reach the server. Please check your connection and try again.',
      })
    } finally {
      setWlSubmitting(false)
    }
  }

  const inputBase =
    'w-full h-[52px] border-[1.5px] rounded-[12px] px-4 font-medium text-[16px] bg-[#F8FAF7] text-[#0E1512] focus:outline-[3px] focus:outline-[#1B6A55] focus:outline-offset-[2px] focus:bg-white disabled:opacity-60'

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
                  {/* Hidden honeypot field to filter automated bots */}
                  <input
                    type="text"
                    name="website"
                    value={wlWebsite}
                    onChange={(e) => setWlWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />

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
                      disabled={wlSubmitting}
                      value={wlName}
                      onChange={(e) => {
                        setWlName(e.target.value)
                        if (wlErrors.name || wlErrors.form) {
                          setWlErrors((prev) => ({ ...prev, name: undefined, form: undefined }))
                        }
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
                        disabled={wlSubmitting}
                        value={wlEmail}
                        onChange={(e) => {
                          setWlEmail(e.target.value)
                          if (wlErrors.email || wlErrors.form) {
                            setWlErrors((prev) => ({ ...prev, email: undefined, form: undefined }))
                          }
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
                        disabled={wlSubmitting}
                        value={wlPhone}
                        onChange={(e) => {
                          setWlPhone(e.target.value)
                          if (wlErrors.phone || wlErrors.form) {
                            setWlErrors((prev) => ({ ...prev, phone: undefined, form: undefined }))
                          }
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

                  {wlErrors.form && (
                    <div
                      role="alert"
                      className={`mb-4 rounded-[12px] border border-[#D92D20]/40 bg-[#FEF3F2] px-4 py-3 text-[13.5px] text-[#B42318]`}
                    >
                      {wlErrors.form}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={wlSubmitting}
                    className={`${BTN_DARK} w-full !h-[54px] !text-[16px] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed`}
                  >
                    {wlSubmitting ? (
                      <>
                        <span
                          className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                          aria-hidden="true"
                        />
                        <span>Saving your spot…</span>
                      </>
                    ) : (
                      'Join waitlist'
                    )}
                  </button>
                  <p
                    className={`${MONO_FONT} text-[12px] text-[#52625A] text-center mt-[14px] leading-[1.6]`}
                  >
                    No spam. Only your invite and product updates. By joining, you agree to our{' '}
                    <Link href="/terms" className="underline text-[#0B3B2E] hover:text-[#11503F]">
                      Terms
                    </Link>
                    ,{' '}
                    <Link href="/privacy" className="underline text-[#0B3B2E] hover:text-[#11503F]">
                      Privacy Policy
                    </Link>{' '}
                    &amp;{' '}
                    <Link
                      href="/data-policy"
                      className="underline text-[#0B3B2E] hover:text-[#11503F]"
                    >
                      Data Policy
                    </Link>
                    .
                  </p>
                </form>
              ) : (
                <motion.div
                  id="wl-ok"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: EASE }}
                  className="text-center py-5"
                >
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
                  <h3
                    className={`${DISPLAY_FONT} text-[30px] font-bold tracking-[-0.035em] leading-[1.02]`}
                  >
                    You’re on the list, <span id="wl-first">{wlFirstName}</span>.
                  </h3>
                  <p className="text-[#52625A] mt-[10px]">
                    We’ve saved your spot and will email you when your invite is ready.
                  </p>
                </motion.div>
              )}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
