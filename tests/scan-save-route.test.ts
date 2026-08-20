import assert from "node:assert/strict"
import test from "node:test"

import { createScanSaveRouteHandlers, type ScanSaveRouteDeps } from "../src/app/api/scan/save/route"

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"

function baseDeps(overrides: Partial<ScanSaveRouteDeps> = {}): ScanSaveRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    saveWishlist: async () => ({ outcome: "saved" }),
    removeWishlist: async () => {},
    saveRoutine: async () => ({ outcome: "saved" }),
    removeRoutine: async () => {},
    ...overrides,
  }
}

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://test/api/scan/save", { method, body: JSON.stringify(body) })
}

test("scan save POST: unauthenticated is rejected", async () => {
  const handlers = createScanSaveRouteHandlers(baseDeps({ getUserId: async () => null }))
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 401)
})

test("scan save POST: rate limited returns 429 with Retry-After, before any write", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      checkRateLimit: async () => ({ allowed: false }),
      saveWishlist: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("Retry-After"), "60")
  assert.deepEqual(await response.json(), { error: "rate_limited" })
})

test("scan save POST: rate limiter unavailable fails closed with 503", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }) }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
})

test("scan save DELETE: rate limited returns 429, before any removal", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      checkRateLimit: async () => ({ allowed: false }),
      removeWishlist: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 429)
  assert.deepEqual(await response.json(), { error: "rate_limited" })
})

test("scan save POST: invalid body is rejected", async () => {
  const handlers = createScanSaveRouteHandlers(baseDeps())
  const response = await handlers.POST(request("POST", { productId, kind: "not_a_kind" }))
  assert.equal(response.status, 400)
})

test("scan save POST merkliste: calls the wishlist saver, not the routine saver", async () => {
  const calls: string[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      saveWishlist: async () => {
        calls.push("wishlist")
        return { outcome: "saved" }
      },
      saveRoutine: async () => {
        calls.push("routine")
        return { outcome: "saved" }
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["wishlist"])
  assert.deepEqual(await response.json(), { ok: true, kind: "merkliste", productId })
})

test("scan save POST merkliste: a refused product maps to 409, same as routine", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ saveWishlist: async () => ({ outcome: "product_not_saveable" }) }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "product_not_saveable" })
})

test("scan save POST merkliste: an inactive/unknown product maps to 404", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ saveWishlist: async () => ({ outcome: "product_not_found" }) }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "product_not_found" })
})

test("scan save POST routine: product_not_found from the helper maps to 404", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ saveRoutine: async () => ({ outcome: "product_not_found" }) }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "routine" }))
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "product_not_found" })
})

test("scan save POST routine: refused (quarantined or non-curated/not-owned) maps to 409", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ saveRoutine: async () => ({ outcome: "product_not_saveable" }) }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "routine" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "product_not_saveable" })
})

test("scan save POST routine: success", async () => {
  const handlers = createScanSaveRouteHandlers(baseDeps())
  const response = await handlers.POST(request("POST", { productId, kind: "routine" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, kind: "routine", productId })
})

test("scan save DELETE: unauthenticated is rejected", async () => {
  const handlers = createScanSaveRouteHandlers(baseDeps({ getUserId: async () => null }))
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 401)
})

test("scan save DELETE merkliste: calls the wishlist remover", async () => {
  const calls: string[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      removeWishlist: async () => {
        calls.push("wishlist")
      },
      removeRoutine: async () => {
        calls.push("routine")
      },
    }),
  )
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["wishlist"])
})

test("scan save DELETE routine: calls the routine remover, is idempotent on repeat calls", async () => {
  const calls: string[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      removeRoutine: async () => {
        calls.push("routine")
      },
    }),
  )
  const first = await handlers.DELETE(request("DELETE", { productId, kind: "routine" }))
  const second = await handlers.DELETE(request("DELETE", { productId, kind: "routine" }))
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.deepEqual(calls, ["routine", "routine"])
})

test("scan save POST: an unexpected error maps to 503", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      saveWishlist: async () => {
        throw new Error("boom")
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 503)
})
