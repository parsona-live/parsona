import { describe, it, expect } from 'vitest'
import {
  extractFlowTriggerDirective,
  sanitizeAiReply,
  buildSystemPrompt,
} from './defaults'
import { buildContextualQuery, latestUserMessage } from './query'
import type { FlowCatalogItem } from '@/lib/flows/types'

describe('AI Agent - Flow Awareness & Context Grounding', () => {
  describe('extractFlowTriggerDirective', () => {
    it('extracts flow trigger directive and strips it from client text', () => {
      const rawText = 'Bilkul! Chaliye aapka appointment slot book karte hain. [TRIGGER_FLOW: appointment_booking]'
      const { cleanText, triggeredFlow } = extractFlowTriggerDirective(rawText)

      expect(triggeredFlow).toBe('appointment_booking')
      expect(cleanText).toBe('Bilkul! Chaliye aapka appointment slot book karte hain.')
    })

    it('extracts UUID-based flow id correctly', () => {
      const rawText = 'Sure, let me open our pricing calculator. [TRIGGER_FLOW: 550e8400-e29b-41d4-a716-446655440000]'
      const { cleanText, triggeredFlow } = extractFlowTriggerDirective(rawText)

      expect(triggeredFlow).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(cleanText).toBe('Sure, let me open our pricing calculator.')
    })

    it('returns null triggeredFlow when no directive is present', () => {
      const rawText = 'Humare working hours Monday se Friday 9 AM se 6 PM tak hain.'
      const { cleanText, triggeredFlow } = extractFlowTriggerDirective(rawText)

      expect(triggeredFlow).toBeNull()
      expect(cleanText).toBe(rawText)
    })
  })

  describe('sanitizeAiReply', () => {
    it('strips accidental residual TRIGGER_FLOW tags', () => {
      const text = 'Here is the information [TRIGGER_FLOW: book_flow]'
      const cleaned = sanitizeAiReply(text)
      expect(cleaned).toBe('Here is the information')
      expect(cleaned).not.toContain('[TRIGGER_FLOW:')
    })
  })

  describe('buildContextualQuery', () => {
    it('returns direct user message when substantive (>= 5 words)', () => {
      const messages = [
        { role: 'user' as const, content: 'What are the charges for website development service?' },
      ]
      expect(buildContextualQuery(messages)).toBe('What are the charges for website development service?')
    })

    it('synthesizes context for short follow-ups like "Book" or "Yes"', () => {
      const messages = [
        { role: 'user' as const, content: 'Hi mujhe appointment slot chahiye tha' },
        { role: 'assistant' as const, content: 'Yash, appointment book karne ke liye kya time theek rahega?' },
        { role: 'user' as const, content: 'Book' },
      ]
      const contextual = buildContextualQuery(messages)
      expect(contextual).toContain('Book')
      expect(contextual).toContain('appointment book')
    })
  })

  describe('buildSystemPrompt with Flow Catalog', () => {
    it('injects active flows and critical flow triggering protocol into prompt', () => {
      const flows: FlowCatalogItem[] = [
        {
          id: 'flow-apt-123',
          name: 'Appointment Booking',
          description: 'Schedules consultation slots',
          triggerType: 'ai_intent',
          triggerSummary: 'AI Intent: "booking". Trigger phrases: book, slot, appointment',
        },
      ]

      const prompt = buildSystemPrompt({
        mode: 'auto_reply',
        flows,
      })

      expect(prompt).toContain('ACTIVE BUSINESS FLOWS & AUTOMATIONS:')
      expect(prompt).toContain('Flow "Appointment Booking" (ID: flow-apt-123)')
      expect(prompt).toContain('CRITICAL FLOW TRIGGERING PROTOCOL:')
      expect(prompt).toContain('[TRIGGER_FLOW: <flow_id_or_name>]')
    })
  })
})
