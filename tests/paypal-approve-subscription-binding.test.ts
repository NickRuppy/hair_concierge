import assert from "node:assert/strict"
import test from "node:test"
import { bindNewPayPalAgreementForApproval } from "../src/app/api/paypal/approve-subscription/route"
import type { PayPalCheckoutIntentRow } from "../src/lib/paypal/checkout-intents"

process.env.PAYPAL_PLAN_ID_MONTHLY ??= "P-paid-month"

function intent(planId: unknown): PayPalCheckoutIntentRow {
  return {
    id: "intent-1",
    token: "token-1234567890123456",
    interval: "month",
    source: "pricing_page",
    lead_id: null,
    email: "buyer@example.com",
    user_id: null,
    reactivation_reservation_id: null,
    provider_subscription_id: null,
    status: "approved",
    duplicate_reason: null,
    expires_at: "2030-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    metadata: { paypal_plan_id: planId },
  }
}

test("approval rejects a mismatched new plan before any intent binding", async () => {
  const previous = process.env.PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY
  process.env.PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY = "P-other-month"
  let bindCalls = 0
  try {
    const result = await bindNewPayPalAgreementForApproval({
      intent: intent("P-other-month"),
      subscription: {
        id: "I-new",
        plan_id: "P-paid-month",
        subscriber: { email_address: "provider@example.com" },
      },
      bind: async () => {
        bindCalls += 1
        throw new Error("binding must not run")
      },
    })

    assert.equal(result.kind, "invalid_plan")
    if (result.kind !== "invalid_plan") throw new Error("expected approval plan rejection")
    assert.equal(result.response.status, 400)
    assert.deepEqual(await result.response.json(), { error: "paypal subscription plan mismatch" })
    assert.equal(bindCalls, 0)
  } finally {
    if (previous === undefined) delete process.env.PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY
    else process.env.PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY = previous
  }
})

test("approval rejects a malformed stored plan pin before an already-bound retry can continue", async () => {
  let bindCalls = 0
  const sourceIntent = {
    ...intent(["P-paid-month"]),
    provider_subscription_id: "I-new",
  }
  const result = await bindNewPayPalAgreementForApproval({
    intent: sourceIntent,
    subscription: { id: "I-new", plan_id: "P-paid-month" },
    bind: async () => {
      bindCalls += 1
      throw new Error("binding must not run")
    },
  })

  assert.equal(result.kind, "invalid_plan")
  if (result.kind !== "invalid_plan") throw new Error("expected approval plan rejection")
  assert.equal(result.response.status, 400)
  assert.equal(bindCalls, 0)
})

test("approval binds a valid recognized legacy paid plan", async () => {
  let bindCalls = 0
  const sourceIntent = intent("P-paid-month")
  const result = await bindNewPayPalAgreementForApproval({
    intent: sourceIntent,
    subscription: {
      id: "I-new",
      plan_id: "P-paid-month",
      subscriber: { email_address: "provider@example.com" },
    },
    bind: async (email) => {
      bindCalls += 1
      assert.equal(email, "provider@example.com")
      return { ...sourceIntent, provider_subscription_id: "I-new" }
    },
  })

  assert.equal(result.kind, "bound")
  assert.equal(bindCalls, 1)
})
