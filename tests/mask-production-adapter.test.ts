import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  maskFormulaFingerprintSha256,
  normalizeMaskInciForFingerprint,
  projectMaskForProduction,
  renderMaskProductionMarkdown,
  type MaskResearchEnvelope,
} from "../src/lib/mask-research/production-adapter"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `The reviewed formula supports ${JSON.stringify(value)}.`,
  evidenceSignals: ["Behentrimonium Chloride (INCI #3)", "Amodimethicone (INCI #5)"],
  derivation: "Applied Mask Standard v1.0 to the complete reviewed formula.",
  thresholdReasoning: [
    `The formula clears the selected ${JSON.stringify(value)} threshold.`,
    "The adjacent alternative is not supported by the complete formula pattern.",
  ],
  limitations: ["Formula evidence supports potential, not measured finished-product performance."],
})

const RAW_INCI =
  "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Amodimethicone, Polyquaternium-37, Hydrolyzed Keratin, Argania Spinosa Kernel Oil, Parfum"

const completeInput = (): MaskResearchEnvelope => ({
  version: "mask-research-envelope-v1.0",
  researchMethod: { ...MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD },
  identity: {
    researchId: "new-mask-1",
    market: "DE/EU",
    exactProductName: "Neue Repair Haarkur",
    brand: "Testmarke",
    gtin: "4066447919387",
    identityStatus: "verified",
    categoryBoundaryStatus: "eligible",
    exclusionReason: null,
    multiUse: false,
    uncoveredModes: [],
    confidence: "high",
    sourceIds: ["manufacturer:product"],
  },
  formula: {
    status: "verified",
    rawInci: RAW_INCI,
    normalizedIngredients: normalizeMaskInciForFingerprint(RAW_INCI).split(", "),
    formulaFingerprintSha256: maskFormulaFingerprintSha256(RAW_INCI),
    rawInciSha256: createHash("sha256").update(RAW_INCI).digest("hex"),
    sourceIds: ["manufacturer:product"],
  },
  profile: {
    conditioningLevel: evidence("high"),
    weightPotential: evidence("moderate"),
    careDirection: evidence("balanced"),
    repairSupportLevel: evidence("medium"),
    focus: evidence({ primary: "repair", secondary: ["smoothing"] }),
    bondRoute: evidence("none"),
    hairThicknessFit: evidence(["normal", "coarse"]),
    damageFit: evidence(["moderately_damaged", "highly_damaged"]),
    textureFit: evidence(["wavy", "curly", "coily"]),
    uncertainFields: [],
    assumptionNotes: ["No finished-product deposition test was available."],
  },
})

test("projects the complete v1.0 comparison profile into exact current Mask fields", () => {
  const input = completeInput()
  const before = structuredClone(input)
  const outcome = projectMaskForProduction(input)

  assert.deepEqual(input, before, "the research authority must not be mutated")
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return

  const projection = outcome.productionProjection
  assert.deepEqual(projection.suitable_thicknesses, ["normal", "coarse"])
  assert.deepEqual(projection.category_specs.product_mask_specs, {
    weight: "medium",
    concentration: "high",
    balance_direction: "balanced",
    ingredient_flags: ["silicones", "polymers", "oils", "proteins", "humectants"],
    repair_support_level: "medium",
    functional_benefits: ["smoothing_frizz_control", "detangling_slip"],
  })
  assert.deepEqual(outcome.requiredProtocolRoles, ["intensive_conditioning_mask"])
  assert.equal(projection.adapter_version, "mask-production-adapter-v1")
  assert.equal(projection.research_model_version, "mask-inci-v1.0")
  assert.match(projection.research_input_sha256, /^[a-f0-9]{64}$/)
  assert.match(projection.projection_sha256, /^[a-f0-9]{64}$/)
})

test("research confidence and evidence wording never reach a projected column", () => {
  const outcome = projectMaskForProduction(completeInput())
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  const projected = JSON.stringify({
    suitable_thicknesses: outcome.productionProjection.suitable_thicknesses,
    category_specs: outcome.productionProjection.category_specs,
  })
  assert.doesNotMatch(projected, /confidence|E2|evidence|counter/i)
})

test("emits plain-string rationales under the exact intake field paths", () => {
  const outcome = projectMaskForProduction(completeInput())
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  const rationales = outcome.productionProjection.field_rationales

  for (const key of [
    "product.suitable_thicknesses",
    "category_specs.product_mask_specs",
    "category_specs.product_mask_specs.weight",
    "category_specs.product_mask_specs.concentration",
    "category_specs.product_mask_specs.balance_direction",
    "category_specs.product_mask_specs.ingredient_flags",
    "category_specs.product_mask_specs.repair_support_level",
    "category_specs.product_mask_specs.functional_benefits",
  ]) {
    assert.equal(typeof rationales[key], "string", `${key} must be a plain string rationale`)
    assert.ok(rationales[key].length > 0, `${key} must be non-empty`)
  }
})

