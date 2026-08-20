import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { presentCatalogCommerce } from "@/lib/personal-plan/routine/commerce"

import type { ScanPresentedVerdictPayload, ScanProductHeader, ScanVerdictPayload } from "./types"

/**
 * Catalog presentation, joined onto the verdict after the fact.
 *
 * The verdict core (`resolve-verdict.ts`) runs on Stage-3 authority facts, and those
 * deliberately exclude identity/commerce fields that must never influence a fit verdict —
 * there is no brand on them at all, and the purchase link is not carried through the
 * comparison. The sheet needs both (spec §2.1 product header, §3 "Kaufen · <Preis>"), so
 * the resolve route reads the plain catalog rows for the scanned product plus its
 * alternatives and applies this module. Price/link copy comes from `presentCatalogCommerce`
 * so scan, routine drawer and Stage-1 previews never word the same product differently.
 */

export type ScanCatalogPresentationRow = {
  id: string
  name: string
  brand: string | null
  category: PersonalPlanCategory
  imageUrl: string | null
  priceEur: number | null
  currency: string | null
  affiliateLink: string | null
  purchaseLinkStatus: "available" | "unavailable" | null
  priceCheckedAt: string | null
}

function commerceFor(row: ScanCatalogPresentationRow) {
  return presentCatalogCommerce({
    priceEur: row.priceEur,
    currency: row.currency,
    affiliateLink: row.affiliateLink,
    purchaseLinkStatus: row.purchaseLinkStatus,
    updatedAt: row.priceCheckedAt,
  })
}

export function toScanProductHeader(row: ScanCatalogPresentationRow): ScanProductHeader {
  const commerce = commerceFor(row)
  return {
    productId: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    categoryLabel: CATEGORY_COPY[row.category].label,
    imageUrl: row.imageUrl,
    priceLabel: commerce.priceLabel,
    purchaseUrl: commerce.productUrl,
  }
}

export function presentScanVerdictPayload(
  verdict: ScanVerdictPayload,
  rows: readonly ScanCatalogPresentationRow[],
): ScanPresentedVerdictPayload {
  if (verdict.kind === "not_needed") return verdict
  const byId = new Map(rows.map((row) => [row.id, row]))
  return {
    ...verdict,
    alternatives: verdict.alternatives.map((alternative) => {
      const row = byId.get(alternative.productId)
      return {
        ...alternative,
        brand: row?.brand ?? null,
        purchaseUrl: row ? commerceFor(row).productUrl : null,
      }
    }),
  }
}
