import {
  DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY,
  SHAMPOO_CATEGORY,
  UNSELECTED_SHAMPOO_PRODUCT_NAME,
} from "@/lib/product-usage/shampoo-fallback"
import type { ProductFrequency } from "@/lib/vocabulary"

interface ProductUsageDrilldown {
  productName: string
  frequency: ProductFrequency | null
}

interface BuildProductUsagePayloadsParams {
  selectedCategories: string[]
  drilldowns: Record<string, ProductUsageDrilldown>
}

export function buildProductUsagePayloads({
  selectedCategories,
  drilldowns,
}: BuildProductUsagePayloadsParams) {
  const categories: string[] = []
  let hasShampoo = false

  for (const category of selectedCategories) {
    if (categories.includes(category)) continue

    if (category === SHAMPOO_CATEGORY) {
      hasShampoo = true
    }

    categories.push(category)
  }

  if (!hasShampoo) {
    categories.push(SHAMPOO_CATEGORY)
  }

  return categories.map((category) => {
    const drilldown = drilldowns[category]
    const isUnselectedShampoo = category === SHAMPOO_CATEGORY && !hasShampoo

    return {
      category,
      product_name: isUnselectedShampoo
        ? UNSELECTED_SHAMPOO_PRODUCT_NAME
        : (drilldown?.productName ?? null),
      frequency_range: isUnselectedShampoo
        ? DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY
        : (drilldown?.frequency ?? null),
    }
  })
}
