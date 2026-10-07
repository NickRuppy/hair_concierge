import assert from "node:assert/strict"
import test from "node:test"

import { reconcilePayPalTrialCancellation } from "../src/lib/paypal/trial-cancellation"

const ids = {
  declaration: "11111111-1111-4111-8111-111111111111",
  enrollment: "22222222-2222-4222-8222-222222222222",
  user: "33333333-3333-4333-8333-333333333333",
}
function operation(overrides: Record<string, unknown> = {}) {
  return {
    enrollment_id: ids.enrollment,
    user_id: ids.user,
    provider: "paypal",
    provider_customer_id: "payer_1",
    provider_agreement_id: "I-1",
    original_trial_end_at: "2030-01-08T00:00:00.000Z",
    status: "pending",
    cancel_at_period_end: true,
    trial_cohort: "trial_v1",
    provider_plan_id: "P-trial",
    ...overrides,
  }
}
function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "I-1",
    status: "ACTIVE",
    plan_id: "P-trial",
    subscriber: { payer_id: "payer_1" },
    billing_info: { next_billing_time: "2030-01-08T00:00:00.000Z" },
    ...overrides,
  }
}

test("PayPal cancellation validates the owned trial then cancels, refetches, and confirms", async () => {
  let current = subscription(),
    cancelled = 0,
    confirmed = false
  const result = await reconcilePayPalTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name, args) => {
      if (name === "load_trial_cancellation_provider_operation")
        return { data: [operation()], error: null }
      assert.deepEqual(args, {
        p_declaration_id: ids.declaration,
        p_user_id: ids.user,
        p_enrollment_id: ids.enrollment,
        p_provider: "paypal",
        p_provider_agreement_id: "I-1",
        p_provider_customer_id: "payer_1",
        p_original_trial_end_at: "2030-01-08T00:00:00.000Z",
        p_trial_cohort: "trial_v1",
        p_provider_plan_id: "P-trial",
      })
      confirmed = true
      return { data: true, error: null }
    },
    retrieve: async () => current,
    cancel: async (id, reason) => {
      assert.equal(id, "I-1")
      assert.match(reason, /Customer cancelled/)
      cancelled++
      current = subscription({ status: "CANCELLED", billing_info: {} })
    },
  })
  assert.equal(result, "confirmed")
  assert.equal(cancelled, 1)
  assert.equal(confirmed, true)
})

test("PayPal cancellation fails closed for cross-owner, mismatched plan/deadline, restore, and failed cancel", async () => {
  for (const candidate of [
    subscription({ subscriber: { payer_id: "payer_other" } }),
    subscription({ plan_id: "P-other" }),
    subscription({ billing_info: { next_billing_time: "2030-01-12T00:00:00.000Z" } }),
    subscription({ status: "SUSPENDED" }),
  ]) {
    let mutations = 0
    const result = await reconcilePayPalTrialCancellation({
      declarationId: ids.declaration,
      userId: ids.user,
      rpc: async (name) =>
        name === "load_trial_cancellation_provider_operation"
          ? { data: [operation()], error: null }
          : { data: true, error: null },
      retrieve: async () => candidate,
      cancel: async () => {
        mutations++
      },
    })
    assert.equal(result, "pending")
    assert.equal(mutations, 0)
  }
  const restored = await reconcilePayPalTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name) =>
      name === "load_trial_cancellation_provider_operation"
        ? { data: [operation()], error: null }
        : { data: true, error: null },
    retrieve: async () => subscription(),
    cancel: async () => {
      throw new Error("lost response")
    },
  })
  assert.equal(restored, "pending")
})

test("a local restore race between retrieval and cancellation prevents the provider mutation", async () => {
  let loads = 0,
    mutations = 0
  const result = await reconcilePayPalTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name) => {
      if (name !== "load_trial_cancellation_provider_operation") return { data: true, error: null }
      loads++
      return loads === 1 ? { data: [operation()], error: null } : { data: [], error: null }
    },
    retrieve: async () => subscription(),
    cancel: async () => {
      mutations++
    },
  })
  assert.equal(result, "pending")
  assert.equal(mutations, 0)
})

test("PayPal cancellation accepts the day-after collection schedule", async () => {
  // Trial ends 2030-01-08T00:00Z (exact midnight) -> collection 01-09, batch ~10:00 UTC.
  let cancelled = 0
  let confirmed = false
  const current = subscription({
    billing_info: { next_billing_time: "2030-01-09T10:00:00Z" },
  })
  const result = await reconcilePayPalTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name) => {
      if (name === "load_trial_cancellation_provider_operation")
        return { data: operation(), error: null }
      if (name === "confirm_trial_cancellation_provider_operation") {
        confirmed = true
        return { data: true, error: null }
      }
      return { data: operation(), error: null }
    },
    retrieve: async () => ({ ...current, ...(cancelled ? { status: "CANCELLED" } : {}) }) as any,
    cancel: async () => {
      cancelled += 1
    },
  })
  assert.equal(result, "confirmed")
  assert.equal(cancelled, 1)
  assert.equal(confirmed, true)
})
