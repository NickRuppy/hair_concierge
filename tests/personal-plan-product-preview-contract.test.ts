import assert from "node:assert/strict"
import test from "node:test"

import { isStage1ProductExamplePreviewResponse } from "../src/lib/personal-plan/product-preview-contract"

function baseResponse(previews: unknown[]) {
  return {
    schemaVersion: 2,
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    sourceInputHash: "input-1",
    directAcceptance: { available: true },
    previews,
  }
}

function recommendation(overrides: Record<string, unknown> = {}) {
  return {
    kind: "recommendation",
    category: "shampoo",
    role: "shampoo_everyday",
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    productId: "product-1",
    productName: "Produkt 1",
    imageUrl: "https://example.com/product-1.webp",
    verdict: "ideal",
    authorityVersion: "personal-plan.shampoo.v4",
    factFingerprint: "facts-1",
    commerce: {
      priceEur: null,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: null,
      netContentLabel: null,
      availabilityLabel: "Aktuelle Verfügbarkeit nicht bestätigt",
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "x", fit: "y", frequency: "z" },
    ...overrides,
  }
}

function fallback(overrides: Record<string, unknown> = {}) {
  return {
    kind: "fallback",
    category: "shampoo",
    role: "shampoo_everyday",
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    authorityVersion: "personal-plan.shampoo.v4",
    fallback: "post_refinement",
    ...overrides,
  }
}

test("accepts a schema-v2 response mixing recommendation and fallback role previews", () => {
  assert.equal(
    isStage1ProductExamplePreviewResponse(baseResponse([recommendation(), fallback()])),
    true,
  )
})

test("rejects a schema-v1 response", () => {
  assert.equal(
    isStage1ProductExamplePreviewResponse({ ...baseResponse([]), schemaVersion: 1 }),
    false,
  )
})

test("rejects a recommendation entry missing commerce or reasoning", () => {
  const { commerce: _commerce, ...withoutCommerce } = recommendation()
  assert.equal(isStage1ProductExamplePreviewResponse(baseResponse([withoutCommerce])), false)
  const { reasoning: _reasoning, ...withoutReasoning } = recommendation()
  assert.equal(isStage1ProductExamplePreviewResponse(baseResponse([withoutReasoning])), false)
})

test("rejects a fallback entry with the wrong fallback reason", () => {
  assert.equal(
    isStage1ProductExamplePreviewResponse(baseResponse([fallback({ fallback: "other" })])),
    false,
  )
})

test("rejects a role that is not allowed for its category", () => {
  assert.equal(
    isStage1ProductExamplePreviewResponse(
      baseResponse([recommendation({ role: "intensive_conditioning_mask" })]),
    ),
    false,
  )
})

test("rejects an authority version that does not match the category's current policy", () => {
  assert.equal(
    isStage1ProductExamplePreviewResponse(
      baseResponse([recommendation({ authorityVersion: "stale-version" })]),
    ),
    false,
  )
})
