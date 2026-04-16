import type { ProductScalpTypeFocus } from "@/lib/product-specs/constants"

export const DRY_SHAMPOO_DB_CATEGORIES = [
  "Trockenshampoo",
  "Dry Shampoo",
  "dry_shampoo",
  "dry shampoo",
] as const

export type DryShampooScalpTypeFocus = Exclude<ProductScalpTypeFocus, "dry">

export interface ProductDryShampooSpecs {
  product_id: string
  scalp_type_focus: DryShampooScalpTypeFocus
  created_at?: string
  updated_at?: string
}

export function isDryShampooCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return (
    normalized === "trockenshampoo" || normalized === "dry shampoo" || normalized === "dry_shampoo"
  )
}
