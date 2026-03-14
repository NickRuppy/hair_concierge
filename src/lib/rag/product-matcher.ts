import { createAdminClient } from "@/lib/supabase/admin"
import { generateEmbedding } from "@/lib/openai/embeddings"
import { CONDITIONER_DB_CATEGORIES } from "@/lib/conditioner/constants"
import type { Product, ProductCategory } from "@/lib/types"

export interface MatchedProduct extends Product {
  similarity: number
  profile_score?: number
  combined_score?: number
}

/** Maps ProductCategory → DB category column values */
const CATEGORY_DB_MAP: Record<string, string[]> = {
  shampoo: ["Shampoo", "Shampoo Profi"],
  conditioner: [...CONDITIONER_DB_CATEGORIES],
  mask: ["Maske"],
  leave_in: ["Leave-in", "Leave-In", "Leave in", "leave_in"],
}

export interface ProductMatchParams {
  query: string
  thickness?: string       // fine/normal/coarse
  concerns?: string[]      // already-mapped product concern codes
  category?: ProductCategory
  count?: number
}

export interface ShampooMatchParams {
  query: string
  thickness: string
  scalpType: string
  scalpCondition: string
  count?: number
}

export interface ConditionerMatchParams {
  query: string
  thickness: string
  proteinMoistureBalance: string
  count?: number
}

export interface LeaveInMatchParams {
  query: string
  thickness: string
  needBucket: string
  stylingContext: string
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

/**
 * Matches shampoos using strict eligibility triples:
 * thickness + scalp_type + scalp_condition must all match.
 */
export async function matchShampooProducts(
  params: ShampooMatchParams
): Promise<MatchedProduct[]> {
  const { query, thickness, scalpType, scalpCondition, count = 5 } = params

  try {
    const embedding = await generateEmbedding(query)
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("match_shampoo_products", {
      query_embedding: embedding,
      user_thickness: thickness,
      user_scalp_type: scalpType,
      user_scalp_condition: scalpCondition,
      match_count: count,
      category_filter: CATEGORY_DB_MAP["shampoo"],
    })

    if (error) {
      console.error("Error matching shampoo products:", error)
      return []
    }

    return (data as MatchedProduct[]) ?? []
  } catch (error) {
    console.error("Shampoo product matching failed:", error)
    return []
  }
}

/**
 * Matches conditioners using strict eligibility pairs:
 * thickness + protein_moisture_balance must both match.
 */
export async function matchConditionerProducts(
  params: ConditionerMatchParams
): Promise<MatchedProduct[]> {
  const { query, thickness, proteinMoistureBalance, count = 5 } = params

  try {
    const embedding = await generateEmbedding(query)
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("match_conditioner_products", {
      query_embedding: embedding,
      user_thickness: thickness,
      user_protein_moisture_balance: proteinMoistureBalance,
      match_count: count,
      category_filter: CATEGORY_DB_MAP["conditioner"],
    })

    if (error) {
      console.error("Error matching conditioner products:", error)
      return []
    }

    return (data as MatchedProduct[]) ?? []
  } catch (error) {
    console.error("Conditioner product matching failed:", error)
    return []
  }
}

/**
 * Matches leave-ins using strict eligibility triples:
 * thickness + leave_in_need_bucket + styling_context must all match.
 */
export async function matchLeaveInProducts(
  params: LeaveInMatchParams
): Promise<MatchedProduct[]> {
  const { query, thickness, needBucket, stylingContext, count = 10 } = params

  try {
    const embedding = await generateEmbedding(query)
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("match_leave_in_products", {
      query_embedding: embedding,
      user_thickness: thickness,
      user_need_bucket: needBucket,
      user_styling_context: stylingContext,
      match_count: count,
      category_filter: CATEGORY_DB_MAP["leave_in"],
    })

    if (error) {
      console.error("Error matching leave-in products:", error)
      return []
    }

    return (data as MatchedProduct[]) ?? []
  } catch (error) {
    console.error("Leave-in product matching failed:", error)
    return []
  }
}
