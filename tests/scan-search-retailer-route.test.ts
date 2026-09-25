import assert from "node:assert/strict"
import test from "node:test"

import { DmMcpError, type DmProductDetailsRow } from "../src/lib/scan/enrichment/dm-mcp-client"
import {
  createScanRetailerSearchRouteHandler,
  partitionDmSearchRows,
  type ScanRetailerSearchRouteDeps,
} from "../src/app/api/scan/search-retailer/route"

import {
  SCAN_RATE_LIMIT,
  SCAN_RETAILER_SEARCH_RATE_LIMIT,
  type RateLimitConfig,
} from "../src/lib/rate-limit"

const userId = "11111111-1111-4111-8111-111111111111"

function baseDeps(
  overrides: Partial<ScanRetailerSearchRouteDeps> = {},
): ScanRetailerSearchRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    isRetailerSearchEnabled: () => true,
    retailerEnrichmentTimeoutMs: () => 1500,
    searchDmProducts: async () => [],
    partitionDmSearchRows: async () => ({ catalog: [], retailer: [] }),
    reportRetailerSearchOutcome: () => {},
    ...overrides,
  }
}

function request(query: string) {
  return new Request(`http://test/api/scan/search-retailer${query}`)
}

// -- Route wrapper: auth, rate limit, flag gate, query bounds, dm-lane orchestration --

test("scan search-retailer: unauthenticated is rejected", async () => {
  const handler = createScanRetailerSearchRouteHandler(baseDeps({ getUserId: async () => null }))
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 401)
})

test("scan search-retailer: rate limited returns 429", async () => {
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  )
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 429)
})

test("scan search-retailer: consumes only its own retailer bucket, never the shared scan bucket", async () => {
  const checked: RateLimitConfig[] = []
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      checkRateLimit: async (_identifier, config) => {
        checked.push(config)
        return { allowed: true }
      },
    }),
  )
  await handler(request("?q=ogx"))
  assert.deepEqual(checked, [SCAN_RETAILER_SEARCH_RATE_LIMIT])
  assert.notEqual(SCAN_RETAILER_SEARCH_RATE_LIMIT.prefix, SCAN_RATE_LIMIT.prefix)
  assert.equal(SCAN_RETAILER_SEARCH_RATE_LIMIT.limit, 40)
  assert.equal(SCAN_RETAILER_SEARCH_RATE_LIMIT.windowMs, 60_000)
})

test("scan search-retailer: a 429 carries the retailer bucket's Retry-After", async () => {
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  )
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 429)
  const retryAfter = Number(response.headers.get("Retry-After"))
  assert.ok(retryAfter >= 1 && retryAfter <= SCAN_RETAILER_SEARCH_RATE_LIMIT.windowMs / 1000)
})

test("scan search-retailer: flag off returns disabled with no dm or catalog calls", async () => {
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      isRetailerSearchEnabled: () => false,
      searchDmProducts: async () => {
        throw new Error("must not call dm on a disabled flag")
      },
      partitionDmSearchRows: async () => {
        throw new Error("must not partition on a disabled flag")
      },
    }),
  )
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    catalog: [],
    retailer: [],
    retailerOutcome: "disabled",
  })
})

test("scan search-retailer: a too-short query is empty ok, not a dm call", async () => {
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      searchDmProducts: async () => {
        throw new Error("must not call dm on a too-short query")
      },
    }),
  )
  const response = await handler(request("?q=a"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { catalog: [], retailer: [], retailerOutcome: "ok" })
})

test("scan search-retailer: a missing query is empty ok, not a dm call", async () => {
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      searchDmProducts: async () => {
        throw new Error("must not call dm on a missing query")
      },
    }),
  )
  const response = await handler(request(""))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { catalog: [], retailer: [], retailerOutcome: "ok" })
})

