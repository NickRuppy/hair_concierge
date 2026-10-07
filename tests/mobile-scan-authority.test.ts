import assert from "node:assert/strict"
import test from "node:test"
import { buildScanVerdict, type BuildScanVerdictInput } from "../src/lib/scan/resolve-verdict"
import { mobileAuthorityFailure } from "../src/lib/mobile/scan-service"
import {
  mobileAssessmentRows,
  mobileCriterionRows,
  mobileVerdictTitle,
} from "../src/lib/mobile/result-presentation"
import { presentScanVerdictPayload } from "../src/lib/scan/product-presentation"
import { maskScanVerdictPayload } from "../src/lib/scan/masked-alternative"
import type { Stage3ConditionerFacts } from "../src/lib/personal-plan/products/authority/contracts"

function input(): BuildScanVerdictInput {
  const facts: Stage3ConditionerFacts = {
    productId: "current",
    displayName: "Test",
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      { role: "conditioner_rinse_out", status: "verified_complete", fingerprint: "test" },
    ],
    factFingerprint: "test",
    spec: {
      thickness: "normal",
      proteinMoistureBalance: "moisture",
      weight: "light",
      repairSupportLevel: "medium",
      balanceDirection: "moisture",
      targetFit: "matched",
    },
  }
  return {
    category: "conditioner",
    decision: {
      category: "conditioner",
      resolution: "resolved",
      needTier: "basis",
      roles: ["conditioner_rinse_out"],
      target: {
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    productFacts: facts,
    recommendationCandidates: [],
    coverage: [],
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    refinedVersionId: "test",
    refinedInputHash: "test",
    alternativeSelection: "native",
  }
}

test("machine authority distinguishes missing product facts and unavailable personal targets", () => {
  const value = input()
  ;(value.productFacts as Stage3ConditionerFacts).spec.weight = null
  const incomplete = buildScanVerdict(value)
  assert.equal(incomplete.kind, "in_catalog")
  if (incomplete.kind !== "in_catalog") return
  assert.equal(incomplete.mobileAuthority?.status, "unknown")
  assert.deepEqual(mobileAuthorityFailure(incomplete), {
    kind: "submission_required",
    missingFacts: ["weight"],
  })
  value.decision.target = null
  const personal = buildScanVerdict(value)
  assert.equal(personal.kind, "in_catalog")
  if (personal.kind !== "in_catalog") return
  assert.equal(personal.mobileAuthority?.unsupportedReason, "conditioner_target_unavailable")
  assert.equal(mobileAuthorityFailure(personal).kind, "authority_unavailable")
  const mixed = {
    ...incomplete,
    mobileAuthority: {
      status: "unknown" as const,
      missingFacts: ["shampoo_bucket_target", "verified_protocol"],
      unsupportedReason: null,
    },
  }
  assert.equal(mobileAuthorityFailure(mixed).kind, "authority_unavailable")
})

test("missing catalog fact object is research; unresolved roles are personal context", () => {
  const value = input()
  value.productFacts = null
  let result = buildScanVerdict(value)
  assert.equal(result.kind, "in_catalog")
  if (result.kind === "in_catalog")
    assert.equal(mobileAuthorityFailure(result).kind, "submission_required")
  value.decision.roles = []
  result = buildScanVerdict(value)
  if (result.kind === "in_catalog")
    assert.equal(mobileAuthorityFailure(result).kind, "authority_unavailable")
})

test("compact categories expose every evaluated criterion beyond compact web schema", () => {
  const rows = mobileCriterionRows(
    "dry_shampoo",
    "root_refresh_bridge",
    [
      "identity.active",
      "sensitivity.verified",
      "tint.verified",
      "format.verified",
      "protocol.verified",
    ].map((id) => ({
      criterionId: `dry_shampoo.${id}`,
      label: id,
      result: "pass",
      explanation: "Bestätigte Produkteigenschaft.",
    })),
    null,
  )
  assert.equal(rows.length, 5)
  assert.ok(rows.every((row) => row.displayStatus === "green"))
  assert.ok(rows.every((row) => row.productStopIds.length === 1))
  const heat = mobileCriterionRows(
    "heat_protectant",
    "pre_heat_protection",
    [
      {
        criterionId: "heat_protectant.capability",
        label: "Hitzeschutz",
        result: "fail",
        explanation: "Nicht bestätigt.",
      },
    ],
    null,
  )
  assert.equal(heat[0].displayStatus, "red")
  const absent = mobileCriterionRows("heat_protectant", "pre_heat_protection", [], null)
  assert.equal(absent[0].displayStatus, "neutral")
})

test("native raw evidence is stripped from both full and masked web wire payloads", () => {
  const result = buildScanVerdict(input())
  assert.equal(result.kind, "in_catalog")
  if (result.kind !== "in_catalog") return
  for (const wire of [presentScanVerdictPayload(result, []), maskScanVerdictPayload(result)]) {
    assert.equal("mobileAuthority" in wire, false)
    assert.equal("mobileDimensions" in wire, false)
  }
})

test("native alternatives sort full eligible pool by verdict EUR price then id before max5", () => {
  const value = input()
  value.recommendationCandidates = Array.from({ length: 8 }, (_, index) => ({
    ...structuredClone(value.productFacts as Stage3ConditionerFacts),
    productId: `p${index}`,
    currency: index === 0 ? "USD" : "EUR",
    priceEur: index === 0 ? 0 : 9 - index,
    catalogSortOrder: index,
  }))
  const result = buildScanVerdict(value)
  assert.equal(result.kind, "in_catalog")
  if (result.kind !== "in_catalog") return
  assert.deepEqual(
    result.alternatives.map((a) => a.productId),
    ["p7", "p6", "p5", "p4", "p3"],
  )
  assert.ok(
    result.alternatives.every(
      (a) =>
        mobileAssessmentRows(
          "conditioner",
          "conditioner_rinse_out",
          a.productId,
          result.mobileDimensions ?? [],
          a.criteria ?? [],
          null,
        ).length === 4,
    ),
  )
  const web = buildScanVerdict({ ...value, alternativeSelection: "web" })
  if (web.kind === "in_catalog") assert.equal(web.alternatives.length, 3)
})

test("native title specializes an authoritative scalp-row failure", () => {
  const rows = mobileCriterionRows(
    "shampoo",
    "shampoo_everyday",
    [
      {
        criterionId: "shampoo.scalp_route",
        label: "Kopfhaut",
        result: "fail",
        explanation: "Passt nicht.",
      },
    ],
    null,
  )
  assert.equal(mobileVerdictTitle("mismatch", rows), "Passt nicht zu deiner Kopfhaut")
})

test("D3 reasons are explicitly distinguished from technical unavailable authority", () => {
  const value = input()
  value.decision.target = null
  const result = buildScanVerdict(value)
  if (result.kind !== "in_catalog") throw new Error("expected authority result")
  const personal = mobileAuthorityFailure(result)
  assert.equal(personal.kind, "authority_unavailable")
  if (personal.kind === "authority_unavailable")
    assert.equal(personal.reason, "personal_target_unavailable")
  const technical = mobileAuthorityFailure({
    ...result,
    mobileAuthority: {
      status: "unsupported",
      missingFacts: [],
      unsupportedReason: "unrecognized_engine_failure",
    },
  })
  if (technical.kind === "authority_unavailable")
    assert.equal(technical.reason, "temporarily_unavailable")
})

test("all compact category schemas remain visible and missing criteria are never green", () => {
  const cases = [
    ["shampoo", "shampoo_dandruff", 1],
    ["heat_protectant", "pre_heat_protection", 1],
    ["scalp_care", "scalp_comfort", 3],
    ["dry_shampoo", "root_refresh_bridge", 3],
    ["deep_cleansing_shampoo", "residue_reset", 2],
  ] as const
  for (const [category, role, count] of cases) {
    const rows = mobileCriterionRows(category, role, [], null)
    assert.equal(rows.length, count)
    assert.ok(rows.every((row) => row.displayStatus === "neutral"))
  }
})
