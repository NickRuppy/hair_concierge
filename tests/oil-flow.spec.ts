import { test, expect } from "@playwright/test"
import type { HairProfile } from "../src/lib/types"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import {
  annotateOilRecommendations,
  buildOilClarificationQuestions,
  buildOilDecision,
  buildOilRetrievalFilter,
} from "../src/lib/rag/oil-decision"
import { buildProductListChunks } from "../src/lib/rag/product-list-chunks"
import { evaluateRoute } from "../src/lib/rag/router"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    concerns: ["dryness"],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "rarely",
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
    created_at: "2026-03-21T00:00:00.000Z",
    updated_at: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

function createCandidate(
  id: string,
  overrides: Partial<MatchedProduct> = {}
): MatchedProduct {
  return {
    id,
    name: `Oel ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
    tom_take: null,
    category: "Öle",
    affiliate_link: null,
    image_url: "https://example.com/oil.jpg",
    price_eur: 15.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal"],
    suitable_concerns: ["styling-oel"],
    is_active: true,
    sort_order: 1,
    created_at: "2026-03-21T00:00:00.000Z",
    updated_at: "2026-03-21T00:00:00.000Z",
    similarity: 0.88,
    combined_score: 0.88,
    ...overrides,
  }
}

test.describe("Oil structured recommendation flow", () => {
  test("hair oiling requests map to natural oil with scalp-support framing", () => {
    const decision = buildOilDecision(
      createProfile({
        thickness: "normal",
        scalp_type: "dry",
        scalp_condition: "dry_flakes",
      }),
      "Ich moechte Hair Oiling fuer meine trockene Kopfhaut vor dem Waschen machen.",
      2
    )

    expect(decision.category).toBe("oil")
    expect(decision.eligible).toBe(true)
    expect(decision.missing_profile_fields).toEqual([])
    expect(decision.matched_profile.thickness).toBe("normal")
    expect(decision.matched_subtype).toBe("natuerliches-oel")
    expect(decision.use_mode).toBe("pre_wash_oiling")
    expect(decision.adjunct_scalp_support).toBe(true)
    expect(decision.no_recommendation).toBe(false)
    expect(decision.no_catalog_match).toBe(false)
  })

  test("styling and dry-oil intents stay separated", () => {
    const stylingDecision = buildOilDecision(
      createProfile({ thickness: "normal" }),
      "Ich suche ein Styling-Oel als Finish gegen Frizz und fuer mehr Glanz."
    )
    const dryOilDecision = buildOilDecision(
      createProfile({ thickness: "fine" }),
      "Ich brauche ein leichtes Trockenöl, das nicht beschwert."
    )

    expect(stylingDecision.matched_subtype).toBe("styling-oel")
    expect(stylingDecision.use_mode).toBe("styling_finish")
    expect(dryOilDecision.matched_subtype).toBe("trocken-oel")
    expect(dryOilDecision.use_mode).toBe("light_finish")
  })

  test("explicit subtype wins over generic lightweight wording", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "fine" }),
      "Ich suche ein leichtes Styling-Oel gegen Frizz."
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_subtype).toBe("styling-oel")
    expect(decision.use_mode).toBe("styling_finish")
  })

  test("scalp and hair-oiling intent overrides styling language", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "normal" }),
      "Ich will ein Oel fuer die Kopfhaut vor dem Waschen, aber auch gegen Frizz."
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_subtype).toBe("natuerliches-oel")
    expect(decision.use_mode).toBe("pre_wash_oiling")
  })

  test("missing oil fields are reported in stable order", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: null }),
      "Welches Haaroel passt zu mir?"
    )

    expect(decision.eligible).toBe(false)
    expect(decision.missing_profile_fields).toEqual(["thickness", "oil_purpose"])
    expect(buildOilClarificationQuestions(decision)).toEqual([
      "Ist dein Haar eher fein, mittel oder dick?",
      "Wofuer moechtest du das Oel vor allem nutzen - fuer Hair Oiling vor dem Waschen, als Styling-Finish gegen Frizz/mehr Glanz oder als leichtes Trocken-Oel?",
    ])
  })

  test("therapy-oil requests can produce an explicit no-oil outcome", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "fine" }),
      "Ich suche ein Rosmarinöl fuer Hair Oiling auf der Kopfhaut."
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_subtype).toBe("natuerliches-oel")
    expect(decision.no_recommendation).toBe(true)
    expect(decision.no_recommendation_reason).toBe("therapy_oil_missing")
    expect(buildOilRetrievalFilter("product_recommendation", "oil", decision)).toBeUndefined()
  })

  test("catalog natural oils like Moringaoel are not blocked as therapy-oils", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "normal" }),
      "Ich suche Moringaöl fuer Hair Oiling."
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_subtype).toBe("natuerliches-oel")
    expect(decision.no_recommendation).toBe(false)
    expect(decision.no_recommendation_reason).toBeNull()
  })

  test("non-oil category needs can produce an explicit no-oil outcome", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "fine" }),
      "Ich suche ein Styling-Oel mit Hitzeschutz statt Leave-in."
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_subtype).toBe("styling-oel")
    expect(decision.no_recommendation).toBe(true)
    expect(decision.no_recommendation_reason).toBe("better_non_oil_category")
  })

  test("eligible oil decisions expose an exact retrieval filter", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "coarse" }),
      "Ich moechte ein Oel als Finish gegen Frizz und fuer mehr Glanz."
    )

    expect(buildOilRetrievalFilter("product_recommendation", "oil", decision)).toEqual({
      thickness: "coarse",
      concern: "styling-oel",
    })
  })

  test("annotated oil recommendations preserve subtype and usage metadata", () => {
    const decision = buildOilDecision(
      createProfile({ thickness: "fine" }),
      "Ich brauche ein leichtes Trockenoel, das nicht beschwert.",
      2
    )

    const results = annotateOilRecommendations(
      [
        createCandidate("dry-1", {
          suitable_concerns: ["trocken-oel"],
        }),
        createCandidate("dry-2", {
          suitable_concerns: ["styling-oel", "trocken-oel"],
          sort_order: 2,
        }),
      ],
      decision
    )

    expect(results).toHaveLength(2)
    expect(results[0]?.recommendation_meta).toEqual(
      expect.objectContaining({
        category: "oil",
        matched_subtype: "trocken-oel",
        use_mode: "light_finish",
        matched_profile: { thickness: "fine" },
      })
    )
  })

  test("router skips generic slot questions when oil profile and purpose are complete", () => {
    const routerDecision = evaluateRoute(
      {
        intent: "product_recommendation",
        product_category: "oil",
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
        router_confidence: 0.91,
      },
      [],
      createProfile({ thickness: "fine" }),
      "Ich brauche ein leichtes Trockenoel, das nicht beschwert."
    )

    expect(routerDecision.needs_clarification).toBe(false)
    expect(routerDecision.slot_completeness).toBe(1)
    expect(routerDecision.policy_overrides).toContain("category_product_mode")
  })

  test("unowned profile signals do not change the oil subtype", () => {
    const baseDecision = buildOilDecision(
      createProfile({
        thickness: "normal",
        density: "low",
        hair_texture: "straight",
      }),
      "Ich suche ein Oel als Finish gegen Frizz und fuer mehr Glanz."
    )
    const changedDecision = buildOilDecision(
      createProfile({
        thickness: "normal",
        density: "high",
        hair_texture: "coily",
        chemical_treatment: ["bleached"],
      }),
      "Ich suche ein Oel als Finish gegen Frizz und fuer mehr Glanz."
    )

    expect(baseDecision.matched_subtype).toBe("styling-oel")
    expect(changedDecision.matched_subtype).toBe("styling-oel")
    expect(baseDecision.use_mode).toBe("styling_finish")
    expect(changedDecision.use_mode).toBe("styling_finish")
  })

  test("product list chunks understand hyphenated oil subtype labels", () => {
    const chunks = buildProductListChunks([
      {
        name: "Olaplex No.7 Bonding Oil",
        brand: "Olaplex",
        category: "Öle",
        suitable_thicknesses: ["fine"],
        suitable_concerns: ["styling-oel"],
      },
    ])

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.content).toContain("Styling mit Oel")
  })
})
