import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test, { after } from "node:test"

import { conditionerProfileFieldEvidence } from "../src/lib/conditioner-research/profile-evidence"
import {
  conditionerReviewFingerprint,
  saveConditionerLabReviewState,
} from "../src/lib/conditioner-research/review-state"
import {
  getConditionerResearchLabData,
  getConditionerResearchProductDetail,
  isConditionerResearchLabEnabled,
} from "../src/lib/labs/conditioner-research-access"

const mutableEnv = process.env as Record<string, string | undefined>
const ambientReviewPath = mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
const ambientReworkPath = mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
const isolatedStoreDirectory = mkdtempSync(path.join(tmpdir(), "conditioner-access-default-state-"))
mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = path.join(
  isolatedStoreDirectory,
  "lab-review-state.json",
)
mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH = path.join(
  isolatedStoreDirectory,
  "rework-queue.json",
)

after(() => {
  if (ambientReviewPath === undefined) delete mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
  else mutableEnv.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = ambientReviewPath
  if (ambientReworkPath === undefined) delete mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH
  else mutableEnv.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH = ambientReworkPath
  rmSync(isolatedStoreDirectory, { recursive: true, force: true })
})

test("Conditioner research lab is development-only", () => {
  assert.equal(isConditionerResearchLabEnabled({ NODE_ENV: "development" }), true)
  assert.equal(isConditionerResearchLabEnabled({ NODE_ENV: "test" }), false)
  assert.equal(isConditionerResearchLabEnabled({ NODE_ENV: "production" }), false)
})

test("Conditioner v1.6 logic lock preserves separate product and production gates", () => {
  const receiptPath = path.join(
    process.cwd(),
    "data/research/conditioner-inci/v1.0/v1.6-logic-lock-receipt.json",
  )
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
    locked_standard_version: string
    decision: string
    review_source_snapshot: {
      version: string
      path: string
      bytes: number
      sha256: string
    }
    reviewed_anchor_patterns: Array<{
      care_direction: string
      repair_support_level: string
    }>
    validation_basis: {
      review_source_standard_version: string
      promotion_rule_change: boolean
      promotion_note: string
      promotion_clarifications: string[]
      new_field_exact_cells: number
      new_field_total_cells: number
      composite_exact_cells: number
      composite_total_cells: number
      full_nine_field_de_novo_rerun: boolean
      historical_stress_suite_covers_new_fields: boolean
    }
    separate_gates: {
      individual_product_lab_approval: string
      catalog_activation: boolean
      production_database_write: boolean
    }
  }

  assert.equal(receipt.locked_standard_version, "1.6")
  assert.equal(receipt.decision, "approved_and_locked_for_reuse")
  assert.deepEqual(receipt.review_source_snapshot, {
    version: "1.6-rc1",
    path: "docs/research/conditioner-inci/v1.0/conditioner-classification-standard.v1.6-rc1.md",
    bytes: 24808,
    sha256: "f317b8514ecc72e14ea97220c99dbe01ba528e408f2b4f211264bced79a157a8",
  })
  assert.deepEqual(
    receipt.reviewed_anchor_patterns.map((anchor) => [
      anchor.care_direction,
      anchor.repair_support_level,
    ]),
    [
      ["protein", "medium"],
      ["balanced", "medium"],
      ["moisture", "high"],
    ],
  )
  assert.deepEqual(receipt.validation_basis, {
    review_source_standard_version: "1.6-rc1",
    promotion_rule_change: false,
    promotion_note:
      "Final v1.6 preserves the reviewed care-direction and repair-support thresholds, routes, evidence ceiling, and accepted product classifications. Finalization also clarifies that a specialist Damage Fit result is exactly moderately_damaged plus highly_damaged, matching the existing accepted key and Lab behavior rather than adding a third value.",
    promotion_clarifications: [
      "Damage Fit specialist output shape is an exact two-value replacement set, not an append operation.",
    ],
    new_field_exact_cells: 22,
    new_field_total_cells: 22,
    composite_exact_cells: 85,
    composite_total_cells: 99,
    full_nine_field_de_novo_rerun: false,
    historical_stress_suite_covers_new_fields: false,
  })
  assert.equal(receipt.separate_gates.individual_product_lab_approval, "required")
  assert.equal(receipt.separate_gates.catalog_activation, false)
  assert.equal(receipt.separate_gates.production_database_write, false)
})

