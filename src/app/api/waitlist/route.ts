import { NextResponse } from 'next/server'
import { validateWaitlistInput } from '@/lib/waitlist-validation'

interface WaitlistPayload {
  name?: unknown
  email?: unknown
  phone?: unknown
  website?: unknown // honeypot
}

interface AppsScriptResponse {
  ok?: boolean
  duplicate?: boolean
  field?: 'email' | 'phone' | 'both'
  error?: string
}

/**
 * Neutralize spreadsheet formula injection (=, +, -, @) for text fields
 * before appending to Google Sheets.
 */
function sanitizeSheetText(value: string): string {
  const trimmed = value.trim()
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`
  }
  return trimmed
}

function formatIstTimestamp(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

export async function POST(request: Request) {
  let body: WaitlistPayload
  try {
    body = (await request.json()) as WaitlistPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }

  // Silently accept honeypot bot submissions without touching the sheet.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const rawName = typeof body.name === 'string' ? body.name : ''
  const rawEmail = typeof body.email === 'string' ? body.email : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''

  const { valid, errors, normalized } = validateWaitlistInput({
    name: rawName,
    email: rawEmail,
    phone: rawPhone,
  })

  if (!valid) {
    const firstField = (Object.keys(errors)[0] as 'name' | 'email' | 'phone' | undefined) ?? 'name'
    return NextResponse.json(
      {
        ok: false,
        field: firstField,
        errors,
        error: errors[firstField] || 'Please check your details and try again.',
      },
      { status: 400 }
    )
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim()
  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Waitlist Google Sheet is not configured yet. Please set GOOGLE_SHEETS_WEBHOOK_URL.',
      },
      { status: 503 }
    )
  }

  const now = new Date()
  const payload = {
    secret: process.env.GOOGLE_SHEETS_WEBHOOK_SECRET?.trim() || undefined,
    timestamp: now.toISOString(),
    istTime: `${formatIstTimestamp(now)} IST`,
    name: sanitizeSheetText(normalized.name),
    email: sanitizeSheetText(normalized.email),
    // Prefix with apostrophe so Google Sheets preserves "+91 ..." as plain text instead of a formula
    phone: `'${normalized.phone}`,
    phoneKey: normalized.phoneKey,
    source: request.headers.get('origin') || 'parsona.live',
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    const text = await res.text()
    let parsed: AppsScriptResponse | null = null
    try {
      parsed = JSON.parse(text) as AppsScriptResponse
    } catch {
      parsed = null
    }

    if (parsed?.duplicate) {
      const dupField = parsed.field ?? 'email'
      const defaultMsg =
        dupField === 'both'
          ? 'This email and WhatsApp number are already on the waitlist.'
          : dupField === 'phone'
            ? 'This WhatsApp number is already on the waitlist.'
            : 'This email address is already on the waitlist.'

      return NextResponse.json(
        {
          ok: false,
          duplicate: true,
          field: dupField,
          error: parsed.error || defaultMsg,
        },
        { status: 409 }
      )
    }

    if (!res.ok || (parsed && parsed.ok === false)) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed?.error || 'Could not save to Google Sheet right now. Please try again.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Network error while saving your spot. Please try again.' },
      { status: 502 }
    )
  }
}
