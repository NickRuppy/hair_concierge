import assert from "node:assert/strict"
import test from "node:test"

import { shapeRoutineForUi } from "../src/lib/routines/shape-for-ui"
import type { CareBalanceRow, InventoryCategory } from "../src/lib/recommendation-engine/types"
import type { RoutineArtifactUsageRow } from "../src/lib/routines/types"
import type { ProductFrequency } from "../src/lib/vocabulary"

function careRow(
  category: InventoryCategory,
  overrides: Partial<CareBalanceRow> = {},
): CareBalanceRow {
  return {
    category,
    present: true,
    currentFrequency: "weekly_1x",
    primaryStatus: "matched",
    recommendation: "keep",
    recommendationStrength: "medium",
    confidence: "high",
    decisiveReasonCodes: [],
    contextReasonCodes: [],
    cadencePolicy: { kind: "not_applicable" },
    frequencyTarget: {
      minFrequency: "weekly_1x",
      maxFrequency: "weekly_2x",
      preferredFrequency: "weekly_1x",
      delta: "in_range",
    },
    selectionHints: [],
    ...overrides,
  }
}

function usageRow(
  category: string,
  overrides: Partial<RoutineArtifactUsageRow> = {},
): RoutineArtifactUsageRow {
  return {
    id: `usage-${category}`,
    user_id: "user-1",
    category,
    brand_text: null,
    product_name: `${category} raw`,
    frequency_range: "weekly_1x",
    product_id: null,
    product_submission_id: null,
    match_status: "text_only",
    intake_method: null,
    source: "onboarding",
    front_image_path: null,
    created_at: "2026-07-06T10:00:00.000Z",
    updated_at: "2026-07-06T10:00:00.000Z",
    product: null,
    ...overrides,
  }
}