test("Conditioner v1.6 manifest binds the locked standard and retained review snapshot", () => {
  const manifestPath = path.join(
    process.cwd(),
    "data/research/conditioner-inci/v1.0/artifact-manifest.json",
  )
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    schema_version: string
    normative_source: { path: string; bytes: number; sha256: string }
    review_source_snapshot: { path: string; bytes: number; sha256: string }
    reading_copies: Array<{ path: string; bytes: number; sha256: string }>
    logic_lock_receipt: { path: string; bytes: number; sha256: string }
    production_writes: boolean
  }

  assert.equal(manifest.schema_version, "conditioner-stage-a-artifact-manifest.v1.6")
  assert.equal(manifest.production_writes, false)

  const artifacts = [
    manifest.normative_source,
    manifest.review_source_snapshot,
    ...manifest.reading_copies,
    manifest.logic_lock_receipt,
  ]
  for (const artifact of artifacts) {
    const artifactPath = path.join(process.cwd(), artifact.path)
    const contents = readFileSync(artifactPath)
    assert.equal(statSync(artifactPath).size, artifact.bytes, artifact.path)
    assert.equal(
      createHash("sha256").update(contents).digest("hex"),
      artifact.sha256,
      artifact.path,
    )
  }

  const standard = readFileSync(path.join(process.cwd(), manifest.normative_source.path), "utf8")
  assert.match(standard, /^# Conditioner Research and Classification Standard v1\.6/m)
  assert.match(standard, /^Status: locked reusable nine-property research authority$/m)
})

test("Conditioner research lab joins the locked 12-product pilot in formula order", () => {
  const data = getConditionerResearchLabData()

  assert.deepEqual(data.summary, {
    completeProfiles: 11,
    sourceConflicts: 0,
    excluded: 1,
    reviewCounts: { approved: 0, reworkOpen: 0, needsReview: 12, excluded: 0 },
  })
  assert.equal(data.queueItems.length, 12)
  assert.equal(data.queueItems[0]?.productId, "483b41d6-632c-4efe-9bcc-488c80bf5bb7")
  assert.equal(data.queueItems.at(-1)?.productId, "7539ab79-f4f6-49d7-9269-08034ef4de96")
  assert.equal(data.initialDetail.productId, data.queueItems[0]?.productId)
  assert.equal(data.calibration.preAdjudication.totalCells, 99)
  assert.equal(data.calibration.postAdjudication.totalCells, 99)
  assert.equal(data.calibration.preAdjudication.exactCells, 94)
  assert.equal(data.calibration.postAdjudication.exactCells, 85)
  assert.deepEqual(data.calibration.nonFocusAgreement, { exactCells: 68, totalCells: 77 })
  assert.deepEqual(data.calibration.damageFitDistribution, {
    healthyOnly: 0,
    healthyModerate: 8,
    moderateHigh: 3,
  })
  assert.equal(data.calibration.semanticDifferences.length, 14)
  assert.equal(data.calibration.remainingDifferences.length, 14)
  assert.equal(data.calibration.focusDecisions.length, 9)
  assert.equal(data.calibration.evidenceCaveats.length, 3)
  assert.match(data.calibration.evidenceCaveats.join(" "), /three-value care-direction taxonomy/)
  assert.match(data.calibration.semanticDifferences[0] ?? "", /akzeptiert .*Blind-Review/)
  assert.equal(data.calibration.stress, "5/5")
  assert.equal(data.initialDetail.standardVersion, "1.6")
  assert.equal(
    data.queueItems.every((item) => /^[a-f0-9]{64}$/.test(item.formulaFingerprint)),
    true,
  )
})

test("Conditioner queue distinguishes accepted-key evidence caveats from focus review", () => {
  const neqi = getConditionerResearchProductDetail("952a4834-e451-4dc3-ba19-ebb8927eb5e4")
  const guhl = getConditionerResearchProductDetail("11d42d9d-b8d8-42ae-a432-9a3d0f9d3504")
  assert.equal(neqi?.statusLabel, "Eigenschaft prüfen")
  assert.deepEqual(neqi?.uncertainFields, ["weight_potential"])
  const neqiFields = new Map(neqi?.profile?.fields.map((field) => [field.path, field.value]))
  assert.equal(neqiFields.get("weight_potential"), "moderate")
  assert.equal(neqiFields.get("hair_thickness_fit"), "fine · medium · coarse")
  assert.equal(guhl?.statusLabel, "Vollständig")
  assert.deepEqual(guhl?.uncertainFields, [])
})

