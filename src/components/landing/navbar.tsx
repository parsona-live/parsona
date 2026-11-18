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
    <header className="sticky top-0 z-40 bg-[#F3F5F0]/94 backdrop-blur-[10px] border-b border-[#D9E1DB]">
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
          className={`flex items-center gap-[11px] ${DISPLAY_FONT} text-[23px] font-bold tracking-[-0.04em] text-[#0E1512] shrink-0 focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px] focus-visible:rounded-lg`}
          aria-label="Parsona home"
        >
          <ParsonaMark variant="dark" />
          <span>Parsona</span>
        </Link>

        {/* Center: Desktop Pill-Style Navigation */}
        <nav
          aria-label="Main"
          className="hidden min-[981px]:flex items-center gap-1 rounded-full bg-white/85 border border-[#D9E1DB] p-[5px] shadow-[0_2px_10px_rgba(14,21,18,0.04)]"
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeId === link.id
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setActiveId(link.id)}
                className={`rounded-full px-4 py-[7px] text-[14.5px] font-medium transition-colors duration-200 whitespace-nowrap focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[2px] ${
                  isActive
                    ? 'bg-[#DCE7DF] text-[#0B3B2E] font-semibold'
                    : 'text-[#2A3731] hover:bg-[#EDF3EE] hover:text-[#0E1512]'
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
          className="hidden min-[981px]:inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-[14px] bg-[#0B3B2E] hover:bg-[#11503F] text-white font-semibold text-[14.5px] transition-[background-color,transform] duration-200 hover:-translate-y-[1px] whitespace-nowrap shadow-[0_2px_8px_rgba(11,59,46,0.18)] shrink-0 focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px]"
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
          className="hidden max-[980px]:inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#0E1512] bg-transparent border-0 cursor-pointer hover:bg-[#DCE7DF]/60 transition-colors focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[2px]"
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
          className="min-[981px]:hidden bg-[#F3F5F0] border-t border-[#0E1512]/80 px-5 pt-6 pb-7 shadow-[0_14px_30px_rgba(14,21,18,0.12)]"
        >
          <div className="text-[19px] font-medium text-[#0E1512] mb-2">Menu</div>
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
                  className={`flex items-center justify-between py-[15px] border-b border-[#0E1512]/65 text-[16px] transition-colors ${
                    isActive
                      ? 'font-semibold text-[#0B3B2E]'
                      : 'font-medium text-[#0E1512] hover:text-[#11503F]'
                  }`}
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true" className="text-[14px] text-[#52625A]">
                    ↗
                  </span>
                </a>
              )
            })}
          </div>
          <a
            href="#waitlist"
            onClick={() => setMobileMenuOpen(false)}
            className="mt-6 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-[12px] bg-[#0B3B2E] hover:bg-[#11503F] text-white font-semibold text-[15.5px] transition-colors"
          >
            <span>Join waitlist</span>
            <span aria-hidden="true">→</span>
          </a>
        </nav>
      )}
    </header>
  )
}
