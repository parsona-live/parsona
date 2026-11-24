'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { DISPLAY_FONT, ParsonaMark } from './shared'

const NAV_LINKS = [
  { href: '#channels', id: 'channels', label: 'Channels' },
  { href: '#use-cases', id: 'use-cases', label: 'Use cases' },
  { href: '#platform', id: 'platform', label: 'Product' },
  { href: '#automation', id: 'automation', label: 'Workflows' },
  { href: '#pricing', id: 'pricing', label: 'Pricing' },
  { href: '#faq', id: 'faq', label: 'FAQ' },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeId, setActiveId] = useState<string>('channels')

  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id)
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.1, 0.4] }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-[var(--background)]/94 backdrop-blur-[10px] border-b border-[var(--border)]">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5 flex items-center justify-between h-[76px] max-[980px]:h-[68px] gap-4">
        {/* Left: Parsona Logo -> / */}
        <Link
          href="/"
          onClick={(e) => {
            setActiveId('channels')
            setMobileMenuOpen(false)
            if (window.location.pathname === '/') {
              e.preventDefault()
              if (window.location.hash) {
                window.history.replaceState(null, '', '/')
              }
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }}
          className={`flex items-center gap-[11px] ${DISPLAY_FONT} text-[22px] max-[720px]:text-[20px] font-bold tracking-[-0.03em] text-[var(--text-primary)] shrink-0 focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px] focus-visible:rounded-lg`}
          aria-label="Parsona home"
        >
          <ParsonaMark variant="dark" />
          <span>Parsona</span>
        </Link>

        {/* Center: Desktop Pill-Style Navigation */}
        <nav
          aria-label="Main"
          className="hidden min-[981px]:flex items-center gap-1 rounded-full bg-white border border-[var(--border)] p-[5px] shadow-[var(--shadow-card)]"
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeId === link.id
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setActiveId(link.id)}
                className={`rounded-full px-4 py-[7px] text-[14px] font-medium transition-colors duration-200 whitespace-nowrap focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[2px] ${
                  isActive
                    ? 'bg-[var(--surface-green)] text-[var(--brand-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {link.label}
              </a>
            )
          })}
        </nav>

        {/* Right: Desktop Join waitlist -> #waitlist */}
        <a
          href="#waitlist"
          className="hidden min-[981px]:inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-[12px] bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] active:bg-[var(--brand-active)] text-white font-semibold text-[15px] transition-colors duration-200 whitespace-nowrap shadow-[var(--shadow-brand)] shrink-0 focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px]"
        >
          <span>Join waitlist</span>
          <span aria-hidden="true">→</span>
        </a>

        {/* Right: Mobile Minimal 2-Line Menu Toggle */}
        <button
          id="burger"
          type="button"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="hidden max-[980px]:inline-flex items-center justify-center w-10 h-10 rounded-lg text-[var(--text-primary)] bg-transparent border-0 cursor-pointer hover:bg-white/60 transition-colors focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[2px]"
        >
          {mobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 9h16" />
              <path d="M4 15h11" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <nav
          id="nav"
          aria-label="Mobile navigation"
          className="min-[981px]:hidden bg-[var(--background)] border-t border-[var(--border)] px-5 pt-6 pb-7 shadow-[var(--shadow-dropdown)]"
        >
          <div className="text-[18px] font-semibold text-[var(--text-heading)] mb-2">Menu</div>
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => {
              const isActive = activeId === link.id
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    setActiveId(link.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`flex items-center justify-between py-[15px] border-b border-[var(--border)] text-[15px] transition-colors ${
                    isActive
                      ? 'font-semibold text-[var(--brand-primary)]'
                      : 'font-medium text-[var(--text-body)] hover:text-[var(--brand-primary)]'
                  }`}
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true" className="text-[14px] text-[var(--text-secondary)]">
                    ↗
                  </span>
                </a>
              )
            })}
          </div>
          <a
            href="#waitlist"
            onClick={() => setMobileMenuOpen(false)}
            className="mt-6 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-[12px] bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold text-[15px] transition-colors"
          >
            <span>Join waitlist</span>
            <span aria-hidden="true">→</span>
          </a>
        </nav>
      )}
    </header>
  )
}
