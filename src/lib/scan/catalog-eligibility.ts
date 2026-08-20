import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Mirrors the eligibility predicate `personal_plan_create_or_reuse_user_product` enforces
 * server-side (migration `20260811212000_personal_plan_curated_publication_gate.sql:267-280`):
 *
 *   WHERE ... AND NOT EXISTS (
 *     SELECT 1 FROM personal_plan_product_search_dispositions disposition
 *     WHERE disposition.product_id = p_catalog_product_id
 *   )
 *   AND (origin = 'curated' OR EXISTS (
 *     SELECT 1 FROM user_products owned
 *     WHERE owned.user_id = p_user_id AND owned.category = p_category
 *       AND owned.catalog_product_id = p_catalog_product_id
 *       AND owned.identity_status = 'matched' AND owned.ownership_status = 'owned'
 *   ))
 *
 * A row in `personal_plan_product_search_dispositions` quarantines a product out of every
 * Personal Plan-facing surface without touching global catalog visibility or recommendation
 * flags (see that table's migration, `20260811205500_...`) — controller ruling R7: scan must
 * respect this everywhere a product could be surfaced or saved.
 */

/** Search/resolve only need the disposition half — no `origin`/ownership involved there. */
export async function isProductSearchQuarantined(
  client: SupabaseClient,
  productId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("personal_plan_product_search_dispositions")
    .select("product_id")
    .eq("product_id", productId)
    .maybeSingle()
  if (error) throw new Error("scan_catalog_eligibility_check_failed")
  return Boolean(data)
}

/** For excluding disposition-quarantined rows from a bulk catalog scan (search). */
export async function loadQuarantinedProductIds(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client
    .from("personal_plan_product_search_dispositions")
    .select("product_id")
  if (error) throw new Error("scan_catalog_eligibility_check_failed")
  return new Set(((data ?? []) as Array<{ product_id: string }>).map((row) => row.product_id))
}

/**
 * Same check narrowed to a known handful of ids — for a short list already in hand
 * (alternatives, a wishlist page) where loading the whole disposition table would be
 * wasteful. Returns the subset that is quarantined.
 */
export async function loadQuarantinedProductIdsAmong(
  client: SupabaseClient,
  productIds: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(productIds)]
  if (unique.length === 0) return new Set()
  const { data, error } = await client
    .from("personal_plan_product_search_dispositions")
    .select("product_id")
    .in("product_id", unique)
  if (error) throw new Error("scan_catalog_eligibility_check_failed")
  return new Set(((data ?? []) as Array<{ product_id: string }>).map((row) => row.product_id))
}

/**
 * The catalog-lifecycle half of scan eligibility: `is_active` alone is not enough, because
 * a discontinued or otherwise non-active `lifecycle_status` product still carries
 * `is_active = true` in this catalog. Every other scan surface already filters on both
 * columns (`searchScanCatalog`, `loadActiveProductById`, both save paths) — this constant
 * keeps the identifier lookup on the same predicate instead of re-deriving it.
 */
export const SCAN_ACTIVE_LIFECYCLE_STATUS = "active"

/** Returns the ids that are eligible to be surfaced by scan: active AND not quarantined. */
export async function filterScanEligibleProductIds(
  client: SupabaseClient,
  productIds: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(productIds)]
  if (unique.length === 0) return new Set()
  const [{ data, error }, quarantined] = await Promise.all([
    client
      .from("products")
      .select("id")
      .in("id", unique)
      .eq("is_active", true)
      .eq("lifecycle_status", SCAN_ACTIVE_LIFECYCLE_STATUS),
    loadQuarantinedProductIdsAmong(client, unique),
  ])
  if (error) throw new Error("scan_catalog_eligibility_check_failed")
  const active = new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id))
  return new Set(unique.filter((id) => active.has(id) && !quarantined.has(id)))
}
