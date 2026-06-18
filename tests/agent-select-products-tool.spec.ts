import assert from "node:assert/strict"
import test from "node:test"

import {
  createSelectProductsTool,
  projectSelectedProducts,
  type SelectedProductsProjection,
} from "../src/lib/agent/tools/select-products"
import { inferOilPurposeFromMessage } from "../src/lib/oil/purpose"
import type { MatchedProduct } from "../src/lib/product-matching/matcher"
import type { SelectableProductCategory } from "../src/lib/agent/tools/select-products"
import {
  buildRecommendationEngineRuntimeFromPersistence,
  type RecommendationEngineRuntime,
} from "../src/lib/recommendation-engine/runtime"
import {
  adaptRecommendationInputFromPersistence,
  buildEffectiveCareContext,
} from "../src/lib/recommendation-engine"
import { buildRecommendationRequestContext } from "../src/lib/recommendation-engine/request-context"
import type {
  BondbuilderCategoryDecision,
  DeepCleansingShampooCategoryDecision,
  DryShampooCategoryDecision,
  MaskCategoryDecision,
  ShampooCategoryDecision,
} from "../src/lib/recommendation-engine/types"
import type {
  BondbuilderRecommendationMetadata,
  DeepCleansingShampooRecommendationMetadata,
  DryShampooRecommendationMetadata,
  HairProfile,
} from "../src/lib/types"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"

function createMatchedProduct(
  id: string,
  score: number,
  overrides: Partial<MatchedProduct> = {},
): MatchedProduct {
  return {
    id,
    name: `Produkt ${id}`,
    brand: "Testmarke",
    description: null,
    short_description: null,
    category: "Conditioner",
    affiliate_link: null,
    image_url: null,
    price_eur: 24.9,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: [],
    shampoo_bucket_pairs: null,
    is_active: true,
    sort_order: 0,
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    similarity: score,
    combined_score: score,
    recommendation_meta: {
      category: "conditioner",
      score,
      top_reasons: [`Grund ${id}`],
      tradeoffs: [`Tradeoff ${id}`],
      usage_hint: `Anwendung ${id}`,
      matched_profile: {
        thickness: "normal",
        density: null,
        protein_moisture_balance: null,
        cuticle_condition: null,
        chemical_treatment: [],
      },
      matched_weight: "medium",
      matched_repair_level: "high",
      matched_balance_need: "moisture",
    },
    ...overrides,
  }
}

function createShampooMatchedProduct(
  id: string,
  score: number,
  reasons: string[],
  tradeoffs: string[] = [],
  metadataOverrides: Record<string, unknown> = {},
): MatchedProduct {
  return createMatchedProduct(id, score, {
    recommendation_meta: {
      category: "shampoo",
      score,
      top_reasons: reasons,
      tradeoffs,
      usage_hint: "",
      matched_profile: {
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: null,
      },
      matched_bucket: "dehydriert-fettig",
      matched_concern_code: "dehydriert-fettig",
      matched_scalp_route: "oily",
      cleansing_intensity: "regular",
      fit_status: "ideal",
      ...metadataOverrides,
    },
  })
}

function createLeaveInMatchedProduct(
  id: string,
  score: number,
  metadataOverrides: Record<string, unknown> = {},
): MatchedProduct {
  return createMatchedProduct(id, score, {
    category: "Leave-in",
    recommendation_meta: {
      category: "leave_in",
      score,
      top_reasons: ["Passt zum Leave-in-Zielprofil"],
      tradeoffs: [],
      usage_hint: "Sparsam in die Längen geben.",
      matched_profile: {
        hair_texture: "wavy",
        thickness: "fine",
        density: "medium",
        cuticle_condition: "rough",
        chemical_treatment: ["bleached"],
      },
      need_bucket: "heat_protect",
      styling_context: "heat_style",
      conditioner_relationship: "replacement_capable",
      matched_weight: "medium",
      fit_status: "ideal",
      product_format: "spray",
      product_weight: "medium",
      product_roles: ["replacement_conditioner", "styling_prep"],
      product_care_benefits: ["moisture", "anti_frizz"],
      provides_heat_protection: true,
      product_application_stage: ["towel_dry", "pre_heat"],
      heat_protection_need: "high",
      styling_prep_need: "heat_style",
      product_balance_direction: "moisture",
      ...metadataOverrides,
    },
  })
}

function createMaskMatchedProduct(
  id: string,
  score: number,
  metadataOverrides: Record<string, unknown> = {},
): MatchedProduct {
  return createMatchedProduct(id, score, {
    category: "Maske",
    recommendation_meta: {
      category: "mask",
      score,
      top_reasons: ["Passt zum Masken-Zielprofil"],
      tradeoffs: [],
      usage_hint:
        "Nach dem Shampoo in die Längen und Spitzen geben, gründlich ausspülen und danach Conditioner verwenden.",
      mask_type: "protein",
      need_strength: 2,
      fit_status: "ideal",
      role: "fixed",
      product_weight: "medium",
      product_concentration: "medium",
      product_balance_direction: "protein",
      ...metadataOverrides,
    },
  })
}

function createOilMatchedProduct(
  id: string,
  score: number,
  metadataOverrides: Record<string, unknown> = {},
): MatchedProduct {
  return createMatchedProduct(id, score, {
    category: "Öle",
    recommendation_meta: {
      category: "oil",
      score,
      top_reasons: ["Passt zum Öl-Zweck"],
      tradeoffs: [],
      usage_hint: "Sehr sparsam in die Längen und Spitzen geben.",
      matched_profile: {
        thickness: "fine",
      },
      matched_subtype: "trocken-oel",
      use_mode: "light_finish",
      adjunct_scalp_support: false,
      fit_status: "ideal",
      purpose_fit: "exact",
      density_weight_caution: true,
      overload_caution: false,
      scalp_caution: false,
      ...metadataOverrides,
    },
  })
}

function createDryShampooMatchedProduct(
  id: string,
  score: number,
  metadataOverrides: Partial<DryShampooRecommendationMetadata> = {},
): MatchedProduct {
  return createMatchedProduct(id, score, {
    category: "Trockenshampoo",
    recommendation_meta: {
      category: "dry_shampoo",
      score,
      top_reasons: ["Passt als Between-Wash-Brücke für den Ansatz"],
      tradeoffs: [],
      usage_hint: "Nur als Between-Wash-Brücke sparsam am Ansatz einsetzen und später auswaschen.",
      primary_effect: "classic_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "sensitive_ok",
      format: "aerosol_spray",
      fit_status: "ideal",
      ...metadataOverrides,
    },
  })
}

function assertProjectionDoesNotExposeFallback(projection: SelectedProductsProjection): void {
  assert.doesNotMatch(JSON.stringify(projection), /Fallback/i)
}

function assertComparisonFactsAtLeast(
  projection: SelectedProductsProjection,
  productIds: string[],
  minimum: number,
): void {
  for (const productId of productIds) {
    assert.ok(
      (projection.comparison_facts?.[productId]?.length ?? 0) >= minimum,
      `${productId} should expose at least ${minimum} comparison facts`,
    )
  }
}

function createRuntimeStub(
  overrides: Partial<RecommendationEngineRuntime> = {},
): RecommendationEngineRuntime {
  return {
    rawInput: {} as RecommendationEngineRuntime["rawInput"],
    requestContext: {
      requestedCategory: null,
      resetTriggerTerms: [],
      resetTriggerSources: [],
      resetFocusRequest: null,
      colorSafeRequest: false,
      scalpTreatmentIntent: false,
      maskIntensityRequest: null,
      leaveInHeatProtectionRequest: null,
      leaveInSeparateHeatProtectantMentioned: false,
      leaveInWeightRequest: null,
      leaveInConditionerRelationshipRequest: null,
      leaveInRequestedFormats: [],
      oilPurpose: null,
      oilNoRecommendationReason: null,
    } as RecommendationEngineRuntime["requestContext"],
    effectiveContext: {} as RecommendationEngineRuntime["effectiveContext"],
    normalized: {} as RecommendationEngineRuntime["normalized"],
    damage: {} as RecommendationEngineRuntime["damage"],
    careNeeds: {} as RecommendationEngineRuntime["careNeeds"],
    reset: {
      level: "none",
      triggers: [],
      triggerSources: [],
      resetFocus: null,
      overloadRisk: "none",
      richOptionalCareRisk: false,
      cautionFlags: [],
    },
    careBalance: { rows: [] },
    plan: {} as RecommendationEngineRuntime["plan"],
    categories: {
      shampoo: {} as RecommendationEngineRuntime["categories"]["shampoo"],
      conditioner: {} as RecommendationEngineRuntime["categories"]["conditioner"],
      leaveIn: {
        targetProfile: {
          needBucket: "repair",
          stylingContext: "air_dry",
        },
      } as RecommendationEngineRuntime["categories"]["leaveIn"],
      mask: {} as RecommendationEngineRuntime["categories"]["mask"],
      oil: {
        targetProfile: {
          matcherSubtype: "dry_finish",
        },
        clarificationNeeded: false,
        noRecommendationReason: null,
      } as unknown as RecommendationEngineRuntime["categories"]["oil"],
      bondbuilder: {} as RecommendationEngineRuntime["categories"]["bondbuilder"],
      deepCleansingShampoo: {} as RecommendationEngineRuntime["categories"]["deepCleansingShampoo"],
      dryShampoo: {} as RecommendationEngineRuntime["categories"]["dryShampoo"],
      peeling: {} as RecommendationEngineRuntime["categories"]["peeling"],
    } as RecommendationEngineRuntime["categories"],
    unsupportedRoutineCategories: [],
    ...overrides,
  }
}

function createShampooRuntimeStub(decision: ShampooCategoryDecision): RecommendationEngineRuntime {
  const runtime = createRuntimeStub()
  runtime.categories.shampoo = decision
  return runtime
}

function createRelevantShampooDecision(
  overrides: Partial<ShampooCategoryDecision> = {},
): ShampooCategoryDecision {
  return {
    category: "shampoo",
    relevant: true,
    action: "add",
    planReasonCodes: ["scalp_focus"],
    currentInventory: null,
    targetProfile: {
      scalpRoute: "oily",
      shampooBucket: "dehydriert-fettig",
      secondaryBucket: null,
      cleansingIntensity: "regular",
    },
    notes: [],
    ...overrides,
  }
}

function createDryShampooRuntimeStub(
  decision: DryShampooCategoryDecision,
): RecommendationEngineRuntime {
  const runtime = createRuntimeStub()
  runtime.categories.dryShampoo = decision
  return runtime
}

function createDryShampooDecision(
  overrides: Partial<DryShampooCategoryDecision> = {},
): DryShampooCategoryDecision {
  return {
    category: "dry_shampoo",
    relevant: true,
    action: "add",
    planReasonCodes: ["dry_shampoo_bridge"],
    currentInventory: null,
    targetProfile: {
      primaryEffectTarget: "classic_refresh",
      hairColorFitTarget: "universal",
      requiresSensitiveFit: false,
      preferredFormat: null,
      bridgeNeedReasonCodes: ["dry_shampoo_between_wash_bridge_needed"],
      cautionReasonCodes: [],
    },
    notes: [],
    ...overrides,
  }
}

function createDeepCleansingScalpTreatmentRuntimeStub(): RecommendationEngineRuntime {
  const runtime = createRuntimeStub()
  const decision: DeepCleansingShampooCategoryDecision = {
    category: "deep_cleansing_shampoo",
    relevant: true,
    action: "behavior_change_only",
    planReasonCodes: ["scalp_treatment_needed"],
    currentInventory: null,
    targetProfile: null,
    notes: ["scalp_treatment_needed"],
  }

  runtime.categories.deepCleansingShampoo = decision
  return runtime
}

