import { test, expect } from "@playwright/test"
import { isConditionerCategory } from "../src/lib/conditioner/constants"
import type { HairProfile } from "../src/lib/types"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import type { ProductConditionerSpecs } from "../src/lib/conditioner/constants"
import {
  buildConditionerClarificationQuestions,
  buildConditionerDecision,
  deriveConditionerRepairLevel,
  deriveExpectedConditionerWeight,
  rerankConditionerProducts,
} from "../src/lib/rag/conditioner-decision"
import { buildAssistantRagContext, buildDoneEventData } from "../src/lib/rag/chat-response"
import { INTENT_CLASSIFICATION_PROMPT } from "../src/lib/rag/prompts"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "straight",
    thickness: "normal",
    density: "medium",
    concerns: [],
    products_used: null,
    wash_frequency: "twice_weekly",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: "none",
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    post_wash_actions: [],
    routine_preference: "balanced",
    current_routine_products: [],
    mechanical_stress_factors: [],
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
    name: `Conditioner ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
    tom_take: null,
    category: "Conditioner",
    affiliate_link: null,
    image_url: null,
    price_eur: 11.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: ["protein", "feuchtigkeit"],
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
  overrides: Partial<ProductConditionerSpecs> = {}
): ProductConditionerSpecs {
  return {
    product_id: productId,
    weight: "medium",
    repair_level: "medium",
    ...overrides,
  }
}

test.describe("Conditioner reranker", () => {
  test("clarification questions only ask for missing conditioner profile fields", () => {
    const decision = buildConditionerDecision(
      createProfile({
        thickness: null,
        protein_moisture_balance: null,
      })
    )

    expect(buildConditionerClarificationQuestions(decision)).toEqual([
      "Ist dein Haar eher fein, mittel oder dick?",
      "Hast du mal den Zugtest gemacht? Einzelnes Haar ziehen - bricht es direkt, dehnt es sich, oder federt es zurueck?",
    ])
  })

  test("repair level maps from cuticle condition and chemical treatment with higher-need-wins precedence", () => {
    expect(
      deriveConditionerRepairLevel(
        createProfile({
          cuticle_condition: "smooth",
          chemical_treatment: ["natural"],
        })
      )
    ).toBe("low")

    expect(
      deriveConditionerRepairLevel(
        createProfile({
          cuticle_condition: "slightly_rough",
          chemical_treatment: ["colored"],
        })
      )
    ).toBe("medium")

    expect(
      deriveConditionerRepairLevel(
        createProfile({
          cuticle_condition: "rough",
          chemical_treatment: ["natural"],
        })
      )
    ).toBe("high")

    expect(
      deriveConditionerRepairLevel(
        createProfile({
          cuticle_condition: "slightly_rough",
          chemical_treatment: ["bleached"],
        })
      )
    ).toBe("high")
  })

  test("expected conditioner weight follows thickness and density grid", () => {
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "fine", density: "low" }))).toBe("light")
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "fine", density: "high" }))).toBe("medium")
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "normal", density: "low" }))).toBe("light")
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "normal", density: "medium" }))).toBe("medium")
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "normal", density: "high" }))).toBe("rich")
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "coarse", density: "low" }))).toBe("medium")
    expect(deriveExpectedConditionerWeight(createProfile({ thickness: "coarse", density: "high" }))).toBe("rich")
  })

  test("weight fit reorders otherwise similar candidates without changing strict baseline eligibility", () => {
    const decision = buildConditionerDecision(
      createProfile({
        thickness: "fine",
        density: "low",
        protein_moisture_balance: "snaps",
        cuticle_condition: "smooth",
        chemical_treatment: ["natural"],
      }),
      3
    )

    const results = rerankConditionerProducts(
      [
        createCandidate("light"),
        createCandidate("medium", { sort_order: 2 }),
        createCandidate("rich", { sort_order: 3 }),
      ],
      [
        createSpec("light", { weight: "light", repair_level: "low" }),
        createSpec("medium", { weight: "medium", repair_level: "low" }),
        createSpec("rich", { weight: "rich", repair_level: "low" }),
      ],
      decision
    )

    expect(decision.eligible).toBe(true)
    expect(results.map((product) => product.id)).toEqual(["light", "medium", "rich"])
    expect(results[0]?.recommendation_meta?.category).toBe("conditioner")
  })

  test("repair fit reorders candidates by needed repair intensity", () => {
    const decision = buildConditionerDecision(
      createProfile({
        thickness: "normal",
        density: "medium",
        protein_moisture_balance: "stretches_stays",
        cuticle_condition: "rough",
        chemical_treatment: ["bleached"],
      }),
      3
    )

    const results = rerankConditionerProducts(
      [
        createCandidate("low"),
        createCandidate("medium", { sort_order: 2 }),
        createCandidate("high", { sort_order: 3 }),
      ],
      [
        createSpec("low", { weight: "medium", repair_level: "low" }),
        createSpec("medium", { weight: "medium", repair_level: "medium" }),
        createSpec("high", { weight: "medium", repair_level: "high" }),
      ],
      decision
    )

    expect(results.map((product) => product.id)).toEqual(["high", "medium", "low"])
    expect(results[0]?.recommendation_meta).toEqual(
      expect.objectContaining({
        category: "conditioner",
        matched_repair_level: "high",
      })
    )
  })

  test("missing density falls back safely and keeps weight scoring neutral", () => {
    const decision = buildConditionerDecision(
      createProfile({
        density: null,
        cuticle_condition: null,
        chemical_treatment: [],
      }),
      2
    )

    const results = rerankConditionerProducts(
      [
        createCandidate("higher-base", { combined_score: 0.92, similarity: 0.92 }),
        createCandidate("lower-base", { combined_score: 0.65, similarity: 0.65, sort_order: 2 }),
      ],
      [
        createSpec("higher-base", { weight: "rich", repair_level: "high" }),
        createSpec("lower-base", { weight: "light", repair_level: "low" }),
      ],
      decision
    )

    expect(decision.matched_weight).toBeNull()
    expect(decision.used_density).toBe(false)
    expect(results[0]?.id).toBe("higher-base")
    expect(results[0]?.recommendation_meta).toEqual(
      expect.objectContaining({
        category: "conditioner",
        matched_weight: null,
      })
    )
  })

  test("missing product specs falls back safely and still emits neutral metadata", () => {
    const decision = buildConditionerDecision(
      createProfile({
        thickness: "normal",
        density: "medium",
        protein_moisture_balance: "stretches_bounces",
      }),
      2
    )

    const results = rerankConditionerProducts(
      [
        createCandidate("first", { combined_score: 0.82, similarity: 0.82 }),
        createCandidate("second", { combined_score: 0.78, similarity: 0.78, sort_order: 2 }),
      ],
      [],
      decision
    )

    expect(results.map((product) => product.id)).toEqual(["first", "second"])
    expect(results[0]?.conditioner_specs ?? null).toBeNull()
    expect(results[0]?.recommendation_meta?.tradeoffs).toContain(
      "Fuer dieses Produkt fehlt noch die volle Conditioner-Spezifikation."
    )
  })

  test("chat payload helpers persist conditioner decisions even without sources", () => {
    const categoryDecision = buildConditionerDecision(
      createProfile({
        thickness: "normal",
        density: "high",
        protein_moisture_balance: "stretches_stays",
        cuticle_condition: "rough",
        chemical_treatment: ["colored"],
      }),
      1
    )

    const ragContext = buildAssistantRagContext([], categoryDecision)
    const donePayload = buildDoneEventData({
      intent: "product_recommendation",
      retrievalSummary: { final_context_count: 0 },
      routerDecision: {
        retrieval_mode: "product_sql_plus_hybrid",
        needs_clarification: false,
        slot_completeness: 1,
        confidence: 0.93,
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
        category_decision: categoryDecision,
      })
    )
  })

  test("intent prompt routes Haarkur to mask instead of conditioner", () => {
    expect(INTENT_CLASSIFICATION_PROMPT).toContain("- conditioner: Conditioner, Spuelung")
    expect(INTENT_CLASSIFICATION_PROMPT).toContain("- mask: Haarmaske, Haarkur, Tiefenpflege")
    expect(INTENT_CLASSIFICATION_PROMPT).not.toContain("- conditioner: Conditioner, Spuelung, Haarkur")
  })

  test("conditioner category detection accepts the live drogerie bucket", () => {
    expect(isConditionerCategory("Conditioner")).toBe(true)
    expect(isConditionerCategory("Conditioner Profi")).toBe(true)
    expect(isConditionerCategory("Conditioner (Drogerie)")).toBe(true)
    expect(isConditionerCategory("Maske")).toBe(false)
  })
})
