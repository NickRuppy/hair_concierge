import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createActiveProductByIdLoader,
  createPresentationRowLoader,
} from "../src/lib/scan/presentation-rows"

/**
 * `/api/scan/resolve`, `/api/scan/reveal` and the discovery cockpit now share ONE copy of
 * these two catalog reads. Each route's own suite injects them as deps and therefore never
 * exercises the query itself, so the eligibility gate, the column list and the per-caller
 * error codes are pinned here instead.
 */

type Recorded = {
  table: string | null
  columns: string | null
  eq: Array<[string, unknown]>
  in: Array<[string, unknown]>
  maybeSingle: number
}

function fakeClient(result: { data: unknown; error: unknown }) {
  const recorded: Recorded = { table: null, columns: null, eq: [], in: [], maybeSingle: 0 }
  const builder: Record<string, unknown> = {
    select: (columns: string) => {
      recorded.columns = columns
      return builder
    },
    eq: (column: string, value: unknown) => {
      recorded.eq.push([column, value])
      return builder
    },
    in: (column: string, value: unknown) => {
      recorded.in.push([column, value])
      return Promise.resolve(result)
    },
    maybeSingle: () => {
      recorded.maybeSingle += 1
      return Promise.resolve(result)
    },
  }
  const client = {
    from: (table: string) => {
      recorded.table = table
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, recorded }
}

test("the active-product lookup requires both the active flag and the active lifecycle", async () => {
  const { client, recorded } = fakeClient({
    data: { id: "product-1", category_key: "shampoo" },
    error: null,
  })
  const load = createActiveProductByIdLoader("scan_resolve_product_lookup_failed")

  assert.deepEqual(await load(client, "product-1"), { id: "product-1", category: "shampoo" })
  assert.equal(recorded.table, "products")
  assert.equal(recorded.columns, "id, category_key")
  assert.deepEqual(recorded.eq, [
    ["id", "product-1"],
    ["is_active", true],
    ["lifecycle_status", "active"],
  ])
  assert.equal(recorded.maybeSingle, 1)
})

test("the active-product lookup reports a miss as null and a query failure as the caller's error code", async () => {
  const miss = fakeClient({ data: null, error: null })
  assert.equal(await createActiveProductByIdLoader("boom")(miss.client, "product-1"), null)

  const failing = fakeClient({ data: null, error: new Error("db down") })
  await assert.rejects(
    () => createActiveProductByIdLoader("scan_reveal_product_lookup_failed")(failing.client, "p"),
    /scan_reveal_product_lookup_failed/,
  )
})

test("presentation rows select the full commerce column list, dedupe ids and normalize the link status", async () => {
  const { client, recorded } = fakeClient({
    data: [
      {
        id: "product-1",
        name: "Shampoo",
        brand: "Marke",
        category_key: "shampoo",
        image_url: null,
        price_eur: 12,
        currency: "EUR",
        affiliate_link: "https://shop.test/a",
        purchase_link_status: "available",
        price_checked_at: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "product-2",
        name: "Maske",
        brand: null,
        category_key: "mask",
        image_url: null,
        price_eur: null,
        currency: null,
        affiliate_link: null,
        // Anything outside the two known states must normalize to null.
        purchase_link_status: "pending",
        price_checked_at: null,
      },
    ],
    error: null,
  })

  const rows = await createPresentationRowLoader("scan_resolve_presentation_lookup_failed")(
    client,
    ["product-1", "product-2", "product-1"],
  )

  assert.equal(
    recorded.columns,
    "id, name, brand, category_key, image_url, price_eur, currency, affiliate_link, purchase_link_status, price_checked_at",
  )
  assert.deepEqual(recorded.in, [["id", ["product-1", "product-2"]]])
  assert.deepEqual(
    rows.map((row) => [row.id, row.category, row.purchaseLinkStatus]),
    [
      ["product-1", "shampoo", "available"],
      ["product-2", "mask", null],
    ],
  )
})

test("presentation rows short-circuit on an empty id list and surface the caller's error code", async () => {
  const { client, recorded } = fakeClient({ data: null, error: null })
  assert.deepEqual(await createPresentationRowLoader("boom")(client, []), [])
  assert.equal(recorded.table, null, "no query for an empty id list")

  const failing = fakeClient({ data: null, error: new Error("db down") })
  await assert.rejects(
    () =>
      createPresentationRowLoader("scan_reveal_presentation_lookup_failed")(failing.client, ["p"]),
    /scan_reveal_presentation_lookup_failed/,
  )
})
