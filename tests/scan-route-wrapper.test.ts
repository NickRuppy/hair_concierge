import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"

import {
  createScanRoute,
  parseJsonBody,
  scanFail,
  scanOk,
  type ScanRouteContext,
  type ScanRouteDeps,
} from "../src/lib/scan/route"
import { SCAN_RATE_LIMIT } from "../src/lib/rate-limit"

const userId = "11111111-1111-4111-8111-111111111111"

function baseDeps(overrides: Partial<ScanRouteDeps> = {}): ScanRouteDeps {
  return {
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    ...overrides,
  }
}

const bodySchema = z.object({ value: z.string() }).strict()
type Body = z.infer<typeof bodySchema>

function request(body: unknown = { value: "x" }) {
  return new Request("http://test/api/scan/wrapper-test", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

type RouteConfig = Parameters<typeof createScanRoute<Body>>[0]

function buildRoute(overrides: Partial<RouteConfig> = {}) {
  return createScanRoute<Body>({
    route: "resolve",
    deps: baseDeps(),
    parse: parseJsonBody(bodySchema),
    failureReason: "resolve_failed",
    handler: async (ctx) => scanOk({ echoed: ctx.body, userId: ctx.userId }),
    ...overrides,
  })
}

test("scanFail: returns the error envelope with no-store and any extra headers", () => {
  const response = scanFail("rate_limited", 429, { "Retry-After": "12" })
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.equal(response.headers.get("Retry-After"), "12")
})

test("scanOk: returns the body as JSON with no-store and defaults to 200", async () => {
  const response = scanOk({ ok: true })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await response.json(), { ok: true })
})

test("scanOk: honours a custom status", () => {
  const response = scanOk({ ok: true }, { status: 202 })
  assert.equal(response.status, 202)
})

test("createScanRoute: unauthenticated is rejected with 401", async () => {
  const handler = buildRoute({ deps: baseDeps({ getUserId: async () => null }) })
  const response = await handler(request())
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: "unauthorized" })
})

test("createScanRoute: rate limited returns 429 with the derived Retry-After", async () => {
  const handler = buildRoute({
    deps: baseDeps({ checkRateLimit: async () => ({ allowed: false }) }),
  })
  const response = await handler(request())
  assert.equal(response.status, 429)
  assertRetryAfter(response)
  assert.deepEqual(await response.json(), { error: "rate_limited" })
})

test("createScanRoute: rate limiter outage fails closed with 503, no Sentry capture", async () => {
  const captured: unknown[] = []
  const handler = buildRoute({
    deps: baseDeps({
      checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
      captureScanException: (_error, details) => {
        captured.push(details)
      },
    }),
  })
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  assert.deepEqual(captured, [])
})

test("createScanRoute: bad JSON is a 400 invalid_request", async () => {
  const handler = buildRoute()
  const bad = new Request("http://test/api/scan/wrapper-test", {
    method: "POST",
    body: "{not json",
  })
  const response = await handler(bad)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "invalid_request" })
})

test("createScanRoute: a schema violation is a 400 invalid_request", async () => {
  const handler = buildRoute()
  const response = await handler(request({ value: 123 }))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "invalid_request" })
})

test("createScanRoute: parses the body and calls the handler with userId + body", async () => {
  const handler = buildRoute()
  const response = await handler(request({ value: "hello" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { echoed: { value: "hello" }, userId })
})

test("createScanRoute: a handler throw maps to 503 and captures route/reason/userId", async () => {
  const thrown = new Error("boom")
  const captured: unknown[] = []
  const handler = buildRoute({
    route: "search",
    failureReason: "search_failed",
    handler: async () => {
      throw thrown
    },
    deps: baseDeps({
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  })
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  assert.deepEqual(captured, [{ route: "search", status: 503, reason: "search_failed", userId }])
})

test("createScanRoute: onError runs before capture, sharing the handler's ctx", async () => {
  const order: string[] = []
  let seenCtx: ScanRouteContext<Body> | undefined
  const thrown = new Error("boom")
  const handler = buildRoute({
    handler: async () => {
      throw thrown
    },
    onError: async (error, ctx) => {
      assert.equal(error, thrown)
      seenCtx = ctx
      order.push("onError")
    },
    deps: baseDeps({
      captureScanException: () => {
        order.push("capture")
      },
    }),
  })
  const response = await handler(request({ value: "abc" }))
  assert.equal(response.status, 503)
  assert.deepEqual(order, ["onError", "capture"])
  assert.deepEqual(seenCtx?.body, { value: "abc" })
  assert.equal(seenCtx?.userId, userId)
})

test("createScanRoute: a throwing onError hook still yields 503 and captures to Sentry", async () => {
  const thrown = new Error("boom")
  const captured: unknown[] = []
  const handler = buildRoute({
    handler: async () => {
      throw thrown
    },
    onError: async () => {
      throw new Error("hook exploded")
    },
    deps: baseDeps({
      captureScanException: (error, details) => {
        assert.equal(error, thrown)
        captured.push(details)
      },
    }),
  })
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
  assert.deepEqual(captured, [{ route: "resolve", status: 503, reason: "resolve_failed", userId }])
})

/**
 * The header is computed inside the handler, so recomputing `fixedWindowRetryAfterSeconds`
 * here can straddle a second boundary and flake. Assert the bound instead (precedent:
 * tests/personal-plan-api-stage3.test.ts).
 */
function assertRetryAfter(response: Response) {
  const header = response.headers.get("Retry-After") ?? ""
  assert.match(header, /^[1-9][0-9]?$/)
  assert.ok(Number(header) <= SCAN_RATE_LIMIT.windowMs / 1000)
}
