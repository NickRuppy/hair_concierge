import assert from "node:assert/strict"
import test from "node:test"

import {
  createScanResolveRouteHandler,
  type ScanResolveRouteDeps,
} from "../src/app/api/scan/resolve/route"

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"

const inCatalogVerdict = {
  kind: "in_catalog" as const,
  verdict: "ideal" as const,
  verdictLabel: "Passt",
  verdictTitle: "Passt zu deinem Haar",
  status: "ok" as const,
  subtitle: "Bewertet anhand deines Profils",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: null,
  fitNarrative: null,
  alternatives: [],
}

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

function baseDeps(overrides: Partial<ScanResolveRouteDeps> = {}): ScanResolveRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    validateEanInput: () => ({ ok: true, type: "ean", value: "4006381333931" }),
    findOpenScanSubmission: async () => null,
    lookupCatalogProductByIdentifier: async () => ({ productId, category: "shampoo" }),
    isProductSearchQuarantined: async () => false,
    loadScanEvaluationContext: async () => context,
    loadScanProductFacts: async () => null,
    loadRecommendationCandidates: async () => [],
    loadScanSavedState: async () => null,
    buildScanVerdict: () => inCatalogVerdict,
    loadActiveProductById: async () => ({ id: productId, category: "shampoo" }),
    ...overrides,
  }
}

function request(body: unknown) {
  return new Request("http://test/api/scan/resolve", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

test("scan resolve: unauthenticated is rejected", async () => {
  const handler = createScanResolveRouteHandler(baseDeps({ getUserId: async () => null }))
  const response = await handler(request({ productId }))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: "unauthorized" })
})

test("scan resolve: rate limited returns 429 with Retry-After", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("Retry-After"), "60")
  assert.deepEqual(await response.json(), { error: "rate_limited" })
})

test("scan resolve: rate limiter unavailable fails closed with 503", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }) }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
})

test("scan resolve: body with both identifier and productId is rejected", async () => {
  const handler = createScanResolveRouteHandler(baseDeps())
  const response = await handler(
    request({ productId, identifier: { type: "ean", value: "4006381333931" } }),
  )
  assert.equal(response.status, 400)
})

test("scan resolve: bad EAN checksum is rejected before any lookup", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      validateEanInput: () => ({ ok: false, reason: "checksum" }),
      findOpenScanSubmission: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333930" } }))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "invalid_identifier" })
})

test("scan resolve: an open submission short-circuits before catalog lookup", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      findOpenScanSubmission: async () => ({ submissionId: "sub-1", status: "researching" }),
      lookupCatalogProductByIdentifier: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    kind: "pending_submission",
    submissionId: "sub-1",
    headline: "Wir prüfen dein Produkt",
    status: "researching",
  })
})

test("scan resolve: identifier miss returns unknown_product with all 10 categories", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({ lookupCatalogProductByIdentifier: async () => null }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.kind, "unknown_product")
  assert.deepEqual(body.identifier, { type: "ean", value: "4006381333931" })
  assert.equal(body.categories.length, 10)
  assert.ok(body.categories.every((entry: { key: string; label: string }) => entry.label))
})

test("scan resolve: productId not found is 404", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({ loadActiveProductById: async () => null }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "product_not_found" })
})

test("scan resolve: a non-ean identifier type is rejected (v1 surface is ean-only)", async () => {
  const handler = createScanResolveRouteHandler(baseDeps())
  const response = await handler(request({ identifier: { type: "gtin", value: "4006381333931" } }))
  assert.equal(response.status, 400)
})

test("scan resolve: a disposition-quarantined identifier hit is treated as unknown_product", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      isProductSearchQuarantined: async () => true,
      loadScanEvaluationContext: async () => {
        throw new Error("must not reach profile evaluation for a quarantined product")
      },
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.kind, "unknown_product")
  assert.deepEqual(body.identifier, { type: "ean", value: "4006381333931" })
})

test("scan resolve: a disposition-quarantined productId is 404 product_not_found", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      isProductSearchQuarantined: async () => true,
      loadScanEvaluationContext: async () => {
        throw new Error("must not reach profile evaluation for a quarantined product")
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "product_not_found" })
})

test("scan resolve: no personal plan at all is 409 profile_missing", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({ loadScanEvaluationContext: async () => null }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "profile_missing" })
})

test("scan resolve: identifier hit resolves a verdict with snapshotSource and savedState", async () => {
  const buildScanVerdictCalls: unknown[] = []
  const handler = createScanResolveRouteHandler(
    baseDeps({
      buildScanVerdict: (input) => {
        buildScanVerdictCalls.push(input)
        return inCatalogVerdict
      },
      loadScanSavedState: async () => "merkliste",
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ...inCatalogVerdict,
    snapshotSource: "refined",
    savedState: "merkliste",
  })
  assert.equal(buildScanVerdictCalls.length, 1)
})

test("scan resolve: productId path resolves the same way as an identifier hit", async () => {
  const handler = createScanResolveRouteHandler(baseDeps())
  const response = await handler(request({ productId }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.kind, "in_catalog")
  assert.equal(body.snapshotSource, "refined")
})

test("scan resolve: a not-needed decision skips the recommendation-candidates load", async () => {
  const notNeededDecision = { ...decision, needTier: "not_needed" as const }
  const notNeededSnapshot = { ...snapshot, decisions: [notNeededDecision] }
  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadScanEvaluationContext: async () => ({ ...context, snapshot: notNeededSnapshot }),
      loadRecommendationCandidates: async () => {
        throw new Error("must not be called for a not-needed decision")
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 200)
})

test("scan resolve: an unexpected lib error maps to 503", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadScanEvaluationContext: async () => {
        throw new Error("scan_profile_context_unavailable")
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
})
