import assert from "node:assert/strict"
import test from "node:test"

import type { ProductBondbuilderSpecs } from "../src/lib/bondbuilder/constants"
import type { ProductConditionerRerankSpecs } from "../src/lib/conditioner/constants"
import type { ProductDeepCleansingShampooSpecs } from "../src/lib/deep-cleansing-shampoo/constants"
import type { ProductDryShampooSpecs } from "../src/lib/dry-shampoo/constants"
import type { ProductLeaveInSpecs } from "../src/lib/leave-in/constants"
import type { ProductMaskSpecs } from "../src/lib/mask/constants"
import type { ProductPeelingSpecs } from "../src/lib/peeling/constants"
import type {
  BondbuilderRecommendationMetadata,
  DeepCleansingShampooRecommendationMetadata,
  DryShampooRecommendationMetadata,
  LeaveInRecommendationMetadata,
  OilRecommendationMetadata,
  PeelingRecommendationMetadata,
  ShampooRecommendationMetadata,
} from "../src/lib/types"
import {
  type BondbuilderCategoryDecision,
  type DeepCleansingShampooCategoryDecision,
  type DryShampooCategoryDecision,
  type MaskCategoryDecision,
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
import type { HairProfile } from "../src/lib/types"

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

function createMaskDecision(
  targetProfile: Partial<NonNullable<MaskCategoryDecision["targetProfile"]>>,
): MaskCategoryDecision {
  const { intensityRequest = null, ...targetProfileRest } = targetProfile

  return {
    category: "mask",
    relevant: true,
    action: "add",
    planReasonCodes: ["test_mask_need"],
    currentInventory: null,
    targetProfile: {
      balance: "protein",
      repairLevel: "medium",
      weight: "medium",
      needStrength: 2,
      role: "fixed",
      thickness: "normal",
      density: "medium",
      ...targetProfileRest,
      intensityRequest,
    },
    notes: [],
  }
}

test("engine conditioner reranking prefers explicit target fit over higher semantic score", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.conditioner

  const candidates = [
    createMatchedProduct("ideal", "Conditioner", { combined_score: 0.72 }),
    createMatchedProduct("mismatch", "Conditioner", { combined_score: 0.88 }),
  ]

  const specs: ProductConditionerRerankSpecs[] = [
    {
      product_id: "ideal",
      weight: "medium",
      repair_level: "high",
      balance_direction: "moisture",
      ingredient_flags: [],
    },
    {
      product_id: "mismatch",
      weight: "rich",
      repair_level: "low",
      balance_direction: "protein",
      ingredient_flags: [],
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

test("engine conditioner reranking excludes mismatches when three non-mismatches exist", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.conditioner

  const candidates = [
    createMatchedProduct("ideal", "Conditioner", { combined_score: 0.72 }),
    createMatchedProduct("support-weight", "Conditioner", { combined_score: 0.71 }),
    createMatchedProduct("support-balance", "Conditioner", { combined_score: 0.7 }),
    createMatchedProduct("mismatch", "Conditioner", { combined_score: 0.95 }),
  ]

  const specs: ProductConditionerRerankSpecs[] = [
    {
      product_id: "ideal",
      weight: "medium",
      repair_level: "high",
      balance_direction: "moisture",
      ingredient_flags: [],
    },
    {
      product_id: "support-weight",
      weight: "light",
      repair_level: "high",
      balance_direction: "moisture",
      ingredient_flags: [],
    },
    {
      product_id: "support-balance",
      weight: "medium",
      repair_level: "high",
      balance_direction: "balanced",
      ingredient_flags: [],
    },
    {
      product_id: "mismatch",
      weight: "rich",
      repair_level: "low",
      balance_direction: "protein",
      ingredient_flags: [],
    },
  ]

  const reranked = rerankConditionerProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: SEVERE_DAMAGE_PROFILE,
  })

  assert.deepEqual(
    new Set(reranked.map((product) => product.id)),
    new Set(["ideal", "support-weight", "support-balance"]),
  )
  assert.equal(
    reranked.some((product) => product.id === "mismatch"),
    false,
  )
})

test("engine conditioner reranking marks fallback mismatches when coverage is insufficient", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.conditioner

  const candidates = [
    createMatchedProduct("ideal", "Conditioner", { combined_score: 0.72 }),
    createMatchedProduct("mismatch", "Conditioner", { combined_score: 0.95 }),
  ]

  const specs: ProductConditionerRerankSpecs[] = [
    {
      product_id: "ideal",
      weight: "medium",
      repair_level: "high",
      balance_direction: "moisture",
      ingredient_flags: [],
    },
    {
      product_id: "mismatch",
      weight: "rich",
      repair_level: "low",
      balance_direction: "protein",
      ingredient_flags: [],
    },
  ]

  const reranked = rerankConditionerProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: SEVERE_DAMAGE_PROFILE,
  })

  assert.equal(reranked.length, 2)
  assert.equal(reranked[1]?.id, "mismatch")
  assert.match(reranked[1]?.recommendation_meta?.tradeoffs[0] ?? "", /^Fallback:/)
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
      weight: "medium",
      concentration: "high",
      balance_direction: null,
      ingredient_flags: [],
    },
    {
      product_id: "ideal",
      weight: "medium",
      concentration: "high",
      balance_direction: "moisture",
      ingredient_flags: [],
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

test("engine mask reranking prefers medium concentration for medium mask need", () => {
  const decision = createMaskDecision({
    balance: "protein",
    repairLevel: "medium",
    weight: "medium",
    needStrength: 2,
  })

  const candidates = [
    createMatchedProduct("high", "Maske", { combined_score: 0.9 }),
    createMatchedProduct("medium", "Maske", { combined_score: 0.75 }),
  ]

  const specs: ProductMaskSpecs[] = [
    {
      product_id: "high",
      weight: "medium",
      concentration: "high",
      balance_direction: "protein",
      ingredient_flags: [],
    },
    {
      product_id: "medium",
      weight: "medium",
      concentration: "medium",
      balance_direction: "protein",
      ingredient_flags: [],
    },
  ]

  const reranked = rerankMaskProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "medium")
  assert.match(reranked[1]?.recommendation_meta?.tradeoffs.join(" ") ?? "", /sparsam/)
  assert.equal("_fitReasonCodes" in reranked[0], false)
})

