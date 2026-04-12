import { retrieveContext } from "@/lib/rag/retriever"
import type { RetrieveOptions, RetrieveContextResult } from "@/lib/rag/retriever"
import { SOURCE_TYPE_LABELS } from "@/lib/vocabulary"
import { formatSourceName } from "@/lib/rag/source-names"
import type { EnrichedCitationSource } from "@/lib/types"
import type { RetrievedChunk } from "@/lib/rag/retriever"

export type { RetrieveOptions, RetrieveContextResult }

/**
 * Retrieve context chunks via hybrid search.
 * Delegates to the existing retriever — this wrapper exists so the orchestrator
 * has a single import for retrieval concerns.
 */
export async function retrieve(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrieveContextResult> {
  return retrieveContext(query, options)
}

/**
 * Build enriched citation sources from retrieved chunks.
 * Extracted from pipeline.ts where this was inline.
 */
export function buildSources(chunks: RetrievedChunk[]): EnrichedCitationSource[] {
  return chunks.map((chunk, i) => ({
    index: i + 1,
    source_type: chunk.source_type,
    label: SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type,
    source_name: chunk.source_name ? formatSourceName(chunk.source_name) : null,
    snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
    confidence: chunk.weighted_similarity,
    retrieval_path: chunk.retrieval_path,
  }))
}
