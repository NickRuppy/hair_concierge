export type RankableCandidate = {
  verdict: "ideal" | "supportive"
  targetMatchCount: number // in-target dimensions, as the comparison table renders them
  cautionCount: number // criteria entries with result === "caution"
  catalogSortOrder: number | null | undefined
  priceEur?: number | null
  productId: string
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

  const sortOrderDelta =
    normalizedSortOrder(left.catalogSortOrder) - normalizedSortOrder(right.catalogSortOrder)
  if (sortOrderDelta !== 0) return sortOrderDelta

  const priceDelta = normalizedPrice(left.priceEur) - normalizedPrice(right.priceEur)
  if (priceDelta !== 0) return priceDelta

  return left.productId.localeCompare(right.productId)
}
