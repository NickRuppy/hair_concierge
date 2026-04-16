import type { ProductScalpTypeFocus } from "@/lib/product-specs/constants"

export const DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES = [
  "Tiefenreinigungsshampoo",
  "Deep Cleansing Shampoo",
  "deep_cleansing_shampoo",
  "deep cleansing shampoo",
] as const

export interface ProductDeepCleansingShampooSpecs {
  product_id: string
  scalp_type_focus: ProductScalpTypeFocus
  created_at?: string
  updated_at?: string
}

export function isDeepCleansingShampooCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return (
    normalized === "tiefenreinigungsshampoo" ||
    normalized === "deep cleansing shampoo" ||
    normalized === "deep_cleansing_shampoo"
  )
}
