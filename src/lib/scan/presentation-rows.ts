import type { SupabaseClient } from "@supabase/supabase-js"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import type { ScanCatalogPresentationRow } from "./product-presentation"

/**
 * The two catalog reads every verdict surface needs, in one place.
 *
 * `/api/scan/resolve` and `/api/scan/reveal` each carried a byte-identical private copy of
 * both loaders (identical select lists, identical `is_active`/`lifecycle_status` gate,
 * identical row mapping) that differed only in the error string they threw. The discovery
 * cockpit is a third reader of exactly the same rows, so the duplication is lifted here
 * rather than tripled: one column list, one eligibility gate, one mapping.
 *
 * Both are factories because each caller keeps its OWN error code — the route tests and
 * the resolve attempt log read those strings, so a lift must not rename them.
 */

export type ScanActiveProductLookup = { id: string; category: PersonalPlanCategory } | null

export type ScanActiveProductLoader = (
  client: SupabaseClient,
  productId: string,
) => Promise<ScanActiveProductLookup>

export type ScanPresentationRowLoader = (
  client: SupabaseClient,
  productIds: string[],
) => Promise<ScanCatalogPresentationRow[]>

/**
 * Identity + category of one catalog product, but only while it is sellable.
 *
 * `is_active` alone still leaves discontinued rows resolvable, so both flags are required
 * here exactly as they are in `identifier-lookup.ts` and the two save paths
 * (`catalog-eligibility.ts:85`).
 */
export function createActiveProductByIdLoader(errorCode: string): ScanActiveProductLoader {
  return async (client, productId) => {
    const { data, error } = await client
      .from("products")
      .select("id, category_key")
      .eq("id", productId)
      .eq("is_active", true)
      .eq("lifecycle_status", "active")
      .maybeSingle()
    if (error) throw new Error(errorCode)
    const row = data as { id: string; category_key: string } | null
    return row ? { id: row.id, category: row.category_key as PersonalPlanCategory } : null
  }
}

type PresentationRow = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  price_eur: number | null
  currency: string | null
  affiliate_link: string | null
  purchase_link_status: string | null
  price_checked_at: string | null
}

/**
 * The plain catalog rows `product-presentation.ts` joins onto a verdict: identity and
 * commerce, deliberately absent from the Stage-3 authority facts a verdict is built from.
 *
 * Unlike the active-product lookup this does NOT filter on lifecycle: a verdict may well
 * reference a product that has since been discontinued, and dropping its row here would
 * silently strip the scanned product's own header.
 */
export function createPresentationRowLoader(errorCode: string): ScanPresentationRowLoader {
  return async (client, productIds) => {
    if (productIds.length === 0) return []
    const { data, error } = await client
      .from("products")
      .select(
        "id, name, brand, category_key, image_url, price_eur, currency, affiliate_link, purchase_link_status, price_checked_at",
      )
      .in("id", [...new Set(productIds)])
    if (error) throw new Error(errorCode)
    return ((data ?? []) as PresentationRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category_key as PersonalPlanCategory,
      imageUrl: row.image_url,
      priceEur: row.price_eur,
      currency: row.currency,
      affiliateLink: row.affiliate_link,
      purchaseLinkStatus:
        row.purchase_link_status === "available" || row.purchase_link_status === "unavailable"
          ? row.purchase_link_status
          : null,
      priceCheckedAt: row.price_checked_at,
    }))
  }
}
