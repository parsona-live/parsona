import React from 'react'
import { cn } from '@/lib/utils'
import type { ChannelType } from '@/types'

export interface ChannelIconProps extends React.SVGProps<SVGSVGElement> {
  channel?: ChannelType | 'all' | string | null
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const SIZE_MAP = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/**
 * Official vector brand icons for supported communication channels.
 */
export function ChannelIcon({ channel, className, size = 'sm', ...props }: ChannelIconProps) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm

  if (channel === 'instagram') {
    return (
      <svg
        className={cn(sizeClass, className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    )
  }

  if (channel === 'facebook') {
    return (
      <svg
        className={cn(sizeClass, className)}
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
      >
        {/* Official Messenger chat bubble with lightning bolt */}
        <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.455 5.503 3.735 7.159V22l3.435-1.884c.915.253 1.884.391 2.83.391 5.523 0 10-4.145 10-9.249C22 6.145 17.523 2 12 2zm1.002 12.441-2.565-2.736-5.008 2.736 5.512-5.855 2.628 2.736 4.945-2.736-5.512 5.855z" />
      </svg>
    )
  }

  // Default to WhatsApp
  return (
    <svg
      className={cn(sizeClass, className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

/**
 * Avatar badge positioned at the bottom-right corner of a contact avatar.
 */
export function AvatarChannelBadge({ channel, className }: { channel?: ChannelType | string | null; className?: string }) {
  if (channel === 'instagram') {
    return (
      <span
        title="Instagram Direct"
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-xs ring-1.5 ring-background",
          className
        )}
      >
        <ChannelIcon channel="instagram" size="xs" className="h-2.5 w-2.5 text-white" />
      </span>
    )
  }

  if (channel === 'facebook') {
    return (
      <span
        title="Facebook Messenger"
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0084FF] text-white shadow-xs ring-1.5 ring-background",
          className
        )}
      >
        <ChannelIcon channel="facebook" size="xs" className="h-2.5 w-2.5 text-white" />
      </span>
    )
  }

  return (
    <span
      title="WhatsApp"
      className={cn(
        "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xs ring-1.5 ring-background",
        className
      )}
    >
      <ChannelIcon channel="whatsapp" size="xs" className="h-2.5 w-2.5 text-white" />
    </span>
  )
}

/**
 * Pill-style channel badge with icon and label.
 */
export function ChannelPillBadge({
  channel,
  showLabel = true,
  className,
}: {
  channel?: ChannelType | string | null
  showLabel?: boolean
  className?: string
}) {
  if (channel === 'instagram') {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f9ce34]/90 via-[#ee2a7b]/90 to-[#6228d7]/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs",
          className
        )}
      >
        <ChannelIcon channel="instagram" size="xs" className="text-white" />
        {showLabel && <span>Instagram</span>}
      </span>
    )
  }

  if (channel === 'facebook') {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-[#0084FF] px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs",
          className
        )}
      >
        <ChannelIcon channel="facebook" size="xs" className="text-white" />
        {showLabel && <span>Messenger</span>}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs",
        className
      )}
    >
      <ChannelIcon channel="whatsapp" size="xs" className="text-white" />
      {showLabel && <span>WhatsApp</span>}
    </span>
  )
}

