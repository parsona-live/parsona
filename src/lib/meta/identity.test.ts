import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractPhoneAndEmail,
  findContactBySocialId,
  linkSocialIdToContact,
  createSocialContact,
  mergeContacts,
} from './identity'

describe('Identity & Cross-Channel Matching', () => {
  it('extracts phone numbers and emails accurately from text', () => {
    const text = `Hi, I saw your post on Instagram! My WhatsApp number is +1 (555) 234-5678 and my email is test.user@example.com. Please send catalog!`
    const { phones, emails } = extractPhoneAndEmail(text)

    expect(phones).toContain('15552345678')
    expect(emails).toContain('test.user@example.com')
  })

  it('extracts Indian 10-digit phone numbers and international formats', () => {
    const text = `You can reach me at 9876543210 or +91 9123456789. Thanks!`
    const { phones } = extractPhoneAndEmail(text)

    expect(phones).toContain('9876543210')
    expect(phones).toContain('919123456789')
  })

  it('rejects short numbers like order IDs and zip codes', () => {
    const text = `Order #12345 placed on 2026-05-12 with zip 90210.`
    const { phones } = extractPhoneAndEmail(text)

    expect(phones).toHaveLength(0)
  })

  it('links social ID to existing contact', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'c1', ig_user_id: 'ig_999', ig_username: 'janedoe' },
              error: null,
            }),
          }),
        }),
      }),
    })

    const db = {
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    } as unknown as Parameters<typeof linkSocialIdToContact>[0]

    const updated = await linkSocialIdToContact(db, 'acc_1', 'c1', {
      channel: 'instagram',
      socialId: 'ig_999',
      username: '@janedoe',
    })

    expect(updated?.ig_user_id).toBe('ig_999')
    expect(updated?.ig_username).toBe('janedoe')
  })

  it('merges secondary contact into primary contact', async () => {
    const primary = { id: 'p1', account_id: 'acc_1', phone: '15552345678', email: null, ig_user_id: null }
    const secondary = { id: 's2', account_id: 'acc_1', phone: '', email: 'jane@example.com', ig_user_id: 'ig_777' }

    const updateCalls: Record<string, unknown>[] = []
    const deletedIds: string[] = []

    const db = {
      from: vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: val === 'p1' ? primary : secondary,
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn((payload) => {
              updateCalls.push({ table, payload })
              return {
                eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
              }
            }),
            delete: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => {
                deletedIds.push(val)
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
              }),
            })),
          }
        }
        if (table === 'conversations' || table === 'contact_notes') {
          return {
            update: vi.fn((payload) => {
              updateCalls.push({ table, payload })
              return {
                eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
              }
            }),
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof mergeContacts>[0]

    const result = await mergeContacts(db, 'acc_1', 'p1', 's2')

    expect(result).toBe(true)
    // Primary updated with secondary's email and ig_user_id
    const contactUpdate = updateCalls.find((c) => c.table === 'contacts')
    expect(contactUpdate?.payload).toMatchObject({
      email: 'jane@example.com',
      ig_user_id: 'ig_777',
    })
    // Conversations reparented
    const convUpdate = updateCalls.find((c) => c.table === 'conversations')
    expect(convUpdate?.payload).toEqual({ contact_id: 'p1' })
    // Secondary deleted
    expect(deletedIds).toContain('s2')
  })
})
