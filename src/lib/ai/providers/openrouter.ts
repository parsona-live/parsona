import { AiError, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export async function generateOpenRouter(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wapp.crm'

  let res: Response
  try {
    res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': 'WAPP WhatsApp CRM',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('OpenRouter', res)
  }

  interface OpenRouterResponse {
    choices?: { message?: { content?: string } }[]
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
      cost?: number
      total_cost?: number
      cost_details?: {
        upstream_inference_cost?: number
        upstream_inference_prompt_cost?: number
        upstream_inference_completions_cost?: number
      }
    }
  }

  const json = (await res.json()) as OpenRouterResponse
  const text = json.choices?.[0]?.message?.content?.trim() ?? ''

  // OpenRouter returns exact cost charged in `usage.cost` (or in `usage.total_cost` / `cost_details`)
  const reportedCost =
    typeof json.usage?.cost === 'number'
      ? json.usage.cost
      : typeof json.usage?.total_cost === 'number'
      ? json.usage.total_cost
      : typeof json.usage?.cost_details?.upstream_inference_cost === 'number'
      ? json.usage.cost_details.upstream_inference_cost
      : undefined

  return {
    text,
    usage: normalizeUsage({
      prompt: json.usage?.prompt_tokens,
      completion: json.usage?.completion_tokens,
      total: json.usage?.total_tokens,
      cost: reportedCost,
    }),
  }
}
