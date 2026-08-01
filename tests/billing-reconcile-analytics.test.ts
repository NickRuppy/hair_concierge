import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultOneTimeFulfillmentDispatchers,
  handleBillingReconcile,
  maxDuration,
} from "../src/app/api/billing/reconcile/route"
import type {
  BillingAnalyticsDestination,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "../src/lib/billing/types"

const request = (secret = "secret") =>
  new Request("https://example.com/api/billing/reconcile", {
    headers: { authorization: `Bearer ${secret}` },
  })

function createDeps(
  overrides: Partial<Parameters<typeof handleBillingReconcile>[1]> = {},
): Parameters<typeof handleBillingReconcile>[1] {
  return {
    supabase: {} as never,
    cronSecret: "secret",
    getFreeTierId: async () => "tier-free",
    reconcileEntitlements: async () => ({ downgraded: 2 }),
    analyticsRetryEnabled: false,
    dispatchAnalyticsDue: async () => ({ processed: 0, delivered: 0, failed: 0 }),
    ...overrides,
  }
}

test("billing reconcile declares a 60 second maximum duration", () => {
  assert.equal(maxDuration, 60)
})

test("billing reconcile keeps retry disabled by default and preserves the entitlement response", async () => {
  let dispatches = 0
  let oneTimeRetries = 0
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: undefined,
      dispatchAnalyticsDue: async () => {
        dispatches += 1
        return { processed: 1, delivered: 0, failed: 1 }
      },
      oneTimeFulfillmentRetryEnabled: undefined,
      reconcileOneTimeFulfillmentRetries: async () => {
        oneTimeRetries += 1
        return oneTimeRetryStats()
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { downgraded: 2 })
  assert.equal(dispatches, 0)
  assert.equal(oneTimeRetries, 0)
})

test("billing reconcile runs one-time fulfillment retry only behind its dedicated flag", async () => {
  let retryRuns = 0
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async (_deps) => {
        retryRuns += 1
        assert.ok(_deps.dispatchers.stripe)
        assert.ok(_deps.dispatchers.paypal)
        return oneTimeRetryStats({
          claimed: 2,
          active: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
          paidPending: { total: 1, stripe: 0, paypal: 1, unknown: 0 },
        })
      },
    }),
  )

  assert.equal(retryRuns, 1)
  assert.deepEqual(response.body, {
    downgraded: 2,
    oneTimeFulfillmentRetry: oneTimeRetryStats({
      claimed: 2,
      active: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
      paidPending: { total: 1, stripe: 0, paypal: 1, unknown: 0 },
    }),
  })
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
    analyticsRetry: {
      customerio: { processed: 3, delivered: 2, failed: 1 },
      posthog: { processed: 2, delivered: 2, failed: 0 },
      meta: { processed: 1, delivered: 0, failed: 1 },
      funnel: { processed: 1, delivered: 0, failed: 1 },
    },
  })
})

test("billing reconcile isolates one analytics destination rejection", async () => {
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

  assert.deepEqual(completed.sort(), ["customerio", "funnel", "meta"])
  assert.deepEqual(response.body, {
    downgraded: 2,
    analyticsRetry: {
      customerio: { processed: 4, delivered: 3, failed: 1 },
      posthog: { processed: 0, delivered: 0, failed: 0, error: "posthog unavailable" },
      meta: { processed: 4, delivered: 3, failed: 1 },
      funnel: { processed: 4, delivered: 3, failed: 1 },
    },
  })
})

test("billing reconcile authenticates before entitlement and analytics work", async () => {
  let entitlementRuns = 0
  let analyticsRuns = 0
  let oneTimeRetryRuns = 0
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
      oneTimeFulfillmentRetryEnabled: true,
      reconcileOneTimeFulfillmentRetries: async () => {
        oneTimeRetryRuns += 1
        return oneTimeRetryStats()
      },
    }),
  )

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, { error: "unauthorized" })
  assert.equal(entitlementRuns, 0)
  assert.equal(analyticsRuns, 0)
  assert.equal(oneTimeRetryRuns, 0)
})

test("billing reconcile does not run retries when entitlement reconciliation fails", async () => {
  let analyticsRuns = 0
  let oneTimeRetryRuns = 0

  await assert.rejects(
    handleBillingReconcile(
      request(),
      createDeps({
        reconcileEntitlements: async () => {
          throw new Error("entitlement reconciliation failed")
        },
        analyticsRetryEnabled: true,
        dispatchAnalyticsDue: async () => {
          analyticsRuns += 1
          return { processed: 0, delivered: 0, failed: 0 }
        },
        oneTimeFulfillmentRetryEnabled: true,
        reconcileOneTimeFulfillmentRetries: async () => {
          oneTimeRetryRuns += 1
          return oneTimeRetryStats()
        },
      }),
    ),
    /entitlement reconciliation failed/,
  )
  assert.equal(analyticsRuns, 0)
  assert.equal(oneTimeRetryRuns, 0)
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
  const now = "2026-07-31T12:00:00.000Z"
  return {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: "consent-1",
    status: "processing",
    attempts: 1,
    next_attempt_at: null,
    processing_started_at: now,
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: now,
    updated_at: now,
  }
}
