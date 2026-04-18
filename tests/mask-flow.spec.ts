import { test, expect } from "@playwright/test"
import type { HairProfile } from "../src/lib/types"
import type { MatchedProduct } from "../src/lib/rag/product-matcher"
import type { ProductMaskSpecs } from "../src/lib/mask/constants"
import { buildMaskConcernSearchOrder } from "../src/lib/rag/mask-mapper"
import { deriveMaskDecision, rerankMaskProducts } from "../src/lib/rag/mask-reranker"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "straight",
    thickness: "normal",
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
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
    name: `Maske ${id}`,
    brand: "Test",
    description: null,
    short_description: null,
    category: "Maske",
    affiliate_link: null,
    image_url: null,
    price_eur: 9.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: ["protein"],
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
  overrides: Partial<ProductMaskSpecs> = {},
): ProductMaskSpecs {
  return {
    product_id: productId,
    weight: "medium",
    concentration: "medium",
    balance_direction: null,
    ...overrides,
  }
}

test.describe("Mask Flow v2", () => {
  test("binary gate returns no mask need for natural hair without active signals", () => {
    const decision = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["natural"],
        heat_styling: "rarely",
        protein_moisture_balance: "stretches_bounces",
      }),
    )

    expect(decision.needs_mask).toBe(false)
    expect(decision.need_strength).toBe(0)
    expect(decision.mask_type).toBe("performance")
    expect(decision.active_signals).toEqual([])
  })

  test("single active signals each produce a yes with strength 1", () => {
    const chemicalOnly = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["colored"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_bounces",
      }),
    )
    const heatOnly = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["natural"],
        heat_styling: "daily",
        protein_moisture_balance: "stretches_bounces",
      }),
    )
    const balanceOnly = deriveMaskDecision(
      createProfile({
        chemical_treatment: ["natural"],
        heat_styling: "never",
        protein_moisture_balance: "snaps",
      }),
    )

    expect(chemicalOnly.needs_mask).toBe(true)
    expect(chemicalOnly.need_strength).toBe(1)
    expect(chemicalOnly.active_signals).toEqual(["chemical_treatment"])

    expect(heatOnly.needs_mask).toBe(true)
    expect(heatOnly.need_strength).toBe(1)
    expect(heatOnly.active_signals).toEqual(["heat_styling"])

    expect(balanceOnly.needs_mask).toBe(true)
    expect(balanceOnly.need_strength).toBe(1)
    expect(balanceOnly.active_signals).toEqual(["protein_moisture_balance"])
  })

  test("protein moisture balance maps to the correct mask type", () => {
    expect(deriveMaskDecision(createProfile({ protein_moisture_balance: "snaps" })).mask_type).toBe(
      "moisture",
    )

    expect(
      deriveMaskDecision(createProfile({ protein_moisture_balance: "stretches_stays" })).mask_type,
    ).toBe("protein")

    expect(
      deriveMaskDecision(createProfile({ protein_moisture_balance: "stretches_bounces" }))
        .mask_type,
    ).toBe("performance")
  })

  test("strength 1 prefers low concentration, strength 2 medium, strength 3 high", () => {
    const candidates = [
      createCandidate("low"),
      createCandidate("medium", { sort_order: 2 }),
      createCandidate("high", { sort_order: 3 }),
    ]
    const specs = [
      createSpec("low", { concentration: "low" }),
      createSpec("medium", { concentration: "medium" }),
      createSpec("high", { concentration: "high" }),
    ]

    const strength1 = rerankMaskProducts(
      candidates,
      specs,
      createProfile({
        thickness: "normal",
        chemical_treatment: ["natural"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_stays",
      }),
    )
    const strength2 = rerankMaskProducts(
      candidates,
      specs,
      createProfile({
        thickness: "normal",
        chemical_treatment: ["colored"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_stays",
      }),
    )
    const strength3 = rerankMaskProducts(
      candidates,
      specs,
      createProfile({
        thickness: "normal",
        chemical_treatment: ["colored"],
        heat_styling: "daily",
        protein_moisture_balance: "stretches_stays",
      }),
    )

    expect(strength1[0]?.id).toBe("low")
    expect(strength2[0]?.id).toBe("medium")
    expect(strength3[0]?.id).toBe("high")
  })

  test("higher need strength does not override fine-hair weight constraints", () => {
    const results = rerankMaskProducts(
      [
        createCandidate("light"),
        createCandidate("medium", { sort_order: 2 }),
        createCandidate("rich", { sort_order: 3 }),
      ],
      [
        createSpec("light", { weight: "light", concentration: "high" }),
        createSpec("medium", { weight: "medium", concentration: "high" }),
        createSpec("rich", { weight: "rich", concentration: "high" }),
      ],
      createProfile({
        thickness: "fine",
        chemical_treatment: ["bleached"],
        heat_styling: "daily",
        protein_moisture_balance: "stretches_stays",
      }),
    )

    expect(results.map((product) => product.id)).toEqual(["light", "medium"])
    expect(results.some((product) => product.id === "rich")).toBe(false)
  })

  test("normal hair prefers medium weight, coarse hair prefers rich with medium fallback", () => {
    const candidates = [
      createCandidate("light"),
      createCandidate("medium", { sort_order: 2 }),
      createCandidate("rich", { sort_order: 3 }),
    ]
    const specs = [
      createSpec("light", { weight: "light", concentration: "low" }),
      createSpec("medium", { weight: "medium", concentration: "low" }),
      createSpec("rich", { weight: "rich", concentration: "low" }),
    ]

    const normalResults = rerankMaskProducts(
      candidates,
      specs,
      createProfile({
        thickness: "normal",
        chemical_treatment: ["natural"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_stays",
      }),
    )
    const coarseResults = rerankMaskProducts(
      candidates,
      specs,
      createProfile({
        thickness: "coarse",
        chemical_treatment: ["natural"],
        heat_styling: "never",
        protein_moisture_balance: "stretches_stays",
      }),
    )

    expect(normalResults[0]?.id).toBe("medium")
    expect(coarseResults[0]?.id).toBe("rich")
    expect(coarseResults[1]?.id).toBe("medium")
  })

  test("mask concern search order falls back only to performance", () => {
    expect(buildMaskConcernSearchOrder("protein")).toEqual(["protein", "performance"])
    expect(buildMaskConcernSearchOrder("moisture")).toEqual(["feuchtigkeit", "performance"])
    expect(buildMaskConcernSearchOrder("performance")).toEqual(["performance"])
  })

  test("ignored fields do not change the mask decision", () => {
    const baseProfile = createProfile({
      chemical_treatment: ["bleached"],
      heat_styling: "daily",
      protein_moisture_balance: "snaps",
    })
    const noisyProfile = createProfile({
      chemical_treatment: ["bleached"],
      heat_styling: "daily",
      protein_moisture_balance: "snaps",
      concerns: ["frizz", "dryness"],
      hair_texture: "coily",
      wash_frequency: "daily",
      styling_tools: ["flat_iron", "curling_iron"],
      routine_preference: "minimal",
      cuticle_condition: "rough",
    })

    expect(deriveMaskDecision(noisyProfile)).toEqual(deriveMaskDecision(baseProfile))
  })
})
