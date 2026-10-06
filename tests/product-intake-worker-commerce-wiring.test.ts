import assert from "node:assert/strict"
import test from "node:test"
import * as Sentry from "@sentry/node"
import {
  applyCommerceStage,
  normalizeResearchOutputForCategory,
} from "../scripts/product-intake/codex-research-worker"
import type { CommerceStageDeps } from "../src/lib/product-intake/pipeline/commerce"

type ResearchOutput = Parameters<typeof normalizeResearchOutputForCategory>[0]
const NOW = "2026-10-06T12:00:00.000Z"
const DM_URL = "https://www.dm.de/p/d/1670316/wahre-schaetze-shampoo"
const DM_ROW = {
  gtin: "3600542461030",
  dan: "1670316",
  title: "Shampoo Honig Schätze, 400 ml",
  price: "3,45 €",
  sellout: "false",
  purchasable: "true",
}
function output(): ResearchOutput {
  return {
    summary: "Research",
    blockers: ["existing research blocker"],
    artifacts: [{ kind: "commerce_check", status: "stale", payload: {} }],
    researched_payload: {
      draft: { notes: "Keep research" },
      final: {
        product: {
          clean_name: "Shampoo Honig",
          canonical_brand: "Garnier",
          affiliate_link: DM_URL,
          price_eur: 8,
          price_checked_at: "2026-10-01T00:00:00.000Z",
          purchase_link_status: "available",
          purchase_link_checked_at: "2026-10-01T00:00:00.000Z",
          currency: "EUR",
        },
        identifiers: [{ type: "ean", value: "3600542461030" }],
        category_specs: { product_shampoo_specs: [{ thickness: "fine" }] },
      },
    },
  }
}
function deps(overrides: Partial<CommerceStageDeps> = {}): CommerceStageDeps {
  return {
    now: () => new Date(NOW),
    hostAutoWriteEnabled: () => true,
    dmSearch: async () => [DM_ROW],
    jsonLdFetch: async () => assert.fail("dm must not fetch JSON-LD"),
    ...overrides,
  }
}

test("worker applies confirmed dm prices only and replaces the previous commerce artifact", async () => {
  const input = output()
  const expected = structuredClone(input.researched_payload)
  Object.assign((expected!.final as Record<string, Record<string, unknown>>).product, {
    price_eur: 3.45,
    price_checked_at: NOW,
  })
  const result = await applyCommerceStage(input, "submission-1", deps())
  assert.deepEqual(result.researched_payload, expected)
  assert.deepEqual(result.blockers, ["existing research blocker"])
  assert.equal(result.summary, input.summary)
  assert.equal(result.artifacts.length, 1)
  assert.equal(result.artifacts[0]!.kind, "commerce_check")
  assert.equal(result.artifacts[0]!.status, "confirmed")
  assert.equal(result.artifacts[0]!.payload.stage, "commerce")
})

test("worker preserves prices for a mismatched dm link and deduplicates commerce blockers", async () => {
  const input = output()
  const before = structuredClone(input.researched_payload)
  const blocker = `commerce_link_mismatch: stored_link_mismatch (${DM_URL})`
  input.blockers.push(blocker)
  const result = await applyCommerceStage(
    input,
    "submission-1",
    deps({
      dmSearch: async () => [{ ...DM_ROW, dan: "9999999" }],
    }),
  )
  assert.deepEqual(result.researched_payload, before)
  assert.deepEqual(result.blockers, ["existing research blocker", blocker])
  assert.equal(result.artifacts.length, 1)
  assert.equal(result.artifacts[0]!.status, "conflict")
})

test("a thrown dm client leaves an unconfirmed receipt without blocking or throwing", async () => {
  const input = output()
  const before = structuredClone(input.researched_payload)
  const result = await applyCommerceStage(
    input,
    "submission-1",
    deps({
      dmSearch: async () => {
        throw new Error("dm unavailable")
      },
    }),
  )
  assert.deepEqual(result.researched_payload, before)
  assert.deepEqual(result.blockers, ["existing research blocker"])
  assert.equal(result.artifacts.length, 1)
  assert.equal(result.artifacts[0]!.status, "unconfirmed")
})

test("unexpected stage failures are recorded with bounded diagnostics and do not block the pass", async (t) => {
  const envelopes: unknown[] = []
  Sentry.init({
    dsn: "https://public@example.test/1",
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope)
        return { statusCode: 200 }
      },
      flush: async () => true,
    }),
  })
  t.after(async () => {
    await Sentry.close()
  })
  const input = output()
  const before = structuredClone(input.researched_payload)
  const result = await applyCommerceStage(
    input,
    "submission-1",
    deps({
      now: () => {
        throw new Error("x".repeat(5000))
      },
    }),
  )
  assert.deepEqual(result.researched_payload, before)
  assert.deepEqual(result.blockers, ["existing research blocker"])
  assert.equal(result.artifacts.length, 1)
  assert.equal(result.artifacts[0]!.status, "unconfirmed")
  assert.equal(result.artifacts[0]!.payload.stage, "commerce")
  assert.equal(String(result.artifacts[0]!.payload.error).length, 4000)
  await Sentry.flush()
  assert.equal(envelopes.length, 1, "the unexpected stage failure reaches local Sentry telemetry")
})

test("without a final payload the worker returns unchanged and does not call commerce deps", async () => {
  for (const researched_payload of [null, { draft: { notes: "Waiting for research" } }]) {
    const input = { ...output(), researched_payload }
    const before = structuredClone(input)
    const result = await applyCommerceStage(
      input,
      "submission-1",
      deps({
        now: () => assert.fail("no final payload must not run commerce"),
      }),
    )
    assert.equal(result, input)
    assert.deepEqual(result, before)
  }
})
