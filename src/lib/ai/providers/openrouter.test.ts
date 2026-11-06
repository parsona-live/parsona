import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateOpenRouter } from './openrouter'

describe('generateOpenRouter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('correctly extracts cost from usage.cost', async () => {
    const fakeResponse = {
      choices: [{ message: { content: 'Hello from OpenRouter!' } }],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 45,
        total_tokens: 165,
        cost: 0.000215,
      },
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fakeResponse,
    } as Response)

    const res = await generateOpenRouter({
      apiKey: 'sk-or-test',
      model: 'google/gemini-2.0-flash',
      systemPrompt: 'System',
      messages: [{ role: 'user', content: 'Hi' }],
      timeoutMs: 5000,
    })

    expect(res.text).toBe('Hello from OpenRouter!')
    expect(res.usage).toEqual({
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
      cost: 0.000215,
    })
  })

  it('extracts cost from usage.total_cost if cost field is missing', async () => {
    const fakeResponse = {
      choices: [{ message: { content: 'Fallback' } }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70,
        total_cost: 0.0001,
      },
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fakeResponse,
    } as Response)

    const res = await generateOpenRouter({
      apiKey: 'sk-or-test',
      model: 'meta-llama/llama-3.3-70b',
      systemPrompt: 'System',
      messages: [{ role: 'user', content: 'Hi' }],
      timeoutMs: 5000,
    })

    expect(res.usage?.cost).toBe(0.0001)
  })
})

