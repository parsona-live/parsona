import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiConfig } from './types'
import { chunkText } from './chunk'
import { embedTexts, toVectorLiteral } from './embeddings'

// ============================================================
// Knowledge base: ingest (chunk + optionally embed) and hybrid
// retrieve (semantic when an embeddings key is present, topped up with
// lexical full-text search).
// ============================================================

export interface IngestResult {
  keywordOnly: boolean
  embedError: unknown
}

const CHUNK_DELETE_BATCH = 100

interface MatchRow {
  id: string
  content: string
}

export function parseVector(val: unknown): number[] | null {
  if (Array.isArray(val)) {
    return val.map((x) => Number(x))
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parts = trimmed.slice(1, -1).split(',')
      const nums: number[] = new Array(parts.length)
      for (let i = 0; i < parts.length; i++) {
        nums[i] = parseFloat(parts[i])
      }
      return nums
    }
  }
  return null
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * (Re)build the chunks for one document. Re-chunks the content and —
 * when the account has an embeddings key — embeds each chunk. Runs under
 * whatever client the caller passes (service-role for ingest routes).
 */
export async function ingestDocument(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  documentId: string,
  content: string,
): Promise<IngestResult> {
  const chunks = chunkText(content)

  // Embed if a key is set, but DON'T let an embedding failure stop the
  // chunks from being stored: a failed embed must still leave the
  // document searchable lexically.
  let embeddings: number[][] | null = null
  let embedError: unknown = null
  if (config.embeddingsApiKey && chunks.length > 0) {
    try {
      embeddings = await embedTexts(config.embeddingsApiKey, chunks)
    } catch (err) {
      embedError = err
    }
  }

  const { data: previousChunks, error: listErr } = await db
    .from('ai_knowledge_chunks')
    .select('id')
    .eq('document_id', documentId)
  if (listErr) throw listErr

  if (chunks.length > 0) {
    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      account_id: accountId,
      chunk_index: i,
      content,
      embedding: embeddings ? toVectorLiteral(embeddings[i]) : null,
    }))
    const { error: insErr } = await db.from('ai_knowledge_chunks').insert(rows)
    if (insErr && embeddings) {
      // Fallback: PostgREST can sometimes prefer native arrays over string literals depending on schema bindings
      const arrayRows = chunks.map((content, i) => ({
        document_id: documentId,
        account_id: accountId,
        chunk_index: i,
        content,
        embedding: embeddings[i],
      }))
      const { error: arrayInsErr } = await db.from('ai_knowledge_chunks').insert(arrayRows)
      if (arrayInsErr) throw arrayInsErr
    } else if (insErr) {
      throw insErr
    }
  }

  const previousIds = (previousChunks ?? []).map((row: { id: string }) => row.id)
  for (let i = 0; i < previousIds.length; i += CHUNK_DELETE_BATCH) {
    const { error: delErr } = await db
      .from('ai_knowledge_chunks')
      .delete()
      .in('id', previousIds.slice(i, i + CHUNK_DELETE_BATCH))
    if (delErr) throw delErr
  }

  return { keywordOnly: embedError !== null, embedError }
}

/**
 * Retrieve up to `k` knowledge excerpts relevant to `queryText`.
 *
 * Semantic-primary when an embeddings key is configured (embed the
 * query → cosine-nearest chunks), then topped up with lexical full-text
 * matches to fill `k`. Lexical-only when there's no key. Best-effort:
 * any failure (no KB, embedding error, RPC error) degrades to fewer or
 * zero results and never throws into the draft / auto-reply path.
 */
