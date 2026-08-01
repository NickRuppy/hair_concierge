import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultOneTimeFulfillmentDispatchers,
  handleBillingReconcile,
  maxDuration,
} from "../src/app/api/billing/reconcile/route"
import { emptyPaymentIntegrityCounters } from "../src/app/api/billing/payment-monitor/route"
import type {
  BillingAnalyticsDestination,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "../src/lib/billing/types"
import type { PaymentIntegrityResult } from "../src/lib/billing/payment-integrity"

const request = (secret = "secret") =>
  new Request("https://example.com/api/billing/reconcile", {
    headers: { authorization: `Bearer ${secret}` },
  })
const now = new Date("2026-08-01T12:00:00.000Z")

function integrityResult(overrides: Partial<PaymentIntegrityResult> = {}): PaymentIntegrityResult {
  return {
    status: "completed",
    counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 5 },
    findings: [],
    monitorFailures: [],
    ...overrides,
  }
}

function createDeps(
  overrides: Partial<Parameters<typeof handleBillingReconcile>[1]> = {},
): Parameters<typeof handleBillingReconcile>[1] {
  return {
    supabase: {} as never,
    cronSecret: "secret",
    now,
    clock: () => now.getTime(),
    getFreeTierId: async () => "tier-free",
    reconcileEntitlements: async () => ({ downgraded: 2 }),
    analyticsRetryEnabled: false,
    dispatchAnalyticsDue: async () => ({ processed: 0, delivered: 0, failed: 0 }),
    runPaymentIntegrity: async () => integrityResult(),
    ...overrides,
  }
}

test("billing reconcile declares a 60 second maximum duration", () => {
  assert.equal(maxDuration, 60)
})

test("billing reconcile keeps retry disabled by default and still runs integrity first", async () => {
  let dispatches = 0
  let integrityInput:
    | Parameters<
        NonNullable<Parameters<typeof handleBillingReconcile>[1]["runPaymentIntegrity"]>
      >[0]
    | undefined
  const checkIns: unknown[] = []
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: undefined,
      runPaymentIntegrity: async (input) => {
        integrityInput = input
        return integrityResult()
      },
      captureCheckIn: (checkIn) => {
        checkIns.push(checkIn)
        return checkIns.length === 1 ? "daily-check-in-id" : undefined
      },
      dispatchAnalyticsDue: async () => {
        dispatches += 1
        return { processed: 1, delivered: 0, failed: 1 }
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(integrityInput?.now, now)
  assert.equal(integrityInput?.deadlineAt.getTime(), now.getTime() + 20_000)
  assert.deepEqual(response.body, {
    downgraded: 2,
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 5 },
    },
  })
  assert.deepEqual(checkIns, [
    { monitorSlug: "payment-integrity-daily", status: "in_progress" },
    {
      monitorSlug: "payment-integrity-daily",
      status: "ok",
      checkInId: "daily-check-in-id",
      duration: 0,
    },
  ])
  assert.equal(dispatches, 0)
})

test("billing reconcile runs one-time fulfillment retry only behind its dedicated flag", async () => {
  let retryRuns = 0
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async (retryDeps) => {
        retryRuns += 1
        assert.ok(retryDeps.dispatchers.stripe)
        assert.ok(retryDeps.dispatchers.paypal)
        return oneTimeRetryStats({
          claimed: 2,
          active: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
          paidPending: { total: 1, stripe: 0, paypal: 1, unknown: 0 },
        })
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(retryRuns, 1)
  assert.deepEqual(
    response.body.oneTimeFulfillmentRetry,
    oneTimeRetryStats({
      claimed: 2,
      active: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
      paidPending: { total: 1, stripe: 0, paypal: 1, unknown: 0 },
    }),
  )
})

test("default one-time fulfillment dispatchers pass quiz linking to both provider processors", async () => {
  const linkQuizToProfile = async () => {}
  let stripeLink: unknown
  let paypalLink: unknown
  const dispatchers = defaultOneTimeFulfillmentDispatchers(
    createDeps({
      oneTimeFulfillmentRuntime: {
        linkQuizToProfile,
        loadStripeProcessor: async () => ({
          getStripe: () => ({}) as never,
          processStripeOneTimeFulfillmentJob: async (_job, processorDeps) => {
            stripeLink = processorDeps.linkQuizToProfile
            return {} as never
          },
        }),
        loadPayPalProcessor: async () => ({
          processPayPalOneTimeFulfillmentJob: async (_job, processorDeps) => {
            paypalLink = processorDeps.linkQuizToProfile
            return {} as never
          },
        }),
      },
    }),
  )

  await dispatchers.stripe?.(oneTimeFulfillmentJob())
  await dispatchers.paypal?.(oneTimeFulfillmentJob())

  assert.equal(stripeLink, linkQuizToProfile)
  assert.equal(paypalLink, linkQuizToProfile)
})

test("billing reconcile drains all destinations with a limit of ten when enabled", async () => {
  const calls: Array<{ destination?: BillingAnalyticsDestination; limit?: number }> = []
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: true,
      dispatchAnalyticsDue: async (_supabase, options) => {
        if (!options) throw new Error("analytics retry options are required")
        calls.push({ destination: options.destination, limit: options.limit })
        return options.destination === "customerio"
          ? { processed: 3, delivered: 2, failed: 1 }
          : options.destination === "posthog"
            ? { processed: 2, delivered: 2, failed: 0 }
            : { processed: 1, delivered: 0, failed: 1 }
      },
    }),
  )

  assert.deepEqual(calls, [
    { destination: "customerio", limit: 10 },
    { destination: "posthog", limit: 10 },
    { destination: "meta", limit: 10 },
    { destination: "funnel", limit: 10 },
  ])
  assert.deepEqual(response.body, {
    downgraded: 2,
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 5 },
    },
    analyticsRetry: {
      customerio: { processed: 3, delivered: 2, failed: 1 },
      posthog: { processed: 2, delivered: 2, failed: 0 },
      meta: { processed: 1, delivered: 0, failed: 1 },
      funnel: { processed: 1, delivered: 0, failed: 1 },
    },
  })
})

