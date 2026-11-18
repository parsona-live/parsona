import React from 'react'
import Link from 'next/link'
import { DISPLAY_FONT, MONO_FONT, ParsonaMark } from './shared'

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Team inbox', href: '#platform' },
      { label: 'Broadcasts', href: '#platform' },
      { label: 'CRM', href: '#platform' },
      { label: 'Flow builder', href: '#automation' },
      { label: 'AI agents', href: '#platform' },
    ],
  },
  {
    title: 'Channels',
    links: [
      { label: 'WhatsApp', href: '#channels' },
      { label: 'Instagram', href: '#channels' },
      { label: 'Facebook', href: '#channels' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help centre', href: '#' },
      { label: 'API docs', href: '#' },
      { label: 'Templates', href: '#' },
      { label: 'Blog', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-[#08241C] text-white mt-[120px] pt-[72px] overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-8 max-[720px]:px-5">
        <div className="grid grid-cols-[1.5fr_repeat(4,1fr)] max-[980px]:grid-cols-2 max-[720px]:grid-cols-1 gap-10">
          <div>
            <Link
              href="/"
              className={`flex items-center gap-[10px] ${DISPLAY_FONT} text-[23px] font-bold tracking-[-0.04em] text-white`}
            >
              <ParsonaMark variant="green" />
              Parsona
            </Link>
            <p className="text-[#9FC2B4] mt-4 max-w-[300px] text-[15px]">
              Business conversations on WhatsApp, Instagram and Facebook, with inbox, CRM,
              campaigns and AI in one place.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className={`${MONO_FONT} font-medium text-[12px] tracking-[0.07em] uppercase text-[#7FE5B2] mb-4`}>
                {col.title}
              </h4>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="block text-[#DCEBE4] text-[15px] py-[5px] hover:text-[#1FD27A] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={`flex justify-between gap-3 flex-wrap mt-14 pt-[22px] border-t border-[#1E4A3D] ${MONO_FONT} text-[12.5px] text-[#8FB5A5]`}
        >
          <span>© 2026 Parsona. All rights reserved.</span>
          <span>WhatsApp, Instagram and Facebook are trademarks of their respective owners.</span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`${DISPLAY_FONT} font-extrabold tracking-[-0.06em] leading-[0.74] text-[clamp(110px,25vw,380px)] text-[#0F4636] mt-9 -mb-[0.06em] whitespace-nowrap text-center select-none`}
      >
        Parsona
      </div>
    </footer>
  )
}

