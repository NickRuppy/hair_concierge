import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  leaveInFormulaFingerprintSha256,
  normalizeLeaveInInciForFingerprint,
  type LeaveInResearchEnvelope,
} from "../src/lib/leave-in-research/production-adapter"
import { applyLeaveInResearchAdapter } from "../src/lib/product-intake/leave-in-research-adapter"
import { leaveInResearchPromptContract } from "../src/lib/product-intake/leave-in-research-prompt-contract"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Formula-specific rationale for ${JSON.stringify(value)}.`,
  evidenceSignals: ["Behentrimonium Chloride (INCI #3)"],
  derivation: "Leave-In Standard v1.0 derivation.",
  thresholdReasoning: ["Selected threshold is met.", "The adjacent alternative is not met."],
  limitations: ["E2 formula potential only."],
})

function envelope(): LeaveInResearchEnvelope {
  const rawInci = "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Panthenol"
  const normalizedIngredients = normalizeLeaveInInciForFingerprint(rawInci).split(", ")
  return {
    version: "leave-in-research-envelope-v1.0",
    researchMethod: { ...LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "submission-1",
      market: "DE/EU",
      exactProductName: "New Leave-In Spray",
      brand: "TestBrand",
      gtin: null,
      productForm: "spray",
      applicationStage: ["towel_dry"],
      identityStatus: "verified",
      categoryBoundaryStatus: "eligible",
      confidence: "high",
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified",
      rawInci,
      normalizedIngredients,
      formulaFingerprintSha256: leaveInFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product", "retailer:confirmation"],
    },
    profile: {
      conditioningLevel: evidence("moderate"),
      weightPotential: evidence("low"),
      persistence: evidence("moderate"),
      holdSupport: evidence("none"),
      careDirection: evidence("moisture"),
      repairSupportLevel: evidence("low"),
      focus: evidence({ primary: "detangling" as const, secondary: ["shine" as const] }),
      specialistFunctions: evidence({ providesHeatProtection: false }),
      smoothingRoute: evidence("none"),
      hairThicknessFit: evidence({
        fine: "recommended" as const,
        medium: "recommended" as const,
        coarse: "conditional" as const,
      }),
      damageFit: evidence({
        healthy: "recommended" as const,
        moderately_damaged: "recommended" as const,
        highly_damaged: "conditional" as const,
      }),
      textureFit: evidence({
        straight: "recommended" as const,
        wavy: "recommended" as const,
        curly: "conditional" as const,
        coily: "conditional" as const,
      }),
      uncertainFields: [],
      assumptionNotes: [],
    },
  }
}

test("Product Intake retains the full research artifact and replaces handwritten specs", () => {
  const fullEnvelope = envelope()
  const final = {
    product: { category_key: "leave_in", suitable_thicknesses: ["coarse"] },
    category_specs: {
      product_leave_in_specs: { format: "cream", weight: "rich", roles: ["oil_replacement"] },
      product_leave_in_fit_specs: {
        weight: "rich",
        conditioner_relationship: "booster_only",
        care_benefits: ["repair"],
      },
      product_leave_in_eligibility: [
        { thickness: "coarse", need_bucket: "repair", styling_context: "heat_style" },
      ],
      product_application_protocols: [{ role: "post_wash_leave_in" }],
    },
    field_rationales: {
      "product.clean_name": "Unrelated identity rationale remains.",
      "product.suitable_thicknesses": "Stale thickness rationale.",
      "category_specs.product_leave_in_specs": "Stale specs rationale.",
      "category_specs.product_leave_in_specs.format": "Stale format rationale.",
      "category_specs.product_leave_in_fit_specs": "Stale fit rationale.",
      "category_specs.product_leave_in_fit_specs.care_benefits":
        "Stale fit care benefits rationale.",
      "category_specs.product_leave_in_eligibility": "Stale eligibility rationale.",
      "category_specs.product_leave_in_eligibility[99]":
        "Stale eligibility row rationale that no longer exists.",
    },
  }
  const artifacts = [
    {
      kind: "property_synthesis",
      payload: { leave_in_research_envelope: fullEnvelope },
    },
  ]

  const result = applyLeaveInResearchAdapter({ final, artifacts })

  assert.deepEqual(result.blockers, [])
  assert.deepEqual(final.product.suitable_thicknesses, ["fine", "normal"])

  const specs = final.category_specs.product_leave_in_specs as Record<string, unknown>
  assert.equal(specs.format, "spray")
  assert.equal(specs.weight, "light")
  assert.deepEqual(specs.roles, ["replacement_conditioner"])
  assert.equal(specs.provides_heat_protection, false)
  assert.equal(specs.heat_protection_max_c, null)
  assert.equal(specs.heat_activation_required, false)
  assert.deepEqual(specs.care_benefits, ["moisture", "detangling", "shine"])
  assert.deepEqual(specs.ingredient_flags, ["humectants"])
  assert.deepEqual(specs.application_stage, ["towel_dry"])
  assert.equal(specs.care_direction, "moisture")
  assert.equal(specs.repair_support_level, "low")
  assert.deepEqual(specs.plan_roles, ["post_wash_leave_in"])
  assert.deepEqual(specs.functional_benefits, ["detangle", "moisture_softness", "shine_support"])

  const fitSpecs = final.category_specs.product_leave_in_fit_specs as Record<string, unknown>
  assert.equal(fitSpecs.weight, "light")
  assert.equal(fitSpecs.conditioner_relationship, "replacement_capable")
  assert.deepEqual(fitSpecs.care_benefits, ["detangle_smooth"])

  const eligibility = final.category_specs.product_leave_in_eligibility as Array<
    Record<string, unknown>
  >
  assert.equal(eligibility.length, 8)
  assert.ok(eligibility.every((row) => row.thickness === "fine" || row.thickness === "normal"))
  assert.ok(
    eligibility.some(
      (row) =>
        row.thickness === "fine" &&
        row.need_bucket === "moisture_anti_frizz" &&
        row.styling_context === "air_dry",
    ),
  )

  // Unrelated, non-adapter-owned category_specs table is left alone.
  assert.deepEqual(final.category_specs.product_application_protocols, [
    { role: "post_wash_leave_in" },
  ])

  const fieldRationales = final.field_rationales as Record<string, string>
  assert.equal(fieldRationales["product.clean_name"], "Unrelated identity rationale remains.")
  assert.notEqual(fieldRationales["product.suitable_thicknesses"], "Stale thickness rationale.")
  assert.notEqual(
    fieldRationales["category_specs.product_leave_in_specs"],
    "Stale specs rationale.",
  )
  assert.match(fieldRationales["category_specs.product_leave_in_specs.format"], /AD-1/)
  assert.notEqual(
    fieldRationales["category_specs.product_leave_in_fit_specs.care_benefits"],
    "Stale fit care benefits rationale.",
  )
  assert.equal(fieldRationales["category_specs.product_leave_in_eligibility[99]"], undefined)

  assert.deepEqual(
    artifacts[0].payload.leave_in_research_envelope,
    fullEnvelope,
    "the durable full research record must remain intact",
  )
  const projectionArtifactPayload = artifacts[0].payload as Record<string, unknown>
  assert.equal(projectionArtifactPayload.leave_in_production_projection != null, true)
  assert.deepEqual(projectionArtifactPayload.required_protocol_roles, ["post_wash_leave_in"])
  assert.deepEqual(projectionArtifactPayload.omitted_research_properties, [
    "persistence_removal_class_detail",
    "hold_route_detail_beyond_three_state",
    "smoothing_route_detail",
    "damage_fit",
    "texture_fit",
    "cautions_de",
    "hinweise",
    "tail_marker_trace",
    "assumption_notes",
  ])
})

test("Product Intake refuses a valid envelope from another submission", () => {
  const final = {
    product: { category_key: "leave_in", suitable_thicknesses: ["coarse"] },
    category_specs: {
      product_leave_in_specs: { format: "cream", weight: "rich", roles: ["oil_replacement"] },
      product_leave_in_fit_specs: {
        weight: "rich",
        conditioner_relationship: "booster_only",
        care_benefits: ["repair"],
      },
      product_leave_in_eligibility: [
        { thickness: "coarse", need_bucket: "repair", styling_context: "heat_style" },
      ],
    },
    field_rationales: {},
  }
  const artifacts = [
    {
      kind: "property_synthesis",
      payload: { leave_in_research_envelope: envelope() },
    },
  ]

  const result = applyLeaveInResearchAdapter({
    final,
    artifacts,
    expectedResearchId: "submission-2",
  })

  assert.match(result.blockers.join(" "), /must match Product Intake submission/i)
  assert.deepEqual(final.product.suitable_thicknesses, ["coarse"])
  assert.equal(
    (artifacts[0].payload as Record<string, unknown>).leave_in_production_projection,
    undefined,
  )
})

test("Product Intake blocks a Leave-In result without the full research envelope", () => {
  const result = applyLeaveInResearchAdapter({
    final: { product: {}, category_specs: {}, field_rationales: {} },
    artifacts: [],
  })

  assert.match(result.blockers.join(" "), /leave_in_research_envelope/i)
})

test("Product Intake rebuilds only malformed adapter-owned containers", () => {
  const final: Record<string, unknown> = {
    product: "invalid",
    category_specs: [],
    field_rationales: "invalid",
    sources: [{ id: "manufacturer:product" }],
  }
  const artifacts = [
    {
      kind: "property_synthesis",
      payload: { leave_in_research_envelope: envelope() },
    },
  ]

  const result = applyLeaveInResearchAdapter({ final, artifacts })

  assert.deepEqual(result.blockers, [])
  assert.deepEqual((final.product as Record<string, unknown>).suitable_thicknesses, [
    "fine",
    "normal",
  ])
  assert.equal(Array.isArray(final.category_specs), false)
  assert.equal(typeof final.field_rationales, "object")
  assert.deepEqual(final.sources, [{ id: "manufacturer:product" }])
})

test("Product Intake prompt requires full research before deterministic projection", () => {
  const contract = leaveInResearchPromptContract()

  assert.equal(contract.engine.required_artifact.payload_key, "leave_in_research_envelope")
  assert.equal(contract.engine.envelope_version, "leave-in-research-envelope-v1.0")
  assert.deepEqual(contract.engine.envelope_contract.eligible_top_level_keys, [
    "version",
    "researchMethod",
    "identity",
    "formula",
    "profile",
    "legacyComparison",
  ])
  assert.equal(contract.engine.envelope_contract.identity.researchId, "prompt packet submission_id")
  assert.deepEqual(contract.engine.envelope_contract.formula.status, [
    "verified",
    "verified_with_minor_difference",
    "provisional_conflict",
    "insufficient",
  ])
  assert.equal(contract.adapter.version, "leave-in-production-adapter-v1")
  assert.match(contract.adapter.behavior, /Do not hand-author/)
  // Fix 4: the property_synthesis artifact, not the trimmed envelope alone,
  // is the durable carrier of the complete research record.
  assert.match(contract.adapter.durable_carrier_rule, /property_synthesis research artifact/)
  assert.match(contract.adapter.durable_carrier_rule, /projection inputs only/)
  assert.match(contract.adapter.durable_carrier_rule, /Hinweise record \(even when empty\)/)
  assert.deepEqual(contract.adapter.retained_research_only_fields, [
    "persistence_removal_class_detail",
    "hold_route_detail_beyond_three_state",
    "smoothing_route_detail",
    "damage_fit",
    "texture_fit",
    "cautions_de",
    "hinweise",
    "tail_marker_trace",
    "assumption_notes",
  ])
})
