'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface RibbonStop {
  hex: string
  pos: number
  name?: string
}

export interface RibbonFieldGradientProps {
  colors?: RibbonStop[]
  angle?: number
  centerX?: number
  centerY?: number
  scale?: number
  softness?: number
  wave?: number
  distortion?: number
  grain?: number
  vignette?: number
  speed?: number
  motionAmount?: number
  motionReverse?: boolean
  animated?: boolean
  seed?: number
  backdrop?: string
  className?: string
}

export const PARSONA_RIBBON_STOPS: RibbonStop[] = [
  { hex: '#F9FAFC', pos: 14, name: 'Bright Pearl' },
  { hex: '#E6F0EC', pos: 42, name: 'Surface Green' },
  { hex: '#E5DEFF', pos: 68, name: 'Lavender Light' },
  { hex: '#CFC3FF', pos: 92, name: 'Lavender' },
]

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createNoiseDataUrl(seed: number): string {
  if (typeof document === 'undefined') return ''
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const img = ctx.createImageData(size, size)
  const rng = mulberry32(seed)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng() * 255
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0
  if (span <= 0) return x >= edge0 ? 1 : 0
  const t = Math.max(0, Math.min(1, (x - edge0) / span))
  return t * t * (3 - 2 * t)
}

interface CompiledBand {
  boundary: number
  halfFeather: number
  r0: number
  g0: number
  b0: number
  r1: number
  g1: number
  b1: number
}

/**
 * Animated Ribbon Field gradient canvas along `angle` with cross-axis sine wave
 * modulation, smooth edge feathering (`softness`), seeded grain overlay, and
 * unquantized requestAnimationFrame motion.
 */
