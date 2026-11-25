import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative z-0 overflow-hidden inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[var(--shadow-brand)]",
        outline:
          "border-border bg-card text-primary shadow-[var(--shadow-card)] hover:bg-muted hover:border-primary/40 aria-expanded:bg-muted aria-expanded:text-primary dark:border-input",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-secondary-foreground",
        accent:
          "bg-[var(--accent-primary)] text-[#30245A] hover:bg-[var(--accent-hover)]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  shimmer = true,
  children,
  style,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    shimmer?: boolean
  }) {
  const hasCustomBg =
    typeof className === "string" &&
    /(?:^|\s)!?bg-(?!transparent\b|primary(?:\/\d+)?\b|card\b|white\b|secondary\b)/.test(
      className
    )

  const showShimmer =
    shimmer &&
    !hasCustomBg &&
    variant !== "ghost" &&
    variant !== "link" &&
    variant !== "destructive" &&
    !String(size).startsWith("icon")

  const isLightSurface = variant === "outline" || variant === "secondary"

  const backdropClass =
    variant === "outline"
      ? "bg-card group-hover/button:bg-muted"
      : variant === "secondary"
        ? "bg-secondary group-hover/button:bg-muted"
        : variant === "accent"
          ? "bg-[var(--accent-primary)] group-hover/button:bg-[var(--accent-hover)]"
          : "bg-primary group-hover/button:bg-primary-hover"

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      style={style}
      {...props}
    >
      {showShimmer && (
        <span
          aria-hidden="true"
          style={{ "--spread": "90deg", "--speed": "3s" } as React.CSSProperties}
          className="pointer-events-none block -z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]"
        >
          <span className="block absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
            <span
              className={cn(
                "block animate-spin-around absolute -inset-full w-auto rotate-0 [translate:0_0]",
                variant === "accent"
                  ? "[background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,#ffffff_var(--spread),transparent_var(--spread))]"
                  : isLightSurface
                    ? "[background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--primary)_var(--spread),transparent_var(--spread))] dark:[background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,#CFC3FF_var(--spread),transparent_var(--spread))]"
                    : "[background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,#CFC3FF_var(--spread),transparent_var(--spread))]"
              )}
            />
          </span>
        </span>
      )}
      {children}
      {showShimmer && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none block inset-0 absolute size-full rounded-[inherit] transition-all duration-300 ease-in-out",
              isLightSurface
                ? "shadow-[inset_0_-6px_10px_rgba(11,59,46,0.05)] group-hover/button:shadow-[inset_0_-6px_10px_rgba(11,59,46,0.11)] group-active/button:shadow-[inset_0_-8px_10px_rgba(11,59,46,0.14)]"
                : variant === "accent"
                  ? "shadow-[inset_0_-6px_10px_rgba(48,36,90,0.08)] group-hover/button:shadow-[inset_0_-6px_10px_rgba(48,36,90,0.14)]"
                  : "shadow-[inset_0_-8px_10px_#ffffff1f] group-hover/button:shadow-[inset_0_-6px_10px_#ffffff3f] group-active/button:shadow-[inset_0_-10px_10px_#ffffff3f]"
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none block absolute -z-20 inset-px rounded-[inherit] transition-colors duration-200",
              backdropClass
            )}
          />
        </>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
