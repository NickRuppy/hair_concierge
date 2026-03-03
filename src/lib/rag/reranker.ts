import { CohereClientV2 } from "cohere-ai"
import { RERANK_TOP_N, RERANK_TIMEOUT_MS } from "@/lib/rag/retrieval-constants"
import type { RetrievedChunk } from "@/lib/rag/retriever"

let cohereClient: CohereClientV2 | null = null

function getCohere(): CohereClientV2 {
  if (!cohereClient) {
    const apiKey = process.env.COHERE_API_KEY
    if (!apiKey) {
      // Reranker is optional — on missing key, the caller catches and falls
      // back to RRF-fused order. Add COHERE_API_KEY to .env.local / Vercel env.
      throw new Error("Missing COHERE_API_KEY — reranking disabled (fallback to RRF order).")
    }
    cohereClient = new CohereClientV2({ token: apiKey })
  }
  return cohereClient
}

/**
 * Reranks retrieved chunks using Cohere's cross-encoder reranker.
 * Sends the top `topN` candidates and re-sorts by reranker relevance score.
 *
 * On failure (API error, timeout), falls back to the original RRF-fused order.
 *
 * Ref: PRD FR-6, FR-7
 */
export async function rerankWithCrossEncoder(
  query: string,
  chunks: RetrievedChunk[],
  topN: number = RERANK_TOP_N,
): Promise<{ chunks: RetrievedChunk[]; latencyMs: number }> {
  const start = performance.now()

  // Only rerank the top N candidates
  const candidates = chunks.slice(0, topN)
  if (candidates.length === 0) {
    return { chunks: [], latencyMs: 0 }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS)

  try {
    const documents = candidates.map((c) => c.content)

    const response = await getCohere().rerank(
      {
        model: "rerank-v3.5",
        query,
        documents,
        topN: candidates.length,
      },
      { abortSignal: controller.signal },
    )

    // Re-sort candidates by reranker relevance score
    const reranked: RetrievedChunk[] = response.results.map((result) => ({
      ...candidates[result.index],
      weighted_similarity: result.relevanceScore,
    }))

    // Append any chunks beyond topN that weren't reranked (preserve original order)
    const remaining = chunks.slice(topN)

    const latencyMs = Math.round(performance.now() - start)
    return { chunks: [...reranked, ...remaining], latencyMs }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start)
    console.error("Cohere reranker failed, using RRF order as fallback:", error)
    return { chunks, latencyMs }
  } finally {
    clearTimeout(timeout)
  }
}
