import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  expandLeaveInEligibility,
  leaveInFormulaFingerprintSha256,
  normalizeLeaveInInciForFingerprint,
  projectLeaveInForProduction,
  renderLeaveInProductionMarkdown,
  type LeaveInResearchEnvelope,
} from "../src/lib/leave-in-research/production-adapter"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `The reviewed formula supports ${JSON.stringify(value)}.`,
  evidenceSignals: ["Amodimethicone (INCI #5)", "Polyquaternium-37 (INCI #6)"],
  derivation: "Applied Leave-In Standard v1.0 to the complete reviewed formula.",
  thresholdReasoning: [
    `The formula clears the selected ${JSON.stringify(value)} threshold.`,
    "The adjacent alternative is not supported by the complete formula pattern.",
  ],
  limitations: ["Formula evidence supports potential, not measured finished-product performance."],
})

const RAW_INCI =
  "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Amodimethicone, Polyquaternium-37, Hydrolyzed Keratin, Argania Spinosa Kernel Oil"

const completeInput = (): LeaveInResearchEnvelope => ({
  version: "leave-in-research-envelope-v1.0",
  researchMethod: { ...LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD },
  identity: {
    researchId: "new-leave-in-1",
    market: "DE/EU",
    exactProductName: "New Repair Leave-In Spray",
    brand: "Testmarke",
    gtin: "4066447919387",
    productForm: "spray",
    applicationStage: ["towel_dry", "dry_hair"],
    identityStatus: "verified",
    categoryBoundaryStatus: "eligible",
    confidence: "high",
    sourceIds: ["manufacturer:product"],
  },
  formula: {
    status: "verified",
    rawInci: RAW_INCI,
    normalizedIngredients: normalizeLeaveInInciForFingerprint(RAW_INCI).split(", "),
    formulaFingerprintSha256: leaveInFormulaFingerprintSha256(RAW_INCI),
    rawInciSha256: createHash("sha256").update(RAW_INCI).digest("hex"),
    sourceIds: ["manufacturer:product"],
  },
  profile: {
    conditioningLevel: evidence("high"),
    weightPotential: evidence("moderate"),
    persistence: evidence("moderate"),
    holdSupport: evidence("none"),
    careDirection: evidence("balanced"),
    repairSupportLevel: evidence("medium"),
    focus: evidence({ primary: "repair", secondary: ["smoothing"] }),
    specialistFunctions: evidence({ providesHeatProtection: true }),
    smoothingRoute: evidence("silicone_film"),
    hairThicknessFit: evidence({
      fine: "conditional",
      medium: "recommended",
      coarse: "recommended",
    }),
    damageFit: evidence({
      healthy: "conditional",
      moderately_damaged: "recommended",
      highly_damaged: "recommended",
    }),
    textureFit: evidence({
      straight: "recommended",
      wavy: "recommended",
      curly: "recommended",
      coily: "conditional",
    }),
    uncertainFields: [],
    assumptionNotes: ["No finished-product deposition test was available."],
  },
})

