import { test, expect } from "@playwright/test"
import type { HairProfile } from "../src/lib/types"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import {
  annotateShampooRecommendations,
  buildShampooClarificationQuestions,
  buildShampooDecision,
  buildShampooRetrievalFilter,
} from "../src/lib/rag/shampoo-decision"
import { deriveMaskDecision } from "../src/lib/rag/mask-reranker"
import { computeChunkBoostedScore, type RetrievedChunk } from "../src/lib/rag/retriever"
import { buildProductListChunks } from "../src/lib/rag/product-list-chunks"
import { buildAssistantRagContext, buildDoneEventData } from "../src/lib/rag/chat-response"
import { evaluateRoute } from "../src/lib/rag/router"
import { normalizeShampooBucketPairs } from "../src/lib/shampoo/eligibility"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "straight",
    thickness: "fine",
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "oily",
    scalp_condition: "none",
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    routine_preference: "balanced",
    current_routine_products: [],
    towel_material: null,
    towel_technique: null,
    drying_method: null,
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
    name: `Shampoo ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
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
  overrides: Partial<RetrievedChunk> = {},
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
      2,
    )

    expect(decision.category).toBe("shampoo")
    expect(decision.eligible).toBe(true)
    expect(decision.missing_profile_fields).toEqual([])
    expect(decision.matched_profile).toEqual({
      thickness: "fine",
      scalp_type: "oily",
      scalp_condition: "dandruff",
    })
    expect(decision.matched_bucket).toBe("schuppen")
    expect(decision.matched_concern_code).toBe("schuppen")
    expect(decision.retrieval_filter).toEqual({
      thickness: "fine",
      concern: "schuppen",
    })
    expect(decision.candidate_count).toBe(2)
    expect(decision.no_catalog_match).toBe(false)
  })

  test("missing shampoo fields are reported precisely and in stable order", () => {
    expect(buildShampooDecision(createProfile({ thickness: null })).missing_profile_fields).toEqual(
      ["thickness"],
    )

    expect(
      buildShampooDecision(createProfile({ scalp_type: null })).missing_profile_fields,
    ).toEqual(["scalp_type"])

    expect(
      buildShampooDecision(createProfile({ scalp_condition: null })).missing_profile_fields,
    ).toEqual(["scalp_condition"])

    expect(
      buildShampooDecision(
        createProfile({ thickness: null, scalp_type: null, scalp_condition: null }),
      ).missing_profile_fields,
    ).toEqual(["thickness", "scalp_type", "scalp_condition"])
  })

  test("dry flakes map to the dry-scalp shampoo concern and surface exact no-match state", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "normal",
        scalp_type: "dry",
        scalp_condition: "dry_flakes",
      }),
      0,
    )

    expect(decision.eligible).toBe(true)
    expect(decision.matched_bucket).toBe("trocken")
    expect(decision.matched_concern_code).toBe("trocken")
    expect(decision.no_catalog_match).toBe(true)
  })

  test("active scalp conditions keep scalp type optional for the primary shampoo match", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: null,
        scalp_condition: "dandruff",
      }),
      2,
    )

    expect(decision.eligible).toBe(true)
    expect(decision.missing_profile_fields).toEqual([])
    expect(decision.matched_bucket).toBe("schuppen")
    expect(decision.matched_concern_code).toBe("schuppen")
    expect(decision.candidate_count).toBe(2)
    expect(decision.no_catalog_match).toBe(false)
  })

  test("active scalp conditions override scalp type when deriving the shampoo bucket", () => {
    const oilyDandruff = buildShampooDecision(
      createProfile({
        thickness: "normal",
        scalp_type: "oily",
        scalp_condition: "dandruff",
      }),
    )
    const dryDandruff = buildShampooDecision(
      createProfile({
        thickness: "normal",
        scalp_type: "dry",
        scalp_condition: "dandruff",
      }),
    )
    const balancedIrritated = buildShampooDecision(
      createProfile({
        thickness: "normal",
        scalp_type: "balanced",
        scalp_condition: "irritated",
      }),
    )

    expect(oilyDandruff.matched_bucket).toBe("schuppen")
    expect(dryDandruff.matched_bucket).toBe("schuppen")
    expect(balancedIrritated.matched_bucket).toBe("irritationen")
  })

  test("clearing the scalp condition reroutes shampoo matching back to the baseline scalp type", () => {
    const activeIssue = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "dandruff",
      }),
    )
    const recovered = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      }),
    )

    expect(activeIssue.matched_bucket).toBe("schuppen")
    expect(recovered.matched_bucket).toBe("dehydriert-fettig")
  })

  test("clarification questions only ask for missing shampoo profile fields", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: null,
        scalp_condition: null,
      }),
    )

    expect(buildShampooClarificationQuestions(decision)).toEqual([
      "Ist dein Haar eher fein, mittel oder dick?",
      "Hast du aktuell Kopfhautbeschwerden - keine, Schuppen, trockene Schuppen oder gereizte Kopfhaut?",
    ])
  })

  test("clarification skips scalp type once an active scalp condition already sets the bucket", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: null,
        scalp_condition: "irritated",
      }),
    )

    expect(decision.eligible).toBe(true)
    expect(buildShampooClarificationQuestions(decision)).toEqual([])
  })

  test("shampoo retrieval filter applies for advice and recommendation intents, but not outside shampoo product flows", () => {
    const decision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      }),
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
    expect(
      buildShampooRetrievalFilter("product_recommendation", "conditioner", decision),
    ).toBeUndefined()
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
      }),
      [],
    )

    expect(routerDecision.response_mode).not.toBe("clarify_only")
    expect(routerDecision.slot_completeness).toBe(1)
    expect(routerDecision.policy_overrides).toContain("category_product_mode")
    expect(routerDecision.policy_overrides).not.toContain("missing_slots")
  })

  test("router allows shampoo recommendations when an active scalp condition already determines the bucket", () => {
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
        scalp_type: null,
        scalp_condition: "dandruff",
      }),
      [],
    )

    expect(routerDecision.response_mode).not.toBe("clarify_only")
    expect(routerDecision.slot_completeness).toBe(1)
    expect(routerDecision.policy_overrides).toContain("category_product_mode")
    expect(routerDecision.policy_overrides).not.toContain("missing_shampoo_profile")
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
      }),
      [],
    )

    expect(routerDecision.response_mode).toBe("clarify_only")
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
      goals: ["healthier_hair"],
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
    expect(product.recommendation_meta?.category).toBe(noisyProduct.recommendation_meta?.category)

    if (!product.recommendation_meta || product.recommendation_meta.category !== "shampoo") {
      throw new Error("Expected shampoo recommendation metadata")
    }

    expect(product.recommendation_meta.matched_bucket).toBe("irritationen")
    expect(product.recommendation_meta?.top_reasons).toEqual(
      noisyProduct.recommendation_meta?.top_reasons,
    )
    expect(product.recommendation_meta?.top_reasons.join(" ")).not.toMatch(
      /coily|growth|taeglich|bleached|frizz|breakage/i,
    )
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
      ]),
    )
  })

  test("exact shampoo pairs are normalized deterministically without product-name hacks", () => {
    const pairs = normalizeShampooBucketPairs({
      name: "Custom Exact Pair Shampoo",
      category: "Shampoo",
      suitable_thicknesses: ["fine", "normal"],
      suitable_concerns: ["trocken", "normal"],
      shampoo_bucket_pairs: [
        { thickness: "normal", shampoo_bucket: "normal" },
        { thickness: "fine", shampoo_bucket: "trocken" },
        { thickness: "fine", shampoo_bucket: "trocken" },
      ],
    })

    expect(pairs).toEqual([
      { thickness: "fine", shampoo_bucket: "trocken" },
      { thickness: "normal", shampoo_bucket: "normal" },
    ])
  })

  test("standard shampoos still expand to the full cartesian pair set", () => {
    const pairs = normalizeShampooBucketPairs({
      name: "Classic Matrix Shampoo",
      category: "Shampoo",
      suitable_thicknesses: ["fine", "coarse"],
      suitable_concerns: ["dehydriert-fettig", "schuppen"],
    })

    expect(pairs).toEqual([
      { thickness: "fine", shampoo_bucket: "schuppen" },
      { thickness: "fine", shampoo_bucket: "dehydriert-fettig" },
      { thickness: "coarse", shampoo_bucket: "schuppen" },
      { thickness: "coarse", shampoo_bucket: "dehydriert-fettig" },
    ])
  })

  test("invalid exact shampoo pairs fail fast during normalization", () => {
    expect(() =>
      normalizeShampooBucketPairs({
        name: "Broken Exact Pair Shampoo",
        category: "Shampoo",
        shampoo_bucket_pairs: [{ thickness: "fine", shampoo_bucket: "nicht-echt" }],
      }),
    ).toThrow(/ungueltigen Shampoo-Bucket/i)
  })

  test("product-list chunk generation honors explicit shampoo bucket pairs for renamed products too", () => {
    const chunks = buildProductListChunks([
      {
        name: "Custom Exact Pair Shampoo",
        brand: "Test",
        category: "Shampoo",
        suitable_thicknesses: ["fine", "normal"],
        suitable_concerns: ["trocken", "normal"],
        shampoo_bucket_pairs: [
          { thickness: "fine", shampoo_bucket: "trocken" },
          { thickness: "normal", shampoo_bucket: "normal" },
        ],
      },
    ])

    expect(chunks).toHaveLength(2)
    expect(chunks.map((chunk) => chunk.metadata)).toEqual([
      expect.objectContaining({ thickness: "fine", concern: "trocken" }),
      expect.objectContaining({ thickness: "normal", concern: "normal" }),
    ])
  })

  test("chat payload helpers persist and expose shampoo decisions even without sources", () => {
    const categoryDecision = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      }),
      0,
    )
    const ragContext = buildAssistantRagContext([], categoryDecision)
    const donePayload = buildDoneEventData({
      intent: "product_recommendation",
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        retrieval_mode: "product_sql_plus_hybrid",
        response_mode: "answer_direct" as const,
        slot_completeness: 0.8,
        confidence: 0.9,
        policy_overrides: [],
      },
      categoryDecision,
    })

    expect(ragContext).toEqual({
      sources: [],
      category_decision: categoryDecision,
      engine_trace: null,
      response_mode: null,
    })
    expect(donePayload).toEqual(
      expect.objectContaining({
        intent: "product_recommendation",
        final_context_count: 0,
        category_decision: categoryDecision,
      }),
    )
  })

  test("dandruff user gets secondary_bucket derived from scalp type for rotation", () => {
    const balanced = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "balanced",
        scalp_condition: "dandruff",
      }),
    )
    expect(balanced.matched_bucket).toBe("schuppen")
    expect(balanced.secondary_bucket).toBe("normal")

    const oily = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "dandruff",
      }),
    )
    expect(oily.matched_bucket).toBe("schuppen")
    expect(oily.secondary_bucket).toBe("dehydriert-fettig")
  })

  test("non-dandruff users have no secondary_bucket", () => {
    const none = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "oily",
        scalp_condition: "none",
      }),
    )
    expect(none.secondary_bucket).toBeNull()

    const irritated = buildShampooDecision(
      createProfile({
        thickness: "fine",
        scalp_type: "balanced",
        scalp_condition: "irritated",
      }),
    )
    expect(irritated.secondary_bucket).toBeNull()
  })
})

test.describe("Mask weighted signal scoring", () => {
  test("bleached + heat_styling user gets need_strength 2 (weight 3+1=4)", () => {
    const decision = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["bleached"],
        heat_styling: "daily",
        protein_moisture_balance: "stretches_bounces",
      }),
    )

    expect(decision.needs_mask).toBe(true)
    expect(decision.need_strength).toBe(2)
    expect(decision.active_signals).toContain("chemical_treatment")
    expect(decision.active_signals).toContain("heat_styling")
    expect(decision.signal_weights?.chemical_treatment).toBe(3)
    expect(decision.signal_weights?.heat_styling).toBe(1)
  })

  test("bleached + deficit balance = need_strength 3 (weight 3+2=5)", () => {
    const decision = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["bleached"],
        heat_styling: "never",
        protein_moisture_balance: "snaps",
      }),
    )

    expect(decision.needs_mask).toBe(true)
    expect(decision.need_strength).toBe(3)
    expect(decision.signal_weights?.chemical_treatment).toBe(3)
    expect(decision.signal_weights?.protein_moisture_balance).toBe(2)
  })

  test("heat-only user gets need_strength 1 (weight 1)", () => {
    const decision = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["natural"],
        heat_styling: "daily",
        protein_moisture_balance: "stretches_bounces",
      }),
    )

    expect(decision.needs_mask).toBe(true)
    expect(decision.need_strength).toBe(1)
    expect(decision.active_signals).toEqual(["heat_styling"])
    expect(decision.signal_weights?.heat_styling).toBe(1)
  })

  test("colored (not bleached) gets weight 2 for chemical_treatment", () => {
    const decision = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["colored"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_bounces",
      }),
    )

    expect(decision.needs_mask).toBe(true)
    expect(decision.need_strength).toBe(1)
    expect(decision.signal_weights?.chemical_treatment).toBe(2)
  })

  test("no active signals yields need_strength 0 and no signal_weights", () => {
    const decision = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["natural"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_bounces",
      }),
    )

    expect(decision.needs_mask).toBe(false)
    expect(decision.need_strength).toBe(0)
    expect(decision.signal_weights).toBeUndefined()
  })
})
