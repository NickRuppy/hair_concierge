import assert from "node:assert/strict"
import test from "node:test"

import {
  compareRankableCandidates,
  type RankableCandidate,
} from "../../../src/lib/personal-plan/products/candidate-ranking"

function candidate(
  overrides: Partial<RankableCandidate> & { productId: string },
): RankableCandidate {
  return {
    verdict: "supportive",
    targetMatchCount: 0,
    cautionCount: 0,
    catalogSortOrder: null,
    priceEur: null,
    ...overrides,
  }
}

test("verdict dominance: ideal beats supportive even with worse coverage/cautions", () => {
  const ideal = candidate({
    productId: "ideal-worse",
    verdict: "ideal",
    targetMatchCount: 0,
    cautionCount: 5,
    catalogSortOrder: 99,
  })
  const supportive = candidate({
    productId: "supportive-better",
    verdict: "supportive",
    targetMatchCount: 3,
    cautionCount: 0,
    catalogSortOrder: 1,
  })

  assert.ok(compareRankableCandidates(ideal, supportive) < 0)
  assert.ok(compareRankableCandidates(supportive, ideal) > 0)
})

test("coverage dominance at equal verdict: higher targetMatchCount wins despite more cautions and worse catalog order (leave-in Pantene/Cantu bug case)", () => {
  const cantu = candidate({
    productId: "cantu",
    verdict: "supportive",
    targetMatchCount: 2,
    cautionCount: 5,
    catalogSortOrder: 99,
  })
  const pantene = candidate({
    productId: "pantene",
    verdict: "supportive",
    targetMatchCount: 1,
    cautionCount: 0,
    catalogSortOrder: 1,
  })

  assert.ok(compareRankableCandidates(cantu, pantene) < 0)
  assert.ok(compareRankableCandidates(pantene, cantu) > 0)
})

test("caution tiebreak: equal verdict and matches, fewer cautions wins regardless of catalog order", () => {
  const fewerCautions = candidate({
    productId: "fewer-cautions",
    verdict: "supportive",
    targetMatchCount: 2,
    cautionCount: 1,
    catalogSortOrder: 50,
  })
  const moreCautions = candidate({
    productId: "more-cautions",
    verdict: "supportive",
    targetMatchCount: 2,
    cautionCount: 2,
    catalogSortOrder: 1,
  })

  assert.ok(compareRankableCandidates(fewerCautions, moreCautions) < 0)
  assert.ok(compareRankableCandidates(moreCautions, fewerCautions) > 0)
})

test("catalog tiebreak: equal on verdict/matches/cautions, lower catalogSortOrder wins; null loses to any number", () => {
  const lowerSortOrder = candidate({
    productId: "lower-sort",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 1,
    catalogSortOrder: 2,
  })
  const higherSortOrder = candidate({
    productId: "higher-sort",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 1,
    catalogSortOrder: 10,
  })
  const nullSortOrder = candidate({
    productId: "null-sort",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 1,
    catalogSortOrder: null,
  })
  const undefinedSortOrder = candidate({
    productId: "undefined-sort",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 1,
    catalogSortOrder: undefined,
  })

  assert.ok(compareRankableCandidates(lowerSortOrder, higherSortOrder) < 0)
  assert.ok(compareRankableCandidates(higherSortOrder, lowerSortOrder) > 0)
  assert.ok(compareRankableCandidates(higherSortOrder, nullSortOrder) < 0)
  assert.ok(compareRankableCandidates(nullSortOrder, higherSortOrder) > 0)
  assert.ok(compareRankableCandidates(higherSortOrder, undefinedSortOrder) < 0)
  assert.ok(compareRankableCandidates(undefinedSortOrder, higherSortOrder) > 0)
})

