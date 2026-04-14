import { test, expect } from "@playwright/test"
import type { HairProfile } from "../src/lib/types"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import type { ProductLeaveInSpecs } from "../src/lib/leave-in/constants"
import {
  buildLeaveInClarificationQuestions,
  buildLeaveInDecision,
  deriveLeaveInNeedBucket,
  deriveLeaveInStylingContext,
  rerankLeaveInProducts,
} from "../src/lib/rag/leave-in-decision"
import { evaluateRoute } from "../src/lib/rag/router"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "normal",
    density: "medium",
    concerns: ["dryness"],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: "none",
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    post_wash_actions: ["air_dry"],
    routine_preference: "balanced",
    current_routine_products: ["shampoo", "conditioner"],
    mechanical_stress_factors: [],
    towel_material: null,
    towel_technique: null,
    drying_method: [],
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-03-14T00:00:00.000Z",
    updated_at: "2026-03-14T00:00:00.000Z",
    ...overrides,
  }
}

function createCandidate(id: string, overrides: Partial<MatchedProduct> = {}): MatchedProduct {
  return {
    id,
    name: `Leave-in ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
    category: "Leave-in",
    affiliate_link: null,
    image_url: null,
    price_eur: 12.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: [],
    is_active: true,
    sort_order: 1,
    created_at: "2026-03-14T00:00:00.000Z",
    updated_at: "2026-03-14T00:00:00.000Z",
    similarity: 0.8,
    combined_score: 0.8,
    ...overrides,
  }
}

function createSpec(
  productId: string,
  overrides: Partial<ProductLeaveInSpecs> = {},
): ProductLeaveInSpecs {
  return {
    product_id: productId,
    format: "lotion",
    weight: "medium",
    roles: ["extension_conditioner"],
    provides_heat_protection: false,
    heat_protection_max_c: null,
    heat_activation_required: false,
    care_benefits: ["moisture"],
    ingredient_flags: [],
    application_stage: ["towel_dry"],
    ...overrides,
  }
}

test.describe("Leave-in strict decision flow", () => {
  test("full leave-in profile produces an eligible decision with exact-match signals", () => {
    const decision = buildLeaveInDecision(
      createProfile({
        hair_texture: "wavy",
        thickness: "fine",
        density: "high",
        goals: ["curl_definition"],
        concerns: [],
        post_wash_actions: ["non_heat_styling"],
      }),
      2,
    )

    expect(decision.category).toBe("leave_in")
    expect(decision.eligible).toBe(true)
    expect(decision.missing_profile_fields).toEqual([])
    expect(decision.need_bucket).toBe("curl_definition")
    expect(decision.styling_context).toBe("non_heat_style")
    expect(decision.conditioner_relationship).toBe("replacement_capable")
    expect(decision.matched_weight).toBe("medium")
    expect(decision.candidate_count).toBe(2)
    expect(decision.no_catalog_match).toBe(false)
  })

  test("missing leave-in fields are reported precisely and in stable order", () => {
    const decision = buildLeaveInDecision(
      createProfile({
        hair_texture: null,
        thickness: null,
        density: null,
        concerns: [],
        goals: [],
        post_wash_actions: [],
        heat_styling: "never",
      }),
    )

    expect(decision.missing_profile_fields).toEqual([
      "hair_texture",
      "thickness",
      "density",
      "care_signal",
      "styling_signal",
    ])
  })

  test("heat styling derives the heat-protect bucket and strict heat styling context", () => {
    const profile = createProfile({
      concerns: [],
      goals: [],
      post_wash_actions: ["blow_dry_only"],
    })

    expect(deriveLeaveInStylingContext(profile)).toBe("heat_style")
    expect(deriveLeaveInNeedBucket(profile)).toBe("heat_protect")
    expect(buildLeaveInDecision(profile).missing_profile_fields).toEqual([])
  })

  test("conditioner relationship follows thickness and density rule", () => {
    expect(
      buildLeaveInDecision(createProfile({ thickness: "fine", density: "high" }))
        .conditioner_relationship,
    ).toBe("replacement_capable")

    expect(
      buildLeaveInDecision(createProfile({ thickness: "normal", density: "low" }))
        .conditioner_relationship,
    ).toBe("replacement_capable")

    expect(
      buildLeaveInDecision(createProfile({ thickness: "normal", density: "medium" }))
        .conditioner_relationship,
    ).toBe("booster_only")

    expect(
      buildLeaveInDecision(createProfile({ thickness: "coarse", density: "high" }))
        .conditioner_relationship,
    ).toBe("booster_only")
  })

  test("clarification questions only ask for missing leave-in fields", () => {
    const decision = buildLeaveInDecision(
      createProfile({
        density: null,
        concerns: [],
        goals: [],
      }),
    )

    expect(buildLeaveInClarificationQuestions(decision)).toEqual([
      "Hast du eher wenig, mittel viele oder viele Haare?",
      "Was soll deine Pflege gerade vor allem leisten - eher Frizz baendigen, Feuchtigkeit geben, reparieren, Definition geben oder Schutz vor Hitze?",
    ])
  })

  test("router does not ask generic slot questions when the leave-in profile is complete", () => {
    const routerDecision = evaluateRoute(
      {
        intent: "product_recommendation",
        product_category: "leave_in",
        complexity: "simple",
        needs_clarification: true,
        retrieval_mode: "hybrid",
        normalized_filters: {
          problem: null,
          duration: null,
          products_tried: null,
          routine: null,
          special_circumstances: null,
        },
        router_confidence: 0.92,
      },
      [],
      createProfile({
        hair_texture: "wavy",
        thickness: "normal",
        density: "medium",
        concerns: ["dryness"],
        post_wash_actions: ["air_dry"],
      }),
    )

    expect(routerDecision.response_mode).not.toBe("clarify_only")
    expect(routerDecision.slot_completeness).toBe(1)
    expect(routerDecision.policy_overrides).toContain("category_product_mode")
  })

  test("booster-only profiles never surface replacement-only leave-ins", () => {
    const decision = buildLeaveInDecision(
      createProfile({
        thickness: "normal",
        density: "medium",
        concerns: ["dryness"],
        post_wash_actions: ["air_dry"],
      }),
      2,
    )

    const results = rerankLeaveInProducts(
      [createCandidate("replacement"), createCandidate("booster", { sort_order: 2 })],
      [
        createSpec("replacement", {
          roles: ["replacement_conditioner"],
          weight: "medium",
        }),
        createSpec("booster", {
          roles: ["extension_conditioner"],
          weight: "medium",
        }),
      ],
      decision,
    )

    expect(results.map((product) => product.id)).toEqual(["booster"])
    expect(results[0]?.recommendation_meta).toEqual(
      expect.objectContaining({
        category: "leave_in",
        conditioner_relationship: "booster_only",
        need_bucket: "moisture_anti_frizz",
      }),
    )
  })

  test("routine inventory and preference do not affect strict leave-in decision", () => {
    const baseProfile = createProfile({
      thickness: "normal",
      density: "medium",
      concerns: ["dryness"],
      post_wash_actions: ["air_dry"],
      current_routine_products: ["shampoo", "conditioner"],
      routine_preference: "balanced",
    })
    const noisyProfile = createProfile({
      ...baseProfile,
      current_routine_products: ["shampoo", "conditioner", "leave_in", "oil", "mask"],
      routine_preference: "advanced",
    })

    expect(buildLeaveInDecision(baseProfile)).toEqual(buildLeaveInDecision(noisyProfile))
  })
})
