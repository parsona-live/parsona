'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export const EASE = [0.22, 1, 0.36, 1] as const
export const VIEWPORT = { once: true, amount: 0.15 } as const

let trackerInitialized = false
let lastScrollY = 0
let scrollDirection: 'down' | 'up' = 'down'

function ensureScrollTracker() {
  if (trackerInitialized || typeof window === 'undefined') return
  trackerInitialized = true
  lastScrollY = window.scrollY
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY
      if (y <= 2) {
        scrollDirection = 'down'
      } else if (y < lastScrollY - 1) {
        scrollDirection = 'up'
      } else if (y > lastScrollY + 1) {
        scrollDirection = 'down'
      }
      lastScrollY = y
    },
    { passive: true },
  )
}

export function getScrollDirection(): 'down' | 'up' {
  ensureScrollTracker()
  return scrollDirection
}

/**
 * Reveals an element once when scrolling down into view.
 * If the user jumped past the element or scrolls from bottom to top,
 * it snaps visible immediately with zero entrance animation.
 */
export function useDownScrollReveal<T extends Element>(enabled = true, threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [state, setState] = useState<{ isVisible: boolean; instant: boolean }>(() => {
    const noObserver =
      typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined'
    return !enabled || noObserver
      ? { isVisible: true, instant: false }
      : { isVisible: false, instant: false }
  })

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    ensureScrollTracker()

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        const scrollingUp = getScrollDirection() === 'up' || entry.boundingClientRect.top < 0
        setState({ isVisible: true, instant: scrollingUp })
        io.disconnect()
      },
      { threshold },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [enabled, threshold])

  return { ref, ...state }
}

const RevealInstantContext = createContext(false)

interface TextRevealProps {
  text: string
  className?: string
  delay?: number
  stagger?: number
  trigger?: 'mount' | 'inView'
}

/**
 * Word-by-word masked slide-up + subtle de-blur reveal for editorial display headlines.
 * Extra bottom padding inside each word mask prevents descenders (g, p, y) from clipping.
 */
export function TextReveal({
  text,
  className = '',
  delay = 0,
  stagger = 0.048,
  trigger = 'inView',
}: TextRevealProps) {
  const words = text.split(' ')
  const { ref, isVisible, instant } = useDownScrollReveal<HTMLSpanElement>(trigger === 'inView')
  const show = trigger === 'mount' || isVisible

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: instant ? 0 : delay,
        staggerChildren: instant ? 0 : stagger,
      },
    },
  }

  const wordVariants = {
    hidden: {
      y: '108%',
      opacity: 0,
      filter: 'blur(4px)',
    },
    visible: {
      y: '0%',
      opacity: 1,
      filter: 'blur(0px)',
      transition: instant
        ? { duration: 0 }
        : {
            duration: 0.52,
            ease: EASE,
          },
    },
  }

  return (
    <motion.span
      className={`inline ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate={show ? 'visible' : 'hidden'}
    >
      {words.map((word, idx) => (
        <span
          key={`${word}-${idx}`}
          ref={idx === 0 && trigger === 'inView' ? ref : undefined}
          className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]"
        >
          <motion.span variants={wordVariants} className="inline-block will-change-transform">
            {word}
          </motion.span>
          {idx < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </motion.span>
  )
}

interface FadeUpProps {
  children: React.ReactNode
  className?: string
  delay?: number
  distance?: number
  duration?: number
  trigger?: 'mount' | 'inView'
}

export function FadeUp({
  children,
  className = '',
  delay = 0,
  distance = 22,
  duration = 0.56,
  trigger = 'inView',
}: FadeUpProps) {
  const { ref, isVisible, instant } = useDownScrollReveal<HTMLDivElement>(trigger === 'inView')
  const show = trigger === 'mount' || isVisible

  return (
    <motion.div
      ref={trigger === 'inView' ? ref : undefined}
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={instant ? { duration: 0 } : { duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

interface StaggerGroupProps {
  children: React.ReactNode
  className?: string
  stagger?: number
  delay?: number
}

export function StaggerGroup({
  children,
  className = '',
  stagger = 0.09,
  delay = 0.05,
}: StaggerGroupProps) {
  const { ref, isVisible, instant } = useDownScrollReveal<HTMLDivElement>(true)

  return (
    <RevealInstantContext.Provider value={instant}>
      <motion.div
        ref={ref}
        className={className}
        initial="hidden"
        animate={isVisible ? 'visible' : 'hidden'}
        variants={{
          hidden: {},
          visible: {
            transition: {
              delayChildren: instant ? 0 : delay,
              staggerChildren: instant ? 0 : stagger,
            },
          },
        }}
      >
        {children}
      </motion.div>
    </RevealInstantContext.Provider>
  )
}

interface StaggerItemProps {
  children: React.ReactNode
  className?: string
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  const instant = useContext(RevealInstantContext)

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: instant ? { duration: 0 } : { duration: 0.52, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