test("price tiebreak: equal on verdict/matches/cautions/catalog order, lower priceEur wins; null/undefined loses to any number", () => {
  const cheaper = candidate({
    productId: "cheaper",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 0,
    catalogSortOrder: 5,
    priceEur: 9.99,
  })
  const pricier = candidate({
    productId: "pricier",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 0,
    catalogSortOrder: 5,
    priceEur: 19.99,
  })
  const noPrice = candidate({
    productId: "no-price",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 0,
    catalogSortOrder: 5,
    priceEur: null,
  })
  const undefinedPrice = candidate({
    productId: "undefined-price",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 0,
    catalogSortOrder: 5,
    priceEur: undefined,
  })

  assert.ok(compareRankableCandidates(cheaper, pricier) < 0)
  assert.ok(compareRankableCandidates(pricier, cheaper) > 0)
  assert.ok(compareRankableCandidates(pricier, noPrice) < 0)
  assert.ok(compareRankableCandidates(noPrice, pricier) > 0)
  assert.ok(compareRankableCandidates(pricier, undefinedPrice) < 0)
  assert.ok(compareRankableCandidates(undefinedPrice, pricier) > 0)
})

test("stability: full tie resolved by productId localeCompare; comparator is antisymmetric", () => {
  const a = candidate({
    productId: "aaa",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 0,
    catalogSortOrder: 5,
    priceEur: 10,
  })
  const b = candidate({
    productId: "bbb",
    verdict: "ideal",
    targetMatchCount: 2,
    cautionCount: 0,
    catalogSortOrder: 5,
    priceEur: 10,
  })

  assert.ok(compareRankableCandidates(a, b) < 0)
  assert.ok(compareRankableCandidates(b, a) > 0)
  assert.equal(compareRankableCandidates(a, b), -compareRankableCandidates(b, a))

  const c = candidate({
    productId: "ccc",
    verdict: "supportive",
    targetMatchCount: 1,
    cautionCount: 1,
    catalogSortOrder: null,
    priceEur: null,
  })
  const d = candidate({
    productId: "ddd",
    verdict: "ideal",
    targetMatchCount: 0,
    cautionCount: 3,
    catalogSortOrder: 200,
    priceEur: 5,
  })
  assert.equal(compareRankableCandidates(c, d), -compareRankableCandidates(d, c))
})

test("sorting a mixed fixture yields the documented total order", () => {
  const idealHighMatch = candidate({
    productId: "ideal-high-match",
    verdict: "ideal",
    targetMatchCount: 3,
    cautionCount: 0,
    catalogSortOrder: 10,
    priceEur: 20,
  })
  const idealLowMatchManyCautions = candidate({
    productId: "ideal-low-match",
    verdict: "ideal",
    targetMatchCount: 0,
    cautionCount: 4,
    catalogSortOrder: 1,
    priceEur: 5,
  })
  const supportiveHighMatch = candidate({
    productId: "supportive-high-match",
    verdict: "supportive",
    targetMatchCount: 2,
    cautionCount: 5,
    catalogSortOrder: 99,
    priceEur: 50,
  })
  const supportiveLowMatch = candidate({
    productId: "supportive-low-match",
    verdict: "supportive",
    targetMatchCount: 1,
    cautionCount: 0,
    catalogSortOrder: 1,
    priceEur: 3,
  })
  const supportiveHighMatchFewerCautions = candidate({
    productId: "supportive-high-match-fewer-cautions",
    verdict: "supportive",
    targetMatchCount: 2,
    cautionCount: 1,
    catalogSortOrder: 50,
    priceEur: 15,
  })
  const supportiveHighMatchSameCautionsCheaper = candidate({
    productId: "supportive-high-match-same-cautions-cheaper",
    verdict: "supportive",
    targetMatchCount: 2,
    cautionCount: 5,
    catalogSortOrder: 99,
    priceEur: 10,
  })

  const shuffled = [
    supportiveLowMatch,
    idealHighMatch,
    supportiveHighMatchFewerCautions,
    supportiveHighMatch,
    idealLowMatchManyCautions,
    supportiveHighMatchSameCautionsCheaper,
  ]

  const sorted = [...shuffled].sort(compareRankableCandidates)

  assert.deepEqual(
    sorted.map((entry) => entry.productId),
    [
      "ideal-high-match",
      "ideal-low-match",
      "supportive-high-match-fewer-cautions",
      "supportive-high-match-same-cautions-cheaper",
      "supportive-high-match",
      "supportive-low-match",
    ],
  )
})
