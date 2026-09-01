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
    createScanResolveAttemptId: () => "attempt-1",
    recordScanResolveAttempt: async () => {},
    completeScanResolveAttempt: async () => {},
    lookupCatalogProductByIdentifier: async () => ({ productId, category: "shampoo" }),
    isProductSearchQuarantined: async () => false,
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    loadScanEvaluationContext: async () => context,
    loadScanProductFacts: async () => null,
    loadRecommendationCandidates: async () => [],
    loadScanSavedState: async () => ({ state: null, managedByScan: false }),
    buildScanVerdict: () => inCatalogVerdict,
    loadActiveProductById: async () => ({ id: productId, category: "shampoo" }),
    loadPresentationRows: async () => [presentationRow],
    ...overrides,
  }
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

const expectedProductHeader = {
  productId,
  name: "Repair Shampoo",
  brand: "Olaplex",
  category: "shampoo",
  categoryLabel: "Shampoo",
  imageUrl: null,
  priceLabel: "24,90 €",
  purchaseUrl: "https://shop.test/a",
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

test("scan resolve: rate limiter unavailable fails closed with 503, without a Sentry capture", async () => {
  const captured: unknown[] = []
  const handler = createScanResolveRouteHandler(
    baseDeps({
      checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
      captureScanException: (_error, details) => {
        captured.push(details)
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  // The rate limiter's fail-closed 503 is an upstream outage already logged inside
  // checkRateLimit itself — not an unexpected route-level throw, so it must not also
  // page through Sentry.
  assert.deepEqual(captured, [])
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

test("scan resolve: an open submission answers a catalog miss", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      lookupCatalogProductByIdentifier: async () => null,
      findOpenScanSubmission: async () => ({ submissionId: "sub-1", status: "researching" }),
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    kind: "pending_submission",
    submissionId: "sub-1",
    headline: "Eingereicht!",
    status: "researching",
  })
})

test("scan resolve: a cataloged EAN resolves to a verdict even while a submission is open", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      // The catalog is the authority: with a hit, the submission never even gets checked.
      findOpenScanSubmission: async () => {
        throw new Error("must not be called for a cataloged product")
      },
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.kind, "in_catalog")
})

test("scan resolve: a quarantined hit with an open submission answers pending, not unknown", async () => {
  const handler = createScanResolveRouteHandler(
    baseDeps({
      isProductSearchQuarantined: async () => true,
      findOpenScanSubmission: async () => ({ submissionId: "sub-2", status: "pending_review" }),
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.kind, "pending_submission")
  assert.equal(body.submissionId, "sub-2")
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
      loadScanSavedState: async () => ({ state: "merkliste" as const, managedByScan: true }),
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ...inCatalogVerdict,
    product: expectedProductHeader,
    snapshotSource: "refined",
    savedState: { state: "merkliste", managedByScan: true },
  })
  assert.equal(buildScanVerdictCalls.length, 1)
})

test("scan resolve: a missing catalog presentation row fails closed with 503", async () => {
  const handler = createScanResolveRouteHandler(baseDeps({ loadPresentationRows: async () => [] }))
  const response = await handler(request({ productId }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
})

test("scan resolve: alternatives are enriched with brand and purchase link", async () => {
  const alternativeId = "33333333-3333-4333-8333-333333333333"
  const handler = createScanResolveRouteHandler(
    baseDeps({
      buildScanVerdict: () => ({
        ...inCatalogVerdict,
        verdict: "mismatch",
        alternatives: [
          {
            productId: alternativeId,
            displayName: "Sanftes Shampoo",
            imageUrl: null,
            priceLabel: null,
            netContentLabel: null,
            verdict: "ideal" as const,
            verdictLabel: "Passt",
          },
        ],
      }),
      loadPresentationRows: async (_client, productIds) => {
        assert.deepEqual(productIds, [productId, alternativeId])
        return [
          presentationRow,
          {
            ...presentationRow,
            id: alternativeId,
            name: "Sanftes Shampoo",
            brand: "Kérastase",
            affiliateLink: "https://shop.test/b",
          },
        ]
      },
    }),
  )
  const response = await handler(request({ productId }))
  const body = await response.json()
  assert.equal(body.alternatives[0].brand, "Kérastase")
  assert.equal(body.alternatives[0].purchaseUrl, "https://shop.test/b")
})

test("scan resolve: a quarantined alternative is never offered (ruling R7)", async () => {
  const goodId = "33333333-3333-4333-8333-333333333333"
  const quarantinedId = "44444444-4444-4444-8444-444444444444"
  const alternative = (id: string, displayName: string) => ({
    productId: id,
    displayName,
    imageUrl: null,
    priceLabel: null,
    netContentLabel: null,
    verdict: "ideal" as const,
    verdictLabel: "Passt",
  })
  let askedFor: string[] = []
  const handler = createScanResolveRouteHandler(
    baseDeps({
      buildScanVerdict: () => ({
        ...inCatalogVerdict,
        verdict: "mismatch",
        alternatives: [
          alternative(quarantinedId, "Zurückgestelltes Shampoo"),
          alternative(goodId, "Sanftes Shampoo"),
        ],
      }),
      loadQuarantinedProductIdsAmong: async (_client, ids) => {
        askedFor = [...ids]
        return new Set([quarantinedId])
      },
      loadPresentationRows: async () => [
        presentationRow,
        { ...presentationRow, id: goodId, name: "Sanftes Shampoo" },
        { ...presentationRow, id: quarantinedId, name: "Zurückgestelltes Shampoo" },
      ],
    }),
  )
  const response = await handler(request({ productId }))
  const body = await response.json()
  // Only the ≤3 offered alternatives are checked, not the whole candidate pool.
  assert.deepEqual(askedFor, [quarantinedId, goodId])
  assert.deepEqual(
    body.alternatives.map((entry: { productId: string }) => entry.productId),
    [goodId],
  )
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

/* ------------------------------------------------- role-sensitive fact loads */

const twoRoleShampooContext = {
  ...context,
  snapshot: {
    ...snapshot,
    decisions: [{ ...decision, roles: ["shampoo_everyday" as const, "shampoo_dandruff" as const] }],
  },
}

/** Facts stubbed to carry the role they were loaded for, so misuse is visible. */
const factsLoadedFor = (role: string) => ({ productId, role }) as never

test("scan resolve: a role-sensitive category loads facts and candidates per role", async () => {
  const factsRoles: string[] = []
  const candidateRoles: string[] = []
  let received: { perRoleFacts?: Record<string, unknown> } | null = null

  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadScanEvaluationContext: async () => twoRoleShampooContext,
      loadScanProductFacts: async (_client, _category, _productId, selection) => {
        factsRoles.push(selection.role)
        return factsLoadedFor(selection.role)
      },
      loadRecommendationCandidates: async (_client, selection) => {
        // The loader's input is a union; the scan route only ever passes the selection form.
        const { role } = selection as { role: string }
        candidateRoles.push(role)
        return [factsLoadedFor(role)]
      },
      buildScanVerdict: (input) => {
        received = input as never
        return inCatalogVerdict
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 200)

  assert.deepEqual(factsRoles.sort(), ["shampoo_dandruff", "shampoo_everyday"])
  assert.deepEqual(candidateRoles.sort(), ["shampoo_dandruff", "shampoo_everyday"])

  const perRoleFacts = received!.perRoleFacts as Record<
    string,
    { productFacts: { role: string }; recommendationCandidates: Array<{ role: string }> }
  >
  // Each role must see the facts loaded for that role, not the first role's load.
  assert.equal(perRoleFacts.shampoo_everyday.productFacts.role, "shampoo_everyday")
  assert.equal(perRoleFacts.shampoo_dandruff.productFacts.role, "shampoo_dandruff")
  assert.equal(perRoleFacts.shampoo_everyday.recommendationCandidates[0].role, "shampoo_everyday")
  assert.equal(perRoleFacts.shampoo_dandruff.recommendationCandidates[0].role, "shampoo_dandruff")
})

test("scan resolve: a category whose facts do not vary by role loads exactly once", async () => {
  const conditionerDecision = {
    ...decision,
    category: "conditioner" as const,
    roles: ["conditioner_rinse_out" as const],
  }
  const factsRoles: string[] = []
  let received: { perRoleFacts?: unknown } | null = null

  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadActiveProductById: async () => ({ id: productId, category: "conditioner" }),
      loadScanEvaluationContext: async () => ({
        ...context,
        snapshot: { ...snapshot, decisions: [conditionerDecision] },
      }),
      loadScanProductFacts: async (_client, _category, _productId, selection) => {
        factsRoles.push(selection.role)
        return null
      },
      loadPresentationRows: async () => [{ ...presentationRow, category: "conditioner" as const }],
      buildScanVerdict: (input) => {
        received = input as never
        return inCatalogVerdict
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 200)
  assert.deepEqual(factsRoles, ["conditioner_rinse_out"])
  assert.equal(received!.perRoleFacts, undefined)
})

test("scan resolve: an unexpected lib error maps to 503 and captures to Sentry", async () => {
  const thrown = new Error("scan_profile_context_unavailable")
  const captured: unknown[] = []
  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadScanEvaluationContext: async () => {
        throw thrown
      },
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  assert.deepEqual(captured, [{ route: "resolve", status: 503, reason: "resolve_failed", userId }])
})

function collectAttempts() {
  const starts: unknown[] = []
  const completions: unknown[] = []
  const recordScanResolveAttempt = async (_client: unknown, attempt: unknown) => {
    starts.push(attempt)
  }
  const completeScanResolveAttempt = async (_client: unknown, completion: unknown) => {
    completions.push(completion)
  }
  return { starts, completions, recordScanResolveAttempt, completeScanResolveAttempt }
}

test("attempt telemetry: catalog hit starts before lookup and completes only after payload build", async () => {
  const { starts, completions, recordScanResolveAttempt, completeScanResolveAttempt } =
    collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(starts, [
    {
      attemptId: "attempt-1",
      userId,
      identifierType: "ean",
      rawValue: "4006381333931",
    },
  ])
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "hit",
      terminalOutcome: "resolved",
      matchedProductId: productId,
      failureStage: null,
    },
  ])
})

test("attempt telemetry: an unknown fit verdict is completed but not counted as resolved", async () => {
  const { completions, recordScanResolveAttempt, completeScanResolveAttempt } = collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      buildScanVerdict: () => ({ ...inCatalogVerdict, verdict: "unknown" }),
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "hit",
      terminalOutcome: "verdict_unknown",
      matchedProductId: productId,
      failureStage: null,
    },
  ])
})

