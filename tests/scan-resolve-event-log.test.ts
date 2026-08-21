import assert from "node:assert/strict"
import test from "node:test"

import { recordScanResolveEvent } from "../src/lib/scan/resolve-event-log"

function stubClient(response: { error: unknown } | (() => never)) {
  let inserted: unknown = null
  let table: string | null = null
  const client = {
    from(name: string) {
      table = name
      return {
        insert: async (row: unknown) => {
          inserted = row
          if (typeof response === "function") response()
          return response
        },
      }
    },
  }
  return { client, inserted: () => inserted, table: () => table }
}

test("records a hit with canonical value and matched product", async () => {
  const { client, inserted, table } = stubClient({ error: null })

  await recordScanResolveEvent(client as never, {
    userId: "user-1",
    identifierType: "ean",
    rawValue: "0022796976116",
    outcome: "hit",
    matchedProductId: "prod-1",
  })

  assert.equal(table(), "scan_resolve_events")
  assert.deepEqual(inserted(), {
    user_id: "user-1",
    identifier_type: "ean",
    raw_value: "0022796976116",
    canonical_value: "00022796976116",
    outcome: "hit",
    matched_product_id: "prod-1",
  })
})

test("records a miss with null matched product", async () => {
  const { client, inserted } = stubClient({ error: null })

  await recordScanResolveEvent(client as never, {
    userId: "user-1",
    identifierType: "ean",
    rawValue: "4012345678901",
    outcome: "miss",
    matchedProductId: null,
  })

  assert.deepEqual(inserted(), {
    user_id: "user-1",
    identifier_type: "ean",
    raw_value: "4012345678901",
    canonical_value: "04012345678901",
    outcome: "miss",
    matched_product_id: null,
  })
})

test("non-GTIN raw value logs a null canonical value", async () => {
  const { client, inserted } = stubClient({ error: null })

  await recordScanResolveEvent(client as never, {
    userId: "user-1",
    identifierType: "ean",
    rawValue: "1234",
    outcome: "invalid",
    matchedProductId: null,
  })

  assert.equal((inserted() as { canonical_value: unknown }).canonical_value, null)
})

test("fail-open: an insert error never throws", async () => {
  const { client } = stubClient({ error: { message: "boom" } })

  await assert.doesNotReject(
    recordScanResolveEvent(client as never, {
      userId: "user-1",
      identifierType: "ean",
      rawValue: "4012345678901",
      outcome: "miss",
      matchedProductId: null,
    }),
  )
})

test("fail-open: a thrown client error never propagates", async () => {
  const { client } = stubClient(() => {
    throw new Error("network down")
  })

  await assert.doesNotReject(
    recordScanResolveEvent(client as never, {
      userId: "user-1",
      identifierType: "ean",
      rawValue: "4012345678901",
      outcome: "miss",
      matchedProductId: null,
    }),
  )
})