test("scan search-retailer: an over-length query is empty ok, not a dm call", async () => {
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      searchDmProducts: async () => {
        throw new Error("must not call dm on an over-length query")
      },
    }),
  )
  const response = await handler(request(`?q=${"a".repeat(121)}`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { catalog: [], retailer: [], retailerOutcome: "ok" })
})

test("scan search-retailer: a dm timeout maps to retailerOutcome unavailable, catalog still an empty array", async () => {
  const reported: unknown[] = []
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      searchDmProducts: async () => {
        throw new DmMcpError("timeout")
      },
      partitionDmSearchRows: async () => {
        throw new Error("must not partition after a dm-lane failure")
      },
      reportRetailerSearchOutcome: (details) => {
        reported.push(details)
      },
    }),
  )
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    catalog: [],
    retailer: [],
    retailerOutcome: "unavailable",
  })
  assert.equal(reported.length, 1)
  assert.equal((reported[0] as { outcome: string }).outcome, "timeout")
})

test("scan search-retailer: a non-DmMcpError dm throw still resolves to unavailable, reported as unexpected", async () => {
  const reported: unknown[] = []
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      searchDmProducts: async () => {
        throw new Error("boom")
      },
      reportRetailerSearchOutcome: (details) => {
        reported.push(details)
      },
    }),
  )
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    catalog: [],
    retailer: [],
    retailerOutcome: "unavailable",
  })
  assert.equal((reported[0] as { outcome: string }).outcome, "unexpected")
})

test("scan search-retailer: a successful dm-lane attempt reports ok with the partitioned counts", async () => {
  const reported: unknown[] = []
  const calls: unknown[] = []
  const catalogRow = {
    id: "p1",
    name: "Shampoo X",
    brand: "Marke",
    category: "shampoo" as const,
    categoryLabel: "Shampoo",
    imageUrl: null,
  }
  const retailerRow = {
    gtin: "00000000000000",
    name: "dm Shampoo",
    brand: null,
    categoryLabel: null,
  }
  const handler = createScanRetailerSearchRouteHandler(
    baseDeps({
      retailerEnrichmentTimeoutMs: () => 1234,
      now: () => 0,
      searchDmProducts: async (query, deadlineMs) => {
        calls.push({ query, deadlineMs })
        return [{ gtin: "3574661799438", title: "OGX Shampoo" }]
      },
      partitionDmSearchRows: async (_client, rows) => {
        calls.push({ rows })
        return { catalog: [catalogRow], retailer: [retailerRow] }
      },
      reportRetailerSearchOutcome: (details) => {
        reported.push(details)
      },
    }),
  )
  const response = await handler(request("?q=ogx"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    catalog: [catalogRow],
    retailer: [retailerRow],
    retailerOutcome: "ok",
  })
  assert.deepEqual(calls[0], { query: "ogx", deadlineMs: 1234 })
  assert.deepEqual((calls[1] as { rows: unknown }).rows, [
    { gtin: "3574661799438", title: "OGX Shampoo" },
  ])
  assert.equal(reported.length, 1)
  assert.deepEqual(reported[0], {
    outcome: "ok",
    durationMs: 0,
    catalogCount: 1,
    retailerCount: 1,
  })
})

// -- partitionDmSearchRows: GTIN boundary policy, partition eligibility, hair filter, cap --

type StubOptions = {
  identifierRows?: Array<{ product_id: string; canonical_gtin14: string }>
  productRows?: unknown[]
  quarantinedIds?: string[]
  identifierError?: unknown
  productsError?: unknown
}

function stubClient(options: StubOptions = {}) {
  const identifierChain = {
    select: () => identifierChain,
    in: () => identifierChain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: options.identifierRows ?? [], error: options.identifierError ?? null }),
  }
  const productsChain = {
    select: () => productsChain,
    eq: () => productsChain,
    in: () => productsChain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: options.productRows ?? [], error: options.productsError ?? null }),
  }
  const dispositionsChain = {
    select: () => dispositionsChain,
    in: () => dispositionsChain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({
        data: (options.quarantinedIds ?? []).map((product_id) => ({ product_id })),
        error: null,
      }),
  }
  return {
    from: (table: string) => {
      if (table === "product_identifiers") return identifierChain
      if (table === "personal_plan_product_search_dispositions") return dispositionsChain
      return productsChain
    },
  } as never
}

