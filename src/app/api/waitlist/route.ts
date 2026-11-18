import { NextResponse } from 'next/server'

interface WaitlistPayload {
  name?: unknown
  email?: unknown
  phone?: unknown
  website?: unknown // honeypot
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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

  const rawName = typeof body.name === 'string' ? body.name.trim() : ''
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''

  if (rawName.length < 2 || rawName.length > 120) {
    return NextResponse.json(
      { ok: false, field: 'name', error: 'Please enter your full name.' },
      { status: 400 }
    )
  }

  if (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 180) {
    return NextResponse.json(
      { ok: false, field: 'email', error: 'Enter a valid email address.' },
      { status: 400 }
    )
  }

  const phoneDigits = rawPhone.replace(/\D/g, '')
  const phoneValid =
    /^[+\d][\d\s().-]*$/.test(rawPhone) && phoneDigits.length >= 7 && phoneDigits.length <= 15

  if (!phoneValid) {
    return NextResponse.json(
      { ok: false, field: 'phone', error: 'Enter a valid number, e.g. +91 98765 43210.' },
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
    name: sanitizeSheetText(rawName),
    email: sanitizeSheetText(rawEmail),
    // Prefix with apostrophe so Google Sheets preserves "+91 ..." as plain text instead of a formula
    phone: `'${rawPhone}`,
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
    let parsed: { ok?: boolean; error?: string } | null = null
    try {
      parsed = JSON.parse(text) as { ok?: boolean; error?: string }
    } catch {
      parsed = null
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