test("projects the complete v1.0 lean profile into exact current Leave-In fields", () => {
  const input = completeInput()
  const before = structuredClone(input)
  const outcome = projectLeaveInForProduction(input)

  assert.deepEqual(input, before, "the research authority must not be mutated")
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return

  const projection = outcome.productionProjection
  assert.deepEqual(projection.suitable_thicknesses, ["normal", "coarse"])
  assert.deepEqual(projection.category_specs.product_leave_in_specs, {
    format: "spray",
    weight: "medium",
    roles: ["replacement_conditioner"],
    provides_heat_protection: true,
    heat_protection_max_c: null,
    heat_activation_required: false,
    care_benefits: ["repair", "anti_frizz"],
    ingredient_flags: ["silicones", "polymers", "oils", "proteins", "humectants"],
    application_stage: ["towel_dry", "dry_hair"],
    care_direction: "balanced",
    repair_support_level: "medium",
    plan_roles: ["post_wash_leave_in", "pre_heat_application"],
    functional_benefits: [
      "moisture_softness",
      "smooth_anti_frizz",
      "heat_protect",
      "repair_support",
    ],
  })
  assert.deepEqual(projection.category_specs.product_leave_in_fit_specs, {
    weight: "medium",
    conditioner_relationship: "replacement_capable",
    care_benefits: ["heat_protect", "repair", "detangle_smooth"],
  })
  assert.deepEqual(projection.category_specs.product_leave_in_eligibility, [
    { thickness: "normal", need_bucket: "heat_protect", styling_context: "heat_style" },
    { thickness: "normal", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "normal", need_bucket: "repair", styling_context: "non_heat_style" },
    { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
    { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "non_heat_style" },
    { thickness: "coarse", need_bucket: "heat_protect", styling_context: "heat_style" },
    { thickness: "coarse", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "coarse", need_bucket: "repair", styling_context: "non_heat_style" },
    { thickness: "coarse", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
    { thickness: "coarse", need_bucket: "moisture_anti_frizz", styling_context: "non_heat_style" },
  ])
  // The plan role `pre_heat_application` and the protocol role `pre_heat_protection`
  // are different values and both must be emitted on their own side.
  assert.deepEqual(outcome.requiredProtocolRoles, ["post_wash_leave_in", "pre_heat_protection"])
  assert.equal(projection.adapter_version, "leave-in-production-adapter-v1")
  assert.equal(projection.research_model_version, "leave-in-inci-v1.0")
  assert.match(projection.research_input_sha256, /^[a-f0-9]{64}$/)
  assert.match(projection.projection_sha256, /^[a-f0-9]{64}$/)
})

test("emits plain-string rationales under the exact intake field paths", () => {
  const outcome = projectLeaveInForProduction(completeInput())
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  const rationales = outcome.productionProjection.field_rationales

  for (const key of [
    "product.suitable_thicknesses",
    "category_specs.product_leave_in_specs",
    "category_specs.product_leave_in_fit_specs",
    "category_specs.product_leave_in_eligibility",
    "category_specs.product_leave_in_specs.format",
    "category_specs.product_leave_in_specs.weight",
    "category_specs.product_leave_in_specs.roles",
    "category_specs.product_leave_in_specs.provides_heat_protection",
    "category_specs.product_leave_in_specs.heat_protection_max_c",
    "category_specs.product_leave_in_specs.heat_activation_required",
    "category_specs.product_leave_in_specs.care_benefits",
    "category_specs.product_leave_in_specs.ingredient_flags",
    "category_specs.product_leave_in_specs.application_stage",
    "category_specs.product_leave_in_specs.care_direction",
    "category_specs.product_leave_in_specs.repair_support_level",
    "category_specs.product_leave_in_specs.plan_roles",
    "category_specs.product_leave_in_specs.functional_benefits",
    "category_specs.product_leave_in_fit_specs.weight",
    "category_specs.product_leave_in_fit_specs.conditioner_relationship",
    "category_specs.product_leave_in_fit_specs.care_benefits",
  ]) {
    assert.equal(typeof rationales[key], "string", `${key} must be a plain string rationale`)
    assert.ok(rationales[key].length > 0, `${key} must be non-empty`)
  }

  const rows = outcome.productionProjection.category_specs.product_leave_in_eligibility
  rows.forEach((row, index) => {
    const key = `category_specs.product_leave_in_eligibility[${index}]`
    assert.equal(typeof rationales[key], "string")
    assert.match(
      rationales[key],
      new RegExp(`${row.thickness}/${row.need_bucket}/${row.styling_context}`),
    )
  })
})

test("maps every research care direction onto the production enum", () => {
  const cases = [
    ["moisture", "moisture"],
    ["balanced", null],
    ["protein", "protein"],
  ] as const

  for (const [direction, expectedBenefit] of cases) {
    const input = completeInput()
    input.profile.careDirection = evidence(direction)
    const outcome = projectLeaveInForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    const specs = outcome.productionProjection.category_specs.product_leave_in_specs
    assert.equal(specs.care_direction, direction)
    if (expectedBenefit) {
      assert.ok(specs.care_benefits.includes(expectedBenefit))
    } else {
      assert.ok(!specs.care_benefits.includes("moisture"))
      assert.ok(!specs.care_benefits.includes("protein"))
    }
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
    const outcome = projectLeaveInForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    const specs = outcome.productionProjection.category_specs.product_leave_in_specs
    assert.equal(specs.weight, expected)
    assert.equal(
      outcome.productionProjection.category_specs.product_leave_in_fit_specs.weight,
      expected,
      "fit_specs.weight must equal specs.weight",
    )
  }
})

test("maps the research thickness vocabulary onto the DB thickness vocabulary", () => {
  const input = completeInput()
  input.profile.hairThicknessFit = evidence({
    fine: "recommended",
    medium: "recommended",
    coarse: "recommended",
  })
  const outcome = projectLeaveInForProduction(input)
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.deepEqual(outcome.productionProjection.suitable_thicknesses, ["fine", "normal", "coarse"])
})

test("AD-3/AD-4: the conditioner relationship and roles follow the ruled derivation", () => {
  const booster = completeInput()
  booster.profile.conditioningLevel = evidence("low")
  const boosterOutcome = projectLeaveInForProduction(booster)
  assert.equal(boosterOutcome.status, "projection_ready")
  if (boosterOutcome.status === "projection_ready") {
    const specs = boosterOutcome.productionProjection.category_specs
    assert.equal(specs.product_leave_in_fit_specs.conditioner_relationship, "booster_only")
    assert.deepEqual(specs.product_leave_in_specs.roles, ["extension_conditioner"])
  }

  const lowPersistence = completeInput()
  lowPersistence.profile.persistence = evidence("low")
  const lowPersistenceOutcome = projectLeaveInForProduction(lowPersistence)
  assert.equal(lowPersistenceOutcome.status, "projection_ready")
  if (lowPersistenceOutcome.status === "projection_ready") {
    assert.equal(
      lowPersistenceOutcome.productionProjection.category_specs.product_leave_in_fit_specs
        .conditioner_relationship,
      "booster_only",
    )
  }

  const held = completeInput()
  held.profile.holdSupport = evidence("incidental")
  const heldOutcome = projectLeaveInForProduction(held)
  assert.equal(heldOutcome.status, "projection_ready")
  if (heldOutcome.status === "projection_ready") {
    assert.deepEqual(heldOutcome.productionProjection.category_specs.product_leave_in_specs.roles, [
      "replacement_conditioner",
      "styling_prep",
    ])
  }

  const preHeat = completeInput()
  preHeat.identity.applicationStage = ["towel_dry", "pre_heat"]
  const preHeatOutcome = projectLeaveInForProduction(preHeat)
  assert.equal(preHeatOutcome.status, "projection_ready")
  if (preHeatOutcome.status === "projection_ready") {
    assert.deepEqual(
      preHeatOutcome.productionProjection.category_specs.product_leave_in_specs.roles,
      ["replacement_conditioner", "styling_prep"],
    )
  }

  // oil_replacement is never emitted by this adapter.
  const outcome = projectLeaveInForProduction(completeInput())
  if (outcome.status === "projection_ready") {
    assert.ok(
      !outcome.productionProjection.category_specs.product_leave_in_specs.roles.includes(
        "oil_replacement",
      ),
    )
  }
})

test("AD-6: heat_protection_max_c is null whatever the heat binary says", () => {
  for (const providesHeatProtection of [true, false]) {
    const input = completeInput()
    input.profile.specialistFunctions = evidence({ providesHeatProtection })
    const outcome = projectLeaveInForProduction(input)
    assert.equal(outcome.status, "projection_ready")
    if (outcome.status !== "projection_ready") continue
    const specs = outcome.productionProjection.category_specs.product_leave_in_specs
    assert.equal(specs.heat_protection_max_c, null)
    assert.equal(specs.provides_heat_protection, providesHeatProtection)
    assert.equal(specs.heat_activation_required, false)
    assert.deepEqual(
      specs.plan_roles,
      providesHeatProtection
        ? ["post_wash_leave_in", "pre_heat_application"]
        : ["post_wash_leave_in"],
    )
    assert.deepEqual(
      outcome.requiredProtocolRoles,
      providesHeatProtection
        ? ["post_wash_leave_in", "pre_heat_protection"]
        : ["post_wash_leave_in"],
    )
  }
})

test("AD-2: refuses to commit any unknown value and names the exact field", () => {
  const cases = [
    ["conditioningLevel", "conditioning_level"],
    ["weightPotential", "weight_potential"],
    ["persistence", "persistence"],
    ["careDirection", "care_direction"],
  ] as const

  for (const [envelopeField, uncertainName] of cases) {
    const input = completeInput()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(input.profile as any)[envelopeField] = evidence("unknown")
    input.profile.uncertainFields = [uncertainName]
    const outcome = projectLeaveInForProduction(input)
    assert.equal(outcome.status, "needs_research", `${envelopeField} must refuse projection`)
    if (outcome.status !== "needs_research") continue
    assert.match(outcome.reasons.join(" "), new RegExp(`profile\\.${envelopeField}`))
    assert.match(outcome.reasons.join(" "), /AD-2/)
  }

  const unknownFit = completeInput()
  unknownFit.profile.hairThicknessFit = evidence({
    fine: "unknown",
    medium: "recommended",
    coarse: "recommended",
  })
  unknownFit.profile.uncertainFields = ["hair_thickness_fit"]
  const fitOutcome = projectLeaveInForProduction(unknownFit)
  assert.equal(fitOutcome.status, "needs_research")
  if (fitOutcome.status === "needs_research") {
    assert.match(fitOutcome.reasons.join(" "), /profile\.hairThicknessFit\.fine/)
  }
})

test("AD-5: refuses when no thickness is recommended", () => {
  const input = completeInput()
  input.profile.hairThicknessFit = evidence({
    fine: "conditional",
    medium: "conditional",
    coarse: "caution",
  })
  const outcome = projectLeaveInForProduction(input)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status !== "needs_research") return
  assert.match(outcome.reasons.join(" "), /AD-5/)
  assert.match(outcome.reasons.join(" "), /recommended/)
})

test("AD-5: only recommended thicknesses reach the catalog; the rest become warnings", () => {
  const outcome = projectLeaveInForProduction(completeInput())
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.deepEqual(outcome.productionProjection.suitable_thicknesses, ["normal", "coarse"])
  assert.ok(
    outcome.productionProjection.category_specs.product_leave_in_eligibility.every(
      (row) => row.thickness !== "fine",
    ),
  )
  assert.match(outcome.warnings.join(" "), /AD-5: fine/)
})

test("retains uncertainty as review warnings without discarding a usable projection", () => {
  const input = completeInput()
  input.profile.uncertainFields = ["weight_potential", "texture_fit"]
  const outcome = projectLeaveInForProduction(input)

  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.match(outcome.warnings.join(" "), /weight_potential.*mapped production field/i)
  assert.match(outcome.warnings.join(" "), /texture_fit.*retained research-only field/i)
})

test("surfaces a legacy-comparison mismatch as a warning, never as a blocker", () => {
  const input = completeInput()
  input.legacyComparison = {
    suitableThicknesses: ["fine"],
    format: "cream",
    weight: "rich",
    providesHeatProtection: false,
  }
  const outcome = projectLeaveInForProduction(input)
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  assert.match(outcome.warnings.join(" "), /Legacy thickness eligibility differs/)
  assert.match(outcome.warnings.join(" "), /Legacy format differs/)
  assert.match(outcome.warnings.join(" "), /Legacy weight differs/)
  assert.match(outcome.warnings.join(" "), /Legacy heat-protection heuristic differs/)
})

test("fails closed for missing research, weak identity, unresolved formula, and excluded form", () => {
  assert.equal(projectLeaveInForProduction({}).status, "needs_research")

  const weakIdentity = completeInput()
  weakIdentity.identity.confidence = "low"
  assert.equal(projectLeaveInForProduction(weakIdentity).status, "needs_research")

  const insufficientIdentity = completeInput()
  insufficientIdentity.identity.identityStatus = "insufficient_information"
  assert.equal(projectLeaveInForProduction(insufficientIdentity).status, "needs_research")

  // P1: a provisional identityStatus (an unresolved identity conflict or an
  // unresolved formula conflict) is refused just like insufficient identity
  // evidence, and the refusal names the offending field.
  for (const status of [
    "provisional_identity_conflict",
    "provisional_formula_conflict",
    "insufficient_information",
  ] as const) {
    const provisionalIdentity = completeInput()
    provisionalIdentity.identity.identityStatus = status
    const outcome = projectLeaveInForProduction(provisionalIdentity)
    assert.equal(outcome.status, "needs_research", `identityStatus ${status} must be refused`)
    if (outcome.status === "needs_research") {
      assert.match(outcome.reasons.join(" "), /identity\.identityStatus/)
      assert.match(outcome.reasons.join(" "), new RegExp(status))
    }
  }

  for (const status of ["provisional_conflict", "insufficient"] as const) {
    const conflict = completeInput()
    conflict.formula.status = status
    assert.equal(projectLeaveInForProduction(conflict).status, "needs_research")
  }

  // The boundary probe runs before the strict parse: a structurally broken
  // envelope that is out of category still routes rather than failing validation.
  for (const boundary of ["excluded_product_form", "excluded_boundary"] as const) {
    const excluded = completeInput()
    excluded.identity.categoryBoundaryStatus = boundary
    const outcome = projectLeaveInForProduction(excluded)
    assert.equal(outcome.status, "routed_out_of_scope")
    if (outcome.status === "routed_out_of_scope") {
      assert.match(outcome.reasons.join(" "), new RegExp(boundary))
    }
  }
  const looseExcluded = projectLeaveInForProduction({
    identity: {
      researchId: "loose-1",
      exactProductName: "Some Anhydrous Oil",
      categoryBoundaryStatus: "excluded_boundary",
    },
  })
  assert.equal(looseExcluded.status, "routed_out_of_scope")
  assert.equal(looseExcluded.summary.researchId, "loose-1")
})

test("rejects a raw INCI hash that does not match the exact raw INCI", () => {
  const input = completeInput()
  input.formula.rawInciSha256 = "a".repeat(64)
  const outcome = projectLeaveInForProduction(input)

  assert.equal(outcome.status, "needs_research")
  if (outcome.status !== "needs_research") return
  assert.match(outcome.reasons.join(" "), /rawInciSha256/i)
})

test("rejects normalized ingredients or a formula fingerprint from a different formula", () => {
  const ingredientsMismatch = completeInput()
  ingredientsMismatch.formula.normalizedIngredients = ["AQUA", "GLYCERIN"]
  const ingredientOutcome = projectLeaveInForProduction(ingredientsMismatch)
  assert.equal(ingredientOutcome.status, "needs_research")
  if (ingredientOutcome.status === "needs_research") {
    assert.match(ingredientOutcome.reasons.join(" "), /normalizedIngredients/i)
  }

  const fingerprintMismatch = completeInput()
  fingerprintMismatch.formula.formulaFingerprintSha256 = "a".repeat(64)
  const fingerprintOutcome = projectLeaveInForProduction(fingerprintMismatch)
  assert.equal(fingerprintOutcome.status, "needs_research")
  if (fingerprintOutcome.status === "needs_research") {
    assert.match(fingerprintOutcome.reasons.join(" "), /formulaFingerprintSha256/i)
  }
})

test("keeps an internal comma inside an INCI name out of the ingredient split", () => {
  assert.equal(
    normalizeLeaveInInciForFingerprint("Aqua, 1,2-Hexanediol, Glycerin*"),
    "AQUA, 1,2-HEXANEDIOL, GLYCERIN",
  )
})

test("splits on a comma with a digit on only one side, protecting only digit-comma-digit", () => {
  // A comma flanked by digits on BOTH sides belongs to the ingredient name
  // itself (`1,2-Hexanediol`). A comma with a digit on only one side is a
  // plain list separator, even though one neighbor is a digit
  // (`Polyquaternium-37,Glycerin`).
  assert.equal(
    normalizeLeaveInInciForFingerprint("Polyquaternium-37,Glycerin"),
    "POLYQUATERNIUM-37, GLYCERIN",
  )
  assert.equal(normalizeLeaveInInciForFingerprint("1,2-Hexanediol"), "1,2-HEXANEDIOL")
})

test("pins the exact v1.0 policy and runbook used by the adapter", () => {
  const hash = (relativePath: string) =>
    createHash("sha256")
      .update(readFileSync(path.resolve(relativePath)))
      .digest("hex")

  assert.equal(
    hash("docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md"),
    LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
  assert.equal(
    hash("docs/research/leave-in-inci/v1.0/runbook.md"),
    LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.runbookSha256,
  )
})

test("the ported eligibility expansion reproduces the SQL function's rules", () => {
  // heat_protect is heat_style only, and it needs the heat binary to exist.
  const heatOnly = expandLeaveInEligibility({
    thicknesses: ["fine"],
    roles: ["replacement_conditioner"],
    careBenefits: ["moisture"],
    applicationStage: ["towel_dry"],
    providesHeatProtection: true,
    heatActivationRequired: false,
  })
  assert.deepEqual(heatOnly, [
    { thickness: "fine", need_bucket: "heat_protect", styling_context: "heat_style" },
    { thickness: "fine", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
    { thickness: "fine", need_bucket: "moisture_anti_frizz", styling_context: "non_heat_style" },
  ])
  assert.ok(
    heatOnly
      .filter((row) => row.need_bucket === "heat_protect")
      .every((row) => row.styling_context === "heat_style"),
  )

  // heat_activation_required collapses every context to heat_style.
  const activated = expandLeaveInEligibility({
    thicknesses: ["fine", "normal"],
    roles: ["styling_prep"],
    careBenefits: ["moisture", "curl_definition", "shine"],
    applicationStage: ["towel_dry", "dry_hair", "post_style"],
    providesHeatProtection: false,
    heatActivationRequired: true,
  })
  assert.ok(activated.length > 0)
  assert.ok(activated.every((row) => row.styling_context === "heat_style"))
  assert.ok(activated.some((row) => row.need_bucket === "heat_protect"))

  // No care benefit maps to a bucket -> no rows at all.
  assert.deepEqual(
    expandLeaveInEligibility({
      thicknesses: ["fine"],
      roles: ["extension_conditioner"],
      careBenefits: ["volume"],
      applicationStage: ["towel_dry"],
      providesHeatProtection: false,
      heatActivationRequired: false,
    }),
    [],
  )

  // styling_prep alone supplies non_heat_style when no stage does.
  assert.deepEqual(
    expandLeaveInEligibility({
      thicknesses: ["coarse"],
      roles: ["styling_prep"],
      careBenefits: ["shine"],
      applicationStage: ["pre_heat"],
      providesHeatProtection: false,
      heatActivationRequired: false,
    }),
    [{ thickness: "coarse", need_bucket: "shine_protect", styling_context: "non_heat_style" }],
  )

  // A pre_heat-only stage without the heat binary yields heat_style as the only
  // context, and non-heat buckets skip it — the SQL emits nothing at all.
  assert.deepEqual(
    expandLeaveInEligibility({
      thicknesses: ["fine"],
      roles: ["extension_conditioner"],
      careBenefits: ["protein"],
      applicationStage: ["pre_heat"],
      providesHeatProtection: false,
      heatActivationRequired: false,
    }),
    [],
  )

  // An empty context set falls back to air_dry + non_heat_style. The envelope
  // schema requires a non-empty applicationStage, so only a direct caller
  // (or the RPC reading a legacy row) can reach this branch.
  assert.deepEqual(
    expandLeaveInEligibility({
      thicknesses: ["fine"],
      roles: ["extension_conditioner"],
      careBenefits: ["protein"],
      applicationStage: [],
      providesHeatProtection: false,
      heatActivationRequired: false,
    }).map((row) => row.styling_context),
    ["air_dry", "non_heat_style"],
  )

  // Unknown thicknesses are skipped exactly as the SQL loop skips them.
  assert.deepEqual(
    expandLeaveInEligibility({
      thicknesses: ["medium"],
      roles: [],
      careBenefits: ["moisture"],
      applicationStage: ["towel_dry"],
      providesHeatProtection: false,
      heatActivationRequired: false,
    }),
    [],
  )
})

test("every projected eligibility triple is producible by the ported rules", () => {
  const outcome = projectLeaveInForProduction(completeInput())
  assert.equal(outcome.status, "projection_ready")
  if (outcome.status !== "projection_ready") return
  const projection = outcome.productionProjection
  const specs = projection.category_specs.product_leave_in_specs
  assert.deepEqual(
    projection.category_specs.product_leave_in_eligibility,
    expandLeaveInEligibility({
      thicknesses: projection.suitable_thicknesses,
      roles: specs.roles,
      careBenefits: specs.care_benefits,
      applicationStage: specs.application_stage,
      providesHeatProtection: specs.provides_heat_protection,
      heatActivationRequired: specs.heat_activation_required,
    }),
  )
})

test("renders the review markdown from the typed outcome in the library", () => {
  const ready = renderLeaveInProductionMarkdown(projectLeaveInForProduction(completeInput()))
  assert.match(ready, /# Leave-In production adapter/)
  assert.match(ready, /Status: projection_ready/)
  assert.match(ready, /\| normal \| heat_protect \| heat_style \|/)
  assert.match(ready, /Required protocol roles: post_wash_leave_in, pre_heat_protection/)

  const refused = renderLeaveInProductionMarkdown(projectLeaveInForProduction({}))
  assert.match(refused, /Status: needs_research/)
  assert.match(refused, /## Reasons/)
})