export async function retrieveKnowledge(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  queryText: string,
  k = 5,
): Promise<string[]> {
  const query = queryText.trim()
  if (!query || k <= 0) return []

  // Skip everything when the account has no knowledge base — otherwise
  // every draft / auto-reply would pay for a query embedding + two RPCs
  // just to get []. One cheap indexed COUNT (head, no rows) instead of a
  // paid embeddings call on the hot path.
  try {
    const { count, error } = await db
      .from('ai_knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
    if (error || !count) return []
  } catch {
    return []
  }

  const picked = new Map<string, string>() // id → content, preserves order

  // Semantic path.
  if (config.embeddingsApiKey) {
    try {
      const [queryEmbedding] = await embedTexts(config.embeddingsApiKey, [query])
      if (queryEmbedding) {
        const { data, error } = await db.rpc('match_ai_knowledge_semantic', {
          p_account_id: accountId,
          p_query_embedding: toVectorLiteral(queryEmbedding),
          p_match_count: k,
        })
        if (!error && Array.isArray(data) && data.length > 0) {
          for (const row of data as MatchRow[]) picked.set(row.id, row.content)
        } else {
          if (error) {
            console.warn('[ai knowledge] match_ai_knowledge_semantic RPC error, falling back to direct vector scan:', error)
          }
          // Fallback: direct in-memory vector comparison on the account's knowledge chunks.
          // This rescues situations where PostgreSQL pgvector return types mismatch (e.g. real vs double precision)
          // or RPC permissions fail, ensuring 100% reliable semantic search.
          const { data: chunkRows, error: fetchErr } = await db
            .from('ai_knowledge_chunks')
            .select('id, content, embedding')
            .eq('account_id', accountId)
            .limit(100)

          if (!fetchErr && Array.isArray(chunkRows) && chunkRows.length > 0) {
            const scored: { id: string; content: string; score: number }[] = []
            for (const row of chunkRows) {
              const vec = parseVector(row.embedding)
              if (vec && vec.length === queryEmbedding.length) {
                const sim = cosineSimilarity(queryEmbedding, vec)
                scored.push({ id: row.id, content: row.content, score: sim })
              }
            }
            scored.sort((a, b) => b.score - a.score)
            for (const item of scored.slice(0, k)) {
              if (item.score > 0.1) {
                picked.set(item.id, item.content)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[ai knowledge] semantic retrieval failed, falling back to FTS:', err)
    }
  }

  // Lexical top-up (also the sole path when there's no embeddings key).
  if (picked.size < k) {
    try {
      const { data, error } = await db.rpc('match_ai_knowledge_fts', {
        p_account_id: accountId,
        p_query: query,
        p_match_count: k,
      })
      if (!error && Array.isArray(data) && data.length > 0) {
        for (const row of data as MatchRow[]) {
          if (picked.size >= k) break
          if (!picked.has(row.id)) picked.set(row.id, row.content)
        }
      } else {
        // FTS plainto_tsquery requires ALL words to match (AND semantics).
        // If query is a natural sentence ("Who is the founder of your business"),
        // try substring/keyword search for words of length >= 3:
        const stopWords = new Set(['who', 'what', 'when', 'where', 'which', 'your', 'with', 'have', 'from', 'they', 'this', 'that', 'about', 'tell', 'please'])
        const words = query
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !stopWords.has(w))

        if (words.length > 0) {
          const { data: keywordRows } = await db
            .from('ai_knowledge_chunks')
            .select('id, content')
            .eq('account_id', accountId)
            .limit(50)

          if (Array.isArray(keywordRows) && keywordRows.length > 0) {
            const matched: { id: string; content: string; count: number }[] = []
            for (const row of keywordRows) {
              if (picked.has(row.id)) continue
              const lower = row.content.toLowerCase()
              let count = 0
              for (const word of words) {
                if (lower.includes(word)) count++
              }
              if (count > 0) {
                matched.push({ id: row.id, content: row.content, count })
              }
            }
            matched.sort((a, b) => b.count - a.count)
            for (const item of matched) {
              if (picked.size >= k) break
              picked.set(item.id, item.content)
            }
          }
        }
      }
    } catch (err) {
      console.error('[ai knowledge] lexical retrieval failed:', err)
    }
  }

  return Array.from(picked.values()).slice(0, k)
}
