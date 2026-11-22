import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractPhoneAndEmail,
  extractNameFromText,
  findContactBySocialId,
  findCanonicalContactByIdentity,
  upsertContactIdentity,
  linkSocialIdToContact,
  createSocialContact,
  mergeContacts,
  linkContacts,
  unlinkContact,
  getLinkedContacts,
} from './identity'

describe('Identity & Cross-Channel Matching', () => {
  it('extracts customer name accurately from conversational text', () => {
    expect(extractNameFromText('My name is Sultan Alam, email me')).toBe('Sultan Alam')
    expect(extractNameFromText('Hi, I am Bhumika Akotkar and my phone is 9876543210')).toBe('Bhumika Akotkar')
    expect(extractNameFromText("Hello, I'm John Doe.")).toBe('John Doe')
    expect(extractNameFromText('Name: Jane Smith\nEmail: jane@test.com')).toBe('Jane Smith')
    expect(extractNameFromText('This is Robert Taylor, please help')).toBe('Robert Taylor')
    expect(extractNameFromText('Just wondering about pricing')).toBeNull()
  })

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
              const callObj: { table: string; payload: any; id?: string } = { table, payload }
              updateCalls.push(callObj)
              return {
                eq: vi.fn((col: string, val: string) => {
                  if (col === 'id') callObj.id = val
                  return { eq: vi.fn().mockResolvedValue({ error: null }) }
                }),
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
              const callObj: { table: string; payload: any; id?: string } = { table, payload }
              updateCalls.push(callObj)
              return {
                eq: vi.fn((col: string, val: string) => {
                  if (col === 'id') callObj.id = val
                  return { eq: vi.fn().mockResolvedValue({ error: null }) }
                }),
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
    const contactUpdate = updateCalls.find((c) => c.table === 'contacts' && c.id === 'p1')
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

  it('links two contacts non-destructively without deleting either contact', async () => {
    const contactA = { id: 'c_wa', account_id: 'acc_1', name: 'John Doe', phone: '15551234567' }
    const contactB = { id: 'c_fb', account_id: 'acc_1', name: 'John Doe (FB)', fb_page_scoped_id: 'psid_1' }

    const updatePayloads: Record<string, unknown>[] = []

    const db = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((col: string, val: string) => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: val === 'c_wa' ? contactA : contactB,
                error: null,
              }),
            })),
          })),
        })),
        update: vi.fn((payload) => {
          updatePayloads.push(payload)
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: payload?.linked_contact_id ? { ...contactB, ...payload } : { ...contactA, ...payload },
                    error: null,
                  }),
                })),
              })),
            })),
          }
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })),
    } as unknown as Parameters<typeof linkContacts>[0]

    const result = await linkContacts(db, 'acc_1', 'c_wa', 'c_fb')

    expect(result.primary.id).toBe('c_wa')
    expect(result.secondary.id).toBe('c_fb')
    expect(updatePayloads[0]).toMatchObject({
      linked_contact_id: 'c_wa',
    })
  })

  it('unlinks a contact cleanly', async () => {
    let unlinkedPayload: Record<string, unknown> | null = null

    const db = {
      from: vi.fn(() => ({
        update: vi.fn((payload) => {
          unlinkedPayload = payload
          return {
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          }
        }),
      })),
    } as unknown as Parameters<typeof unlinkContact>[0]

    const success = await unlinkContact(db, 'acc_1', 'c_fb')

    expect(success).toBe(true)
    expect(unlinkedPayload).toMatchObject({
      linked_contact_id: null,
    })
  })

  it('finds canonical contact from persistent contact_identities even after channel contact deletion', async () => {
    const mockDb: any = {
      from: vi.fn((table: string) => {
        if (table === 'contact_identities') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { contact_id: 'primary_wa_123' },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'primary_wa_123',
                      name: 'Yash Tupkar',
                      phone: '+917898297769',
                      avatar_url: 'https://igcdn.com/avatar.jpg',
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    }

    const contact = await findCanonicalContactByIdentity(mockDb, 'acc_1', 'instagram', '1784140099')

    expect(contact).not.toBeNull()
    expect(contact?.id).toBe('primary_wa_123')
    expect(contact?.phone).toBe('+917898297769')
    expect(contact?.name).toBe('Yash Tupkar')
  })

  it('upserts contact identity mapping to contact_identities', async () => {
    let upsertPayload: Record<string, unknown> | null = null
    const mockDb: any = {
      from: vi.fn((table: string) => ({
        upsert: vi.fn((payload: any) => {
          upsertPayload = payload
          return Promise.resolve({ error: null })
        }),
      })),
    }

    await upsertContactIdentity(mockDb, {
      accountId: 'acc_1',
      contactId: 'primary_wa_123',
      channel: 'instagram',
      externalId: '1784140099',
      externalUsername: 'yashtupkar',
      displayName: 'Yash Tupkar',
      avatarUrl: 'https://igcdn.com/avatar.jpg',
      phone: '+917898297769',
    })

    expect(upsertPayload).not.toBeNull()
    expect(upsertPayload).toMatchObject({
      account_id: 'acc_1',
      contact_id: 'primary_wa_123',
      channel: 'instagram',
      external_id: '1784140099',
      external_username: 'yashtupkar',
      display_name: 'Yash Tupkar',
      avatar_url: 'https://igcdn.com/avatar.jpg',
      phone: '+917898297769',
      identity_status: 'verified',
    })
  })
})
