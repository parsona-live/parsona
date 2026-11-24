import React from 'react'
import Link from 'next/link'
import { DISPLAY_FONT, MONO_FONT, ParsonaMark } from './shared'

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Team inbox', href: '/#platform' },
      { label: 'Broadcasts', href: '/#platform' },
      { label: 'CRM', href: '/#platform' },
      { label: 'Flow builder', href: '/#automation' },
      { label: 'AI agents', href: '/#platform' },
    ],
  },
  {
    title: 'Channels',
    links: [
      { label: 'WhatsApp', href: '/#channels' },
      { label: 'Instagram', href: '/#channels' },
      { label: 'Facebook', href: '/#channels' },
      { label: 'Voice (soon)', href: '/#channels' },
    ],
  },
  {
    title: 'Legal & Company',
    links: [
      { label: 'About', href: '/#top' },
      { label: 'Contact', href: 'mailto:hello@parsona.live', external: true },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-[var(--footer-background)] text-white mt-[120px] max-[720px]:mt-[84px] pt-[72px] max-[720px]:pt-12 border-t border-[var(--footer-border)] overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        <div className="grid grid-cols-[1.5fr_repeat(3,1fr)] max-[980px]:grid-cols-2 gap-10 max-[720px]:gap-x-6 max-[720px]:gap-y-9">
          <div className="min-w-0 max-[720px]:col-span-2">
            <Link
              href="/"
              className={`inline-flex items-center gap-[10px] ${DISPLAY_FONT} text-[22px] max-[720px]:text-[20px] font-bold tracking-[-0.03em] text-white`}
            >
              <ParsonaMark variant="inverse" />
              Parsona
            </Link>
            <p className="text-[var(--footer-text)] mt-4 max-w-[300px] text-[15px] leading-[1.55]">
              Business conversations on WhatsApp, Instagram, Facebook and soon voice — with inbox,
              CRM, campaigns and AI in one place.
            </p>

            {/* Direct Contact Details */}
            <div className={`mt-5 flex flex-col gap-2 ${MONO_FONT} text-[13px]`}>
              <a
                href="mailto:hello@parsona.live"
                className="inline-flex items-center gap-2 text-[var(--footer-links)] hover:text-[var(--accent-primary)] transition-colors w-fit"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#CFC3FF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" />
                </svg>
                <span>hello@parsona.live</span>
              </a>
              <a
                href="tel:+919111951752"
                className="inline-flex items-center gap-2 text-[var(--footer-links)] hover:text-[var(--accent-primary)] transition-colors w-fit"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#CFC3FF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                </svg>
                <span>9111951752</span>
              </a>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <h4
                className={`${MONO_FONT} font-medium text-[12px] tracking-[0.07em] uppercase text-white mb-4 max-[720px]:mb-3`}
              >
                {col.title}
              </h4>
              <ul className="space-y-0.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        className="block text-[var(--footer-links)] text-[15px] max-[720px]:text-[14.5px] py-[5px] hover:text-[var(--accent-primary)] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="block text-[var(--footer-links)] text-[15px] max-[720px]:text-[14.5px] py-[5px] hover:text-[var(--accent-primary)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={`flex justify-between gap-3 flex-wrap mt-14 max-[720px]:mt-10 pt-[22px] max-[720px]:pt-5 border-t border-[var(--footer-border)] ${MONO_FONT} text-[12.5px] max-[720px]:text-[11.5px] leading-[1.5] text-[var(--footer-muted)] max-[720px]:flex-col max-[720px]:gap-2`}
        >
          <span>© 2026 Parsona. All rights reserved.</span>
          <span>WhatsApp, Instagram and Facebook are trademarks of their respective owners.</span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`${DISPLAY_FONT} font-extrabold tracking-[-0.06em] leading-[0.74] text-[var(--footer-surface)] mt-9 max-[720px]:mt-7 -mb-[0.06em] whitespace-nowrap text-center select-none`}
        style={{ fontSize: 'clamp(84px, 24vw, 380px)' }}
      >
        Parsona
      </div>
    </footer>
  )
}