test("Conditioner research detail preserves resolved Bali formula authority and excludes Cantu from profiling", () => {
  const bali = getConditionerResearchProductDetail("8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe")
  assert.ok(bali)
  assert.equal(bali.sourceConflict, false)
  assert.equal(bali.formulaStatus, "verified")
  assert.equal(bali.sources[0]?.type, "manufacturer")
  assert.equal(
    bali.sources.some((source) => source.type === "retailer_exact_gtin"),
    true,
  )
  assert.equal(bali.profile?.fields.length, 9)
  assert.equal(
    bali.profile?.fields.some((field) => field.path === "rinseability"),
    false,
  )
  assert.equal(
    bali.profile?.fields.some((field) => field.path === "usage_role"),
    false,
  )
  assert.equal(
    bali.profile?.fields.some((field) => field.path === "scalp_application_fit"),
    false,
  )

  const cantu = getConditionerResearchProductDetail("7539ab79-f4f6-49d7-9269-08034ef4de96")
  assert.ok(cantu)
  assert.equal(cantu.profile, null)
  assert.match(cantu.boundaryExplanation ?? "", /leave-in/i)
  assert.equal(getConditionerResearchProductDetail("does-not-exist"), null)
})

test("Conditioner research detail preserves normalized INCI as one canonical formula string", () => {
  const detail = getConditionerResearchProductDetail("483b41d6-632c-4efe-9bcc-488c80bf5bb7")
  assert.equal(typeof detail?.formula.normalizedInci, "string")
  assert.match(String(detail?.formula.normalizedInci), /CETYL ALCOHOL/)
  assert.doesNotMatch(String(detail?.formula.normalizedInci), /CETYL · ALCOHOL/)
})

test("historical blind-review fields remain inert provenance in the nine-field contract", () => {
  const fixturePath = path.join(
    process.cwd(),
    "data/research/conditioner-inci/v1.0/calibration-full-profile-reviewer-f.json",
  )
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    profiles: Array<Record<string, unknown>>
  }
  assert.equal(fixture.profiles[0]?.usage_role, "regular")
  assert.equal(fixture.profiles[0]?.scalp_application_fit, "conditional")

  const detail = getConditionerResearchProductDetail(String(fixture.profiles[0]?.product_id))
  assert.deepEqual(
    detail?.profile?.fields.map((field) => field.path),
    [
      "conditioning_level",
      "weight_potential",
      "care_direction",
      "repair_support_level",
      "primary_focus",
      "secondary_focus",
      "hair_thickness_fit",
      "damage_fit",
      "texture_fit",
    ],
  )
})

test("Conditioner research detail preserves calibrated Jean&Len values without a rinseability field", () => {
  const jeanAndLen = getConditionerResearchProductDetail("4f67cb6d-4b28-490b-9817-e8fc8e91b010")
  assert.ok(jeanAndLen?.profile)
  const fields = new Map(jeanAndLen.profile.fields.map((field) => [field.path, field.value]))
  assert.equal(fields.get("conditioning_level"), "high")
  assert.equal(fields.get("weight_potential"), "moderate")
  assert.equal(fields.has("rinseability"), false)
})