test("projectSelectedProducts returns authoritative shampoo recommendation payload", () => {
  const result = projectSelectedProducts(
    [
      createShampooMatchedProduct("p-1", 0.94, [
        "Passt zum fettigen Ansatz",
        "Leicht genug für feines Haar",
      ]),
      createShampooMatchedProduct(
        "p-2",
        0.86,
        ["Stärkerer Kopfhaut-Fokus"],
        ["Kann bei trockenen Längen etwas aktiver wirken"],
      ),
      createShampooMatchedProduct("p-3", 0.71, ["Sanftere Alternative"]),
    ],
    {
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.category, "shampoo")
  assert.deepEqual(result.profile_basis, ["Haardicke: Fein", "Kopfhaut: Schnell fettend"])
  assert.match(result.category_guidance, /Shampoo/)
  assert.deepEqual(result.missing_info, [])
  assert.deepEqual(
    result.products.map((product) => ({
      rank: product.rank,
      product_id: product.product_id,
      fit_reason: product.fit_reason,
      caveat: product.caveat,
      hasUsageHint: "usage_hint" in product,
    })),
    [
      {
        rank: 1,
        product_id: "p-1",
        fit_reason:
          "Idealer Treffer für feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensität: normal.",
        caveat: null,
        hasUsageHint: false,
      },
      {
        rank: 2,
        product_id: "p-2",
        fit_reason:
          "Idealer Treffer für feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensität: normal.",
        caveat: "Kann bei trockenen Längen etwas aktiver wirken",
        hasUsageHint: false,
      },
      {
        rank: 3,
        product_id: "p-3",
        fit_reason:
          "Idealer Treffer für feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensität: normal.",
        caveat: null,
        hasUsageHint: false,
      },
    ],
  )
  assert.deepEqual(result.comparison_facts, {
    "p-1": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensität: normal",
      "Fit: idealer Treffer",
    ],
    "p-2": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensität: normal",
      "Fit: idealer Treffer",
    ],
    "p-3": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensität: normal",
      "Fit: idealer Treffer",
    ],
  })
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts returns generic recommend policy for ordinary product picks", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        targetProfile: {
          scalpRoute: "balanced",
          shampooBucket: "normal",
          secondaryBucket: null,
          cleansingIntensity: "regular",
        },
      }),
    ),
    { userJob: "product_pick", concerns: [] },
  )

  assert.equal(result.product_response_policy, "recommend")
  assert.match(result.policy_reason, /Shampoo|Kopfhaut/i)
})

test("projectSelectedProducts does not let profile length concerns veto direct shampoo picks", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    {
      thickness: "normal",
      scalp_type: "balanced",
      scalp_condition: null,
      concerns: ["dryness", "frizz"],
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        targetProfile: {
          scalpRoute: "balanced",
          shampooBucket: "normal",
          secondaryBucket: null,
          cleansingIntensity: "regular",
        },
      }),
    ),
    { userJob: "product_pick", concerns: [] },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "recommend")
  assert.equal(result.products.length, 1)
})

test("projectSelectedProducts still recommends explicit non-shampoo products when runtime marks category irrelevant", () => {
  const runtime = createRuntimeStub()
  runtime.categories.conditioner = {
    category: "conditioner",
    relevant: false,
    action: null,
    planReasonCodes: [],
    currentInventory: null,
    targetProfile: null,
    notes: [],
  } as RecommendationEngineRuntime["categories"]["conditioner"]

  const result = projectSelectedProducts(
    [createMatchedProduct("p-1", 0.94)],
    { thickness: "normal", protein_moisture_balance: "stretches_bounces" } as HairProfile,
    "conditioner",
    runtime,
    { userJob: "product_pick", concerns: [] },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "recommend")
  assert.equal(result.products.length, 1)
})

test("projectSelectedProducts emits conditioner unsupported-signal caveats without making claims", () => {
  const result = projectSelectedProducts(
    [createMatchedProduct("p-conditioner", 0.94)],
    {
      thickness: "normal",
      protein_moisture_balance: "stretches_bounces",
      chemical_treatment: ["colored"],
    } as HairProfile,
    "conditioner",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: [],
      activeProfileSignals: [
        {
          field: "chemical_treatment",
          value: "colored",
          source: "message",
          selection_effect: "qualifier",
          evidence: "gefaerbte Haare",
        },
      ],
    },
  )

  assert.equal(result.category, "conditioner")
  assert.equal(result.products.length, 1)
  assert.deepEqual(
    result.products[0].unsupported_requested_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.reason,
    ]),
    [["chemical_treatment", "colored", "no_structured_product_data"]],
  )
  assert.deepEqual(
    result.products[0].supported_claims.some((claim) => claim.field === "chemical_treatment"),
    false,
  )
})

test("projectSelectedProducts exposes conditioner claims without density or damage drivers", () => {
  const result = projectSelectedProducts(
    [
      createMatchedProduct("p-conditioner", 0.94, {
        recommendation_meta: {
          category: "conditioner",
          score: 94,
          top_reasons: ["Passt zum Conditioner-Zielprofil"],
          tradeoffs: [],
          usage_hint: "In die Längen geben.",
          matched_profile: {
            thickness: "fine",
            density: "low",
            protein_moisture_balance: "snaps",
            cuticle_condition: null,
            chemical_treatment: ["bleached"],
          },
          matched_weight: "light",
          matched_repair_level: "high",
          matched_balance_need: "moisture",
          fit_status: "ideal",
          product_weight: "light",
          product_repair_level: "high",
          product_balance_direction: "moisture",
          active_damage_drivers: ["bleached_hair"],
        },
      }),
      createMatchedProduct("p-balanced", 0.88, {
        recommendation_meta: {
          category: "conditioner",
          score: 88,
          top_reasons: ["Supportive Balance"],
          tradeoffs: ["Etwas breiter als dein Feuchtigkeitsfokus."],
          usage_hint: "In die Längen geben.",
          matched_profile: {
            thickness: "fine",
            density: "low",
            protein_moisture_balance: "snaps",
            cuticle_condition: null,
            chemical_treatment: ["bleached"],
          },
          matched_weight: "light",
          matched_repair_level: "medium",
          matched_balance_need: "moisture",
          fit_status: "supportive",
          product_weight: "light",
          product_repair_level: "medium",
          product_balance_direction: "balanced",
          active_damage_drivers: ["bleached_hair"],
        },
      }),
    ],
    {
      thickness: "fine",
      density: "low",
      protein_moisture_balance: "snaps",
    } as HairProfile,
    "conditioner",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: ["dry_lengths"],
      requestedIngredientSignals: [{ value: "silicone_free", evidence: "silikonfrei" }],
    },
  )

  assert.equal(result.decision, "recommended")
  assert.deepEqual(
    result.products[0].supported_claims.map((claim) => claim.field),
    ["weight", "balance_direction", "repair_level", "fit_status"],
  )
  assert.equal(
    result.products[0].supported_claims.some(
      (claim) => claim.field === "density" || claim.field === "chemical_treatment",
    ),
    false,
  )
  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "ingredient_preference",
    value: "silicone_free",
    reason: "no_structured_product_data",
    user_message:
      "Wünsche wie silikonfrei, kokosfrei oder proteinfrei sind in dieser Conditioner-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Pflegeintensität und Fit.",
  })
  assert.deepEqual(result.comparison_facts, {
    "p-conditioner": [
      "Balance: Feuchtigkeit",
      "Pflegeintensität: Intensiv",
      "Fit: idealer Treffer",
    ],
    "p-balanced": [
      "Balance: ausgewogene Pflege",
      "Pflegeintensität: Mittel",
      "Fit: unterstützender Treffer",
    ],
  })
  assertComparisonFactsAtLeast(result, ["p-conditioner", "p-balanced"], 2)
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts adds conditioner profile deviation notice when message overrides thickness", () => {
  const runtime = createRuntimeStub()
  runtime.categories.conditioner = {
    category: "conditioner",
    relevant: true,
    action: "replace",
    planReasonCodes: ["repair_need_present"],
    currentInventory: null,
    targetProfile: {
      balance: "moisture",
      repairLevel: "high",
      weight: "light",
      thickness: "fine",
      activeDamageDrivers: [],
    },
    notes: [],
  } as RecommendationEngineRuntime["categories"]["conditioner"]

  const result = projectSelectedProducts(
    [
      createMatchedProduct("p-conditioner", 0.94, {
        recommendation_meta: {
          category: "conditioner",
          score: 94,
          top_reasons: ["Passt zum leichteren Zielprofil"],
          tradeoffs: [],
          usage_hint: "In die Längen geben.",
          matched_profile: {
            thickness: "fine",
            density: "medium",
            protein_moisture_balance: "snaps",
            cuticle_condition: null,
            chemical_treatment: [],
          },
          matched_weight: "light",
          matched_repair_level: "high",
          matched_balance_need: "moisture",
          fit_status: "ideal",
          product_weight: "light",
          product_repair_level: "high",
          product_balance_direction: "moisture",
          active_damage_drivers: [],
        },
      }),
    ],
    {
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "snaps",
    } as HairProfile,
    "conditioner",
    runtime,
    {
      userJob: "product_pick",
      concerns: [],
      originalHairProfile: {
        thickness: "normal",
        density: "medium",
        protein_moisture_balance: "snaps",
      } as HairProfile,
      activeProfileSignals: [
        {
          field: "thickness",
          value: "fine",
          source: "message",
          selection_effect: "override",
          evidence: "feines Haar",
        },
      ],
    },
  )

  assert.deepEqual(result.profile_basis, [
    "Profil-Hinweis: aktuelle Angabe Haardicke Fein statt gespeichert Mittel",
    "Haardicke: Fein",
    "Haardichte: Mittlere Dichte",
    "Protein-/Feuchtigkeitsbalance: Feuchtigkeitsmangel",
    "Ziel-Gewicht: Leicht",
    "Pflegebedarf: Intensiv",
  ])
})

test("projectSelectedProducts keeps unsupported color requests out of conditioner claims", () => {
  const result = projectSelectedProducts(
    [createMatchedProduct("p-conditioner", 0.94)],
    {
      thickness: "normal",
      protein_moisture_balance: "stretches_bounces",
      chemical_treatment: ["colored"],
    } as HairProfile,
    "conditioner",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: [],
      activeProfileSignals: [
        {
          field: "chemical_treatment",
          value: "colored",
          source: "message",
          selection_effect: "qualifier",
          evidence: "coloriertem Haar",
        },
      ],
    },
  )

  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.reason,
    ]),
    [["chemical_treatment", "colored", "no_structured_product_data"]],
  )
  assert.equal(
    result.products[0]?.supported_claims.some((claim) => claim.field === "chemical_treatment"),
    false,
  )
})

test("projectSelectedProducts keeps conditioner comparison facts useful when fit axes match", () => {
  const result = projectSelectedProducts(
    [
      createMatchedProduct("p-1", 0.94, {
        price_eur: 12.99,
        recommendation_meta: {
          category: "conditioner",
          score: 94,
          top_reasons: ["Passt zum Zielprofil"],
          tradeoffs: [],
          usage_hint: "In die Längen geben.",
          matched_profile: {
            thickness: "normal",
            density: "medium",
            protein_moisture_balance: "snaps",
            cuticle_condition: null,
            chemical_treatment: [],
          },
          matched_weight: "medium",
          matched_repair_level: "high",
          matched_balance_need: "moisture",
          fit_status: "ideal",
          product_weight: "medium",
          product_repair_level: "high",
          product_balance_direction: "moisture",
          active_damage_drivers: [],
        },
      }),
      createMatchedProduct("p-2", 0.91, {
        price_eur: 6.99,
        recommendation_meta: {
          category: "conditioner",
          score: 91,
          top_reasons: ["Passt ebenfalls zum Zielprofil"],
          tradeoffs: [],
          usage_hint: "In die Längen geben.",
          matched_profile: {
            thickness: "normal",
            density: "medium",
            protein_moisture_balance: "snaps",
            cuticle_condition: null,
            chemical_treatment: [],
          },
          matched_weight: "medium",
          matched_repair_level: "high",
          matched_balance_need: "moisture",
          fit_status: "ideal",
          product_weight: "medium",
          product_repair_level: "high",
          product_balance_direction: "moisture",
          active_damage_drivers: [],
        },
      }),
    ],
    {
      thickness: "normal",
      density: "medium",
      protein_moisture_balance: "snaps",
    } as HairProfile,
    "conditioner",
    createRuntimeStub(),
    { userJob: "compare_or_decide", concerns: [] },
  )

  assert.deepEqual(result.comparison_facts, {
    "p-1": ["Balance: Feuchtigkeit", "Gewicht: Mittel", "Preis: 12.99 EUR"],
    "p-2": ["Balance: Feuchtigkeit", "Gewicht: Mittel", "Preis: 6.99 EUR"],
  })
  assertComparisonFactsAtLeast(result, ["p-1", "p-2"], 2)
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts exposes leave-in claims and unsupported ingredient caveats", () => {
  const result = projectSelectedProducts(
    [
      createLeaveInMatchedProduct("p-leave-in", 0.94),
      createLeaveInMatchedProduct("p-balanced", 0.88, {
        product_format: "cream",
        product_weight: "light",
        fit_status: "supportive",
        product_balance_direction: "balanced",
        provides_heat_protection: true,
      }),
    ],
    {
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "snaps",
      chemical_treatment: ["bleached"],
    } as HairProfile,
    "leave_in",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: ["frizz"],
      requestedIngredientSignals: [{ value: "silicone_free", evidence: "silikonfrei" }],
    },
  )

  assert.equal(result.decision, "recommended")
  assert.deepEqual(
    result.products[0].supported_claims.map((claim) => claim.field),
    [
      "format",
      "weight",
      "balance_direction",
      "fit_status",
      "heat_protection",
      "conditioner_relationship",
      "leave_in_role",
      "care_benefit",
    ],
  )
  assert.equal(
    result.products[0].supported_claims.some(
      (claim) => claim.field === "chemical_treatment" || claim.field === "density",
    ),
    false,
  )
  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "ingredient_preference",
    value: "silicone_free",
    reason: "no_structured_product_data",
    user_message:
      "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Leave-in-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Rolle, Hitzeschutz, Pflegefokus und Fit.",
  })
  assert.deepEqual(result.comparison_facts, {
    "p-leave-in": ["Format: Spray", "Gewicht: Mittel", "Balance: Feuchtigkeit"],
    "p-balanced": ["Format: Creme", "Gewicht: Leicht", "Balance: ausgewogene Pflege"],
  })
  assertComparisonFactsAtLeast(result, ["p-leave-in", "p-balanced"], 2)
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts prefers concrete leave-in differences over missing metadata", () => {
  const result = projectSelectedProducts(
    [
      createLeaveInMatchedProduct("p-with-format", 0.94),
      createLeaveInMatchedProduct("p-without-format", 0.88, {
        product_format: undefined,
        product_weight: "light",
      }),
    ],
    {
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "snaps",
    } as HairProfile,
    "leave_in",
    createRuntimeStub(),
  )

  assert.deepEqual(result.comparison_facts?.["p-with-format"]?.slice(0, 2), [
    "Gewicht: Mittel",
    "Format: Spray",
  ])
  assert.deepEqual(result.comparison_facts?.["p-without-format"]?.slice(0, 2), [
    "Gewicht: Leicht",
    "Balance: Feuchtigkeit",
  ])
})

