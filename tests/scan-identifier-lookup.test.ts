import assert from "node:assert/strict"
import test from "node:test"

import {
  lookupCatalogProductByIdentifier,
  validateEanInput,
} from "../src/lib/scan/identifier-lookup"

/**
 * Minimal chainable stub mirroring the shape used across the repo's Supabase adapter
 * tests (see tests/personal-plan/products/stage3-persistence-supabase.test.ts): each
 * `.from(table)` call gets a fresh filter/call recorder, and `handlers` decides the
 * terminal response per table.
 */
function stubClient(
  handlers: Record<string, (calls: { filters: Map<string, unknown> }) => unknown>,
) {
  const callsByTable = new Map<string, { filters: Map<string, unknown> }>()
  const client = {
    from(table: string) {
      const calls = { filters: new Map<string, unknown>() }
      callsByTable.set(table, calls)
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          calls.filters.set(column, value)
          return chain
        },
        in: (column: string, values: unknown) => {
          calls.filters.set(column, values)
          return chain
        },
        then: (resolve: (value: unknown) => unknown) => {
          const handler = handlers[table]
          if (!handler) throw new Error(`unexpected table ${table}`)
          return resolve(handler(calls))
        },
      }
      return chain
    },
  }
  return { client, callsByTable }
}

test("validateEanInput: valid EAN-13 passes checksum", () => {
  const result = validateEanInput("4006381333931")
  assert.deepEqual(result, { ok: true, type: "ean", value: "4006381333931" })
})

test("validateEanInput: valid EAN-8 passes checksum", () => {
  // 7 digits + check digit computed with the same GS1 mod-10 algorithm.
  const result = validateEanInput("40170725")
  assert.equal(result.ok, true)
})

test("validateEanInput: corrupted digit fails checksum, not length", () => {
  const result = validateEanInput("4006381333930") // last digit flipped from 1 -> 0
  assert.deepEqual(result, { ok: false, reason: "checksum" })
})

test("validateEanInput: wrong length rejected before checksum is computed", () => {
  assert.deepEqual(validateEanInput("123456"), { ok: false, reason: "length" })
  assert.deepEqual(validateEanInput("12345678901234"), { ok: false, reason: "length" })
})

test("validateEanInput: non-digit characters rejected as length", () => {
  assert.deepEqual(validateEanInput("400638133393a"), { ok: false, reason: "length" })
})

test("validateEanInput: surrounding whitespace tolerated", () => {
  const result = validateEanInput("  4006381333931  ")
  assert.deepEqual(result, { ok: true, type: "ean", value: "4006381333931" })
})

test("lookupCatalogProductByIdentifier: normalizes whitespace and matches active product", async () => {
  const { client } = stubClient({
    product_identifiers: () => ({ data: [{ product_id: "prod-1" }], error: null }),
    products: (calls) => {
      assert.deepEqual(calls.filters.get("id"), ["prod-1"])
      assert.equal(calls.filters.get("is_active"), true)
      // Both columns: `is_active` alone still lets a discontinued product resolve.
      assert.equal(calls.filters.get("lifecycle_status"), "active")
      return { data: [{ id: "prod-1", category_key: "shampoo" }], error: null }
    },
  })

  const result = await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "4006 3813 33931",
  })

  assert.deepEqual(result, { productId: "prod-1", category: "shampoo" })
})

test("lookupCatalogProductByIdentifier: hyphenated spelling keeps raw form and adds canonical", async () => {
  const { client } = stubClient({
    product_identifiers: (calls) => {
      // Raw form stays queryable (hyphens matter for non-GTIN identifiers); the
      // hyphen-stripped GTIN reading is queried alongside it in canonical form.
      assert.deepEqual(calls.filters.get("normalized_identifier_value"), [
        "4006-3813-33931",
        "04006381333931",
      ])
      return { data: [], error: null }
    },
    products: () => ({ data: [], error: null }),
  })
  await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "4006-3813-33931",
  })
})

test("lookupCatalogProductByIdentifier: leading zeros preserved", async () => {
  const { client } = stubClient({
    product_identifiers: (calls) => {
      assert.deepEqual(calls.filters.get("normalized_identifier_value"), [
        "00012345",
        "00000000012345",
      ])
      return { data: [], error: null }
    },
    products: () => ({ data: [], error: null }),
  })
  const result = await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "00012345",
  })
  assert.equal(result, null)
})

