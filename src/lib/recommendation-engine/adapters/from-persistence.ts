import type { HairProfile, RoutineProduct } from "@/lib/types"
import {
  deriveShampooFrequencyFromRoutineItems,
  type RoutineInventoryLike,
} from "@/lib/hair-profile/derived"
import {
  chooseHigherProductFrequency,
  normalizeNightProtectionValues,
  normalizeProductFrequency,
  type ProductFrequency,
  type ProductFrequencyInput,
} from "@/lib/vocabulary"
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

export interface PersistenceRoutineItemRow {
  category: string
  product_name: string | null
  frequency_range: ProductFrequencyInput | string | null
}

export interface AdaptedRecommendationInput {
  input: RawRecommendationInput
  unsupportedRoutineCategories: string[]
}

export interface AdaptRecommendationInputOptions {
  derivedShampooFrequency?: ProductFrequency | null
}

export function buildRoutineItemsFromInventoryCategories(
  categories: RoutineProduct[] | null | undefined,
): PersistenceRoutineItemRow[] {
  return (categories ?? []).map((category) => ({
    category,
    product_name: null,
    frequency_range: null,
  }))
}

function emptyRawHairProfileInput(): RawHairProfileInput {
  return {
    hair_texture: null,
    thickness: null,
    hair_length: null,
    density: null,
    concerns: [],
    goals: [],
    shampoo_frequency: null,
    heat_styling: null,
    styling_tools: null,
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
  }
}

function buildRawHairProfileInput(
  profile: HairProfile | null,
  routineItems: RoutineInventoryLike[],
  options: AdaptRecommendationInputOptions,
): RawHairProfileInput {
  if (!profile) {
    return emptyRawHairProfileInput()
  }

  const derivedShampooRoutineFrequency = deriveShampooFrequencyFromRoutineItems(routineItems)
  const derivedShampooFrequency = options.derivedShampooFrequency ?? null

  return {
    hair_texture: profile.hair_texture,
    thickness: profile.thickness,
    hair_length: profile.hair_length ?? null,
    density: profile.density,
    concerns: profile.concerns ?? [],
    goals: profile.goals ?? [],
    shampoo_frequency: derivedShampooRoutineFrequency ?? derivedShampooFrequency,
    heat_styling: profile.heat_styling,
    styling_tools: profile.styling_tools ?? null,
    cuticle_condition: profile.cuticle_condition,
    protein_moisture_balance: profile.protein_moisture_balance,
    scalp_type: profile.scalp_type,
    scalp_condition: profile.scalp_condition,
    chemical_treatment: profile.chemical_treatment ?? [],
    towel_material: profile.towel_material,
    towel_technique: profile.towel_technique,
    drying_method: profile.drying_method,
    brush_type: profile.brush_type,
    night_protection: normalizeNightProtectionValues(profile.night_protection),
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
  incoming: ProductFrequencyInput | string | null,
): boolean {
  const normalizedIncoming = normalizeProductFrequency(incoming)
  return chooseHigherProductFrequency(current, normalizedIncoming) === normalizedIncoming
}

export function adaptRecommendationInputFromPersistence(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
  options: AdaptRecommendationInputOptions = {},
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
    const frequency = normalizeProductFrequency(item.frequency_range)
    if (!current) {
      supportedItems.set(canonicalCategory, {
        category: canonicalCategory,
        product_name: item.product_name,
        frequency_range: frequency,
      })
      continue
    }

    supportedItems.set(canonicalCategory, {
      category: canonicalCategory,
      product_name: current.product_name ?? item.product_name,
      frequency_range: shouldReplaceFrequency(current.frequency_range, frequency)
        ? frequency
        : current.frequency_range,
    })
  }

  return {
    input: {
      profile: buildRawHairProfileInput(profile, routineItems, options),
      routineInventory: [...supportedItems.values()],
    },
    unsupportedRoutineCategories,
  }
}
