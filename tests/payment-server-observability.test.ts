import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import type { PaymentFailureDetails } from "../src/lib/observability/payment"
import {
  captureServerPaymentFailure,
  flushServerPaymentTelemetry,
  type ServerPaymentSentry,
} from "../src/lib/observability/payment-server-core"

const details: PaymentFailureDetails = {
  signal: "payment_monitor_failed",
  provider: "unknown",
  boundary: "reconciliation",
  origin: "reconciliation",
  errorFamily: "unknown",
  commerceKind: "unknown",
  live: true,
  method: "unknown",
  isInternalTest: true,
  truth: "unknown",
}

test("server payment reporter keeps a guarded Node-only SDK boundary", () => {
  const serverSource = readFileSync(
    new URL("../src/lib/observability/payment-server.ts", import.meta.url),
    "utf8",
  )
  const coreSource = readFileSync(
    new URL("../src/lib/observability/payment-server-core.ts", import.meta.url),
    "utf8",
  )
  const paymentSource = readFileSync(
    new URL("../src/lib/observability/payment.ts", import.meta.url),
    "utf8",
  )
  const scrubbingSource = readFileSync(
    new URL("../src/lib/observability/sentry-scrubbing.ts", import.meta.url),
    "utf8",
  )

  assert.match(serverSource, /^import "server-only"/)
  assert.match(serverSource, /from "@sentry\/node"/)
  assert.doesNotMatch(
    [serverSource, coreSource, paymentSource, scrubbingSource].join("\n"),
    /@sentry\/nextjs/,
  )
})

function fakeSentry(input: { initialized?: boolean; eventId?: string; flushResult?: boolean }) {
  let initialized = input.initialized ?? false
  let initCalls = 0
  let captureCalls = 0
  const sentry = {
    init() {
      initCalls += 1
      initialized = true
    },
    getClient() {
      return initialized ? { getDsn: () => ({ projectId: "safe-project" }) } : undefined
    },
    withScope(callback: (scope: Record<string, unknown>) => unknown) {
      return callback({
        setContext() {},
        setFingerprint() {},
        setLevel() {},
        setTag() {},
        setUser() {},
      })
    },
    captureException() {
      captureCalls += 1
      return input.eventId ?? "a".repeat(32)
    },
    async flush() {
      return input.flushResult ?? true
    },
  } as unknown as ServerPaymentSentry

  return {
    sentry,
    initCalls: () => initCalls,
    captureCalls: () => captureCalls,
  }
}

test("server payment reporter lazily initializes the Node Sentry client before capture", () => {
  const fake = fakeSentry({})

  const eventId = captureServerPaymentFailure(details, {
    sentry: fake.sentry,
    environment: {
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
      VERCEL_ENV: "production",
    },
  })

  assert.equal(eventId, "a".repeat(32))
  assert.equal(fake.initCalls(), 1)
  assert.equal(fake.captureCalls(), 1)
})

test("server payment reporter fails closed when no runtime DSN initializes a client", async () => {
  const fake = fakeSentry({})
  const deps = { sentry: fake.sentry, environment: {} }

  assert.equal(captureServerPaymentFailure(details, deps), undefined)
  assert.equal(await flushServerPaymentTelemetry(2_000, deps), false)
  assert.equal(fake.initCalls(), 0)
  assert.equal(fake.captureCalls(), 0)
})

test("server payment telemetry reuses an initialized client and returns its flush result", async () => {
  const fake = fakeSentry({ initialized: true, flushResult: false })
  const deps = { sentry: fake.sentry, environment: {} }

  assert.equal(captureServerPaymentFailure(details, deps), "a".repeat(32))
  assert.equal(await flushServerPaymentTelemetry(2_000, deps), false)
  assert.equal(fake.initCalls(), 0)
  assert.equal(fake.captureCalls(), 1)
})
