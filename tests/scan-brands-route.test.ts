import assert from "node:assert/strict"
import test from "node:test"

import {
  createScanBrandsRouteHandler,
  type ScanBrandsRouteDeps,
} from "../src/app/api/scan/brands/route"

const userId = "user-1"

function baseDeps(overrides: Partial<ScanBrandsRouteDeps> = {}): ScanBrandsRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    suggest: async () => ["OGX", "Olaplex"],
    ...overrides,
  }
}

const request = (q: string | null) =>
  new Request(`http://test/api/scan/brands${q === null ? "" : `?q=${encodeURIComponent(q)}`}`)

test("scan brands: unauthenticated is rejected", async () => {
  const handler = createScanBrandsRouteHandler(baseDeps({ getUserId: async () => null }))
  const response = await handler(request("og"))
  assert.equal(response.status, 401)
})

test("scan brands: rate limited returns 429 with Retry-After", async () => {
  const handler = createScanBrandsRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  )
  const response = await handler(request("og"))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("Retry-After"), "60")
})

test("scan brands: returns suggestions for a valid query", async () => {
  const seen: string[] = []
  const handler = createScanBrandsRouteHandler(
    baseDeps({
      suggest: async (_client, query) => {
        seen.push(query)
        return ["OGX", "Olaplex"]
      },
    }),
  )
  const response = await handler(request("og"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await response.json(), { brands: ["OGX", "Olaplex"] })
  assert.deepEqual(seen, ["og"])
})

test("scan brands: too-short query is a normal empty state, not an error", async () => {
  const handler = createScanBrandsRouteHandler(
    baseDeps({
      suggest: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handler(request("o"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { brands: [] })
})

test("scan brands: a failing lookup maps to 503", async () => {
  const handler = createScanBrandsRouteHandler(
    baseDeps({
      suggest: async () => {
        throw new Error("scan_brand_suggestions_failed")
      },
    }),
  )
  const response = await handler(request("og"))
  assert.equal(response.status, 503)
})