test("projectSelectedProducts describes weaker leave-in alternatives without internal fallback wording", () => {
  const result = projectSelectedProducts(
    [
      createLeaveInMatchedProduct("p-primary", 0.94),
      createLeaveInMatchedProduct("p-weaker", 0.7, {
        fit_status: "mismatch",
        product_format: "cream",
        product_weight: "rich",
        product_balance_direction: "balanced",
        provides_heat_protection: false,
        tradeoffs: [
          "Fallback: Dieser Treffer passt nicht exakt zum Leave-in-Zielprofil und erscheint nur nachgeordnet.",
        ],
      }),
    ],
    {
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "snaps",
    } as HairProfile,
    "leave_in",
    createRuntimeStub(),
  )

  assertProjectionDoesNotExposeFallback(result)
  assert.match(result.products[1]?.fit_reason ?? "", /Schwächerer Treffer/)
  assert.match(result.products[1]?.caveat ?? "", /Nachgeordnet|nicht ganz so passend/)
  assert.match(result.comparison_facts?.["p-weaker"]?.join(" ") ?? "", /weicht etwas ab/)
  assertComparisonFactsAtLeast(result, ["p-primary", "p-weaker"], 2)
})

test("selectProducts applies leave-in thickness overrides and surfaces profile deviation", async () => {
  const observed: { thickness?: HairProfile["thickness"] } = {}
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, hairProfile, runtime }) => {
      assert.equal(category, "leave_in")
      observed.thickness = hairProfile?.thickness ?? null
      assert.equal(runtime.categories.leaveIn.targetProfile?.thickness, "fine")
      return [
        createLeaveInMatchedProduct("fine-leave-in", 0.94, {
          matched_profile: {
            hair_texture: "wavy",
            thickness: "fine",
            density: "medium",
            cuticle_condition: null,
            chemical_treatment: [],
          },
          product_weight: "light",
        }),
      ]
    },
  })

  const result = await tool({
    category: "leave_in",
    message:
      "Mein feines Haar braucht Pflege, wird aber schnell beschwert. Welches Leave-in passt?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      concerns: ["frizz"],
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    userJob: "product_pick",
    concerns: [],
    activeProfileSignals: [
      {
        field: "thickness",
        value: "fine",
        source: "message",
        selection_effect: "override",
        evidence: "feines Haar",
      },
    ],
  })

  assert.equal(observed.thickness, "fine")
  assert.ok(result.profile_basis.includes("Haardicke: Fein"))
  assert.ok(result.profile_basis.some((line) => line.startsWith("Profil-Hinweis:")))
  assert.equal(
    result.products[0]?.supported_claims.some((claim) => claim.field === "thickness"),
    false,
  )
})

test("selectProducts includes owned verified non-recommended products for assessment", async () => {
  const ownedProduct = createMatchedProduct("owned-conditioner", 1, {
    name: "Owned Conditioner",
    is_chaarlie_recommended: false,
    recommendation_meta: {
      category: "conditioner",
      score: 1,
      top_reasons: ["In deiner Routine gespeichert und verifiziert."],
      tradeoffs: [],
      usage_hint: "Wie in deiner Routine angegeben nutzen.",
      matched_profile: {
        thickness: "normal",
        density: null,
        protein_moisture_balance: null,
        cuticle_condition: null,
        chemical_treatment: [],
      },
      matched_weight: "medium",
      matched_repair_level: "medium",
      matched_balance_need: "balanced",
      product_weight: "medium",
      product_repair_level: "medium",
      product_balance_direction: "balanced",
      fit_status: "supportive",
    },
  })
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, routineItems, includeProductIds }) => {
      assert.equal(category, "conditioner")
      assert.equal(routineItems[0]?.product_id, "owned-conditioner")
      assert.deepEqual(includeProductIds, ["owned-conditioner"])
      return [ownedProduct]
    },
  })

  const result = await tool({
    category: "conditioner",
    message: "Passt mein Conditioner zu mir?",
    hairProfile: LOW_DAMAGE_PROFILE as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [
      {
        category: "conditioner",
        product_name: "Owned Conditioner",
        frequency_range: "weekly_2x",
        product_id: "owned-conditioner",
        product_submission_id: null,
        match_status: "matched",
      },
    ],
  })

  assert.equal(result.products[0]?.product_id, "owned-conditioner")
  assert.equal(result.products[0]?.name, "Owned Conditioner")
  assert.match(result.products[0]?.fit_reason ?? "", /Balance: ausgewogene Pflege/)
  assert.equal(
    result.products[0]?.supported_claims.some((claim) => claim.field === "weight"),
    true,
  )
})

test("selectProducts applies leave-in texture and density overrides with profile notices", async () => {
  const observed: {
    hairTexture?: HairProfile["hair_texture"]
    density?: HairProfile["density"]
  } = {}
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, hairProfile }) => {
      assert.equal(category, "leave_in")
      observed.hairTexture = hairProfile?.hair_texture ?? null
      observed.density = hairProfile?.density ?? null
      return [
        createLeaveInMatchedProduct("low-density-curl-leave-in", 0.94, {
          matched_profile: {
            hair_texture: "curly",
            thickness: "normal",
            density: "low",
            cuticle_condition: null,
            chemical_treatment: [],
          },
          product_weight: "light",
        }),
      ]
    },
  })

  const result = await tool({
    category: "leave_in",
    message: "Aktuell sind meine Haare lockig und eher wenig dicht. Welches Leave-in passt?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      hair_texture: "wavy",
      thickness: "normal",
      density: "medium",
      concerns: ["frizz"],
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    userJob: "product_pick",
    concerns: [],
    activeProfileSignals: [
      {
        field: "hair_texture",
        value: "curly",
        source: "message",
        selection_effect: "override",
        evidence: "lockig",
      },
      {
        field: "density",
        value: "low",
        source: "message",
        selection_effect: "override",
        evidence: "wenig dicht",
      },
    ],
  })

  assert.equal(observed.hairTexture, "curly")
  assert.equal(observed.density, "low")
  assert.ok(
    result.profile_basis.includes(
      "Profil-Hinweis: aktuelle Angabe Haarmuster Lockig statt gespeichert Wellig",
    ),
  )
  assert.ok(
    result.profile_basis.includes(
      "Profil-Hinweis: aktuelle Angabe Haardichte Wenig Haare statt gespeichert Mittlere Dichte",
    ),
  )
  assert.ok(result.profile_basis.includes("Haarmuster: Lockig"))
  assert.ok(result.profile_basis.includes("Haardichte: Wenig Haare"))
})

test("selectProducts applies leave-in heat tool overrides to the runtime", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "leave_in")
      assert.equal(runtime.categories.leaveIn.targetProfile?.heatProtectionNeed, "high")
      assert.equal(runtime.categories.leaveIn.targetProfile?.stylingPrepNeed, "heat_style")
      return [createLeaveInMatchedProduct("heat-leave-in", 0.94)]
    },
  })

  const result = await tool({
    category: "leave_in",
    message: "Welches Leave-in mit Hitzeschutz passt, wenn ich föhne oder glätte?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      concerns: ["dryness", "frizz"],
      protein_moisture_balance: "snaps",
      cuticle_condition: "slightly_rough",
      heat_styling: "never",
      styling_tools: [],
      drying_method: "air_dry",
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    activeProfileSignals: [
      {
        field: "styling_tools",
        value: "flat_iron",
        source: "message",
        selection_effect: "override",
        evidence: "glätte",
      },
      {
        field: "styling_tools",
        value: "blow_dryer",
        source: "message",
        selection_effect: "override",
        evidence: "föhne",
      },
    ],
  })

  assert.equal(result.products[0]?.name, "Produkt heat-leave-in")
})

test("selectProducts builds a leave-in target for explicit heat requests on otherwise quiet profiles", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "leave_in")
      assert.equal(runtime.categories.leaveIn.relevant, true)
      assert.equal(runtime.categories.leaveIn.targetProfile?.heatProtectionNeed, "high")
      assert.equal(runtime.categories.leaveIn.targetProfile?.stylingPrepNeed, "heat_style")
      return [createLeaveInMatchedProduct("heat-leave-in", 0.94)]
    },
  })

  const result = await tool({
    category: "leave_in",
    message: "Welches Leave-in mit Hitzeschutz passt, wenn ich föhne oder glätte?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      concerns: [],
      goals: ["shine"],
      heat_styling: "never",
      styling_tools: [],
      drying_method: "air_dry",
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    activeProfileSignals: [
      {
        field: "styling_tools",
        value: "flat_iron",
        source: "message",
        selection_effect: "override",
        evidence: "glätte",
      },
      {
        field: "styling_tools",
        value: "blow_dryer",
        source: "message",
        selection_effect: "override",
        evidence: "föhne",
      },
    ],
  })

  assert.equal(result.decision, "recommended")
})

test("selectProducts builds a leave-in heat target from generic Hitzeschutz wording", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "leave_in")
      assert.equal(runtime.categories.leaveIn.relevant, true)
      assert.equal(runtime.categories.leaveIn.targetProfile?.heatProtectionNeed, "high")
      assert.equal(runtime.categories.leaveIn.targetProfile?.stylingPrepNeed, "heat_style")
      return [createLeaveInMatchedProduct("heat-leave-in", 0.94)]
    },
  })

  const result = await tool({
    category: "leave_in",
    message: "Welches Leave-in passt mit Hitzeschutz?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      concerns: [],
      goals: [],
      heat_styling: "never",
      styling_tools: [],
      drying_method: "air_dry",
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.equal(result.decision, "recommended")
})

test("selectProducts treats separate heat protectant as a leave-in bonus for blow-dry-only requests", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "leave_in")
      assert.equal(runtime.requestContext.leaveInSeparateHeatProtectantMentioned, true)
      assert.equal(runtime.requestContext.leaveInHeatProtectionRequest, null)
      assert.equal(runtime.categories.leaveIn.relevant, true)
      assert.equal(runtime.categories.leaveIn.targetProfile?.heatProtectionNeed, "moderate")
      assert.equal(runtime.categories.leaveIn.targetProfile?.stylingPrepNeed, "none")
      assert.equal(runtime.categories.leaveIn.targetProfile?.hasSeparateHeatProtectant, true)
      return [createLeaveInMatchedProduct("care-leave-in", 0.94)]
    },
  })

  const result = await tool({
    category: "leave_in",
    message: "Ich föhne nur und habe schon einen separaten Hitzeschutz. Welches Leave-in passt?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "coarse",
      density: "medium",
      concerns: [],
      goals: [],
      heat_styling: "daily",
      styling_tools: [],
      drying_method: "air_dry",
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    activeProfileSignals: [
      {
        field: "styling_tools",
        value: "blow_dryer",
        source: "message",
        selection_effect: "override",
        evidence: "föhne",
      },
    ],
  })

  assert.equal(result.decision, "recommended")
  assert.ok(
    result.profile_basis.includes(
      "Separater Hitzeschutz vorhanden: Leave-in-Hitzeschutz ist Bonus, kein Muss.",
    ),
  )
  assert.match(result.category_guidance, /im Einstieg ausdrücklich/)
  assert.match(result.category_guidance, /ein Produkt weniger/)
  assert.match(result.category_guidance, /separaten Hitzeschutz behalten/)
})