test("attempt telemetry: catalog miss completes as unknown_product", async () => {
  const { starts, completions, recordScanResolveAttempt, completeScanResolveAttempt } =
    collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      lookupCatalogProductByIdentifier: async () => null,
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.equal(starts.length, 1)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "miss",
      terminalOutcome: "unknown_product",
      matchedProductId: null,
      failureStage: null,
    },
  ])
})

test("attempt telemetry: invalid checksum starts then completes as invalid_identifier", async () => {
  const { starts, completions, recordScanResolveAttempt, completeScanResolveAttempt } =
    collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      validateEanInput: () => ({ ok: false, reason: "checksum" }),
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333930" } }))
  assert.equal(response.status, 400)
  assert.equal(starts.length, 1)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "invalid",
      terminalOutcome: "invalid_identifier",
      matchedProductId: null,
      failureStage: "identifier_lookup",
    },
  ])
})

test("attempt telemetry: quarantined hit retains its matching product", async () => {
  const { completions, recordScanResolveAttempt, completeScanResolveAttempt } = collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      isProductSearchQuarantined: async () => true,
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "quarantined",
      terminalOutcome: "unknown_product",
      matchedProductId: productId,
      failureStage: null,
    },
  ])
})

test("attempt telemetry: open submission completes as pending_submission", async () => {
  const { completions, recordScanResolveAttempt, completeScanResolveAttempt } = collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      lookupCatalogProductByIdentifier: async () => null,
      findOpenScanSubmission: async () => ({ submissionId: "sub-1", status: "researching" }),
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 200)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "miss",
      terminalOutcome: "pending_submission",
      matchedProductId: null,
      failureStage: null,
    },
  ])
})

