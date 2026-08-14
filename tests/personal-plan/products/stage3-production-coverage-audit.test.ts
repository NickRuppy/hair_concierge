import assert from "node:assert/strict"
import test from "node:test"

import {
  coverageAuditFailures,
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