test("selectProducts marks exact leave-in heat temperatures unsupported", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async () => [createLeaveInMatchedProduct("heat-leave-in", 0.94)],
  })

  const result = await tool({
    category: "leave_in",
    message: "Welches Leave-in schuetzt sicher bis 230 Grad?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      uses_heat_protection: false,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "heat_temperature",
    value: "230",
    reason: "no_structured_product_data",
    user_message:
      "Exakte Hitzeschutz-Temperaturen wie 230 Grad sind in dieser Leave-in-Auswahl nicht sicher operationalisiert. Ich bewerte die Optionen deshalb nur danach, ob Hitzeschutz strukturiert erfasst ist.",
  })
})

test("selectProducts recommends conditioner for low-need balanced profile with existing conditioner", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "conditioner")
      assert.equal(runtime.categories.conditioner.relevant, true)
      assert.equal(runtime.categories.conditioner.action, "keep")
      assert.equal(runtime.categories.conditioner.targetProfile?.balance, "balanced")
      assert.equal(runtime.categories.conditioner.targetProfile?.repairLevel, "low")
      assert.equal(runtime.categories.conditioner.targetProfile?.weight, "medium")

      return [
        createMatchedProduct("light-balanced", 0.94, {
          name: "Light Balanced Conditioner",
          recommendation_meta: {
            category: "conditioner",
            score: 94,
            top_reasons: ["Passt zu einem leichten, ausgewogenen Conditioner-Zielprofil."],
            tradeoffs: [],
            usage_hint: "In die Längen geben.",
            matched_profile: {
              thickness: "fine",
              density: "medium",
              protein_moisture_balance: "stretches_bounces",
              cuticle_condition: "smooth",
              chemical_treatment: [],
            },
            matched_weight: "medium",
            matched_repair_level: "low",
            matched_balance_need: "balanced",
            fit_status: "ideal",
            product_weight: "medium",
            product_repair_level: "low",
            product_balance_direction: "balanced",
            active_damage_drivers: [],
          },
        }),
      ]
    },
  })

  const result = await tool({
    category: "conditioner",
    message: "Welche Spuelung passt zu meinem feinen Haar, ohne es zu beschweren?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      protein_moisture_balance: "stretches_bounces",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [
      {
        category: "conditioner",
        product_name: "Current Conditioner",
        frequency_range: "weekly_3_4x",
      },
    ],
    userJob: "product_pick",
    concerns: [],
    activeProfileSignals: [
      {
        field: "thickness",
        value: "fine",
        source: "message",
        selection_effect: "override",
        evidence: "feines Haar",
      },
    ],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "recommend")
  assert.deepEqual(
    result.products.map((product) => product.name),
    ["Light Balanced Conditioner"],
  )
  assert.ok(result.profile_basis.includes("Haardicke: Fein"))
  assert.ok(result.profile_basis.includes("Ziel-Gewicht: Mittel"))
  assert.ok(result.profile_basis.includes("Pflegebedarf: Leicht"))
})

test("selectProducts keeps silicone-free unsupported while still recommending conditioner", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async () => [
      createMatchedProduct("balanced", 0.94, {
        name: "Balanced Conditioner",
        recommendation_meta: {
          category: "conditioner",
          score: 94,
          top_reasons: ["Passt zum ausgewogenen Conditioner-Zielprofil."],
          tradeoffs: [],
          usage_hint: "In die Längen geben.",
          matched_profile: {
            thickness: "normal",
            density: "medium",
            protein_moisture_balance: "stretches_bounces",
            cuticle_condition: "smooth",
            chemical_treatment: [],
          },
          matched_weight: "medium",
          matched_repair_level: "low",
          matched_balance_need: "balanced",
          fit_status: "ideal",
          product_weight: "medium",
          product_repair_level: "low",
          product_balance_direction: "balanced",
          active_damage_drivers: [],
        },
      }),
    ],
  })

  const result = await tool({
    category: "conditioner",
    message: "Welchen silikonfreien Conditioner empfiehlst du mir?",
    hairProfile: LOW_DAMAGE_PROFILE,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [
      {
        category: "conditioner",
        product_name: "Current Conditioner",
        frequency_range: "weekly_3_4x",
      },
    ],
    userJob: "product_pick",
    concerns: [],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(result.products.length, 1)
  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
  assert.deepEqual(
    result.products[0]?.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
})

test("selectProducts keeps silicone-free unsupported while still recommending shampoo", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async () => [
      createShampooMatchedProduct("balanced-shampoo", 0.94, ["Passt zum Shampoo-Zielprofil."]),
    ],
  })

  const result = await tool({
    category: "shampoo",
    message: "Welches silikonfreie Shampoo empfiehlst du mir?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: null,
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [
      {
        category: "shampoo",
        product_name: "Current Shampoo",
        frequency_range: "weekly_3_4x",
      },
    ],
    userJob: "product_pick",
    concerns: [],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(result.products.length, 1)
  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
  assert.deepEqual(
    result.products[0]?.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
  assert.match(result.unsupported_requested_signals[0]?.user_message ?? "", /Shampoo-Auswahl/)
})

test("projectSelectedProducts exposes conditioner ingredient caveat even with no products", () => {
  const result = projectSelectedProducts(
    [],
    LOW_DAMAGE_PROFILE,
    "conditioner",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: [],
      requestedIngredientSignals: [{ value: "silicone_free", evidence: "silikonfrei" }],
    },
  )

  assert.equal(result.decision, "no_catalog_match")
  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
})

test("projectSelectedProducts exposes mask ingredient caveat even with no products", () => {
  const result = projectSelectedProducts([], LOW_DAMAGE_PROFILE, "mask", createRuntimeStub(), {
    userJob: "product_pick",
    concerns: [],
    requestedIngredientSignals: [{ value: "silicone_free", evidence: "silikonfreie Maske" }],
  })

  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
  assert.match(result.unsupported_requested_signals[0]?.user_message ?? "", /Masken-Auswahl/)
})

test("selectProducts tool carries unsupported ingredient caveats for leave-in requests", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async () => [createLeaveInMatchedProduct("p-leave-in", 0.94)],
  })

  const result = await tool({
    category: "leave_in",
    message: "Ich suche ein silikonfreies Leave-in.",
    hairProfile: {
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "snaps",
      concerns: ["frizz"],
      chemical_treatment: [],
      uses_heat_protection: false,
    } as unknown as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "ingredient_preference",
    value: "silicone_free",
    reason: "no_structured_product_data",
    user_message:
      "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Leave-in-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Rolle, Hitzeschutz, Pflegefokus und Fit.",
  })
})

test("selectProducts tool passes request-aware mask runtime into category engine", async () => {
  const observed: { runtime?: RecommendationEngineRuntime } = {}
  const tool = createSelectProductsTool({
    runCategoryEngine: async (params: { runtime?: RecommendationEngineRuntime }) => {
      observed.runtime = params.runtime
      return []
    },
  })

  await tool({
    category: "mask",
    message: "Welche intensive Maske passt zu mir?",
    hairProfile: LOW_DAMAGE_PROFILE,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  const runtime = observed.runtime
  assert.ok(runtime)
  assert.equal(runtime.requestContext.requestedCategory, "mask")
  assert.equal(runtime.requestContext.maskIntensityRequest, "intensive")
  assert.equal(runtime.categories.mask.relevant, true)
  assert.equal(runtime.categories.mask.targetProfile?.role, "optional")
  assert.equal(runtime.categories.mask.targetProfile?.repairLevel, "medium")
})

test("projectSelectedProducts exposes mask claims and unsupported ingredient caveats", () => {
  const result = projectSelectedProducts(
    [
      createMaskMatchedProduct("p-mask-1", 0.94),
      createMaskMatchedProduct("p-mask-2", 0.88, {
        fit_status: "supportive",
        role: "optional",
        product_weight: "rich",
        product_concentration: "high",
        product_balance_direction: "balanced",
        tradeoffs: ["Wenn du sie testest, dann eher sparsam und nicht bei jeder Wäsche."],
      }),
    ],
    LOW_DAMAGE_PROFILE,
    "mask",
    createRuntimeStub(),
    {
      requestedIngredientSignals: [{ value: "silicone_free", evidence: "silikonfrei" }],
    },
  )

  assert.deepEqual(
    result.products[0].supported_claims.map((claim) => claim.field),
    ["weight", "balance_direction", "concentration", "fit_status"],
  )
  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "ingredient_preference",
    value: "silicone_free",
    reason: "no_structured_product_data",
    user_message:
      "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Masken-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Intensität und Fit.",
  })
  assert.deepEqual(result.comparison_facts, {
    "p-mask-1": ["Balance: Protein", "Intensität: Mittel", "Gewicht: Mittel"],
    "p-mask-2": ["Balance: Ausgewogen", "Intensität: Hoch", "Gewicht: Reichhaltig"],
  })
  assertComparisonFactsAtLeast(result, ["p-mask-1", "p-mask-2"], 2)
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts describes weaker mask alternatives without internal fallback wording", () => {
  const result = projectSelectedProducts(
    [
      createMaskMatchedProduct("p-mask-primary", 0.94),
      createMaskMatchedProduct("p-mask-weaker", 0.7, {
        fit_status: "mismatch",
        product_weight: "rich",
        product_concentration: "high",
        product_balance_direction: "balanced",
        tradeoffs: [
          "Fallback: Dieser Treffer passt nicht exakt zum Masken-Zielprofil und erscheint nur nachgeordnet.",
        ],
      }),
    ],
    LOW_DAMAGE_PROFILE,
    "mask",
    createRuntimeStub(),
  )

  assertProjectionDoesNotExposeFallback(result)
  assert.match(result.products[1]?.fit_reason ?? "", /Schwächerer Treffer/)
  assert.match(result.products[1]?.caveat ?? "", /Nachgeordnet|nicht ganz so passend/)
  assert.match(result.comparison_facts?.["p-mask-weaker"]?.join(" ") ?? "", /weicht etwas ab/)
  assertComparisonFactsAtLeast(result, ["p-mask-primary", "p-mask-weaker"], 2)
})

test("projectSelectedProducts preserves unsupported active qualifiers for mask products", () => {
  const result = projectSelectedProducts(
    [createMaskMatchedProduct("p-mask-bleached", 0.94)],
    { ...LOW_DAMAGE_PROFILE, chemical_treatment: ["bleached"] } as HairProfile,
    "mask",
    createRuntimeStub(),
    {
      activeProfileSignals: [
        {
          field: "chemical_treatment",
          value: "bleached",
          source: "message",
          selection_effect: "qualifier",
          evidence: "blondierte Laengen",
        },
      ],
    },
  )

  assert.deepEqual(result.products[0].unsupported_requested_signals[0], {
    field: "chemical_treatment",
    value: "bleached",
    reason: "no_structured_product_data",
    user_message:
      "Zu blondiertem Haar habe ich bei diesen Produkten aktuell keine sichere Spezialangabe. Ich bewerte sie deshalb nach den sicheren Produktangaben.",
  })
  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "chemical_treatment",
    value: "bleached",
    reason: "no_structured_product_data",
    user_message:
      "Zu blondiertem Haar habe ich bei diesen Produkten aktuell keine sichere Spezialangabe. Ich bewerte sie deshalb nach den sicheren Produktangaben.",
  })
})

test("projectSelectedProducts preserves unsupported active qualifiers without displayable products", () => {
  const result = projectSelectedProducts([], LOW_DAMAGE_PROFILE, "mask", createRuntimeStub(), {
    activeProfileSignals: [
      {
        field: "chemical_treatment",
        value: "colored",
        source: "message",
        selection_effect: "qualifier",
        evidence: "coloriertes Haar",
      },
    ],
  })

  assert.equal(result.products.length, 0)
  assert.deepEqual(result.unsupported_requested_signals[0], {
    field: "chemical_treatment",
    value: "colored",
    reason: "no_structured_product_data",
    user_message:
      "Zum Farbschutz habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den sicheren Produktangaben.",
  })
})

