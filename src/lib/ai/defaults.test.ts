import { describe, it, expect } from 'vitest'
import {
  parseAiPersona,
  injectAiPersona,
  buildSystemPrompt,
  sanitizeAiReply,
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

  it('injects natural personalization, anti-cliché, and identity awareness rules', () => {
    const prompt = buildSystemPrompt({
      contactName: 'Yash',
      mode: 'auto_reply',
    })
    expect(prompt).toContain("The customer's name is Yash")
    expect(prompt).toContain('CONVERSATIONAL RULES & NATURAL HUMAN PERSONA')
    expect(prompt).toContain('Returning Customer Continuity')
    expect(prompt).toContain('Direct Answer Behavior')
    expect(prompt).toContain('Authoritative Identity & Channel Awareness')
    expect(prompt).toContain('Strict Anti-Cliché Rules')
  })
})

describe('sanitizeAiReply', () => {
  it('strips bracketed channel tags from generated responses', () => {
    const raw = '[Via Instagram DM] Hey Yash, your order is ready.'
    expect(sanitizeAiReply(raw)).toBe('Hey Yash, your order is ready.')
  })

  it('strips robotic trailing support clichés', () => {
    const raw1 = 'Aapka naam Yash hai. 😊 Aapki kisi aur madad ki zaroorat hai? 😊'
    expect(sanitizeAiReply(raw1)).toBe('Aapka naam Yash hai.')

    const raw2 = 'Humare packages 9,999 se shuru hote hain. Hum yahaan aapki madad ke liye hain!'
    expect(sanitizeAiReply(raw2)).toBe('Humare packages 9,999 se shuru hote hain.')

    const raw3 = 'Aapki Instagram profile @yashtupkar hai. Agar aapko aur jaankari chahiye toh bataiye!'
    expect(sanitizeAiReply(raw3)).toBe('Aapki Instagram profile @yashtupkar hai.')
  })

  it('strips accidental system instruction echoes', () => {
    const raw = '[CRITICAL INSTRUCTION: All facts below reflect verified business CRM data] Aapka naam Yash hai.'
    expect(sanitizeAiReply(raw)).toBe('Aapka naam Yash hai.')
  })
})


