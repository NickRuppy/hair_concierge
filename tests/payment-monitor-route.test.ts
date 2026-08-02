import assert from "node:assert/strict"
import test from "node:test"

import {
  emptyPaymentIntegrityCounters,
  handlePaymentMonitor,
  maxDuration,
  safeBearerTokenMatches,
  type RunPaymentIntegrity,
} from "../src/app/api/billing/payment-monitor/route"
import type { PaymentIntegrityResult } from "../src/lib/billing/payment-integrity"

const secret = "payment-monitor-secret"
const now = new Date("2026-08-01T12:00:00.000Z")

function request(token = secret, headers: Record<string, string> = {}) {
  return new Request("https://chaarlie.de/api/billing/payment-monitor", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      ...headers,
    },
  })
}

function result(overrides: Partial<PaymentIntegrityResult> = {}): PaymentIntegrityResult {
  return {
    status: "completed",
    counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 4 },
    findings: [],
    monitorFailures: [],
    ...overrides,
  }
}

test("payment monitor reserves response time around its 40 second work deadline", () => {
  assert.equal(maxDuration, 60)
})

test("payment monitor uses fixed-size constant-time auth comparison input", () => {
  const compared: Array<[number, number]> = []
  const matched = safeBearerTokenMatches("Bearer short", "a-much-longer-secret", (left, right) => {
    compared.push([left.byteLength, right.byteLength])
    return false
  })

  assert.equal(matched, false)
  assert.deepEqual(compared, [[32, 32]])
})

test("payment monitor rejects auth failures before rate limit, work, or check-in", async () => {
  let rateLimitChecks = 0
  let runs = 0
  let checkIns = 0

  const response = await handlePaymentMonitor(request("wrong"), {
    triggerSecret: secret,
    checkRateLimit: () => {
      rateLimitChecks += 1
      return { allowed: true }
    },
    runPaymentIntegrity: async () => {
      runs += 1
      return result()
    },
    captureCheckIn: () => {
      checkIns += 1
    },
  })

  assert.deepEqual(response, { status: 401, body: { error: "unauthorized" } })
  assert.equal(rateLimitChecks, 0)
  assert.equal(runs, 0)
  assert.equal(checkIns, 0)
})

test("payment monitor rate limits before payment work or Sentry check-in", async () => {
  let runs = 0
  let checkIns = 0
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: (identifier) => {
      assert.equal(identifier, "203.0.113.9")
      return { allowed: false }
    },
    runPaymentIntegrity: async () => {
      runs += 1
      return result()
    },
    captureCheckIn: () => {
      checkIns += 1
    },
  })

  assert.deepEqual(response, { status: 429, body: { error: "rate_limited" } })
  assert.equal(runs, 0)
  assert.equal(checkIns, 0)
})

test("payment monitor runs with a 40 second deadline and returns aggregate-only counters", async () => {
  const checkIns: unknown[] = []
  let runInput: Parameters<RunPaymentIntegrity>[0] | undefined

  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    now: () => now,
    clock: () => now.getTime(),
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async (input) => {
      runInput = input
      return result()
    },
    captureCheckIn: (checkIn) => {
      checkIns.push(checkIn)
      return checkIns.length === 1 ? "check-in-id" : undefined
    },
  })

  assert.equal(runInput?.now, now)
  assert.equal(runInput?.deadlineAt.getTime(), now.getTime() + 40_000)
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 4 },
    },
  })
  assert.equal(JSON.stringify(response.body).includes("must_not_leak"), false)
  assert.deepEqual(checkIns, [
    { monitorSlug: "payment-integrity-local", status: "in_progress" },
    {
      monitorSlug: "payment-integrity-local",
      status: "ok",
      checkInId: "check-in-id",
      duration: 0,
    },
  ])
})

test("payment monitor contains runner and Sentry failures without exposing errors", async () => {
  const checkIns: unknown[] = []
  const monitorFailures: unknown[] = []
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    now: () => now,
    clock: () => now.getTime(),
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () => {
      throw new Error("stripe secret must not leak")
    },
    captureCheckIn: (checkIn) => {
      checkIns.push(checkIn)
      throw new Error("sentry unavailable")
    },
    reportMonitorFailure: (failure) => {
      monitorFailures.push(failure)
      return "0123456789abcdef0123456789abcdef"
    },
    flushTelemetry: async () => true,
  })

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "error",
      counters: emptyPaymentIntegrityCounters(),
      failures: [
        {
          provider: "unknown",
          reason: "provider_error",
          errorFamily: "unknown",
        },
      ],
    },
  })
  assert.equal(JSON.stringify(response.body).includes("stripe secret"), false)
  assert.deepEqual(checkIns, [
    { monitorSlug: "payment-integrity-local", status: "in_progress" },
    {
      monitorSlug: "payment-integrity-local",
      status: "error",
      checkInId: undefined,
      duration: 0,
    },
  ])
  assert.deepEqual(monitorFailures, [
    {
      signal: "payment_monitor_failed",
      provider: "unknown",
      reason: "provider_error",
      errorFamily: "unknown",
    },
  ])
})

