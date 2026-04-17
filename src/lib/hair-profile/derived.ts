import { PRODUCT_CATEGORY_LABELS } from "@/lib/onboarding/product-options"
import type { HairProfile } from "@/lib/types"
import {
  ROUTINE_PRODUCTS,
  type ProductFrequency,
  type RoutineProduct,
  type WashFrequency,
} from "@/lib/vocabulary"

export type RoutineInventoryLike = {
  category: string
  product_name: string | null
  frequency_range: ProductFrequency | null
}

const LEGACY_ROUTINE_PRODUCT_SET = new Set<RoutineProduct>(ROUTINE_PRODUCTS)

function mapProductFrequencyToWashFrequency(freq: ProductFrequency): WashFrequency {
  switch (freq) {
    case "daily":
      return "daily"
    case "5_6x":
      return "daily"
    case "3_4x":
      return "every_2_3_days"
    case "1_2x":
      return "once_weekly"
    case "rarely":
      return "rarely"
  }
}

function normalizeRoutineProductCategory(category: string): RoutineProduct | null {
  return LEGACY_ROUTINE_PRODUCT_SET.has(category as RoutineProduct)
    ? (category as RoutineProduct)
    : null
}

export function deriveWashFrequencyFromRoutineItems(
  routineItems: RoutineInventoryLike[],
  fallback: WashFrequency | null = null,
): WashFrequency | null {
  const shampooEntry = routineItems.find(
    (item) => item.category === "shampoo" && item.frequency_range !== null,
  )

  return shampooEntry?.frequency_range
    ? mapProductFrequencyToWashFrequency(shampooEntry.frequency_range)
    : fallback
}

export function deriveCurrentRoutineProductsFromRoutineItems(
  routineItems: RoutineInventoryLike[],
  fallback: RoutineProduct[] | null = null,
): RoutineProduct[] | null {
  const categories = Array.from(
    new Set(
      routineItems
        .map((item) => normalizeRoutineProductCategory(item.category))
        .filter((item): item is RoutineProduct => item !== null),
    ),
  )

  return categories.length > 0 ? categories : fallback
}

export function deriveProductsUsedFromRoutineItems(
  routineItems: RoutineInventoryLike[],
  fallback: string | null = null,
): string | null {
  if (routineItems.length === 0) return fallback

  const items = routineItems.map((item) => {
    const categoryLabel = PRODUCT_CATEGORY_LABELS[item.category] ?? item.category
    const productName = item.product_name?.trim()

    return productName ? `${categoryLabel}: ${productName}` : categoryLabel
  })

  return items.length > 0 ? items.join(", ") : fallback
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
    wash_frequency: deriveWashFrequencyFromRoutineItems(routineItems, profile.wash_frequency),
    current_routine_products: deriveCurrentRoutineProductsFromRoutineItems(
      routineItems,
      profile.current_routine_products ?? null,
    ),
    products_used: deriveProductsUsedFromRoutineItems(routineItems, profile.products_used),
    desired_volume: deriveDesiredVolumeFromGoals(profile.goals, profile.desired_volume),
  }
}
