'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { validateWaitlistInput } from '@/lib/waitlist-validation'
import { BTN_DARK, DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill } from './shared'
import { EASE, FadeUp, TextReveal } from './motion'

const LOCAL_STORAGE_KEY = 'parsona_waitlist_entries_v1'

interface StoredWaitlistEntry {
  email: string
  phoneKey: string
}

function readLocalEntries(): StoredWaitlistEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredWaitlistEntry[]) : []
  } catch {
    return []
  }
}

function saveLocalEntry(entry: StoredWaitlistEntry) {
  if (typeof window === 'undefined') return
  try {
    const existing = readLocalEntries()
    const next = [...existing.slice(-19), entry]
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

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
    duplicate?: boolean
  }>({})
  const [wlSubmitting, setWlSubmitting] = useState(false)
  const [wlSubmitted, setWlSubmitted] = useState(false)
  const [wlFirstName, setWlFirstName] = useState('')

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (wlSubmitting) return

    const { valid, errors, normalized } = validateWaitlistInput({
      name: wlName,
      email: wlEmail,
      phone: wlPhone,
    })

    if (!valid) {
      setWlErrors(errors)
      return
    }

    // Quick client-side duplicate check for repeat submissions from the same browser
    const localEntries = readLocalEntries()
    const emailDupLocal = localEntries.some((item) => item.email === normalized.email)
    const phoneDupLocal = localEntries.some((item) => item.phoneKey === normalized.phoneKey)
    if (emailDupLocal || phoneDupLocal) {
      setWlErrors({
        email: emailDupLocal ? 'This email is already on the waitlist.' : undefined,
        phone: phoneDupLocal ? 'This WhatsApp number is already on the waitlist.' : undefined,
        duplicate: true,
        form:
          emailDupLocal && phoneDupLocal
            ? 'You are already on the waitlist with this email and WhatsApp number.'
            : emailDupLocal
              ? 'This email address is already registered on the waitlist.'
              : 'This WhatsApp number is already registered on the waitlist.',
      })
      return
    }

    setWlErrors({})
    setWlSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalized.name,
          email: normalized.email,
          phone: normalized.phone,
          website: wlWebsite,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        duplicate?: boolean
        field?: 'name' | 'email' | 'phone' | 'both'
        errors?: { name?: string; email?: string; phone?: string }
        error?: string
      }

      if (!res.ok || !data.ok) {
        if (res.status === 409 || data.duplicate) {
          const dupMsg = data.error || 'You are already registered on the waitlist.'
          setWlErrors({
            email:
              data.field === 'email' || data.field === 'both'
                ? 'This email is already on the waitlist.'
                : undefined,
            phone:
              data.field === 'phone' || data.field === 'both'
                ? 'This WhatsApp number is already on the waitlist.'
                : undefined,
            duplicate: true,
            form: dupMsg,
          })
          return
        }

        if (data.errors && Object.keys(data.errors).length > 0) {
          setWlErrors(data.errors)
        } else if (data.field && data.field !== 'both') {
          setWlErrors({ [data.field]: data.error || 'Please check this field.' })
        } else {
          setWlErrors({
            form: data.error || 'Something went wrong saving your spot. Please try again.',
          })
        }
        return
      }

      saveLocalEntry({ email: normalized.email, phoneKey: normalized.phoneKey })
      setWlFirstName(normalized.name.split(/\s+/)[0])
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
                          setWlErrors((prev) => ({
                            ...prev,
                            name: undefined,
                            form: undefined,
                            duplicate: false,
                          }))
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
                            setWlErrors((prev) => ({
                              ...prev,
                              email: undefined,
                              form: undefined,
                              duplicate: false,
                            }))
                          }
                        }}
                        aria-invalid={!!wlErrors.email}
                        className={`${inputBase} ${
                          wlErrors.email
                            ? wlErrors.duplicate
                              ? 'border-[#D97706]'
                              : 'border-[#D92D20]'
                            : 'border-[#0E1512]'
                        }`}
                      />
                      <div
                        id="wl-email-e"
                        aria-live="polite"
                        className={`${wlErrors.duplicate ? 'text-[#B45309]' : 'text-[#D92D20]'} ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
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
                            setWlErrors((prev) => ({
                              ...prev,
                              phone: undefined,
                              form: undefined,
                              duplicate: false,
                            }))
                          }
                        }}
                        aria-invalid={!!wlErrors.phone}
                        className={`${inputBase} ${
                          wlErrors.phone
                            ? wlErrors.duplicate
                              ? 'border-[#D97706]'
                              : 'border-[#D92D20]'
                            : 'border-[#0E1512]'
                        }`}
                      />
                      <div
                        id="wl-phone-e"
                        aria-live="polite"
                        className={`${wlErrors.duplicate ? 'text-[#B45309]' : 'text-[#D92D20]'} ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
                      >
                        {wlErrors.phone}
                      </div>
                    </div>
                  </div>

                  {wlErrors.form && (
                    <div
                      role="alert"
                      className={`mb-4 rounded-[12px] border px-4 py-3 text-[13.5px] leading-[1.45] ${
                        wlErrors.duplicate
                          ? 'border-[#F59E0B]/50 bg-[#FFFBEB] text-[#92400E]'
                          : 'border-[#D92D20]/40 bg-[#FEF3F2] text-[#B42318]'
                      }`}
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