test("engine mask reranking prioritizes light weight for light mask targets", () => {
  const decision = createMaskDecision({
    balance: "protein",
    repairLevel: "high",
    weight: "light",
    needStrength: 3,
  })

  const candidates = [
    createMatchedProduct("medium-protein", "Maske", { combined_score: 0.9 }),
    createMatchedProduct("light-balanced", "Maske", { combined_score: 0.75 }),
  ]

  const specs: ProductMaskSpecs[] = [
    {
      product_id: "medium-protein",
      weight: "medium",
      concentration: "high",
      balance_direction: "protein",
      ingredient_flags: [],
    },
    {
      product_id: "light-balanced",
      weight: "light",
      concentration: "medium",
      balance_direction: "balanced",
      ingredient_flags: [],
    },
  ]

  const reranked = rerankMaskProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "light-balanced")
})

test("engine mask reranking uplifts explicit low-need intensive requests to medium concentration", () => {
  const decision = createMaskDecision({
    balance: "balanced",
    repairLevel: "medium",
    weight: "medium",
    needStrength: 0,
    role: "optional",
    intensityRequest: "intensive",
  })

  const candidates = [
    createMatchedProduct("low", "Maske", { combined_score: 0.9 }),
    createMatchedProduct("medium", "Maske", { combined_score: 0.75 }),
  ]

  const specs: ProductMaskSpecs[] = [
    {
      product_id: "low",
      weight: "medium",
      concentration: "low",
      balance_direction: "balanced",
      ingredient_flags: [],
    },
    {
      product_id: "medium",
      weight: "medium",
      concentration: "medium",
      balance_direction: "balanced",
      ingredient_flags: [],
    },
  ]

  const reranked = rerankMaskProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "medium")
  assert.match(reranked[0]?.recommendation_meta?.tradeoffs.join(" ") ?? "", /sparsam/)
})

test("engine mask reranking hides missing specs when three known mask fits exist", () => {
  const decision = createMaskDecision({
    balance: "protein",
    repairLevel: "medium",
    weight: "medium",
    needStrength: 2,
  })

  const candidates = [
    createMatchedProduct("missing", "Maske", { combined_score: 0.99 }),
    createMatchedProduct("known-1", "Maske", { combined_score: 0.5 }),
    createMatchedProduct("known-2", "Maske", { combined_score: 0.49 }),
    createMatchedProduct("known-3", "Maske", { combined_score: 0.48 }),
  ]

  const specs: ProductMaskSpecs[] = ["known-1", "known-2", "known-3"].map((product_id) => ({
    product_id,
    weight: "medium",
    concentration: "medium",
    balance_direction: "protein",
    ingredient_flags: [],
  }))

  const reranked = rerankMaskProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["known-1", "known-2", "known-3"],
  )
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

test("engine leave-in reranking excludes hard mismatches when three viable fits exist", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.leaveIn

  const candidates = [
    createMatchedProduct("ideal", "Leave-in", { combined_score: 0.72 }),
    createMatchedProduct("support-weight", "Leave-in", { combined_score: 0.71 }),
    createMatchedProduct("support-balance", "Leave-in", { combined_score: 0.7 }),
    createMatchedProduct("mismatch", "Leave-in", { combined_score: 0.95 }),
  ]

  const specs: ProductLeaveInSpecs[] = [
    {
      product_id: "ideal",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["moisture", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "support-weight",
      format: "spray",
      weight: "light",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["moisture", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "support-balance",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "mismatch",
      format: "cream",
      weight: "rich",
      roles: ["extension_conditioner"],
      provides_heat_protection: false,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["moisture", "shine"],
      ingredient_flags: [],
      application_stage: ["towel_dry"],
    },
  ]

  const reranked = rerankLeaveInProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: SEVERE_DAMAGE_PROFILE,
  })

  assert.deepEqual(
    new Set(reranked.map((product) => product.id)),
    new Set(["ideal", "support-weight", "support-balance"]),
  )
  assert.equal(
    reranked.some((product) => product.id === "mismatch"),
    false,
  )
})

