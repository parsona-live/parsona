import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string/timestamp deterministically (e.g. "Nov 4, 2026")
 * to prevent SSR / Client hydration mismatches in Next.js.
 */
export function formatDisplayDate(
  dateInput: string | number | Date | null | undefined,
  fallback = "—"
): string {
  if (!dateInput) return fallback
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return fallback
    return format(d, "MMM d, yyyy")
  } catch {
    return fallback
  }
}
