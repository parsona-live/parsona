import { describe, it, expect, vi } from 'vitest'
import { deleteConversation, clearConversationMessages } from './conversation-delete'

function createMockDb(initialData: {
  conv?: { id: string; contact_id: string; channel: string } | null
  linkedContacts?: { id: string }[]
}) {
  const operations: string[] = []

  const db: any = {
    from: (table: string) => {
      operations.push(`from:${table}`)
      const queryBuilder: any = {
        select: (cols: string) => {
          operations.push(`select:${table}:${cols}`)
          return queryBuilder
        },
        delete: () => {
          operations.push(`delete:${table}`)
          return queryBuilder
        },
        update: (values: any) => {
          operations.push(`update:${table}:${JSON.stringify(values)}`)
          return queryBuilder
        },
        eq: (col: string, val: any) => {
          operations.push(`eq:${table}:${col}=${val}`)
          return queryBuilder
        },
        maybeSingle: async () => {
          if (table === 'conversations') {
            if (!initialData.conv) return { data: null, error: new Error('not found') }
            return { data: initialData.conv, error: null }
          }
          if (table === 'contacts') {
            return { data: { id: initialData.conv?.contact_id, linked_contact_id: 'root_primary_123' }, error: null }
          }
          return { data: null, error: null }
        },
        single: async () => {
          if (table === 'conversations') {
            if (!initialData.conv) return { data: null, error: new Error('not found') }
            return { data: initialData.conv, error: null }
          }
          return { data: null, error: null }
        },
      }
      queryBuilder.then = (resolve: any) => {
        if (table === 'contacts' && operations.includes('select:contacts:id')) {
          resolve({ data: initialData.linkedContacts ?? [], error: null })
        } else {
          resolve({ data: null, error: null })
        }
      }
      return queryBuilder
    },
  }

  return { db, operations }
}

describe('deleteConversation', () => {
  it('throws an error if conversation is not found', async () => {
    const { db } = createMockDb({ conv: null })
    await expect(deleteConversation(db, 'acc_1', 'conv_missing')).rejects.toThrow(
      'Conversation not found or access denied'
    )
  })

  it('deletes messages and conversation without unlinking or deleting contact by default', async () => {
    const { db, operations } = createMockDb({
      conv: { id: 'conv_123', contact_id: 'contact_456', channel: 'facebook' },
      linkedContacts: [{ id: 'contact_789' }],
    })

    const result = await deleteConversation(db, 'acc_1', 'conv_123', { deleteContact: false })

    expect(result.success).toBe(true)
    expect(result.conversationId).toBe('conv_123')
    expect(result.contactId).toBe('contact_456')
    expect(result.contactDeleted).toBe(false)
    expect(result.unlinkedCount).toBe(0)

    expect(operations).toContain('delete:messages')
    expect(operations).toContain('delete:conversations')
    expect(operations).not.toContain('delete:contacts')
  })

  it('deletes the contact and its associations if deleteContact: true', async () => {
    const { db, operations } = createMockDb({
      conv: { id: 'conv_123', contact_id: 'contact_456', channel: 'facebook' },
      linkedContacts: [],
    })

    const result = await deleteConversation(db, 'acc_1', 'conv_123', { deleteContact: true })

    expect(result.success).toBe(true)
    expect(result.contactDeleted).toBe(true)
    expect(operations).toContain('delete:contact_notes')
    expect(operations).toContain('delete:contact_tags')
    expect(operations).toContain('delete:deals')
    expect(operations).toContain('delete:contacts')
  })
})

describe('clearConversationMessages', () => {
  it('clears messages and resets conversation metadata', async () => {
    const { db, operations } = createMockDb({
      conv: { id: 'conv_123', contact_id: 'contact_456', channel: 'whatsapp' },
    })

    const result = await clearConversationMessages(db, 'acc_1', 'conv_123')

    expect(result.success).toBe(true)
    expect(result.conversationId).toBe('conv_123')
    expect(operations).toContain('delete:messages')
    expect(operations.some((op) => op.startsWith('update:conversations:'))).toBe(true)
  })
})

