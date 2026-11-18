'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { EASE, VIEWPORT } from './motion'

export const DISPLAY_FONT = '[font-family:var(--font-display)]'
export const MONO_FONT = '[font-family:var(--font-lmono)]'

export const BTN_BASE =
  'inline-flex items-center justify-center gap-2 h-12 px-[22px] rounded-[12px] font-semibold text-[15px] border-[1.5px] border-[#0E1512] transition-[background-color,color,transform] duration-200 whitespace-nowrap hover:-translate-y-[1px] focus-visible:outline-[3px] focus-visible:outline-[#1B6A55] focus-visible:outline-offset-[3px]'

export const BTN_DARK = `${BTN_BASE} bg-[#0E1512] text-white hover:bg-[#11503F]`
export const BTN_GREEN = `${BTN_BASE} bg-[#1FD27A] text-[#0E1512] hover:bg-white`
export const BTN_OUTLINE = `${BTN_BASE} bg-transparent text-[#0E1512] hover:bg-[#0E1512] hover:text-white`
export const BTN_SM = '!h-10 !px-4 !text-[14px]'

export const PARSONA_LOGO_PATH =
  'M 993.832031 764.914062 C 969.335938 755.394531 943.210938 750.769531 916.933594 750.769531 L 765.3125 750.769531 L 765.3125 1037.242188 C 765.3125 879.023438 637.042969 750.769531 478.824219 750.769531 L 478.824219 750.753906 C 557.933594 750.753906 629.550781 718.691406 681.398438 666.84375 C 733.25 615.007812 765.3125 543.390625 765.3125 464.28125 C 765.3125 466.167969 765.328125 468.054688 765.367188 469.933594 C 769.367188 676.578125 1035.75 757.265625 1156.765625 589.714844 C 1159.71875 585.628906 1162.585938 581.480469 1165.367188 577.269531 C 1098.671875 423.632812 946.058594 315.949219 768.160156 314.808594 C 526.878906 313.265625 329.359375 509.46875 329.359375 750.753906 C 329.359375 991.527344 524.539062 1186.71875 765.3125 1186.71875 C 949.261719 1186.71875 1106.605469 1072.792969 1170.625 911.632812 C 1129.386719 845.460938 1067.433594 793.523438 993.832031 764.914062 Z'

export function ParsonaMark({ variant = 'dark' }: { variant?: 'dark' | 'green' }) {
  const isFooter = variant === 'green'
  return (
    <span
      className={`w-9 h-9 rounded-[11px] grid place-items-center shrink-0 p-[5px] bg-[#0B3B2E] ${
        isFooter ? 'border border-[#1B6A55]' : ''
      }`}
    >
      <svg
        width="24"
        height="24"
        viewBox="280 270 940 960"
        fill="none"
        aria-hidden="true"
      >
        <path fill="#EEEDEA" d={PARSONA_LOGO_PATH} />
      </svg>
    </span>
  )
}

interface SectionPillProps {
  label: string
  count?: number
  bgClass: string
  dotClass: string
}

export function SectionPill({ label, count, bgClass, dotClass }: SectionPillProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.45, ease: EASE }}
      className={`justify-self-center inline-flex items-center gap-[10px] py-2 pr-4 pl-3 mb-7 max-[720px]:mb-5 rounded-full border-[1.5px] border-[#0E1512] text-[#0E1512] ${MONO_FONT} font-medium text-[12.5px] tracking-[0.08em] uppercase ${bgClass}`}
    >
      <i className={`w-[10px] h-[10px] rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
      {count !== undefined && (
        <span className="min-w-[20px] h-5 rounded-[10px] bg-[#D92D20] text-white font-medium text-[11px] inline-grid place-items-center px-[6px] ml-[2px]">
          {count}
        </span>
      )}
    </motion.div>
  )
}

interface HighlightBubbleProps {
  children: React.ReactNode
  bgClass?: string
  trigger?: 'mount' | 'inView'
  delay?: number
}

export function HighlightBubble({
  children,
  bgClass = 'bg-[#1FD27A]',
  trigger = 'inView',
  delay = 0.16,
}: HighlightBubbleProps) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      {...(trigger === 'mount'
        ? { animate: { opacity: 1, y: 0, scale: 1 } }
        : { whileInView: { opacity: 1, y: 0, scale: 1 }, viewport: VIEWPORT })}
      transition={{
        duration: 0.48,
        delay,
        ease: EASE,
      }}
      className={`inline-block ${bgClass} text-[#0E1512] px-[0.2em] pb-[0.04em] rounded-[0.3em_0.3em_0.3em_0.05em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]`}
    >
      {children}
    </motion.span>
  )
}

