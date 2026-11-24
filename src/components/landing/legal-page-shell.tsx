'use client'

import React from 'react'
import Link from 'next/link'
import './landing-theme.css'
import { DISPLAY_FONT, MONO_FONT, ParsonaMark } from './shared'
import { Footer } from './footer'

export interface LegalSection {
  id: string
  title: string
  content: React.ReactNode
}

interface LegalPageShellProps {
  activePath: '/privacy' | '/terms' | '/data-policy'
  badgeLabel: string
  badgeBgClass: string
  badgeDotClass: string
  title: string
  subtitle: string
  lastUpdated: string
  effectiveNote: string
  highlights: Array<{ label: string; value: string }>
  sections: LegalSection[]
}

const LEGAL_NAV = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/data-policy', label: 'Personal Data & IT Law' },
] as const

export function LegalPageShell({
  activePath,
  badgeLabel,
  badgeBgClass,
  badgeDotClass,
  title,
  subtitle,
  lastUpdated,
  effectiveNote,
  highlights,
  sections,
}: LegalPageShellProps) {
  return (
    <div className="landing-page-root w-full min-h-screen bg-[var(--background)] text-[var(--text-primary)] [font-family:var(--font-body)] text-[16px] leading-[1.65] antialiased overflow-x-hidden">
      {/* Top Legal Navbar */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/94 backdrop-blur-[10px] border-b border-[var(--border)]">
        <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 h-[72px] flex items-center justify-between gap-4">
          <Link
            href="/"
            className={`flex items-center gap-[10px] ${DISPLAY_FONT} text-[22px] max-[720px]:text-[20px] font-bold tracking-[-0.03em] text-[var(--text-primary)] shrink-0`}
          >
            <ParsonaMark />
            <span>Parsona</span>
          </Link>

          <nav
            aria-label="Legal documents"
            className="hidden md:flex items-center gap-1 rounded-full border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-card)]"
          >
            {LEGAL_NAV.map((item) => {
              const isActive = item.href === activePath
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-full text-[13.5px] font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] border border-[var(--border)] bg-white hover:bg-[var(--surface-green)] hover:border-[var(--brand-primary)] ${MONO_FONT} text-[12.5px] font-medium text-[var(--brand-primary)] transition-colors shrink-0`}
          >
            <span aria-hidden="true">←</span>
            <span>Back to home</span>
          </Link>
        </div>

        {/* Mobile Legal Tabs */}
        <div className="md:hidden border-t border-[var(--border)] px-5 py-2.5 flex gap-2 overflow-x-auto no-scrollbar bg-[var(--surface-secondary)]">
          {LEGAL_NAV.map((item) => {
            const isActive = item.href === activePath
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-white border border-[var(--border)] text-[var(--text-secondary)]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </header>

      <main className="max-w-[1160px] mx-auto px-8 max-[720px]:px-5 pt-14 max-[720px]:pt-10">
        {/* Hero Header */}
        <div className="max-w-[820px]">
          <div
            className={`inline-flex items-center gap-[10px] py-1.5 pr-4 pl-3 mb-5 rounded-full border border-[var(--border)] text-[var(--text-primary)] ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase ${badgeBgClass}`}
          >
            <i className={`w-[8px] h-[8px] rounded-full shrink-0 ${badgeDotClass}`} />
            <span>{badgeLabel}</span>
          </div>

          <h1
            className={`${DISPLAY_FONT} text-[clamp(36px,4vw,48px)] font-bold tracking-[-0.04em] leading-[1.1] text-[var(--text-heading)]`}
          >
            {title}
          </h1>

          <p className="mt-4 text-[18px] max-[720px]:text-[16.5px] text-[var(--text-body)] leading-[1.6]">
            {subtitle}
          </p>

          <div
            className={`mt-5 flex items-center gap-3 flex-wrap ${MONO_FONT} text-[12px] text-[var(--text-secondary)]`}
          >
            <span className="px-2.5 py-1 rounded-md bg-white border border-[var(--border)] text-[var(--brand-primary)]">
              Last updated: {lastUpdated}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-[var(--border)]">
              Jurisdiction: Republic of India
            </span>
            <span>{effectiveNote}</span>
          </div>
        </div>

        {/* Summary Highlights Bar */}
        <div className="mt-9 grid grid-cols-3 max-[720px]:grid-cols-1 gap-4">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="bg-white border border-[var(--border)] rounded-[16px] px-5 py-4 shadow-[var(--shadow-card)]"
            >
              <small
                className={`block ${MONO_FONT} text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] mb-1`}
              >
                {h.label}
              </small>
              <b className="block text-[15px] font-semibold text-[var(--text-heading)] leading-[1.4]">
                {h.value}
              </b>
            </div>
          ))}
        </div>

        {/* Content Grid: Sticky TOC + Document Body */}
        <div className="mt-12 grid grid-cols-[260px_minmax(0,1fr)] max-[960px]:grid-cols-1 gap-10 items-start">
          {/* Sticky TOC */}
          <aside className="sticky top-[96px] max-[960px]:static bg-white border border-[var(--border)] rounded-[18px] p-5 shadow-[var(--shadow-card)]">
            <h2
              className={`${MONO_FONT} text-[11.5px] font-medium uppercase tracking-[0.08em] text-[var(--brand-primary)] mb-3`}
            >
              On this page
            </h2>
            <ol className="space-y-1.5 text-[13.5px]">
              {sections.map((section, idx) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex items-start gap-2 py-1 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors"
                  >
                    <span className={`${MONO_FONT} text-[11.5px] text-[var(--text-muted)] mt-[2px] shrink-0`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-[1.35]">{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>

            <div className="mt-5 pt-4 border-t border-[var(--border)] text-[12.5px] text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-heading)] mb-1">Questions or legal notice?</p>
              <a
                href="mailto:hello@parsona.live"
                className={`block ${MONO_FONT} text-[12px] text-[var(--brand-primary)] hover:underline`}
              >
                hello@parsona.live
              </a>
              <a
                href="tel:+919111951752"
                className={`block ${MONO_FONT} text-[12px] text-[var(--brand-primary)] hover:underline mt-0.5`}
              >
                +91 91119 51752
              </a>
            </div>
          </aside>

          {/* Main Document Card */}
          <div className="bg-white border border-[var(--border)] rounded-[20px] p-9 max-[720px]:p-6 shadow-[var(--shadow-card)] space-y-10">
            {sections.map((section, idx) => (
              <section
                key={section.id}
                id={section.id}
                className={idx > 0 ? 'pt-8 border-t border-[var(--border)]' : ''}
              >
                <div className="flex items-baseline gap-3 mb-3">
                  <span
                    className={`${MONO_FONT} text-[12px] font-medium px-2 py-0.5 rounded bg-[var(--surface-green)] text-[var(--brand-primary)] shrink-0`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h2
                    className={`${DISPLAY_FONT} text-[22px] max-[720px]:text-[20px] font-semibold tracking-[-0.025em] leading-[1.2] text-[var(--text-heading)]`}
                  >
                    {section.title}
                  </h2>
                </div>
                <div className="space-y-3.5 text-[15.5px] text-[var(--text-body)] leading-[1.7] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-[var(--text-heading)] [&_strong]:font-semibold">
                  {section.content}
                </div>
              </section>
            ))}

            {/* Grievance & Contact Footer Card inside Document */}
            <div className="mt-8 bg-[var(--footer-background)] text-white rounded-[16px] p-6 border border-[var(--footer-border)]">
              <span
                className={`inline-block ${MONO_FONT} text-[11px] uppercase tracking-[0.07em] text-[var(--accent-primary)] mb-2`}
              >
                Grievance Officer &amp; Contact (India)
              </span>
              <h3 className={`${DISPLAY_FONT} text-[20px] font-semibold tracking-[-0.02em] text-white`}>
                Parsona Privacy &amp; Compliance Desk
              </h3>
              <p className="text-[var(--footer-text)] text-[14.5px] mt-1.5 leading-[1.55]">
                In accordance with the Information Technology Act, 2000 (and rules thereunder) and
                the Digital Personal Data Protection Act, 2023, any privacy request, data deletion
                request, or legal grievance may be directed to our Grievance Officer:
              </p>
              <div className={`mt-4 flex gap-5 flex-wrap ${MONO_FONT} text-[13px]`}>
                <a
                  href="mailto:hello@parsona.live"
                  className="text-[var(--accent-primary)] hover:underline"
                >
                  Email: hello@parsona.live
                </a>
                <a href="tel:+919111951752" className="text-[var(--accent-primary)] hover:underline">
                  Phone: +91 91119 51752
                </a>
              </div>
              <p className="text-[var(--footer-muted)] text-[12.5px] mt-3">
                We acknowledge grievances within 24 hours and strive to resolve them within 15 days
                (and no later than the statutory period prescribed under Indian law).
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

