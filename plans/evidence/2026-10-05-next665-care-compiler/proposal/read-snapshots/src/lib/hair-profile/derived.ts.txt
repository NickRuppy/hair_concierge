import { PRODUCT_CATEGORY_LABELS } from "@/lib/onboarding/product-options"
import {
  getVisibleProductUsageItems,
  type ProductUsageFrequencyLike,
} from "@/lib/product-usage/shampoo-fallback"
import type { HairProfile } from "@/lib/types"
import {
  chooseHigherProductFrequency,
  normalizeProductFrequency,
  ROUTINE_PRODUCTS,
  type RoutineProduct,
  type ProductFrequency,
} from "@/lib/vocabulary"

export type RoutineInventoryLike = ProductUsageFrequencyLike

const LEGACY_ROUTINE_PRODUCT_SET = new Set<RoutineProduct>(ROUTINE_PRODUCTS)

function normalizeRoutineProductCategory(category: string): RoutineProduct | null {
  return LEGACY_ROUTINE_PRODUCT_SET.has(category as RoutineProduct)
    ? (category as RoutineProduct)
    : null
}

export function deriveShampooFrequencyFromRoutineItems(
  routineItems: RoutineInventoryLike[],
): ProductFrequency | null {
  return routineItems.reduce<ProductFrequency | null>((highestFrequency, item) => {
    if (item.category !== "shampoo") return highestFrequency
    return chooseHigherProductFrequency(
      highestFrequency,
      normalizeProductFrequency(item.frequency_range),
    )
  }, null)
}

export function deriveCurrentRoutineProductsFromRoutineItems(
  routineItems: RoutineInventoryLike[],
  fallback: RoutineProduct[] | null = null,
): RoutineProduct[] | null {
  if (routineItems.length === 0) return fallback

  const categories = Array.from(
    new Set(
      getVisibleProductUsageItems(routineItems)
        .map((item) => normalizeRoutineProductCategory(item.category))
        .filter((item): item is RoutineProduct => item !== null),
    ),
  )

  return categories.length > 0 ? categories : null
}

export function deriveProductsUsedFromRoutineItems(
  routineItems: RoutineInventoryLike[],
  fallback: string | null = null,
): string | null {
  if (routineItems.length === 0) return fallback

  const items = getVisibleProductUsageItems(routineItems).map((item) => {
    const categoryLabel = PRODUCT_CATEGORY_LABELS[item.category] ?? item.category
    const productName = item.product_name?.trim()

    return productName ? `${categoryLabel}: ${productName}` : categoryLabel
  })

  return items.length > 0 ? items.join(", ") : null
}

export function deriveDesiredVolumeFromGoals(
  goals: string[] | null | undefined,
  fallback: HairProfile["desired_volume"],
): HairProfile["desired_volume"] {
  if (!goals || goals.length === 0) return fallback

  if (goals.includes("volume")) return "more"
  if (goals.includes("less_volume")) return "less"

  return null
}

export function hydrateHairProfileForConsumers(
  profile: HairProfile | null,
  routineItems: RoutineInventoryLike[],
): HairProfile | null {
  if (!profile) return null

  return {
    ...profile,
    shampoo_frequency: deriveShampooFrequencyFromRoutineItems(routineItems),
    current_routine_products: deriveCurrentRoutineProductsFromRoutineItems(
      routineItems,
      profile.current_routine_products ?? null,
    ),
    products_used: deriveProductsUsedFromRoutineItems(routineItems, profile.products_used),
    desired_volume: deriveDesiredVolumeFromGoals(profile.goals, profile.desired_volume),
  }
}