test("shapeRoutineForUi derives card kinds from usage status and CareBalance frequencyTarget", () => {
  const conditionerTarget = {
    minFrequency: "weekly_2x" as ProductFrequency,
    maxFrequency: "weekly_3_4x" as ProductFrequency,
    preferredFrequency: "weekly_2x" as ProductFrequency,
    delta: "below" as const,
  }
  const shaped = shapeRoutineForUi({
    hairProfile: null,
    usageRows: [
      usageRow("conditioner", {
        product_id: "prod-conditioner",
        match_status: "matched",
        product: {
          id: "prod-conditioner",
          name: "Repair Conditioner",
          brand: "Brand fallback",
          category: "conditioner",
          brand_identity: { id: "brand-1", canonical_name: "Example Brand" },
          product_line_id: "line-1",
          product_line_name: "Repair Line",
          affiliate_link: "https://example.test/conditioner",
          image_url: "https://example.test/conditioner.jpg",
          price_eur: 12.95,
          currency: "EUR",
          is_active: true,
          lifecycle_status: "active",
          is_chaarlie_recommended: true,
        },
      }),
      usageRow("mask", {
        product_submission_id: "sub-mask",
        match_status: "pending_review",
        product_name: "Mystery Mask",
      }),
      usageRow("oil", {
        match_status: "text_only",
        product_name: "Mein Haaröl",
      }),
      usageRow("heat_protectant", {
        product_id: "prod-heat",
        match_status: "matched",
        product: {
          id: "prod-heat",
          name: "Altes Hitzeschutzspray",
          brand: "Example Brand",
          category: "heat_protectant",
          affiliate_link: null,
          image_url: null,
          price_eur: null,
          currency: "EUR",
          is_active: false,
          lifecycle_status: "discontinued",
          is_chaarlie_recommended: false,
        },
      }),
      usageRow("shampoo", {
        product_name: "__system_no_shampoo_selected__",
        frequency_range: "less_than_monthly",
      }),
    ],
    careBalanceRows: [
      careRow("conditioner", {
        recommendation: "increase_frequency",
        primaryStatus: "underused",
        frequencyTarget: conditionerTarget,
      }),
      careRow("mask"),
      careRow("oil", {
        recommendation: "keep",
        primaryStatus: "matched",
      }),
      careRow("heat_protectant", {
        recommendation: "keep",
        primaryStatus: "matched",
      }),
      careRow("shampoo", {
        present: false,
        currentFrequency: null,
        recommendation: "add",
        primaryStatus: "missing_needed",
        frequencyTarget: {
          minFrequency: "weekly_2x",
          maxFrequency: "weekly_3_4x",
          preferredFrequency: "weekly_2x",
          delta: "below",
        },
      }),
      careRow("deep_cleansing_shampoo", {
        recommendation: "decrease_frequency",
        primaryStatus: "safety_caution",
      }),
    ],
    pendingSubmissionsById: new Map([
      [
        "sub-mask",
        {
          id: "sub-mask",
          status: "pending_review",
          user_facing_resolution_reason: null,
          user_facing_next_step: "Wir prüfen dein Produkt.",
          user_facing_missing_fields: ["INCI"],
          front_image_path: "front/mask.jpg",
          created_at: "2026-07-06T10:05:00.000Z",
        },
      ],
    ]),
  })

  const conditioner = shaped.cards.find((card) => card.category === "conditioner")
  assert.equal(conditioner?.kind, "verified_more_freq")
  assert.equal(conditioner?.tone, "green")
  assert.equal(conditioner?.hasProductDrawer, true)
  assert.deepEqual(conditioner?.frequencyTarget, conditionerTarget)
  assert.equal(conditioner?.product?.brand, "Example Brand")
  assert.equal(conditioner?.product?.product_line_name, "Repair Line")
  assert.equal(conditioner?.product?.image_url, "https://example.test/conditioner.jpg")
  assert.equal(conditioner?.product?.affiliate_link, "https://example.test/conditioner")
  assert.equal(conditioner?.product?.price_eur, 12.95)
  assert.equal(conditioner?.product?.lifecycle_status, "active")
  assert.equal(conditioner?.product?.is_chaarlie_recommended, true)

  const pending = shaped.cards.find((card) => card.category === "mask")
  assert.equal(pending?.kind, "pending")
  assert.equal(pending?.tone, "neutral")
  assert.equal(pending?.pendingSubmission?.front_image_path, "front/mask.jpg")
  assert.deepEqual(pending?.pendingSubmission?.user_facing_missing_fields, ["INCI"])

  const textOnly = shaped.cards.find((card) => card.category === "oil")
  assert.equal(textOnly?.kind, "verified_matches")
  assert.equal(textOnly?.isLegacyTextOnly, true)
  assert.equal(textOnly?.hasProductDrawer, false)
  assert.equal(textOnly?.tone, "neutral")
  assert.equal(textOnly?.product, null)

  const swap = shaped.cards.find((card) => card.category === "heat_protectant")
  assert.equal(swap?.kind, "verified_swap")
  assert.equal(swap?.hasProductDrawer, true)

  const shampoo = shaped.cards.find((card) => card.category === "shampoo")
  assert.equal(shampoo?.kind, "suggestion")
  assert.equal(shampoo?.isTopProposal, true)
  assert.equal(shampoo?.hasProductDrawer, false)
  assert.equal(shampoo?.productName, null)

  const caution = shaped.cards.find((card) => card.category === "deep_cleansing_shampoo")
  assert.equal(caution?.kind, "verified_unnecessary")
  assert.equal(caution?.tone, "yellow")
})

test("shapeRoutineForUi fails loudly when a suggestion is missing a frequencyTarget", () => {
  assert.throws(
    () =>
      shapeRoutineForUi({
        hairProfile: null,
        usageRows: [],
        careBalanceRows: [
          careRow("leave_in", {
            present: false,
            currentFrequency: null,
            recommendation: "add",
            primaryStatus: "missing_needed",
            frequencyTarget: null,
          }),
        ],
        pendingSubmissionsById: new Map(),
      }),
    /CareBalance target task is incomplete: leave_in is missing frequencyTarget/,
  )
})

test("shapeRoutineForUi hides actively dismissed category suggestions", () => {
  const shaped = shapeRoutineForUi({
    hairProfile: null,
    usageRows: [],
    careBalanceRows: [
      careRow("leave_in", {
        present: false,
        currentFrequency: null,
        recommendation: "add",
        primaryStatus: "missing_needed",
      }),
      careRow("mask", {
        present: false,
        currentFrequency: null,
        recommendation: "add",
        primaryStatus: "missing_needed",
      }),
    ],
    pendingSubmissionsById: new Map(),
    activeDismissedCategories: new Set(["leave_in"]),
  })

  assert.equal(
    shaped.cards.some((card) => card.category === "leave_in"),
    false,
  )
  assert.equal(
    shaped.cards.some((card) => card.category === "mask"),
    true,
  )
})
