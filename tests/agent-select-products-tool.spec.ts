import assert from "node:assert/strict"
import test from "node:test"

import {
  createSelectProductsTool,
  projectSelectedProducts,
} from "../src/lib/agent/tools/select-products"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import type { SelectableProductCategory } from "../src/lib/agent/tools/select-products"
import type { RecommendationEngineRuntime } from "../src/lib/recommendation-engine/runtime"
import type { ShampooCategoryDecision } from "../src/lib/recommendation-engine/types"
import type { HairProfile } from "../src/lib/types"
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
      usage_hint: "Sparsam in die Laengen geben.",
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
        "Nach dem Shampoo in die Laengen und Spitzen geben, gruendlich ausspuelen und danach Conditioner verwenden.",
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

function createRuntimeStub(
  overrides: Partial<RecommendationEngineRuntime> = {},
): RecommendationEngineRuntime {
  return {
    rawInput: {} as RecommendationEngineRuntime["rawInput"],
    requestContext: {
      requestedCategory: null,
      maskIntensityRequest: null,
      oilPurpose: null,
      oilNoRecommendationReason: null,
    } as RecommendationEngineRuntime["requestContext"],
    normalized: {} as RecommendationEngineRuntime["normalized"],
    damage: {} as RecommendationEngineRuntime["damage"],
    careNeeds: {} as RecommendationEngineRuntime["careNeeds"],
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

test("projectSelectedProducts returns authoritative shampoo recommendation payload", () => {
  const result = projectSelectedProducts(
    [
      createShampooMatchedProduct("p-1", 0.94, [
        "Passt zum fettigen Ansatz",
        "Leicht genug fuer feines Haar",
      ]),
      createShampooMatchedProduct(
        "p-2",
        0.86,
        ["Staerkerer Kopfhaut-Fokus"],
        ["Kann bei trockenen Laengen etwas aktiver wirken"],
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
          "Idealer Treffer fuer feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensitaet: normal.",
        caveat: null,
        hasUsageHint: false,
      },
      {
        rank: 2,
        product_id: "p-2",
        fit_reason:
          "Idealer Treffer fuer feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensitaet: normal.",
        caveat: "Kann bei trockenen Laengen etwas aktiver wirken",
        hasUsageHint: false,
      },
      {
        rank: 3,
        product_id: "p-3",
        fit_reason:
          "Idealer Treffer fuer feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensitaet: normal.",
        caveat: null,
        hasUsageHint: false,
      },
    ],
  )
  assert.deepEqual(result.comparison_facts, {
    "p-1": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensitaet: normal",
      "Fit: idealer Treffer",
      "Fallback: nein",
    ],
    "p-2": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensitaet: normal",
      "Fit: idealer Treffer",
      "Fallback: nein",
    ],
    "p-3": [
      "Kopfhaut-Fokus: Dehydriert / Fettig",
      "Kopfhaut-Route: fettig/dehydriert",
      "Reinigungsintensitaet: normal",
      "Fit: idealer Treffer",
      "Fallback: nein",
    ],
  })
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
    { thickness: "normal" } as HairProfile,
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
          usage_hint: "In die Laengen geben.",
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
          usage_hint: "In die Laengen geben.",
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
    ["thickness", "weight", "balance_direction", "repair_level", "fit_status"],
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
      "Wuensche wie silikonfrei, kokosfrei oder proteinfrei sind in dieser Conditioner-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Pflegeintensitaet und Fit.",
  })
  assert.deepEqual(result.comparison_facts, {
    "p-conditioner": ["Balance: Feuchtigkeit", "Pflegeintensitaet: Intensiv"],
    "p-balanced": ["Balance: ausgewogene Pflege", "Pflegeintensitaet: Mittel"],
  })
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
          usage_hint: "In die Laengen geben.",
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

