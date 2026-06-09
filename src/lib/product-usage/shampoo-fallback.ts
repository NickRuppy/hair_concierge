import type { ProductFrequency } from "@/lib/vocabulary"

export const SHAMPOO_CATEGORY = "shampoo"
export const UNSELECTED_SHAMPOO_PRODUCT_NAME = "__system_no_shampoo_selected__"
export const DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY: ProductFrequency = "less_than_monthly"

export interface ProductUsageFrequencyLike {
  category: string
  product_name: string | null
  frequency_range: string | null
}

export function isUnselectedShampooFallbackItem(item: ProductUsageFrequencyLike): boolean {
  return (
    item.category === SHAMPOO_CATEGORY &&
    item.product_name === UNSELECTED_SHAMPOO_PRODUCT_NAME &&
    item.frequency_range === DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY
  )
}

export function getVisibleProductUsageItems<T extends ProductUsageFrequencyLike>(items: T[]): T[] {
  return items.filter((item) => !isUnselectedShampooFallbackItem(item))
}
