import { describe, it, expect, vi } from 'vitest'
import {
  normalizeEmail,
  normalizePhone,
  normalizeInstagramHandle,
  resolveLinkedContacts,
  resolveCustomerIdentities,
} from './resolver'

describe('Customer & Identity Resolver', () => {
  describe('Normalization Helpers', () => {
    it('normalizes emails cleanly', () => {
      expect(normalizeEmail('  Yash@Example.com ')).toBe('yash@example.com')
      expect(normalizeEmail('invalid-email')).toBeNull()
      expect(normalizeEmail(null)).toBeNull()
    })

    it('normalizes phone numbers to standard format', () => {
      expect(normalizePhone('+91 98765-43210')).toBe('+919876543210')
      expect(normalizePhone('919876543210')).toBe('+919876543210')
      expect(normalizePhone('123')).toBeNull()
      expect(normalizePhone(null)).toBeNull()
    })

    it('normalizes Instagram handles by stripping @ and lowercasing', () => {
      expect(normalizeInstagramHandle('@YashTupkar')).toBe('yashtupkar')
      expect(normalizeInstagramHandle('yashtupkar')).toBe('yashtupkar')
      expect(normalizeInstagramHandle('@@@yashtupkar')).toBe('yashtupkar')
      expect(normalizeInstagramHandle('')).toBeNull()
      expect(normalizeInstagramHandle(null)).toBeNull()
    })
  })

  describe('resolveLinkedContacts (Safe Graph Traversal)', () => {
    it('resolves primary contact and multi-hop linked contacts without infinite loops', async () => {
      const c1 = { id: 'c1', account_id: 'acc1', name: 'Yash', linked_contact_id: 'c2' }
      const c2 = { id: 'c2', account_id: 'acc1', name: 'Yash IG', linked_contact_id: 'c3' }
      const c3 = { id: 'c3', account_id: 'acc1', name: 'Yash Root', linked_contact_id: null }

      const mockDb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn((col: string, ids: string[]) => {
                const data = [c1, c2, c3].filter((c) => ids.includes(c.id))
                return Promise.resolve({ data, error: null })
              }),
            })),
          })),
        })),
      } as any

      const result = await resolveLinkedContacts(mockDb, 'acc1', 'c1')
      expect(result.primaryContact.id).toBe('c3') // c3 is root (no linked_contact_id)
      expect(result.allContacts.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3'])
    })

    it('handles circular references safely without hanging', async () => {
      // Circular: c1 -> c2 and c2 -> c1
      const c1 = { id: 'c1', account_id: 'acc1', name: 'Yash 1', linked_contact_id: 'c2' }
      const c2 = { id: 'c2', account_id: 'acc1', name: 'Yash 2', linked_contact_id: 'c1' }

      const mockDb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn((col: string, ids: string[]) => {
                const data = [c1, c2].filter((c) => ids.includes(c.id))
                return Promise.resolve({ data, error: null })
              }),
            })),
          })),
        })),
      } as any

      const result = await resolveLinkedContacts(mockDb, 'acc1', 'c1')
      expect(result.allContacts.length).toBe(2)
    })
  })

  describe('resolveCustomerIdentities', () => {
    it('merges cross-channel identities across contact rows and contact_identities', async () => {
      const primaryContact = {
        id: 'contact_wa',
        account_id: 'acc1',
        name: 'Yash Sharma',
        phone: '+919876543210',
        email: 'yash@parsona.ai',
        company: 'Parsona AI',
        last_seen_channel: 'whatsapp',
        linked_contact_id: null,
      }

      const linkedContact = {
        id: 'contact_ig',
        account_id: 'acc1',
        name: 'Yash Instagram',
        ig_username: 'yashtupkar',
        linked_contact_id: 'contact_wa',
      }

      const contactIdentities = [
        {
          id: 'ci_1',
          account_id: 'acc1',
          contact_id: 'contact_ig',
          channel: 'instagram',
          external_id: 'ig_12345',
          external_username: 'yashtupkar',
          identity_status: 'verified',
        },
      ]

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === 'contacts') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn((col: string, ids: string[]) => {
                    const data = [primaryContact, linkedContact].filter((c) => ids.includes(c.id))
                    return Promise.resolve({ data, error: null })
                  }),
                })),
              })),
            }
          }
          if (table === 'contact_identities') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    neq: vi.fn().mockResolvedValue({ data: contactIdentities, error: null }),
                  })),
                })),
              })),
            }
          }
          return {
            select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
          }
        }),
      } as any

      const result = await resolveCustomerIdentities(mockDb, 'acc1', 'contact_wa', {
        currentChannel: 'instagram',
      })

      expect(result).not.toBeNull()
      expect(result?.primaryName).toBe('Yash Sharma')
      expect(result?.primaryCompany).toBe('Parsona AI')
      expect(result?.socialHandles.whatsapp).toBe('+919876543210')
      expect(result?.socialHandles.instagram).toBe('@yashtupkar')
      expect(result?.currentChannelIdentity?.channel).toBe('instagram')
      expect(result?.currentChannelIdentity?.value).toBe('@yashtupkar')
      expect(result?.currentChannelIdentity?.verificationStatus).toBe('verified')
    })

    it('detects conflicting identities instead of silently guessing', async () => {
      const c1 = {
        id: 'c1',
        account_id: 'acc1',
        name: 'Yash Sharma',
        email: 'yash@parsona.ai',
        linked_contact_id: null,
      }
      const c2 = {
        id: 'c2',
        account_id: 'acc1',
        name: 'Yash Personal',
        email: 'yash.other@gmail.com',
        linked_contact_id: 'c1',
      }

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === 'contacts') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn((col: string, ids: string[]) => {
                    const data = [c1, c2].filter((c) =>
                      col === 'linked_contact_id' ? ids.includes(c.linked_contact_id!) : ids.includes(c.id),
                    )
                    return Promise.resolve({ data, error: null })
                  }),
                })),
              })),
            }
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  neq: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          }
        }),
      } as any

      const result = await resolveCustomerIdentities(mockDb, 'acc1', 'c1')
      expect(result?.conflicts.some((c) => c.field === 'email')).toBe(true)
    })
  })
})
