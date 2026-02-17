import { createAdminClient } from "@/lib/supabase/admin"
import { generateEmbedding } from "@/lib/openai/embeddings"
import type { Product } from "@/lib/types"

export interface MatchedProduct extends Product {
  similarity: number
}

/**
 * Matches products from the vector store based on a semantic query.
 *
 * Generates an embedding for the query, then calls the Supabase RPC function
 * `match_products` to find the most relevant products via pgvector.
 *
 * @param query - The search query describing what products the user needs
 * @param hairType - Optional hair texture filter (e.g., "straight", "curly")
 * @param concerns - Optional array of concern filters (e.g., ["Trockenheit", "Spliss"])
 * @param count - Number of results to return (default 5)
 * @returns Array of matched products with similarity scores
 */
export async function matchProducts(
  query: string,
  hairType?: string,
  concerns?: string[],
  count: number = 5
): Promise<MatchedProduct[]> {
  try {
    const embedding = await generateEmbedding(query)
    const supabase = createAdminClient()

    const rpcParams: Record<string, unknown> = {
      query_embedding: embedding,
      match_count: count,
      user_hair_texture: hairType ?? null,
      user_concerns: concerns ?? [],
    }

    const { data, error } = await supabase.rpc("match_products", rpcParams)

    if (error) {
      console.error("Error matching products:", error)
      return []
    }

    return (data as MatchedProduct[]) ?? []
  } catch (error) {
    console.error("Product matching failed:", error)
    return []
  }
}
