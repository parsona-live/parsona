import type { SupabaseClient } from '@supabase/supabase-js'

export interface DeleteConversationOptions {
  deleteContact?: boolean
}

export interface DeleteConversationResult {
  success: boolean
  conversationId: string
  contactId: string
  contactDeleted: boolean
  unlinkedCount: number
}

/**
 * Safely delete a conversation, unlinking any connected contacts
 * and optionally deleting the contact record.
 */
export async function deleteConversation(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
  options: DeleteConversationOptions = {},
): Promise<DeleteConversationResult> {
  // 1. Fetch conversation to verify ownership and get contact_id
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('id, contact_id, channel')
    .eq('id', conversationId)
    .eq('account_id', accountId)
    .single()

  if (convErr || !conv) {
    throw new Error('Conversation not found or access denied')
  }

  const contactId = conv.contact_id

  // 2. Fetch contact to check its linked relationships and canonical root
  let rootPrimaryId: string | null = null
  if (contactId) {
    const { data: contactRow } = await db
      .from('contacts')
      .select('id, linked_contact_id')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle()

    if (contactRow?.linked_contact_id) {
      rootPrimaryId = contactRow.linked_contact_id
    }
  }

  // 3. Delete messages for this conversation
  await db
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)

  // 4. Delete the conversation record
  const { error: delConvErr } = await db
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('account_id', accountId)

  if (delConvErr) throw delConvErr

  // 5. If deleteContact requested, preserve persistent identities and memories before deleting contact
  let contactDeleted = false
  if (options.deleteContact && contactId) {
    // If this contact was linked to a primary contact, re-anchor its identities and memories to the root primary
    if (rootPrimaryId) {
      await db
        .from('contact_identities')
        .update({ contact_id: rootPrimaryId, updated_at: new Date().toISOString() })
        .eq('contact_id', contactId)
        .eq('account_id', accountId)

      await db
        .from('contact_memories')
        .update({ contact_id: rootPrimaryId, updated_at: new Date().toISOString() })
        .eq('contact_id', contactId)
        .eq('account_id', accountId)
    }

    // Re-link any children that were pointing to this contact so they don't become orphaned
    const { data: linkedChildren } = await db
      .from('contacts')
      .select('id')
      .eq('account_id', accountId)
      .eq('linked_contact_id', contactId)

    if (linkedChildren && linkedChildren.length > 0) {
      const newParentId = rootPrimaryId || (linkedChildren[0].id !== contactId ? linkedChildren[0].id : null)
      await db
        .from('contacts')
        .update({ linked_contact_id: newParentId, updated_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('linked_contact_id', contactId)
    }

    // Delete contact notes & tags first
    await db.from('contact_notes').delete().eq('contact_id', contactId)
    await db.from('contact_tags').delete().eq('contact_id', contactId)
    await db.from('deals').delete().eq('contact_id', contactId)

    const { error: delContactErr } = await db
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('account_id', accountId)

    if (!delContactErr) {
      contactDeleted = true
    }
  }

  return {
    success: true,
    conversationId,
    contactId,
    contactDeleted,
    unlinkedCount: 0,
  }
}

/**
 * Clear all messages in a conversation without deleting the conversation or contact.
 */
export async function clearConversationMessages(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
): Promise<{ success: boolean; conversationId: string; clearedMessageCount: number }> {
  // 1. Verify conversation ownership
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('account_id', accountId)
    .single()

  if (convErr || !conv) {
    throw new Error('Conversation not found or access denied')
  }

  // 2. Count & delete messages
  const { data: msgs } = await db
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)

  const count = msgs?.length || 0

  await db
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)

  // 3. Reset conversation metadata
  await db
    .from('conversations')
    .update({
      last_message_text: null,
      last_message_at: null,
      last_inbound_at: null,
      last_reply_at: null,
      unread_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('account_id', accountId)

  return {
    success: true,
    conversationId,
    clearedMessageCount: count,
  }
}