test("billing reconcile isolates and sanitizes one analytics destination rejection", async () => {
  const completed: BillingAnalyticsDestination[] = []
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: true,
      dispatchAnalyticsDue: async (_supabase, options) => {
        if (!options) throw new Error("analytics retry options are required")
        if (options.destination === "posthog") throw new Error("posthog unavailable")
        completed.push(options.destination!)
        return { processed: 4, delivered: 3, failed: 1 }
      },
    }),
  )

  assert.equal(response.status, 500)
  assert.deepEqual(completed.sort(), ["customerio", "funnel", "meta"])
  assert.deepEqual(response.body, {
    downgraded: 2,
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 5 },
    },
    analyticsRetry: {
      customerio: { processed: 4, delivered: 3, failed: 1 },
      posthog: { processed: 0, delivered: 0, failed: 0, status: "error" },
      meta: { processed: 4, delivered: 3, failed: 1 },
      funnel: { processed: 4, delivered: 3, failed: 1 },
    },
  })
})

test("billing reconcile authenticates before entitlement, integrity, analytics, and one-time retry work", async () => {
  let entitlementRuns = 0
  let analyticsRuns = 0
  let integrityRuns = 0
  let oneTimeRetryRuns = 0
  let checkIns = 0
  const response = await handleBillingReconcile(
    request("wrong"),
    createDeps({
      reconcileEntitlements: async () => {
        entitlementRuns += 1
        return { downgraded: 0 }
      },
      analyticsRetryEnabled: true,
      dispatchAnalyticsDue: async () => {
        analyticsRuns += 1
        return { processed: 0, delivered: 0, failed: 0 }
      },
      runPaymentIntegrity: async () => {
        integrityRuns += 1
        return integrityResult()
      },
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async () => {
        oneTimeRetryRuns += 1
        return oneTimeRetryStats()
      },
      captureCheckIn: () => {
        checkIns += 1
      },
    }),
  )

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, { error: "unauthorized" })
  assert.equal(entitlementRuns, 0)
  assert.equal(analyticsRuns, 0)
  assert.equal(integrityRuns, 0)
  assert.equal(oneTimeRetryRuns, 0)
  assert.equal(checkIns, 0)
})

test("billing reconcile isolates entitlement failure from integrity, analytics, and one-time retry", async () => {
  let integrityRuns = 0
  let analyticsRuns = 0
  let oneTimeRetryRuns = 0

  const response = await handleBillingReconcile(
    request(),
    createDeps({
      reconcileEntitlements: async () => {
        throw new Error("entitlement secret must not leak")
      },
      analyticsRetryEnabled: true,
      runPaymentIntegrity: async () => {
        integrityRuns += 1
        return integrityResult()
      },
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async () => {
        oneTimeRetryRuns += 1
        return oneTimeRetryStats({ claimed: 1 })
      },
      dispatchAnalyticsDue: async () => {
        analyticsRuns += 1
        return { processed: 0, delivered: 0, failed: 0 }
      },
    }),
  )

  assert.equal(response.status, 500)
  assert.equal(integrityRuns, 1)
  assert.equal(analyticsRuns, 4)
  assert.equal(oneTimeRetryRuns, 1)
  assert.equal(JSON.stringify(response.body).includes("entitlement secret"), false)
  assert.deepEqual(response.body, {
    downgraded: 0,
    paymentIntegrity: {
      status: "completed",
      counters: { ...emptyPaymentIntegrityCounters(), providersScanned: 2, candidatesChecked: 5 },
    },
    oneTimeFulfillmentRetry: oneTimeRetryStats({ claimed: 1 }),
    analyticsRetry: {
      customerio: { processed: 0, delivered: 0, failed: 0 },
      posthog: { processed: 0, delivered: 0, failed: 0 },
      meta: { processed: 0, delivered: 0, failed: 0 },
      funnel: { processed: 0, delivered: 0, failed: 0 },
    },
    entitlements: { status: "error" },
  })
})

