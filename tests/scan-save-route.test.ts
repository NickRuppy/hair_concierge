import assert from "node:assert/strict"
import test from "node:test"

import { createScanSaveRouteHandlers, type ScanSaveRouteDeps } from "../src/app/api/scan/save/route"
import type { ScanSavedStatePayload } from "../src/lib/scan/saved-state"

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"

const NOT_SAVED: ScanSavedStatePayload = { state: null, managedByScan: false }
const MERKLISTE: ScanSavedStatePayload = { state: "merkliste", managedByScan: true }
const SCAN_ROUTINE: ScanSavedStatePayload = { state: "routine", managedByScan: true }
const FOREIGN_ROUTINE: ScanSavedStatePayload = { state: "routine", managedByScan: false }

function baseDeps(overrides: Partial<ScanSaveRouteDeps> = {}): ScanSaveRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    saveWishlist: async () => ({ outcome: "saved", savedState: MERKLISTE }),
    removeWishlist: async () => ({ outcome: "removed" }),
    saveRoutine: async () => ({ outcome: "saved", savedState: SCAN_ROUTINE }),
    removeRoutine: async () => ({ outcome: "removed" }),
    loadSavedState: async () => NOT_SAVED,
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

test("scan save POST: rate limiter unavailable fails closed with 503, without a Sentry capture", async () => {
  const captured: unknown[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
      captureScanException: (_error, details) => {
        captured.push(details)
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  assert.deepEqual(captured, [])
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
        calls.push("save:wishlist")
        return { outcome: "saved", savedState: MERKLISTE }
      },
      saveRoutine: async () => {
        calls.push("save:routine")
        return { outcome: "saved", savedState: SCAN_ROUTINE }
      },
      removeRoutine: async () => {
        calls.push("remove:routine")
        return { outcome: "removed" }
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  // The move happens inside this one request: save the new kind, drop the other one.
  assert.deepEqual(calls, ["save:wishlist", "remove:routine"])
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "merkliste",
    productId,
    savedState: MERKLISTE,
  })
})

test("scan save POST: the move spends exactly one rate-limit charge", async () => {
  let charges = 0
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      checkRateLimit: async () => {
        charges += 1
        return { allowed: true }
      },
    }),
  )
  await handlers.POST(request("POST", { productId, kind: "routine" }))
  assert.equal(charges, 1)
})

test("scan save POST: a refused cleanup is not a failure, the save still stands", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      saveWishlist: async () => ({ outcome: "saved", savedState: MERKLISTE }),
      // A Stage-3 routine row is not the scan surface's to move.
      removeRoutine: async () => ({ outcome: "not_removable_here" }),
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "merkliste",
    productId,
    savedState: MERKLISTE,
  })
})

test("scan save POST: a failed cleanup reports save_incomplete, never a silent success, and captures to Sentry", async () => {
  const thrown = new Error("cleanup boom")
  const captured: unknown[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      removeWishlist: async () => {
        throw thrown
      },
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "routine" }))
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: "save_incomplete" })
  assert.deepEqual(captured, [
    { route: "save", status: 500, reason: "save_move_cleanup_failed", userId },
  ])
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

test("scan save POST routine: product_not_saveable from the helper (search-quarantined) maps to 409", async () => {
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
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "routine",
    productId,
    savedState: SCAN_ROUTINE,
  })
})

test("scan save POST routine: an already-owned foreign row reports managedByScan false", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ saveRoutine: async () => ({ outcome: "saved", savedState: FOREIGN_ROUTINE }) }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "routine" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "routine",
    productId,
    savedState: FOREIGN_ROUTINE,
  })
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
        return { outcome: "removed" }
      },
      removeRoutine: async () => {
        calls.push("routine")
        return { outcome: "removed" }
      },
    }),
  )
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["wishlist"])
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "merkliste",
    productId,
    savedState: NOT_SAVED,
  })
})

test("scan save DELETE merkliste: reports a routine row the removal left behind", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({ loadSavedState: async () => FOREIGN_ROUTINE }),
  )
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "merkliste",
    productId,
    savedState: FOREIGN_ROUTINE,
  })
})

test("scan save DELETE routine: a foreign row is refused with 409 not_removable_here", async () => {
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      removeRoutine: async () => ({ outcome: "not_removable_here" }),
      loadSavedState: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "routine" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "not_removable_here" })
})

test("scan save DELETE routine: calls the routine remover, is idempotent on repeat calls", async () => {
  const calls: string[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      removeRoutine: async () => {
        calls.push("routine")
        return { outcome: "removed" }
      },
    }),
  )
  const first = await handlers.DELETE(request("DELETE", { productId, kind: "routine" }))
  const second = await handlers.DELETE(request("DELETE", { productId, kind: "routine" }))
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.deepEqual(calls, ["routine", "routine"])
})

test("scan save POST: an unexpected error maps to 503 and captures to Sentry", async () => {
  const thrown = new Error("boom")
  const captured: unknown[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      saveWishlist: async () => {
        throw thrown
      },
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  )
  const response = await handlers.POST(request("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 503)
  assert.deepEqual(captured, [{ route: "save", status: 503, reason: "save_failed", userId }])
})

test("scan save DELETE: an unexpected error maps to 503 and captures to Sentry", async () => {
  const thrown = new Error("boom")
  const captured: unknown[] = []
  const handlers = createScanSaveRouteHandlers(
    baseDeps({
      removeWishlist: async () => {
        throw thrown
      },
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  )
  const response = await handlers.DELETE(request("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 503)
  assert.deepEqual(captured, [
    { route: "save", status: 503, reason: "save_removal_failed", userId },
  ])
})