test("payment monitor returns safe failure categories and flushes telemetry before responding", async () => {
  let flushes = 0
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () =>
      result({
        status: "monitor_failed",
        counters: {
          ...emptyPaymentIntegrityCounters(),
          monitorFailures: 1,
          providerErrors: 1,
        },
        monitorFailures: [
          {
            signal: "payment_monitor_failed",
            provider: "stripe",
            reason: "provider_error",
            errorFamily: "provider_unavailable",
          },
        ],
        telemetryEventIds: ["0123456789abcdef0123456789abcdef"],
      }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => {
      flushes += 1
      return flushes > 1
    },
  })

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "monitor_failed",
      counters: {
        ...emptyPaymentIntegrityCounters(),
        monitorFailures: 1,
        providerErrors: 1,
      },
      failures: [
        {
          provider: "stripe",
          reason: "provider_error",
          errorFamily: "provider_unavailable",
        },
      ],
    },
  })
  assert.equal(flushes, 2)
})

test("payment monitor fails closed when an emitted incident has no Sentry receipt", async () => {
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () =>
      result({
        status: "monitor_failed",
        counters: {
          ...emptyPaymentIntegrityCounters(),
          monitorFailures: 1,
          incompleteProviders: 1,
        },
        monitorFailures: [
          {
            signal: "payment_monitor_failed",
            provider: "paypal",
            reason: "incomplete_pagination",
            errorFamily: "unknown",
          },
        ],
      }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => true,
  })

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "monitor_failed",
      counters: {
        ...emptyPaymentIntegrityCounters(),
        monitorFailures: 2,
        incompleteProviders: 1,
      },
      failures: [
        {
          provider: "paypal",
          reason: "incomplete_pagination",
          errorFamily: "unknown",
        },
        {
          provider: "unknown",
          reason: "telemetry_delivery_failed",
          errorFamily: "unknown",
        },
      ],
    },
  })
})

test("payment monitor flushes completed integrity findings before returning success", async () => {
  let flushes = 0
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () =>
      result({
        counters: {
          ...emptyPaymentIntegrityCounters(),
          providersScanned: 2,
          candidatesChecked: 4,
          findings: 1,
        },
        findings: [
          {
            signal: "payment_integrity_mismatch",
            provider: "stripe",
            commerceKind: "subscription",
            boundary: "billing",
            errorFamily: "billing_state",
            invariant: "provider_success_without_billing_success",
            providerReferenceDigest:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            method: "card",
            truth: "succeeded",
            live: true,
            isInternalTest: false,
          },
        ],
        telemetryEventIds: ["0123456789abcdef0123456789abcdef"],
      }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => {
      flushes += 1
      return true
    },
  })

  assert.equal(response.status, 200)
  assert.equal(flushes, 1)
})

test("payment monitor uses uncapped incident counters when requiring Sentry receipts", async () => {
  let flushes = 0
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () =>
      result({
        counters: {
          ...emptyPaymentIntegrityCounters(),
          findings: 1,
        },
        findings: [],
        telemetryEventIds: ["0123456789abcdef0123456789abcdef"],
      }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => {
      flushes += 1
      return true
    },
  })

  assert.equal(response.status, 200)
  assert.equal(flushes, 1)
})

test("payment monitor omits unexpected runtime failure categories from its response", async () => {
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () =>
      result({
        status: "monitor_failed",
        monitorFailures: [
          {
            signal: "payment_monitor_failed",
            provider: "raw-provider-secret",
            reason: "raw-error-secret",
            errorFamily: "raw-family-secret",
          } as never,
        ],
        telemetryEventIds: ["0123456789abcdef0123456789abcdef"],
      }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => true,
  })

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "monitor_failed",
      counters: {
        ...emptyPaymentIntegrityCounters(),
        providersScanned: 2,
        candidatesChecked: 4,
      },
    },
  })
  assert.equal(JSON.stringify(response.body).includes("secret"), false)
})