test("billing reconcile isolates one-time fulfillment failure from other branches", async () => {
  let entitlementRuns = 0
  let analyticsRuns = 0
  let integrityRuns = 0
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async () => {
        throw new Error("fulfillment secret must not leak")
      },
      reconcileEntitlements: async () => {
        entitlementRuns += 1
        return { downgraded: 1 }
      },
      runPaymentIntegrity: async () => {
        integrityRuns += 1
        return integrityResult()
      },
      analyticsRetryEnabled: true,
      dispatchAnalyticsDue: async () => {
        analyticsRuns += 1
        return { processed: 0, delivered: 0, failed: 0 }
      },
    }),
  )

  assert.equal(response.status, 500)
  assert.equal(entitlementRuns, 1)
  assert.equal(integrityRuns, 1)
  assert.equal(analyticsRuns, 4)
  assert.equal(JSON.stringify(response.body).includes("fulfillment secret"), false)
  assert.deepEqual(response.body.oneTimeFulfillmentRetry, { status: "error" })
})

test("billing reconcile isolates integrity failure and marks the daily check-in error", async () => {
  let entitlementRuns = 0
  let analyticsRuns = 0
  const checkIns: unknown[] = []
  const monitorFailures: unknown[] = []
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: true,
      clock: () => now.getTime(),
      reconcileEntitlements: async () => {
        entitlementRuns += 1
        return { downgraded: 3 }
      },
      runPaymentIntegrity: async () => {
        throw new Error("provider secret must not leak")
      },
      captureCheckIn: (checkIn) => {
        checkIns.push(checkIn)
        return checkIns.length === 1 ? "daily-check-in-id" : undefined
      },
      reportMonitorFailure: (failure) => {
        monitorFailures.push(failure)
      },
      dispatchAnalyticsDue: async () => {
        analyticsRuns += 1
        return { processed: 1, delivered: 1, failed: 0 }
      },
    }),
  )

  assert.equal(response.status, 500)
  assert.equal(entitlementRuns, 1)
  assert.equal(analyticsRuns, 4)
  assert.equal(JSON.stringify(response.body).includes("provider secret"), false)
  assert.deepEqual(response.body, {
    downgraded: 3,
    paymentIntegrity: {
      status: "error",
      counters: emptyPaymentIntegrityCounters(),
    },
    analyticsRetry: {
      customerio: { processed: 1, delivered: 1, failed: 0 },
      posthog: { processed: 1, delivered: 1, failed: 0 },
      meta: { processed: 1, delivered: 1, failed: 0 },
      funnel: { processed: 1, delivered: 1, failed: 0 },
    },
  })
  assert.deepEqual(checkIns, [
    { monitorSlug: "payment-integrity-daily", status: "in_progress" },
    {
      monitorSlug: "payment-integrity-daily",
      status: "error",
      checkInId: "daily-check-in-id",
      duration: 0,
    },
  ])
  assert.equal(monitorFailures.length, 1)
  assert.deepEqual(monitorFailures[0], {
    signal: "payment_monitor_failed",
    provider: "unknown",
    reason: "provider_error",
    errorFamily: "unknown",
  })
})

function oneTimeRetryStats(
  overrides: Partial<
    Awaited<
      ReturnType<
        NonNullable<
          Parameters<typeof handleBillingReconcile>[1]["reconcileOneTimeFulfillmentRetries"]
        >
      >
    >
  > = {},
) {
  const zero = { total: 0, stripe: 0, paypal: 0, unknown: 0 }
  return {
    claimed: 0,
    active: { ...zero },
    paidPending: { ...zero },
    failedRetryable: { ...zero },
    failedPermanent: { ...zero },
    ...overrides,
  }
}

function oneTimeFulfillmentJob(): PersonalPlanOneTimeFulfillmentJobRow {
  const timestamp = "2026-07-31T12:00:00.000Z"
  return {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: "consent-1",
    status: "processing",
    attempts: 1,
    next_attempt_at: null,
    processing_started_at: timestamp,
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }
}