test("D6: maps every research care direction 1:1 onto balance_direction, never null", () => {
  for (const direction of ["moisture", "balanced", "protein"] as const) {
    const input = completeInput()
    input.profile.careDirection = evidence(direction)
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    assert.equal(
      outcome.productionProjection.category_specs.product_mask_specs.balance_direction,
      direction,
    )
  }
})

test("maps every research weight potential onto the production weight", () => {
  const cases = [
    ["low", "light"],
    ["moderate", "medium"],
    ["high", "rich"],
  ] as const
  for (const [potential, expected] of cases) {
    const input = completeInput()
    input.profile.weightPotential = evidence(potential)
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    assert.equal(outcome.productionProjection.category_specs.product_mask_specs.weight, expected)
  }
})

test("D1: maps every conditioning level onto the concentration twin", () => {
  const cases = [
    ["low", "low"],
    ["moderate", "medium"],
    ["high", "high"],
  ] as const
  for (const [level, expected] of cases) {
    const input = completeInput()
    input.profile.conditioningLevel = evidence(level)
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "projection_ready", level)
    if (outcome.status !== "projection_ready") continue
    assert.equal(
      outcome.productionProjection.category_specs.product_mask_specs.concentration,
      expected,
    )
  }
})

test("repair_support_level projects unchanged", () => {
  for (const level of ["low", "medium", "high"] as const) {
    const input = completeInput()
    input.profile.repairSupportLevel = evidence(level)
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    assert.equal(
      outcome.productionProjection.category_specs.product_mask_specs.repair_support_level,
      level,
    )
  }
})

test("D2: smoothing, detangling and shine focus project into functional_benefits", () => {
  const cases = [
    [{ primary: "smoothing", secondary: [] }, ["smoothing_frizz_control", "detangling_slip"]],
    [{ primary: "shine", secondary: ["detangling"] }, ["detangling_slip", "shine"]],
    [{ primary: "general", secondary: [] }, ["detangling_slip"]],
    [{ primary: "moisture", secondary: ["repair"] }, ["detangling_slip"]],
  ] as const
  for (const [focus, expected] of cases) {
    const input = completeInput()
    input.profile.focus = evidence({ primary: focus.primary, secondary: [...focus.secondary] })
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "projection_ready", focus.primary)
    if (outcome.status !== "projection_ready") continue
    assert.deepEqual(
      outcome.productionProjection.category_specs.product_mask_specs.functional_benefits,
      expected,
      focus.primary,
    )
  }
})

test("MAD-1 baseline: only a moderate/high conditioning level adds detangling_slip", () => {
  const plainLow = completeInput()
  plainLow.profile.conditioningLevel = evidence("low")
  plainLow.profile.focus = evidence({ primary: "general", secondary: [] })
  const refused = projectMaskForProduction(plainLow)
  assert.equal(refused.status, "needs_research")
  if (refused.status === "needs_research") {
    assert.match(refused.reasons.join(" "), /functional_benefits/)
  }

  const lowShine = completeInput()
  lowShine.profile.conditioningLevel = evidence("low")
  lowShine.profile.focus = evidence({ primary: "shine", secondary: [] })
  const outcome = projectMaskForProduction(lowShine)
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status === "projection_ready") {
    assert.deepEqual(
      outcome.productionProjection.category_specs.product_mask_specs.functional_benefits,
      ["shine"],
    )
  }
})

test("moisture, repair, curl_support and color_care focus add no functional benefit of their own", () => {
  for (const primary of ["moisture", "repair", "curl_support", "color_care"] as const) {
    const input = completeInput()
    input.profile.conditioningLevel = evidence("low")
    input.profile.focus = evidence({ primary, secondary: [] })
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "needs_research", primary)
  }
})

test("AD-2: refuses to commit any unknown value and names the exact field", () => {
  const cases = [
    ["conditioningLevel", "conditioning_level"],
    ["weightPotential", "weight_potential"],
    ["careDirection", "care_direction"],
  ] as const
  for (const [envelopeField, uncertainName] of cases) {
    const input = completeInput()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(input.profile as any)[envelopeField] = evidence("unknown")
    input.profile.uncertainFields = [uncertainName]
    const outcome = projectMaskForProduction(input)
    assert.equal(outcome.status, "needs_research", `${envelopeField} must refuse projection`)
    if (outcome.status !== "needs_research") continue
    assert.match(outcome.reasons.join(" "), new RegExp(`profile\\.${envelopeField}`))
    assert.match(outcome.reasons.join(" "), /AD-2/)
  }
})

