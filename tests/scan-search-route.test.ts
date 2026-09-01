import assert from "node:assert/strict"
import test from "node:test"

import {
  createScanSearchRouteHandler,
  searchScanCatalog,
  type ScanSearchRouteDeps,
} from "../src/app/api/scan/search/route"

const userId = "11111111-1111-4111-8111-111111111111"

function baseDeps(overrides: Partial<ScanSearchRouteDeps> = {}): ScanSearchRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    search: async () => [],
    ...overrides,
  }
}

function request(query: string) {
  return new Request(`http://test/api/scan/search${query}`)
}

test("scan search: unauthenticated is rejected", async () => {
  const handler = createScanSearchRouteHandler(baseDeps({ getUserId: async () => null }))
  const response = await handler(request("?q=shampoo"))
  assert.equal(response.status, 401)
})

test("scan search: rate limited returns 429", async () => {
  const handler = createScanSearchRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  )
  const response = await handler(request("?q=shampoo"))
  assert.equal(response.status, 429)
})

test("scan search: rate limiter unavailable fails closed with 503, without a Sentry capture", async () => {
  const captured: unknown[] = []
  const handler = createScanSearchRouteHandler(
    baseDeps({
      checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
      captureScanException: (_error, details) => {
        captured.push(details)
      },
    }),
  )
  const response = await handler(request("?q=shampoo"))
  assert.equal(response.status, 503)
  assert.deepEqual(captured, [])
})

test("scan search: a too-short query is empty results, not a 400", async () => {
  const handler = createScanSearchRouteHandler(
    baseDeps({
      search: async () => {
        throw new Error("must not search on a too-short query")
      },
    }),
  )
  const response = await handler(request("?q=a"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { results: [] })
})

test("scan search: missing q param is empty results", async () => {
  const handler = createScanSearchRouteHandler(baseDeps())
  const response = await handler(request(""))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { results: [] })
})

test("scan search: returns the injected search results", async () => {
  const entry = {
    id: "prod-1",
    name: "Shampoo X",
    brand: "Marke",
    category: "shampoo" as const,
    categoryLabel: "Shampoo",
    imageUrl: null,
  }
  const handler = createScanSearchRouteHandler(baseDeps({ search: async () => [entry] }))
  const response = await handler(request("?q=shampoo"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { results: [entry] })
})

test("scan search: an unexpected lookup error maps to 503 and captures to Sentry", async () => {
  const thrown = new Error("scan_search_catalog_unavailable")
  const captured: unknown[] = []
  const handler = createScanSearchRouteHandler(
    baseDeps({
      search: async () => {
        throw thrown
      },
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  )
  const response = await handler(request("?q=shampoo"))
  assert.equal(response.status, 503)
  assert.deepEqual(captured, [{ route: "search", status: 503, reason: "search_failed", userId }])
})

/**
 * `searchScanCatalog` itself, against a stub client — matching/ranking, not just the
 * route's plumbing. Routes by table so the `products` query and the
 * `personal_plan_product_search_dispositions` query (loaded concurrently) can be given
 * independent responses.
 */
function stubProductsClient(
  rows: unknown[],
  options: { quarantinedIds?: string[]; productsError?: unknown } = {},
) {
  const calls: { filters: Map<string, unknown>; limit?: number } = { filters: new Map() }
  const productsChain = {
    select: () => productsChain,
    eq: (column: string, value: unknown) => {
      calls.filters.set(column, value)
      return productsChain
    },
    in: (column: string, values: unknown) => {
      calls.filters.set(column, values)
      return productsChain
    },
    limit: (value: number) => {
      calls.limit = value
      return productsChain
    },
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: rows, error: options.productsError ?? null }),
  }
  const dispositionsChain = {
    select: () => dispositionsChain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({
        data: (options.quarantinedIds ?? []).map((product_id) => ({ product_id })),
        error: null,
      }),
  }
  const client = {
    from: (table: string) => {
      if (table === "personal_plan_product_search_dispositions") return dispositionsChain
      return productsChain
    },
  }
  return { client, calls }
}

test("searchScanCatalog: matches across brand+name, case-insensitive", async () => {
  const { client } = stubProductsClient([
    {
      id: "1",
      name: "Repair Shampoo",
      brand: "Einhorn",
      category_key: "shampoo",
      image_url: null,
      sort_order: 1,
    },
    {
      id: "2",
      name: "Conditioner",
      brand: "Andere Marke",
      category_key: "conditioner",
      image_url: null,
      sort_order: 1,
    },
  ])
  const results = await searchScanCatalog(client as never, "EINHORN")
  assert.equal(results.length, 1)
  assert.equal(results[0].id, "1")
  assert.equal(results[0].categoryLabel, "Shampoo")
})

test("searchScanCatalog: an exact label match ranks first regardless of sort_order", async () => {
  const { client } = stubProductsClient([
    {
      id: "1",
      name: "Shampoo Deluxe",
      brand: "Marke",
      category_key: "shampoo",
      image_url: null,
      sort_order: 0,
    },
    {
      id: "2",
      name: "Shampoo",
      brand: "Marke",
      category_key: "shampoo",
      image_url: null,
      sort_order: 9,
    },
  ])
  const results = await searchScanCatalog(client as never, "marke shampoo")
  assert.equal(results[0].id, "2")
})

test("searchScanCatalog: caps results at 8", async () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: `p${index}`,
    name: `Shampoo ${index}`,
    brand: "Marke",
    category_key: "shampoo",
    image_url: null,
    sort_order: index,
  }))
  const { client } = stubProductsClient(rows)
  const results = await searchScanCatalog(client as never, "shampoo")
  assert.equal(results.length, 8)
})

test("searchScanCatalog: a query load error throws a stable error", async () => {
  const { client } = stubProductsClient([], { productsError: { message: "boom" } })
  await assert.rejects(
    () => searchScanCatalog(client as never, "shampoo"),
    /scan_search_catalog_unavailable/,
  )
})

test("searchScanCatalog: excludes a disposition-quarantined product (ruling R7)", async () => {
  const { client } = stubProductsClient(
    [
      {
        id: "1",
        name: "Shampoo Deluxe",
        brand: "Marke",
        category_key: "shampoo",
        image_url: null,
        sort_order: 0,
      },
      {
        id: "2",
        name: "Shampoo Basic",
        brand: "Marke",
        category_key: "shampoo",
        image_url: null,
        sort_order: 1,
      },
    ],
    { quarantinedIds: ["1"] },
  )
  const results = await searchScanCatalog(client as never, "shampoo")
  assert.deepEqual(
    results.map((r) => r.id),
    ["2"],
  )
})
