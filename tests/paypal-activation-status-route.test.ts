import assert from "node:assert/strict"
import test from "node:test"
import { handlePayPalActivationStatus } from "../src/app/api/paypal/activation-status/route"

test("PayPal activation polling returns terminal recovery code without an email", async () => {
  const response = await handlePayPalActivationStatus(
    new Request("https://hair.example/api/paypal/activation-status?token=owned-token"),
    {
      createAdminClient: () => ({}) as never,
      getPremiumTierId: async () => "premium-tier",
      linkQuizToProfile: async () => undefined,
      ensurePayPalCheckoutAccountForToken: async () => ({
        status: "duplicate",
        recoveryCode: "trial_checkout_conflict",
      }),
    },
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    status: "recovery",
    code: "trial_checkout_conflict",
    error:
      "Fahre in deiner zuvor geöffneten Anmeldung fort. Du findest sie nicht mehr? Kontaktiere unseren Support.",
  })
})

test("polling distinguishes invalid proof, reconciliation, transient failure and pending", async () => {
  const request = new Request("https://hair.example/api/paypal/activation-status?token=owned-token")
  const base = {
    createAdminClient: () => ({}) as never,
    getPremiumTierId: async () => "premium-tier",
    linkQuizToProfile: async () => undefined,
  }
  for (const [providerCode, expectedCode, status] of [
    ["paypal_checkout_intent_expired", "activation_link_invalid", 400],
    ["paypal_subscription_plan_mismatch", "trial_reconciliation_required", 503],
    ["paypal_subscription_inactive", "trial_reconciliation_required", 503],
  ] as const) {
    const response = await handlePayPalActivationStatus(request, {
      ...base,
      ensurePayPalCheckoutAccountForToken: async () => {
        throw Object.assign(new Error("private details"), { code: providerCode })
      },
    })
    const body = await response.json()
    assert.equal(response.status, status)
    assert.equal(body.code, expectedCode)
    assert.equal(body.email, undefined)
    assert.ok(!JSON.stringify(body).includes("private details"))
  }
  const pending = await handlePayPalActivationStatus(request, {
    ...base,
    ensurePayPalCheckoutAccountForToken: async () => ({ status: "pending" }),
  })
  assert.deepEqual(await pending.json(), { status: "pending" })
  const unknown = await handlePayPalActivationStatus(request, {
    ...base,
    ensurePayPalCheckoutAccountForToken: async () => {
      throw new Error("private transport details")
    },
  })
  assert.equal(unknown.status, 500)
  assert.ok(!JSON.stringify(await unknown.json()).includes("private transport details"))
})
