'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { validateWaitlistInput } from '@/lib/waitlist-validation'
import { DISPLAY_FONT, HighlightBubble, MONO_FONT, SectionPill, SHIMMER_PRIMARY } from './shared'
import { EASE, FadeUp, TextReveal } from './motion'
import { ShimmerButton } from '@/components/ui/shimmer-button'

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
    'w-full h-[46px] border rounded-[10px] px-4 font-normal text-[16px] max-[720px]:text-[15px] bg-white text-[var(--text-body)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-3 focus:ring-[var(--focus-ring)]/15 disabled:opacity-60 transition-colors'

  return (
    <section id="waitlist" className="pt-[120px] max-[980px]:pt-[88px]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 grid grid-cols-1">
        <SectionPill label="Waitlist" />

        <div>
          <div className="max-w-[820px] mx-auto text-center">
            <h2
              className={`${DISPLAY_FONT} text-[clamp(32px,3.7vw,42px)] font-bold tracking-[-0.035em] leading-[1.15] text-balance text-[var(--text-heading)]`}
            >
              <TextReveal text="Get early access." />
              <br />
              <HighlightBubble bgClass="bg-[var(--accent-primary)] text-[#30245A]" delay={0.18}>
                Join the waitlist.
              </HighlightBubble>
            </h2>
            <FadeUp delay={0.16} distance={14}>
              <p className="mt-5 text-[18px] max-[720px]:text-[17px] text-[var(--text-body)] max-w-[560px] mx-auto leading-[1.6]">
                Leave your details and we will email you as soon as your invite is ready.
              </p>
            </FadeUp>
          </div>

          <FadeUp delay={0.14} distance={24}>
            <div className="mt-12 mx-auto max-w-[640px] bg-white border border-[var(--border)] rounded-[20px] p-8 max-[720px]:px-5 max-[720px]:py-6 shadow-[var(--shadow-card)]">
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
                      className={`block ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[var(--text-secondary)] mb-2`}
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
                      className={`${inputBase} ${wlErrors.name ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}
                    />
                    <div
                      id="wl-name-e"
                      aria-live="polite"
                      className={`text-[var(--error)] ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
                    >
                      {wlErrors.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 max-[720px]:grid-cols-1 gap-4 max-[720px]:gap-0">
                    <div className="mb-[18px]">
                      <label
                        htmlFor="wl-email"
                        className={`block ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[var(--text-secondary)] mb-2`}
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
                              ? 'border-[var(--warning)]'
                              : 'border-[var(--error)]'
                            : 'border-[var(--border)]'
                        }`}
                      />
                      <div
                        id="wl-email-e"
                        aria-live="polite"
                        className={`${wlErrors.duplicate ? 'text-[var(--warning)]' : 'text-[var(--error)]'} ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
                      >
                        {wlErrors.email}
                      </div>
                    </div>

                    <div className="mb-[18px]">
                      <label
                        htmlFor="wl-phone"
                        className={`block ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase text-[var(--text-secondary)] mb-2`}
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
                              ? 'border-[var(--warning)]'
                              : 'border-[var(--error)]'
                            : 'border-[var(--border)]'
                        }`}
                      />
                      <div
                        id="wl-phone-e"
                        aria-live="polite"
                        className={`${wlErrors.duplicate ? 'text-[var(--warning)]' : 'text-[var(--error)]'} ${MONO_FONT} text-[12px] mt-[6px] min-h-[16px]`}
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
                          ? 'border-[var(--warning)]/35 bg-[var(--warning-bg)] text-[var(--warning)]'
                          : 'border-[var(--error)]/35 bg-[var(--error-bg)] text-[var(--error)]'
                      }`}
                    >
                      {wlErrors.form}
                    </div>
                  )}

                  <ShimmerButton
                    type="submit"
                    disabled={wlSubmitting}
                    {...SHIMMER_PRIMARY}
                    className={`${SHIMMER_PRIMARY.className} w-full !h-[48px] !text-[15px] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed`}
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
                  </ShimmerButton>
                  <p
                    className={`${MONO_FONT} text-[12px] text-[var(--text-secondary)] text-center mt-[14px] leading-[1.6]`}
                  >
                    No spam. Only your invite and product updates. By joining, you agree to our{' '}
                    <Link href="/terms" className="underline text-[var(--brand-primary)] hover:text-[var(--brand-hover)]">
                      Terms
                    </Link>
                    ,{' '}
                    <Link href="/privacy" className="underline text-[var(--brand-primary)] hover:text-[var(--brand-hover)]">
                      Privacy Policy
                    </Link>{' '}
                    &amp;{' '}
                    <Link
                      href="/data-policy"
                      className="underline text-[var(--brand-primary)] hover:text-[var(--brand-hover)]"
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
                  <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] grid place-items-center mx-auto mb-[18px] border border-[var(--success)]/25">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </div>
                  <h3
                    className={`${DISPLAY_FONT} text-[28px] font-semibold tracking-[-0.03em] leading-[1.1] text-[var(--text-heading)]`}
                  >
                    You’re on the list, <span id="wl-first">{wlFirstName}</span>.
                  </h3>
                  <p className="text-[var(--text-secondary)] mt-[10px]">
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