test("Conditioner Damage Fit reserves highly damaged for a distinct specialist route", () => {
  const expected = new Map([
    ["483b41d6-632c-4efe-9bcc-488c80bf5bb7", "healthy · moderately_damaged"],
    ["a6730d6f-df2f-4ebf-8013-eb39162f15df", "healthy · moderately_damaged"],
    ["5516009a-eecb-42dd-87f6-07c560161136", "healthy · moderately_damaged"],
    ["952a4834-e451-4dc3-ba19-ebb8927eb5e4", "moderately_damaged · highly_damaged"],
    ["62ff4f08-3ff2-49f3-9e93-e6fd0f395a4d", "healthy · moderately_damaged"],
    ["11d42d9d-b8d8-42ae-a432-9a3d0f9d3504", "healthy · moderately_damaged"],
    ["4fca59e5-fbc4-4132-a821-dac6ff0cdb68", "moderately_damaged · highly_damaged"],
    ["d8ac8909-91a1-46b3-9fa6-2ff66b78fb66", "healthy · moderately_damaged"],
    ["4f67cb6d-4b28-490b-9817-e8fc8e91b010", "healthy · moderately_damaged"],
    ["8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe", "healthy · moderately_damaged"],
    ["9f8da740-87b6-45e0-ab86-d77d63f2e22b", "moderately_damaged · highly_damaged"],
  ])

  for (const [productId, value] of expected) {
    const detail = getConditionerResearchProductDetail(productId)
    const damage = detail?.profile?.fields.find((field) => field.path === "damage_fit")
    assert.equal(damage?.value, value, detail?.productName)
    assert.match(damage?.thresholdReasoning.join(" ") ?? "", /Why not/i, detail?.productName)
    assert.doesNotMatch(
      damage?.thresholdReasoning.join(" ") ?? "",
      /Lubrication=candidate.*therefore/i,
      detail?.productName,
    )
    assert.notEqual(damage?.value, "healthy · moderately_damaged · highly_damaged")
  }

  const neqi = getConditionerResearchProductDetail("952a4834-e451-4dc3-ba19-ebb8927eb5e4")
  const ogx = getConditionerResearchProductDetail("4fca59e5-fbc4-4132-a821-dac6ff0cdb68")
  const bond = getConditionerResearchProductDetail("9f8da740-87b6-45e0-ab86-d77d63f2e22b")
  assert.match(
    neqi?.profile?.fields
      .find((field) => field.path === "damage_fit")
      ?.thresholdReasoning.join(" ") ?? "",
    /Avena Sativa Oat Peptide.*INCI #6.*distinct.*peptide/i,
  )
  assert.match(
    ogx?.profile?.fields
      .find((field) => field.path === "damage_fit")
      ?.thresholdReasoning.join(" ") ?? "",
    /Hydrolyzed Collagen.*INCI #6.*distinct.*protein/i,
  )
  assert.match(
    bond?.profile?.fields
      .find((field) => field.path === "damage_fit")
      ?.thresholdReasoning.join(" ") ?? "",
    /Hydroxypropylgluconamide.*INCI #7.*Hydroxypropylammonium Gluconate.*INCI #10.*bond/i,
  )
})

test("Conditioner primary-focus reasoning covers every specialist focus that can be selected", () => {
  const baseInput = {
    productId: "future-focus-fixture",
    rawInci: "Aqua, Cetearyl Alcohol, Cetrimonium Chloride, Dimethicone, Benzophenone-4",
    profile: {
      conditioningLevel: "high",
      weightPotential: "moderate",
      careDirection: "moisture",
      repairSupportLevel: "low",
      primaryFocus: "shine",
      secondaryFocus: ["smoothing"],
      hairThicknessFit: ["medium"],
      damageFit: ["moderately_damaged"],
      textureFit: ["wavy"],
      assumptionNotes: [],
    },
    direct: {
      conditioningDepositionPotential: "higher",
      wetSlipDetanglingPotential: "higher",
      dryCombabilityPotential: "higher",
      smoothingFrizzControlPotential: "higher",
      weightDepositionPotential: "moderate",
      bodyLightnessPotential: "neutral",
      repairLubricationProtection: "moderate",
      repairSurfaceFilm: "moderate",
      bondSpecificSupport: "none",
      colorChemicalDamageProtection: "moderate",
      rationale: "Synthetic vocabulary coverage fixture.",
      routes: ["R1", "R4"],
    },
    directionsSummary: "Apply to lengths and rinse thoroughly.",
    applicationArea: "lengths_and_ends",
  }

  for (const focus of ["shine", "detangling"]) {
    const evidence = conditionerProfileFieldEvidence({
      ...baseInput,
      profile: { ...baseInput.profile, primaryFocus: focus },
    }).primary_focus.thresholdReasoning.join(" ")
    assert.match(evidence, new RegExp(`therefore ${focus}|${focus}.*research headline`, "i"))
    assert.doesNotMatch(evidence, /therefore general/i)
  }
})