function dmRow(overrides: Partial<DmProductDetailsRow>): DmProductDetailsRow {
  return {
    gtin: "3574661799438",
    dan: "1442074",
    brand: "OGX",
    title: "Shampoo renewing, Argan Oil of marocco, 385 ml",
    category: "Shampoo > Haarpflege",
    ...overrides,
  }
}

test("partitionDmSearchRows: an 11-digit gtin is padded to 12 and then maps", async () => {
  const client = stubClient({
    identifierRows: [{ product_id: "p1", canonical_gtin14: "00022796972200" }],
    productRows: [
      {
        id: "p1",
        name: "Coconut Shampoo",
        brand: "OGX",
        category_key: "shampoo",
        image_url: null,
        sort_order: 1,
      },
    ],
  })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "22796972200", title: "Shampoo Coconut Miracle Oil, 385 ml" }),
  ])
  assert.equal(result.catalog.length, 1)
  assert.equal(result.catalog[0].id, "p1")
  assert.equal(result.retailer.length, 0)
})

test("partitionDmSearchRows: a leading-zero-lost 11-digit gtin maps after padding", async () => {
  const client = stubClient({
    identifierRows: [{ product_id: "p2", canonical_gtin14: "00071164341469" }],
    productRows: [
      {
        id: "p2",
        name: "Repair Shampoo",
        brand: "HASK",
        category_key: "shampoo",
        image_url: null,
        sort_order: 1,
      },
    ],
  })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "71164341469", title: "Shampoo repair + argan oil, 473 ml" }),
  ])
  assert.equal(result.catalog.length, 1)
  assert.equal(result.catalog[0].id, "p2")
})

test("partitionDmSearchRows: a bad-checksum gtin is dropped", async () => {
  const client = stubClient()
  const result = await partitionDmSearchRows(client, [dmRow({ gtin: "12345678901" })])
  assert.deepEqual(result, { catalog: [], retailer: [] })
})

test("partitionDmSearchRows: a missing gtin is dropped", async () => {
  const client = stubClient()
  const row = dmRow({})
  delete (row as Record<string, string | undefined>).gtin
  const result = await partitionDmSearchRows(client, [row])
  assert.deepEqual(result, { catalog: [], retailer: [] })
})

test("partitionDmSearchRows: a duplicate canonical gtin keeps the first (best-ranked) row", async () => {
  const client = stubClient()
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "3574661799438", title: "First Ranked Shampoo" }),
    dmRow({ gtin: "3574661799438", title: "Second Ranked Shampoo" }),
  ])
  assert.equal(result.retailer.length, 1)
  assert.equal(result.retailer[0].name, "First Ranked Shampoo")
})

test("partitionDmSearchRows: dedupe is keyed on the canonical form, not the raw string", async () => {
  const client = stubClient()
  // Two distinct raw spellings of the same barcode (13-digit vs. explicit 14-digit) —
  // both canonicalize to "03574661799438". Dedupe must collapse them into one row
  // despite the raw strings differing.
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "3574661799438", title: "First Ranked Shampoo" }),
    dmRow({ gtin: "03574661799438", title: "Second Ranked Shampoo" }),
  ])
  assert.equal(result.retailer.length, 1)
  assert.equal(result.retailer[0].name, "First Ranked Shampoo")
  assert.equal(result.retailer[0].gtin, "3574661799438")
})

// -- Amended contract: outward `gtin` is the resolve-compatible EAN, not the canonical
// GTIN-14 — /api/scan/resolve's validateEanInput only accepts 8/13-digit values.

