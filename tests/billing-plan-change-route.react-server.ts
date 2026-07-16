import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { handleChangePlan, type ChangePlanDeps } from "../src/app/api/billing/change-plan/route"
import type { BillingPlanChangeRow, BillingSubscriptionRow } from "../src/lib/billing/types"
import { PayPalPlanChangeAmbiguousError } from "../src/lib/paypal/subscription-plan-change"

const operationId = "59aa75cb-1d8c-47cd-96f9-48dc86c8c5c1"

function subscription(patch: Partial<BillingSubscriptionRow> = {}): BillingSubscriptionRow {
  return {
    id: "subscription-row",
    user_id: "user-id",
    provider: "stripe",
    provider_customer_id: "cus_123",
    provider_subscriber_email: null,
    provider_subscription_id: "sub_123",
    provider_status: "active",
    entitlement_status: "active",
    interval: "month",
    current_period_end: "2026-08-14T12:00:00.000Z",
    cancel_at_period_end: false,
    cancel_scheduled_at: null,
    cancelled_at: null,
    metadata: {},
    created_at: "2026-07-14T12:00:00.000Z",
    updated_at: "2026-07-14T12:00:00.000Z",
    ...patch,
  }
}

function operation(patch: Partial<BillingPlanChangeRow> = {}): BillingPlanChangeRow {
  return {
    id: "change-row",
    operation_id: operationId,
    billing_subscription_id: "subscription-row",
    user_id: "user-id",
    provider: "stripe",
    current_interval: "month",
    target_interval: "year",
    effective_at: "2026-08-14T12:00:00.000Z",
    status: "pending_provider",
    provider_resource_id: null,
    provider_target_id: null,
    approved_at: null,
    applied_at: null,
    failure_code: null,
    metadata: {},
    created_at: "2026-07-16T08:00:00.000Z",
    updated_at: "2026-07-16T08:00:00.000Z",
    ...patch,
  }
}

function request(targetInterval: "month" | "quarter" | "year" = "year") {
  return new Request("https://chaarlie.de/api/billing/change-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetInterval, operationId }),
  })
}

function routeDeps(
  options: {
    currentSubscription?: BillingSubscriptionRow
    calls?: string[]
    claim?: () => Promise<BillingPlanChangeRow>
    scheduleStripe?: () => Promise<{
      scheduleId: string
      targetPriceId: string
      effectiveAt: string
    }>
    initiatePayPal?: () => Promise<{
      targetPlanId: string
      approvalUrl: string
      effectiveAt: string
    }>
    recordPhase?: (
      operation: BillingPlanChangeRow,
      phase: "requested" | "approved" | "failed" | "applied",
      defer: (work: () => void | Promise<void>) => void,
    ) => Promise<void>
  } = {},
) {
  const calls = options.calls ?? []
  const current = options.currentSubscription ?? subscription()
  return {
    userId: "user-id",
    admin: {} as SupabaseClient,
    stripe: {} as Stripe,
    defer: (work: () => void | Promise<void>) => {
      calls.push("defer")
      void work
    },
    findSubscription: async () => current,
    reconcileStalePayPal: async () => [],
    claim: async () => {
      calls.push("claim")
      return options.claim ? options.claim() : operation({ provider: current.provider })
    },
    advance: async (_admin: SupabaseClient, input: Parameters<ChangePlanDeps["advance"]>[1]) => {
      calls.push(`ledger:${input.status}`)
      return operation({
        provider: current.provider,
        status: input.status,
        approved_at: input.status === "scheduled" ? "2026-07-16T08:01:00.000Z" : null,
        updated_at: "2026-07-16T08:01:00.000Z",
      })
    },
    findByOperationId: async () => null,
    mergeMetadata: async () => {
      calls.push("metadata")
    },
    recordPhase: async (
      _admin: SupabaseClient,
      planChange: BillingPlanChangeRow,
      phase: "requested" | "approved" | "failed" | "applied",
      phaseOptions?: Parameters<ChangePlanDeps["recordPhase"]>[3],
    ) => {
      calls.push(`analytics:${phase}`)
      await options.recordPhase?.(planChange, phase, phaseOptions?.defer ?? (() => {}))
    },
    scheduleStripe: async () => {
      calls.push("provider:stripe")
      if (options.scheduleStripe) return options.scheduleStripe()
      return {
        scheduleId: "sub_sched_123",
        targetPriceId: "price_year",
        effectiveAt: "2026-08-14T12:00:00.000Z",
      }
    },
    reconcileStripe: async () => {
      throw new Error("not expected")
    },
    initiatePayPal: async () => {
      calls.push("provider:paypal")
      if (options.initiatePayPal) return options.initiatePayPal()
      return {
        targetPlanId: "P-YEAR",
        approvalUrl: "https://www.paypal.com/approve/change",
        effectiveAt: "2026-08-14T12:00:00.000Z",
      }
    },
  }
}

