import assert from "node:assert/strict"
import test from "node:test"

import { decide } from "../src/lib/price-audit/decide"
import type { PriceAuditCandidate, RetailerObservation } from "../src/lib/price-audit/contracts"

const NOW = "2026-09-30T04:30:00.000Z"

function candidate(overrides: Partial<PriceAuditCandidate> = {}): PriceAuditCandidate {
  return {
    id: "product-1",
    name: "Testprodukt Shampoo",
    brand: "Testbrand",
    affiliateLink: "https://www.dm.de/p/d/123/testprodukt",
    priceEur: 4.95,
    priceCheckedAt: "2026-06-09T00:00:00.000Z",
    purchaseLinkStatus: "available",
    isChaarlieRecommended: true,
    canonicalGtin14s: ["04015100813494"],
    ...overrides,
  }
}

function confirmed(overrides: Partial<Extract<RetailerObservation, { kind: "confirmed" }>> = {}) {
  return {
    kind: "confirmed",
    identity: "gtin_match",
    priceEur: 5.25,
    buyable: true,
    buyableSource: "structured",
    evidenceUrl: "https://www.dm.de/p/d/123/testprodukt",
    observedName: "Testprodukt Shampoo 400 ml",
    ...overrides,
  } satisfies RetailerObservation
}

const opts = { hostAutoWriteEnabled: true, now: NOW }

test("confirmed buyable observation with sane price auto-writes price, stamp and status", () => {
  const decision = decide(candidate(), confirmed(), opts)
  assert.deepEqual(decision, {
    action: "auto_write",
    write: {
      priceEur: 5.25,
      priceCheckedAt: NOW,
      purchaseLinkStatus: "available",
      purchaseLinkCheckedAt: NOW,
    },
  })
})

test("confirmed but not buyable writes only link status, never a price stamp", () => {
  const decision = decide(candidate(), confirmed({ buyable: false }), opts)
  assert.equal(decision.action, "auto_write")
  assert.deepEqual(decision.action === "auto_write" ? decision.write : null, {
    purchaseLinkStatus: "unavailable",
    purchaseLinkCheckedAt: NOW,
  })
})

test("text-classifier unavailability goes to review, never hides the buy link automatically", () => {
  const decision = decide(candidate(), confirmed({ buyable: false, buyableSource: "text" }), opts)
  assert.equal(decision.action, "review_proposal")
})

test("structured unavailability writes status even when the shown price is anomalous", () => {
  const decision = decide(
    candidate({ priceEur: 4.95 }),
    confirmed({ buyable: false, priceEur: 99 }),
    opts,
  )
  assert.equal(decision.action, "auto_write")
  assert.deepEqual(decision.action === "auto_write" ? decision.write : null, {
    purchaseLinkStatus: "unavailable",
    purchaseLinkCheckedAt: NOW,
  })
})

test("price anomalies route to review instead of auto-write", () => {
  // delta > 30% vs stored price
  const jump = decide(candidate({ priceEur: 4.95 }), confirmed({ priceEur: 7.5 }), opts)
  assert.equal(jump.action, "review_proposal")
  // non-positive price
  const zero = decide(candidate(), confirmed({ priceEur: 0 }), opts)
  assert.equal(zero.action, "review_proposal")
  // implausibly high price
  const high = decide(candidate({ priceEur: null }), confirmed({ priceEur: 600 }), opts)
  assert.equal(high.action, "review_proposal")
})

test("missing stored price skips the delta guard but keeps sanity bounds", () => {
  const decision = decide(candidate({ priceEur: null }), confirmed({ priceEur: 34 }), opts)
  assert.equal(decision.action, "auto_write")
})

test("delta guard tolerates changes up to 30 percent", () => {
  const decision = decide(candidate({ priceEur: 4.0 }), confirmed({ priceEur: 5.2 }), opts)
  assert.equal(decision.action, "auto_write")
})

test("mismatch observations become review proposals", () => {
  const decision = decide(
    candidate(),
    {
      kind: "mismatch",
      reason: "gtin_mismatch",
      evidenceUrl: "https://www.dm.de/p/d/456/anderes-produkt",
      observedName: "Anderes Produkt",
      observedPriceEur: 3.95,
    },
    opts,
  )
  assert.equal(decision.action, "review_proposal")
  assert.match(decision.action === "review_proposal" ? decision.reason : "", /gtin_mismatch/)
})

test("failed observations never write and never stamp", () => {
  const decision = decide(candidate(), { kind: "failed", reason: "bot_wall" }, opts)
  assert.deepEqual(decision, { action: "recheck_failed", reason: "bot_wall" })
})

test("a host without a passing probe downgrades auto-writes to review proposals", () => {
  const decision = decide(candidate(), confirmed(), { ...opts, hostAutoWriteEnabled: false })
  assert.equal(decision.action, "review_proposal")
  assert.match(decision.action === "review_proposal" ? decision.reason : "", /probe/i)
})
