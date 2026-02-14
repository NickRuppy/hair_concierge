import { createAdminClient } from "@/lib/supabase/admin"
import { generateEmbedding } from "@/lib/openai/embeddings"
import type { ContentChunk, IntentType, HairProfile } from "@/lib/types"

export interface RetrievedChunk extends ContentChunk {
  similarity: number
  weighted_similarity: number
}

/** Intent → allowed source types. null = all sources. */
const INTENT_SOURCE_ROUTES: Record<IntentType, string[] | null> = {
  product_recommendation: ["product_list", "book", "community_qa"],
  ingredient_question: ["book", "qa"],
  hair_care_advice: ["book", "transcript", "qa", "product_list", "community_qa"],
  routine_help: ["book", "transcript", "qa", "product_list", "community_qa"],
  diagnosis: ["book", "qa", "live_call", "community_qa"],
  photo_analysis: ["book", "qa", "live_call"],
  general_chat: null,
  followup: null,
}

export interface RetrieveOptions {
  intent?: IntentType
  hairProfile?: HairProfile | null
  metadataFilter?: Record<string, string>
  count?: number
}

/**
 * Lightweight re-ranking: profile boost + deduplication.
 *
 * 1. Chunks whose metadata.hair_texture matches the user's hair_texture
 *    get a 1.15× multiplier on their weighted_similarity.
 * 2. Sorted by final score descending.
 * 3. Deduplicated: if >80% of a shorter chunk's text appears verbatim
 *    in a higher-ranked chunk, the shorter one is dropped.
 */
function rerankChunks(
  chunks: RetrievedChunk[],
  hairProfile: HairProfile | null | undefined,
  finalCount: number
): RetrievedChunk[] {
  // Step 1: Profile boost (fallback to raw similarity if weighted_similarity missing)
  const scored = chunks.map((chunk) => {
    let score = chunk.weighted_similarity ?? chunk.similarity ?? 0
    if (
      hairProfile?.hair_texture &&
      chunk.metadata?.hair_texture === hairProfile.hair_texture
    ) {
      score *= 1.15
    }
    return { ...chunk, weighted_similarity: score }
  })

  // Step 2: Sort by boosted score
  scored.sort((a, b) => b.weighted_similarity - a.weighted_similarity)

  // Step 3: Deduplicate — drop chunks where >80% of the shorter text
  // appears as a contiguous substring anywhere in the longer text
  const kept: RetrievedChunk[] = []
  for (const chunk of scored) {
    const isDuplicate = kept.some((existing) => {
      const shorter =
        chunk.content.length <= existing.content.length
          ? chunk.content
          : existing.content
      const longer =
        chunk.content.length > existing.content.length
          ? chunk.content
          : existing.content
      if (shorter.length === 0) return true
      const windowSize = Math.floor(shorter.length * 0.8)
      // Slide through the shorter string — if any 80%-length window
      // appears in the longer string, they overlap enough to deduplicate
      for (let i = 0; i <= shorter.length - windowSize; i++) {
        if (longer.includes(shorter.slice(i, i + windowSize))) {
          return true
        }
      }
      return false
    })
    if (!isDuplicate) {
      kept.push(chunk)
    }
    if (kept.length >= finalCount) break
  }

  return kept
}

/**
 * Retrieves relevant content chunks from the vector store using hybrid search,
 * intent-based routing, authority-weighted scoring, and re-ranking.
 *
 * Flow:
 * 1. Look up source_types from INTENT_SOURCE_ROUTES[intent]
 * 2. Call match_content_chunks with broader retrieval (20 candidates, 0.65 threshold)
 * 3. Re-rank with profile boost + deduplication → return top `count` results
 */
export async function retrieveContext(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { intent, hairProfile, metadataFilter, count = 5 } = options

  try {
    const embedding = await generateEmbedding(query)
    const supabase = createAdminClient()

    // Determine source routing based on intent
    const sourceTypes = intent ? INTENT_SOURCE_ROUTES[intent] : null

    // Always pass all 6 params to resolve the correct overload
    const rpcParams: Record<string, unknown> = {
      query_embedding: embedding,
      match_count: 20, // Broader retrieval for re-ranking
      match_threshold: 0.65, // Slightly lower to get more candidates
      source_filter: null,
      metadata_filter: metadataFilter ?? null,
      source_types: sourceTypes ?? null,
    }

    const { data, error } = await supabase.rpc("match_content_chunks", rpcParams)

    if (error) {
      console.error("Error retrieving content chunks:", error)
      return []
    }

    const chunks = (data as RetrievedChunk[]) ?? []

    // Re-rank and return top results
    return rerankChunks(chunks, hairProfile, count)
  } catch (error) {
    console.error("Context retrieval failed:", error)
    return []
  }
}
