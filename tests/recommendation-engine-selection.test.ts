import assert from "node:assert/strict"
import test from "node:test"

import type { ProductBondbuilderSpecs } from "../src/lib/bondbuilder/constants"
import type { ProductConditionerSpecs } from "../src/lib/conditioner/constants"
import type { ProductDeepCleansingShampooSpecs } from "../src/lib/deep-cleansing-shampoo/constants"
import type { ProductDryShampooSpecs } from "../src/lib/dry-shampoo/constants"
import type { ProductLeaveInSpecs } from "../src/lib/leave-in/constants"
import type { ProductMaskSpecs } from "../src/lib/mask/constants"
import type { ProductPeelingSpecs } from "../src/lib/peeling/constants"
import type {
  BondbuilderRecommendationMetadata,
  DeepCleansingShampooRecommendationMetadata,
  DryShampooRecommendationMetadata,
  OilRecommendationMetadata,
  PeelingRecommendationMetadata,
  ShampooRecommendationMetadata,
} from "../src/lib/types"
import {
  type BondbuilderCategoryDecision,
  type DeepCleansingShampooCategoryDecision,
  type DryShampooCategoryDecision,
  type PeelingCategoryDecision,
  buildRecommendationRequestContext,
  buildRecommendationEngineRuntimeFromPersistence,
  rerankBondbuilderProductsWithEngine,
  rerankConditionerProductsWithEngine,
  rerankDeepCleansingShampooProductsWithEngine,
  rerankDryShampooProductsWithEngine,
  rerankLeaveInProductsWithEngine,
  rerankMaskProductsWithEngine,
  rerankOilProductsWithEngine,
  rerankPeelingProductsWithEngine,
  rerankShampooProductsWithEngine,
} from "../src/lib/recommendation-engine"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import {
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

function createMatchedProduct(
  id: string,
  category: MatchedProduct["category"],
  overrides: Partial<MatchedProduct> = {},
): MatchedProduct {
  return {
    id,
    name: `Product ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
    category,
    affiliate_link: null,
    image_url: null,
    price_eur: 19.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: ["protein", "feuchtigkeit", "performance", "moisture_anti_frizz", "repair"],
    is_active: true,
    sort_order: 0,
    created_at: "2026-04-15T00:00:00.000Z",
    updated_at: "2026-04-15T00:00:00.000Z",
    similarity: 0.8,
    combined_score: 0.8,
    ...overrides,
  }
}

test("engine conditioner reranking prefers explicit target fit over higher semantic score", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.conditioner

  const candidates = [
    createMatchedProduct("ideal", "Conditioner", { combined_score: 0.72 }),
    createMatchedProduct("mismatch", "Conditioner", { combined_score: 0.88 }),
  ]

  const specs: ProductConditionerSpecs[] = [
    {
      product_id: "ideal",
      weight: "medium",
      repair_level: "high",
      balance_direction: "moisture",
    },
    {
      product_id: "mismatch",
      weight: "rich",
      repair_level: "low",
      balance_direction: "protein",
    },
  ]

  const reranked = rerankConditionerProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: SEVERE_DAMAGE_PROFILE,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "conditioner")
})

test("engine mask reranking rewards complete fit metadata over unknown balance", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.mask

  const candidates = [
    createMatchedProduct("unknown", "Maske", { combined_score: 0.84 }),
    createMatchedProduct("ideal", "Maske", { combined_score: 0.76 }),
  ]

  const specs: ProductMaskSpecs[] = [
    {
      product_id: "unknown",
      format: "cream",
      weight: "medium",
      concentration: "high",
      balance_direction: null,
      benefits: [],
      ingredient_flags: [],
      leave_on_minutes: 10,
    },
    {
      product_id: "ideal",
      format: "cream",
      weight: "medium",
      concentration: "high",
      balance_direction: "moisture",
      benefits: [],
      ingredient_flags: [],
      leave_on_minutes: 10,
    },
  ]

  const reranked = rerankMaskProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "mask")
})

test("engine leave-in reranking strongly prefers heat-safe fit for heat styling profiles", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.leaveIn

  const candidates = [
    createMatchedProduct("supportive", "Leave-in", { combined_score: 0.86 }),
    createMatchedProduct("ideal", "Leave-in", { combined_score: 0.74 }),
  ]

  const specs: ProductLeaveInSpecs[] = [
    {
      product_id: "supportive",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner"],
      provides_heat_protection: false,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry"],
    },
    {
      product_id: "ideal",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: 220,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
  ]

  const reranked = rerankLeaveInProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: SEVERE_DAMAGE_PROFILE,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "leave_in")
})

test("engine shampoo reranking keeps the primary treatment bucket ahead of the rotation bucket", () => {
  const dandruffProfile = {
    ...LOW_DAMAGE_PROFILE,
    scalp_type: "oily" as const,
    scalp_condition: "dandruff" as const,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(dandruffProfile, [])
  const decision = runtime.categories.shampoo

  assert.equal(decision.relevant, true)
  assert.equal(decision.targetProfile?.shampooBucket, "schuppen")
  assert.equal(decision.targetProfile?.secondaryBucket, "dehydriert-fettig")

  const candidates = [
    createMatchedProduct("rotation", "Shampoo", { combined_score: 0.86 }),
    createMatchedProduct("treatment", "Shampoo", { combined_score: 0.75 }),
  ]

  const reranked = rerankShampooProductsWithEngine({
    candidates,
    decision,
    hairProfile: dandruffProfile,
    bucketByProductId: new Map([
      ["rotation", "dehydriert-fettig"],
      ["treatment", "schuppen"],
    ]),
  })

  assert.equal(reranked[0]?.id, "treatment")
  assert.equal(reranked[0]?.recommendation_meta?.category, "shampoo")
  assert.equal(
    (reranked[0]?.recommendation_meta as ShampooRecommendationMetadata | undefined)?.matched_bucket,
    "schuppen",
  )
  assert.equal(
    (reranked[1]?.recommendation_meta as ShampooRecommendationMetadata | undefined)?.matched_bucket,
    "dehydriert-fettig",
  )
})

test("engine shampoo reranking uses backfilled cleansing intensity inside the same bucket", () => {
  const oilyProfile = {
    ...LOW_DAMAGE_PROFILE,
    scalp_type: "oily" as const,
    scalp_condition: "none" as const,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(oilyProfile, [])
  const decision = runtime.categories.shampoo

  assert.equal(decision.targetProfile?.shampooBucket, "dehydriert-fettig")
  assert.equal(decision.targetProfile?.cleansingIntensity, "regular")

  const candidates = [
    createMatchedProduct("clarifying", "Shampoo", { combined_score: 0.87 }),
    createMatchedProduct("regular", "Shampoo", { combined_score: 0.74 }),
  ]

  const reranked = rerankShampooProductsWithEngine({
    candidates,
    decision,
    hairProfile: oilyProfile,
    bucketByProductId: new Map([
      ["clarifying", "dehydriert-fettig"],
      ["regular", "dehydriert-fettig"],
    ]),
    specs: [
      {
        product_id: "clarifying",
        thickness: oilyProfile.thickness!,
        shampoo_bucket: "dehydriert-fettig",
        scalp_route: "oily",
        cleansing_intensity: "clarifying",
      },
      {
        product_id: "regular",
        thickness: oilyProfile.thickness!,
        shampoo_bucket: "dehydriert-fettig",
        scalp_route: "oily",
        cleansing_intensity: "regular",
      },
    ],
  })

  assert.equal(reranked[0]?.id, "regular")
})

test("engine oil reranking follows normalized request purpose and annotates the legacy matcher bridge", () => {
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein Styling-Oel als Finish gegen Frizz und fuer mehr Glanz.",
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    LOW_DAMAGE_PROFILE,
    [],
    requestContext,
  )
  const decision = runtime.categories.oil

  assert.equal(decision.relevant, true)
  assert.equal(decision.targetProfile?.purpose, "styling_finish")
  assert.equal(decision.targetProfile?.matcherSubtype, "styling-oel")

  const reranked = rerankOilProductsWithEngine({
    candidates: [
      createMatchedProduct("oil-1", "Öle", { combined_score: 0.81 }),
      createMatchedProduct("oil-2", "Öle", { combined_score: 0.77 }),
    ],
    decision,
    hairProfile: LOW_DAMAGE_PROFILE,
  })

  assert.equal(reranked[0]?.recommendation_meta?.category, "oil")
  assert.equal(
    (reranked[0]?.recommendation_meta as OilRecommendationMetadata | undefined)?.use_mode,
    "styling_finish",
  )
  assert.equal(
    (reranked[0]?.recommendation_meta as OilRecommendationMetadata | undefined)?.matched_subtype,
    "styling-oel",
  )
})

test("engine oil reranking prefers exact oil-purpose matches over subtype-only bridge candidates", () => {
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein leichtes Oel als Finish gegen Frizz und fuer mehr Glanz.",
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    LOW_DAMAGE_PROFILE,
    [],
    requestContext,
  )
  const decision = runtime.categories.oil

  const reranked = rerankOilProductsWithEngine({
    candidates: [
      createMatchedProduct("subtype-only", "Öle", { combined_score: 0.86 }),
      createMatchedProduct("purpose-exact", "Öle", { combined_score: 0.74 }),
    ],
    decision,
    hairProfile: LOW_DAMAGE_PROFILE,
    eligibilityRows: [
      {
        product_id: "subtype-only",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "light_finish",
      },
      {
        product_id: "purpose-exact",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "styling_finish",
      },
    ],
  })

  assert.equal(reranked[0]?.id, "purpose-exact")
})

test("engine bondbuilder reranking prefers exact intensity and application fit over a higher semantic score", () => {
  const decision: BondbuilderCategoryDecision = {
    category: "bondbuilder",
    relevant: true,
    action: "add",
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: {
      bondRepairIntensity: "intensive",
      applicationMode: "pre_shampoo",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("supportive", "Bondbuilder", { combined_score: 0.87 }),
    createMatchedProduct("ideal", "Bondbuilder", { combined_score: 0.73 }),
  ]

  const specs: ProductBondbuilderSpecs[] = [
    {
      product_id: "supportive",
      bond_repair_intensity: "intensive",
      application_mode: "post_wash_leave_in",
    },
    {
      product_id: "ideal",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
    },
  ]

  const reranked = rerankBondbuilderProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "bondbuilder")
  assert.equal(
    (reranked[0]?.recommendation_meta as BondbuilderRecommendationMetadata | undefined)
      ?.application_mode,
    "pre_shampoo",
  )
})

test("engine deep-cleansing shampoo reranking prefers the exact scalp focus over a balanced fallback", () => {
  const decision: DeepCleansingShampooCategoryDecision = {
    category: "deep_cleansing_shampoo",
    relevant: true,
    action: "add",
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: {
      scalpTypeFocus: "oily",
      resetNeedLevel: "moderate",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("balanced", "Deep Cleansing Shampoo", { combined_score: 0.85 }),
    createMatchedProduct("ideal", "Deep Cleansing Shampoo", { combined_score: 0.74 }),
  ]

  const specs: ProductDeepCleansingShampooSpecs[] = [
    {
      product_id: "balanced",
      scalp_type_focus: "balanced",
    },
    {
      product_id: "ideal",
      scalp_type_focus: "oily",
    },
  ]

  const reranked = rerankDeepCleansingShampooProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "deep_cleansing_shampoo")
  assert.equal(
    (reranked[0]?.recommendation_meta as DeepCleansingShampooRecommendationMetadata | undefined)
      ?.scalp_type_focus,
    "oily",
  )
})

test("engine dry shampoo reranking keeps the oily-focus candidate ahead of a broader balanced option", () => {
  const decision: DryShampooCategoryDecision = {
    category: "dry_shampoo",
    relevant: true,
    action: "add",
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: {
      scalpTypeFocus: "oily",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("balanced", "Dry Shampoo", { combined_score: 0.84 }),
    createMatchedProduct("ideal", "Dry Shampoo", { combined_score: 0.75 }),
  ]

  const specs: ProductDryShampooSpecs[] = [
    {
      product_id: "balanced",
      scalp_type_focus: "balanced",
    },
    {
      product_id: "ideal",
      scalp_type_focus: "oily",
    },
  ]

  const reranked = rerankDryShampooProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "dry_shampoo")
  assert.equal(
    (reranked[0]?.recommendation_meta as DryShampooRecommendationMetadata | undefined)
      ?.scalp_type_focus,
    "oily",
  )
})

test("engine peeling reranking requires both scalp-focus and peeling-type alignment", () => {
  const decision: PeelingCategoryDecision = {
    category: "peeling",
    relevant: true,
    action: "add",
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: {
      scalpTypeFocus: "oily",
      peelingType: "acid_serum",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("mismatch", "Peeling", { combined_score: 0.88 }),
    createMatchedProduct("ideal", "Peeling", { combined_score: 0.72 }),
  ]

  const specs: ProductPeelingSpecs[] = [
    {
      product_id: "mismatch",
      scalp_type_focus: "oily",
      peeling_type: "physical_scrub",
    },
    {
      product_id: "ideal",
      scalp_type_focus: "oily",
      peeling_type: "acid_serum",
    },
  ]

  const reranked = rerankPeelingProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "ideal")
  assert.equal(reranked[0]?.recommendation_meta?.category, "peeling")
  assert.equal(
    (reranked[0]?.recommendation_meta as PeelingRecommendationMetadata | undefined)?.peeling_type,
    "acid_serum",
  )
})

test("engine selectors stay inert when shared engine does not surface those categories", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "shampoo",
      product_name: "Gentle Shampoo",
      frequency_range: "3_4x",
    },
    {
      category: "conditioner",
      product_name: "Daily Conditioner",
      frequency_range: "3_4x",
    },
  ])

  assert.equal(runtime.categories.conditioner.relevant, false)
  assert.equal(runtime.categories.mask.relevant, false)
  assert.equal(runtime.categories.leaveIn.relevant, false)
  assert.equal(runtime.categories.oil.relevant, false)
})
