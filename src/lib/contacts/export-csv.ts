import type { Contact, Tag } from '@/types'

export interface ExportableContact extends Contact {
  tags?: Tag[]
  groups?: Array<{ name: string }>
}

/**
 * Escape CSV field according to RFC 4180.
 */
function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Convert an array of contacts into CSV text.
 */
export function formatContactsCsv(contacts: ExportableContact[]): string {
  const headers = [
    'Name',
    'Phone',
    'Email',
    'Company',
    'Instagram',
    'Facebook',
    'Tags',
    'Created At',
  ]

  const rows = contacts.map((c) => {
    const ig = c.ig_username ? `@${c.ig_username.replace(/^@/, '')}` : ''
    const fb = c.fb_name || ''
    const tags = (c.tags || []).map((t) => t.name).join('; ')

    return [
      escapeCsvField(c.name || ''),
      escapeCsvField(c.phone || ''),
      escapeCsvField(c.email || ''),
      escapeCsvField(c.company || ''),
      escapeCsvField(ig),
      escapeCsvField(fb),
      escapeCsvField(tags),
      escapeCsvField(c.created_at || ''),
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\r\n')
}

/**
 * Trigger client-side browser download of CSV text.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
