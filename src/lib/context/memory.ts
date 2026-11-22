import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactMemory, MemoryAuthority, MemorySourceType, MemoryStatus } from '@/types'

const AUTHORITY_RANKS: Record<MemoryAuthority, number> = {
  human_business_edit: 5,
  verified_system: 4,
  customer_explicit: 3,
  ai_extracted: 2,
  ai_inferred: 1,
}

export interface UpsertMemoryParams {
  accountId: string
  contactId: string
  memoryKey: string
  memoryValue: string
  valueType?: 'string' | 'number' | 'boolean' | 'json' | 'date'
  sourceType: MemorySourceType
  sourceChannel?: 'whatsapp' | 'instagram' | 'facebook' | 'system' | 'web' | 'other' | null
  sourceMessageId?: string | null
  sourceReference?: string | null
  confidence?: number
  authority?: MemoryAuthority
  expiresAt?: string | null
}

/**
 * Upsert customer memory with strict authority ranking and provenance preservation.
 * A lower-authority source (e.g. ai_inferred) cannot overwrite a higher-authority source (e.g. human edit or customer explicit).
 * When updating an existing fact, the old fact is superseded (never silently deleted) to preserve history.
 */
export async function upsertCustomerMemory(
  db: SupabaseClient,
  params: UpsertMemoryParams,
): Promise<{ success: boolean; memory?: ContactMemory; skippedReason?: string }> {
  const {
    accountId,
    contactId,
    memoryKey,
    memoryValue,
    valueType = 'string',
    sourceType,
    sourceChannel = null,
    sourceMessageId = null,
    sourceReference = null,
    confidence = 1.0,
    authority = sourceType as MemoryAuthority,
    expiresAt = null,
  } = params

  const cleanKey = memoryKey.trim().toLowerCase().replace(/\s+/g, '_')
  const cleanVal = memoryValue.trim()

  if (!cleanKey || !cleanVal) {
    return { success: false, skippedReason: 'Empty memory key or value' }
  }

  // 1. Fetch current active memory for this key (if any)
  const { data: existingRows } = await db
    .from('contact_memories')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('memory_key', cleanKey)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const existing = (existingRows?.[0] as ContactMemory) || null

  // 2. Authority ranking check: prevent AI inference from overwriting human/verified data
  const incomingRank = AUTHORITY_RANKS[authority] || 1
  if (existing) {
    const existingRank = AUTHORITY_RANKS[existing.authority] || 1

    if (existing.memory_value === cleanVal) {
      // Same value: confirm last observed timestamp and exit
      await db
        .from('contact_memories')
        .update({
          last_confirmed_at: new Date().toISOString(),
          confidence: Math.max(existing.confidence, confidence),
        })
        .eq('id', existing.id)
      return { success: true, memory: existing }
    }

    if (incomingRank < existingRank) {
      return {
        success: false,
        skippedReason: `Cannot overwrite authority '${existing.authority}' (rank ${existingRank}) with lower authority '${authority}' (rank ${incomingRank})`,
      }
    }
  }

  // 3. Mark existing active memory as superseded
  let supersedesId: string | null = null
  if (existing) {
    supersedesId = existing.id
    await db
      .from('contact_memories')
      .update({
        status: 'superseded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  }

  // 4. Insert new active memory
  const { data: newRow, error: insertErr } = await db
    .from('contact_memories')
    .insert({
      account_id: accountId,
      contact_id: contactId,
      memory_key: cleanKey,
      memory_value: cleanVal,
      value_type: valueType,
      source_type: sourceType,
      source_channel: sourceChannel,
      source_message_id: sourceMessageId,
      source_reference: sourceReference,
      confidence,
      authority,
      status: 'active',
      first_observed_at: new Date().toISOString(),
      last_confirmed_at: new Date().toISOString(),
      expires_at: expiresAt,
      supersedes_memory_id: supersedesId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[upsertCustomerMemory] Error inserting memory:', insertErr)
    throw insertErr
  }
  if (!newRow) {
    return { success: false, skippedReason: 'No row returned from insert' }
  }

  // 5. Sync into contacts.metadata JSONB for fast indexing & backward compatibility
  const { data: contact } = await db
    .from('contacts')
    .select('metadata')
    .eq('id', contactId)
    .single()

  const currentMeta = (contact?.metadata as Record<string, unknown>) || {}
  await db
    .from('contacts')
    .update({
      metadata: {
        ...currentMeta,
        [cleanKey]: cleanVal,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  return { success: true, memory: newRow as ContactMemory }
}

/**
 * Fetch all active customer memories for a contact.
 */
export async function getActiveCustomerMemories(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
): Promise<ContactMemory[]> {
  const { data, error } = await db
    .from('contact_memories')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .order('authority', { ascending: false })
    .order('last_confirmed_at', { ascending: false })

  if (error) {
    console.error('[getActiveCustomerMemories] Error:', error)
    return []
  }

  return (data || []) as ContactMemory[]
}

/**
 * Delete (soft delete) a customer memory.
 */
export async function deleteCustomerMemory(
  db: SupabaseClient,
  accountId: string,
  memoryId: string,
): Promise<boolean> {
  const { data: mem, error: fetchErr } = await db
    .from('contact_memories')
    .select('contact_id, memory_key')
    .eq('id', memoryId)
    .eq('account_id', accountId)
    .single()

  if (fetchErr || !mem) return false

  const { error } = await db
    .from('contact_memories')
    .update({
      status: 'deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', memoryId)
    .eq('account_id', accountId)

  if (error) return false

  // Remove key from contacts.metadata
  const { data: contact } = await db
    .from('contacts')
    .select('metadata')
    .eq('id', mem.contact_id)
    .single()

  if (contact?.metadata) {
    const nextMeta = { ...(contact.metadata as Record<string, unknown>) }
    delete nextMeta[mem.memory_key]
    await db
      .from('contacts')
      .update({ metadata: nextMeta })
      .eq('id', mem.contact_id)
  }

  return true
}
