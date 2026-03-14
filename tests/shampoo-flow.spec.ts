import { test, expect } from "@playwright/test"
import type { HairProfile } from "../src/lib/types"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import {
  annotateShampooRecommendations,
  buildShampooClarificationQuestions,
  buildShampooDecision,
  buildShampooRetrievalFilter,
} from "../src/lib/rag/shampoo-decision"
import { computeChunkBoostedScore, type RetrievedChunk } from "../src/lib/rag/retriever"
import { buildProductListChunks } from "../src/lib/rag/product-list-chunks"
import { buildAssistantRagContext, buildDoneEventData } from "../src/lib/rag/chat-response"
import { evaluateRoute } from "../src/lib/rag/router"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "straight",
    thickness: "fine",
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: "twice_weekly",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "oily",
    scalp_condition: "none",
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    post_wash_actions: [],
    routine_preference: "balanced",
    current_routine_products: [],
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-03-14T00:00:00.000Z",
    updated_at: "2026-03-14T00:00:00.000Z",
    ...overrides,
  }
}

function createCandidate(
  id: string,
  overrides: Partial<MatchedProduct> = {}
): MatchedProduct {
  return {
    id,
    name: `Shampoo ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
    tom_take: null,
    category: "Shampoo",
    affiliate_link: null,
    image_url: null,
    price_eur: 8.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal"],
    suitable_concerns: ["dehydriert-fettig"],
    is_active: true,
    sort_order: 1,
    created_at: "2026-03-14T00:00:00.000Z",
    updated_at: "2026-03-14T00:00:00.000Z",
    similarity: 0.83,
    combined_score: 0.83,
    ...overrides,
  }
}

function createChunk(
  metadata: Record<string, unknown>,
  overrides: Partial<RetrievedChunk> = {}
): RetrievedChunk {
  return {
    id: `chunk-${Math.random()}`,
    source_type: "product_list",
    source_name: "produktmatrix/shampoo",
    chunk_index: 0,
    content: "Test chunk",
    metadata,
    token_count: 10,
    created_at: "2026-03-14T00:00:00.000Z",
    similarity: 1,
    weighted_similarity: 1,
    ...overrides,
  }
}

test.describe("Shampoo Flow alignment", () => {
  test("full shampoo profile produces an eligible decision with exact retrieval signals", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "dandruff",
      }),
      2
    )

    expect(decision.category).toBe("shampoo")
    expect(decision.eligible).toBe(true)
    expect(decision.missing_profile_fields).toEqual([])
    expect(decision.matched_profile).toEqual({
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: "dandruff",
    })
    expect(decision.matched_concern_code).toBe("schuppen")
    expect(decision.retrieval_filter).toEqual({
      thickness: "fine",
      concern: "schuppen",
    })
    expect(decision.candidate_count).toBe(2)
    expect(decision.no_catalog_match).toBe(false)
  })

  test("missing shampoo fields are reported precisely and in stable order", () => {
    expect(
      buildShampooDecision(createProfile({ thickness: null })).missing_profile_fields
    ).toEqual(["thickness"])

    expect(
      buildShampooDecision(createProfile({ scalp_type: null })).missing_profile_fields
    ).toEqual(["scalp_type"])

    expect(
      buildShampooDecision(createProfile({ scalp_condition: null })).missing_profile_fields
    ).toEqual(["scalp_condition"])

    expect(
      buildShampooDecision(createProfile({ thickness: null, scalp_type: null, scalp_condition: null })).missing_profile_fields
    ).toEqual(["thickness", "scalp_type", "scalp_condition"])
  })

  test("dry flakes map to the dry-scalp shampoo concern and surface exact no-match state", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "normal",
        scalp_type: "dry",
        scalp_condition: "dry_flakes",
      }),
      0
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_concern_code).toBe("trocken")
    expect(decision.no_catalog_match).toBe(true)
  })

  test("clarification questions only ask for missing shampoo profile fields", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: null,
        scalp_condition: null,
      })
    )

    expect(buildShampooClarificationQuestions(decision)).toEqual([
      "Ist dein Haar eher fein, mittel oder dick?",
      "Hast du aktuell Kopfhautbeschwerden - keine, Schuppen, trockene Schuppen oder gereizte Kopfhaut?",
    ])
  })

  test("shampoo retrieval filter applies for advice and recommendation intents, but not outside shampoo product flows", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      })
    )

    expect(buildShampooRetrievalFilter("product_recommendation", "shampoo", decision)).toEqual({
      thickness: "fine",
      concern: "dehydriert-fettig",
    })
    expect(buildShampooRetrievalFilter("hair_care_advice", "shampoo", decision)).toEqual({
      thickness: "fine",
      concern: "dehydriert-fettig",
    })
    expect(buildShampooRetrievalFilter("routine_help", "shampoo", decision)).toEqual({
      thickness: "fine",
      concern: "dehydriert-fettig",
    })
    expect(buildShampooRetrievalFilter("general_chat", "shampoo", decision)).toBeUndefined()
    expect(buildShampooRetrievalFilter("product_recommendation", "conditioner", decision)).toBeUndefined()
  })

  test("router does not ask generic slot questions when the shampoo triple is complete", () => {
    const routerDecision = evaluateRoute(
      {
        intent: "product_recommendation",
        product_category: "shampoo",
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
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      })
    )

    expect(routerDecision.needs_clarification).toBe(false)
    expect(routerDecision.slot_completeness).toBe(1)
    expect(routerDecision.policy_overrides).toContain("category_product_mode")
    expect(routerDecision.policy_overrides).not.toContain("missing_slots")
  })

  test("router still clarifies when the shampoo triple is incomplete", () => {
    const routerDecision = evaluateRoute(
      {
        intent: "product_recommendation",
        product_category: "shampoo",
        complexity: "simple",
        needs_clarification: false,
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
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: null,
      })
    )

    expect(routerDecision.needs_clarification).toBe(true)
    expect(routerDecision.slot_completeness).toBeCloseTo(2 / 3, 5)
    expect(routerDecision.policy_overrides).toContain("missing_shampoo_profile")
  })

  test("shampoo product metadata stays owned by thickness, scalp type and scalp condition only", () => {
    const baseProfile = createProfile({
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: "irritated",
    })
    const noisyProfile = createProfile({
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: "irritated",
      hair_texture: "coily",
      goals: ["hair_growth"],
      wash_frequency: "daily",
      chemical_treatment: ["bleached"],
      concerns: ["frizz", "dryness"],
    })

    const baseDecision = buildShampooDecision(baseProfile, 1)
    const noisyDecision = buildShampooDecision(noisyProfile, 1)

    expect(baseDecision).toEqual(noisyDecision)

    const [product] = annotateShampooRecommendations([createCandidate("a")], baseDecision)
    const [noisyProduct] = annotateShampooRecommendations([createCandidate("a")], noisyDecision)

    expect(product.recommendation_meta?.category).toBe("shampoo")
    expect(product.recommendation_meta?.top_reasons).toEqual(noisyProduct.recommendation_meta?.top_reasons)
    expect(product.recommendation_meta?.top_reasons.join(" ")).not.toMatch(/coily|growth|taeglich|bleached|frizz|breakage/i)
  })

  test("shampoo concern boost improves retrieval ranking for matching chunks", () => {
    const hairProfile = createProfile({
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: "dandruff",
    })
    const matchingChunk = createChunk({ thickness: "fine", concern: "schuppen" })
    const nonMatchingChunk = createChunk({ thickness: "fine", concern: "normal" })

    const matchingScore = computeChunkBoostedScore(matchingChunk, hairProfile, "schuppen")
    const nonMatchingScore = computeChunkBoostedScore(nonMatchingChunk, hairProfile, "schuppen")

    expect(matchingScore).toBeGreaterThan(nonMatchingScore)
  })

  test("product-list chunk generation expands all thickness and concern combinations", () => {
    const chunks = buildProductListChunks([
      {
        name: "Combo Shampoo",
        brand: "Test",
        category: "Shampoo",
        suitable_thicknesses: ["fine", "coarse"],
        suitable_concerns: ["dehydriert-fettig", "schuppen"],
      },
    ])

    expect(chunks).toHaveLength(4)
    expect(chunks.map((chunk) => chunk.metadata)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ thickness: "fine", concern: "dehydriert-fettig" }),
        expect.objectContaining({ thickness: "fine", concern: "schuppen" }),
        expect.objectContaining({ thickness: "coarse", concern: "dehydriert-fettig" }),
        expect.objectContaining({ thickness: "coarse", concern: "schuppen" }),
      ])
    )
  })

  test("chat payload helpers persist and expose shampoo decisions even without sources", () => {
    const categoryDecision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      }),
      0
    )
    const ragContext = buildAssistantRagContext([], categoryDecision)
    const donePayload = buildDoneEventData({
      intent: "product_recommendation",
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        retrieval_mode: "product_sql_plus_hybrid",
        needs_clarification: false,
        slot_completeness: 0.8,
        confidence: 0.9,
        policy_overrides: [],
      },
      categoryDecision,
    })

    expect(ragContext).toEqual({
      sources: [],
      category_decision: categoryDecision,
    })
    expect(donePayload).toEqual(
      expect.objectContaining({
        intent: "product_recommendation",
        final_context_count: 0,
        category_decision: categoryDecision,
      })
    )
  })
})
