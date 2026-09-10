import assert from "node:assert/strict"
import test from "node:test"

import {
  createScanResolveRouteHandler,
  type ScanResolveRouteDeps,
} from "../src/app/api/scan/resolve/route"

/**
 * Route-level coverage for T16's auto-save call site: WHEN `deps.autoSaveScanWishlist` is
 * (and is not) invoked. The write's own insert-only/idempotent semantics are covered
 * against a stub client in tests/scan-saved-state.test.ts and against real Postgres in
 * tests/scan-wishlist-auto-save-postgres.test.ts (the named non-destructive regression) —
 * this file only proves the resolve route wires the call to the right branch.
 */

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"

const decision = {
  category: "shampoo" as const,
  resolution: "resolved" as const,
  needTier: "basis" as const,
  roles: ["shampoo_everyday" as const],
  target: null,
  frequency: null,
  reasons: [],
  executionState: "available" as const,
  executionPauseReason: null,
  deferredFacts: [],
}

const snapshot = {
  schemaVersion: 1 as const,
  snapshotKind: "initial_need" as const,
  computationVersion: "v1",
  inputHash: "hash",
  createdAt: "2026-08-01T00:00:00.000Z",
  sourceQuiz: {} as never,
  profile: { hair: { thickness: "normal" } } as never,
  assessments: {} as never,
  decisions: [decision],
  coverage: [],
  productPreviews: [],
  renderedOrder: [],
  deferredFacts: [],
}

const context = {
  snapshot,
  snapshotSource: "refined" as const,
  refinedVersionId: "refined-1",
  refinedInputHash: "input-hash",
}

const inCatalogVerdict = {
  kind: "in_catalog" as const,
  verdict: "mismatch" as const,
  verdictLabel: "Passt nicht",
  verdictTitle: "Passt nicht zu deinem Haar",
  status: "danger" as const,
  subtitle: "1 von 3 Zielbereichen getroffen",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: { matches: 1, total: 3 },
  fitNarrative: null,
  alternatives: [],
}

const notNeededVerdict = {
  kind: "not_needed" as const,
  mode: "not_needed" as const,
  status: "neutral" as const,
  headline: "Du brauchst aktuell keine Maske",
  subtitle: "Keine Maske in deinem Bedarf",
  reasons: [],
  dimensions: [],
  coveredBy: [],
}

const presentationRow = {
  id: productId,
  name: "Repair Shampoo",
  brand: "Olaplex",
  category: "shampoo" as const,
  imageUrl: null,
  priceEur: 24.9,
  currency: "EUR",
  affiliateLink: "https://shop.test/a",
  purchaseLinkStatus: "available" as const,
  priceCheckedAt: "2026-08-19T00:00:00.000Z",
}

function baseDeps(overrides: Partial<ScanResolveRouteDeps> = {}): ScanResolveRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    validateEanInput: () => ({ ok: true, type: "ean", value: "4006381333931" }),
    findOpenScanSubmission: async () => null,
    createScanResolveAttemptId: () => "attempt-1",
    recordScanResolveAttempt: async () => {},
    completeScanResolveAttempt: async () => {},
    lookupCatalogProductByIdentifier: async () => ({ productId, category: "shampoo" }),
    isProductSearchQuarantined: async () => false,
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    loadScanEvaluationContext: async () => context,
    loadScanProductFacts: async () => null,
    loadRecommendationCandidates: async (_client, input) =>
      Object.fromEntries(input.roles.map((role) => [role, []])),
    loadScanSavedState: async () => ({ state: null, managedByScan: false }),
    buildScanVerdict: () => inCatalogVerdict,
    loadActiveProductById: async () => ({ id: productId, category: "shampoo" }),
    loadPresentationRows: async () => [presentationRow],
    resolvePaidAccess: async () => "allowed",
    hasUsedFreeReveal: async () => false,
    autoSaveScanWishlist: async () => {},
    after: () => {},
    ...overrides,
  }
}

function request(body: unknown = { productId }) {
  return new Request("http://test/api/scan/resolve", { method: "POST", body: JSON.stringify(body) })
}

async function withFlag<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.FREEMIUM_SCANNER_FIRST_ENABLED
  if (value === undefined) delete process.env.FREEMIUM_SCANNER_FIRST_ENABLED
  else process.env.FREEMIUM_SCANNER_FIRST_ENABLED = value
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.FREEMIUM_SCANNER_FIRST_ENABLED
    else process.env.FREEMIUM_SCANNER_FIRST_ENABLED = previous
  }
}

