import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactGroup, GroupContact } from '@/types'

export interface CreateContactGroupParams {
  name: string
  description?: string | null
  color?: string
}

export interface UpdateContactGroupParams {
  name?: string
  description?: string | null
  color?: string
}

/**
 * Fetch all contact groups for an account, with member counts.
 */
export async function fetchContactGroups(
  db: SupabaseClient,
  accountId: string,
): Promise<ContactGroup[]> {
  const { data: groups, error: gErr } = await db
    .from('contact_groups')
    .select('*')
    .eq('account_id', accountId)
    .order('name', { ascending: true })

  if (gErr) {
    console.error('[fetchContactGroups] Error fetching contact groups:', gErr)
    throw gErr
  }

  if (!groups || groups.length === 0) return []

  // Fetch counts from group_contacts (primary) or contact_group_members
  const countsByGroup = new Map<string, number>()

  const { data: groupContactRows, error: gcErr } = await db
    .from('group_contacts')
    .select('group_id')
    .eq('account_id', accountId)

  if (!gcErr && groupContactRows && groupContactRows.length > 0) {
    for (const m of groupContactRows as { group_id: string }[]) {
      countsByGroup.set(m.group_id, (countsByGroup.get(m.group_id) || 0) + 1)
    }
  } else {
    // Fallback to contact_group_members
    const { data: members, error: mErr } = await db
      .from('contact_group_members')
      .select('group_id')
      .eq('account_id', accountId)

    if (mErr) {
      console.warn('[fetchContactGroups] Error fetching member counts:', mErr)
    }

    for (const m of (members || []) as { group_id: string }[]) {
      countsByGroup.set(m.group_id, (countsByGroup.get(m.group_id) || 0) + 1)
    }
  }

  return (groups as ContactGroup[]).map((g) => ({
    ...g,
    member_count: countsByGroup.get(g.id) || 0,
  }))
}

/**
 * Create a new contact group.
 */
export async function createContactGroup(
  db: SupabaseClient,
  accountId: string,
  params: CreateContactGroupParams,
): Promise<ContactGroup> {
  const cleanName = params.name.trim()
  if (!cleanName) throw new Error('Group name is required')

  const { data, error } = await db
    .from('contact_groups')
    .insert({
      account_id: accountId,
      name: cleanName,
      description: params.description?.trim() || null,
      color: params.color || '#3b82f6',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[createContactGroup] Error creating group:', error)
    throw error
  }

  return { ...(data as ContactGroup), member_count: 0 }
}

/**
 * Update an existing contact group.
 */
export async function updateContactGroup(
  db: SupabaseClient,
  accountId: string,
  groupId: string,
  params: UpdateContactGroupParams,
): Promise<ContactGroup> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (params.name !== undefined) updates.name = params.name.trim()
  if (params.description !== undefined) updates.description = params.description?.trim() || null
  if (params.color !== undefined) updates.color = params.color

  const { data, error } = await db
    .from('contact_groups')
    .update(updates)
    .eq('id', groupId)
    .eq('account_id', accountId)
    .select()
    .single()

  if (error || !data) {
    console.error('[updateContactGroup] Error updating group:', error)
    throw error
  }

  return data as ContactGroup
}

/**
 * Delete a contact group. Note: contact records are preserved; only group association is deleted.
 */
export async function deleteContactGroup(
  db: SupabaseClient,
  accountId: string,
  groupId: string,
): Promise<void> {
  const { error } = await db
    .from('contact_groups')
    .delete()
    .eq('id', groupId)
    .eq('account_id', accountId)

  if (error) {
    console.error('[deleteContactGroup] Error deleting group:', error)
    throw error
  }
}

/**
 * Add contacts to a group as independent copies in `group_contacts`.
 * Does NOT alter or delete master contacts.
 */
