import type { SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin, hasValidGs1CheckDigit } from "@/lib/product-identity/normalize"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import { SCAN_ACTIVE_LIFECYCLE_STATUS } from "./catalog-eligibility"

/**
 * The three barcode-shaped identifier types the catalog stores. Scan only ever produces
 * an EAN read, but the lookup treats them as interchangeable — mirrors
 * `BARCODE_IDENTIFIER_TYPES` in `src/lib/product-intake/product-matching.ts` (not exported
 * there, so re-declared here rather than reached into).
 */
export type ScanIdentifierType = "ean" | "gtin" | "barcode"
const BARCODE_IDENTIFIER_TYPES: readonly ScanIdentifierType[] = ["ean", "gtin", "barcode"]

export type ScanIdentifierInput = {
  type: ScanIdentifierType
  value: string
}

export type CatalogIdentifierLookupResult = {
  productId: string
  category: PersonalPlanCategory
} | null

type ProductIdentifierRow = { product_id: string }
type ActiveProductRow = { id: string; category_key: string }

export async function lookupCatalogProductByIdentifier(
  client: SupabaseClient,
  identifier: ScanIdentifierInput,
): Promise<CatalogIdentifierLookupResult> {
  const canonicalGtin14 = canonicalizeGtin(identifier.value)
  if (!canonicalGtin14) return null

  const { data: identifierRows, error: identifierError } = await client
    .from("product_identifiers")
    .select("product_id")
    .eq("canonical_gtin14", canonicalGtin14)
    .in("identifier_type", BARCODE_IDENTIFIER_TYPES)
  if (identifierError) throw new Error("scan_identifier_lookup_failed")

  const productIds = [
    ...new Set(((identifierRows ?? []) as ProductIdentifierRow[]).map((row) => row.product_id)),
  ]
  if (productIds.length === 0) return null

  // Both columns, matching every other scan catalog read (`searchScanCatalog`,
  // `loadActiveProductById`, the two save paths): `is_active` alone still lets a
  // `lifecycle_status = 'discontinued'` product resolve to a full verdict + buy link.
  const { data: productRows, error: productError } = await client
    .from("products")
    .select("id, category_key")
    .in("id", productIds)
    .eq("is_active", true)
    .eq("lifecycle_status", SCAN_ACTIVE_LIFECYCLE_STATUS)
  if (productError) throw new Error("scan_identifier_lookup_failed")

  const activeProducts = (productRows ?? []) as ActiveProductRow[]
  if (activeProducts.length === 0) return null

  const sorted = [...activeProducts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (sorted.length > 1) {
    console.error("scan_identifier_collision", {
      canonicalGtin14,
      productIds: sorted.map((product) => product.id),
    })
    return null
  }

  const [product] = sorted
  return { productId: product.id, category: product.category_key as PersonalPlanCategory }
}

export type ValidateEanInputResult =
  | { ok: true; type: "ean"; value: string }
  | { ok: false; reason: "length" | "checksum" }

/**
 * Manual-entry EAN validation shared by the client field and the resolve API route.
 * Digits only, EAN-8 or EAN-13, GS1 mod-10 check digit.
 */
export function validateEanInput(raw: string): ValidateEanInputResult {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed) || (trimmed.length !== 8 && trimmed.length !== 13)) {
    return { ok: false, reason: "length" }
  }
  if (!hasValidGs1CheckDigit(trimmed)) {
    return { ok: false, reason: "checksum" }
  }
  return { ok: true, type: "ean", value: trimmed }
}

/**
 * GS1 mod-10 check digit: from the digit immediately left of the check digit, weights
 * alternate 3, 1, 3, 1, … moving further left. Uniform across EAN-8 and EAN-13 because
 * both are defined relative to the rightmost (check) digit.
 */
