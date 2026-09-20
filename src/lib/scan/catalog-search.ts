import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"

/**
 * Shared catalog-search matcher used by both the web scan search route
 * (`src/app/api/scan/search/route.ts`) and the mobile scan search service
 * (`src/lib/mobile/scan-service.ts`). Extracted from mobile's identity-title matching
 * (shipped in PR #590) so both surfaces rank results the same way.
 *
 * Callers own loading candidate rows (with the `brands`/`product_lines` joins already
 * normalized to a single relation, not an array) and quarantine filtering; this module
 * only matches/ranks and shapes the shared result fields.
 */
export type CatalogSearchCandidate = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  sort_order: number | null
  brand_identity: { canonical_name: string | null } | null
  product_line: { canonical_name: string | null } | null
}

export type ScanSearchResult = {
  id: string
  name: string
  brand: string | null
  category: PersonalPlanCategory
  categoryLabel: string
  imageUrl: string | null
}

function identityParts(row: CatalogSearchCandidate) {
  return {
    brand: row.brand_identity?.canonical_name ?? row.brand,
    productLine: row.product_line?.canonical_name ?? null,
    name: row.name,
  }
}

function normalizedIdentityTitle(row: CatalogSearchCandidate): string {
  return composeProductIdentityTitle(identityParts(row)).toLocaleLowerCase()
}

/**
 * Substring match over the composed product identity title (brand + product line + name,
 * de-duplicated), exact-match-first ranking, then sort_order → localeCompare(de) → id.
 */
export function matchCatalogProducts(
  rows: CatalogSearchCandidate[],
  query: string,
): CatalogSearchCandidate[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = rows.filter((row) => normalizedIdentityTitle(row).includes(normalizedQuery))

  matches.sort((left, right) => {
    const leftExact = normalizedIdentityTitle(left) === normalizedQuery ? -1 : 0
    const rightExact = normalizedIdentityTitle(right) === normalizedQuery ? -1 : 0
    return (
      leftExact - rightExact ||
      (left.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (right.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name, "de") ||
      left.id.localeCompare(right.id)
    )
  })

  return matches
}

export function toScanSearchResult(row: CatalogSearchCandidate): ScanSearchResult {
  return {
    id: row.id,
    name: row.name,
    brand: identityParts(row).brand,
    category: row.category_key as PersonalPlanCategory,
    categoryLabel: CATEGORY_COPY[row.category_key as PersonalPlanCategory].label,
    imageUrl: row.image_url,
  }
}
