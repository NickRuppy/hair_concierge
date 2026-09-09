import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createUpdateSession, type UpdateSessionDependencies } from "../src/lib/supabase/middleware"
import { createScanSaveRouteHandlers, type ScanSaveRouteDeps } from "../src/app/api/scan/save/route"
import {
  createScanWishlistRouteHandler,
  type ScanWishlistRouteDeps,
} from "../src/app/api/scan/wishlist/route"
import {
  hasFreemiumPaidAccess,
  type HasFreemiumPaidAccessDeps,
} from "../src/lib/entitlements/access"
import type { ModeratorAccessResolution } from "../src/lib/personal-plan-field-test/moderator"

/**
 * Adversarial direct-request suite for plans/freemium-scanner-first/enforcement-matrix.md
 * (task T4). Two seams are exercised:
 *
 * 1. Middleware (T2): premium API prefixes that stay fully subscription-gated
 *    (no freemium admission). `/api/chat` already has this proof in
 *    tests/auth-middleware-personal-plan-routine.test.ts; the two rows below
 *    (`/api/profile`, `/api/personal-plan/stage-1/previews`) had no
 *    dedicated e2e proof yet, only the pure `shouldRedirectToReactivation`
 *    prefix-list test — added here per the matrix doc.
 * 2. In-route guards (T4, this task): `/api/scan/save` and
 *    `/api/scan/wishlist`, which the middleware now admits to free users
 *    (see enforcement-matrix.md) and which therefore need their own
 *    server-side premium check.
 */

// --- 1. Middleware-enforced premium rows without a prior e2e test ----------

const freeUserId = "33333333-3333-4333-8333-333333333333"

function createFreeUserMiddleware() {
  const fakeSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: freeUserId, email: "free@example.com", app_metadata: {} } },
      }),
    },
    from(table: string) {
      throw new Error(`unexpected table read: ${table}`)
    },
  }

  const dependencies: UpdateSessionDependencies = {
    createServerClient: (() =>
      fakeSupabase) as unknown as UpdateSessionDependencies["createServerClient"],
    hasCurrentAppAccess: (async () => false) as UpdateSessionDependencies["hasCurrentAppAccess"],
    hasCurrentPaidAppAccess: (async () =>
      false) as UpdateSessionDependencies["hasCurrentPaidAppAccess"],
    resolveOneTimeAccessState: (async () =>
      "none") as UpdateSessionDependencies["resolveOneTimeAccessState"],
    resolveModeratorAccess: (async () =>
      "none") as UpdateSessionDependencies["resolveModeratorAccess"],
    getRouteEnvironment: () => ({ nodeEnv: "test", localDevLoginEnabled: false }),
  }

  return createUpdateSession(dependencies)
}

async function withFlagOn(fn: () => Promise<void>) {
  const original = process.env.FREEMIUM_SCANNER_FIRST_ENABLED
  process.env.FREEMIUM_SCANNER_FIRST_ENABLED = "true"
  try {
    await fn()
  } finally {
    if (original === undefined) delete process.env.FREEMIUM_SCANNER_FIRST_ENABLED
    else process.env.FREEMIUM_SCANNER_FIRST_ENABLED = original
  }
}

test("flag on: a free authenticated user is still denied /api/profile (non-admitted, subscription_required)", async () => {
  await withFlagOn(async () => {
    const response = await createFreeUserMiddleware()(
      new NextRequest("https://chaarlie.de/api/profile"),
    )
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: "subscription_required" })
  })
})

test("flag on: a free authenticated user is still denied /api/personal-plan/stage-1/previews (non-admitted, subscription_required)", async () => {
  await withFlagOn(async () => {
    const response = await createFreeUserMiddleware()(
      new NextRequest("https://chaarlie.de/api/personal-plan/stage-1/previews"),
    )
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: "subscription_required" })
  })
})

// --- 2. In-route guards: /api/scan/save -------------------------------------

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"

function saveDeps(overrides: Partial<ScanSaveRouteDeps> = {}): ScanSaveRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    moveSavedProduct: async (_client, _userId, _productId, kind) => ({
      outcome: "saved",
      savedState: { state: kind === "merkliste" ? "merkliste" : "routine", managedByScan: true },
    }),
    removeWishlist: async () => ({ outcome: "removed" }),
    removeRoutine: async () => ({ outcome: "removed" }),
    loadSavedState: async () => ({ state: null, managedByScan: false }),
    requirePremiumAccess: async () => true,
    ...overrides,
  }
}

function saveRequest(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://test/api/scan/save", { method, body: JSON.stringify(body) })
}