export function RibbonFieldGradient({
  colors = PARSONA_RIBBON_STOPS,
  angle = 152,
  centerX = 50,
  centerY = 46,
  scale = 88,
  softness = 34,
  wave = 14,
  distortion = 16,
  grain = 45,
  vignette = 16,
  speed = 63,
  motionAmount = 32,
  motionReverse = false,
  animated = true,
  seed = 664306262,
  backdrop = '#EBEDF1',
  className,
}: RibbonFieldGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const noiseLayerRef = useRef<HTMLDivElement | null>(null)

  const sortedStops = useMemo(() => {
    const sorted = [...colors].sort((a, b) => a.pos - b.pos)
    return sorted.map((s) => ({
      pos: s.pos / 100,
      rgb: hexToRgb(s.hex),
    }))
  }, [colors])

  useEffect(() => {
    if (noiseLayerRef.current && grain > 0) {
      const url = createNoiseDataUrl(seed)
      if (url) {
        noiseLayerRef.current.style.backgroundImage = `url(${url})`
      }
    }
  }, [seed, grain])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || sortedStops.length === 0) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // Internal float-mapped canvas resolution keeps curved wave math 60fps
    // while upscaling smoothly with zero frame quantization.
    const width = 360
    const height = 240
    canvas.width = width
    canvas.height = height

    const imageData = ctx.createImageData(width, height)
    const pixels = imageData.data

    // Precompute feathered stripe intervals between adjacent sorted stops
    const featherHalf = (softness / 100) * 0.24
    const boundaries: CompiledBand[] = []
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const curr = sortedStops[i]
      const next = sortedStops[i + 1]
      const mid = (curr.pos + next.pos) * 0.5
      const maxSpan = (next.pos - curr.pos) * 0.48
      boundaries.push({
        boundary: mid,
        halfFeather: Math.min(featherHalf, maxSpan),
        r0: curr.rgb[0],
        g0: curr.rgb[1],
        b0: curr.rgb[2],
        r1: next.rgb[0],
        g1: next.rgb[1],
        b1: next.rgb[2],
      })
    }

    const firstRgb = sortedStops[0].rgb
    const scaleFactor = Math.max(0.15, scale / 100)
    const cx = centerX / 100
    const cy = centerY / 100
    const waveAmp = (wave / 100) * 0.35
    const distortAmp = (distortion / 100) * 0.14
    const twoPi = Math.PI * 2
    const speedFactor = speed / 100
    const amt = motionAmount / 100
    const dir = motionReverse ? -1 : 1
    const baseWaveClock = 20.75

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    const startMs = performance.now()

    const renderFrame = (nowMs: number) => {
      const t = animated && !prefersReducedMotion ? (nowMs - startMs) / 1000 : 0
      const ph = t * speedFactor
      const spin = ph * dir

      // Strictly 0 at ph = 0 so motion starts seamlessly without snapping
      const currentAngleDeg = angle + Math.sin(spin * 0.6) * 28 * amt
      const waveClock = baseWaveClock + ph * 1.2

      // Map CSS linear-gradient angle convention (0deg=up, 90deg=right, 180deg=down)
      const rad = ((currentAngleDeg - 90) * Math.PI) / 180
      const dirX = Math.cos(rad)
      const dirY = Math.sin(rad)
      const perpX = -dirY
      const perpY = dirX

      const invW = 1 / (width - 1)
      const invH = 1 / (height - 1)

      let ptr = 0
      for (let py = 0; py < height; py++) {
        const ny = py * invH - cy
        for (let px = 0; px < width; px++) {
          const nx = px * invW - cx

          // Projection along ribbon gradient axis & cross-axis
          const along = (nx * dirX + ny * dirY) / scaleFactor + 0.5
          const cross = nx * perpX + ny * perpY

          // Curved stripe field wave + subtle organic distortion harmonic
          const waveOffset =
            waveAmp * Math.sin(cross * 2.4 * twoPi + waveClock) +
            distortAmp * Math.sin(cross * 1.15 * twoPi + waveClock * 0.55 + 1.1)

          const s = along + waveOffset

          let r = firstRgb[0]
          let g = firstRgb[1]
          let b = firstRgb[2]

          for (let i = 0; i < boundaries.length; i++) {
            const band = boundaries[i]
            const edgeStart = band.boundary - band.halfFeather
            const edgeEnd = band.boundary + band.halfFeather
            if (s <= edgeStart) break
            if (s >= edgeEnd) {
              r = band.r1
              g = band.g1
              b = band.b1
            } else {
              const mix = smoothstep(edgeStart, edgeEnd, s)
              r = band.r0 + (band.r1 - band.r0) * mix
              g = band.g0 + (band.g1 - band.g0) * mix
              b = band.b0 + (band.b1 - band.b0) * mix
              break
            }
          }

          pixels[ptr] = r
          pixels[ptr + 1] = g
          pixels[ptr + 2] = b
          pixels[ptr + 3] = 255
          ptr += 4
        }
      }

      ctx.putImageData(imageData, 0, 0)

      if (animated && !prefersReducedMotion) {
        rafId = requestAnimationFrame(renderFrame)
      }
    }

    renderFrame(startMs)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [
    sortedStops,
    angle,
    centerX,
    centerY,
    scale,
    softness,
    wave,
    distortion,
    speed,
    motionAmount,
    motionReverse,
    animated,
  ])

  const grainOpacity = Math.min(0.16, Math.max(0, (grain / 100) * 0.08))
  const vignetteStrength = Math.min(0.12, Math.max(0, (vignette / 100) * 0.08))

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ backgroundColor: backdrop }}
    >
      {/* Animated Ribbon Field Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block object-cover"
        style={{ imageRendering: 'auto' }}
      />

      {/* Soft Radial Vignette */}
      {vignette > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${centerX}% ${centerY}%, rgba(11, 59, 46, 0) 54%, rgba(11, 59, 46, ${vignetteStrength}) 100%)`,
          }}
        />
      )}

      {/* Subtle Micro-Grain Finish */}
      {grain > 0 && (
        <div
          ref={noiseLayerRef}
          className="absolute inset-0 bg-repeat mix-blend-soft-light"
          style={{
            backgroundSize: '160px 160px',
            opacity: grainOpacity,
          }}
        />
      )}
    </div>
  )
}