test("partitionDmSearchRows: an 8-digit-source row surfaces an 8-digit gtin", async () => {
  const client = stubClient()
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "40063812", title: "Shampoo Mini, 100 ml" }),
  ])
  assert.equal(result.retailer.length, 1)
  assert.equal(result.retailer[0].gtin, "40063812")
})

test("partitionDmSearchRows: a 12- or 13-digit-source row surfaces a 13-digit gtin", async () => {
  const client = stubClient()
  const result = await partitionDmSearchRows(client, [
    // 12-digit UPC-A source: canonicalizes with two leading zeros, zero-extends to 13.
    dmRow({ gtin: "036000291452", title: "Shampoo US Import, 300 ml" }),
    // 13-digit EAN-13 source: canonicalizes with one leading zero, round-trips as-is.
    dmRow({ gtin: "8700216212847", title: "Shampoo Repair Arganöl, 350 ml" }),
  ])
  assert.equal(result.retailer.length, 2)
  assert.equal(result.retailer[0].gtin, "0036000291452")
  assert.equal(result.retailer[0].gtin.length, 13)
  assert.equal(result.retailer[1].gtin, "8700216212847")
  assert.equal(result.retailer[1].gtin.length, 13)
})

test("partitionDmSearchRows: a non-zero-indicator GTIN-14 has no EAN form and is dropped", async () => {
  const client = stubClient()
  // Indicator digit "1" (a true multipack GTIN-14) — no 8- or 13-digit EAN exists for it.
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "10000000000007", title: "Shampoo Sparpack, 3x385 ml" }),
  ])
  assert.deepEqual(result, { catalog: [], retailer: [] })
})

test("partitionDmSearchRows: an active mapped product goes to catalog via toScanSearchResult", async () => {
  const client = stubClient({
    identifierRows: [{ product_id: "p-active", canonical_gtin14: "03574661818450" }],
    productRows: [
      {
        id: "p-active",
        name: "Bond Protein Repair Shampoo",
        brand: "OGX",
        category_key: "shampoo",
        image_url: null,
        sort_order: 3,
      },
    ],
  })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "3574661818450", title: "Shampoo Bond Protein Repair, 385 ml" }),
  ])
  assert.deepEqual(result.catalog, [
    {
      id: "p-active",
      name: "Bond Protein Repair Shampoo",
      brand: "OGX",
      category: "shampoo",
      categoryLabel: "Shampoo",
      imageUrl: null,
      productLine: null,
    },
  ])
  assert.equal(result.retailer.length, 0)
})

test("partitionDmSearchRows: an inactive/discontinued mapped product presents as dm-only", async () => {
  const client = stubClient({
    identifierRows: [{ product_id: "p-inactive", canonical_gtin14: "08700216212847" }],
    productRows: [], // the eligible-products query excludes it (not active/lifecycle)
  })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "8700216212847", title: "Shampoo Repair Arganöl, 350 ml" }),
  ])
  assert.equal(result.catalog.length, 0)
  assert.equal(result.retailer.length, 1)
  // Resolve-compatible EAN form (amended contract), not the internal canonical GTIN-14.
  assert.equal(result.retailer[0].gtin, "8700216212847")
})

test("partitionDmSearchRows: a dangling identifier (no product_identifiers row) presents as dm-only", async () => {
  const client = stubClient({ identifierRows: [] })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "3574661800202", title: "Shampoo thick & full, Biotin & Collagen, 385 ml" }),
  ])
  assert.equal(result.catalog.length, 0)
  assert.equal(result.retailer.length, 1)
})

test("partitionDmSearchRows: a quarantined product's gtin is dropped entirely (ruling R7)", async () => {
  const client = stubClient({
    identifierRows: [{ product_id: "p-quarantined", canonical_gtin14: "03574661876450" }],
    productRows: [
      {
        id: "p-quarantined",
        name: "ProGrowth Shampoo",
        brand: "OGX",
        category_key: "shampoo",
        image_url: null,
        sort_order: 1,
      },
    ],
    quarantinedIds: ["p-quarantined"],
  })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "3574661876450", title: "Shampoo ProGrowth + Peptide, 385 ml" }),
  ])
  assert.deepEqual(result, { catalog: [], retailer: [] })
})

