'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { EASE, VIEWPORT } from './motion'
import { ParsonaLogoMark } from '@/components/ui/parsona-logo'

export const DISPLAY_FONT = '[font-family:var(--font-display)]'
export const MONO_FONT = '[font-family:var(--font-lmono)]'

export const BTN_BASE =
  'inline-flex items-center justify-center gap-2 h-[44px] px-[22px] rounded-[12px] font-semibold text-[15px] max-[720px]:text-[14px] border transition-colors duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]/25 focus-visible:border-[var(--brand-primary)]'

export const BTN_DARK = `${BTN_BASE} bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] hover:bg-[var(--brand-hover)] active:bg-[var(--brand-active)]`
export const BTN_GREEN = `${BTN_BASE} bg-[var(--accent-primary)] text-[#30245A] border-[var(--accent-primary)] hover:bg-[var(--accent-hover)]`
export const BTN_OUTLINE = `${BTN_BASE} bg-white text-[var(--brand-primary)] border-[var(--border)] hover:bg-[var(--surface-green)] hover:border-[var(--brand-primary)]`
export const BTN_SM = '!h-10 !px-4 !text-[14px]'

export function ParsonaMark({ variant = 'dark' }: { variant?: 'dark' | 'green' | 'inverse' }) {
  const isInverse = variant === 'green' || variant === 'inverse'
  return <ParsonaLogoMark variant={isInverse ? 'inverse' : 'primary'} size={36} />
}

interface SectionPillProps {
  label: string
  count?: number
  bgClass?: string
  dotClass?: string
}

export function SectionPill({
  label,
  count,
  bgClass = 'bg-white',
  dotClass = 'bg-[var(--brand-primary)]',
}: SectionPillProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.45, ease: EASE }}
      className={`justify-self-center inline-flex items-center gap-[10px] py-1.5 pr-4 pl-3 mb-7 max-[720px]:mb-5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] ${MONO_FONT} font-medium text-[12px] tracking-[0.06em] uppercase shadow-[var(--shadow-card)] ${bgClass}`}
    >
      <i className={`w-[8px] h-[8px] rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
      {count !== undefined && (
        <span className="min-w-[20px] h-5 rounded-full bg-[var(--surface-lavender)] text-[var(--accent-text)] font-medium text-[11px] inline-grid place-items-center px-[6px] ml-[2px]">
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
  bgClass = 'bg-[var(--accent-primary)] text-[#30245A]',
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
      className={`inline-block ${bgClass} px-[0.22em] pb-[0.04em] rounded-[0.25em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]`}
    >
      {children}
    </motion.span>
  )
}

