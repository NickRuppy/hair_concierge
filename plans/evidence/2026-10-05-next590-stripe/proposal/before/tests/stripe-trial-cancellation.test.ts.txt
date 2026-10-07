import assert from "node:assert/strict"
import test from "node:test"
import {
  decodeTrialCancellationCapability,
  projectTrialCancellationCapability,
  reconcileStripeTrialCancellation,
} from "../src/lib/stripe/trial-cancellation"

const ids = {
  declaration: "11111111-1111-4111-8111-111111111111",
  enrollment: "22222222-2222-4222-8222-222222222222",
  user: "33333333-3333-4333-8333-333333333333",
}
const deadline = 1_894_060_800
const secret = "x".repeat(32)
function configureRuntime() {
  Object.assign(process.env, {
    TRIAL_IDENTITY_PROCESSING_APPROVED: "true",
    TRIAL_STRIPE_ACCOUNT_ID: "acct_test",
    TRIAL_STRIPE_LIVEMODE: "false",
    TRIAL_IDENTITY_HMAC_KEYS: `[{"version":1,"secretHex":"${"a".repeat(64)}"}]`,
    TRIAL_STRIPE_PRICE_MONTHLY: "price_month",
    TRIAL_STRIPE_PRICE_ANNUAL: "price_year",
    TRIAL_STRIPE_ANNUAL_COUPON: "",
    TRIAL_ENROLLMENT_MODE: "disabled",
  })
}
function operation(overrides: Record<string, unknown> = {}) {
  return {
    enrollment_id: ids.enrollment,
    user_id: ids.user,
    provider: "stripe",
    provider_customer_id: "cus_1",
    provider_agreement_id: "sub_1",
    original_trial_end_at: "2030-01-08T00:00:00.000Z",
    status: "pending",
    cancel_at_period_end: true,
    ...overrides,
  }
}
function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    livemode: false,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: ids.enrollment },
    customer: "cus_1",
    trial_end: deadline,
    status: "trialing",
    cancel_at: null,
    ...overrides,
  }
}

test("cancellation capability binds a stable request to its enrollment", () => {
  const token = projectTrialCancellationCapability(
    { enrollmentId: ids.enrollment, requestId: ids.declaration },
    secret,
  )
  assert.deepEqual(decodeTrialCancellationCapability(token, secret), {
    enrollmentId: ids.enrollment,
    requestId: ids.declaration,
  })
  assert.equal(decodeTrialCancellationCapability(token, "y".repeat(32)), null)
})

test("reconciliation schedules and re-verifies the immutable trial deadline before confirmation", async () => {
  configureRuntime()
  let current = subscription({ cancel_at_period_end: true, cancel_at: deadline + 86_400 })
  const calls: string[] = []
  const result = await reconcileStripeTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name) =>
      name === "load_trial_cancellation_provider_operation"
        ? { data: [operation()], error: null }
        : (calls.push(name), { data: true, error: null }),
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct_test" }) },
      subscriptions: {
        retrieve: async () => current,
        update: async (_id: string, params: { cancel_at: number; proration_behavior: string }) => {
          assert.deepEqual(params, { cancel_at: deadline, proration_behavior: "none" })
          current = subscription({ cancel_at: deadline })
          return current
        },
      },
    } as never,
  })
  assert.equal(result, "confirmed")
  assert.deepEqual(calls, ["confirm_trial_cancellation_provider_operation"])
})

test("reconciliation fails closed for wrong provider ownership, deadline, mode, or ineffective mutation", async () => {
  configureRuntime()
  for (const [row, sub] of [
    [operation({ provider_customer_id: "cus_other" }), subscription()],
    [operation({ enrollment_id: "44444444-4444-4444-8444-444444444444" }), subscription()],
    [operation({ original_trial_end_at: "2030-01-09T00:00:00.000Z" }), subscription()],
    [operation(), subscription({ livemode: true })],
  ] as const) {
    let confirmed = false
    const result = await reconcileStripeTrialCancellation({
      declarationId: ids.declaration,
      userId: ids.user,
      rpc: async (name) =>
        name === "load_trial_cancellation_provider_operation"
          ? { data: [row], error: null }
          : ((confirmed = true), { data: true, error: null }),
      stripe: {
        accounts: { retrieve: async () => ({ id: "acct_test" }) },
        subscriptions: { retrieve: async () => sub, update: async () => sub },
      } as never,
    })
    assert.equal(result, "pending")
    assert.equal(confirmed, false)
  }
})