test("scan save POST: a free-tier user (flag-ON reachable) is denied with the middleware's subscription_required shape", async () => {
  const handlers = createScanSaveRouteHandlers(
    saveDeps({
      requirePremiumAccess: async () => false,
      moveSavedProduct: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handlers.POST(saveRequest("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: "subscription_required" })
})

test("scan save DELETE: a free-tier user is denied before any removal", async () => {
  const handlers = createScanSaveRouteHandlers(
    saveDeps({
      requirePremiumAccess: async () => false,
      removeWishlist: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handlers.DELETE(saveRequest("DELETE", { productId, kind: "merkliste" }))
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: "subscription_required" })
})

test("scan save POST: a paid user (composite true) passes through unchanged", async () => {
  const handlers = createScanSaveRouteHandlers(saveDeps({ requirePremiumAccess: async () => true }))
  const response = await handlers.POST(saveRequest("POST", { productId, kind: "merkliste" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    kind: "merkliste",
    productId,
    savedState: { state: "merkliste", managedByScan: true },
  })
})

// --- 2. In-route guards: /api/scan/wishlist ---------------------------------

function wishlistDeps(overrides: Partial<ScanWishlistRouteDeps> = {}): ScanWishlistRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    listWishlist: async () => [],
    requirePremiumAccess: async () => true,
    ...overrides,
  }
}

test("scan wishlist GET: a free-tier user is denied with the middleware's subscription_required shape", async () => {
  const handler = createScanWishlistRouteHandler(
    wishlistDeps({
      requirePremiumAccess: async () => false,
      listWishlist: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handler(new Request("http://test/api/scan/wishlist"))
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: "subscription_required" })
})

test("scan wishlist GET: a paid user passes through unchanged", async () => {
  const entry = {
    productId: "prod-1",
    name: "Shampoo X",
    brand: "Marke",
    imageUrl: null,
    priceLabel: "12,99 €",
    purchaseUrl: "https://example.com/p",
  }
  const handler = createScanWishlistRouteHandler(
    wishlistDeps({ requirePremiumAccess: async () => true, listWishlist: async () => [entry] }),
  )
  const response = await handler(new Request("http://test/api/scan/wishlist"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { entries: [entry] })
})

// --- 3. hasFreemiumPaidAccess: the composite guard util itself --------------

function accessDeps(overrides: Partial<HasFreemiumPaidAccessDeps> = {}): HasFreemiumPaidAccessDeps {
  return {
    client: {} as never,
    hasAppAccess: async () => false,
    hasPaidAppAccess: async () => false,
    resolveOneTimeAccessState: async () => "none",
    resolveModeratorAccess: async () => ({ kind: "none" }) satisfies ModeratorAccessResolution,
    ...overrides,
  }
}

test("hasFreemiumPaidAccess: no active subscription, one-time access, or moderator grant denies", async () => {
  const result = await hasFreemiumPaidAccess(userId, accessDeps())
  assert.equal(result, false)
})

test("hasFreemiumPaidAccess: an active subscription (hasAppAccess) grants access", async () => {
  const result = await hasFreemiumPaidAccess(userId, accessDeps({ hasAppAccess: async () => true }))
  assert.equal(result, true)
})

test("hasFreemiumPaidAccess: an active one-time purchase grants access even when hasAppAccess is false", async () => {
  const result = await hasFreemiumPaidAccess(
    userId,
    accessDeps({ resolveOneTimeAccessState: async () => "active" }),
  )
  assert.equal(result, true)
})

test("hasFreemiumPaidAccess: an active moderator grant grants access", async () => {
  const result = await hasFreemiumPaidAccess(
    userId,
    accessDeps({
      resolveModeratorAccess: async () => ({
        kind: "active",
        campaignId: "c1",
        expiresAt: "2026-12-31T00:00:00.000Z",
      }),
    }),
  )
  assert.equal(result, true)
})

test("hasFreemiumPaidAccess: an ended moderator cannot retain access through a manual grant alone (mirrors T2 I1/I3 fix)", async () => {
  const result = await hasFreemiumPaidAccess(
    userId,
    accessDeps({
      hasAppAccess: async () => true, // manual-grant-inclusive check says yes
      hasPaidAppAccess: async () => false, // independent (excludes manual grants) check says no
      resolveModeratorAccess: async () => ({ kind: "ended", campaignId: "c1" }),
    }),
  )
  assert.equal(result, false)
})

test("hasFreemiumPaidAccess: an ended moderator with independently verified paid access remains admitted", async () => {
  const result = await hasFreemiumPaidAccess(
    userId,
    accessDeps({
      hasAppAccess: async () => true,
      hasPaidAppAccess: async () => true,
      resolveModeratorAccess: async () => ({ kind: "ended", campaignId: "c1" }),
    }),
  )
  assert.equal(result, true)
})

test("hasFreemiumPaidAccess: an unavailable moderator lookup falls back to the independent paid-access check", async () => {
  const denied = await hasFreemiumPaidAccess(
    userId,
    accessDeps({
      hasAppAccess: async () => true,
      hasPaidAppAccess: async () => false,
      resolveModeratorAccess: async () => ({ kind: "unavailable" }),
    }),
  )
  assert.equal(denied, false)

  const admitted = await hasFreemiumPaidAccess(
    userId,
    accessDeps({
      hasAppAccess: async () => true,
      hasPaidAppAccess: async () => true,
      resolveModeratorAccess: async () => ({ kind: "unavailable" }),
    }),
  )
  assert.equal(admitted, true)
})
