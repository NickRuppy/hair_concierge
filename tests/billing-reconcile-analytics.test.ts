import assert from "node:assert/strict"
import test from "node:test"

import { handleBillingReconcile, maxDuration } from "../src/app/api/billing/reconcile/route"
import type { BillingAnalyticsDestination } from "../src/lib/billing/types"

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
  const response = await handleBillingReconcile(
    request(),
    createDeps({
      analyticsRetryEnabled: undefined,
      dispatchAnalyticsDue: async () => {
        dispatches += 1
        return { processed: 1, delivered: 0, failed: 1 }
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { downgraded: 2 })
  assert.equal(dispatches, 0)
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
  ])
  assert.deepEqual(response.body, {
    downgraded: 2,
    analyticsRetry: {
      customerio: { processed: 3, delivered: 2, failed: 1 },
      posthog: { processed: 2, delivered: 2, failed: 0 },
      meta: { processed: 1, delivered: 0, failed: 1 },
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

  assert.deepEqual(completed.sort(), ["customerio", "meta"])
  assert.deepEqual(response.body, {
    downgraded: 2,
    analyticsRetry: {
      customerio: { processed: 4, delivered: 3, failed: 1 },
      posthog: { processed: 0, delivered: 0, failed: 0, error: "posthog unavailable" },
      meta: { processed: 4, delivered: 3, failed: 1 },
    },
  })
})

test("billing reconcile authenticates before entitlement and analytics work", async () => {
  let entitlementRuns = 0
  let analyticsRuns = 0
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
    }),
  )

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, { error: "unauthorized" })
  assert.equal(entitlementRuns, 0)
  assert.equal(analyticsRuns, 0)
})

test("billing reconcile does not run analytics when entitlement reconciliation fails", async () => {
  let analyticsRuns = 0

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
      }),
    ),
    /entitlement reconciliation failed/,
  )
  assert.equal(analyticsRuns, 0)
})
