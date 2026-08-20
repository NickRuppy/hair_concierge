import assert from "node:assert/strict"
import test from "node:test"

import type { Stage3AuthorityEvaluation } from "../src/lib/personal-plan/products/authority/contracts"
import type {
  Stage3CriterionResult,
  Stage3FitVerdict,
} from "../src/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "../src/lib/personal-plan/types"
import {
  scanVerdictForEvaluation,
  selectBestRoleEvaluation,
  type ScanRoleEvaluation,
} from "../src/lib/scan/role-selection"

function criteria(cautions: number): Stage3CriterionResult[] {
  return Array.from({ length: cautions }, (_, index) => ({
    criterionId: `criterion-${index}`,
    label: `Kriterium ${index}`,
    result: "caution" as const,
    explanation: "Mit Einschränkung.",
  }))
}

function known(
  verdict: Stage3FitVerdict,
  options: { cautions?: number } = {},
): Stage3AuthorityEvaluation {
  return {
    status: "known",
    category: "conditioner",
    subjectKey: "scan:conditioner:conditioner_rinse_out",
    verdict,
    criteria: criteria(options.cautions ?? 0),
    allowedActions: [],
    recommendation: null,
    productFactFingerprint: null,
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  }
}

function unresolved(
  status: "unknown" | "pending" | "unsupported",
  options: { cautions?: number } = {},
): Stage3AuthorityEvaluation {
  if (status === "unknown") {
    return {
      status: "unknown",
      category: "conditioner",
      subjectKey: "scan:conditioner:conditioner_rinse_out",
      missingFacts: ["weight"],
      criteria: criteria(options.cautions ?? 0),
      allowedActions: ["leave_uncovered"],
      coverageRuleIds: [],
    }
  }
  if (status === "pending") {
    return {
      status: "pending",
      category: "conditioner",
      subjectKey: "scan:conditioner:conditioner_rinse_out",
      reason: "product_intake_pending",
      allowedActions: ["keep_pending"],
      coverageRuleIds: [],
    }
  }
  return {
    status: "unsupported",
    category: "conditioner",
    subjectKey: "scan:conditioner:conditioner_rinse_out",
    reason: "no_adapter",
    allowedActions: [],
    coverageRuleIds: [],
  }
}

function entry(
  role: PlanProductRole,
  evaluation: Stage3AuthorityEvaluation,
  coverage: { matches: number; total: number } | null = null,
): ScanRoleEvaluation {
  return { role, evaluation, coverage }
}

test("an evaluation status without a verdict scans as unknown", () => {
  assert.equal(scanVerdictForEvaluation(known("ideal")), "ideal")
  assert.equal(scanVerdictForEvaluation(known("supportive")), "supportive")
  assert.equal(scanVerdictForEvaluation(known("mismatch")), "mismatch")
  assert.equal(scanVerdictForEvaluation(known("unknown")), "unknown")
  assert.equal(scanVerdictForEvaluation(unresolved("unknown")), "unknown")
  assert.equal(scanVerdictForEvaluation(unresolved("pending")), "unknown")
  assert.equal(scanVerdictForEvaluation(unresolved("unsupported")), "unknown")
})

test("no evaluated role selects nothing", () => {
  assert.equal(selectBestRoleEvaluation([]), null)
})

test("a single evaluated role is the winner regardless of its verdict", () => {
  const only = entry("conditioner_rinse_out", known("mismatch"))
  assert.equal(selectBestRoleEvaluation([only]), only)
})

test("ideal beats supportive", () => {
  const ideal = entry("pre_heat_application", known("ideal"))
  const supportive = entry("post_wash_leave_in", known("supportive"))
  assert.equal(selectBestRoleEvaluation([supportive, ideal]), ideal)
})

test("supportive beats unknown", () => {
  const supportive = entry("post_wash_leave_in", known("supportive"))
  const unknown = entry("pre_heat_application", known("unknown"))
  assert.equal(selectBestRoleEvaluation([unknown, supportive]), supportive)
})

test("unknown beats mismatch so a mixed role result never overclaims a rejection", () => {
  const unknown = entry("pre_heat_application", unresolved("unknown"))
  const mismatch = entry("post_wash_leave_in", known("mismatch"))
  assert.equal(selectBestRoleEvaluation([mismatch, unknown]), unknown)
})

test("all roles mismatching stays a mismatch on the first role", () => {
  const first = entry("post_wash_leave_in", known("mismatch"))
  const second = entry("pre_heat_application", known("mismatch"))
  const winner = selectBestRoleEvaluation([first, second])
  assert.equal(winner, first)
  assert.equal(scanVerdictForEvaluation(winner!.evaluation), "mismatch")
})

test("an equal verdict is broken by the higher target coverage", () => {
  const thin = entry("post_wash_leave_in", known("supportive"), { matches: 1, total: 3 })
  const wide = entry("pre_heat_application", known("supportive"), { matches: 3, total: 3 })
  assert.equal(selectBestRoleEvaluation([thin, wide]), wide)
})

test("a missing coverage loses against measured coverage on an equal verdict", () => {
  const unmeasured = entry("post_wash_leave_in", known("supportive"), null)
  const measured = entry("pre_heat_application", known("supportive"), { matches: 1, total: 3 })
  assert.equal(selectBestRoleEvaluation([unmeasured, measured]), measured)
})

test("an equal verdict and coverage is broken by fewer caution criteria", () => {
  const cautious = entry("post_wash_leave_in", known("supportive", { cautions: 2 }), {
    matches: 2,
    total: 3,
  })
  const calm = entry("pre_heat_application", known("supportive", { cautions: 1 }), {
    matches: 2,
    total: 3,
  })
  assert.equal(selectBestRoleEvaluation([cautious, calm]), calm)
})

test("a full tie keeps the given role order", () => {
  const first = entry("post_wash_leave_in", known("supportive", { cautions: 1 }), {
    matches: 2,
    total: 3,
  })
  const second = entry("pre_heat_application", known("supportive", { cautions: 1 }), {
    matches: 2,
    total: 3,
  })
  assert.equal(selectBestRoleEvaluation([first, second]), first)
  assert.equal(selectBestRoleEvaluation([second, first]), second)
})

test("selecting does not reorder the caller's entries", () => {
  const first = entry("post_wash_leave_in", known("mismatch"))
  const second = entry("pre_heat_application", known("ideal"))
  const entries = [first, second]
  selectBestRoleEvaluation(entries)
  assert.deepEqual(entries, [first, second])
})
