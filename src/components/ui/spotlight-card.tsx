'use client'

import React, { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type GlowColor = 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'forest' | 'lavender'

export interface GlowCardProps {
  children?: ReactNode
  className?: string
  glowColor?: GlowColor
  size?: 'sm' | 'md' | 'lg'
  width?: string | number
  height?: string | number
  customSize?: boolean
  surface?: 'glass' | 'light' | 'green' | 'dark'
  radius?: number
  borderSize?: number
  spotlightSize?: number
}

const glowColorMap: Record<
  GlowColor,
  { base: number; spread: number; saturation?: number; lightness?: number }
> = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
  forest: { base: 156, spread: 14, saturation: 44, lightness: 66 },
  lavender: { base: 256, spread: 16, saturation: 92, lightness: 86 },
}

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96',
}

const surfaceMap = {
  glass: {
    backdrop: 'hsl(0 0% 60% / 0.12)',
    backupBorder: 'hsl(0 0% 60% / 0.12)',
    bgSpotOpacity: 0.1,
    bgLightness: 74,
    borderLightness: 60,
    borderSpotOpacity: 0.9,
    borderLightOpacity: 0.8,
    glowHighlight: '0 100% 100%',
    outer: 0.65,
    borderBrightness: 1.35,
  },
  light: {
    backdrop: '#FFFFFF',
    backupBorder: 'var(--border)',
    bgSpotOpacity: 0.22,
    bgLightness: 88,
    borderLightness: 68,
    borderSpotOpacity: 0.75,
    borderLightOpacity: 0.55,
    glowHighlight: '256 100% 94%',
    outer: 0.14,
    borderBrightness: 1.05,
  },
  green: {
    backdrop: '#EEF5F1',
    backupBorder: 'var(--border)',
    bgSpotOpacity: 0.26,
    bgLightness: 86,
    borderLightness: 64,
    borderSpotOpacity: 0.72,
    borderLightOpacity: 0.5,
    glowHighlight: '156 50% 88%',
    outer: 0.14,
    borderBrightness: 1.05,
  },
  dark: {
    backdrop: 'var(--footer-background)',
    backupBorder: 'var(--footer-border)',
    bgSpotOpacity: 0.16,
    bgLightness: 86,
    borderLightness: 82,
    borderSpotOpacity: 0.78,
    borderLightOpacity: 0.65,
    glowHighlight: '256 100% 92%',
    outer: 0.25,
    borderBrightness: 1.12,
  },
}

const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = '',
  glowColor = 'blue',
  size = 'md',
  width,
  height,
  customSize = false,
  surface = 'glass',
  radius,
  borderSize,
  spotlightSize,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e
      if (cardRef.current) {
        cardRef.current.style.setProperty('--x', x.toFixed(2))
        cardRef.current.style.setProperty('--xp', (x / window.innerWidth).toFixed(2))
        cardRef.current.style.setProperty('--y', y.toFixed(2))
        cardRef.current.style.setProperty('--yp', (y / window.innerHeight).toFixed(2))
      }
    }

    document.addEventListener('pointermove', syncPointer, { passive: true })
    return () => document.removeEventListener('pointermove', syncPointer)
  }, [])

  const { base, spread, saturation = 100, lightness = 70 } = glowColorMap[glowColor]
  const surfaceTokens = surfaceMap[surface]
  const resolvedRadius = radius ?? (customSize ? 18 : 14)
  const resolvedBorder = borderSize ?? (customSize ? 1 : 3)
  const resolvedSize = spotlightSize ?? (customSize ? 280 : 200)
  const resolvedBorderLightness = surface === 'glass' ? lightness : surfaceTokens.borderLightness
  const resolvedGlowHighlight =
    surface === 'light' && glowColor === 'forest' ? '156 48% 88%' : surfaceTokens.glowHighlight

  const inlineStyles: CSSProperties & Record<string, string | number> = {
    '--base': base,
    '--spread': spread,
    '--saturation': saturation,
    '--lightness': resolvedBorderLightness,
    '--radius': resolvedRadius,
    '--border': resolvedBorder,
    '--backdrop': surfaceTokens.backdrop,
    '--backup-border': surfaceTokens.backupBorder,
    '--bg-spot-opacity': surfaceTokens.bgSpotOpacity,
    '--border-spot-opacity': surfaceTokens.borderSpotOpacity,
    '--border-light-opacity': surfaceTokens.borderLightOpacity,
    '--glow-highlight': resolvedGlowHighlight,
    '--border-brightness': surfaceTokens.borderBrightness,
    '--outer': surfaceTokens.outer,
    '--size': resolvedSize,
    '--border-size': 'calc(var(--border, 2) * 1px)',
    '--spotlight-size': 'calc(var(--size, 150) * 1px)',
    '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, -999) * 1px)
      calc(var(--y, -999) * 1px),
      hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) ${surfaceTokens.bgLightness}% / var(--bg-spot-opacity, 0.14)), transparent
    )`,
    backgroundColor: 'var(--backdrop, transparent)',
    backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
    backgroundPosition: '50% 50%',
    backgroundAttachment: 'fixed',
    border: 'var(--border-size) solid var(--backup-border)',
    position: 'relative',
    touchAction: 'pan-y',
  }

  if (width !== undefined) {
    inlineStyles.width = typeof width === 'number' ? `${width}px` : width
  }
  if (height !== undefined) {
    inlineStyles.height = typeof height === 'number' ? `${height}px` : height
  }

  return (
    <div
      ref={cardRef}
      data-glow
      style={inlineStyles}
      className={cn(
        'group relative',
        !customSize && [
          sizeMap[size],
          'aspect-[3/4] rounded-2xl grid grid-rows-[1fr_auto] shadow-[0_1rem_2rem_-1rem_black] p-4 gap-4 backdrop-blur-[5px]',
        ],
        className
      )}
    >
      <div data-glow="outer" aria-hidden="true" />
      {children}
    </div>
  )
}

export { GlowCard }
