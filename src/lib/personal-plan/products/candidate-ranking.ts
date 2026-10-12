import type { Stage3AuthorityInput, Stage3CategoryProductFacts } from "./authority/contracts"
import { isScalpShampooTarget } from "./authority/categories/shampoo-spec-target"

export type RankableCandidate = {
  verdict: "ideal" | "supportive"
  targetMatchCount: number // in-target dimensions, as the comparison table renders them
  cautionCount: number // criteria entries with result === "caution"
  shampooGentleness?: number
  catalogSortOrder: number | null | undefined
  priceEur?: number | null
  productId: string
}

/** R19, ruled 2026-10-12: gentleness breaks fit ties only for coarse hair in scalp cells. */
export function shampooGentlenessRank(
  input: Pick<Stage3AuthorityInput, "category" | "role" | "hairThickness" | "categoryDecision">,
  facts: Stage3CategoryProductFacts,
): number | undefined {
  if (
    input.category !== "shampoo" ||
    facts.category !== "shampoo" ||
    input.hairThickness !== "coarse" ||
    !isScalpShampooTarget({ role: input.role, target: input.categoryDecision.target })
  )
    return undefined
  const intensity = facts.spec.cleansingIntensity
  return intensity === "gentle"
    ? 0
    : intensity === "regular"
      ? 1
      : intensity === "clarifying" || intensity === "strong"
        ? 2
        : Number.MAX_SAFE_INTEGER
}

const VERDICT_RANK: Record<RankableCandidate["verdict"], number> = {
  ideal: 0,
  supportive: 1,
}

function normalizedSortOrder(value: number | null | undefined): number {
  return value ?? Number.MAX_SAFE_INTEGER
}

function normalizedPrice(value: number | null | undefined): number {
  return value ?? Number.MAX_SAFE_INTEGER
}

export function compareRankableCandidates(
  left: RankableCandidate,
  right: RankableCandidate,
): number {
  const verdictDelta = VERDICT_RANK[left.verdict] - VERDICT_RANK[right.verdict]
  if (verdictDelta !== 0) return verdictDelta

  const matchDelta = right.targetMatchCount - left.targetMatchCount
  if (matchDelta !== 0) return matchDelta

  const cautionDelta = left.cautionCount - right.cautionCount
  if (cautionDelta !== 0) return cautionDelta

  const gentlenessDelta = (left.shampooGentleness ?? 0) - (right.shampooGentleness ?? 0)
  if (gentlenessDelta !== 0) return gentlenessDelta

  const sortOrderDelta =
    normalizedSortOrder(left.catalogSortOrder) - normalizedSortOrder(right.catalogSortOrder)
  if (sortOrderDelta !== 0) return sortOrderDelta

  const priceDelta = normalizedPrice(left.priceEur) - normalizedPrice(right.priceEur)
  if (priceDelta !== 0) return priceDelta

  return left.productId.localeCompare(right.productId)
}
