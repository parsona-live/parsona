import { describe, it, expect } from 'vitest'
import {
  parseAiPersona,
  injectAiPersona,
  buildSystemPrompt,
  DEFAULT_AI_PERSONA,
} from './defaults'

describe('parseAiPersona & injectAiPersona', () => {
  it('returns default persona when no tag is present', () => {
    const { persona, cleanPrompt } = parseAiPersona('Just normal instructions')
    expect(persona).toEqual(DEFAULT_AI_PERSONA)
    expect(cleanPrompt).toBe('Just normal instructions')
  })

  it('parses valid persona tag and strips it from cleanPrompt', () => {
    const raw =
      '[AI Persona: language=hinglish, tone=casual, length=short]\n\nReply as friendly team member.'
    const { persona, cleanPrompt } = parseAiPersona(raw)
    expect(persona).toEqual({
      language: 'hinglish',
      tone: 'casual',
      responseLength: 'short',
    })
    expect(cleanPrompt).toBe('Reply as friendly team member.')
  })

  it('injects persona tag correctly', () => {
    const injected = injectAiPersona('My prompt', {
      language: 'hinglish',
      tone: 'friendly',
      responseLength: 'balanced',
    })
    expect(injected).toBe(
      '[AI Persona: language=hinglish, tone=friendly, length=balanced]\n\nMy prompt',
    )
  })

  it('replaces existing tag when re-injected', () => {
    const original =
      '[AI Persona: language=english, tone=professional, length=detailed]\n\nOld prompt'
    const updated = injectAiPersona(original, {
      language: 'hindi',
      tone: 'direct',
      responseLength: 'short',
    })
    expect(updated).toBe(
      '[AI Persona: language=hindi, tone=direct, length=short]\n\nOld prompt',
    )
  })
})

describe('buildSystemPrompt with AI Persona', () => {
  it('injects Hinglish rules when language=hinglish', () => {
    const prompt = buildSystemPrompt({
      userPrompt:
        '[AI Persona: language=hinglish, tone=friendly, length=balanced]\n\nHelp customers',
      mode: 'auto_reply',
    })
    expect(prompt).toContain('Hinglish')
    expect(prompt).toContain('warm, conversational, friendly')
    expect(prompt).toContain('balanced (2-4 sentences')
    expect(prompt).toContain('Business context and instructions:\nHelp customers')
  })

  it('injects professional tone and short length', () => {
    const prompt = buildSystemPrompt({
      userPrompt: 'Standard instructions',
      persona: {
        language: 'english',
        tone: 'professional',
        responseLength: 'short',
      },
      mode: 'auto_reply',
    })
    expect(prompt).toContain('reply strictly in clear, natural English')
    expect(prompt).toContain('tone must be professional, formal, polite')
    expect(prompt).toContain('very concise (1-2 short sentences, maximum 40 words)')
  })

  it('injects Marathi rules when language=marathi', () => {
    const prompt = buildSystemPrompt({
      userPrompt:
        '[AI Persona: language=marathi, tone=friendly, length=balanced]\n\nHelp customers',
      mode: 'auto_reply',
    })
    expect(prompt).toContain('मराठी')
    expect(prompt).toContain('warm, conversational, friendly')
  })

  it('instructs knowledge synthesis with chosen persona', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      persona: {
        language: 'hinglish',
        tone: 'friendly',
        responseLength: 'balanced',
      },
      mode: 'auto_reply',
      knowledge: ['Store opens at 10 AM.'],
    })
    expect(prompt).toContain('Store opens at 10 AM.')
    expect(prompt).toContain(
      'Formulate and adapt the answer to match the configured Language, Tone, and Length guidelines above.',
    )
  })
})

