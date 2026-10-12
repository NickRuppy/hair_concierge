import { bondbuilderTimingOf } from "./authority/categories/bondbuilder"
import type { Stage3AuthorityInput } from "./authority/contracts"
import {
  orderStandaloneAlternatives,
  orderTrustPairAlternatives,
  type BudgetCandidate,
  type BudgetCandidateView,
  type BudgetPreference,
  type BudgetRoleInput,
} from "./budget-policy"
import { budgetNeedDistances } from "./comparison-dimensions"
import {
  candidateTimingRank,
  candidateTrustRank,
  usablePackagePriceEur,
  type Stage3RankedComparisonCandidate,
} from "./fit-comparison"

/**
 * The budget policy's view of one role's price-neutral fit ranking, built in ONE place for the
 * Stage-3 gateway, the Stage-1 previews and the scan (S4 plan §2.5, fixes #654 parity gaps G2/G3):
 * Bondbuilders carry their trust rank, their usage rank when a timing is stated, and the
 * `trust_pair` display mode (Nick, 2026-10-09); every other category is the plain ranking.
 */
export function budgetRoleRanking(
  authorityInput: Stage3AuthorityInput,
  ranked: readonly Stage3RankedComparisonCandidate[],
): Pick<BudgetRoleInput, "ranked" | "displayMode"> {
  const trustPair = authorityInput.category === "bondbuilder"
  const timing = bondbuilderTimingOf(authorityInput)
  return {
    ranked: ranked.map(
      (candidate): BudgetCandidate => ({
        productId: candidate.productId,
        priceEur: usablePackagePriceEur(candidate.facts),
        verdict: candidate.verdict,
        cautionCount: candidate.cautionCount,
        needDistances: budgetNeedDistances(authorityInput, candidate.facts),
        ...(trustPair ? { trustRank: candidateTrustRank(candidate.facts) } : {}),
        ...(trustPair && timing !== "no_preference"
          ? { usageRank: candidateTimingRank(candidate.facts, timing) }
          : {}),
      }),
    ),
    ...(trustPair ? { displayMode: "trust_pair" as const } : {}),
  }
}

/** Standalone (scan) ordering under a budget: the trust pair for Bondbuilders, else affordable first. */
export function standaloneBudgetViews(
  authorityInput: Stage3AuthorityInput,
  ranked: readonly Stage3RankedComparisonCandidate[],
  budget: BudgetPreference,
  limit: number,
): BudgetCandidateView[] {
  const role = budgetRoleRanking(authorityInput, ranked)
  return (
    role.displayMode === "trust_pair" ? orderTrustPairAlternatives : orderStandaloneAlternatives
  )(role.ranked, budget, limit)
}