test("projectSelectedProducts exposes mask profile basis with balance and target axes", () => {
  const runtime = createRuntimeStub()
  runtime.categories.mask = {
    category: "mask",
    relevant: true,
    action: "add",
    planReasonCodes: ["explicit_mask_request"],
    currentInventory: null,
    targetProfile: {
      balance: "protein",
      repairLevel: "medium",
      weight: "light",
      needStrength: 2,
      role: "fixed",
      intensityRequest: null,
      thickness: "fine",
      density: "medium",
    },
    notes: [],
  } satisfies MaskCategoryDecision

  const result = projectSelectedProducts(
    [createMaskMatchedProduct("p-mask-1", 0.94)],
    {
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "stretches_stays",
      concerns: ["dryness"],
      chemical_treatment: ["colored"],
    } as HairProfile,
    "mask",
    runtime,
  )

  assert.ok(result.profile_basis.includes("Haardicke: Fein"))
  assert.ok(result.profile_basis.includes("Haardichte: Mittlere Dichte"))
  assert.ok(result.profile_basis.includes("Protein-/Feuchtigkeitsbalance: Proteinmangel"))
  assert.ok(result.profile_basis.includes("Ziel-Gewicht: Leicht"))
  assert.ok(result.profile_basis.includes("Ziel-Balance: Protein"))
  assert.ok(result.profile_basis.includes("Masken-Intensität: Mittel"))
})

test("projectSelectedProducts keeps mask comparison facts useful when fit axes match", () => {
  const result = projectSelectedProducts(
    [
      createMaskMatchedProduct("p-mask-cheap", 0.94),
      createMaskMatchedProduct("p-mask-pricey", 0.93),
    ].map((product, index) => ({
      ...product,
      price_eur: index === 0 ? 4.95 : 12.95,
    })),
    LOW_DAMAGE_PROFILE,
    "mask",
    createRuntimeStub(),
  )

  assert.deepEqual(result.comparison_facts, {
    "p-mask-cheap": ["Balance: Protein", "Intensität: Mittel", "Preis: 4.95 EUR"],
    "p-mask-pricey": ["Balance: Protein", "Intensität: Mittel", "Preis: 12.95 EUR"],
  })
  assertComparisonFactsAtLeast(result, ["p-mask-cheap", "p-mask-pricey"], 2)
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts prefers concrete mask differences over missing metadata", () => {
  const result = projectSelectedProducts(
    [
      createMaskMatchedProduct("p-mask-with-balance", 0.94),
      createMaskMatchedProduct("p-mask-without-balance", 0.93, {
        product_balance_direction: undefined,
        product_concentration: "high",
      }),
    ],
    LOW_DAMAGE_PROFILE,
    "mask",
    createRuntimeStub(),
  )

  assert.deepEqual(result.comparison_facts?.["p-mask-with-balance"]?.slice(0, 2), [
    "Intensität: Mittel",
    "Balance: Protein",
  ])
  assert.deepEqual(result.comparison_facts?.["p-mask-without-balance"]?.slice(0, 2), [
    "Intensität: Hoch",
    "Gewicht: Mittel",
  ])
})

test("projectSelectedProducts keeps optional bondbuilder assessment with priced products", () => {
  const bondbuilderDecision: BondbuilderCategoryDecision = {
    category: "bondbuilder",
    relevant: true,
    action: null,
    planReasonCodes: ["bondbuilder_explicit_optional_low_need"],
    currentInventory: null,
    targetProfile: {
      bondRepairIntensity: "maintenance",
      applicationMode: "pre_shampoo",
      chemicalCrosslinkLane: false,
      peptideChainLane: false,
      mixedOrSevereCombo: false,
      proteinBalanceSupportingOnly: false,
      role: "optional",
    },
    notes: [],
  }
  const runtime = createRuntimeStub()
  runtime.categories.bondbuilder = bondbuilderDecision

  const result = projectSelectedProducts(
    [
      createMatchedProduct("bondbuilder", 0.94, {
        category: "Bondbuilder",
        price_eur: 34,
        currency: "EUR",
        recommendation_meta: {
          category: "bondbuilder",
          score: 9.4,
          top_reasons: ["Passt für eher konservative Bondbuilding-Unterstützung."],
          tradeoffs: ["Stärker als der aktuelle Pflichtbedarf."],
          usage_hint: "Sparsam als Zusatz einsetzen.",
          matched_intensity: "maintenance",
          application_mode: "pre_shampoo",
          bond_repair_axis: "disulfide_crosslink",
          treatment_mode: "rinse_out",
          product_format: "cream_treatment",
          usage_protocol: "olaplex_3plus",
          lifecycle_status: "active",
        } satisfies BondbuilderRecommendationMetadata,
      }),
      createMatchedProduct("k18", 0.91, {
        category: "Bondbuilder",
        price_eur: 75,
        currency: "EUR",
        recommendation_meta: {
          category: "bondbuilder",
          score: 9.1,
          top_reasons: ["Passt für eher konservative Bondbuilding-Unterstützung."],
          tradeoffs: ["Stärker als der aktuelle Pflichtbedarf."],
          usage_hint: "Sparsam als Zusatz einsetzen.",
          matched_intensity: "maintenance",
          application_mode: "pre_shampoo",
          bond_repair_axis: "peptide_chain",
          treatment_mode: "leave_in",
          product_format: "leave_in_mask",
          usage_protocol: "k18_leave_in",
          lifecycle_status: "active",
        } satisfies BondbuilderRecommendationMetadata,
      }),
    ],
    LOW_DAMAGE_PROFILE,
    "bondbuilder",
    runtime,
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "explain_then_recommend")
  assert.match(result.policy_reason, /kein zwingender Bondbuilder-Bedarf/)
  assert.match(result.category_guidance, /optionaler Zusatz/)
  assert.match(result.category_guidance, /K18/)
  assert.match(result.category_guidance, /OLAPLEX/)
  assert.ok(result.profile_basis.includes("Bondbuilder-Check: Optional, kein Pflichtschritt"))
  assert.ok(result.profile_basis.includes("Bondbuilder-Lane: kein klarer K18-vs-OLAPLEX-Treiber"))
  assert.equal(result.products[0]?.price_eur, 34)
  assert.equal(result.products[0]?.currency, "EUR")
  assert.match(result.comparison_facts?.bondbuilder?.join(" ") ?? "", /chemisch/)
  assert.match(result.comparison_facts?.k18?.join(" ") ?? "", /Bruch/)
})

test("projectSelectedProducts exposes bondbuilder usage hints as user-facing product claims", () => {
  const usageHint =
    "Nach dem Shampoo ohne Conditioner auf handtuchtrockenes Haar geben, 4 Minuten einwirken lassen, nicht ausspülen und danach stylen. In den ersten 4-6 Wäschen nach jeder Wäsche, danach nach Bedarf verwenden."

  const result = projectSelectedProducts(
    [
      createMatchedProduct("k18-leave-in", 0.95, {
        category: "Bondbuilder",
        recommendation_meta: {
          category: "bondbuilder",
          score: 9.5,
          top_reasons: ["Passt als Leave-in-Strukturpflege für stark beanspruchte Längen."],
          tradeoffs: [],
          usage_hint: usageHint,
          matched_intensity: "intensive",
          application_mode: "post_wash_leave_in",
          bond_repair_axis: "peptide_chain",
          treatment_mode: "leave_in",
          product_format: "leave_in_mask",
          usage_protocol: "k18_leave_in",
          lifecycle_status: "active",
        } satisfies BondbuilderRecommendationMetadata,
      }),
    ],
    {
      ...LOW_DAMAGE_PROFILE,
      chemical_treatment: ["bleached"],
      concerns: ["breakage"],
    } as HairProfile,
    "bondbuilder",
    createRuntimeStub(),
  )

  const usageClaim = result.products[0]?.supported_claims.find(
    (claim) => claim.field === "usage_hint",
  )

  assert.ok(usageClaim, "bondbuilder product should expose exact usage_hint")
  assert.equal(usageClaim.value, usageHint)
  assert.equal(usageClaim.evidence, "product_spec")
  assert.equal(usageClaim.label, `Anwendung: ${usageHint}`)
  assert.notEqual(usageClaim.value, "k18_leave_in")
  assert.equal(
    result.products[0]?.supported_claims.some((claim) => claim.field === "usage_protocol"),
    false,
    "bondbuilder product claims should not expose internal usage_protocol ids",
  )
})

test("projectSelectedProducts labels deep-cleansing reset facts without raw enum copy", () => {
  const result = projectSelectedProducts(
    [
      createMatchedProduct("deep-reset", 0.94, {
        category: "Tiefenreinigungsshampoo",
        recommendation_meta: {
          category: "deep_cleansing_shampoo",
          score: 9.4,
          top_reasons: ["Passt als Reset für Aufbau und Hartwasser-Kontext."],
          tradeoffs: [],
          usage_hint: "Gelegentlich statt normalem Shampoo verwenden.",
          reset_need_level: "strong",
          reset_focus: "broad_spectrum_detox",
          reset_intensity: "medium",
          scalp_type_focus: "balanced",
          color_treated_suitability: "suitable",
          fit_status: "ideal",
          caution_flags: [],
        } satisfies DeepCleansingShampooRecommendationMetadata,
      }),
    ],
    {
      ...LOW_DAMAGE_PROFILE,
      chemical_treatment: ["colored"],
      scalp_type: "balanced",
      concerns: ["oily_scalp"],
    } as HairProfile,
    "deep_cleansing_shampoo",
    createRuntimeStub(),
  )

  const renderedFacts = [
    ...(result.comparison_facts?.["deep-reset"] ?? []),
    ...(result.products[0]?.supported_claims.flatMap((claim) => [claim.label, claim.value]) ?? []),
    result.products[0]?.fit_reason ?? "",
  ].join(" ")

  assert.match(renderedFacts, /breiter Styling-, Produkt- und Mineral-Reset/)
  assert.match(renderedFacts, /Reset-Intensität: mittel/)
  assert.match(renderedFacts, /Kopfhaut-Fokus: ausgeglichene Kopfhaut/)
  assert.match(renderedFacts, /Fit: idealer Treffer/)
  assert.doesNotMatch(renderedFacts, /broad_spectrum_detox|product_sebum_buildup|medium|balanced/)
})

test("projectSelectedProducts redirects scalp-only conditioner requests without products", () => {
  const result = projectSelectedProducts(
    [createMatchedProduct("p-conditioner", 0.94)],
    { thickness: "normal" } as HairProfile,
    "conditioner",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: ["irritation"],
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Kopfhaut/)
})

test("projectSelectedProducts redirects scalp-only mask requests without products", () => {
  const result = projectSelectedProducts(
    [createMaskMatchedProduct("p-mask", 0.9)],
    { thickness: "normal" } as HairProfile,
    "mask",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: ["dandruff_or_flakes"],
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Kopfhaut/)
})

test("projectSelectedProducts returns explain-then-recommend policy for oily roots", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum fettigen Ansatz"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    { userJob: "product_pick", concerns: ["oily_roots"] },
  )

  assert.equal(result.product_response_policy, "explain_then_recommend")
  assert.match(result.policy_reason, /Ansatz|Kopfhaut|Wasch/i)
})

test("projectSelectedProducts returns needs_more_info for blocking shampoo gaps", () => {
  const missingThickness = projectSelectedProducts([], null, "shampoo")

  assert.equal(missingThickness.decision, "needs_more_info")
  assert.equal(missingThickness.product_response_policy, "needs_more_info")
  assert.deepEqual(
    missingThickness.missing_info.map((item) => [item.key, item.blocking]),
    [
      ["thickness", true],
      ["scalp_type", true],
      ["scalp_condition", true],
    ],
  )

  const missingScalpFocus = projectSelectedProducts(
    [],
    { thickness: "normal" } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        targetProfile: {
          scalpRoute: null,
          shampooBucket: null,
          secondaryBucket: null,
          cleansingIntensity: null,
        },
      }),
    ),
  )

  assert.equal(missingScalpFocus.decision, "needs_more_info")
  assert.equal(missingScalpFocus.product_response_policy, "needs_more_info")
  assert.deepEqual(
    missingScalpFocus.missing_info.map((item) => [item.key, item.blocking]),
    [
      ["scalp_type", true],
      ["scalp_condition", true],
    ],
  )
})

