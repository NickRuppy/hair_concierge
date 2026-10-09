import assert from "node:assert/strict"
import test from "node:test"

import type { ProductIntakeReviewCategoryKey } from "../src/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "../src/lib/product-intake/review-workflow"

function reviewedPayload(category: ProductIntakeReviewCategoryKey, specs: Record<string, unknown>) {
  return {
    final: {
      product: {
        canonical_brand: "Fixture",
        clean_name: "Pflegemaske",
        category_key: category,
        affiliate_link: "https://example.test/product",
        image_url: null,
        price_eur: 9.95,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-10-05T12:00:00Z",
        price_checked_at: "2026-10-05T12:00:00Z",
      },
      category_specs: specs,
      sources: [
        { url: "https://example.test/product", title: "Hersteller", evidence: "Anleitung." },
      ],
      field_rationales: Object.fromEntries(
        [
          "product.canonical_brand",
          "product.clean_name",
          "product.category_key",
          "product.affiliate_link",
          "product.image_url",
          "product.price_eur",
          "product.purchase_link_status",
          ...Object.keys(specs).map((table) => `category_specs.${table}`),
        ].map((path) => [path, "Durch Herstellerquelle belegt."]),
      ),
      review: { manual_reviewed: true },
    },
  }
}

function dryRun(category: ProductIntakeReviewCategoryKey, specs: Record<string, unknown>) {
  return dryRunProductIntakeReadyForReview({
    id: "readiness-gap",
    category,
    researched_payload: reviewedPayload(category, specs),
  })
}

function maskSpecs() {
  return {
    product_mask_specs: {
      weight: "medium",
      concentration: "high",
      balance_direction: "moisture",
      ingredient_flags: ["humectants"],
      repair_support_level: "medium",
      functional_benefits: ["shine"],
    },
  }
}

function currentProtocol() {
  return {
    category: "mask",
    role: "intensive_conditioning_mask",
    cadence: null,
    application_stage: "after_shampoo",
    application_state: "damp",
    placement: "lengths_ends",
    contact_time_seconds: 180,
    rinse_action: "rinse_out",
    reapplication: "not_stated",
    instruction_modifiers: [],
    source_label: "Hersteller",
    source_url: "https://example.test/product",
    source_text: "In die Längen geben, drei Minuten einwirken lassen und ausspülen.",
    guidance_payload: {
      schemaVersion: 1,
      guidanceKey: "fixture-mask",
      protocolVersion: 1,
      locale: "de",
      scope: { kind: "product", category: "mask", productId: "__PRODUCT_ID__" },
      role: "intensive_care",
      applicationFamily: "post_shampoo_rinse_out_mask",
      compatibleDayTypes: ["wash_day"],
      exactGuidanceRequired: true,
      sequence: { anchor: "post_cleanse_rinse_off", before: [], after: [], conflictsWith: [] },
      requirements: {
        requiredCatalogFacts: [],
        requiredProtocolFacts: [],
        requiredProfileFacts: [],
      },
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "rinse_out",
        contactTimeSeconds: 180,
        conditionerRelationship: "replaces_conditioner",
        reapplication: "none",
        amount: null,
        cautions: [],
      },
      steps: [
        { stepKey: "apply", action: "apply_product", copyTemplateDe: "In die Längen geben." },
        { stepKey: "wait", action: "wait", copyTemplateDe: "Drei Minuten einwirken lassen." },
        { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
      ],
      evidence: [
        {
          sourceUrl: "https://example.test/product",
          sourceType: "manufacturer",
          checkedAt: "2026-10-05",
        },
      ],
    },
  }
}

const requiredTables = {
  shampoo: ["product_shampoo_specs"],
  conditioner: ["product_conditioner_specs", "product_conditioner_rerank_specs"],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
  ],
  mask: ["product_mask_specs"],
  oil: ["product_oil_specs", "product_oil_eligibility"],
  dry_shampoo: ["product_dry_shampoo_specs"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs"],
  bondbuilder: ["product_bondbuilder_specs"],
  heat_protectant: ["product_heat_protectant_specs"],
  scalp_care: ["product_scalp_care_specs"],
} satisfies Record<ProductIntakeReviewCategoryKey, string[]>

test("readiness reports every absent or empty required table, including empty leave-in protocols", () => {
  for (const category of Object.keys(requiredTables) as ProductIntakeReviewCategoryKey[]) {
    const tables = [...requiredTables[category], "product_application_protocols"]
    for (const specs of [{}, Object.fromEntries(tables.map((table) => [table, []]))]) {
      const result = dryRun(category, specs)
      assert.equal(result.ok, false, category)
      assert.equal(result.status, "needs_more_info", category)
      assert.deepEqual(result.targetSpecOperations, [], category)
      assert.deepEqual(
        [...result.missingFields].sort(),
        tables.map((table) => `final.category_specs.${table}`).sort(),
        category,
      )
    }
  }
})

test("legacy mask protocol reports canonical guidance gaps and object contact time precisely", () => {
  const legacy = {
    ...currentProtocol(),
    source_text: "Wear gloves. Leave on for 3–5 minutes, then rinse.",
    contact_time_seconds: { color_refresh: { min: 180, max: 300 } },
    guidance_payload: { gloves: true, timing: "3–5 minutes" },
  }
  for (const specs of [maskSpecs(), { product_mask_specs: [] }]) {
    const result = dryRun("mask", { ...specs, product_application_protocols: [legacy] })
    assert.equal(result.ok, false)
    assert.deepEqual(result.targetSpecOperations, [])
    for (const path of [
      "contact_time_seconds",
      ...[
        "role",
        "scope",
        "steps",
        "protocolFacts",
        "guidanceKey",
        "protocolVersion",
        "locale",
      ].map((field) => `guidance_payload.${field}`),
    ]) {
      assert.ok(
        result.missingFields.includes(
          `final.category_specs.product_application_protocols.0.${path}`,
        ),
        `${path}: ${result.missingFields.join(", ")}`,
      )
    }
  }
})

test("every category reports the same precise legacy protocol shape errors even with missing specs", () => {
  for (const category of Object.keys(requiredTables) as ProductIntakeReviewCategoryKey[]) {
    const result = dryRun(category, {
      product_application_protocols: [
        {
          ...currentProtocol(),
          category,
          contact_time_seconds: { min: 180, max: 300 },
          guidance_payload: { gloves: true, timing: "3–5 minutes" },
        },
      ],
    })
    assert.equal(result.ok, false, category)
    for (const field of [
      "contact_time_seconds",
      "guidance_payload.protocolFacts",
      "guidance_payload.locale",
    ]) {
      assert.ok(
        result.missingFields.includes(
          `final.category_specs.product_application_protocols.0.${field}`,
        ),
        `${category}: ${field}`,
      )
    }
  }
})

test("a complete mask with current German guidance and numeric or null contact time remains publishable", () => {
  for (const contactTime of [180, null]) {
    const result = dryRun("mask", {
      ...maskSpecs(),
      product_application_protocols: [{ ...currentProtocol(), contact_time_seconds: contactTime }],
    })
    assert.equal(result.ok, true, result.missingFields.join(", "))
    assert.equal(result.status, "ready_for_review")
    const operation = result.targetSpecOperations.find(
      (row) => row.table === "product_application_protocols",
    )
    assert.ok(operation)
    assert.equal(operation.rows[0]?.contact_time_seconds, contactTime)
    assert.equal(operation.rows[0]?.guidance_payload_v2?.schemaVersion, 2)
  }
})
