import type { PriceAuditCandidate } from "./contracts"

/**
 * Audit order: recommendation-surfaced products (the Stage-3/cockpit
 * `is_chaarlie_recommended` set) before the rest, oldest price check first
 * within each group. Never-checked (or unparsable) stamps sort before every
 * dated stamp so they are re-checked first. Stable for equal keys.
 */
export function orderAuditCandidates(
  candidates: readonly PriceAuditCandidate[],
): PriceAuditCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      if (left.candidate.isChaarlieRecommended !== right.candidate.isChaarlieRecommended) {
        return left.candidate.isChaarlieRecommended ? -1 : 1
      }
      const leftChecked = checkedAtMs(left.candidate.priceCheckedAt)
      const rightChecked = checkedAtMs(right.candidate.priceCheckedAt)
      if (leftChecked !== rightChecked) return leftChecked - rightChecked
      return left.index - right.index
    })
    .map((entry) => entry.candidate)
}

function checkedAtMs(priceCheckedAt: string | null): number {
  if (!priceCheckedAt) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(priceCheckedAt)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}
