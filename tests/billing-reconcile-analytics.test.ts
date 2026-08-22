import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultOneTimeFulfillmentDispatchers,
  handleBillingReconcile,
  maxDuration,
  runBrowserRecoveryCleanup,
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
const emptyBrowserRecoveryCleanup = {
  quizDrafts: { ok: true, purged: 0 },
  resultReturns: { ok: true, purged: 0 },
}

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
    browserRecoveryCleanup: async () => emptyBrowserRecoveryCleanup,
    ...overrides,
  }
}

test("billing reconcile declares a 60 second maximum duration", () => {
  assert.equal(maxDuration, 60)
})

test("billing reconcile reports bounded browser recovery cleanup without changing payment health", async () => {
  const calls: string[] = []
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      browserRecoveryCleanup: async (limit) => {
        calls.push(`cleanup:${limit}`)
        return {
          quizDrafts: { ok: true, purged: 3 },
          resultReturns: { ok: false, purged: 0 },
        }
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["cleanup:500"])
  assert.deepEqual(response.body.browserRecoveryCleanup, {
    quizDrafts: { ok: true, purged: 3 },
    resultReturns: { ok: false, purged: 0 },
  })
})

test("browser recovery cleanup calls both purges once with the 500-row bound and isolates errors", async () => {
  const calls: Array<[string, unknown]> = []
  const result = await runBrowserRecoveryCleanup(
    {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args])
        return name === "purge_expired_personal_plan_quiz_drafts"
          ? { data: 500, error: null }
          : { data: null, error: { code: "database_error" } }
      },
    } as never,
    500,
  )

  assert.deepEqual(calls, [
    ["purge_expired_personal_plan_quiz_drafts", { p_limit: 500 }],
    ["purge_expired_personal_plan_result_returns", { p_limit: 500 }],
  ])
  assert.deepEqual(result, {
    quizDrafts: { ok: true, purged: 500 },
    resultReturns: { ok: false, purged: 0 },
  })
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
    browserRecoveryCleanup: emptyBrowserRecoveryCleanup,
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

test("billing reconcile runs paid-access monitor after one-time fulfillment retry", async () => {
  const order: string[] = []
  const reported: unknown[] = []
  let flushes = 0
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async () => {
        order.push("fulfillment")
        return oneTimeRetryStats({ claimed: 1 })
      },
      runPaidAccessMonitor: async () => {
        order.push("paid-access")
        return {
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
              purchaseId: "purchase_daily_receipt",
              reason: "delivery_evidence_missing",
              paidAt: "2026-08-01T10:00:00.000Z",
              isInternalTest: false,
            },
          ],
          monitorFailures: [],
        }
      },
      reportPaidAccessFinding: (finding) => {
        reported.push(finding)
        return "abcdef0123456789abcdef0123456789"
      },
      flushTelemetry: async () => {
        flushes += 1
        return true
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(order, ["fulfillment", "paid-access"])
  assert.equal(reported.length, 1)
  assert.equal(flushes, 1)
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

test("billing reconcile does not start unattended branches before one-time fulfillment finishes", async () => {
  const order: string[] = []
  let fulfillmentFinished = false
  const assertFulfillmentFinished = (branch: string) => {
    order.push(branch)
    assert.equal(fulfillmentFinished, true)
  }

  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: true,
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async () => {
        order.push("fulfillment")
        await Promise.resolve()
        fulfillmentFinished = true
        return oneTimeRetryStats({ claimed: 1 })
      },
      runPaymentIntegrity: async () => {
        assertFulfillmentFinished("integrity")
        return integrityResult()
      },
      getFreeTierId: async () => {
        assertFulfillmentFinished("entitlement")
        return "tier-free"
      },
      dispatchAnalyticsDue: async () => {
        assertFulfillmentFinished("analytics")
        return { processed: 0, delivered: 0, failed: 0 }
      },
      runPaidAccessMonitor: async () => {
        assertFulfillmentFinished("paid-access")
        return {
          status: "completed",
          counters: {
            purchasesListed: 0,
            purchasesChecked: 0,
            skippedInternalTest: 0,
            active: 0,
            findings: 0,
            monitorFailures: 0,
          },
          findings: [],
          monitorFailures: [],
        }
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(order[0], "fulfillment")
  assert.ok(order.includes("integrity"))
  assert.ok(order.includes("entitlement"))
  assert.ok(order.includes("analytics"))
  assert.ok(order.includes("paid-access"))
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
    browserRecoveryCleanup: emptyBrowserRecoveryCleanup,
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
    browserRecoveryCleanup: emptyBrowserRecoveryCleanup,
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
    browserRecoveryCleanup: emptyBrowserRecoveryCleanup,
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
    entitlements: { status: "error", reason: "entitlement_reconcile_failed" },
  })
})

test("billing reconcile captures the entitlement branch failure to Sentry instead of swallowing it", async () => {
  const capturedErrors: unknown[] = []
  const thrown = new Error("db connection reset mid-run")

  const response = await handleBillingReconcile(
    request(),
    createDeps({
      reconcileEntitlements: async () => {
        throw thrown
      },
      captureEntitlementBranchFailure: (error) => {
        capturedErrors.push(error)
      },
    }),
  )

  assert.equal(response.status, 500)
  assert.deepEqual(capturedErrors, [thrown])
  assert.deepEqual(response.body.entitlements, {
    status: "error",
    reason: "entitlement_reconcile_failed",
  })
  assert.equal(response.body.downgraded, 0)
  assert.equal(JSON.stringify(response.body).includes("db connection reset"), false)
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
        return "0123456789abcdef0123456789abcdef"
      },
      flushTelemetry: async () => true,
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
    browserRecoveryCleanup: emptyBrowserRecoveryCleanup,
    downgraded: 3,
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
