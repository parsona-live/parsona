import { AiError } from './types'
import { aiRequestTimeoutMs, AI_PROVIDER_DEFAULT_EMBEDDING_MODEL } from './defaults'
import { providerHttpError, toNetworkError } from './providers/shared'
import { getT } from '@/lib/i18n/translate'

const t = getT('LibErrors')

// ============================================================
// Embeddings (OpenAI / OpenRouter).
// ============================================================

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings'

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const OPENROUTER_EMBEDDING_MODEL = AI_PROVIDER_DEFAULT_EMBEDDING_MODEL.openrouter // 'openai/text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

// Keep batches modest so a big re-index stays under request-size limits
const BATCH_SIZE = 96

interface EmbeddingResponse {
  data?: { embedding?: number[]; index?: number }[]
}

/** Format a vector for a pgvector column / RPC param: `[0.1,0.2,...]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export interface EmbedOptions {
  model?: string
  endpoint?: string
}

/**
 * Embed a list of strings, preserving input order.
 * Works with both standard OpenAI keys and OpenRouter keys (auto-detected).
 */
export async function embedTexts(
  apiKey: string,
  inputs: string[],
  opts?: EmbedOptions,
): Promise<number[][]> {
  if (inputs.length === 0) return []
  const timeoutMs = aiRequestTimeoutMs()
  const out: number[][] = []

  const trimmedKey = apiKey.trim()
  const isOpenRouter =
    trimmedKey.startsWith('sk-or-') ||
    opts?.endpoint?.includes('openrouter') ||
    opts?.model?.startsWith('openai/');

  const url =
    opts?.endpoint ??
    (isOpenRouter ? OPENROUTER_EMBEDDINGS_URL : OPENAI_EMBEDDINGS_URL)

  const model =
    opts?.model ??
    (isOpenRouter ? OPENROUTER_EMBEDDING_MODEL : EMBEDDING_MODEL)

  const providerLabel = isOpenRouter ? 'OpenRouter embeddings' : 'OpenAI embeddings'

  for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
    const batch = inputs.slice(start, start + BATCH_SIZE)

    let res: Response
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${trimmedKey}`,
        'Content-Type': 'application/json',
      }
      if (isOpenRouter) {
        headers['HTTP-Referer'] = 'https://wacrm.local'
        headers['X-Title'] = 'WhatsApp CRM'
      }

      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, input: batch }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw toNetworkError(err)
    }

    if (!res.ok) {
      throw await providerHttpError(providerLabel, res)
    }

    const data = (await res.json().catch(() => null)) as EmbeddingResponse | null
    const rows = data?.data
    if (!rows || rows.length !== batch.length) {
      throw new AiError(t('ai.embeddingsMalformed'), {
        code: 'embeddings_malformed',
      })
    }

    if (rows.some((r) => typeof r.index !== 'number')) {
      throw new AiError(t('ai.embeddingsMissingIndices'), {
        code: 'embeddings_malformed',
      })
    }
    const ordered = [...rows].sort((a, b) => a.index! - b.index!)
    for (const r of ordered) {
      if (!Array.isArray(r.embedding)) {
        throw new AiError(t('ai.embeddingsMissingVector'), {
          code: 'embeddings_malformed',
        })
      }
      out.push(r.embedding)
    }
  }

  return out
}
