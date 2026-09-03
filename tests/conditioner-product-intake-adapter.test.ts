import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  conditionerFormulaFingerprintSha256,
  type ConditionerResearchEnvelope,
} from "../src/lib/conditioner-research/production-adapter"
import { applyConditionerResearchAdapter } from "../src/lib/product-intake/conditioner-research-adapter"
import { conditionerResearchPromptContract } from "../src/lib/product-intake/conditioner-research-prompt-contract"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Formula-specific rationale for ${JSON.stringify(value)}.`,
  evidenceSignals: ["Cetearyl Alcohol (INCI #2)"],
  derivation: "Conditioner Standard v1.6 derivation.",
  thresholdReasoning: ["Selected threshold is met.", "The adjacent alternative is not met."],
  limitations: ["E2 formula potential only."],
})

function envelope(): ConditionerResearchEnvelope {
  const rawInci = "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin"
  return {
    version: "conditioner-research-envelope-v1.6",
    researchMethod: { ...CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "submission-1",
      market: "DE/EU",
      exactProductName: "New Moisture Conditioner",
      categoryBoundaryStatus: "eligible",
      confidence: "high",
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified_with_minor_difference",
      rawInci,
      normalizedIngredients: rawInci.split(",").map((item) => item.trim()),
      formulaFingerprintSha256: conditionerFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product", "retailer:confirmation"],
    },
    profile: {
      conditioningLevel: evidence("moderate"),
      weightPotential: evidence("low"),
      careDirection: evidence("moisture"),
      repairSupportLevel: evidence("low"),
      primaryFocus: evidence("general"),
      secondaryFocus: evidence(["detangling"]),
      hairThicknessFit: evidence(["fine", "medium"]),
      damageFit: evidence(["healthy", "moderately_damaged"]),
      textureFit: evidence(["straight", "wavy"]),
      uncertainFields: [],
      assumptionNotes: [],
    },
  }
}

test("Product Intake retains the full research artifact and replaces handwritten specs", () => {
  const fullEnvelope = envelope()
  const final = {
    product: { category_key: "conditioner", suitable_thicknesses: ["coarse"] },
    category_specs: {
      product_conditioner_specs: [
        { thickness: "coarse", protein_moisture_balance: "stretches_stays" },
      ],
      product_conditioner_rerank_specs: {
        weight: "rich",
        repair_level: "high",
        balance_direction: "protein",
        ingredient_flags: ["proteins"],
      },
      product_application_protocols: [{ role: "conditioner_rinse_out" }],
    },
    field_rationales: {
      "product.clean_name": "Unrelated identity rationale remains.",
      "category_specs.product_conditioner_specs[9]": "Stale model rationale.",
      "category_specs.product_conditioner_rerank_specs.weight": "Stale weight rationale.",
    },
  }
  const artifacts = [
    {
      kind: "property_synthesis",
      payload: { conditioner_research_envelope: fullEnvelope },
    },
  ]

  const result = applyConditionerResearchAdapter({ final, artifacts })

  assert.deepEqual(result.blockers, [])
  assert.deepEqual(final.product.suitable_thicknesses, ["fine", "normal"])
  assert.deepEqual(final.category_specs.product_conditioner_specs, [
    { thickness: "fine", protein_moisture_balance: "snaps" },
    { thickness: "normal", protein_moisture_balance: "snaps" },
  ])
  assert.deepEqual(final.category_specs.product_conditioner_rerank_specs, {
    weight: "light",
    repair_level: "low",
    balance_direction: "moisture",
    ingredient_flags: ["humectants"],
  })
  const fieldRationales = final.field_rationales as Record<string, string>
  assert.equal(fieldRationales["product.clean_name"], "Unrelated identity rationale remains.")
  assert.equal(fieldRationales["category_specs.product_conditioner_specs[9]"], undefined)
  assert.match(
    fieldRationales["category_specs.product_conditioner_rerank_specs"],
    /deterministic presence signals/i,
  )
  assert.notEqual(
    fieldRationales["category_specs.product_conditioner_rerank_specs.weight"],
    "Stale weight rationale.",
  )
  assert.deepEqual(
    artifacts[0].payload.conditioner_research_envelope,
    fullEnvelope,
    "the durable full research record must remain intact",
  )
  assert.equal(
    (artifacts[0].payload as Record<string, unknown>).conditioner_production_projection != null,
    true,
  )
  assert.equal(final.category_specs.product_application_protocols[0].role, "conditioner_rinse_out")
})

test("Product Intake refuses a valid envelope from another submission", () => {
  const final = {
    product: { category_key: "conditioner", suitable_thicknesses: ["coarse"] },
    category_specs: {
      product_conditioner_specs: [
        { thickness: "coarse", protein_moisture_balance: "stretches_stays" },
      ],
      product_conditioner_rerank_specs: {
        weight: "rich",
        repair_level: "high",
        balance_direction: "protein",
        ingredient_flags: ["proteins"],
      },
    },
    field_rationales: {},
  }
  const artifacts = [
    {
      kind: "property_synthesis",
      payload: { conditioner_research_envelope: envelope() },
    },
  ]

  const result = applyConditionerResearchAdapter({
    final,
    artifacts,
    expectedResearchId: "submission-2",
  })

  assert.match(result.blockers.join(" "), /must match Product Intake submission/i)
  assert.deepEqual(final.product.suitable_thicknesses, ["coarse"])
  assert.equal(
    (artifacts[0].payload as Record<string, unknown>).conditioner_production_projection,
    undefined,
  )
})

test("Product Intake blocks a Conditioner result without the full research envelope", () => {
  const result = applyConditionerResearchAdapter({
    final: { product: {}, category_specs: {}, field_rationales: {} },
    artifacts: [],
  })

  assert.match(result.blockers.join(" "), /conditioner_research_envelope/i)
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
      payload: { conditioner_research_envelope: envelope() },
    },
  ]

  const result = applyConditionerResearchAdapter({ final, artifacts })

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
  const contract = conditionerResearchPromptContract()

  assert.equal(contract.engine.required_artifact.payload_key, "conditioner_research_envelope")
  assert.equal(contract.engine.envelope_version, "conditioner-research-envelope-v1.6")
  assert.deepEqual(contract.engine.envelope_contract.eligible_top_level_keys, [
    "version",
    "researchMethod",
    "identity",
    "formula",
    "profile",
  ])
  assert.equal(contract.engine.envelope_contract.identity.researchId, "prompt packet submission_id")
  assert.deepEqual(contract.engine.envelope_contract.formula.status, [
    "verified",
    "verified_with_minor_difference",
    "provisional_conflict",
    "insufficient",
  ])
  assert.equal(contract.adapter.version, "conditioner-production-adapter-v1")
  assert.match(contract.adapter.behavior, /Do not hand-author/)
  assert.deepEqual(contract.engine.removed_headline_fields, [
    "rinseability",
    "usage_role",
    "scalp_application_fit",
  ])
})
