import assert from "node:assert/strict"
import test from "node:test"
import {
  returningCheckoutFixture,
  LEAD_ID,
  ATTEMPT_ID,
  USER_ID,
  RESERVATION_ID,
} from "./helpers/returning-checkout-route-fixture"

for (const provider of ["stripe", "paypal"] as const) {
  test(`${provider}: expired signed-out customer can use old email paywall`, async () => {
    const fixture = returningCheckoutFixture({ signedOut: true })
    const response = await fixture.post(provider, {
      checkoutContext: undefined,
      leadId: LEAD_ID,
      source: "quiz_result_offer",
    })
    assert.equal(response.status, 200)
    assert.equal(fixture.state.acquireCalls, 0)
  })
  for (const access of [
    "active",
    "cancelled_current",
    "partner",
    "former_moderator_partner",
  ] as const) {
    test(`${provider}: ${access} blocks both checkout entry points before provider creation`, async () => {
      for (const signedOut of [false, true]) {
        const fixture = returningCheckoutFixture({ access, signedOut })
        const response = await fixture.post(
          provider,
          signedOut
            ? { checkoutContext: undefined, leadId: LEAD_ID, source: "quiz_result_offer" }
            : {},
        )
        assert.equal(response.status, 409)
        assert.equal(response.body.error, "checkout_access_already_exists")
        assert.equal(fixture.state.acquireCalls, 0)
        assert.equal(fixture.state.calls.length, 0)
        assert.equal(fixture.state.intent, null)
      }
    })
  }
  test(`${provider}: expired reactivation auth gets typed action with no provider work`, async () => {
    const fixture = returningCheckoutFixture({ signedOut: true })
    const response = await fixture.post(provider)
    assert.equal(response.status, 401)
    assert.equal(response.body.error, "reactivation_authentication_required")
    assert.equal(fixture.state.acquireCalls, 0)
  })
}

test("Stripe persists the refreshed authentication cookies on checkout", async () => {
  const fixture = returningCheckoutFixture()
  assert.equal((await fixture.post()).status, 200)
  assert.equal(fixture.state.cookies.length, 1)
})

test("Stripe replaces a customer only after account/price/mode preflight and freezes the login identity", async () => {
  const fixture = returningCheckoutFixture({
    customer: "cus_missing",
    customerError: {
      code: "resource_missing",
      param: "customer",
      type: "StripeInvalidRequestError",
    },
  })
  assert.equal((await fixture.post()).status, 200)
  assert.equal(fixture.state.customerReads, 1)
  assert.equal(fixture.state.calls[0].params.customer, undefined)
  assert.equal(fixture.state.calls[0].params.customer_email, "login@example.test")
  assert.match(fixture.state.calls[0].options.idempotencyKey, /:v2:initial$/)
  assert.equal(fixture.profile.stripe_customer_id, "cus_missing")
})

for (const customerError of [
  { code: "resource_missing", param: "price", type: "StripeInvalidRequestError" },
  { statusCode: 404 },
  { type: "StripeConnectionError" },
]) {
  test(`Stripe does not replace a customer on ${JSON.stringify(customerError)}`, async () => {
    const fixture = returningCheckoutFixture({ customerError })
    assert.equal((await fixture.post()).status, 409)
    assert.equal(fixture.state.calls.length, 0)
    assert.equal(fixture.state.acquireCalls, 0)
  })
}

test("Stripe refuses a mode mismatch before customer recovery or reservation acquisition", async () => {
  const fixture = returningCheckoutFixture({ priceMode: true })
  assert.equal((await fixture.post()).status, 409)
  assert.equal(fixture.state.customerReads, 0)
  assert.equal(fixture.state.acquireCalls, 0)
})

test("Stripe deletion after preflight persists recovery and retries the same key despite profile changes", async () => {
  const fixture = returningCheckoutFixture()
  const create = fixture.stripe.checkout.sessions.create
  fixture.stripe.checkout.sessions.create = async (params, options) => {
    if (params.customer) {
      fixture.state.calls.push({ params, options })
      throw { code: "resource_missing", param: "customer", type: "StripeInvalidRequestError" }
    }
    return create(params, options)
  }
  fixture.state.bindFailure = true
  const first = await fixture.post()
  assert.equal(first.status, 409)
  assert.equal(first.body.recovery.provider, "stripe")
  assert.equal(fixture.state.reservation?.status, "reconciliation_required")
  fixture.profile.stripe_customer_id = "cus_newer_profile_reference"
  fixture.state.bindFailure = false
  assert.equal(
    (await fixture.post("stripe", { checkoutAttemptId: "00000000-0000-4000-8000-000000000099" }))
      .status,
    200,
  )
  assert.equal(fixture.state.sessions.size, 1)
  const recoveryCalls = fixture.state.calls.filter((call) => !call.params.customer)
  assert.equal(recoveryCalls.length, 2)
  assert.deepEqual(recoveryCalls[0], recoveryCalls[1])
  assert.match(recoveryCalls[0].options.idempotencyKey, /:v2:missing-customer$/)
  assert.equal(recoveryCalls[0].params.metadata.checkout_attempt_id, ATTEMPT_ID)
})