test("Conditioner profile fields expose product-specific ingredient or derivation evidence", () => {
  const data = getConditionerResearchLabData()
  for (const item of data.queueItems.filter((entry) => !entry.excluded)) {
    const detail = getConditionerResearchProductDetail(item.productId)
    assert.equal(detail?.profile?.fields.length, 9)
    for (const field of detail?.profile?.fields ?? []) {
      assert.notEqual(field.rationale, "Aus Formelarchitektur und belegter Anwendung abgeleitet.")
      assert.ok(field.evidenceSignals.length > 0, `${item.productName} ${field.path}`)
      assert.ok(field.derivation.length > 20, `${item.productName} ${field.path}`)
      assert.ok(field.thresholdReasoning.length >= 2, `${item.productName} ${field.path}`)
      assert.match(
        field.thresholdReasoning.join(" "),
        /INCI #/,
        `${item.productName} ${field.path}`,
      )
      assert.ok(field.limitations.length > 0, `${item.productName} ${field.path}`)
      assert.doesNotMatch(
        [
          field.rationale,
          field.derivation,
          ...field.thresholdReasoning,
          ...field.limitations,
          ...field.evidenceSignals,
        ].join(" "),
        /\b(?:Das|Die|Dies|Warum|nicht|keine|wird|folgt|deshalb|Anwendungshinweis|Anwendungsbereich)\b/i,
        `${item.productName} ${field.path} should expose English evidence reasoning`,
      )
      assert.doesNotMatch(
        field.thresholdReasoning.join(" "),
        /1 weitere gelistete Signale/,
        `${item.productName} ${field.path}`,
      )
    }
    const weight = detail?.profile?.fields.find((field) => field.path === "weight_potential")
    const texture = detail?.profile?.fields.find((field) => field.path === "texture_fit")
    if (weight?.value === "high" && texture?.value.includes("coily")) {
      assert.doesNotMatch(
        texture.thresholdReasoning.join(" "),
        /Lean-Weight-Fallback/i,
        `${item.productName} texture_fit`,
      )
    }
  }

  const neqi = getConditionerResearchProductDetail("952a4834-e451-4dc3-ba19-ebb8927eb5e4")
  const neqiWeight = neqi?.profile?.fields.find((field) => field.path === "weight_potential")
  assert.equal(neqiWeight?.evidenceBasis, "formula_inference_with_policy_fallback")
  assert.match(neqiWeight?.evidenceSignals.join(" ") ?? "", /Myristyl Alcohol.*INCI #2/)

  const cantu = getConditionerResearchProductDetail("d8ac8909-91a1-46b3-9fa6-2ff66b78fb66")
  const cantuCare = cantu?.profile?.fields.find((field) => field.path === "care_direction")
  assert.equal(cantuCare?.value, "moisture")
  assert.match(cantuCare?.evidenceSignals.join(" ") ?? "", /Panthenol \(INCI #14\)/)
  assert.doesNotMatch(cantuCare?.evidenceSignals.join(" ") ?? "", /Ethylhexylglycerin/)
  assert.match(neqiWeight?.evidenceSignals.join(" ") ?? "", /Amodimethicone.*INCI #13/)
  assert.match(neqiWeight?.rationale ?? "", /higher.*moderate|höher.*moderat/i)
  assert.match(neqiWeight?.thresholdReasoning.join(" ") ?? "", /not high|rather than high/i)
  assert.match(neqiWeight?.thresholdReasoning.join(" ") ?? "", /Myristyl Alcohol.*INCI #2/)
  const neqiDamage = neqi?.profile?.fields.find((field) => field.path === "damage_fit")
  assert.match(neqiDamage?.evidenceSignals.join(" ") ?? "", /Amodimethicone.*INCI #13/)
  const neqiTexture = neqi?.profile?.fields.find((field) => field.path === "texture_fit")
  assert.match(neqiTexture?.thresholdReasoning.join(" ") ?? "", /Wet Slip=higher/)
  assert.match(neqiTexture?.thresholdReasoning.join(" ") ?? "", /Why not straight/i)
  assert.match(neqiTexture?.thresholdReasoning.join(" ") ?? "", /moderate Lean-Weight-Fallback/i)

  const aqua = getConditionerResearchProductDetail("a6730d6f-df2f-4ebf-8013-eb39162f15df")
  const aquaWeight = aqua?.profile?.fields.find((field) => field.path === "weight_potential")
  assert.match(aquaWeight?.evidenceSignals.join(" ") ?? "", /Cetearyl Alcohol.*INCI #2/)
  assert.match(aquaWeight?.derivation ?? "", /compact.*without.*silicone/i)
  assert.match(aquaWeight?.thresholdReasoning.join(" ") ?? "", /low rather than moderate/i)
  const aquaConditioning = aqua?.profile?.fields.find(
    (field) => field.path === "conditioning_level",
  )
  assert.match(aquaConditioning?.thresholdReasoning.join(" ") ?? "", /Why not low/i)
  assert.match(aquaConditioning?.thresholdReasoning.join(" ") ?? "", /Why not high/i)
  assert.match(
    aquaConditioning?.thresholdReasoning.join(" ") ?? "",
    /Cetearyl Alcohol.*INCI #2.*Stearamidopropyl Dimethylamine.*INCI #3/i,
  )
  assert.match(
    aquaConditioning?.thresholdReasoning.join(" ") ?? "",
    /no additional.*deposition|additional.*route.*not.*supported/i,
  )
  const baleaMedProduct = getConditionerResearchProductDetail(
    "483b41d6-632c-4efe-9bcc-488c80bf5bb7",
  )
  const baleaMedConditioning = baleaMedProduct?.profile?.fields.find(
    (field) => field.path === "conditioning_level",
  )
  assert.equal(baleaMedConditioning?.value, "high")
  assert.match(
    baleaMedConditioning?.thresholdReasoning.join(" ") ?? "",
    /Cetrimonium Chloride.*INCI #4.*Hydroxypropyl Guar Hydroxypropyltrimonium Chloride.*INCI #8/i,
  )
  assert.match(
    baleaMedConditioning?.thresholdReasoning.join(" ") ?? "",
    /Dicaprylyl Ether.*INCI #5|Isopropyl Palmitate.*INCI #6/i,
  )
  assert.match(
    baleaMedConditioning?.thresholdReasoning.join(" ") ?? "",
    /high rather than moderate/i,
  )
  const aquaDamage = aqua?.profile?.fields.find((field) => field.path === "damage_fit")
  assert.match(aquaDamage?.rationale ?? "", /comparative prior.*distinct damage-specialist route/i)
  assert.doesNotMatch(aquaDamage?.rationale ?? "", /visible.*candidate/i)

  assert.equal(
    aqua?.profile?.fields.some((field) => field.path === "usage_role"),
    false,
  )
  assert.equal(
    aqua?.profile?.fields.some((field) => field.path === "scalp_application_fit"),
    false,
  )

  const hairFood = getConditionerResearchProductDetail("5516009a-eecb-42dd-87f6-07c560161136")
  const hairFoodConditioning = hairFood?.profile?.fields.find(
    (field) => field.path === "conditioning_level",
  )
  assert.match(
    hairFoodConditioning?.evidenceSignals.join(" ") ?? "",
    /Helianthus Annuus Seed Oil.*INCI #4/,
  )
  assert.match(
    hairFoodConditioning?.thresholdReasoning.join(" ") ?? "",
    /high rather than moderate/i,
  )
  const hairFoodPrimary = hairFood?.profile?.fields.find((field) => field.path === "primary_focus")
  assert.match(hairFoodPrimary?.thresholdReasoning.join(" ") ?? "", /Wet Slip=higher/)
  assert.match(
    hairFoodPrimary?.thresholdReasoning.join(" ") ?? "",
    /not a stronger individual measurement/i,
  )
  assert.doesNotMatch(
    hairFoodPrimary?.thresholdReasoning.join(" ") ?? "",
    /dominanter oder vollständiger/i,
  )

  const baleaMed = getConditionerResearchProductDetail("483b41d6-632c-4efe-9bcc-488c80bf5bb7")
  const baleaMedSecondary = baleaMed?.profile?.fields.find(
    (field) => field.path === "secondary_focus",
  )
  assert.doesNotMatch(
    baleaMedSecondary?.thresholdReasoning.join(" ") ?? "",
    /general bleibt der stärkste Differenziator/i,
  )
  assert.match(
    baleaMedSecondary?.thresholdReasoning.join(" ") ?? "",
    /no specialist route.*differentiation threshold/i,
  )
})

test("Conditioner care direction and repair support remain distinct formula properties", () => {
  const expected = new Map([
    ["483b41d6-632c-4efe-9bcc-488c80bf5bb7", ["moisture", "low"]],
    ["952a4834-e451-4dc3-ba19-ebb8927eb5e4", ["protein", "medium"]],
    ["4fca59e5-fbc4-4132-a821-dac6ff0cdb68", ["balanced", "medium"]],
    ["9f8da740-87b6-45e0-ab86-d77d63f2e22b", ["moisture", "high"]],
  ])

  for (const [productId, [careDirection, repairSupport]] of expected) {
    const detail = getConditionerResearchProductDetail(productId)
    const fields = new Map(detail?.profile?.fields.map((field) => [field.path, field]))
    assert.equal(fields.get("care_direction")?.value, careDirection, detail?.productName)
    assert.equal(fields.get("repair_support_level")?.value, repairSupport, detail?.productName)
    for (const path of ["care_direction", "repair_support_level"]) {
      const field = fields.get(path)
      assert.match(
        field?.evidenceSignals.join(" ") ?? "",
        /INCI #/,
        `${detail?.productName} ${path}`,
      )
      assert.match(
        field?.thresholdReasoning.join(" ") ?? "",
        /Why not/i,
        `${detail?.productName} ${path}`,
      )
      assert.match(
        field?.limitations.join(" ") ?? "",
        /E2|formula potential/i,
        `${detail?.productName} ${path}`,
      )
    }
  }
})

test("v1.6 preserves every existing v1.5 field fingerprint byte-for-byte", () => {
  const baseline = JSON.parse(
    readFileSync(
      path.join(
        process.cwd(),
        "data/research/conditioner-inci/v1.0/v1.5-existing-field-fingerprints.json",
      ),
      "utf8",
    ),
  ) as Record<string, Record<string, string>>

  for (const [productId, expectedFingerprints] of Object.entries(baseline)) {
    const detail = getConditionerResearchProductDetail(productId)
    assert.ok(detail, productId)
    for (const [path, fingerprint] of Object.entries(expectedFingerprints)) {
      assert.equal(detail.fieldFingerprints[path], fingerprint, `${detail.productName} ${path}`)
    }
    assert.equal(detail.propertyStatuses.care_direction, "unreviewed")
    assert.equal(detail.propertyStatuses.repair_support_level, "unreviewed")
  }
})

test("v1.6 keeps seven approved v1.5 fields and opens only the two new properties", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-access-v15-state-"))
  const filePath = path.join(directory, "lab-review-state.json")
  const previous = process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
  process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = filePath
  try {
    const productId = "483b41d6-632c-4efe-9bcc-488c80bf5bb7"
    const baseline = getConditionerResearchProductDetail(productId)
    assert.ok(baseline?.profile)
    const frozen = JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "data/research/conditioner-inci/v1.0/v1.5-existing-field-fingerprints.json",
        ),
        "utf8",
      ),
    ) as Record<string, Record<string, string>>
    const oldFingerprints = frozen[productId]!

    saveConditionerLabReviewState({
      filePath,
      snapshot: {
        productId,
        formulaFingerprint: baseline.formulaFingerprint,
        profileFingerprint: "a".repeat(64),
        standardVersion: "1.5-rc1",
        boundary: baseline.categoryBoundaryStatus,
        reviewStatus: "approved",
        propertyStatuses: Object.fromEntries(
          Object.keys(oldFingerprints).map((field) => [field, "approved" as const]),
        ),
        fieldFingerprints: oldFingerprints,
      },
      decision: {
        action: "approve_product",
        propertyPath: null,
        comment: null,
      },
    })

    const migrated = getConditionerResearchProductDetail(productId)
    for (const field of Object.keys(oldFingerprints)) {
      assert.equal(migrated?.propertyStatuses[field], "approved", field)
    }
    assert.equal(migrated?.propertyStatuses.care_direction, "unreviewed")
    assert.equal(migrated?.propertyStatuses.repair_support_level, "unreviewed")
    assert.equal(migrated?.reviewStatus, "needs_review")
    assert.equal(migrated?.staleReview, true)
  } finally {
    if (previous === undefined) delete process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
    else process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = previous
    rmSync(directory, { recursive: true, force: true })
  }
})

test("Conditioner review hydration retains exact field decisions and reopens changed evidence", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-access-state-"))
  const filePath = path.join(directory, "lab-review-state.json")
  const previous = process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
  process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = filePath
  try {
    const baseline = getConditionerResearchProductDetail("952a4834-e451-4dc3-ba19-ebb8927eb5e4")
    assert.ok(baseline?.profileFingerprint)
    saveConditionerLabReviewState({
      filePath,
      snapshot: {
        productId: baseline.productId,
        formulaFingerprint: baseline.formulaFingerprint,
        profileFingerprint: baseline.profileFingerprint,
        standardVersion: baseline.standardVersion,
        boundary: baseline.categoryBoundaryStatus,
        reviewStatus: "needs_review",
        propertyStatuses: { ...baseline.propertyStatuses, weight_potential: "approved" },
        fieldFingerprints: baseline.fieldFingerprints,
      },
      decision: {
        action: "approve_property",
        propertyPath: "weight_potential",
        comment: null,
      },
    })
    assert.equal(
      getConditionerResearchProductDetail(baseline.productId)?.propertyStatuses.weight_potential,
      "approved",
    )

    const changed = JSON.parse(readFileSync(filePath, "utf8"))
    changed.products[0].profileFingerprint = "c".repeat(64)
    changed.products[0].fieldFingerprints.weight_potential = "d".repeat(64)
    writeFileSync(filePath, `${JSON.stringify(changed, null, 2)}\n`, "utf8")
    const reopened = getConditionerResearchProductDetail(baseline.productId)
    assert.equal(reopened?.staleReview, true)
    assert.equal(reopened?.propertyStatuses.weight_potential, "unreviewed")
    assert.equal(reopened?.reviewStatus, "needs_review")
  } finally {
    if (previous === undefined) delete process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
    else process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = previous
    rmSync(directory, { recursive: true, force: true })
  }
})

test("Conditioner review hydration migrates unchanged legacy field hashes without reopening them", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "conditioner-access-legacy-state-"))
  const filePath = path.join(directory, "lab-review-state.json")
  const previous = process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
  process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = filePath
  try {
    const baseline = getConditionerResearchProductDetail("483b41d6-632c-4efe-9bcc-488c80bf5bb7")
    assert.ok(baseline?.profile)
    const legacyStandardVersion = "legacy-standard-version-fixture"
    const legacyFingerprints = Object.fromEntries(
      baseline.profile.fields.map((field) => [
        field.path,
        conditionerReviewFingerprint({
          productId: baseline.productId,
          formulaFingerprint: baseline.formulaFingerprint,
          standardVersion: legacyStandardVersion,
          path: field.path,
          value: field.value,
          rationale: field.rationale,
          evidenceBasis: field.evidenceBasis,
          evidenceSignals: field.evidenceSignals,
          derivation: field.derivation,
          thresholdReasoning: field.thresholdReasoning,
          limitations: field.limitations,
        }),
      ]),
    )
    legacyFingerprints.damage_fit = "d".repeat(64)

    saveConditionerLabReviewState({
      filePath,
      snapshot: {
        productId: baseline.productId,
        formulaFingerprint: baseline.formulaFingerprint,
        profileFingerprint: "p".repeat(64).replaceAll("p", "a"),
        standardVersion: legacyStandardVersion,
        boundary: baseline.categoryBoundaryStatus,
        reviewStatus: "approved",
        propertyStatuses: Object.fromEntries(
          baseline.profile.fields.map((field) => [field.path, "approved" as const]),
        ),
        fieldFingerprints: legacyFingerprints,
      },
      decision: {
        action: "approve_product",
        propertyPath: null,
        comment: null,
      },
    })

    const migrated = getConditionerResearchProductDetail(baseline.productId)
    assert.equal(migrated?.staleReview, true)
    assert.equal(migrated?.propertyStatuses.weight_potential, "approved")
    assert.equal(migrated?.propertyStatuses.damage_fit, "unreviewed")
    assert.equal(migrated?.reviewStatus, "needs_review")
  } finally {
    if (previous === undefined) delete process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH
    else process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH = previous
    rmSync(directory, { recursive: true, force: true })
  }
})
