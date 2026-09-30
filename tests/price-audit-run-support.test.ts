import assert from "node:assert/strict"
import test from "node:test"

import type { PriceAuditCandidate } from "../src/lib/price-audit/contracts"
import {
  buildRunSummary,
  evaluateProbeSamples,
  groupCandidatesByHost,
  isSystemicFailure,
  type AuditResult,
} from "../src/lib/price-audit/run-support"

function candidate(id: string, link: string | null): PriceAuditCandidate {
  return {
    id,
    name: id,
    brand: null,
    affiliateLink: link,
    priceEur: 4.95,
    priceCheckedAt: null,
    purchaseLinkStatus: null,
    isChaarlieRecommended: false,
    canonicalGtin14s: [],
  }
}

function result(
  id: string,
  host: string | null,
  action: AuditResult["decision"]["action"],
): AuditResult {
  return {
    candidate: candidate(id, host ? `https://www.${host}/x` : null),
    host,
    observation: { kind: "failed", reason: "http_error" },
    decision:
      action === "auto_write"
        ? {
            action,
            write: {
              purchaseLinkStatus: "available",
              purchaseLinkCheckedAt: "2026-09-30T00:00:00.000Z",
            },
          }
        : { action, reason: "test-reason" },
    applied: false,
  }
}

test("candidates group by normalized host with a bucket for unusable links", () => {
  const groups = groupCandidatesByHost([
    candidate("a", "https://www.dm.de/p/d/1/x"),
    candidate("b", "https://dm.de/p/d/2/y"),
    candidate("c", "https://www.rossmann.de/de/z/p/1"),
    candidate("d", null),
    candidate("e", "kein-link"),
  ])
  assert.deepEqual([...groups.keys()].sort(), ["(no-host)", "dm.de", "rossmann.de"])
  assert.equal(groups.get("dm.de")?.length, 2)
  assert.equal(groups.get("(no-host)")?.length, 2)
})

test("run summary counts actions per host and collects non-write reasons", () => {
  const summary = buildRunSummary(
    [
      result("a", "dm.de", "auto_write"),
      result("b", "dm.de", "review_proposal"),
      result("c", "rossmann.de", "recheck_failed"),
    ],
    { startedAt: "s", finishedAt: "f", apply: false },
  )
  assert.equal(summary.total, 3)
  assert.deepEqual(summary.byAction, { auto_write: 1, review_proposal: 1, recheck_failed: 1 })
  assert.deepEqual(summary.byHost["dm.de"], {
    auto_write: 1,
    review_proposal: 1,
    recheck_failed: 0,
  })
  assert.deepEqual(summary.reasons, { "test-reason": 2 })
})

test("systemic failure requires a majority of failed re-checks", () => {
  const healthy = buildRunSummary(
    [result("a", "dm.de", "auto_write"), result("b", "dm.de", "recheck_failed")],
    { startedAt: "s", finishedAt: "f", apply: true },
  )
  assert.equal(isSystemicFailure(healthy), false)
  const broken = buildRunSummary(
    [
      result("a", "dm.de", "recheck_failed"),
      result("b", "dm.de", "recheck_failed"),
      result("c", "dm.de", "auto_write"),
    ],
    { startedAt: "s", finishedAt: "f", apply: true },
  )
  assert.equal(isSystemicFailure(broken), true)
  assert.equal(
    isSystemicFailure(buildRunSummary([], { startedAt: "s", finishedAt: "f", apply: false })),
    false,
  )
})

test("probe passes only when every sample confirmed identity and price", () => {
  const confirmed = {
    kind: "confirmed",
    identity: "gtin_match",
    priceEur: 4.95,
    buyable: true,
    buyableSource: "structured",
    evidenceUrl: "https://www.dm.de/p/d/1/x",
    observedName: "x",
  } as const
  assert.equal(
    evaluateProbeSamples([
      { productId: "a", storedPriceEur: 4.95, observation: confirmed },
      { productId: "b", storedPriceEur: 3.45, observation: confirmed },
    ]),
    true,
  )
  assert.equal(
    evaluateProbeSamples([
      { productId: "a", storedPriceEur: 4.95, observation: confirmed },
      { productId: "b", storedPriceEur: null, observation: { kind: "failed", reason: "bot_wall" } },
    ]),
    false,
  )
  assert.equal(evaluateProbeSamples([]), false)
})
