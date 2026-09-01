import assert from "node:assert/strict"
import test from "node:test"

import {
  createScanSubmitRouteHandler,
  type ScanSubmitRouteDeps,
} from "../src/app/api/scan/submit/route"
import { validateEanInput } from "../src/lib/scan/identifier-lookup"

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"
const submissionId = "33333333-3333-4333-8333-333333333333"

function baseDeps(overrides: Partial<ScanSubmitRouteDeps> = {}): ScanSubmitRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    validateEanInput,
    createAdminClient: () => ({}) as never,
    createRepository: () => ({}) as never,
    submit: async () => ({
      kind: "pending_review",
      category: "shampoo",
      submission: { id: submissionId, status: "pending_review", category: "shampoo" },
      match: { status: "insufficient_identity" } as never,
    }),
    ...overrides,
  }
}

function request(body: unknown) {
  return new Request("http://test/api/scan/submit", { method: "POST", body: JSON.stringify(body) })
}

const validBody = {
  identifier: { type: "ean", value: "4006381333931" },
  category: "shampoo",
}

test("scan submit: unauthenticated is rejected", async () => {
  const handler = createScanSubmitRouteHandler(baseDeps({ getUserId: async () => null }))
  const response = await handler(request(validBody))
  assert.equal(response.status, 401)
})

test("scan submit: rate limited returns 429", async () => {
  const handler = createScanSubmitRouteHandler(
    baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  )
  const response = await handler(request(validBody))
  assert.equal(response.status, 429)
})

test("scan submit: rate limiter unavailable fails closed with 503, without a Sentry capture", async () => {
  const captured: unknown[] = []
  const handler = createScanSubmitRouteHandler(
    baseDeps({
      checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
      captureScanException: (_error, details) => {
        captured.push(details)
      },
    }),
  )
  const response = await handler(request(validBody))
  assert.equal(response.status, 503)
  assert.deepEqual(captured, [])
})

test("scan submit: an invalid category is a zod rejection", async () => {
  const handler = createScanSubmitRouteHandler(baseDeps())
  const response = await handler(request({ ...validBody, category: "not_a_category" }))
  assert.equal(response.status, 400)
})

test("scan submit: a bad identifier shape is a zod rejection", async () => {
  const handler = createScanSubmitRouteHandler(baseDeps())
  const response = await handler(
    request({ identifier: { type: "not_a_type", value: "123" }, category: "shampoo" }),
  )
  assert.equal(response.status, 400)
})

test("scan submit: a non-ean identifier type is rejected (v1 surface is ean-only)", async () => {
  const handler = createScanSubmitRouteHandler(baseDeps())
  const response = await handler(
    request({ identifier: { type: "gtin", value: "4006381333931" }, category: "shampoo" }),
  )
  assert.equal(response.status, 400)
})

test("scan submit: a non-EAN value is rejected with invalid_identifier, same as resolve", async () => {
  const handler = createScanSubmitRouteHandler(
    baseDeps({
      submit: async () => {
        throw new Error("must not be called")
      },
    }),
  )
  for (const value of ["not-a-barcode", "123", "40063813339311", "4006381333930"]) {
    const response = await handler(request({ ...validBody, identifier: { type: "ean", value } }))
    assert.equal(response.status, 400, value)
    assert.deepEqual(await response.json(), { error: "invalid_identifier" }, value)
  }
})

test("scan submit: the validated (trimmed) identifier is what reaches the submission", async () => {
  let capturedInput: { scannedIdentifier?: unknown } | undefined
  const handler = createScanSubmitRouteHandler(
    baseDeps({
      submit: async ({ input }) => {
        capturedInput = input
        return {
          kind: "pending_review",
          category: "shampoo",
          submission: { id: submissionId, status: "pending_review", category: "shampoo" },
          match: { status: "insufficient_identity" } as never,
        }
      },
    }),
  )
  await handler(request({ ...validBody, identifier: { type: "ean", value: "  4006381333931  " } }))
  assert.deepEqual(capturedInput?.scannedIdentifier, { type: "ean", value: "4006381333931" })
})

test("scan submit: already_in_catalog maps to 200 with productId only", async () => {
  const handler = createScanSubmitRouteHandler(
    baseDeps({
      submit: async () => ({
        kind: "already_in_catalog",
        productId,
        category: "shampoo",
        match: { status: "identifier_category_exact" } as never,
      }),
    }),
  )
  const response = await handler(request(validBody))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { kind: "already_in_catalog", productId })
})

test("scan submit: pending_review maps to 202 pending_submission with headline", async () => {
  const handler = createScanSubmitRouteHandler(baseDeps())
  const response = await handler(request(validBody))
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), {
    kind: "pending_submission",
    submissionId,
    headline: "Eingereicht!",
  })
})

test("scan submit: passes frequency_range null (no invented data), never touching usage", async () => {
  let capturedInput: unknown
  const handler = createScanSubmitRouteHandler(
    baseDeps({
      submit: async ({ input }) => {
        capturedInput = input
        return {
          kind: "pending_review",
          category: "shampoo",
          submission: { id: submissionId, status: "pending_review", category: "shampoo" },
          match: { status: "insufficient_identity" } as never,
        }
      },
    }),
  )
  await handler(request(validBody))
  assert.deepEqual(capturedInput, {
    intake_method: "manual",
    category: "shampoo",
    frequency_range: null,
    brand_text: undefined,
    product_name_text: undefined,
    scannedIdentifier: { type: "ean", value: "4006381333931" },
    replace_existing_confirmed: false,
  })
})

test("scan submit: an unexpected error maps to 503 and captures to Sentry", async () => {
  const thrown = new Error("boom")
  const captured: unknown[] = []
  const handler = createScanSubmitRouteHandler(
    baseDeps({
      submit: async () => {
        throw thrown
      },
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  )
  const response = await handler(request(validBody))
  assert.equal(response.status, 503)
  assert.deepEqual(captured, [{ route: "submit", status: 503, reason: "submit_failed", userId }])
})