test("Stripe lost response and concurrent retries converge on one session and prohibit PayPal", async () => {
  const fixture = returningCheckoutFixture({ bindFailure: true })
  const first = await fixture.post()
  assert.equal(first.status, 409)
  const conflict = await fixture.post("paypal")
  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.recovery.provider, "stripe")
  assert.equal(fixture.state.intent, null)
  fixture.state.bindFailure = false
  const responses = await Promise.all([fixture.post(), fixture.post()])
  assert.ok(responses.every((response) => response.status === 200))
  assert.equal(fixture.state.sessions.size, 1)
  assert.ok(
    fixture.state.calls.every(
      (call) => JSON.stringify(call) === JSON.stringify(fixture.state.calls[0]),
    ),
  )
})

test("Stripe creation boundary keeps unknown payment pending without another create", async () => {
  const fixture = returningCheckoutFixture({ bindFailure: true })
  await fixture.post()
  const context = fixture.state.reservation!.stripe_checkout_context
  context.expires_at = Math.floor(Date.now() / 1000) + 60
  context.initial_params.expires_at = context.expires_at
  const count = fixture.state.calls.length
  const response = await fixture.post("stripe", { recoveryOnly: true })
  assert.equal(response.status, 409)
  assert.equal(response.body.recovery.state, "pending")
  assert.equal(fixture.state.calls.length, count)
})

test("Status-only request never creates a reservation or provider object", async () => {
  for (const provider of ["stripe", "paypal"] as const) {
    const fixture = returningCheckoutFixture()
    assert.equal((await fixture.post(provider, { recoveryOnly: true })).status, 409)
    assert.equal(fixture.state.acquireCalls, 0)
    assert.equal(fixture.state.calls.length, 0)
    assert.equal(fixture.state.intent, null)
  }
})

test("PayPal issues SDK creation once; retries and simultaneous callers only get pending status", async () => {
  const fixture = returningCheckoutFixture()
  const replies = await Promise.all([fixture.post("paypal"), fixture.post("paypal")])
  assert.equal(replies.filter((reply) => reply.status === 200 && reply.body.token).length, 1)
  const retry = await fixture.post("paypal")
  assert.equal(retry.status, 409)
  assert.equal(retry.body.recovery.provider, "paypal")
  assert.equal(retry.body.recovery.state, "pending")
  assert.equal(retry.body.token, undefined)
})

test("PayPal known subscription routes to verified status without SDK creation", async () => {
  const fixture = returningCheckoutFixture()
  await fixture.post("paypal")
  fixture.state.intent!.provider_subscription_id = "I-fixture"
  const response = await fixture.post("paypal", { recoveryOnly: true })
  assert.equal(response.status, 200)
  assert.match(response.body.statusUrl, /^\/welcome\?provider=paypal&token=/)
  assert.equal(response.body.token, undefined)
})

test("Status-only does not claim an existing open unused reservation", async () => {
  for (const provider of ["stripe", "paypal"] as const) {
    const fixture = returningCheckoutFixture()
    fixture.state.reservation = {
      id: RESERVATION_ID,
      user_id: USER_ID,
      checkout_attempt_id: ATTEMPT_ID,
      provider: null,
      provider_reference: null,
      stripe_checkout_context: null,
      status: "open",
      interval: "month",
      return_destination: "/chat",
    }
    const before = structuredClone(fixture.state.reservation)
    assert.equal((await fixture.post(provider, { recoveryOnly: true })).status, 409)
    assert.deepEqual(fixture.state.reservation, before)
    assert.equal(fixture.state.acquireCalls, 0)
    assert.equal(fixture.state.calls.length, 0)
  }
})

test("Verified expired Stripe Session exposes safe explicit retry; unknown lookup stays pending", async () => {
  const fixture = returningCheckoutFixture()
  await fixture.post()
  const session = [...fixture.state.sessions.values()][0]
  session.status = "expired"
  const response = await fixture.post()
  assert.equal(response.status, 409)
  assert.equal(response.body.error, "reactivation_checkout_terminal")
  assert.equal(response.body.recovery.state, "not_started")
  assert.equal(response.body.recovery.provider, null)
  assert.equal(fixture.state.reservation?.status, "expired")

  const unknown = returningCheckoutFixture()
  await unknown.post()
  unknown.stripe.checkout.sessions.retrieve = async () => {
    throw { statusCode: 404 }
  }
  assert.equal((await unknown.post()).body.recovery.state, "pending")
  assert.notEqual(unknown.state.reservation?.status, "expired")
})

test("a signed-in retry adopts the server-owned return destination and attempt", async () => {
  const fixture = returningCheckoutFixture({ bindFailure: true })
  await fixture.post()
  fixture.state.bindFailure = false
  assert.equal(
    (
      await fixture.post("stripe", {
        returnDestination: "/routine",
        checkoutAttemptId: "00000000-0000-4000-8000-000000000098",
      })
    ).status,
    200,
  )
  const args = fixture.state.acquisitions.at(-1)!
  assert.equal(args.p_return_destination, "/chat")
  assert.equal(args.p_checkout_attempt_id, ATTEMPT_ID)
  assert.equal(fixture.state.sessions.size, 1)
})

test("PayPal rechecks newly granted access before issuing SDK creation", async () => {
  const fixture = returningCheckoutFixture({ grantAccessOnIntentCreation: true })
  const reply = await fixture.post("paypal")
  assert.equal(reply.status, 409)
  assert.equal(reply.body.error, "checkout_access_already_exists")
  assert.equal(fixture.state.intent?.metadata.reactivation_client_creation_issued_at, undefined)
})
