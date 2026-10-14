import assert from "node:assert/strict"
import test from "node:test"

import {
  emptyPaymentIntegrityCounters,
  handlePaymentMonitor,
  maxDuration,
  resolvePaidAccessFindingLive,
  runPaymentIntegrityBranch,
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

test("paid-access finding live tag follows the finding provider only", () => {
  assert.equal(
    resolvePaidAccessFindingLive("paypal", { stripeLive: true, paypalLive: false }),
    false,
  )
  assert.equal(
    resolvePaidAccessFindingLive("stripe", { stripeLive: false, paypalLive: true }),
    false,
  )
  assert.equal(
    resolvePaidAccessFindingLive("paypal", { stripeLive: false, paypalLive: true }),
    true,
  )
  assert.equal(
    resolvePaidAccessFindingLive("stripe", { stripeLive: true, paypalLive: false }),
    true,
  )
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

test("production monitor mode requires start and finish check-in receipts plus a flushed transport", async () => {
  let checkInCount = 0
  let flushCount = 0
  const delivered = await runPaymentIntegrityBranch({
    monitorSlug: "payment-integrity-daily",
    deadlineMs: 20_000,
    runPaymentIntegrity: async () => result(),
    captureCheckIn: () => {
      checkInCount += 1
      return checkInCount === 1 ? "start-id" : "finish-id"
    },
    flushTelemetry: async () => {
      flushCount += 1
      return true
    },
    requireCheckInReceipt: true,
    now: () => now,
    clock: () => now.getTime(),
  })

  assert.equal(delivered.ok, true)
  assert.equal(flushCount, 1)

  const missingReceipt = await runPaymentIntegrityBranch({
    monitorSlug: "payment-integrity-daily",
    deadlineMs: 20_000,
    runPaymentIntegrity: async () => result(),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => true,
    requireCheckInReceipt: true,
    now: () => now,
    clock: () => now.getTime(),
  })

  assert.equal(missingReceipt.ok, false)
  assert.equal(missingReceipt.summary.status, "monitor_failed")
  assert.deepEqual(missingReceipt.summary.failures, [
    {
      provider: "unknown",
      reason: "telemetry_delivery_failed",
      errorFamily: "unknown",
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

test("payment monitor runs paid-access branch with aggregate-only output", async () => {
  let flushes = 0
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () => result(),
    runPaidAccessMonitor: async () => ({
      status: "completed",
      counters: {
        purchasesListed: 1,
        purchasesChecked: 1,
        skippedInternalTest: 0,
        active: 0,
        findings: 1,
        monitorFailures: 0,
      },
      findings: [
        {
          signal: "paid_but_entitlement_not_active",
          provider: "paypal",
          purchaseId: "purchase_12345678",
          reason: "delivery_evidence_missing",
          userId: "user_12345678",
          leadId: "lead_12345678",
          paidAt: "2026-08-07T10:00:00.000Z",
          isInternalTest: false,
        },
      ],
      monitorFailures: [],
      telemetryEventIds: ["0123456789abcdef0123456789abcdef"],
    }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => {
      flushes += 1
      return true
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 4 },
    },
    paidAccess: {
      status: "completed",
      counters: {
        purchasesListed: 1,
        purchasesChecked: 1,
        skippedInternalTest: 0,
        active: 0,
        findings: 1,
        monitorFailures: 0,
      },
      findings: [{ provider: "paypal", reason: "delivery_evidence_missing" }],
    },
  })
  assert.equal(JSON.stringify(response.body).includes("purchase_12345678"), false)
  assert.equal(JSON.stringify(response.body).includes("user_12345678"), false)
  assert.equal(JSON.stringify(response.body).includes("lead_12345678"), false)
  assert.equal(flushes, 1)
})

test("payment monitor branch emits paid-access findings when runner returns no receipt", async () => {
  const reported: unknown[] = []
  let flushes = 0
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () => result(),
    runPaidAccessMonitor: async () => ({
      status: "completed",
      counters: {
        purchasesListed: 1,
        purchasesChecked: 1,
        skippedInternalTest: 0,
        active: 0,
        findings: 1,
        monitorFailures: 0,
      },
      findings: [
        {
          signal: "paid_but_entitlement_not_active",
          provider: "paypal",
          purchaseId: "purchase_branch_receipt",
          reason: "delivery_evidence_missing",
          paidAt: "2026-08-07T10:00:00.000Z",
          isInternalTest: false,
        },
      ],
      monitorFailures: [],
    }),
    reportPaidAccessFinding: (finding) => {
      reported.push(finding)
      return "abcdef0123456789abcdef0123456789"
    },
    captureCheckIn: () => undefined,
    flushTelemetry: async () => {
      flushes += 1
      return true
    },
  })

  assert.equal(response.status, 200)
  assert.equal(reported.length, 1)
  assert.equal(flushes, 1)
  assert.ok("paymentIntegrity" in response.body)
  assert.deepEqual(response.body.paidAccess, {
    status: "completed",
    counters: {
      purchasesListed: 1,
      purchasesChecked: 1,
      skippedInternalTest: 0,
      active: 0,
      findings: 1,
      monitorFailures: 0,
    },
    findings: [{ provider: "paypal", reason: "delivery_evidence_missing" }],
  })
})

test("payment monitor fails closed on partial paid-access receipts without duplicate reporting", async () => {
  const reported: unknown[] = []
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () => result(),
    runPaidAccessMonitor: async () => ({
      status: "completed",
      counters: {
        purchasesListed: 2,
        purchasesChecked: 2,
        skippedInternalTest: 0,
        active: 0,
        findings: 2,
        monitorFailures: 0,
      },
      findings: [
        {
          signal: "paid_but_entitlement_not_active",
          provider: "paypal",
          purchaseId: "purchase_partial_receipt_1",
          reason: "delivery_evidence_missing",
          paidAt: "2026-08-07T10:00:00.000Z",
          isInternalTest: false,
        },
        {
          signal: "paid_but_entitlement_not_active",
          provider: "paypal",
          purchaseId: "purchase_partial_receipt_2",
          reason: "confirmation_pending",
          paidAt: "2026-08-07T10:05:00.000Z",
          isInternalTest: false,
        },
      ],
      monitorFailures: [],
      telemetryEventIds: ["0123456789abcdef0123456789abcdef"],
    }),
    reportPaidAccessFinding: (finding) => {
      reported.push(finding)
      return "abcdef0123456789abcdef0123456789"
    },
    captureCheckIn: () => undefined,
    flushTelemetry: async () => true,
  })

  assert.equal(response.status, 500)
  assert.equal(reported.length, 0)
  assert.ok("paymentIntegrity" in response.body)
  assert.equal(response.body.paidAccess?.status, "monitor_failed")
  assert.deepEqual(response.body.paidAccess?.failures, [
    {
      provider: "unknown",
      reason: "local_lookup_error",
      errorFamily: "unknown",
    },
  ])
})

test("payment monitor fails closed when paid-access finding has no Sentry receipt", async () => {
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () => result(),
    runPaidAccessMonitor: async () => ({
      status: "completed",
      counters: {
        purchasesListed: 1,
        purchasesChecked: 1,
        skippedInternalTest: 0,
        active: 0,
        findings: 1,
        monitorFailures: 0,
      },
      findings: [
        {
          signal: "paid_but_entitlement_not_active",
          provider: "stripe",
          purchaseId: "purchase_no_receipt",
          reason: "binding_missing",
          paidAt: "2026-08-07T10:00:00.000Z",
          isInternalTest: false,
        },
      ],
      monitorFailures: [],
    }),
    captureCheckIn: () => undefined,
    flushTelemetry: async () => true,
  })

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, {
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 4 },
    },
    paidAccess: {
      status: "monitor_failed",
      counters: {
        purchasesListed: 1,
        purchasesChecked: 1,
        skippedInternalTest: 0,
        active: 0,
        findings: 1,
        monitorFailures: 1,
      },
      findings: [{ provider: "stripe", reason: "binding_missing" }],
      failures: [
        {
          provider: "unknown",
          reason: "local_lookup_error",
          errorFamily: "unknown",
        },
      ],
    },
  })
})