test("an unknown value must also be declared in uncertainFields", () => {
  const input = completeInput()
  input.profile.careDirection = evidence("unknown") as never
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status === "needs_research") {
    assert.match(outcome.reasons.join(" "), /care_direction is unknown/)
  }
})

test("refuses when the thickness echo leaves no suitable thickness", () => {
  const input = completeInput()
  input.profile.hairThicknessFit = evidence([])
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status !== "needs_research") return
  assert.match(outcome.reasons.join(" "), /hairThicknessFit/)
})

test("emits suitable thicknesses in the DB vocabulary order", () => {
  const input = completeInput()
  input.profile.hairThicknessFit = evidence(["coarse", "fine", "normal"])
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.deepEqual(outcome.productionProjection.suitable_thicknesses, ["fine", "normal", "coarse"])
})

test("rejects an unknown focus value and a secondary that repeats the primary", () => {
  const removed = completeInput()
  // E6: lightness was removed from the mask focus vocabulary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(removed.profile.focus.value as any).primary = "lightness"
  assert.equal(projectMaskForProduction(removed).status, "needs_research")

  const repeated = completeInput()
  repeated.profile.focus = evidence({ primary: "smoothing", secondary: ["smoothing"] })
  assert.equal(projectMaskForProduction(repeated).status, "needs_research")
})

test("retains uncertainty as review warnings without discarding a usable projection", () => {
  const input = completeInput()
  input.profile.uncertainFields = ["weight_potential", "texture_fit"]
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.match(outcome.warnings.join(" "), /weight_potential.*mapped production field/i)
  assert.match(outcome.warnings.join(" "), /texture_fit.*retained research-only field/i)
})

test("surfaces a legacy-comparison mismatch as a warning, never as a blocker", () => {
  const input = completeInput()
  input.legacyComparison = {
    suitableThicknesses: ["fine"],
    weight: "rich",
    concentration: "low",
    balanceDirection: "moisture",
  }
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  const warnings = outcome.warnings.join(" ")
  assert.match(warnings, /Legacy thickness eligibility differs/)
  assert.match(warnings, /Legacy weight differs/)
  assert.match(warnings, /Legacy concentration differs/)
  assert.match(warnings, /Legacy balance direction differs/)
})

test("fails closed for missing research, weak identity, unresolved formula, G0 stops and exclusions", () => {
  assert.equal(projectMaskForProduction({}).status, "needs_research")

  const weakIdentity = completeInput()
  weakIdentity.identity.confidence = "low"
  assert.equal(projectMaskForProduction(weakIdentity).status, "needs_research")

  for (const status of [
    "provisional_identity_conflict",
    "provisional_formula_conflict",
    "insufficient_information",
  ] as const) {
    const provisional = completeInput()
    provisional.identity.identityStatus = status
    const outcome = projectMaskForProduction(provisional)
    assert.equal(outcome.status, "needs_research", `identityStatus ${status} must be refused`)
    if (outcome.status === "needs_research") {
      assert.match(outcome.reasons.join(" "), /identity\.identityStatus/)
      assert.match(outcome.reasons.join(" "), new RegExp(status))
    }
  }

  for (const status of ["provisional_conflict", "insufficient"] as const) {
    const conflict = completeInput()
    conflict.formula.status = status
    assert.equal(projectMaskForProduction(conflict).status, "needs_research")
  }

  // A charter exclusion routes out before the strict parse, with its reason.
  const excluded = completeInput()
  excluded.identity.categoryBoundaryStatus = "excluded_product_form"
  excluded.identity.exclusionReason = "excluded_color_depositing"
  const excludedOutcome = projectMaskForProduction(excluded)
  assert.equal(excludedOutcome.status, "routed_out_of_scope")
  if (excludedOutcome.status === "routed_out_of_scope") {
    assert.match(excludedOutcome.reasons.join(" "), /excluded_color_depositing/)
  }

  const looseExcluded = projectMaskForProduction({
    identity: {
      researchId: "loose-1",
      exactProductName: "Pre-Shampoo Bond Treatment",
      categoryBoundaryStatus: "excluded_product_form",
      exclusionReason: "excluded_pre_shampoo_bondbuilder_protocol",
    },
  })
  assert.equal(looseExcluded.status, "routed_out_of_scope")
  assert.equal(looseExcluded.summary.researchId, "loose-1")

  // A G0 `insufficient_information` stop carries no profile by rule; it is an
  // evidence stop with one actionable reason, never a boundary exclusion.
  const g0Stop = projectMaskForProduction({
    identity: {
      researchId: "stop-1",
      exactProductName: "Haarmaske ohne Ausspül-Angabe",
      identityStatus: "insufficient_information",
      categoryBoundaryStatus: "eligible",
    },
  })
  assert.equal(g0Stop.status, "needs_research")
  if (g0Stop.status === "needs_research") {
    assert.deepEqual(g0Stop.reasons.length, 1)
    assert.match(g0Stop.reasons[0], /insufficient_information — G0 evidence stop/)
  }
})

