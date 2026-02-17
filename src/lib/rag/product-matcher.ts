import { createAdminClient } from "@/lib/supabase/admin"
import { generateEmbedding } from "@/lib/openai/embeddings"
import type { Product, ProductCategory } from "@/lib/types"

export interface MatchedProduct extends Product {
  similarity: number
}

/** Maps ProductCategory → DB category column values */
const CATEGORY_DB_MAP: Record<string, string[]> = {
  shampoo: ["Shampoo", "Shampoo Profi"],
}

export interface ProductMatchParams {
  query: string
  thickness?: string       // fine/normal/coarse
  concerns?: string[]      // already-mapped product concern codes
  category?: ProductCategory
  count?: number
}

/**
 * Matches products from the vector store based on a semantic query,
 * with optional category pre-filtering and profile-based scoring.
 */
export async function matchProducts(
  params: ProductMatchParams
): Promise<MatchedProduct[]> {
  const { query, thickness, concerns = [], category, count = 5 } = params

  try {
    const embedding = await generateEmbedding(query)
    const supabase = createAdminClient()

    const categoryFilter = category && CATEGORY_DB_MAP[category]
      ? CATEGORY_DB_MAP[category]
      : null

    const rpcParams: Record<string, unknown> = {
      query_embedding: embedding,
      match_count: count,
      user_hair_texture: null,         // legacy param, unused
      user_concerns: concerns,
      category_filter: categoryFilter,
      user_thickness: thickness ?? null,
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
