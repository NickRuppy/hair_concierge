import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  conditionerFormulaFingerprintSha256,
  projectConditionerForProduction,
  type ConditionerResearchEnvelope,
} from "../src/lib/conditioner-research/production-adapter"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `The reviewed formula supports ${JSON.stringify(value)}.`,
  evidenceSignals: ["Cetearyl Alcohol (INCI #2)", "Behentrimonium Chloride (INCI #3)"],
  derivation: "Applied Conditioner Standard v1.6 to the complete reviewed formula.",
  thresholdReasoning: [
    `The formula clears the selected ${JSON.stringify(value)} threshold.`,
    "The adjacent alternative is not supported by the complete formula pattern.",
  ],
  limitations: ["Formula evidence supports potential, not measured finished-product performance."],
})

const completeInput = (): ConditionerResearchEnvelope => {
  const rawInci =
    "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Amodimethicone, Polyquaternium-37, Hydrolyzed Keratin, Argania Spinosa Kernel Oil"
  return {
    version: "conditioner-research-envelope-v1.6",
    researchMethod: { ...CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "new-conditioner-1",
      market: "DE/EU",
      exactProductName: "New Balanced Conditioner",
      categoryBoundaryStatus: "eligible",
      confidence: "high",
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified",
      rawInci,
      normalizedIngredients: rawInci.split(",").map((item) => item.trim()),
      formulaFingerprintSha256: conditionerFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product"],
    },
    profile: {
      conditioningLevel: evidence("high"),
      weightPotential: evidence("moderate"),
      careDirection: evidence("balanced"),
      repairSupportLevel: evidence("medium"),
      primaryFocus: evidence("repair"),
      secondaryFocus: evidence(["smoothing", "shine"]),
      hairThicknessFit: evidence(["medium", "coarse"]),
      damageFit: evidence(["moderately_damaged", "highly_damaged"]),
      textureFit: evidence(["wavy", "curly", "coily"]),
      uncertainFields: [],
      assumptionNotes: ["No finished-product deposition test was available."],
    },
  }
}

test("projects the complete v1.6 profile into exact current Conditioner fields", () => {
  const input = completeInput()
  const before = structuredClone(input)
  const outcome = projectConditionerForProduction(input)

  assert.deepEqual(input, before, "the research authority must not be mutated")
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return

  assert.deepEqual(outcome.productionProjection.suitable_thicknesses, ["normal", "coarse"])
  assert.deepEqual(outcome.productionProjection.category_specs.product_conditioner_specs, [
    { thickness: "normal", protein_moisture_balance: "stretches_bounces" },
    { thickness: "coarse", protein_moisture_balance: "stretches_bounces" },
  ])
  assert.deepEqual(outcome.productionProjection.category_specs.product_conditioner_rerank_specs, {
    weight: "medium",
    repair_level: "medium",
    balance_direction: "balanced",
    ingredient_flags: ["silicones", "polymers", "oils", "proteins", "humectants"],
  })
  assert.deepEqual(outcome.omittedResearchProperties, [
    "conditioning_level",
    "primary_focus",
    "secondary_focus",
    "damage_fit",
    "texture_fit",
  ])
  assert.equal(outcome.requiredProtocolRole, "conditioner_rinse_out")
  assert.match(
    outcome.productionProjection.field_rationales[
      "category_specs.product_conditioner_rerank_specs.weight"
    ],
    /adjacent alternative/i,
  )
})

test("maps each research care direction to the current compatibility vocabulary", () => {
  const cases = [
    ["moisture", "snaps"],
    ["balanced", "stretches_bounces"],
    ["protein", "stretches_stays"],
  ] as const

  for (const [direction, expected] of cases) {
    const input = completeInput()
    input.profile.careDirection = evidence(direction)
    const outcome = projectConditionerForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    assert.ok(
      outcome.productionProjection.category_specs.product_conditioner_specs.every(
        (row) => row.protein_moisture_balance === expected,
      ),
    )
    assert.equal(
      outcome.productionProjection.category_specs.product_conditioner_rerank_specs
        .balance_direction,
      direction,
    )
  }
})

test("retains uncertainty as review warnings without discarding a usable projection", () => {
  const input = completeInput()
  input.profile.uncertainFields = ["weight_potential", "texture_fit"]
  const outcome = projectConditionerForProduction(input)

  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.match(outcome.warnings.join(" "), /weight_potential.*mapped production field/i)
  assert.match(outcome.warnings.join(" "), /texture_fit.*retained research-only field/i)
})

test("fails closed for missing research, weak identity, unresolved formula, and excluded form", () => {
  assert.equal(projectConditionerForProduction({}).status, "needs_research")

  const weakIdentity = completeInput()
  weakIdentity.identity.confidence = "low"
  assert.equal(projectConditionerForProduction(weakIdentity).status, "needs_research")

  const conflict = completeInput()
  conflict.formula.status = "provisional_conflict"
  assert.equal(projectConditionerForProduction(conflict).status, "needs_research")

  const excluded = completeInput()
  excluded.identity.categoryBoundaryStatus = "excluded_product_form"
  assert.equal(projectConditionerForProduction(excluded).status, "routed_out_of_scope")
})

test("rejects a formula fingerprint that does not match the exact raw INCI", () => {
  const input = completeInput()
  input.formula.rawInciSha256 = "a".repeat(64)
  const outcome = projectConditionerForProduction(input)

  assert.equal(outcome.status, "needs_research")
  if (outcome.status !== "needs_research") return
  assert.match(outcome.reasons.join(" "), /rawInciSha256/i)
})

test("rejects normalized ingredients or a formula fingerprint from a different formula", () => {
  const ingredientsMismatch = completeInput()
  ingredientsMismatch.formula.normalizedIngredients = ["Aqua", "Glycerin"]
  const ingredientOutcome = projectConditionerForProduction(ingredientsMismatch)
  assert.equal(ingredientOutcome.status, "needs_research")
  if (ingredientOutcome.status === "needs_research") {
    assert.match(ingredientOutcome.reasons.join(" "), /normalizedIngredients/i)
  }

  const fingerprintMismatch = completeInput()
  fingerprintMismatch.formula.formulaFingerprintSha256 = "a".repeat(64)
  const fingerprintOutcome = projectConditionerForProduction(fingerprintMismatch)
  assert.equal(fingerprintOutcome.status, "needs_research")
  if (fingerprintOutcome.status === "needs_research") {
    assert.match(fingerprintOutcome.reasons.join(" "), /formulaFingerprintSha256/i)
  }
})

test("pins the exact v1.6 policy and runbook used by the adapter", () => {
  const hash = (relativePath: string) =>
    createHash("sha256")
      .update(readFileSync(path.resolve(relativePath)))
      .digest("hex")

  assert.equal(
    hash("docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md"),
    CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
  assert.equal(
    hash("docs/research/conditioner-inci/v1.0/runbook.md"),
    CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.runbookSha256,
  )
})

test("uses the locked pilot formula normalization for every calibration product", () => {
  const pilot = JSON.parse(
    readFileSync(
      path.resolve("data/research/conditioner-inci/v1.0/calibration-pilot-formulas.json"),
      "utf8",
    ),
  ) as {
    products: Array<{ raw_inci: string; formula_fingerprint: string }>
  }

  for (const product of pilot.products) {
    assert.equal(conditionerFormulaFingerprintSha256(product.raw_inci), product.formula_fingerprint)
  }
})
