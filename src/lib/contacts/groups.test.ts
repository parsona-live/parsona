import { describe, it, expect, vi } from 'vitest'
import {
  fetchContactGroups,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
  addContactsToGroup,
  removeContactsFromGroup,
  moveContactsToGroup,
  fetchGroupContactIds,
  fetchGroupContacts,
} from './groups'

describe('Contact Groups Service', () => {
  it('fetchContactGroups fetches groups and aggregates member counts', async () => {
    const mockGroups = [
      { id: 'g1', account_id: 'acc1', name: 'VIP Leads', color: '#3b82f6' },
      { id: 'g2', account_id: 'acc1', name: 'Follow-ups', color: '#10b981' },
    ]
    const mockGroupContacts = [
      { group_id: 'g1' },
      { group_id: 'g1' },
      { group_id: 'g2' },
    ]

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'contact_groups') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: mockGroups, error: null }),
              })),
            })),
          }
        }
        if (table === 'group_contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: mockGroupContacts, error: null }),
            })),
          }
        }
        return {}
      }),
    } as any

    const result = await fetchContactGroups(mockDb, 'acc1')
    expect(result).toHaveLength(2)
    expect(result.find((g) => g.id === 'g1')?.member_count).toBe(2)
    expect(result.find((g) => g.id === 'g2')?.member_count).toBe(1)
  })

  it('createContactGroup trims name and inserts new group', async () => {
    const mockDb = {
      from: vi.fn(() => ({
        insert: vi.fn((payload) => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'g_new', ...payload },
              error: null,
            }),
          })),
        })),
      })),
    } as any

    const group = await createContactGroup(mockDb, 'acc1', {
      name: '  Solar November  ',
      color: '#f59e0b',
    })

    expect(group.id).toBe('g_new')
    expect(group.name).toBe('Solar November')
    expect(group.color).toBe('#f59e0b')
    expect(group.member_count).toBe(0)
  })

  it('addContactsToGroup copies contacts into group_contacts and records membership', async () => {
    const mockContacts = [
      { id: 'c1', name: 'Alice', phone: '111', email: 'a@test.com', company: 'Acme' },
      { id: 'c2', name: 'Bob', phone: '222', email: 'b@test.com', company: 'Beta' },
    ]
    const mockGroupContactsUpsert = vi.fn().mockResolvedValue({ error: null })
    const mockMemberUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'm1' }, { id: 'm2' }], error: null }),
    })

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: mockContacts, error: null }),
            })),
          }
        }
        if (table === 'group_contacts') {
          return {
            upsert: mockGroupContactsUpsert,
          }
        }
        if (table === 'contact_group_members') {
          return {
            upsert: mockMemberUpsert,
          }
        }
        return {}
      }),
    } as any

    const added = await addContactsToGroup(mockDb, 'acc1', 'g1', ['c1', 'c2'])
    expect(added).toBe(2)
    expect(mockGroupContactsUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: 'acc1',
          group_id: 'g1',
          source_contact_id: 'c1',
          name: 'Alice',
          phone: '111',
        }),
      ]),
      expect.any(Object),
    )
  })

  it('removeContactsFromGroup deletes from group_contacts and members without deleting contacts', async () => {
    const mockGcDelete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    }))
    const mockCgmDelete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            select: vi.fn().mockResolvedValue({ data: [{ id: 'm1' }], error: null }),
          })),
        })),
      })),
    }))

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'group_contacts') {
          return { delete: mockGcDelete }
        }
        if (table === 'contact_group_members') {
          return { delete: mockCgmDelete }
        }
        return {}
      }),
    } as any

    const removed = await removeContactsFromGroup(mockDb, 'acc1', 'g1', ['c1'])
    expect(removed).toBe(1)
    expect(mockGcDelete).toHaveBeenCalled()
    expect(mockCgmDelete).toHaveBeenCalled()
    // Notice mockDb.from('contacts') was NOT called to delete!
    expect(mockDb.from).not.toHaveBeenCalledWith('contacts')
  })

  it('fetchGroupContacts returns group contacts copy records', async () => {
    const mockGroupContacts = [
      { id: 'gc1', name: 'Alice', phone: '111', group_id: 'g1' },
      { id: 'gc2', name: 'Bob', phone: '222', group_id: 'g1' },
    ]

    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockGroupContacts, error: null }),
            })),
          })),
        })),
      })),
    } as any

    const list = await fetchGroupContacts(mockDb, 'acc1', 'g1')
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe('gc1')
  })

  it('fetchGroupContactIds returns Set of contact IDs from group_contacts and members', async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === 'group_contacts') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [{ source_contact_id: 'c1', id: 'gc1' }],
                error: null,
              }),
            })),
          }
        }
        if (table === 'contact_group_members') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [{ contact_id: 'c2' }],
                error: null,
              }),
            })),
          }
        }
        return {}
      }),
    } as any

    const ids = await fetchGroupContactIds(mockDb, ['g1'])
    expect(ids.has('c1')).toBe(true)
    expect(ids.has('c2')).toBe(true)
    expect(ids.size).toBe(2)
  })
})
