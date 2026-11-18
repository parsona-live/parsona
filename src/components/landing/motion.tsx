'use client'

import React from 'react'
import { motion } from 'framer-motion'

export const EASE = [0.22, 1, 0.36, 1] as const
export const VIEWPORT = { once: true, amount: 0.2 } as const

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

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay,
        staggerChildren: stagger,
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
      transition: {
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
      {...(trigger === 'mount'
        ? { animate: 'visible' }
        : { whileInView: 'visible', viewport: VIEWPORT })}
    >
      {words.map((word, idx) => (
        <span
          key={`${word}-${idx}`}
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
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      {...(trigger === 'mount'
        ? { animate: { opacity: 1, y: 0 } }
        : { whileInView: { opacity: 1, y: 0 }, viewport: VIEWPORT })}
      transition={{ duration, delay, ease: EASE }}
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
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: delay,
            staggerChildren: stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: React.ReactNode
  className?: string
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.52, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