test("projectSelectedProducts uses price only as conditioner comparison fallback", () => {
  const result = projectSelectedProducts(
    [
      createMatchedProduct("p-1", 0.94, {
        price_eur: 12.99,
        recommendation_meta: {
          category: "conditioner",
          score: 94,
          top_reasons: ["Passt zum Zielprofil"],
          tradeoffs: [],
          usage_hint: "In die Laengen geben.",
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
          usage_hint: "In die Laengen geben.",
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
    "p-1": ["Preis: 12.99 EUR"],
    "p-2": ["Preis: 6.99 EUR"],
  })
})

test("projectSelectedProducts exposes leave-in claims and unsupported ingredient caveats", () => {
  const result = projectSelectedProducts(
    [
      createLeaveInMatchedProduct("p-leave-in", 0.94),
      createLeaveInMatchedProduct("p-balanced", 0.88, {
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
      "thickness",
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
      "Wuensche wie silikonfrei, kokosfrei, proteinfrei oder oelfrei sind in dieser Leave-in-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Rolle, Hitzeschutz, Pflegefokus und Fit.",
  })
  assert.deepEqual(result.comparison_facts, {
    "p-leave-in": ["Gewicht: Mittel", "Balance: Feuchtigkeit"],
    "p-balanced": ["Gewicht: Leicht", "Balance: ausgewogene Pflege"],
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
            usage_hint: "In die Laengen geben.",
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
        frequency_range: "3_4x",
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
          usage_hint: "In die Laengen geben.",
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
        frequency_range: "3_4x",
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
      "Wuensche wie silikonfrei, kokosfrei, proteinfrei oder oelfrei sind in dieser Leave-in-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Rolle, Hitzeschutz, Pflegefokus und Fit.",
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
        tradeoffs: ["Wenn du sie testest, dann eher sparsam und nicht bei jeder Waesche."],
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
      "Wuensche wie silikonfrei, kokosfrei, proteinfrei oder oelfrei sind in dieser Masken-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Intensitaet und Fit.",
  })
  assert.deepEqual(result.comparison_facts, {
    "p-mask-1": ["Balance: Protein", "Intensitaet: Mittel"],
    "p-mask-2": ["Balance: Ausgewogen", "Intensitaet: Hoch"],
  })
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
    [createShampooMatchedProduct("p-1", 0.94, ["Waere ein guter Shampoo-Treffer"])],
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
    [createShampooMatchedProduct("p-1", 0.94, ["Waere ein guter Shampoo-Treffer"])],
    {
      thickness: "normal",
      scalp_type: "balanced",
      scalp_condition: null,
    } as HairProfile,
    "shampoo",
    createShampooRuntimeStub(createRelevantShampooDecision()),
    {
      userJob: "compare_or_decide",
      concerns: ["dry_lengths"],
    },
  )

  assert.equal(result.decision, "not_recommended")
  assert.equal(result.product_response_policy, "redirect_to_better_lever")
  assert.match(result.category_guidance, /Trockene Laengen/)
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
    expectedPolicy: "redirect_to_better_lever",
  },
  {
    label: "shine",
    concerns: [],
    requestedGoal: "shine",
    expectedPolicy: "redirect_to_better_lever",
  },
  {
    label: "frizz",
    concerns: ["frizz"],
    requestedGoal: null,
    expectedPolicy: "redirect_to_better_lever",
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
        userJob: "compare_or_decide",
        concerns: [...entry.concerns],
        requestedGoal: entry.requestedGoal,
      },
    )

    assert.equal(result.decision, "not_recommended")
    assert.equal(result.product_response_policy, entry.expectedPolicy)
    assert.equal(result.products.length, 0)
  })
}

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
  assert.match(result.category_guidance, /Optionen|auswaehlen|einordnen/i)
  assert.match(result.category_guidance, /anhaelt|stark|professionell|dermatologisch/i)
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
    "Idealer Treffer fuer feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensitaet: normal.",
  )
})

test("projectSelectedProducts preserves explicit fallback caveats and maps stale generic mismatch caveats", () => {
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

  assert.match(result.products[0]?.caveat ?? "", /Fallback|nicht genug sichere Treffer/i)
  assert.equal(
    result.products[1]?.caveat,
    "Passt nicht exakt zum abgeleiteten Shampoo-Fokus. Nur als Fallback zeigen, wenn keine ausreichenden sicheren Treffer verfuegbar sind.",
  )
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
      "Reinigungsintensitaet: normal",
      "Fit: idealer Treffer",
      "Fallback: nein",
    ],
    "p-2": [
      "Kopfhaut-Fokus: Normal",
      "Kopfhaut-Route: ausgeglichen",
      "Reinigungsintensitaet: sanft",
      "Fit: weicht ab",
      "Fallback: ja",
    ],
  })
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
        "Zum Farbschutz habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den belegten Fit-Daten.",
      ],
      [
        "scalp_condition",
        "irritated",
        "Zur empfindlichen Kopfhaut habe ich bei diesen Produkten keine sichere Spezialangabe. Ich bewerte sie deshalb vor allem nach Kopfhaut-Fokus, Haardicke und Reinigungsintensitaet.",
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
          top_reasons: ["Kraeftigt sichtbar und gibt mehr Fuelle"],
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
    "Idealer Treffer fuer feines Haar und schnell fettenden Kopfhaut-Fokus; Reinigungsintensitaet: normal.",
  )
  assert.doesNotMatch(result.products[0].fit_reason, /kraeft|fuelle|volume/i)
})

test("projectSelectedProducts uses leave-in-specific missing-info when leave_in returns no products", () => {
  const result = projectSelectedProducts([], null, "leave_in", createRuntimeStub())

  assert.deepEqual(result.missing_info, [
    {
      key: "thickness",
      label: "Haardicke",
      blocking: true,
      detail: "Es fehlt noch deine Haardicke fuer die Leave-in-Auswahl.",
    },
  ])
})

test("projectSelectedProducts uses oil-specific missing-info when oil returns no products", () => {
  const result = projectSelectedProducts([], null, "oil", createRuntimeStub())

  assert.deepEqual(result.missing_info, [
    {
      key: "thickness",
      label: "Haardicke",
      blocking: true,
      detail: "Es fehlt noch deine Haardicke fuer die Oel-Auswahl.",
    },
  ])
})

test("projectSelectedProducts does not fabricate generic missing-info for explicit default-branch categories", () => {
  const result = projectSelectedProducts([], { thickness: "normal" } as HairProfile, "mask")

  assert.deepEqual(result.missing_info, [])
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