test("attempt telemetry: resolve-by-productId logs nothing — no barcode involved", async () => {
  const { starts, completions, recordScanResolveAttempt, completeScanResolveAttempt } =
    collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ productId }))
  assert.equal(response.status, 200)
  assert.deepEqual(starts, [])
  assert.deepEqual(completions, [])
})

test("attempt telemetry: starts before identifier validation", async () => {
  const order: string[] = []
  const handler = createScanResolveRouteHandler(
    baseDeps({
      recordScanResolveAttempt: async () => {
        order.push("start")
      },
      validateEanInput: () => {
        order.push("validate")
        return { ok: false, reason: "checksum" }
      },
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333930" } }))
  assert.equal(response.status, 400)
  assert.deepEqual(order, ["start", "validate"])
})

test("attempt telemetry: a missing profile is a hit but profile_ineligible, not a catalog miss", async () => {
  const { completions, recordScanResolveAttempt, completeScanResolveAttempt } = collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadScanEvaluationContext: async () => null,
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 409)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "hit",
      terminalOutcome: "profile_ineligible",
      matchedProductId: productId,
      failureStage: null,
    },
  ])
})

test("attempt telemetry: a post-lookup failure records the current bounded stage", async () => {
  const { completions, recordScanResolveAttempt, completeScanResolveAttempt } = collectAttempts()
  const handler = createScanResolveRouteHandler(
    baseDeps({
      loadScanProductFacts: async () => {
        throw new Error("facts unavailable")
      },
      recordScanResolveAttempt: recordScanResolveAttempt as never,
      completeScanResolveAttempt: completeScanResolveAttempt as never,
    }),
  )
  const response = await handler(request({ identifier: { type: "ean", value: "4006381333931" } }))
  assert.equal(response.status, 503)
  assert.deepEqual(completions, [
    {
      attemptId: "attempt-1",
      lookupOutcome: "hit",
      terminalOutcome: "temporarily_unavailable",
      matchedProductId: productId,
      failureStage: "product_facts",
    },
  ])
})