test("partitionDmSearchRows: a non-hair dm-only row with no category suggestion is dropped", async () => {
  const client = stubClient({ identifierRows: [] })
  const result = await partitionDmSearchRows(client, [
    dmRow({
      gtin: "3600542461856",
      title: "Feinwaschmittel Blütenfrisch, 1 l",
      category: "Spülmittel > Haushalt",
    }),
  ])
  assert.deepEqual(result, { catalog: [], retailer: [] })
})

test("partitionDmSearchRows: a hair-relevant dm-only row keeps a suggested categoryLabel", async () => {
  const client = stubClient({ identifierRows: [] })
  const result = await partitionDmSearchRows(client, [
    dmRow({
      gtin: "3574661800202",
      title: "Conditioner Repair, 385 ml",
      brand: "OGX",
      category: "Conditioner > Haarpflege",
    }),
  ])
  assert.equal(result.retailer.length, 1)
  assert.equal(result.retailer[0].categoryLabel, "Conditioner")
})

test("partitionDmSearchRows: caps dm-only retailer rows at 8, preserving dm order", async () => {
  const gtins = [
    "9000000000001",
    "9000000000018",
    "9000000000025",
    "9000000000032",
    "9000000000049",
    "9000000000056",
    "9000000000063",
    "9000000000070",
    "9000000000087",
  ]
  const client = stubClient({ identifierRows: [] })
  const rows = gtins.map((gtin, index) =>
    dmRow({ gtin, title: `Shampoo Variante ${index}`, category: "Shampoo > Haarpflege" }),
  )
  const result = await partitionDmSearchRows(client, rows)
  assert.equal(result.retailer.length, 8)
  assert.deepEqual(
    result.retailer.map((entry) => entry.name),
    rows.slice(0, 8).map((row) => row.title),
  )
})

test("partitionDmSearchRows: an identifier-lookup error throws a stable error", async () => {
  const client = stubClient({ identifierError: { message: "boom" } })
  await assert.rejects(
    () => partitionDmSearchRows(client, [dmRow({})]),
    /scan_search_retailer_identifier_lookup_failed/,
  )
})

// -- Anti-leak: exact response key sets for both row types --

test("anti-leak: catalog and retailer rows carry exactly the contract's keys", async () => {
  const client = stubClient({
    identifierRows: [{ product_id: "p-active", canonical_gtin14: "03574661818450" }],
    productRows: [
      {
        id: "p-active",
        name: "Bond Protein Repair Shampoo",
        brand: "OGX",
        category_key: "shampoo",
        image_url: null,
        sort_order: 3,
      },
    ],
  })
  const result = await partitionDmSearchRows(client, [
    dmRow({ gtin: "3574661818450", title: "Shampoo Bond Protein Repair, 385 ml" }),
    dmRow({
      gtin: "3574661800202",
      title: "Conditioner Repair, 385 ml",
      category: "Conditioner > Haarpflege",
    }),
  ])
  assert.equal(result.catalog.length, 1)
  assert.equal(result.retailer.length, 1)
  assert.deepEqual(Object.keys(result.catalog[0]).sort(), [
    "brand",
    "category",
    "categoryLabel",
    "id",
    "imageUrl",
    "name",
    "productLine",
  ])
  assert.deepEqual(Object.keys(result.retailer[0]).sort(), [
    "brand",
    "categoryLabel",
    "gtin",
    "name",
  ])
  for (const key of ["dan", "appLink", "price", "description", "productUrl", "imageUrl"]) {
    assert.equal(key in result.retailer[0], false, `retailer row must not carry "${key}"`)
  }
})
