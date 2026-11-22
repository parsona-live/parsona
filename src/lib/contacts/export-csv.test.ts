import { describe, it, expect } from 'vitest'
import { formatContactsCsv } from './export-csv'

describe('formatContactsCsv', () => {
  it('formats contacts into valid CSV with headers and escaped fields', () => {
    const contacts = [
      {
        id: 'c1',
        name: 'Yash Sharma',
        phone: '+919876543210',
        email: 'yash@example.com',
        company: 'Parsona AI, Inc.',
        ig_username: 'yashtupkar',
        fb_name: 'Yash Sharma',
        tags: [{ id: 't1', name: 'VIP', color: '#fff', created_at: '', user_id: '' }],
        created_at: '2026-11-20T10:00:00Z',
      },
    ] as any

    const csv = formatContactsCsv(contacts)
    expect(csv).toContain('Name,Phone,Email,Company,Instagram,Facebook,Tags,Created At')
    expect(csv).toContain('"Yash Sharma"')
    expect(csv).toContain('"+919876543210"')
    expect(csv).toContain('"Parsona AI, Inc."') // Escaped quotes for comma
    expect(csv).toContain('"@yashtupkar"')
    expect(csv).toContain('"VIP"')
  })

  it('handles empty and null fields without throwing', () => {
    const contacts = [
      {
        id: 'c2',
        name: null,
        phone: null,
        email: null,
      },
    ] as any

    const csv = formatContactsCsv(contacts)
    expect(csv).toContain('""')
  })
})
