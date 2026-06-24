import { BONDBUILDER_DB_CATEGORIES } from "@/lib/bondbuilder/constants"
import { createAdminClient } from "@/lib/supabase/admin"
import { CONDITIONER_DB_CATEGORIES } from "@/lib/conditioner/constants"
import { DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES } from "@/lib/deep-cleansing-shampoo/constants"
import { DRY_SHAMPOO_DB_CATEGORIES } from "@/lib/dry-shampoo/constants"
import { OIL_DB_CATEGORIES, type OilSubtype } from "@/lib/oil/constants"
import { PEELING_DB_CATEGORIES } from "@/lib/peeling/constants"
import type { Product, ProductCategory, ShampooBucket } from "@/lib/types"

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
  oil: [...OIL_DB_CATEGORIES],
  leave_in: ["Leave-in", "Leave-In", "Leave in", "leave_in"],
  bondbuilder: [...BONDBUILDER_DB_CATEGORIES],
  deep_cleansing_shampoo: [...DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES],
  dry_shampoo: [...DRY_SHAMPOO_DB_CATEGORIES],
  peeling: [...PEELING_DB_CATEGORIES],
}

export interface ProductMatchParams {
  query: string
  thickness?: string // fine/normal/coarse
  concerns?: string[] // already-mapped product concern codes
  category?: ProductCategory
  count?: number
}

export interface ShampooMatchParams {
  query: string
  thickness: string
  shampooBucket: ShampooBucket
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

export interface OilMatchParams {
  query: string
  thickness: string
  oilSubtype: OilSubtype
  count?: number
}

type ProductRow = Product & {
  tom_take?: string | null
}

type ProductJoinRow = {
  products: ProductRow | ProductRow[] | null
}

const GENERIC_MATCH_CANDIDATE_LIMIT = 500
const STRICT_MATCH_MIN_CANDIDATES = 20

function joinedProduct(row: ProductJoinRow): ProductRow | null {
  return Array.isArray(row.products) ? (row.products[0] ?? null) : row.products
}

function priceSortValue(product: Pick<Product, "price_eur">): number {
  return typeof product.price_eur === "number" ? product.price_eur : Number.MAX_SAFE_INTEGER
}

function sortProducts(left: Product, right: Product): number {
  if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order
  const priceDiff = priceSortValue(left) - priceSortValue(right)
  if (priceDiff !== 0) return priceDiff
  return left.name.localeCompare(right.name, "de")
}

function categoryMatches(product: Product, categoryFilter: string[] | null): boolean {
  return !categoryFilter || (product.category ? categoryFilter.includes(product.category) : false)
}

export function isGloballyRecommendableProduct(product: Product): boolean {
  return (
    product.is_active !== false &&
    product.is_chaarlie_recommended !== false &&
    (product.lifecycle_status ?? "active") === "active"
  )
}

function scoreProduct(
  product: Product,
  params: { thickness?: string; concerns?: string[] },
): number {
  const thicknessScore =
    params.thickness && product.suitable_thicknesses.includes(params.thickness) ? 0.5 : 0

  const concernCount = params.concerns?.length ?? 0
  const concernScore =
    concernCount > 0
      ? (0.5 *
          params.concerns!.filter((concern) => product.suitable_concerns.includes(concern))
            .length) /
        concernCount
      : 0

  return thicknessScore + concernScore
}

function asMatchedProduct(product: Product, score: number): MatchedProduct {
  return {
    ...product,
    similarity: 0,
    profile_score: score,
    combined_score: score,
  }
}

export function sortMatchedProducts(left: MatchedProduct, right: MatchedProduct): number {
  const leftScore = left.combined_score ?? 0
  const rightScore = right.combined_score ?? 0
  if (rightScore !== leftScore) return rightScore - leftScore
  return sortProducts(left, right)
}

function strictCandidateWindow(count: number): number {
  return Math.max(count, STRICT_MATCH_MIN_CANDIDATES)
}

export function rankProductsForDeterministicMatch(
  products: Product[],
  params: Pick<ProductMatchParams, "thickness" | "concerns" | "count">,
): MatchedProduct[] {
  return products
    .map((product) => asMatchedProduct(product, scoreProduct(product, params)))
    .sort(sortMatchedProducts)
    .slice(0, params.count ?? 5)
}

/**
 * Matches products with deterministic SQL/profile filters. Embeddings are no longer
 * part of product eligibility or ordering.
 *
 * Legacy suitability arrays are intentionally used as ranking signals only.
 * Structured category/spec logic owns final fit and safety decisions.
 */
export async function matchProducts(params: ProductMatchParams): Promise<MatchedProduct[]> {
  const { thickness, concerns = [], category, count = 5 } = params

  try {
    const supabase = createAdminClient()
    const categoryFilter = category && CATEGORY_DB_MAP[category] ? CATEGORY_DB_MAP[category] : null

    let query = supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("is_chaarlie_recommended", true)
      .eq("lifecycle_status", "active")
      .order("sort_order", { ascending: true })
      .order("price_eur", { ascending: true, nullsFirst: false })

    if (categoryFilter) {
      query = query.in("category", categoryFilter)
    }

    const { data, error } = await query.limit(GENERIC_MATCH_CANDIDATE_LIMIT)

    if (error) {
      console.error("Error matching products:", error)
      return []
    }

    return rankProductsForDeterministicMatch((data as ProductRow[]) ?? [], {
      thickness,
      concerns,
      count,
    })
  } catch (error) {
    console.error("Product matching failed:", error)
    return []
  }
}

/**
 * Matches shampoos using strict matrix buckets:
 * thickness + shampoo_bucket must both match.
 */
export async function matchShampooProducts(params: ShampooMatchParams): Promise<MatchedProduct[]> {
  const { thickness, shampooBucket, count = 5 } = params

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("product_shampoo_specs")
      .select("products:product_id(*)")
      .eq("thickness", thickness)
      .eq("shampoo_bucket", shampooBucket)

    if (error) {
      console.error("Error matching shampoo products:", error)
      return []
    }

    return ((data as ProductJoinRow[]) ?? [])
      .map(joinedProduct)
      .filter((product): product is ProductRow => Boolean(product))
      .filter(isGloballyRecommendableProduct)
      .filter((product) => categoryMatches(product, CATEGORY_DB_MAP["shampoo"]))
      .map((product) => asMatchedProduct(product, 1))
      .sort(sortMatchedProducts)
      .slice(0, strictCandidateWindow(count))
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
  params: ConditionerMatchParams,
): Promise<MatchedProduct[]> {
  const { thickness, proteinMoistureBalance, count = 5 } = params

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("product_conditioner_specs")
      .select("products:product_id(*)")
      .eq("thickness", thickness)
      .eq("protein_moisture_balance", proteinMoistureBalance)

    if (error) {
      console.error("Error matching conditioner products:", error)
      return []
    }

    return ((data as ProductJoinRow[]) ?? [])
      .map(joinedProduct)
      .filter((product): product is ProductRow => Boolean(product))
      .filter(isGloballyRecommendableProduct)
      .filter((product) => categoryMatches(product, CATEGORY_DB_MAP["conditioner"]))
      .map((product) => asMatchedProduct(product, 1))
      .sort(sortMatchedProducts)
      .slice(0, strictCandidateWindow(count))
  } catch (error) {
    console.error("Conditioner product matching failed:", error)
    return []
  }
}

