import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
      makeRequest({ name: 'A', email: 'aanya@example.com', phone: '+91 98765 43210' })
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
      makeRequest({ name: 'Aanya Sharma', email: 'aanya@example.com', phone: '123' })
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
        email: 'bot@spam.com',
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
      makeRequest({ name: 'Aanya Sharma', email: 'aanya@example.com', phone: '+91 98765 43210' })
    )
    const json = await res.json()
    expect(res.status).toBe(503)
    expect(json.ok).toBe(false)
  })

  it('forwards sanitized waitlist data to Google Sheets and preserves +91 phone as plain text', async () => {
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
        email: '  Aanya@Company.com ',
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
      email: 'aanya@company.com',
      phone: `'+91 98765 43210`,
      source: 'https://parsona.live',
    })
    expect(forwarded.istTime).toContain('IST')
    expect(forwarded.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns 502 when Google Apps Script reports an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const res = await POST(
      makeRequest({ name: 'Aanya Sharma', email: 'aanya@example.com', phone: '+91 98765 43210' })
    )
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json).toEqual({ ok: false, error: 'Unauthorized' })
  })
})

