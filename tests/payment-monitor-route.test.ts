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
    findings: [
      {
        signal: "payment_integrity_mismatch",
        provider: "stripe",
        commerceKind: "subscription",
        boundary: "billing",
        errorFamily: "billing_state",
        invariant: "provider_success_without_billing_success",
        checkoutAttemptId: "checkout_attempt_must_not_leak",
        providerReferenceDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        method: "card",
        truth: "succeeded",
        live: true,
        isInternalTest: false,
        userId: "user_must_not_leak",
        leadId: "lead_must_not_leak",
      },
    ],
    monitorFailures: [
      {
        signal: "payment_monitor_failed",
        provider: "paypal",
        reason: "provider_error",
        errorFamily: "provider_unavailable",
      },
    ],
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
    },
  })

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "error",
      counters: emptyPaymentIntegrityCounters(),
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
