import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePhoneKey, validateWaitlistInput } from '@/lib/waitlist-validation'
import { POST } from './route'

const ORIGINAL_ENV = { ...process.env }

function makeRequest(body: unknown, origin = 'https://parsona.live'): Request {
  return new Request('http://localhost:3000/api/waitlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  })
}

describe('waitlist-validation', () => {
  it('normalizes equivalent Indian phone formats to the same canonical key', () => {
    expect(normalizePhoneKey('98765 43210')).toBe('919876543210')
    expect(normalizePhoneKey('09876543210')).toBe('919876543210')
    expect(normalizePhoneKey('+91-98765-43210')).toBe('919876543210')
  })

  it('rejects disposable emails, numeric-only names, and fake Indian mobile numbers', () => {
    const res = validateWaitlistInput({
      name: '123456',
      email: 'fake@mailinator.com',
      phone: '9999999999',
    })
    expect(res.valid).toBe(false)
    expect(res.errors.name).toBeDefined()
    expect(res.errors.email).toBeDefined()
    expect(res.errors.phone).toBeDefined()
  })

  it('rejects Indian mobile numbers not starting with 6-9', () => {
    const res = validateWaitlistInput({
      name: 'Aanya Sharma',
      email: 'aanya@company.in',
      phone: '+91 51234 56789',
    })
    expect(res.valid).toBe(false)
    expect(res.errors.phone).toContain('6, 7, 8, or 9')
  })

  it('accepts valid international numbers with country code', () => {
    const res = validateWaitlistInput({
      name: 'Aanya Sharma',
      email: 'aanya@company.in',
      phone: '+1 415 555 2671',
    })
    expect(res.valid).toBe(true)
    expect(res.normalized.phoneKey).toBe('14155552671')
  })
})

describe('POST /api/waitlist', () => {
  beforeEach(() => {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/test-deploy/exec'
    delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it('validates missing or short name', async () => {
    const res = await POST(
      makeRequest({ name: 'A', email: 'aanya@company.in', phone: '+91 98765 43210' })
    )
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json).toMatchObject({ ok: false, field: 'name' })
  })

  it('validates invalid email address', async () => {
    const res = await POST(
      makeRequest({ name: 'Aanya Sharma', email: 'not-an-email', phone: '+91 98765 43210' })
    )
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json).toMatchObject({ ok: false, field: 'email' })
  })

  it('validates invalid phone number', async () => {
    const res = await POST(
      makeRequest({ name: 'Aanya Sharma', email: 'aanya@company.in', phone: '1234567890' })
    )
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json).toMatchObject({ ok: false, field: 'phone' })
  })

  it('silently accepts honeypot bot submissions without calling Google Sheets', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await POST(
      makeRequest({
        name: 'Bot User',
        email: 'bot@company.in',
        phone: '+91 98765 43210',
        website: 'https://spam.example',
      })
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 503 when GOOGLE_SHEETS_WEBHOOK_URL is not configured', async () => {
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL
    const res = await POST(
      makeRequest({ name: 'Aanya Sharma', email: 'aanya@company.in', phone: '+91 98765 43210' })
    )
    const json = await res.json()
    expect(res.status).toBe(503)
    expect(json.ok).toBe(false)
  })

  it('forwards sanitized waitlist data and phoneKey to Google Sheets', async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = 'top-secret'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const res = await POST(
      makeRequest({
        name: '=HYPERLINK("bad")',
        email: '  Aanya@Company.in ',
        phone: '+91 98765 43210',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
    expect(calledUrl).toBe('https://script.google.com/macros/s/test-deploy/exec')
    expect(calledInit?.method).toBe('POST')
    expect(calledInit?.redirect).toBe('follow')

    const forwarded = JSON.parse(String(calledInit?.body))
    expect(forwarded).toMatchObject({
      secret: 'top-secret',
      name: `'=HYPERLINK("bad")`,
      email: 'aanya@company.in',
      phone: `'+91 98765 43210`,
      phoneKey: '919876543210',
      source: 'https://parsona.live',
    })
    expect(forwarded.istTime).toContain('IST')
    expect(forwarded.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns 409 Conflict when Google Sheets detects duplicate email, phone, or both', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          duplicate: true,
          field: 'phone',
          error: 'This WhatsApp number is already on the waitlist.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const res = await POST(
      makeRequest({ name: 'Aanya Sharma', email: 'new@company.in', phone: '9876543210' })
    )
    const json = await res.json()
    expect(res.status).toBe(409)
    expect(json).toEqual({
      ok: false,
      duplicate: true,
      field: 'phone',
      error: 'This WhatsApp number is already on the waitlist.',
    })
  })

  it('returns 502 when Google Apps Script reports an unexpected error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const res = await POST(
      makeRequest({ name: 'Aanya Sharma', email: 'aanya@company.in', phone: '+91 98765 43210' })
    )
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json).toEqual({ ok: false, error: 'Unauthorized' })
  })
})