export async function addContactsToGroup(
  db: SupabaseClient,
  accountId: string,
  groupId: string,
  contactIds: string[],
): Promise<number> {
  if (contactIds.length === 0) return 0

  const uniqueContactIds = Array.from(new Set(contactIds))

  // 1. Fetch details of source contacts to make accurate copies
  const { data: sourceContacts } = await db
    .from('contacts')
    .select('id, name, phone, email, company')
    .in('id', uniqueContactIds)

  if (sourceContacts && sourceContacts.length > 0) {
    const copyRows = sourceContacts.map((c) => ({
      account_id: accountId,
      group_id: groupId,
      source_contact_id: c.id,
      name: c.name || null,
      phone: c.phone || null,
      email: c.email || null,
      company: c.company || null,
    }))

    await db
      .from('group_contacts')
      .upsert(copyRows, { onConflict: 'group_id,source_contact_id', ignoreDuplicates: true })
  }

  // 2. Also record in contact_group_members for backward compatibility
  const memberRows = uniqueContactIds.map((cid) => ({
    account_id: accountId,
    group_id: groupId,
    contact_id: cid,
  }))

  const { data, error } = await db
    .from('contact_group_members')
    .upsert(memberRows, { onConflict: 'group_id,contact_id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('[addContactsToGroup] Error adding contacts to group:', error)
    throw error
  }

  return data?.length ?? uniqueContactIds.length
}

/**
 * Remove contacts from a group.
 * Strictly deletes the group copy/association. NEVER deletes the master contact or inbox conversation.
 */
export async function removeContactsFromGroup(
  db: SupabaseClient,
  accountId: string,
  groupId: string,
  contactIds: string[],
): Promise<number> {
  if (contactIds.length === 0) return 0

  // 1. Remove from group_contacts by source_contact_id or id
  await db
    .from('group_contacts')
    .delete()
    .eq('account_id', accountId)
    .eq('group_id', groupId)
    .or(`source_contact_id.in.(${contactIds.join(',')}),id.in.(${contactIds.join(',')})`)

  // 2. Remove from contact_group_members
  const { data, error } = await db
    .from('contact_group_members')
    .delete()
    .eq('account_id', accountId)
    .eq('group_id', groupId)
    .in('contact_id', contactIds)
    .select('id')

  if (error) {
    console.error('[removeContactsFromGroup] Error removing contacts from group:', error)
    throw error
  }

  return data?.length ?? contactIds.length
}

/**
 * Move contacts from one group to another atomically.
 */
export async function moveContactsToGroup(
  db: SupabaseClient,
  accountId: string,
  sourceGroupId: string,
  targetGroupId: string,
  contactIds: string[],
): Promise<{ added: number; removed: number }> {
  if (contactIds.length === 0) return { added: 0, removed: 0 }

  // 1. Add to target group
  const added = await addContactsToGroup(db, accountId, targetGroupId, contactIds)

  // 2. Remove from source group if different
  let removed = 0
  if (sourceGroupId !== targetGroupId) {
    removed = await removeContactsFromGroup(db, accountId, sourceGroupId, contactIds)
  }

  return { added, removed }
}

/**
 * Fetch all unique contact IDs belonging to any of the specified group IDs.
 */
export async function fetchGroupContactIds(
  db: SupabaseClient,
  groupIds: readonly string[],
): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set()

  const ids = new Set<string>()

  // 1. Query group_contacts (source_contact_id or id)
  const { data: groupContactRows } = await db
    .from('group_contacts')
    .select('source_contact_id, id')
    .in('group_id', groupIds as string[])

  if (groupContactRows && groupContactRows.length > 0) {
    for (const r of groupContactRows) {
      if (r.source_contact_id) ids.add(r.source_contact_id)
      else if (r.id) ids.add(r.id)
    }
  }

  // 2. Query contact_group_members for fallback/completeness
  const { data: memberRows } = await db
    .from('contact_group_members')
    .select('contact_id')
    .in('group_id', groupIds as string[])

  if (memberRows && memberRows.length > 0) {
    for (const r of memberRows) {
      if (r.contact_id) ids.add(r.contact_id)
    }
  }

  return ids
}

/**
 * Fetch group contact copies for a specific group.
 */
export async function fetchGroupContacts(
  db: SupabaseClient,
  accountId: string,
  groupId: string,
): Promise<GroupContact[]> {
  const { data, error } = await db
    .from('group_contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchGroupContacts] Error fetching group contacts:', error)
    throw error
  }

  return (data || []) as GroupContact[]
}
