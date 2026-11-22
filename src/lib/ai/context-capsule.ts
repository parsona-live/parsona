import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact, Tag } from '@/types'
import { fetchContactActivities } from '@/lib/contacts/timeline'
import { assembleCustomerContext } from '@/lib/context/retriever'

export interface ContactContextCapsule {
  contactId: string
  name: string | null
  phone: string | null
  email: string | null
  socialHandles: {
    whatsapp?: string | null
    instagram?: string | null
    facebook?: string | null
  }
  tags: string[]
  metadata?: Record<string, unknown> | null
  lastSeenChannel: string | null
  lastAction: {
    summary: string | null
    timestamp: string | null
  }
  recentTimeline: Array<{
    channel: string
    eventType: string
    summary: string
    createdAt: string
  }>
  renderedPromptContext: string
}

export interface CapsuleBuildOptions {
  maxActivities?: number
  includeRawTimeline?: boolean
}

/**
 * Build a rich, unified omnichannel context capsule for a contact.
 * Uses hot-path denormalized fields first, then enriches with recent timeline activities.
 */
export async function buildContactContextCapsule(
  db: SupabaseClient,
  contactId: string,
  options: CapsuleBuildOptions = {},
): Promise<ContactContextCapsule | null> {
  const maxActivities = options.maxActivities ?? 10

  // 1. Fetch contact with tags
  const { data: contactData, error: contactErr } = await db
    .from('contacts')
    .select(`
      *,
      contact_tags (
        tags (
          id,
          name,
          color
        )
      )
    `)
    .eq('id', contactId)
    .maybeSingle()

  if (contactErr || !contactData) {
    console.warn(`[buildContactContextCapsule] Contact ${contactId} not found`)
    return null
  }

  const contact = contactData as Contact & {
    contact_tags?: Array<{ tags: Tag | null }>
  }

  const tags: string[] = (contact.contact_tags || [])
    .map((ct) => ct.tags?.name)
    .filter((name): name is string => Boolean(name))

  // 2. Fetch recent timeline events
  const { activities } = await fetchContactActivities(db, contactId, { limit: maxActivities })

  const recentTimeline = activities.map((act) => ({
    channel: act.channel,
    eventType: act.event_type,
    summary: act.summary,
    createdAt: act.created_at,
  }))

  // 3. Assemble Social Handles
  const socialHandles: ContactContextCapsule['socialHandles'] = {}
  if (contact.phone) socialHandles.whatsapp = contact.phone
  if (contact.ig_username) {
    socialHandles.instagram = `@${contact.ig_username.replace(/^@/, '')}`
  } else if (contact.ig_user_id) {
    socialHandles.instagram = `ID:${contact.ig_user_id}`
  }
  if (contact.fb_name) {
    socialHandles.facebook = contact.fb_name
  } else if (contact.fb_page_scoped_id) {
    socialHandles.facebook = `ID:${contact.fb_page_scoped_id}`
  }

  // 4. Render prioritized, verified context block via Customer Context Engine
  let renderedPromptContext: string
  if (contact.account_id) {
    try {
      const assembled = await assembleCustomerContext(db, contact.account_id, contactId)
      renderedPromptContext = assembled?.renderedPromptBlock || renderCapsuleForAiPrompt({
        name: contact.name || null,
        phone: contact.phone || null,
        email: contact.email || null,
        socialHandles,
        tags,
        metadata: contact.metadata || null,
        lastSeenChannel: contact.last_seen_channel || null,
        lastActionSummary: contact.last_action_summary || null,
        lastActionAt: contact.last_action_at || null,
        recentTimeline,
      })
    } catch {
      renderedPromptContext = renderCapsuleForAiPrompt({
        name: contact.name || null,
        phone: contact.phone || null,
        email: contact.email || null,
        socialHandles,
        tags,
        metadata: contact.metadata || null,
        lastSeenChannel: contact.last_seen_channel || null,
        lastActionSummary: contact.last_action_summary || null,
        lastActionAt: contact.last_action_at || null,
        recentTimeline,
      })
    }
  } else {
    renderedPromptContext = renderCapsuleForAiPrompt({
      name: contact.name || null,
      phone: contact.phone || null,
      email: contact.email || null,
      socialHandles,
      tags,
      metadata: contact.metadata || null,
      lastSeenChannel: contact.last_seen_channel || null,
      lastActionSummary: contact.last_action_summary || null,
      lastActionAt: contact.last_action_at || null,
      recentTimeline,
    })
  }

  return {
    contactId,
    name: contact.name || null,
    phone: contact.phone || null,
    email: contact.email || null,
    socialHandles,
    tags,
    metadata: contact.metadata || null,
    lastSeenChannel: contact.last_seen_channel || null,
    lastAction: {
      summary: contact.last_action_summary || null,
      timestamp: contact.last_action_at || null,
    },
    recentTimeline,
    renderedPromptContext,
  }
}

interface RenderParams {
  name: string | null
  phone: string | null
  email: string | null
  socialHandles: {
    whatsapp?: string | null
    instagram?: string | null
    facebook?: string | null
  }
  tags: string[]
  metadata?: Record<string, unknown> | null
  lastSeenChannel: string | null
  lastActionSummary: string | null
  lastActionAt: string | null
  recentTimeline: Array<{
    channel: string
    eventType: string
    summary: string
    createdAt: string
  }>
}

/**
 * Format the capsule into a clean markdown prompt injection.
 */
export function renderCapsuleForAiPrompt(params: RenderParams): string {
  const lines: string[] = ['### Omnichannel Customer Memory & State:']

  if (params.name) lines.push(`- **Name**: ${params.name}`)
  if (params.phone) lines.push(`- **Phone**: ${params.phone}`)
  if (params.email) lines.push(`- **Email**: ${params.email}`)

  const channelParts: string[] = []
  if (params.socialHandles.whatsapp) channelParts.push(`WhatsApp (${params.socialHandles.whatsapp})`)
  if (params.socialHandles.instagram) channelParts.push(`Instagram (${params.socialHandles.instagram})`)
  if (params.socialHandles.facebook) channelParts.push(`Facebook (${params.socialHandles.facebook})`)

  if (channelParts.length > 0) {
    lines.push(`- **Connected Channels**: ${channelParts.join(', ')}`)
  }

  if (params.lastSeenChannel) {
    lines.push(`- **Last Seen Platform**: ${params.lastSeenChannel}`)
  }

  if (params.lastActionSummary) {
    lines.push(`- **Last Action**: ${params.lastActionSummary}`)
  }

  if (params.tags.length > 0) {
    lines.push(`- **Customer Tags**: [${params.tags.join(', ')}]`)
  }

  if (params.metadata && Object.keys(params.metadata).length > 0) {
    lines.push('- **Dynamic Memory & Stored Preferences**:')
    for (const [k, v] of Object.entries(params.metadata)) {
      if (v !== null && v !== undefined && v !== '') {
        const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v)
        lines.push(`  * ${k}: ${valStr}`)
      }
    }
  }

  if (params.recentTimeline.length > 0) {
    lines.push('- **Recent Cross-Channel Activity**:')
    for (const act of params.recentTimeline.slice(0, 6)) {
      lines.push(`  * [${act.channel.toUpperCase()}] ${act.summary}`)
    }
  }

  return lines.join('\n')
}