test("engine leave-in reranking does not use hard-gated mismatches as fallback fill", () => {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const decision = runtime.categories.leaveIn

  const candidates = [
    createMatchedProduct("ideal", "Leave-in", {
      combined_score: 0.72,
      suitable_thicknesses: ["fine"],
    }),
    createMatchedProduct("wrong-thickness", "Leave-in", {
      combined_score: 0.99,
      suitable_thicknesses: ["normal", "coarse"],
    }),
    createMatchedProduct("missing-high-heat", "Leave-in", {
      combined_score: 0.98,
      suitable_thicknesses: ["fine"],
    }),
  ]

  const specs: ProductLeaveInSpecs[] = [
    {
      product_id: "ideal",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["protein", "repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "wrong-thickness",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["protein", "repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "missing-high-heat",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: false,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["protein", "repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry"],
    },
  ]

  const reranked = rerankLeaveInProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: SEVERE_DAMAGE_PROFILE,
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["ideal"],
  )
})

test("engine leave-in reranking uses balance mismatches only as caveated fallback fill", () => {
  const proteinProfile = {
    ...SEVERE_DAMAGE_PROFILE,
    protein_moisture_balance: "stretches_stays" as const,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(proteinProfile, [])
  const decision = runtime.categories.leaveIn

  const candidates = [
    createMatchedProduct("ideal", "Leave-in", {
      combined_score: 0.72,
      suitable_thicknesses: ["fine"],
    }),
    createMatchedProduct("balanced-bridge", "Leave-in", {
      combined_score: 0.7,
      suitable_thicknesses: ["fine"],
    }),
    createMatchedProduct("opposite-balance", "Leave-in", {
      combined_score: 0.99,
      suitable_thicknesses: ["fine"],
    }),
  ]

  const specs: ProductLeaveInSpecs[] = [
    {
      product_id: "ideal",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["protein", "repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "balanced-bridge",
      format: "cream",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "opposite-balance",
      format: "spray",
      weight: "medium",
      roles: ["replacement_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["moisture", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
  ]

  const reranked = rerankLeaveInProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: proteinProfile,
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["ideal", "balanced-bridge", "opposite-balance"],
  )

  const fallbackMeta = reranked[2]?.recommendation_meta as LeaveInRecommendationMetadata | undefined
  assert.match(fallbackMeta?.tradeoffs[0] ?? "", /Fallback/)
})

test("engine leave-in reranking honors explicit spray and cream comparison requests", () => {
  const profile = {
    ...LOW_DAMAGE_PROFILE,
    hair_texture: "wavy" as const,
    protein_moisture_balance: "stretches_stays" as const,
    concerns: ["dryness", "frizz"] as HairProfile["concerns"],
    styling_tools: ["blow_dryer"] as HairProfile["styling_tools"],
    uses_heat_protection: true,
  }
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message: "Vergleich mir bitte ein Spray-Leave-in und eine Creme für meine Haare.",
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(profile, [], requestContext)
  const decision = runtime.categories.leaveIn

  const candidates = [
    createMatchedProduct("lotion", "Leave-in", {
      combined_score: 0.95,
      suitable_thicknesses: ["normal"],
    }),
    createMatchedProduct("cream", "Leave-in", {
      combined_score: 0.62,
      suitable_thicknesses: ["normal"],
    }),
    createMatchedProduct("spray", "Leave-in", {
      combined_score: 0.98,
      suitable_thicknesses: ["normal"],
    }),
  ]

  const specs: ProductLeaveInSpecs[] = [
    {
      product_id: "lotion",
      format: "lotion",
      weight: "medium",
      roles: ["extension_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "cream",
      format: "cream",
      weight: "medium",
      roles: ["extension_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
    {
      product_id: "spray",
      format: "spray",
      weight: "medium",
      roles: ["extension_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["moisture", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
  ]

  const reranked = rerankLeaveInProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: profile,
    requestedFormats: requestContext.leaveInRequestedFormats,
  })

  assert.deepEqual(
    reranked.slice(0, 2).map((product) => product.id),
    ["spray", "cream"],
  )
})

test("engine leave-in reranking prefers integrated heat bonus when separate heat protectant exists", () => {
  const profile = {
    ...LOW_DAMAGE_PROFILE,
    hair_texture: "wavy" as const,
    thickness: "normal" as const,
    density: "medium" as const,
    protein_moisture_balance: "stretches_stays" as const,
    styling_tools: ["blow_dryer"] as HairProfile["styling_tools"],
    heat_styling: "daily" as const,
    uses_heat_protection: false,
  }
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message: "Ich föhne nur und habe schon einen separaten Hitzeschutz. Welches Leave-in passt?",
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(profile, [], requestContext)
  const decision = runtime.categories.leaveIn

  assert.equal(decision.targetProfile?.heatProtectionNeed, "moderate")
  assert.equal(decision.targetProfile?.hasSeparateHeatProtectant, true)

  const candidates = [
    createMatchedProduct("care-only-1", "Leave-in", {
      combined_score: 0.98,
      suitable_thicknesses: ["normal"],
    }),
    createMatchedProduct("care-only-2", "Leave-in", {
      combined_score: 0.97,
      suitable_thicknesses: ["normal"],
    }),
    createMatchedProduct("care-only-3", "Leave-in", {
      combined_score: 0.96,
      suitable_thicknesses: ["normal"],
    }),
    createMatchedProduct("two-in-one", "Leave-in", {
      combined_score: 0,
      suitable_thicknesses: ["normal"],
    }),
  ]

  const specs: ProductLeaveInSpecs[] = [
    {
      product_id: "care-only-1",
      format: "lotion",
      weight: "medium",
      roles: ["extension_conditioner"],
      provides_heat_protection: false,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry"],
    },
    {
      product_id: "care-only-2",
      format: "lotion",
      weight: "medium",
      roles: ["extension_conditioner"],
      provides_heat_protection: false,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry"],
    },
    {
      product_id: "care-only-3",
      format: "lotion",
      weight: "medium",
      roles: ["extension_conditioner"],
      provides_heat_protection: false,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry"],
    },
    {
      product_id: "two-in-one",
      format: "lotion",
      weight: "medium",
      roles: ["extension_conditioner", "styling_prep"],
      provides_heat_protection: true,
      heat_protection_max_c: null,
      heat_activation_required: false,
      care_benefits: ["repair", "detangling", "anti_frizz"],
      ingredient_flags: [],
      application_stage: ["towel_dry", "pre_heat"],
    },
  ]

  const reranked = rerankLeaveInProductsWithEngine({
    candidates,
    specs,
    decision,
    hairProfile: profile,
  })

  assert.equal(reranked[0]?.id, "two-in-one")
  const meta = reranked[0]?.recommendation_meta as LeaveInRecommendationMetadata | undefined
  assert.equal(meta?.provides_heat_protection, true)
  assert.ok(meta?.top_reasons.some((reason) => reason.includes("Produkt weniger")))
})

test("engine leave-in metadata exposes product conditioner relationship, not target relationship", () => {
  const boosterProfile = {
    ...SEVERE_DAMAGE_PROFILE,
    thickness: "normal" as const,
    density: "medium" as const,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(boosterProfile, [])
  const decision = runtime.categories.leaveIn

  assert.equal(decision.targetProfile?.conditionerRelationship, "booster_only")

  const reranked = rerankLeaveInProductsWithEngine({
    candidates: [
      createMatchedProduct("replacement-capable", "Leave-in", {
        combined_score: 0.72,
        suitable_thicknesses: ["normal"],
      }),
    ],
    specs: [
      {
        product_id: "replacement-capable",
        format: "spray",
        weight: "medium",
        roles: ["replacement_conditioner", "styling_prep"],
        provides_heat_protection: true,
        heat_protection_max_c: null,
        heat_activation_required: false,
        care_benefits: ["protein", "repair", "anti_frizz"],
        ingredient_flags: [],
        application_stage: ["towel_dry", "pre_heat"],
      },
    ],
    decision,
    hairProfile: boosterProfile,
  })
  const meta = reranked[0]?.recommendation_meta as LeaveInRecommendationMetadata | undefined

  assert.equal(meta?.conditioner_relationship, "replacement_capable")
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
    scalp_condition: null,
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

test("engine shampoo reranking treats exact normal bucket with gentle intensity as a fit", () => {
  const balancedProfile = {
    ...LOW_DAMAGE_PROFILE,
    thickness: "normal" as const,
    scalp_type: "balanced" as const,
    scalp_condition: null,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(balancedProfile, [])
  const decision = runtime.categories.shampoo

  assert.equal(decision.targetProfile?.shampooBucket, "normal")
  assert.equal(decision.targetProfile?.cleansingIntensity, "regular")

  const reranked = rerankShampooProductsWithEngine({
    candidates: [createMatchedProduct("neqi-like", "Shampoo", { combined_score: 0.74 })],
    decision,
    hairProfile: balancedProfile,
    bucketByProductId: new Map([["neqi-like", "normal"]]),
    specs: [
      {
        product_id: "neqi-like",
        thickness: "normal",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "gentle",
      },
    ],
  })

  const meta = reranked[0]?.recommendation_meta as ShampooRecommendationMetadata | undefined

  assert.equal(reranked[0]?.id, "neqi-like")
  assert.equal(meta?.matched_bucket, "normal")
  assert.equal(meta?.matched_scalp_route, "balanced")
  assert.equal(meta?.cleansing_intensity, "gentle")
  assert.equal(meta?.fit_status, "supportive")
  assert.doesNotMatch(meta?.tradeoffs.join("\n") ?? "", /Fallback/)
})

test("engine shampoo reranking excludes mismatches when enough acceptable fits exist", () => {
  const oilyProfile = {
    ...LOW_DAMAGE_PROFILE,
    scalp_type: "oily" as const,
    scalp_condition: null,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(oilyProfile, [])
  const decision = runtime.categories.shampoo

  const candidates = [
    createMatchedProduct("mismatch", "Shampoo", { combined_score: 1 }),
    createMatchedProduct("acceptable-1", "Shampoo", { combined_score: 0.3 }),
    createMatchedProduct("acceptable-2", "Shampoo", { combined_score: 0.29 }),
    createMatchedProduct("acceptable-3", "Shampoo", { combined_score: 0.28 }),
  ]

  const reranked = rerankShampooProductsWithEngine({
    candidates,
    decision,
    hairProfile: oilyProfile,
    bucketByProductId: new Map([
      ["mismatch", "trocken"],
      ["acceptable-1", "dehydriert-fettig"],
      ["acceptable-2", "dehydriert-fettig"],
      ["acceptable-3", "dehydriert-fettig"],
    ]),
    specs: [
      {
        product_id: "acceptable-1",
        thickness: oilyProfile.thickness!,
        shampoo_bucket: "dehydriert-fettig",
        scalp_route: "oily",
        cleansing_intensity: "regular",
      },
      {
        product_id: "acceptable-2",
        thickness: oilyProfile.thickness!,
        shampoo_bucket: "dehydriert-fettig",
        scalp_route: "oily",
        cleansing_intensity: "regular",
      },
      {
        product_id: "acceptable-3",
        thickness: oilyProfile.thickness!,
        shampoo_bucket: "dehydriert-fettig",
        scalp_route: "oily",
        cleansing_intensity: "regular",
      },
    ],
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["acceptable-1", "acceptable-2", "acceptable-3"],
  )
})

test("engine shampoo reranking marks fallback mismatches when acceptable coverage is insufficient", () => {
  const oilyProfile = {
    ...LOW_DAMAGE_PROFILE,
    scalp_type: "oily" as const,
    scalp_condition: null,
  }
  const runtime = buildRecommendationEngineRuntimeFromPersistence(oilyProfile, [])
  const decision = runtime.categories.shampoo

  const reranked = rerankShampooProductsWithEngine({
    candidates: [
      createMatchedProduct("mismatch-1", "Shampoo", { combined_score: 1 }),
      createMatchedProduct("mismatch-2", "Shampoo", { combined_score: 0.99 }),
      createMatchedProduct("acceptable", "Shampoo", { combined_score: 0.3 }),
    ],
    decision,
    hairProfile: oilyProfile,
    bucketByProductId: new Map([
      ["mismatch-1", "trocken"],
      ["mismatch-2", "irritationen"],
      ["acceptable", "dehydriert-fettig"],
    ]),
    specs: [
      {
        product_id: "acceptable",
        thickness: oilyProfile.thickness!,
        shampoo_bucket: "dehydriert-fettig",
        scalp_route: "oily",
        cleansing_intensity: "regular",
      },
    ],
  })

  assert.equal(reranked.length, 3)
  assert.equal(reranked[0]?.id, "acceptable")

  const fallbackTradeoffs = reranked.slice(1).map((product) => {
    const meta = product.recommendation_meta as ShampooRecommendationMetadata | undefined
    return meta?.tradeoffs[0] ?? ""
  })

  assert.equal(fallbackTradeoffs.length, 2)
  for (const tradeoff of fallbackTradeoffs) {
    assert.match(tradeoff, /Fallback/)
    assert.match(tradeoff, /nicht exakt/)
  }
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

test("engine oil reranking hides finish bridge candidates when exact purpose coverage is enough", () => {
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein Styling-Oel als Finish gegen Frizz.",
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    LOW_DAMAGE_PROFILE,
    [],
    requestContext,
  )
  const decision = runtime.categories.oil

  const reranked = rerankOilProductsWithEngine({
    candidates: [
      createMatchedProduct("exact-1", "Öle", { combined_score: 0.7 }),
      createMatchedProduct("exact-2", "Öle", { combined_score: 0.68 }),
      createMatchedProduct("exact-3", "Öle", { combined_score: 0.66 }),
      createMatchedProduct("bridge", "Öle", { combined_score: 0.95 }),
    ],
    decision,
    hairProfile: LOW_DAMAGE_PROFILE,
    eligibilityRows: [
      {
        product_id: "exact-1",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "styling_finish",
      },
      {
        product_id: "exact-2",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "styling_finish",
      },
      {
        product_id: "exact-3",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "styling_finish",
      },
      {
        product_id: "bridge",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "trocken-oel",
        oil_purpose: "light_finish",
      },
    ],
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["exact-1", "exact-2", "exact-3"],
  )
})

test("engine oil reranking allows only adjacent finish bridge below exact threshold", () => {
  const finishRequest = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein Styling-Oel als Finish gegen Frizz.",
  })
  const finishDecision = buildRecommendationEngineRuntimeFromPersistence(
    LOW_DAMAGE_PROFILE,
    [],
    finishRequest,
  ).categories.oil

  const finishReranked = rerankOilProductsWithEngine({
    candidates: [
      createMatchedProduct("exact-1", "Öle", { combined_score: 0.7 }),
      createMatchedProduct("exact-2", "Öle", { combined_score: 0.68 }),
      createMatchedProduct("light-bridge", "Öle", { combined_score: 0.95 }),
      createMatchedProduct("prewash", "Öle", { combined_score: 0.99 }),
    ],
    decision: finishDecision,
    hairProfile: LOW_DAMAGE_PROFILE,
    eligibilityRows: [
      {
        product_id: "exact-1",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "styling_finish",
      },
      {
        product_id: "exact-2",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "styling-oel",
        oil_purpose: "styling_finish",
      },
      {
        product_id: "light-bridge",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "trocken-oel",
        oil_purpose: "light_finish",
      },
      {
        product_id: "prewash",
        thickness: LOW_DAMAGE_PROFILE.thickness!,
        oil_subtype: "natuerliches-oel",
        oil_purpose: "pre_wash_oiling",
      },
    ],
  })

  assert.deepEqual(
    finishReranked.map((product) => product.id),
    ["exact-1", "exact-2", "light-bridge"],
  )
  assert.match(
    finishReranked[2]?.recommendation_meta?.tradeoffs.join(" ") ?? "",
    /angrenzende Finish-Rolle/,
  )
})

test("engine bondbuilder reranking exposes protocol metadata without ranking by treatment mode", () => {
  const decision: BondbuilderCategoryDecision = {
    category: "bondbuilder",
    relevant: true,
    action: "add",
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: {
      bondRepairIntensity: "intensive",
      applicationMode: "pre_shampoo",
      chemicalCrosslinkLane: false,
      peptideChainLane: true,
      mixedOrSevereCombo: false,
      proteinBalanceSupportingOnly: false,
      role: "recommended",
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
      bond_repair_axis: "peptide_chain",
      treatment_mode: "leave_in",
      product_format: "leave_in_mask",
      usage_protocol: "k18_leave_in",
    },
    {
      product_id: "ideal",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "cream_treatment",
      usage_protocol: "olaplex_3plus",
    },
  ]

  const reranked = rerankBondbuilderProductsWithEngine({
    candidates,
    specs,
    decision,
  })

  assert.equal(reranked[0]?.id, "supportive")
  assert.equal(reranked[0]?.recommendation_meta?.category, "bondbuilder")
  assert.equal(
    (reranked[0]?.recommendation_meta as BondbuilderRecommendationMetadata | undefined)
      ?.usage_protocol,
    "k18_leave_in",
  )
})

test("engine bondbuilder reranking excludes retired and add-on products from primary cards", () => {
  const decision: BondbuilderCategoryDecision = {
    category: "bondbuilder",
    relevant: true,
    action: "add",
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: {
      bondRepairIntensity: "intensive",
      applicationMode: "pre_shampoo",
      chemicalCrosslinkLane: true,
      peptideChainLane: false,
      mixedOrSevereCombo: false,
      proteinBalanceSupportingOnly: false,
      role: "recommended",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("active", "Bondbuilder", { combined_score: 0.6 }),
    createMatchedProduct("legacy", "Bondbuilder", {
      combined_score: 0.95,
      lifecycle_status: "discontinued",
    }),
    createMatchedProduct("addon", "Bondbuilder", { combined_score: 0.9 }),
  ]

  const specs: ProductBondbuilderSpecs[] = candidates.map((candidate) => ({
    product_id: candidate.id,
    bond_repair_intensity: "intensive",
    application_mode: "pre_shampoo",
    bond_repair_axis: "disulfide_crosslink",
    treatment_mode: "rinse_out",
    product_format: "cream_treatment",
    usage_protocol: candidate.id === "active" ? "olaplex_3plus" : "olaplex_3_legacy",
  }))

  const reranked = rerankBondbuilderProductsWithEngine({
    candidates,
    specs,
    decision,
    outgoingRelationshipsByProductId: new Map([
      [
        "addon",
        [
          {
            source_product_id: "addon",
            target_product_id: "active",
            relationship_type: "add_on_for",
          },
        ],
      ],
    ]),
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["active"],
  )
  assert.match(reranked[0]?.recommendation_meta?.usage_hint ?? "", /No\.3PLUS ins nasse Haar/)
})

test("engine bondbuilder reranking attaches optional add-ons for severe combo cases", () => {
  const decision: BondbuilderCategoryDecision = {
    category: "bondbuilder",
    relevant: true,
    action: "add",
    planReasonCodes: ["bondbuilder_mixed_severe_combo"],
    currentInventory: null,
    targetProfile: {
      bondRepairIntensity: "intensive",
      applicationMode: "pre_shampoo",
      chemicalCrosslinkLane: true,
      peptideChainLane: true,
      mixedOrSevereCombo: true,
      proteinBalanceSupportingOnly: false,
      role: "recommended",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("olaplex-3plus", "Bondbuilder", { combined_score: 0.7 }),
    createMatchedProduct("epres", "Bondbuilder", { combined_score: 0.68 }),
    createMatchedProduct("k18", "Bondbuilder", { combined_score: 0.66 }),
  ]

  const specs: ProductBondbuilderSpecs[] = [
    {
      product_id: "olaplex-3plus",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "cream_treatment",
      usage_protocol: "olaplex_3plus",
    },
    {
      product_id: "epres",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "spray_treatment",
      usage_protocol: "epres_spray",
    },
    {
      product_id: "k18",
      bond_repair_intensity: "intensive",
      application_mode: "post_wash_leave_in",
      bond_repair_axis: "peptide_chain",
      treatment_mode: "leave_in",
      product_format: "leave_in_mask",
      usage_protocol: "k18_leave_in",
    },
    {
      product_id: "olaplex-0",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "primer_treatment",
      usage_protocol: "olaplex_0_booster",
    },
  ]

  const reranked = rerankBondbuilderProductsWithEngine({
    candidates,
    specs,
    decision,
    incomingRelationshipsByProductId: new Map([
      [
        "olaplex-3plus",
        [
          {
            source_product_id: "olaplex-0",
            target_product_id: "olaplex-3plus",
            relationship_type: "add_on_for",
          },
        ],
      ],
    ]),
    relatedProductsById: new Map([
      [
        "olaplex-0",
        {
          ...createMatchedProduct("olaplex-0", "Bondbuilder"),
          name: "OLAPLEX No.0 Intensive Bond Building Treatment",
        },
      ],
    ]),
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["olaplex-3plus", "epres", "k18"],
  )
  assert.deepEqual(
    (reranked[0]?.recommendation_meta as BondbuilderRecommendationMetadata | undefined)
      ?.attached_add_ons?.[0],
    {
      relationship_type: "add_on_for",
      product_id: "olaplex-0",
      name: "OLAPLEX No.0 Intensive Bond Building Treatment",
      usage_protocol: "olaplex_0_booster",
      reason: "Optionaler Booster fuer sehr starke Schaedigung vor No.3PLUS.",
    },
  )
})

test("engine bondbuilder reranking scopes named K18 and OLAPLEX comparisons", () => {
  const decision: BondbuilderCategoryDecision = {
    category: "bondbuilder",
    relevant: true,
    action: "add",
    planReasonCodes: ["bondbuilder_mixed_severe_combo"],
    currentInventory: null,
    targetProfile: {
      bondRepairIntensity: "intensive",
      applicationMode: "pre_shampoo",
      chemicalCrosslinkLane: true,
      peptideChainLane: true,
      mixedOrSevereCombo: true,
      proteinBalanceSupportingOnly: false,
      role: "recommended",
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("olaplex-3plus", "Bondbuilder", {
      brand: "OLAPLEX",
      name: "OLAPLEX No.3PLUS Complete Repair Treatment",
      combined_score: 0.7,
    }),
    createMatchedProduct("epres", "Bondbuilder", {
      brand: "Epres",
      name: "Epres Bond Repair Treatment",
      combined_score: 0.68,
    }),
    createMatchedProduct("k18", "Bondbuilder", {
      brand: "K18",
      name: "K18 Leave-In Molecular Repair Hair Mask",
      combined_score: 0.66,
    }),
  ]

  const specs: ProductBondbuilderSpecs[] = [
    {
      product_id: "olaplex-3plus",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "cream_treatment",
      usage_protocol: "olaplex_3plus",
    },
    {
      product_id: "epres",
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "spray_treatment",
      usage_protocol: "epres_spray",
    },
    {
      product_id: "k18",
      bond_repair_intensity: "intensive",
      application_mode: "post_wash_leave_in",
      bond_repair_axis: "peptide_chain",
      treatment_mode: "leave_in",
      product_format: "leave_in_mask",
      usage_protocol: "k18_leave_in",
    },
  ]

  const reranked = rerankBondbuilderProductsWithEngine({
    candidates,
    specs,
    decision,
    message: "Soll ich K18 oder OLAPLEX nehmen?",
  })

  assert.deepEqual(
    reranked.map((product) => product.id),
    ["olaplex-3plus", "k18"],
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
      resetNeedLevel: "likely",
      resetFocus: "general_buildup",
      targetIntensity: "medium",
      colorTreatedCaution: false,
      colorSafeRequest: false,
      cautionFlags: [],
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
      reset_intensity: "medium",
      reset_focus: "general_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
    {
      product_id: "ideal",
      scalp_type_focus: "oily",
      reset_intensity: "medium",
      reset_focus: "general_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
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

test("engine deep-cleansing shampoo reranking prefers broad-spectrum reset for mineral requests", () => {
  const decision: DeepCleansingShampooCategoryDecision = {
    category: "deep_cleansing_shampoo",
    relevant: true,
    action: "add",
    planReasonCodes: ["mineral_chlorine_or_hard_water_context"],
    currentInventory: null,
    targetProfile: {
      scalpTypeFocus: "balanced",
      resetNeedLevel: "strong",
      resetFocus: "mineral_chlorine",
      targetIntensity: "medium",
      colorTreatedCaution: true,
      colorSafeRequest: true,
      cautionFlags: ["color_or_bleach_caution"],
    },
    notes: [],
  }

  const candidates = [
    createMatchedProduct("generic", "Deep Cleansing Shampoo", { combined_score: 0.9 }),
    createMatchedProduct("broad", "Deep Cleansing Shampoo", { combined_score: 0.72 }),
  ]
  const specs: ProductDeepCleansingShampooSpecs[] = [
    {
      product_id: "generic",
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "general_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
    {
      product_id: "broad",
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "broad_spectrum",
      color_treated_suitability: "suitable",
    },
  ]

  const reranked = rerankDeepCleansingShampooProductsWithEngine({
    candidates,
    specs,
    decision,
  })
  const meta = reranked[0]?.recommendation_meta as
    | DeepCleansingShampooRecommendationMetadata
    | undefined

  assert.equal(reranked[0]?.id, "broad")
  assert.equal(meta?.reset_focus, "broad_spectrum")
  assert.equal(meta?.color_treated_suitability, "suitable")
})

test("engine deep-cleansing shampoo reranking suppresses unsupported mineral and color-safe matches", () => {
  const decision: DeepCleansingShampooCategoryDecision = {
    category: "deep_cleansing_shampoo",
    relevant: true,
    action: "add",
    planReasonCodes: ["mineral_chlorine_or_hard_water_context"],
    currentInventory: null,
    targetProfile: {
      scalpTypeFocus: "balanced",
      resetNeedLevel: "strong",
      resetFocus: "mineral_chlorine",
      targetIntensity: "medium",
      colorTreatedCaution: true,
      colorSafeRequest: true,
      cautionFlags: ["color_or_bleach_caution"],
    },
    notes: [],
  }

  const reranked = rerankDeepCleansingShampooProductsWithEngine({
    candidates: [
      createMatchedProduct("generic", "Deep Cleansing Shampoo", { combined_score: 0.9 }),
    ],
    specs: [
      {
        product_id: "generic",
        scalp_type_focus: "balanced",
        reset_intensity: "medium",
        reset_focus: "general_buildup",
        color_treated_suitability: "unsuitable_or_unknown",
      },
    ],
    decision,
  })

  assert.deepEqual(reranked, [])
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

test("engine selectors keep baseline conditioner active when shared engine is otherwise quiet", () => {
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

  assert.equal(runtime.categories.conditioner.relevant, true)
  assert.equal(runtime.categories.conditioner.action, "keep")
  assert.equal(runtime.categories.mask.relevant, false)
  assert.equal(runtime.categories.leaveIn.relevant, false)
  assert.equal(runtime.categories.oil.relevant, false)
})
