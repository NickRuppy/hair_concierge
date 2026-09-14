import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  projectShampooProductionLight,
  renderShampooProductionLightMarkdown,
  SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD,
  type ShampooProductionLightInput,
} from "../src/lib/shampoo/production-light-adapter"

const property = <T extends string>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Evidence supports ${value}.`,
  evidenceRefs: ["formula:canonical", "positioning:manufacturer"],
})

const completeInput = (): ShampooProductionLightInput => ({
  version: "shampoo-production-light-v1",
  researchMethod: { ...SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD },
  identity: {
    productId: "ordinary-shampoo",
    market: "DE",
    exactProductName: "Ordinary Shampoo",
    exactPackSize: "250 ml",
    gtinAliases: ["4006381333931"],
    capturedAt: "2026-09-02T10:00:00.000Z",
    confidence: "high",
    conflictStatus: "resolved",
    sources: [
      {
        url: "https://manufacturer.example/ordinary",
        tier: "manufacturer_de",
        capturedAt: "2026-09-02T10:00:00.000Z",
      },
    ],
  },
  formula: {
    status: "canonical",
    canonicalInci: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine",
    inciFingerprintSha256: createHash("sha256")
      .update("Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine", "utf8")
      .digest("hex"),
    canonicalSource: "manufacturer_de",
    evidenceRefs: ["formula:manufacturer-de"],
    sources: [
      {
        url: "https://manufacturer.example/ordinary",
        tier: "manufacturer_de",
        capturedAt: "2026-09-02T10:00:00.000Z",
      },
    ],
  },
  properties: {
    cleansingStrength: property("moderate"),
    conditioningLevel: property("moderate"),
    weightPotential: property("moderate"),
    focusPrimary: property("general"),
    focusSecondary: {
      value: [],
      confidence: "high",
      rationale: "No independently evidenced secondary focus.",
      evidenceRefs: ["formula:canonical"],
    },
    usageRole: property("regular"),
    scalpComfortTarget: property("not_targeted"),
    dandruffSupport: property("not_supported"),
  },
  thicknesses: [
    {
      thickness: "fine",
      fit: "ideal",
      confidence: "high",
      rationale: "Light enough.",
      evidenceRefs: ["formula:canonical"],
    },
    {
      thickness: "normal",
      fit: "ideal",
      confidence: "high",
      rationale: "Balanced formula.",
      evidenceRefs: ["formula:canonical"],
    },
    {
      thickness: "coarse",
      fit: "conditional",
      confidence: "high",
      rationale: "May need richer care.",
      evidenceRefs: ["formula:canonical"],
    },
  ],
  scalpTargets: {
    primary: {
      target: "ordinary",
      confidence: "high",
      rationale: "General positioning and compatible formula.",
      positioningEvidenceRefs: ["positioning:manufacturer"],
      formulaEvidenceRefs: ["formula:canonical"],
    },
  },
  positioning: {
    explicitResetPositioning: false,
    evidenceRefs: ["positioning:manufacturer"],
  },
})

test("projects a complete regular shampoo into ideal thickness and normal route rows", () => {
  const outcome = projectShampooProductionLight(completeInput())
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status !== "property_lane_ready") return
  assert.equal(outcome.version, "shampoo-production-light-v1")
  assert.deepEqual(outcome.payload.suitable_thicknesses, ["fine", "normal"])
  assert.deepEqual(outcome.payload.category_specs.product_shampoo_specs, [
    {
      thickness: "fine",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "regular",
    },
    {
      thickness: "normal",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "regular",
    },
  ])
  assert.deepEqual(outcome.payload.required_protocol_roles, ["shampoo_everyday"])
  assert.ok(outcome.payload.field_rationales["product.suitable_thicknesses"])
  assert.match(
    outcome.payload.field_rationales["product.suitable_thicknesses"].rationale,
    /Conditional \(not emitted\): coarse — May need richer care\./,
  )
  assert.ok(outcome.payload.field_rationales["category_specs.product_shampoo_specs"])
  assert.ok(
    outcome.payload.field_rationales["category_specs.product_shampoo_specs.cleansing_intensity"],
  )
  assert.ok(outcome.payload.field_rationales.required_protocol_roles)
})

test("keeps the frozen v1.4 focus enum while v1.5 moisture stays overlay-only", () => {
  const legacyGentle = completeInput()
  legacyGentle.properties.focusPrimary = property("gentle")
  assert.equal(projectShampooProductionLight(legacyGentle).status, "property_lane_ready")

  const v15Moisture = completeInput() as unknown as {
    properties: { focusPrimary: ReturnType<typeof property> }
  }
  v15Moisture.properties.focusPrimary = property("moisture")
  assert.equal(projectShampooProductionLight(v15Moisture).status, "needs_research")
})

test("routes a true explicitly positioned reset shampoo away from regular shampoo", () => {
  const input = completeInput()
  input.properties.cleansingStrength = property("strong")
  input.properties.focusPrimary = property("clarifying")
  input.properties.usageRole = property("occasional_reset")
  input.positioning.explicitResetPositioning = true
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "routed_deep_cleansing")
})

test("blocks a dandruff target without both a supported active and exact treatment positioning", () => {
  const input = completeInput()
  input.scalpTargets.primary = {
    target: "dandruff",
    confidence: "high",
    rationale: "Vague scalp claim only.",
    positioningEvidenceRefs: ["positioning:manufacturer"],
    formulaEvidenceRefs: ["formula:canonical"],
    exactAntiDandruffPositioning: false,
  }
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "needs_research")
  assert.match(outcome.reasons.join("\n"), /dandruff/i)
})

test("blocks low-confidence final properties rather than emitting a partial payload", () => {
  const input = completeInput()
  input.properties.weightPotential.confidence = "low"
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "needs_research")
  assert.match(outcome.reasons.join("\n"), /properties\.weightPotential\.confidence/)
})

test("blocks unknown mechanical or scalp-comfort values once the formula is canonical", () => {
  const dandruffUnknown = completeInput()
  dandruffUnknown.properties.dandruffSupport = property("unknown")
  const dandruffOutcome = projectShampooProductionLight(dandruffUnknown)
  assert.equal(dandruffOutcome.status, "needs_research")
  if (dandruffOutcome.status === "needs_research")
    assert.match(dandruffOutcome.reasons.join("\n"), /properties\.dandruffSupport\.value/)

  const comfortUnknown = completeInput()
  comfortUnknown.properties.scalpComfortTarget = property("unknown")
  const comfortOutcome = projectShampooProductionLight(comfortUnknown)
  assert.equal(comfortOutcome.status, "needs_research")
  if (comfortOutcome.status === "needs_research")
    assert.match(comfortOutcome.reasons.join("\n"), /properties\.scalpComfortTarget\.value/)
})

test("maps dry flakes to dry rather than dandruff and keeps conditional thicknesses out of payload", () => {
  const input = completeInput()
  input.scalpTargets.primary = {
    target: "dry",
    confidence: "high",
    rationale: "Dry-flake positioning and a compatible mild formula.",
    positioningEvidenceRefs: ["positioning:manufacturer"],
    formulaEvidenceRefs: ["formula:canonical"],
  }
  input.properties.cleansingStrength = property("low")
  input.properties.scalpComfortTarget = property("targeted")
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status !== "property_lane_ready") return
  assert.deepEqual(
    outcome.payload.category_specs.product_shampoo_specs.map((row) => [
      row.shampoo_bucket,
      row.scalp_route,
      row.cleansing_intensity,
    ]),
    [
      ["trocken", "dry", "gentle"],
      ["trocken", "dry", "gentle"],
    ],
  )
  assert.equal(
    outcome.payload.category_specs.product_shampoo_specs.some(
      (row) => row.scalp_route === "dandruff",
    ),
    false,
  )
  assert.deepEqual(outcome.summary.conditionalThicknesses, ["coarse"])
})

test("requires the recognized active plus exact anti-dandruff positioning before emitting a treatment row", () => {
  const input = completeInput()
  input.scalpTargets.primary = {
    target: "dandruff",
    confidence: "high",
    rationale: "Exact anti-dandruff positioning.",
    positioningEvidenceRefs: ["positioning:manufacturer"],
    formulaEvidenceRefs: ["formula:piroctone-olamine"],
    exactAntiDandruffPositioning: true,
  }
  input.properties.dandruffSupport = property("supported")
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status !== "property_lane_ready") return
  assert.equal(
    outcome.payload.category_specs.product_shampoo_specs.every(
      (row) => row.shampoo_bucket === "schuppen" && row.scalp_route === "dandruff",
    ),
    true,
  )
  assert.deepEqual(outcome.payload.required_protocol_roles, ["shampoo_dandruff"])
})

test("preserves strong cleansing for a sensitive shampoo as regular rather than rejecting the supported route", () => {
  const input = completeInput()
  input.scalpTargets.primary = {
    target: "sensitive",
    confidence: "high",
    rationale: "Sensitive positioning and coherent formula.",
    positioningEvidenceRefs: ["positioning:manufacturer"],
    formulaEvidenceRefs: ["formula:canonical"],
  }
  input.properties.scalpComfortTarget = property("targeted")
  input.properties.cleansingStrength = property("strong")
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status !== "property_lane_ready") return
  assert.equal(
    outcome.payload.category_specs.product_shampoo_specs[0].cleansing_intensity,
    "regular",
  )
  assert.equal(
    outcome.payload.category_specs.product_shampoo_specs[0].shampoo_bucket,
    "irritationen",
  )
})

test("only an alternating strong clarifier becomes clarifying; ordinary strong remains regular", () => {
  const ordinaryStrong = completeInput()
  ordinaryStrong.properties.cleansingStrength = property("strong")
  const ordinary = projectShampooProductionLight(ordinaryStrong)
  assert.equal(ordinary.status, "property_lane_ready")
  if (ordinary.status === "property_lane_ready")
    assert.equal(
      ordinary.payload.category_specs.product_shampoo_specs[0].cleansing_intensity,
      "regular",
    )

  const alternating = completeInput()
  alternating.properties.cleansingStrength = property("strong")
  alternating.properties.focusPrimary = property("clarifying")
  alternating.properties.usageRole = property("alternating")
  const outcome = projectShampooProductionLight(alternating)
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status === "property_lane_ready")
    assert.equal(
      outcome.payload.category_specs.product_shampoo_specs[0].cleansing_intensity,
      "clarifying",
    )

  const alternatingButNotClarifying = completeInput()
  alternatingButNotClarifying.properties.cleansingStrength = property("strong")
  alternatingButNotClarifying.properties.usageRole = property("alternating")
  const stillRegular = projectShampooProductionLight(alternatingButNotClarifying)
  assert.equal(stillRegular.status, "property_lane_ready")
  if (stillRegular.status === "property_lane_ready")
    assert.equal(
      stillRegular.payload.category_specs.product_shampoo_specs[0].cleansing_intensity,
      "regular",
    )

  const secondaryClarifying = completeInput()
  secondaryClarifying.properties.cleansingStrength = property("strong")
  secondaryClarifying.properties.usageRole = property("alternating")
  secondaryClarifying.properties.focusSecondary = {
    value: ["clarifying"],
    confidence: "high",
    rationale: "Independent reset positioning evidence.",
    evidenceRefs: ["positioning:clarifying"],
  }
  const secondaryOutcome = projectShampooProductionLight(secondaryClarifying)
  assert.equal(secondaryOutcome.status, "property_lane_ready")
  if (secondaryOutcome.status === "property_lane_ready")
    assert.equal(
      secondaryOutcome.payload.category_specs.product_shampoo_specs[0].cleansing_intensity,
      "clarifying",
    )
})

test("creates a deterministic cross-product for an independently evidenced dual scalp target", () => {
  const input = completeInput()
  input.scalpTargets.secondary = {
    target: "oily",
    confidence: "high",
    rationale: "Separate sebum positioning and formula evidence.",
    positioningEvidenceRefs: ["positioning:manufacturer-oily"],
    formulaEvidenceRefs: ["formula:surfactant-system"],
    independentlySupported: true,
  }
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status !== "property_lane_ready") return
  assert.equal(outcome.payload.category_specs.product_shampoo_specs.length, 4)
  assert.deepEqual(outcome.payload.required_protocol_roles, ["shampoo_everyday"])
})

test("rejects malformed or incomplete envelopes before they can create rows", () => {
  const input = completeInput() as Record<string, unknown>
  delete (input.properties as Record<string, unknown>).conditioningLevel
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "needs_research")
  assert.match(outcome.reasons.join("\n"), /properties\.conditioningLevel/)
})

test("blocks low-confidence or conflicted identity and unresolved canonical formula", () => {
  const lowIdentity = completeInput()
  lowIdentity.identity.confidence = "low"
  assert.equal(projectShampooProductionLight(lowIdentity).status, "needs_research")

  const conflict = completeInput()
  conflict.identity.conflictStatus = "material_conflict"
  const conflictOutcome = projectShampooProductionLight(conflict)
  assert.equal(conflictOutcome.status, "needs_research")
  if (conflictOutcome.status === "needs_research")
    assert.match(conflictOutcome.reasons.join("\n"), /conflictStatus/)

  const unresolvedFormula = completeInput()
  unresolvedFormula.formula.status = "unresolved"
  assert.equal(projectShampooProductionLight(unresolvedFormula).status, "needs_research")

  const noConflict = completeInput()
  noConflict.identity.conflictStatus = "none"
  assert.equal(projectShampooProductionLight(noConflict).status, "property_lane_ready")
})

test("requires sensitive or dry targets to be explicitly scalp-comfort targeted", () => {
  const input = completeInput()
  input.scalpTargets.primary = {
    target: "sensitive",
    confidence: "high",
    rationale: "Sensitive positioning.",
    positioningEvidenceRefs: ["positioning:sensitive"],
    formulaEvidenceRefs: ["formula:canonical"],
  }
  const outcome = projectShampooProductionLight(input)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status === "needs_research")
    assert.match(outcome.reasons.join("\n"), /scalpComfortTarget/)
})

test("rejects invalid or canonical-duplicate GTINs and formula-source or fingerprint mismatches", () => {
  const invalidGtin = completeInput()
  invalidGtin.identity.gtinAliases = ["4006381333932"]
  const invalidGtinOutcome = projectShampooProductionLight(invalidGtin)
  assert.equal(invalidGtinOutcome.status, "needs_research")
  if (invalidGtinOutcome.status === "needs_research")
    assert.match(invalidGtinOutcome.reasons.join("\n"), /GS1/)

  const duplicateGtin = completeInput()
  duplicateGtin.identity.gtinAliases = ["4006381333931", "04006381333931"]
  const duplicateGtinOutcome = projectShampooProductionLight(duplicateGtin)
  assert.equal(duplicateGtinOutcome.status, "needs_research")
  if (duplicateGtinOutcome.status === "needs_research")
    assert.match(duplicateGtinOutcome.reasons.join("\n"), /unique after canonicalization/)

  const missingFormulaSource = completeInput()
  missingFormulaSource.formula.canonicalSource = "preferred_retailer_de"
  const sourceOutcome = projectShampooProductionLight(missingFormulaSource)
  assert.equal(sourceOutcome.status, "needs_research")
  if (sourceOutcome.status === "needs_research")
    assert.match(sourceOutcome.reasons.join("\n"), /canonicalSource/)

  const badFingerprint = completeInput()
  badFingerprint.formula.inciFingerprintSha256 = "b".repeat(64)
  const fingerprintOutcome = projectShampooProductionLight(badFingerprint)
  assert.equal(fingerprintOutcome.status, "needs_research")
  if (fingerprintOutcome.status === "needs_research")
    assert.match(fingerprintOutcome.reasons.join("\n"), /inciFingerprintSha256/)
})

test("requires exact pinned Shampoo v1.4 research-method metadata", () => {
  const driftedMethod = completeInput() as unknown as { researchMethod: Record<string, string> }
  driftedMethod.researchMethod.policySha256 = "0".repeat(64)
  const outcome = projectShampooProductionLight(driftedMethod)
  assert.equal(outcome.status, "needs_research")
  if (outcome.status === "needs_research")
    assert.match(outcome.reasons.join("\n"), /researchMethod\.policySha256/)
})

test("requires explicit independent support for a secondary target and warns for unpositioned dandruff support", () => {
  const unsupportedSecondary = completeInput() as unknown as {
    scalpTargets: { secondary?: Record<string, unknown> }
  }
  unsupportedSecondary.scalpTargets.secondary = {
    target: "oily",
    confidence: "high",
    rationale: "No explicit independent support flag.",
    positioningEvidenceRefs: ["positioning:oily"],
    formulaEvidenceRefs: ["formula:canonical"],
  }
  const invalid = projectShampooProductionLight(unsupportedSecondary)
  assert.equal(invalid.status, "needs_research")
  if (invalid.status === "needs_research")
    assert.match(invalid.reasons.join("\n"), /independentlySupported/)

  const activeWithoutPositionedTreatment = completeInput()
  activeWithoutPositionedTreatment.properties.dandruffSupport = property("supported")
  const outcome = projectShampooProductionLight(activeWithoutPositionedTreatment)
  assert.equal(outcome.status, "property_lane_ready")
  if (outcome.status === "property_lane_ready")
    assert.match(outcome.warnings.join("\n"), /no exact anti-dandruff positioning/)
})

test("rejects invalid secondary-focus values and renders a stable Markdown review summary", () => {
  const invalidFocus = completeInput() as unknown as {
    properties: { focusSecondary: { value: string[] } }
  }
  invalidFocus.properties.focusSecondary.value = ["general"]
  assert.equal(projectShampooProductionLight(invalidFocus).status, "needs_research")

  const outcome = projectShampooProductionLight(completeInput())
  const markdown = renderShampooProductionLightMarkdown(outcome)
  assert.match(markdown, /Status: property_lane_ready/)
  assert.match(markdown, /Version: shampoo-production-light-v1/)
  assert.match(markdown, /Product: Ordinary Shampoo \(ordinary-shampoo\)/)
  assert.match(markdown, /Ordinary Shampoo/)
  assert.match(markdown, /\| fine \| normal \| balanced \| regular \|/)
  assert.match(markdown, /Conditional thicknesses \(not emitted\): coarse/)
  assert.match(markdown, /Projected rationale and confidence/)
  assert.match(markdown, /Warnings/)
})