test("projectSelectedProducts returns no_catalog_match when shampoo fits but no product is displayable", () => {
  const result = projectSelectedProducts(
    [],
    {
      thickness: "normal",
      scalp_type: "oily",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
  )

  assert.equal(result.decision, "no_catalog_match")
  assert.equal(result.product_response_policy, "no_catalog_match")
  assert.match(result.category_guidance, /Katalog/)
  assert.deepEqual(result.products, [])
  assert.deepEqual(result.missing_info, [])
})

test("projectSelectedProducts blocks conditioner products when required profile info is missing", () => {
  const result = projectSelectedProducts(
    [createMatchedProduct("p-conditioner", 0.94)],
    { protein_moisture_balance: "snaps" } as HairProfile,
    "conditioner",
    createRuntimeStub(),
  )

  assert.equal(result.decision, "needs_more_info")
  assert.equal(result.product_response_policy, "needs_more_info")
  assert.deepEqual(result.products, [])
  assert.deepEqual(result.missing_info, [
    {
      key: "thickness",
      label: "Haardicke",
      blocking: true,
      detail: "Ohne Haardicke kann die Conditioner-Auswahl nicht sinnvoll eingegrenzt werden.",
    },
  ])
})

test("projectSelectedProducts blocks conditioner products when protein balance is missing", () => {
  const result = projectSelectedProducts(
    [createMatchedProduct("p-conditioner", 0.94)],
    { thickness: "fine" } as HairProfile,
    "conditioner",
    createRuntimeStub(),
  )

  assert.equal(result.decision, "needs_more_info")
  assert.deepEqual(result.products, [])
  assert.deepEqual(result.missing_info, [
    {
      key: "protein_moisture_balance",
      label: "Protein-/Feuchtigkeitsbalance",
      blocking: true,
      detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance für die Conditioner-Auswahl.",
    },
  ])
})

test("projectSelectedProducts blocks mask products when protein balance is missing", () => {
  const result = projectSelectedProducts(
    [createMaskMatchedProduct("p-mask", 0.94)],
    { thickness: "fine" } as HairProfile,
    "mask",
    createRuntimeStub(),
  )

  assert.equal(result.decision, "needs_more_info")
  assert.deepEqual(result.products, [])
  assert.deepEqual(result.missing_info, [
    {
      key: "protein_moisture_balance",
      label: "Protein-/Feuchtigkeitsbalance",
      blocking: true,
      detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance für die Masken-Auswahl.",
    },
  ])
})

test("projectSelectedProducts preserves oil no-recommendation decisions as redirects", () => {
  const runtime = createRuntimeStub({
    requestContext: {
      ...createRuntimeStub().requestContext,
      requestedCategory: "oil",
      oilPurpose: null,
      oilNoRecommendationReason: "overload_risk",
    },
  })
  runtime.categories.oil = {
    category: "oil",
    relevant: true,
    action: "decrease_frequency",
    planReasonCodes: ["oil_overload_suppress_products"],
    currentInventory: {
      category: "oil",
      present: true,
      productName: "Current Oil",
      frequencyBand: "weekly_3_4x",
    },
    targetProfile: null,
    clarificationNeeded: false,
    noRecommendationReason: "overload_risk",
    notes: ["oil_overload_suppress_products"],
  } as RecommendationEngineRuntime["categories"]["oil"]

  const result = projectSelectedProducts(
    [],
    { ...LOW_DAMAGE_PROFILE, thickness: "fine", density: "low" } as HairProfile,
    "oil",
    runtime,
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
  assert.deepEqual(result.missing_info, [])
  assert.match(result.policy_reason, /unterdrückt Produkte/)
  assert.match(result.category_guidance, /Build-up|weniger Öl|Keine Öl-Produkte/)
})

test("projectSelectedProducts returns not_recommended when shampoo is not the right lever", () => {
  const result = projectSelectedProducts(
    [],
    { thickness: "normal" } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        relevant: false,
        action: null,
        targetProfile: null,
      }),
    ),
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.match(result.category_guidance, /nicht der wichtigste Hebel/)
  assert.deepEqual(result.products, [])
})

test("projectSelectedProducts suppresses shampoo products when the category is not recommended", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Wäre ein guter Shampoo-Treffer"])],
    { thickness: "normal" } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        relevant: false,
        action: null,
        targetProfile: null,
      }),
    ),
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
  assert.equal(result.comparison_facts, null)
})

test("projectSelectedProducts treats dry-length shampoo questions as not shampoo-first", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Wäre ein guter Shampoo-Treffer"])],
    {
      thickness: "normal",
      scalp_type: "balanced",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "troubleshoot",
      concerns: ["dry_lengths"],
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.match(result.category_guidance, /Trockene Längen/)
  assert.deepEqual(result.products, [])
})

test("projectSelectedProducts keeps mixed oily-root and dry-length shampoo prompts recommendable", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum fettigen Ansatz"])],
    {
      thickness: "normal",
      scalp_type: "oily",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "compare_or_decide",
      concerns: ["oily_roots", "dry_lengths"],
    },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "explain_then_recommend")
  assert.equal(result.products.length, 1)
})

test("projectSelectedProducts keeps mixed oily-root and frizz shampoo prompts recommendable", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum fettigen Ansatz"])],
    {
      thickness: "normal",
      scalp_type: "oily",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "compare_or_decide",
      concerns: ["oily_roots", "frizz"],
    },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "explain_then_recommend")
  assert.equal(result.products.length, 1)
})

const shampooPolicyCases = [
  {
    label: "dry lengths",
    concerns: ["dry_lengths"],
    requestedGoal: null,
    expectedPolicy: "recommend_with_caveat",
  },
  {
    label: "shine",
    concerns: [],
    requestedGoal: "shine",
    expectedPolicy: "recommend_with_caveat",
  },
  {
    label: "frizz",
    concerns: ["frizz"],
    requestedGoal: null,
    expectedPolicy: "recommend_with_caveat",
  },
  {
    label: "flakes irritation",
    concerns: ["dandruff_or_flakes", "irritation"],
    requestedGoal: null,
    expectedPolicy: "caution_without_products",
  },
] as const

for (const entry of shampooPolicyCases) {
  test(`projectSelectedProducts uses shampoo policy for ${entry.label}`, () => {
    const result = projectSelectedProducts(
      [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
      { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
      "shampoo",
      createShampooRuntimeStub(createRelevantShampooDecision()),
      {
        userJob: "product_pick",
        message:
          entry.label === "shine"
            ? "welches shampoo kannst du fuer mehr glanz empfehlen"
            : entry.label === "frizz"
              ? "welches shampoo kannst du gegen frizz empfehlen"
              : "welches shampoo kannst du fuer trockene laengen empfehlen",
        concerns: [...entry.concerns],
        requestedGoal: entry.requestedGoal,
      },
    )

    if (entry.expectedPolicy === "recommend_with_caveat") {
      assert.equal(result.decision, "recommended")
      assert.equal(result.products.length, 1)
      assert.match(result.category_guidance, /nicht der stärkste Hebel|stärkerer Hebel/i)
    } else {
      assert.equal(result.decision, "not_recommended")
      assert.equal(result.products.length, 0)
    }
    assert.equal(result.product_response_policy, entry.expectedPolicy)
  })
}

test("projectSelectedProducts still redirects weak-lever shampoo when the user is not explicitly asking for products", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "troubleshoot",
      concerns: ["frizz"],
      requestedGoal: null,
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.equal(result.products.length, 0)
})

test("projectSelectedProducts still redirects compare-or-decide weak-lever shampoo without explicit product ask", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "compare_or_decide",
      message: "brauche ich shampoo gegen trockene laengen",
      concerns: ["dry_lengths"],
      requestedGoal: null,
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.equal(result.products.length, 0)
})

test("projectSelectedProducts treats explicit compare-or-decide weak-lever shampoo as caveated recommendation", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "compare_or_decide",
      message: "welches shampoo ist besser gegen frizz",
      concerns: ["frizz"],
      requestedGoal: null,
    },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "recommend_with_caveat")
  assert.equal(result.products.length, 1)
})

test("projectSelectedProducts treats explicit weak-lever shampoo asks as caveated even without userJob", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum normalen Kopfhaut-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: null,
      message: "kannst du ein shampoo gegen frizz empfehlen",
      concerns: ["frizz"],
      requestedGoal: null,
    },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "recommend_with_caveat")
  assert.equal(result.products.length, 1)
})

test("projectSelectedProducts keeps itchy dandruff cautious but offers a useful next step", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum Schuppen-Fokus"])],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: "dandruff" } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        targetProfile: {
          scalpRoute: "dandruff",
          shampooBucket: "schuppen",
          secondaryBucket: "normal",
          cleansingIntensity: "regular",
        },
      }),
    ),
    {
      userJob: "product_pick",
      concerns: ["dandruff_or_flakes", "irritation"],
      activeProfileSignals: [
        {
          field: "scalp_condition",
          value: "dandruff",
          source: "message",
          selection_effect: "caution",
          evidence: "Schuppen",
        },
        {
          field: "scalp_condition",
          value: "irritated",
          source: "message",
          selection_effect: "caution",
          evidence: "juckende Kopfhaut",
        },
      ],
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "caution_without_products")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Anti-Schuppen|Schuppen/i)
  assert.match(result.category_guidance, /empfindliche|gereizte|juck/i)
  assert.match(result.category_guidance, /Optionen|auswählen|einordnen/i)
  assert.match(result.category_guidance, /anhält|stark|professionell|dermatologisch/i)
  assert.doesNotMatch(result.category_guidance, /Behandlung|behand|Bekaempf/i)
})

test("projectSelectedProducts acknowledges oily-root shampoo troubleshooting", () => {
  const result = projectSelectedProducts(
    [createShampooMatchedProduct("p-1", 0.94, ["Passt zum fettigen Ansatz"])],
    {
      thickness: "fine",
      scalp_type: "balanced",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "troubleshoot",
      concerns: ["oily_roots"],
    },
  )

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "explain_then_recommend")
  assert.match(result.category_guidance, /fettender Ansatz/)
  assert.equal(
    result.products[0].fit_reason,
    "Idealer Treffer für feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensität: normal.",
  )
})

test("projectSelectedProducts sanitizes weaker shampoo caveats and maps stale generic mismatch caveats", () => {
  const result = projectSelectedProducts(
    [
      createShampooMatchedProduct(
        "p-1",
        0.94,
        ["Fallback-Treffer"],
        [
          "Fallback: Dieser Treffer passt nicht exakt zum abgeleiteten Shampoo-Fokus und erscheint nur, weil der Katalog nicht genug sichere Treffer geliefert hat.",
        ],
      ),
      createShampooMatchedProduct(
        "p-2",
        0.86,
        ["Alter Mismatch-Treffer"],
        ["Weicht vom aktuellen Kopfhaut-Fokus ab."],
      ),
    ],
    { thickness: "normal", scalp_type: "balanced", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    { userJob: "product_pick", concerns: [] },
  )

  assert.match(result.products[0]?.caveat ?? "", /Nachgeordnet|nicht ganz so passend/i)
  assert.equal(
    result.products[1]?.caveat,
    "Passt nicht exakt zum abgeleiteten Shampoo-Fokus. Nur nachgeordnet zeigen, wenn keine ausreichend passenden Treffer verfügbar sind.",
  )
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts exposes structured shampoo comparison facts", () => {
  const result = projectSelectedProducts(
    [
      createShampooMatchedProduct("p-1", 0.94, ["Passt zum fettigen Ansatz"], [], {
        fit_status: "ideal",
        matched_scalp_route: "oily",
        cleansing_intensity: "regular",
      }),
      createShampooMatchedProduct(
        "p-2",
        0.86,
        ["Fallback-Treffer"],
        [
          "Fallback: Dieser Treffer passt nicht exakt zum abgeleiteten Shampoo-Fokus und erscheint nur, weil der Katalog nicht genug sichere Treffer geliefert hat.",
        ],
        {
          fit_status: "mismatch",
          matched_bucket: "normal",
          matched_concern_code: "normal",
          matched_scalp_route: "balanced",
          cleansing_intensity: "gentle",
        },
      ),
    ],
    { thickness: "normal", scalp_type: "oily", scalp_condition: null } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    { userJob: "compare_or_decide", concerns: ["oily_roots"] },
  )

  assert.deepEqual(result.comparison_facts, {
    "p-1": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensität: normal",
      "Fit: idealer Treffer",
    ],
    "p-2": [
      "Kopfhaut-Fokus: Normal",
      "Kopfhaut-Route: ausgeglichen",
      "Reinigungsintensität: sanft",
      "Fit: weicht ab",
    ],
  })
  assertProjectionDoesNotExposeFallback(result)
})

