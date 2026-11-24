import React, { type CSSProperties } from 'react'

import { cn } from '@/lib/utils'

interface ShimmerStyleOptions {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
  hoverBackground?: string
}

export interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ShimmerStyleOptions {
  className?: string
  highlightClassName?: string
  children?: React.ReactNode
}

export interface ShimmerLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    ShimmerStyleOptions {
  className?: string
  highlightClassName?: string
  children?: React.ReactNode
}

const SHIMMER_BASE_CLASS =
  'group relative z-0 inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-white/15 px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)] transform-gpu transition-transform duration-300 ease-in-out hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-[3px] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[3px] disabled:pointer-events-none disabled:opacity-70'

function buildShimmerVars({
  shimmerColor = '#ffffff',
  shimmerSize = '0.05em',
  borderRadius = '100px',
  shimmerDuration = '3s',
  background = 'var(--brand-primary)',
  hoverBackground,
}: ShimmerStyleOptions): CSSProperties {
  return {
    '--spread': '90deg',
    '--shimmer-color': shimmerColor,
    '--radius': borderRadius,
    '--speed': shimmerDuration,
    '--cut': shimmerSize,
    '--bg': background,
    '--bg-hover': hoverBackground ?? background,
  } as CSSProperties
}

function ShimmerLayers({
  children,
  highlightClassName,
}: {
  children?: React.ReactNode
  highlightClassName?: string
}) {
  return (
    <>
      {/* spark container */}
      <span
        aria-hidden="true"
        className="pointer-events-none block -z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]"
      >
        {/* spark */}
        <span className="block absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          {/* spark before */}
          <span className="block animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </span>
      </span>

      {children}

      {/* Highlight */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none block inset-0 absolute size-full',
          'rounded-[inherit] px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]',
          'transform-gpu transition-all duration-300 ease-in-out',
          'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
          'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]',
          highlightClassName
        )}
      />

      {/* backdrop */}
      <span
        aria-hidden="true"
        className="pointer-events-none block absolute -z-20 transition-colors duration-200 [background:var(--bg)] group-hover:[background:var(--bg-hover)] [border-radius:var(--radius)] [inset:var(--cut)]"
      />
    </>
  )
}

const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor,
      shimmerSize,
      shimmerDuration,
      borderRadius,
      background,
      hoverBackground,
      className,
      highlightClassName,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={{
          ...buildShimmerVars({
            shimmerColor,
            shimmerSize,
            borderRadius,
            shimmerDuration,
            background,
            hoverBackground,
          }),
          ...style,
        }}
        className={cn(SHIMMER_BASE_CLASS, className)}
        ref={ref}
        {...props}
      >
        <ShimmerLayers highlightClassName={highlightClassName}>{children}</ShimmerLayers>
      </button>
    )
  }
)

ShimmerButton.displayName = 'ShimmerButton'

const ShimmerLink = React.forwardRef<HTMLAnchorElement, ShimmerLinkProps>(
  (
    {
      shimmerColor,
      shimmerSize,
      shimmerDuration,
      borderRadius,
      background,
      hoverBackground,
      className,
      highlightClassName,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <a
        style={{
          ...buildShimmerVars({
            shimmerColor,
            shimmerSize,
            borderRadius,
            shimmerDuration,
            background,
            hoverBackground,
          }),
          ...style,
        }}
        className={cn(SHIMMER_BASE_CLASS, className)}
        ref={ref}
        {...props}
      >
        <ShimmerLayers highlightClassName={highlightClassName}>{children}</ShimmerLayers>
      </a>
    )
  }
)

ShimmerLink.displayName = 'ShimmerLink'

export { ShimmerButton, ShimmerLink }
