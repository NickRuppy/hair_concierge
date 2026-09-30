import assert from "node:assert/strict"
import test from "node:test"

import { orderAuditCandidates } from "../src/lib/price-audit/select"
import type { PriceAuditCandidate } from "../src/lib/price-audit/contracts"

function candidate(id: string, overrides: Partial<PriceAuditCandidate> = {}): PriceAuditCandidate {
  return {
    id,
    name: id,
    brand: null,
    affiliateLink: "https://www.dm.de/p/d/1/x",
    priceEur: 4.95,
    priceCheckedAt: "2026-08-01T00:00:00.000Z",
    purchaseLinkStatus: "available",
    isChaarlieRecommended: false,
    canonicalGtin14s: [],
    ...overrides,
  }
}

test("recommendation-surfaced products come first, oldest checks first, never-checked before all", () => {
  const ordered = orderAuditCandidates([
    candidate("plain-new", { priceCheckedAt: "2026-09-04T00:00:00.000Z" }),
    candidate("rec-old", {
      isChaarlieRecommended: true,
      priceCheckedAt: "2026-06-09T00:00:00.000Z",
    }),
    candidate("plain-never", { priceCheckedAt: null }),
    candidate("rec-new", {
      isChaarlieRecommended: true,
      priceCheckedAt: "2026-09-04T00:00:00.000Z",
    }),
    candidate("rec-never", { isChaarlieRecommended: true, priceCheckedAt: null }),
    candidate("plain-old", { priceCheckedAt: "2026-06-09T00:00:00.000Z" }),
  ])
  assert.deepEqual(
    ordered.map((entry) => entry.id),
    ["rec-never", "rec-old", "rec-new", "plain-never", "plain-old", "plain-new"],
  )
})

test("ordering is stable for equal keys and tolerates garbage dates as never-checked", () => {
  const ordered = orderAuditCandidates([
    candidate("b", { priceCheckedAt: "kaputt" }),
    candidate("a", { priceCheckedAt: null }),
    candidate("c", { priceCheckedAt: "2026-09-01T00:00:00.000Z" }),
  ])
  assert.deepEqual(
    ordered.map((entry) => entry.id),
    ["b", "a", "c"],
  )
})