test("projectSelectedProducts exposes per-product shampoo claims from structured data only", () => {
  const result = projectSelectedProducts(
    [
      createMatchedProduct("p-color", 0.94, {
        name: "Color Protect Sensitive Shampoo",
        recommendation_meta: {
          category: "shampoo",
          score: 0.94,
          top_reasons: ["Passt zum normalen Kopfhaut-Fokus"],
          tradeoffs: [],
          usage_hint: "",
          matched_profile: {
            thickness: "normal",
            scalp_type: "balanced",
            scalp_condition: null,
          },
          matched_bucket: "normal",
          matched_concern_code: "normal",
          fit_status: "ideal",
          matched_scalp_route: "balanced",
          cleansing_intensity: "regular",
        },
      }),
    ],
    {
      thickness: "normal",
      scalp_type: "balanced",
      scalp_condition: null,
      chemical_treatment: ["colored"],
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(
      createRelevantShampooDecision({
        targetProfile: {
          scalpRoute: "balanced",
          shampooBucket: "normal",
          secondaryBucket: null,
          cleansingIntensity: "regular",
        },
      }),
    ),
    {
      userJob: "product_pick",
      concerns: [],
      activeProfileSignals: [
        {
          field: "chemical_treatment",
          value: "colored",
          source: "message",
          selection_effect: "qualifier",
          evidence: "coloriertes Haar",
        },
        {
          field: "scalp_condition",
          value: "irritated",
          source: "message",
          selection_effect: "qualifier",
          evidence: "empfindliche Kopfhaut",
        },
      ],
    },
  )

  const product = result.products[0]
  assert.equal(product.name, "Color Protect Sensitive Shampoo")
  assert.deepEqual(
    product.supported_claims.map((claim) => [claim.field, claim.value, claim.evidence]),
    [
      ["thickness", "normal", "product_spec"],
      ["scalp_route", "balanced", "product_spec"],
      ["shampoo_bucket", "normal", "product_spec"],
      ["cleansing_intensity", "regular", "product_spec"],
      ["fit_status", "ideal", "category_decision"],
    ],
  )
  assert.deepEqual(
    product.unsupported_requested_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.reason,
    ]),
    [
      ["chemical_treatment", "colored", "no_structured_product_data"],
      ["scalp_condition", "irritated", "no_structured_product_data"],
    ],
  )
  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [
      signal.field,
      signal.value,
      signal.user_message,
    ]),
    [
      [
        "chemical_treatment",
        "colored",
        "Zum Farbschutz habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den sicheren Produktangaben.",
      ],
      [
        "scalp_condition",
        "irritated",
        "Zur empfindlichen Kopfhaut habe ich bei diesen Produkten keine sichere Spezialangabe. Ich bewerte sie deshalb vor allem nach Kopfhaut-Fokus, Haardicke und Reinigungsintensität.",
      ],
    ],
  )
  assert.equal(
    product.supported_claims.some(
      (claim) => claim.field === "chemical_treatment" || claim.field === "scalp_condition",
    ),
    false,
  )
})

test("projectSelectedProducts writes shampoo fit reasons from structured claims, not product names", () => {
  const result = projectSelectedProducts(
    [
      createMatchedProduct("p-volume", 0.94, {
        name: "Guhl Kraft & Fuelle",
        recommendation_meta: {
          category: "shampoo",
          score: 0.94,
          top_reasons: ["Kräftigt sichtbar und gibt mehr Fülle"],
          tradeoffs: [],
          usage_hint: "",
          matched_profile: {
            thickness: "fine",
            scalp_type: "oily",
            scalp_condition: null,
          },
          matched_bucket: "dehydriert-fettig",
          matched_concern_code: "dehydriert-fettig",
          matched_scalp_route: "oily",
          cleansing_intensity: "regular",
          fit_status: "ideal",
        },
      }),
    ],
    {
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
  )

  assert.equal(
    result.products[0].fit_reason,
    "Idealer Treffer für feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensität: normal.",
  )
  assert.doesNotMatch(result.products[0].fit_reason, /kraeft|fuelle|volume/i)
})

test("projectSelectedProducts uses leave-in-specific missing-info when leave_in returns no products", () => {
  const result = projectSelectedProducts([], null, "leave_in", createRuntimeStub())

  assert.deepEqual(result.missing_info, [
    {
      key: "hair_texture",
      label: "Haarmuster",
      blocking: true,
      detail: "Es fehlt noch dein Haarmuster für die Leave-in-Auswahl.",
    },
    {
      key: "thickness",
      label: "Haardicke",
      blocking: true,
      detail: "Es fehlt noch deine Haardicke für die Leave-in-Auswahl.",
    },
    {
      key: "density",
      label: "Haardichte",
      blocking: true,
      detail: "Es fehlt noch deine Haardichte für die Leave-in-Auswahl.",
    },
  ])
})

test("projectSelectedProducts blocks leave-in products when texture or density is missing", () => {
  const result = projectSelectedProducts(
    [createLeaveInMatchedProduct("p-leave-in", 0.94)],
    {
      ...LOW_DAMAGE_PROFILE,
      hair_texture: null,
      density: null,
      thickness: "fine",
    } as HairProfile,
    "leave_in",
    createRuntimeStub(),
  )

  assert.equal(result.decision, "needs_more_info")
  assert.deepEqual(result.products, [])
  assert.deepEqual(
    result.missing_info.map((item) => [item.key, item.blocking]),
    [
      ["hair_texture", true],
      ["density", true],
    ],
  )
})

test("projectSelectedProducts uses oil-specific missing-info when oil returns no products", () => {
  const result = projectSelectedProducts([], null, "oil", createRuntimeStub())

  assert.deepEqual(result.missing_info, [
    {
      key: "thickness",
      label: "Haardicke",
      blocking: true,
      detail: "Es fehlt noch deine Haardicke für die Öl-Auswahl.",
    },
    {
      key: "oil_purpose",
      label: "Öl-Zweck",
      blocking: true,
      detail: "Es fehlt noch dein Öl-Zweck für die Öl-Auswahl.",
    },
  ])
})

test("selectProducts asks for oil purpose when a product pick lacks inferred purpose", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "oil")
      assert.equal(runtime.categories.oil.clarificationNeeded, true)
      return []
    },
  })

  const result = await tool({
    category: "oil",
    message: "Welches Haaröl passt zu mir?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.equal(result.decision, "needs_more_info")
  assert.deepEqual(result.missing_info, [
    {
      key: "oil_purpose",
      label: "Öl-Zweck",
      blocking: true,
      detail: "Es fehlt noch dein Öl-Zweck für die Öl-Auswahl.",
    },
  ])
})

test("projectSelectedProducts exposes oil claims, caveats, and lean comparison facts", () => {
  const result = projectSelectedProducts(
    [
      createOilMatchedProduct("dry-oil", 0.94),
      createOilMatchedProduct("styling-oil", 0.82, {
        matched_subtype: "styling-oel",
        use_mode: "styling_finish",
        purpose_fit: "bridge",
        tradeoffs: ["Passt nur über die angrenzende Finish-Rolle, nicht exakt."],
      }),
    ],
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
      density: "low",
    } as HairProfile,
    "oil",
    createRuntimeStub({
      requestContext: {
        ...createRuntimeStub().requestContext,
        requestedCategory: "oil",
        oilPurpose: "light_finish",
      },
    }),
    {
      requestedIngredientSignals: [{ value: "silikonfrei", evidence: "silikonfrei" }],
    },
  )

  assert.equal(result.decision, "recommended")
  assert.deepEqual(
    result.products[0].supported_claims.map((claim) => claim.field),
    ["oil_purpose", "oil_subtype", "fit_status"],
  )
  assert.match(result.products[0].fit_reason, /Leichtes Finish/)
  assert.deepEqual(result.comparison_facts, {
    "dry-oil": ["Öl-Zweck: Leichtes Finish", "Subtyp: Trocken-Öl"],
    "styling-oil": ["Öl-Zweck: Styling-Finish", "Subtyp: Styling-Öl"],
  })
  assert.equal(
    result.unsupported_requested_signals[0]?.user_message,
    "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Öl-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Öl-Zweck, Haardicke, Anwendung und Fit.",
  )
})

test("projectSelectedProducts does not compare oil subtype against missing metadata", () => {
  const result = projectSelectedProducts(
    [
      createOilMatchedProduct("dry-oil", 0.94),
      createOilMatchedProduct("generic-finish", 0.82, {
        matched_subtype: undefined,
        use_mode: "styling_finish",
      }),
    ],
    LOW_DAMAGE_PROFILE,
    "oil",
    createRuntimeStub({
      requestContext: {
        ...createRuntimeStub().requestContext,
        requestedCategory: "oil",
        oilPurpose: "light_finish",
      },
    }),
  )

  assert.deepEqual(result.comparison_facts?.["dry-oil"], ["Öl-Zweck: Leichtes Finish"])
  assert.deepEqual(result.comparison_facts?.["generic-finish"], ["Öl-Zweck: Styling-Finish"])
})

test("selectProducts carries unsupported ingredient caveats for live oil requests", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category }) => {
      assert.equal(category, "oil")
      return [createOilMatchedProduct("dry-oil", 0.94)]
    },
  })

  const result = await tool({
    category: "oil",
    message: "Ich suche ein silikonfreies Oel als Finish gegen Frizz.",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
      density: "low",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.equal(
    result.unsupported_requested_signals[0]?.user_message,
    "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Öl-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Öl-Zweck, Haardicke, Anwendung und Fit.",
  )
})

test("selectProducts still returns explicit oil products while exposing CareBalance decrease-frequency framing", async () => {
  const observed: { runtime?: RecommendationEngineRuntime } = {}
  const tool = createSelectProductsTool({
    onResult: ({ runtime }) => {
      observed.runtime = runtime
    },
    runCategoryEngine: async ({ category }) => {
      assert.equal(category, "oil")
      return [createOilMatchedProduct("light-oil", 0.94)]
    },
  })

  const result = await tool({
    category: "oil",
    message: "Ich will trotz Build-up und plattem Ansatz ein leichtes Oel als Finish.",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
      density: "low",
      scalp_type: "oily",
      goals: ["volume"],
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [
      {
        category: "oil",
        product_name: "Daily Oil",
        frequency_range: "daily_1x",
      },
    ],
    userJob: "product_pick",
  })

  assert.equal(
    observed.runtime?.careBalance.rows.find((row) => row.category === "oil")?.recommendation,
    "decrease_frequency",
  )
  assert.equal(result.decision, "recommended")
  assert.equal(result.products.length, 1)
  assert.match(
    JSON.stringify((result as unknown as { care_balance_context?: unknown }).care_balance_context),
    /decrease_frequency/,
  )
  assert.match(JSON.stringify(result), /daily_oil_use|buildup_or_flatness_pressure/)
})

test("selectProducts preserves supplied effective care context in runtime and care balance output", async () => {
  const baseProfile = {
    ...LOW_DAMAGE_PROFILE,
    thickness: "coarse",
    density: "low",
    scalp_type: "oily",
    goals: ["volume"],
  } as HairProfile
  const routineItems = [
    {
      category: "oil",
      product_name: "Daily Oil",
      frequency_range: "daily_1x",
    },
  ] as const
  const adapted = adaptRecommendationInputFromPersistence(baseProfile, [...routineItems])
  const effectiveCareContext = buildEffectiveCareContext(adapted.input, [
    {
      kind: "profile_override",
      field: "thickness",
      value: "fine",
      evidenceQuote: "Actually my hair is fine",
      source: "current_turn",
    },
    {
      kind: "routine_frequency",
      category: "oil",
      frequencyBand: "daily_1x",
      evidenceQuote: "I use oil daily",
      source: "current_turn",
    },
  ])
  const observed: { runtime?: RecommendationEngineRuntime } = {}
  const tool = createSelectProductsTool({
    onResult: ({ runtime }) => {
      observed.runtime = runtime
    },
    runCategoryEngine: async () => [createOilMatchedProduct("light-oil", 0.94)],
  })

  const result = await tool({
    category: "oil",
    message: "Actually my hair is fine and I use oil daily.",
    hairProfile: baseProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [...routineItems],
    userJob: "product_pick",
    effectiveCareContext,
  } as Parameters<typeof tool>[0] & { effectiveCareContext: typeof effectiveCareContext })

  assert.equal(observed.runtime?.effectiveContext, effectiveCareContext)
  assert.equal(observed.runtime?.effectiveContext.currentTurnFacts.length, 2)
  assert.ok(
    observed.runtime?.effectiveContext.conflicts.some(
      (conflict) =>
        conflict.fieldPath === "profile.thickness" &&
        conflict.savedValue === "coarse" &&
        conflict.currentTurnValue === "fine",
    ),
  )
  assert.match(JSON.stringify(result.care_balance_context), /current_turn_facts/)
  assert.match(JSON.stringify(result.care_balance_context), /Actually my hair is fine/)
})

test("projectSelectedProducts does not turn therapy oil redirects into product recommendations", () => {
  const routeContext = {
    message: "Welches Rosmarinoel hilft gegen Haarwachstum?",
    userJob: "product_pick",
  } satisfies NonNullable<Parameters<typeof projectSelectedProducts>[4]>
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
    },
    [],
    buildRecommendationRequestContext({
      requestedCategory: "oil",
      message: routeContext.message,
    }),
  )

  const projection = projectSelectedProducts(
    [createOilMatchedProduct("therapy-oil", 0.94)],
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
    } as HairProfile,
    "oil",
    runtime,
    routeContext,
  )

  assert.equal(runtime.categories.oil.noRecommendationReason, "therapy_oil_missing")
  assert.equal(projection.decision, "not_recommended")
  assert.equal(projection.products.length, 0)
  assert.equal(projection.product_response_policy, "redirect_to_better_lever")
})

