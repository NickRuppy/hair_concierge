import assert from "node:assert/strict"
import test from "node:test"

import {
  coverageAuditFailures,
  enumerateReachableBasisMaskTargetWitnesses,
  type CoverageAuditObservation,
} from "../../../scripts/personal-plan/audit-stage3-production-coverage"

function observation(overrides: Partial<CoverageAuditObservation> = {}): CoverageAuditObservation {
  return {
    category: "mask",
    role: "intensive_conditioning_mask",
    candidateCount: 12,
    alternatives: [
      {
        category: "mask",
        role: "intensive_conditioning_mask",
        verdict: "ideal",
        coveredTargetCount: 3,
        recommendationProductId: "product-1",
        productId: "product-1",
        fingerprint: "facts-1",
      },
    ],
    ...overrides,
  }
}

test("coverage audit accepts a truthful complete alternative", () => {
  assert.deepEqual(coverageAuditFailures(observation()), [])
})

test("coverage audit fails closed on empty catalogue results", () => {
  assert.deepEqual(coverageAuditFailures(observation({ candidateCount: 0, alternatives: [] })), [
    "catalog_empty",
    "alternative_empty",
  ])
})

test("coverage audit rejects wrong-role, zero-coverage, stale recommendation evidence", () => {
  const value = observation()
  value.alternatives[0] = {
    ...value.alternatives[0]!,
    role: "post_wash_leave_in",
    coveredTargetCount: 0,
    recommendationProductId: "other-product",
    fingerprint: "",
  }
  assert.deepEqual(coverageAuditFailures(value), [
    "role_mismatch",
    "zero_target_coverage",
    "recommendation_identity_mismatch",
    "fingerprint_missing",
  ])
})

test("Basis Mask audit rejects an unavailable result without a source-bound ideal image", () => {
  const value = Object.assign(observation({ alternatives: [] }), {
    auditKind: "basis_mask_reachable_target",
    recommendation: null,
    presentation: null,
    explicitUnavailable: true,
  }) as CoverageAuditObservation

  assert.deepEqual(coverageAuditFailures(value), [
    "basis_mask_ideal_recommendation_missing",
    "basis_mask_ideal_presentation_missing",
  ])
})

test("Basis Mask audit enumerates the reachable deterministic target space", () => {
  const witnesses = enumerateReachableBasisMaskTargetWitnesses()
  const targets = witnesses.map(({ target }) => target)

  assert.ok(witnesses.length > 1)
  assert.deepEqual(
    new Set(targets.map(({ needStrength }) => needStrength)),
    new Set(["standard", "high"]),
  )
  assert.deepEqual(
    new Set(targets.map(({ weight }) => weight)),
    new Set(["light", "medium", "rich"]),
  )
  assert.deepEqual(
    new Set(targets.map(({ careDirection }) => careDirection)),
    new Set(["moisture", "balanced", "protein"]),
  )
  assert.deepEqual(
    new Set(targets.map(({ repairSupportLevel }) => repairSupportLevel)),
    new Set(["low", "medium", "high"]),
  )
  assert.ok(
    targets.some(
      (target) =>
        target.needStrength === "standard" &&
        target.weight === "light" &&
        target.careDirection === "moisture" &&
        target.repairSupportLevel === "medium" &&
        target.functionalNeeds.length === 0,
    ),
  )
  assert.ok(
    targets.some((target) =>
      target.functionalNeeds.some(
        ({ need, ownership }) => need === "smoothing_frizz_control" && ownership === "required",
      ),
    ),
  )
  assert.ok(
    targets.some((target) =>
      target.functionalNeeds.some(
        ({ need, ownership }) => need === "detangling_slip" && ownership === "required",
      ),
    ),
  )
  assert.equal(
    new Set(
      witnesses.map(({ hairThickness, target }) => `${hairThickness}:${JSON.stringify(target)}`),
    ).size,
    witnesses.length,
    "each target and thickness authority matrix is audited once",
  )
})
