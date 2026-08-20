import type { Stage3AuthorityEvaluation } from "@/lib/personal-plan/products/authority/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { ScanVerdict } from "./types"

export type ScanRoleEvaluation = {
  role: PlanProductRole
  evaluation: Stage3AuthorityEvaluation
  coverage: { matches: number; total: number } | null
}

/**
 * Scan-specific rank. Unlike `compareRankableCandidates` (which only ever sees
 * ideal|supportive recommendation candidates), the scanned product can land on any
 * verdict, so `unknown` has to outrank `mismatch`: "does not fit role A, not enough data
 * for role B" must read as "Unklar" rather than claim a rejection the data cannot carry.
 */
const VERDICT_RANK: Record<ScanVerdict, number> = {
  ideal: 0,
  supportive: 1,
  unknown: 2,
  mismatch: 3,
}

export function scanVerdictForEvaluation(evaluation: Stage3AuthorityEvaluation): ScanVerdict {
  return evaluation.status === "known" ? evaluation.verdict : "unknown"
}

function cautionCount(evaluation: Stage3AuthorityEvaluation): number {
  if (evaluation.status !== "known" && evaluation.status !== "unknown") return 0
  return evaluation.criteria.filter((criterion) => criterion.result === "caution").length
}

export function selectBestRoleEvaluation(
  entries: readonly ScanRoleEvaluation[],
): ScanRoleEvaluation | null {
  let best: ScanRoleEvaluation | null = null
  for (const entry of entries) {
    if (best === null || compareRoleEvaluations(entry, best) < 0) best = entry
  }
  return best
}

/** Negative when `left` is the better role. Ties resolve to `0` so input order stands. */
function compareRoleEvaluations(left: ScanRoleEvaluation, right: ScanRoleEvaluation): number {
  const verdictOrder =
    VERDICT_RANK[scanVerdictForEvaluation(left.evaluation)] -
    VERDICT_RANK[scanVerdictForEvaluation(right.evaluation)]
  if (verdictOrder !== 0) return verdictOrder

  // An unmeasured coverage cannot outrank a measured one.
  const coverageOrder = (right.coverage?.matches ?? -1) - (left.coverage?.matches ?? -1)
  if (coverageOrder !== 0) return coverageOrder

  return cautionCount(left.evaluation) - cautionCount(right.evaluation)
}