test("selectProducts applies oil thickness overrides to hard-gated oil selection", async () => {
  const observed: { thickness?: HairProfile["thickness"] } = {}
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, hairProfile, runtime }) => {
      assert.equal(category, "oil")
      observed.thickness = hairProfile?.thickness ?? null
      assert.equal(runtime.categories.oil.targetProfile?.densityWeightCaution, true)
      return [
        createOilMatchedProduct("fine-oil", 0.94, {
          matched_profile: { thickness: "fine" },
        }),
      ]
    },
  })

  const result = await tool({
    category: "oil",
    message: "Mein feines Haar braucht ein leichtes Trocken-Oel, das nicht fettig wirkt.",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    activeProfileSignals: [
      {
        field: "thickness",
        value: "fine",
        source: "message",
        selection_effect: "override",
        evidence: "feines Haar",
      },
    ],
  })

  assert.equal(observed.thickness, "fine")
  assert.equal(
    result.products[0]?.supported_claims.some((claim) => claim.field === "thickness"),
    false,
  )
})

test("selectProducts applies oil density overrides to density-weight caution", async () => {
  const observed: { density?: HairProfile["density"] } = {}
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, hairProfile, runtime }) => {
      assert.equal(category, "oil")
      observed.density = hairProfile?.density ?? null
      assert.equal(runtime.categories.oil.targetProfile?.densityWeightCaution, true)
      return [createOilMatchedProduct("low-density-oil", 0.94)]
    },
  })

  const result = await tool({
    category: "oil",
    message: "Meine Haare sind gerade wenig dicht. Welches Haaröl passt als leichtes Finish?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    activeProfileSignals: [
      {
        field: "density",
        value: "low",
        source: "message",
        selection_effect: "override",
        evidence: "wenig dicht",
      },
    ],
  })

  assert.equal(observed.density, "low")
  assert.ok(
    result.profile_basis.includes(
      "Profil-Hinweis: aktuelle Angabe Haardichte Wenig Haare statt gespeichert Mittlere Dichte",
    ),
  )
  assert.ok(result.profile_basis.includes("Haardichte: Wenig Haare"))
  assert.ok(result.profile_basis.includes("Gewichts-Caveat: sehr sparsam dosieren."))
})

test("selectProducts treats non-greasy fine-hair oil wording as a light finish target", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "oil")
      assert.equal(runtime.categories.oil.targetProfile?.purpose, "light_finish")
      assert.equal(runtime.categories.oil.targetProfile?.matcherSubtype, "trocken-oel")
      return [
        createOilMatchedProduct("fine-light-oil", 0.94, {
          matched_profile: { thickness: "fine" },
          use_mode: "light_finish",
          matched_subtype: "trocken-oel",
        }),
      ]
    },
  })

  const result = await tool({
    category: "oil",
    message: "Welches Haaröl passt zu meinem feinen Haar, ohne fettig auszusehen?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    activeProfileSignals: [
      {
        field: "thickness",
        value: "fine",
        source: "message",
        selection_effect: "override",
        evidence: "feines Haar",
      },
    ],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(result.products[0]?.supported_claims[0]?.label, "Öl-Zweck: Leichtes Finish")
})

test("oil purpose inference keeps negated scalp finish requests out of pre-wash", () => {
  assert.equal(
    inferOilPurposeFromMessage("ich will oel vor dem waschen einwirken lassen"),
    "pre_wash_oiling",
  )
  assert.equal(
    inferOilPurposeFromMessage("ich moechte die kopfhaut mit oel massieren"),
    "pre_wash_oiling",
  )
  assert.equal(
    inferOilPurposeFromMessage("trockenes oel fuer die spitzen, nicht auf die kopfhaut"),
    "light_finish",
  )
  assert.equal(
    inferOilPurposeFromMessage("eher als finish, nicht auf die kopfhaut"),
    "styling_finish",
  )
})

test("projectSelectedProducts uses mask-specific missing-info for explicit mask requests", () => {
  const result = projectSelectedProducts([], { thickness: "normal" } as HairProfile, "mask")

  assert.deepEqual(result.missing_info, [
    {
      key: "protein_moisture_balance",
      label: "Protein-/Feuchtigkeitsbalance",
      blocking: true,
      detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance für die Masken-Auswahl.",
    },
  ])
})

test("projectSelectedProducts redirects deep-cleansing scalp treatment requests without products", () => {
  const result = projectSelectedProducts(
    [createMatchedProduct("reset", 0.9)],
    LOW_DAMAGE_PROFILE,
    "deep_cleansing_shampoo",
    createDeepCleansingScalpTreatmentRuntimeStub(),
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "caution_without_products")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Keine Produktkarten/)
})

test("projectSelectedProducts keeps dry-shampoo scalp symptoms guidance-only", () => {
  const result = projectSelectedProducts(
    [],
    LOW_DAMAGE_PROFILE,
    "dry_shampoo",
    createDryShampooRuntimeStub(
      createDryShampooDecision({
        relevant: false,
        action: null,
        targetProfile: null,
        notes: ["dry_shampoo_scalp_issue_hard_no"],
      }),
    ),
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "caution_without_products")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Trockenshampoo nicht als Produkt empfehlen/)
  assert.match(result.category_guidance, /reinigt die Kopfhaut nicht/)
})

test("projectSelectedProducts redirects frequent dry-shampoo use to reset logic", () => {
  const result = projectSelectedProducts(
    [],
    LOW_DAMAGE_PROFILE,
    "dry_shampoo",
    createDryShampooRuntimeStub(
      createDryShampooDecision({
        relevant: false,
        action: null,
        targetProfile: null,
        notes: ["dry_shampoo_frequent_use_reset_needed"],
      }),
    ),
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Kein weiteres Trockenshampoo/)
  assert.match(result.category_guidance, /Reset/)
})

test("projectSelectedProducts preserves no_catalog_match for relevant dry-shampoo requests", () => {
  const result = projectSelectedProducts(
    [],
    LOW_DAMAGE_PROFILE,
    "dry_shampoo",
    createDryShampooRuntimeStub(createDryShampooDecision()),
  )

  assert.equal(result.decision, "no_catalog_match")
  assert.equal(result.product_response_policy, "no_catalog_match")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Katalog/)
  assert.match(result.category_guidance, /später ausgewaschen/)
})

test("selectProducts passes explicit dry-shampoo bridge context into category engine", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "dry_shampoo")
      assert.equal(runtime.categories.dryShampoo.relevant, true)
      assert.ok(
        runtime.categories.dryShampoo.targetProfile?.bridgeNeedReasonCodes.includes(
          "dry_shampoo_emergency_refresh",
        ),
      )

      return [
        createMatchedProduct("dry-bridge", 0.91, {
          category: "Trockenshampoo",
          recommendation_meta: {
            category: "dry_shampoo",
            score: 91,
            top_reasons: ["Passt als kurze Notfall-/Between-Wash-Brücke."],
            tradeoffs: [],
            usage_hint:
              "Nur als kurze Between-Wash-Brücke am Ansatz verwenden, später auswaschen und nicht als Ersatz für Shampoo/Wasser nutzen.",
            primary_effect: "classic_refresh",
            hair_color_fit: "universal",
            scalp_sensitivity_fit: "normal_only",
            format: "aerosol_spray",
            fit_status: "ideal",
          },
        }),
      ]
    },
  })

  const result = await tool({
    category: "dry_shampoo",
    message: "Ich kann heute nicht waschen, mein Ansatz ist fettig. Welches Trockenshampoo?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      concerns: ["oily_scalp"],
      shampoo_frequency: "weekly_3_4x",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(
    result.products[0]?.supported_claims.some((claim) => claim.field === "usage_hint"),
    false,
  )
  assert.match(result.category_guidance, /reinigt die Kopfhaut nicht/)
  assert.match(result.category_guidance, /später ausgewaschen/)
})

test("selectProducts redirects message-stated frequent dry-shampoo use instead of recommending more", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "dry_shampoo")
      assert.equal(runtime.categories.dryShampoo.relevant, false)
      assert.ok(
        runtime.categories.dryShampoo.notes.includes("dry_shampoo_frequent_use_reset_needed"),
      )

      return [
        createMatchedProduct("dry-frequent", 0.91, {
          category: "Trockenshampoo",
          recommendation_meta: {
            category: "dry_shampoo",
            score: 91,
            top_reasons: ["Passt als kurze Notfall-/Between-Wash-Brücke."],
            tradeoffs: [],
            usage_hint:
              "Nur als kurze Between-Wash-Brücke am Ansatz verwenden, später auswaschen und nicht als Ersatz für Shampoo/Wasser nutzen.",
            primary_effect: "classic_refresh",
            hair_color_fit: "universal",
            scalp_sensitivity_fit: "normal_only",
            format: "aerosol_spray",
            fit_status: "ideal",
          },
        }),
      ]
    },
  })

  const result = await tool({
    category: "dry_shampoo",
    message: "Ich nutze Trockenshampoo 3-4x pro Woche, welches passt?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      shampoo_frequency: "weekly_3_4x",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
  })

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
})

test("selectProducts treats dry-shampoo routine need questions as guidance-only, not dry-hair hard-nos", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "dry_shampoo")
      assert.equal(runtime.categories.dryShampoo.relevant, false)
      assert.ok(!runtime.categories.dryShampoo.notes.includes("dry_shampoo_dry_breakage_hard_no"))

      return [
        createMatchedProduct("dry-routine", 0.91, {
          category: "Trockenshampoo",
          recommendation_meta: {
            category: "dry_shampoo",
            score: 91,
            top_reasons: ["Passt als kurze Notfall-/Between-Wash-Brücke."],
            tradeoffs: [],
            usage_hint:
              "Nur als kurze Between-Wash-Brücke am Ansatz verwenden, später auswaschen und nicht als Ersatz für Shampoo/Wasser nutzen.",
            primary_effect: "classic_refresh",
            hair_color_fit: "universal",
            scalp_sensitivity_fit: "normal_only",
            format: "aerosol_spray",
            fit_status: "ideal",
          },
        }),
      ]
    },
  })

  const result = await tool({
    category: "dry_shampoo",
    message: "Sollte ich Trocken-Shampoo in meiner Routine aufnehmen?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "balanced",
      scalp_condition: null,
      shampoo_frequency: "daily_1x",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    userJob: "compare_or_decide",
    concerns: [],
  })

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
  assert.match(result.category_guidance, /Routinebaustein/)
})

test("selectProducts does not treat oily-root product wording as a dry-shampoo bridge", async () => {
  const tool = createSelectProductsTool({
    runCategoryEngine: async ({ category, runtime }) => {
      assert.equal(category, "dry_shampoo")
      assert.equal(runtime.categories.dryShampoo.relevant, false)
      assert.ok(
        runtime.categories.dryShampoo.notes.includes("dry_shampoo_oily_scalp_alone_not_enough"),
      )

      return [
        createMatchedProduct("dry-oily-root", 0.91, {
          category: "Trockenshampoo",
          recommendation_meta: {
            category: "dry_shampoo",
            score: 91,
            top_reasons: ["Passt als kurze Notfall-/Between-Wash-Brücke."],
            tradeoffs: [],
            usage_hint:
              "Nur als kurze Between-Wash-Brücke am Ansatz verwenden, später auswaschen und nicht als Ersatz für Shampoo/Wasser nutzen.",
            primary_effect: "classic_refresh",
            hair_color_fit: "universal",
            scalp_sensitivity_fit: "normal_only",
            format: "aerosol_spray",
            fit_status: "ideal",
          },
        }),
      ]
    },
  })

  const result = await tool({
    category: "dry_shampoo",
    message: "Mein Ansatz ist schnell fettig, welches Produkt passt?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      concerns: ["oily_scalp"],
      shampoo_frequency: "weekly_3_4x",
    } as HairProfile,
    memoryContext: {
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    },
    routineItems: [],
    userJob: "product_pick",
    concerns: ["oily_roots"],
  })

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.deepEqual(result.products, [])
})

test("selectProducts tool only accepts engine-backed categories", () => {
  type ToolParams = Parameters<ReturnType<typeof createSelectProductsTool>>[0]

  const selectableCategories: SelectableProductCategory[] = [
    "shampoo",
    "conditioner",
    "mask",
    "oil",
    "leave_in",
    "bondbuilder",
    "deep_cleansing_shampoo",
    "dry_shampoo",
    "peeling",
  ]

  assert.equal(selectableCategories.length, 9)

  const acceptedCategory: ToolParams["category"] = "shampoo"
  assert.equal(acceptedCategory, "shampoo")

  // @ts-expect-error routine is not an engine-backed category for this tool
  const rejectedRoutineCategory: ToolParams["category"] = "routine"
  void rejectedRoutineCategory

  // @ts-expect-error null is not an engine-backed category for this tool
  const rejectedNullCategory: ToolParams["category"] = null
  void rejectedNullCategory
})