test("payment monitor preserves a canonical paid-access conflict category", async () => {
  const response = await handlePaymentMonitor(request(), {
    triggerSecret: secret,
    checkRateLimit: () => ({ allowed: true }),
    runPaymentIntegrity: async () => result(),
    runPaidAccessMonitor: async () => ({
      status: "monitor_failed",
      counters: {
        purchasesListed: 1,
        purchasesChecked: 1,
        skippedInternalTest: 0,
        active: 0,
        findings: 1,
        monitorFailures: 1,
      },
      findings: [
        {
          signal: "paid_but_entitlement_not_active",
          provider: "paypal",
          purchaseId: "purchase_conflict",
          reason: "delivery_evidence_missing",
          paidAt: "2026-08-07T10:00:00.000Z",
          isInternalTest: false,
        },
      ],
      monitorFailures: [
        {
          signal: "payment_monitor_failed",
          provider: "paypal",
          reason: "canonical_access_conflict",
          errorFamily: "unknown",
          purchaseId: "purchase_conflict",
        },
      ],
    }),
    reportPaidAccessFinding: () => "0123456789abcdef0123456789abcdef",
    reportPaidAccessMonitorFailure: () => "abcdef0123456789abcdef0123456789",
    captureCheckIn: () => undefined,
    flushTelemetry: async () => true,
  })

  assert.equal(response.status, 500)
  assert.ok("paidAccess" in response.body)
  if (!("paidAccess" in response.body)) return
  assert.deepEqual(response.body.paidAccess?.failures, [
    {
      provider: "paypal",
      reason: "canonical_access_conflict",
      errorFamily: "unknown",
    },
  ])
  assert.equal(JSON.stringify(response.body).includes("purchase_conflict"), false)
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
