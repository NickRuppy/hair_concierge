import type { HairProfile } from "@/lib/types"
import type { ProductFrequency } from "@/lib/vocabulary"
import type {
  InventoryCategory,
  RawHairProfileInput,
  RawRecommendationInput,
} from "@/lib/recommendation-engine/types"

const DIRECT_INVENTORY_CATEGORIES = new Set<InventoryCategory>([
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
])

const CATEGORY_CANONICALIZATION: Record<string, InventoryCategory> = {
  serum: "peeling",
  scrub: "peeling",
}

const PRODUCT_FREQUENCY_RANK: Record<ProductFrequency, number> = {
  rarely: 0,
  "1_2x": 1,
  "3_4x": 2,
  "5_6x": 3,
  daily: 4,
}

export interface PersistenceRoutineItemRow {
  category: string
  product_name: string | null
  frequency_range: ProductFrequency | null
}

export interface AdaptedRecommendationInput {
  input: RawRecommendationInput
  unsupportedRoutineCategories: string[]
}

export function buildRoutineItemsFromCurrentRoutineProducts(
  profile: HairProfile | null,
): PersistenceRoutineItemRow[] {
  return (profile?.current_routine_products ?? []).map((category) => ({
    category,
    product_name: null,
    frequency_range: null,
  }))
}

function emptyRawHairProfileInput(): RawHairProfileInput {
  return {
    hair_texture: null,
    thickness: null,
    density: null,
    concerns: [],
    goals: [],
    wash_frequency: null,
    heat_styling: null,
    styling_tools: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    post_wash_actions: [],
    mechanical_stress_factors: [],
    towel_material: null,
    towel_technique: null,
    drying_method: [],
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
  }
}

function buildRawHairProfileInput(profile: HairProfile | null): RawHairProfileInput {
  if (!profile) {
    return emptyRawHairProfileInput()
  }

  return {
    hair_texture: profile.hair_texture,
    thickness: profile.thickness,
    density: profile.density,
    concerns: profile.concerns ?? [],
    goals: profile.goals ?? [],
    wash_frequency: profile.wash_frequency,
    heat_styling: profile.heat_styling,
    styling_tools: profile.styling_tools ?? [],
    cuticle_condition: profile.cuticle_condition,
    protein_moisture_balance: profile.protein_moisture_balance,
    scalp_type: profile.scalp_type,
    scalp_condition: profile.scalp_condition,
    chemical_treatment: profile.chemical_treatment ?? [],
    post_wash_actions: profile.post_wash_actions ?? [],
    mechanical_stress_factors: profile.mechanical_stress_factors ?? [],
    towel_material: profile.towel_material,
    towel_technique: profile.towel_technique,
    drying_method: profile.drying_method ?? [],
    brush_type: profile.brush_type,
    night_protection: profile.night_protection ?? [],
    uses_heat_protection: profile.uses_heat_protection ?? false,
  }
}

function canonicalizeInventoryCategory(category: string): InventoryCategory | null {
  if (DIRECT_INVENTORY_CATEGORIES.has(category as InventoryCategory)) {
    return category as InventoryCategory
  }

  return CATEGORY_CANONICALIZATION[category] ?? null
}

function shouldReplaceFrequency(
  current: ProductFrequency | null,
  incoming: ProductFrequency | null,
): boolean {
  if (incoming === null) return false
  if (current === null) return true

  return PRODUCT_FREQUENCY_RANK[incoming] > PRODUCT_FREQUENCY_RANK[current]
}

export function adaptRecommendationInputFromPersistence(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
): AdaptedRecommendationInput {
  const unsupportedRoutineCategories: string[] = []
  const supportedItems = new Map<
    InventoryCategory,
    RawRecommendationInput["routineInventory"][number]
  >()

  for (const item of routineItems) {
    const canonicalCategory = canonicalizeInventoryCategory(item.category)

    if (!canonicalCategory) {
      unsupportedRoutineCategories.push(item.category)
      continue
    }

    const current = supportedItems.get(canonicalCategory)
    if (!current) {
      supportedItems.set(canonicalCategory, {
        category: canonicalCategory,
        product_name: item.product_name,
        frequency_range: item.frequency_range,
      })
      continue
    }

    supportedItems.set(canonicalCategory, {
      category: canonicalCategory,
      product_name: current.product_name ?? item.product_name,
      frequency_range: shouldReplaceFrequency(current.frequency_range, item.frequency_range)
        ? item.frequency_range
        : current.frequency_range,
    })
  }

  return {
    input: {
      profile: buildRawHairProfileInput(profile),
      routineInventory: [...supportedItems.values()],
    },
    unsupportedRoutineCategories,
  }
}