/**
 * Matches leave-ins using strict eligibility triples:
 * thickness + leave_in_need_bucket + styling_context must all match.
 */
export async function matchLeaveInProducts(params: LeaveInMatchParams): Promise<MatchedProduct[]> {
  const { thickness, needBucket, stylingContext, count = 10 } = params

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("product_leave_in_eligibility")
      .select("products:product_id(*)")
      .eq("thickness", thickness)
      .eq("need_bucket", needBucket)
      .eq("styling_context", stylingContext)

    if (error) {
      console.error("Error matching leave-in products:", error)
      return []
    }

    return ((data as ProductJoinRow[]) ?? [])
      .map(joinedProduct)
      .filter((product): product is ProductRow => Boolean(product))
      .filter(isGloballyRecommendableProduct)
      .filter((product) => categoryMatches(product, CATEGORY_DB_MAP["leave_in"]))
      .map((product) => asMatchedProduct(product, 1))
      .sort(sortMatchedProducts)
      .slice(0, strictCandidateWindow(count))
  } catch (error) {
    console.error("Leave-in product matching failed:", error)
    return []
  }
}

/**
 * Matches oils using strict eligibility pairs:
 * thickness + oil_subtype must both match.
 */
export async function matchOilProducts(params: OilMatchParams): Promise<MatchedProduct[]> {
  const { thickness, oilSubtype, count = 10 } = params

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("product_oil_eligibility")
      .select("products:product_id(*)")
      .eq("thickness", thickness)
      .eq("oil_subtype", oilSubtype)

    if (error) {
      console.error("Error matching oil products:", error)
      return []
    }

    return ((data as ProductJoinRow[]) ?? [])
      .map(joinedProduct)
      .filter((product): product is ProductRow => Boolean(product))
      .filter(isGloballyRecommendableProduct)
      .filter((product) => categoryMatches(product, CATEGORY_DB_MAP["oil"]))
      .map((product) => asMatchedProduct(product, 1))
      .sort(sortMatchedProducts)
      .slice(0, strictCandidateWindow(count))
  } catch (error) {
    console.error("Oil product matching failed:", error)
    return []
  }
}