test("multi-use products must name their uncovered modes", () => {
  const input = completeInput()
  input.identity.multiUse = true
  input.identity.uncoveredModes = []
  assert.equal(projectMaskForProduction(input).status, "needs_research")

  input.identity.uncoveredModes = ["conditioner"]
  assert.equal(projectMaskForProduction(input).status, "projection_ready")
})

test("rejects a raw INCI hash that does not match the exact raw INCI", () => {
  const input = completeInput()
  input.formula.rawInciSha256 = "a".repeat(64)
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status !== "needs_research") return
  assert.match(outcome.reasons.join(" "), /rawInciSha256/i)
})

test("rejects normalized ingredients or a formula fingerprint from a different formula", () => {
  const ingredientsMismatch = completeInput()
  ingredientsMismatch.formula.normalizedIngredients = ["AQUA", "GLYCERIN"]
  const ingredientOutcome = projectMaskForProduction(ingredientsMismatch)
  assert.equal(ingredientOutcome.status, "needs_research")
  if (ingredientOutcome.status === "needs_research") {
    assert.match(ingredientOutcome.reasons.join(" "), /normalizedIngredients/i)
  }

  const fingerprintMismatch = completeInput()
  fingerprintMismatch.formula.formulaFingerprintSha256 = "a".repeat(64)
  const fingerprintOutcome = projectMaskForProduction(fingerprintMismatch)
  assert.equal(fingerprintOutcome.status, "needs_research")
  if (fingerprintOutcome.status === "needs_research") {
    assert.match(fingerprintOutcome.reasons.join(" "), /formulaFingerprintSha256/i)
  }
})

test("rejects an envelope pinned to a different method version", () => {
  const input = completeInput()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(input.researchMethod as any).policySha256 = "b".repeat(64)
  const outcome = projectMaskForProduction(input)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status === "needs_research") {
    assert.match(outcome.reasons.join(" "), /researchMethod\.policySha256/)
  }
})

test("keeps an internal comma inside an INCI name out of the ingredient split", () => {
  assert.equal(
    normalizeMaskInciForFingerprint("Aqua, 1,2-Hexanediol, Glycerin*"),
    "AQUA, 1,2-HEXANEDIOL, GLYCERIN",
  )
  assert.equal(
    normalizeMaskInciForFingerprint("Polyquaternium-37,Glycerin"),
    "POLYQUATERNIUM-37, GLYCERIN",
  )
})

test("pins the exact v1.0 standard and evidence lexicon used by the adapter", () => {
  const hash = (relativePath: string) =>
    createHash("sha256")
      .update(readFileSync(path.resolve(relativePath)))
      .digest("hex")

  assert.equal(
    hash("docs/research/mask-inci/v1.0/mask-classification-standard.md"),
    MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
  assert.equal(
    hash("docs/research/mask-inci/v1.0/02_evidence_lexicon.v0.1.md"),
    MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.lexiconSha256,
  )
})

test("every frozen artifact in the v1.0 manifest still matches its pinned hash", () => {
  type Entry = { path: string; bytes: number; sha256: string }
  const manifest = JSON.parse(
    readFileSync(path.resolve("data/research/mask-inci/v1.0/artifact-manifest.json"), "utf8"),
  ) as Record<string, unknown>

  const entries: Entry[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== "object") return
    const record = node as Record<string, unknown>
    if (typeof record.path === "string" && typeof record.sha256 === "string") {
      entries.push(record as unknown as Entry)
    }
    Object.values(record).forEach(walk)
  }
  walk(manifest)

  // The landing README is a living index (the leave-in README is too); it is
  // recorded at freeze but is not a frozen artifact.
  const frozen = entries.filter((entry) => entry.path !== "docs/research/mask-inci/README.md")
  assert.ok(frozen.length > 100, `expected the full frozen corpus, found ${frozen.length}`)
  for (const entry of frozen) {
    const bytes = readFileSync(path.resolve(entry.path))
    assert.equal(bytes.length, entry.bytes, `${entry.path}: byte length drifted`)
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      `${entry.path}: frozen artifact drifted`,
    )
  }
})

test("renders the review markdown from the typed outcome in the library", () => {
  const ready = renderMaskProductionMarkdown(projectMaskForProduction(completeInput()))
  assert.match(ready, /# Mask production adapter/)
  assert.match(ready, /Status: projection_ready/)
  assert.match(ready, /- Concentration: high/)
  assert.match(ready, /Required protocol roles: intensive_conditioning_mask/)

  const refused = renderMaskProductionMarkdown(projectMaskForProduction({}))
  assert.match(refused, /Status: needs_research/)
  assert.match(refused, /## Reasons/)
})