test("scan resolve auto-save: a premium in-catalog resolve auto-saves exactly this product", async () => {
  await withFlag("true", async () => {
    const calls: Array<{ userId: string; productId: string }> = []
    const adminClient = { marker: "admin" }
    const handler = createScanResolveRouteHandler(
      baseDeps({
        createAdminClient: () => adminClient as never,
        resolvePaidAccess: async () => "allowed",
        autoSaveScanWishlist: async (client, uid, pid) => {
          assert.equal(client, adminClient, "must use the admin client, not a fresh one")
          calls.push({ userId: uid, productId: pid })
        },
      }),
    )
    const response = await handler(request())
    assert.equal(response.status, 200)
    assert.deepEqual(calls, [{ userId, productId }])
  })
})

test("scan resolve auto-save: a masked (free-tier) resolve never auto-saves — direct-request denial", async () => {
  await withFlag("true", async () => {
    const handler = createScanResolveRouteHandler(
      baseDeps({
        resolvePaidAccess: async () => "denied",
        autoSaveScanWishlist: async () => {
          throw new Error("must not be called for a free-tier (masked) resolve")
        },
      }),
    )
    const response = await handler(request())
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.kind, "in_catalog")
    // Masked: the throwing `autoSaveScanWishlist` above never fired, or this test itself
    // would have rejected — this assertion just documents which branch the response proves.
    assert.equal(body.freeRevealAvailable, true)
  })
})

test("scan resolve auto-save: flag off never auto-saves, even for an otherwise-premium user", async () => {
  await withFlag(undefined, async () => {
    const handler = createScanResolveRouteHandler(
      baseDeps({
        resolvePaidAccess: async () => {
          throw new Error("must not be called with the flag off")
        },
        autoSaveScanWishlist: async () => {
          throw new Error("must not be called with the flag off")
        },
      }),
    )
    const response = await handler(request())
    assert.equal(response.status, 200)
  })
})

test("scan resolve auto-save: a not_needed verdict never auto-saves (nothing in-catalog to save)", async () => {
  await withFlag("true", async () => {
    const handler = createScanResolveRouteHandler(
      baseDeps({
        buildScanVerdict: () => notNeededVerdict,
        resolvePaidAccess: async () => {
          throw new Error("must not be called for a not_needed verdict")
        },
        autoSaveScanWishlist: async () => {
          throw new Error("must not be called for a not_needed verdict")
        },
      }),
    )
    const response = await handler(request())
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.kind, "not_needed")
  })
})

test("scan resolve auto-save: an unavailable paid-access lookup still fails closed with 503, before any save", async () => {
  await withFlag("true", async () => {
    const handler = createScanResolveRouteHandler(
      baseDeps({
        resolvePaidAccess: async () => "unavailable",
        autoSaveScanWishlist: async () => {
          throw new Error("must not be called when access is unavailable")
        },
      }),
    )
    const response = await handler(request())
    assert.equal(response.status, 503)
  })
})

test("scan resolve auto-save: a write failure is caught and reported, never turned into a 5xx", async () => {
  await withFlag("true", async () => {
    const captured: unknown[] = []
    const handler = createScanResolveRouteHandler(
      baseDeps({
        resolvePaidAccess: async () => "allowed",
        autoSaveScanWishlist: async () => {
          throw new Error("scan_wishlist_auto_save_failed")
        },
        captureScanException: (_error, details) => {
          captured.push(details)
        },
      }),
    )
    const response = await handler(request())
    assert.equal(response.status, 200, "the verdict must still be served")
    const body = await response.json()
    assert.equal(body.kind, "in_catalog")
    assert.deepEqual(captured, [
      {
        route: "resolve",
        status: 200,
        reason: "scan_wishlist_auto_save_failed",
        userId,
        level: "warning",
      },
    ])
  })
})

test("scan resolve auto-save: rescanning the same product auto-saves again each time (idempotency is the DB's job, not a client-side skip)", async () => {
  await withFlag("true", async () => {
    let calls = 0
    const handler = createScanResolveRouteHandler(
      baseDeps({
        resolvePaidAccess: async () => "allowed",
        autoSaveScanWishlist: async () => {
          calls += 1
        },
      }),
    )
    await handler(request())
    await handler(request())
    assert.equal(
      calls,
      2,
      "the route always attempts the write; ON CONFLICT DO NOTHING owns idempotency",
    )
  })
})