test("configuration failure and a lost provider response remain pending without confirmation", async () => {
  const saved = process.env.TRIAL_IDENTITY_PROCESSING_APPROVED
  process.env.TRIAL_IDENTITY_PROCESSING_APPROVED = "false"
  let confirmed = false
  const result = await reconcileStripeTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name) =>
      name === "load_trial_cancellation_provider_operation"
        ? { data: [operation()], error: null }
        : ((confirmed = true), { data: true, error: null }),
    stripe: {
      accounts: {
        retrieve: async () => {
          throw new Error("must stay lazy")
        },
      },
      subscriptions: {},
    } as never,
  })
  assert.equal(result, "pending")
  assert.equal(confirmed, false)
  if (saved === undefined) delete process.env.TRIAL_IDENTITY_PROCESSING_APPROVED
  else process.env.TRIAL_IDENTITY_PROCESSING_APPROVED = saved
})

test("a no-op provider update never confirms cancellation", async () => {
  configureRuntime()
  let confirmations = 0
  const result = await reconcileStripeTrialCancellation({
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name) =>
      name === "load_trial_cancellation_provider_operation"
        ? { data: [operation()], error: null }
        : (confirmations++, { data: true, error: null }),
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct_test" }) },
      subscriptions: { retrieve: async () => subscription(), update: async () => subscription() },
    } as never,
  })
  assert.equal(result, "pending")
  assert.equal(confirmations, 0)
})

test("a lost update response reconciles the already scheduled cancellation on retry", async () => {
  configureRuntime()
  let current = subscription()
  let confirmations = 0
  let mutations = 0
  const input = {
    declarationId: ids.declaration,
    userId: ids.user,
    rpc: async (name: string, args: Record<string, string>) => {
      if (name === "load_trial_cancellation_provider_operation")
        return { data: [operation()], error: null }
      assert.equal(args.p_provider_customer_id, "cus_1")
      assert.equal(args.p_provider_agreement_id, "sub_1")
      assert.equal(args.p_original_trial_end_at, "2030-01-08T00:00:00.000Z")
      confirmations++
      return { data: true, error: null }
    },
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct_test" }) },
      subscriptions: {
        retrieve: async () => current,
        update: async () => {
          mutations++
          current = subscription({ cancel_at: deadline })
          throw new Error("response lost")
        },
      },
    } as never,
  }
  assert.equal(await reconcileStripeTrialCancellation(input), "pending")
  assert.equal(await reconcileStripeTrialCancellation(input), "confirmed")
  assert.equal(mutations, 1)
  assert.equal(confirmations, 1)
})

test("already canceled free agreement uses ended_at and checks remaining invoices", async () => {
  configureRuntime()
  for (const amount of [0, 999]) {
    let confirmations = 0
    const result = await reconcileStripeTrialCancellation({
      declarationId: ids.declaration,
      userId: ids.user,
      rpc: async (name) =>
        name === "load_trial_cancellation_provider_operation"
          ? { data: [operation()], error: null }
          : (confirmations++, { data: true, error: null }),
      stripe: {
        accounts: { retrieve: async () => ({ id: "acct_test" }) },
        subscriptions: {
          retrieve: async () =>
            subscription({ status: "canceled", canceled_at: deadline - 86400, ended_at: deadline }),
        },
        invoices: {
          list: async () => ({
            has_more: false,
            data: [
              { status: "paid", amount_paid: amount, amount_due: amount, amount_remaining: 0 },
            ],
          }),
        },
      } as never,
    })
    assert.equal(result, amount === 0 ? "confirmed" : "pending")
    assert.equal(confirmations, amount === 0 ? 1 : 0)
  }
})
