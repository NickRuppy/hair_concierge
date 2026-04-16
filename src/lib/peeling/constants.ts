import type { ProductPeelingType, ProductScalpTypeFocus } from "@/lib/product-specs/constants"

export const PEELING_DB_CATEGORIES = ["Peeling", "peeling"] as const

export interface ProductPeelingSpecs {
  product_id: string
  scalp_type_focus: ProductScalpTypeFocus
  peeling_type: ProductPeelingType
  created_at?: string
  updated_at?: string
}

export function isPeelingCategory(category: string | null | undefined): boolean {
  if (!category) return false
  return category.trim().toLowerCase() === "peeling"
}