test("lookupCatalogProductByIdentifier: searches all barcode identifier types, interchangeably", async () => {
  const { client } = stubClient({
    product_identifiers: (calls) => {
      assert.deepEqual([...(calls.filters.get("identifier_type") as string[])].sort(), [
        "barcode",
        "ean",
        "gtin",
      ])
      return { data: [{ product_id: "prod-1" }], error: null }
    },
    products: () => ({ data: [{ id: "prod-1", category_key: "conditioner" }], error: null }),
  })
  const result = await lookupCatalogProductByIdentifier(client as never, {
    type: "gtin",
    value: "4006381333931",
  })
  assert.deepEqual(result, { productId: "prod-1", category: "conditioner" })
})

test("lookupCatalogProductByIdentifier: inactive-only match is a miss", async () => {
  const { client } = stubClient({
    product_identifiers: () => ({ data: [{ product_id: "prod-inactive" }], error: null }),
    products: () => ({ data: [], error: null }), // filtered out by is_active=true upstream
  })
  const result = await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "4006381333931",
  })
  assert.equal(result, null)
})

test("lookupCatalogProductByIdentifier: a discontinued product is filtered out too", async () => {
  const seen: Array<Map<string, unknown>> = []
  const { client } = stubClient({
    product_identifiers: () => ({ data: [{ product_id: "prod-discontinued" }], error: null }),
    products: (calls) => {
      seen.push(calls.filters)
      // The lifecycle filter is applied in the query, so the row never comes back.
      return { data: [], error: null }
    },
  })
  const result = await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "4006381333931",
  })
  assert.equal(result, null)
  assert.equal(seen[0].get("lifecycle_status"), "active")
})

test("lookupCatalogProductByIdentifier: no identifier row is a miss", async () => {
  const { client } = stubClient({
    product_identifiers: () => ({ data: [], error: null }),
    products: () => ({ data: [], error: null }),
  })
  const result = await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "4006381333931",
  })
  assert.equal(result, null)
})

test("lookupCatalogProductByIdentifier: collision picks lowest id and warns with both ids", async () => {
  const { client } = stubClient({
    product_identifiers: () => ({
      data: [{ product_id: "prod-b" }, { product_id: "prod-a" }],
      error: null,
    }),
    products: () => ({
      data: [
        { id: "prod-b", category_key: "shampoo" },
        { id: "prod-a", category_key: "shampoo" },
      ],
      error: null,
    }),
  })

  const warnCalls: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args)
  }
  try {
    const result = await lookupCatalogProductByIdentifier(client as never, {
      type: "ean",
      value: "4006381333931",
    })
    assert.deepEqual(result, { productId: "prod-a", category: "shampoo" })
    assert.equal(warnCalls.length, 1)
    const [, payload] = warnCalls[0] as [string, { winnerId: string; otherIds: string[] }]
    assert.equal(payload.winnerId, "prod-a")
    assert.deepEqual(payload.otherIds, ["prod-b"])
  } finally {
    console.warn = originalWarn
  }
})

test("lookupCatalogProductByIdentifier: queries raw-normalized AND canonical GTIN forms", async () => {
  // Deploy-order safety: stored rows may be un-canonicalized (pre-migration) or
  // canonicalized (post-migration) — the query must match either spelling.
  const { client } = stubClient({
    product_identifiers: (calls) => {
      assert.deepEqual(calls.filters.get("normalized_identifier_value"), [
        "0022796976116",
        "00022796976116",
      ])
      return { data: [], error: null }
    },
    products: () => ({ data: [], error: null }),
  })
  await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "0022796976116",
  })
})

test("lookupCatalogProductByIdentifier: already-canonical value queries a single deduped form", async () => {
  const { client } = stubClient({
    product_identifiers: (calls) => {
      assert.deepEqual(calls.filters.get("normalized_identifier_value"), ["00022796976116"])
      return { data: [], error: null }
    },
    products: () => ({ data: [], error: null }),
  })
  await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "00022796976116",
  })
})

test("lookupCatalogProductByIdentifier: non-GTIN value falls back to raw-normalized only", async () => {
  const { client } = stubClient({
    product_identifiers: (calls) => {
      assert.deepEqual(calls.filters.get("normalized_identifier_value"), ["not-a-barcode"])
      return { data: [], error: null }
    },
    products: () => ({ data: [], error: null }),
  })
  await lookupCatalogProductByIdentifier(client as never, {
    type: "ean",
    value: "not-a-barcode",
  })
})