test("Stripe persists the provider result before requested and approved analytics", async () => {
  const calls: string[] = []
  const response = await handleChangePlan(request(), routeDeps({ calls }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: "scheduled",
    targetInterval: "year",
    effectiveAt: "2026-08-14T12:00:00.000Z",
  })
  assert.deepEqual(calls, [
    "claim",
    "provider:stripe",
    "ledger:scheduled",
    "metadata",
    "analytics:requested",
    "analytics:approved",
  ])
})

test("destination delivery remains deferred until after the handler returns", async () => {
  const deferred: Array<() => void | Promise<void>> = []
  let destinationRan = false
  const deps = routeDeps({
    recordPhase: async (_operation, _phase, defer) => {
      defer(async () => {
        destinationRan = true
        throw new Error("vendor unavailable")
      })
    },
  })
  deps.defer = (work) => deferred.push(work)

  const response = await handleChangePlan(request(), deps)

  assert.equal(response.status, 200)
  assert.equal(destinationRan, false)
  assert.equal(deferred.length, 2)
  await assert.rejects(async () => deferred[0]!(), /vendor unavailable/)
  assert.equal(destinationRan, true)
})

test("analytics insertion failure cannot change a successful response or ledger", async () => {
  const calls: string[] = []
  const response = await handleChangePlan(
    request(),
    routeDeps({
      calls,
      recordPhase: async () => {
        throw new Error("outbox insert failed")
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, "scheduled")
  assert.equal(calls.includes("ledger:scheduled"), true)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("analytics:")),
    ["analytics:requested", "analytics:approved"],
  )
})

test("provider failure is persisted before requested and failed analytics", async () => {
  const calls: string[] = []
  const response = await handleChangePlan(
    request(),
    routeDeps({
      calls,
      scheduleStripe: async () => {
        throw new Error("provider unavailable")
      },
    }),
  )

  assert.equal(response.status, 502)
  assert.deepEqual(calls, [
    "claim",
    "provider:stripe",
    "ledger:failed",
    "analytics:requested",
    "analytics:failed",
  ])
})

test("PayPal pending approval and ambiguous outcomes emit requested only", async () => {
  for (const scenario of ["pending", "ambiguous"] as const) {
    const calls: string[] = []
    const paypalSubscription = subscription({
      provider: "paypal",
      provider_status: "ACTIVE",
      provider_customer_id: null,
      provider_subscription_id: "I-PAYPAL",
    })
    const response = await handleChangePlan(
      request(),
      routeDeps({
        calls,
        currentSubscription: paypalSubscription,
        initiatePayPal:
          scenario === "ambiguous"
            ? async () => {
                throw new PayPalPlanChangeAmbiguousError(new Error("timeout"))
              }
            : undefined,
      }),
    )

    assert.equal(response.status, scenario === "pending" ? 200 : 503, scenario)
    assert.deepEqual(
      calls.filter((call) => call.startsWith("analytics:")),
      ["analytics:requested"],
      scenario,
    )
  }
})

test("replaying the same operation does not repeat provider or analytics work", async () => {
  const calls: string[] = []
  let claimCount = 0
  const deps = routeDeps({
    calls,
    claim: async () => {
      claimCount += 1
      return operation({
        status: claimCount === 1 ? "pending_provider" : "scheduled",
        approved_at: claimCount === 1 ? null : "2026-07-16T08:01:00.000Z",
      })
    },
  })

  assert.equal((await handleChangePlan(request(), deps)).status, 200)
  assert.equal((await handleChangePlan(request(), deps)).status, 200)
  assert.equal(calls.filter((call) => call === "provider:stripe").length, 1)
  assert.equal(calls.filter((call) => call.startsWith("analytics:")).length, 2)
})
