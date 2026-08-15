import { normalizeCategoryKey } from "@/lib/product-identity"

export const PRODUCT_RECATEGORIZATION_REQUIRES_GUARDED_REPAIR =
  "Die Produktkategorie kann hier nicht geändert werden. Bitte nutze den geprüften Kategoriewechsel."

export function requiresGuardedProductRecategorization(
  currentCategoryKey: string | null | undefined,
  nextCategory: string | null | undefined,
): boolean {
  const currentKey = normalizeCategoryKey(currentCategoryKey)
  const nextKey = normalizeCategoryKey(nextCategory)
  return currentKey === null || nextKey === null || currentKey !== nextKey
}
