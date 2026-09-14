import assert from "node:assert/strict"
import { test } from "node:test"
import type Stripe from "stripe"
import {
  buildStripeCheckoutContext,
  canCreateStripeReactivationCheckout,
  getStripeReactivationCheckoutRequest,
  parseStripeCheckoutContext,
} from "../src/lib/reactivation/stripe-checkout-context"
import {
  MembershipReactivationCheckoutConflictError,
  prepareMembershipReactivationStripeCheckout,
  recoverMembershipReactivationStripeCheckout,
  markMembershipReactivationReconciliationRequired,
} from "../src/lib/reactivation/checkout-reservations"

const NOW = 1_800_000_000
const RESERVATION = "00000000-0000-4000-8000-000000000003"
const USER = "00000000-0000-4000-8000-000000000001"
function params(): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: "cus_stale",
    line_items: [{ price: "price_month", quantity: 1 }],
    metadata: {
      checkout_context: "membership_reactivation",
      reactivation_reservation_id: RESERVATION,
      checkout_attempt_id: "attempt-first",
    },
    return_url: "https://example.test/welcome?session_id={CHECKOUT_SESSION_ID}",
  }
}
function input() {
  return {
    stripeAccountId: "acct_verified",
    livemode: true,
    userId: USER,
    accountEmail: "owner@example.test",
    profileCustomerId: "cus_stale",
    initialParams: params(),
    reservationExpiresAt: new Date((NOW + 86400) * 1000).toISOString(),
    nowSeconds: NOW,
  }
}
const row = (context = buildStripeCheckoutContext(input())) => ({
  id: RESERVATION,
  user_id: USER,
  provider: "stripe",
  status: "reconciliation_required",
  provider_reference: null,
  stripe_checkout_context: context,
})

test("provider retries retain original request despite mutable profile/caller objects and use fixed keys", () => {
  const candidate = input()
  const context = buildStripeCheckoutContext(candidate)
  candidate.initialParams.customer = "cus_other"
  candidate.initialParams.metadata!.checkout_attempt_id = "attempt-second"
  assert.equal(context.initial_params.customer, "cus_stale")
  const request = getStripeReactivationCheckoutRequest(RESERVATION, context)
  assert.equal(request.idempotencyKey, `membership-reactivation:${RESERVATION}:v2:initial`)
  assert.equal(request.params.expires_at, NOW + 86400)
  assert.equal(request.params.metadata!.checkout_attempt_id, "attempt-first")
  request.params.customer = "cus_mutated"
  assert.equal(
    getStripeReactivationCheckoutRequest(RESERVATION, context).params.customer,
    "cus_stale",
  )
  assert.throws(() => getStripeReactivationCheckoutRequest("other", context), /context mismatch/)
})

test("persisted recovery always wins and only frozen email may replace the missing customer", () => {
  const context = buildStripeCheckoutContext(input())
  const { customer: _customer, ...rest } = context.initial_params
  context.recovery_params = { ...rest, customer_email: "owner@example.test" }
  const request = getStripeReactivationCheckoutRequest(RESERVATION, context)
  assert.equal(request.idempotencyKey, `membership-reactivation:${RESERVATION}:v2:missing-customer`)
  assert.equal(request.params.customer, undefined)
  assert.equal(request.params.customer_email, "owner@example.test")
  for (const recovery of [
    { ...rest, customer_email: "billing@example.test" },
    { ...rest, customer_email: "owner@example.test", expires_at: NOW + 86401 },
    {
      ...rest,
      customer_email: "owner@example.test",
      line_items: [{ price: "price_other", quantity: 1 }],
    },
  ])
    assert.throws(
      () => parseStripeCheckoutContext({ ...context, recovery_params: recovery }),
      /recovery request invalid/,
    )
})

test("creation boundary never rolls expiry or creates beyond idempotency retention; known-session retrieval stays caller-owned", () => {
  const context = buildStripeCheckoutContext(input())
  assert.equal(canCreateStripeReactivationCheckout(context, NOW + 84600), true)
  assert.equal(canCreateStripeReactivationCheckout(context, NOW + 84601), false)
  assert.equal(canCreateStripeReactivationCheckout(context, NOW + 172800), false)
  for (const delta of [1799, 86401]) {
    assert.throws(
      () =>
        buildStripeCheckoutContext({
          ...input(),
          reservationExpiresAt: new Date((NOW + delta) * 1000).toISOString(),
        }),
      /creation window unavailable/,
    )
  }
})

test("context refuses malformed identity, mixed customer/email and payment detail fields", () => {
  const context = buildStripeCheckoutContext(input())
  for (const candidate of [
    { ...context, version: 2 },
    { ...context, stripe_account_id: "" },
    { ...context, livemode: "true" },
    { ...context, profile_customer_id: "cus_other" },
    { ...context, account_email: "" },
    { ...context, client_secret: "never persist" },
    {
      ...context,
      initial_params: { ...context.initial_params, customer_email: context.account_email },
    },
    {
      ...context,
      initial_params: { ...context.initial_params, payment_method_data: { type: "card" } },
    },
  ])
    assert.throws(() => parseStripeCheckoutContext(candidate), /reactivation checkout/)
})

test("prepare uses returned persisted context rather than submitted candidate; conflicts remain typed", async () => {
  const persisted = buildStripeCheckoutContext(input())
  const candidate = buildStripeCheckoutContext({
    ...input(),
    accountEmail: "later@example.test",
    profileCustomerId: "cus_other",
    initialParams: { ...params(), customer: "cus_other" },
  })
  const calls: unknown[] = []
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args])
      return { data: row(persisted), error: null }
    },
  } as unknown as Parameters<typeof prepareMembershipReactivationStripeCheckout>[0]
  const result = await prepareMembershipReactivationStripeCheckout(client, {
    reservationId: RESERVATION,
    userId: USER,
    context: candidate,
  })
  assert.deepEqual(result.stripe_checkout_context, persisted)
  assert.deepEqual(calls, [
    [
      "prepare_membership_reactivation_stripe_checkout",
      { p_reservation_id: RESERVATION, p_user_id: USER, p_context: candidate },
    ],
  ])
  const rejected = {
    rpc: async () => ({ data: null, error: { code: "P0001", message: "conflict" } }),
  } as unknown as typeof client
  await assert.rejects(
    prepareMembershipReactivationStripeCheckout(rejected, {
      reservationId: RESERVATION,
      userId: USER,
      context: candidate,
    }),
    MembershipReactivationCheckoutConflictError,
  )
  await assert.rejects(
    prepareMembershipReactivationStripeCheckout(client, {
      reservationId: RESERVATION,
      userId: "other",
      context: candidate,
    }),
    MembershipReactivationCheckoutConflictError,
  )
})

test("recover only transmits verified identity; malformed or relinked database response never reaches provider", async () => {
  const calls: unknown[] = []
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args])
      return { data: [row()], error: null }
    },
  } as unknown as Parameters<typeof recoverMembershipReactivationStripeCheckout>[0]
  await recoverMembershipReactivationStripeCheckout(client, {
    reservationId: RESERVATION,
    userId: USER,
    stripeAccountId: "acct_verified",
    livemode: true,
    originalCustomerId: "cus_stale",
  })
  assert.deepEqual(calls, [
    [
      "recover_membership_reactivation_stripe_checkout",
      {
        p_reservation_id: RESERVATION,
        p_user_id: USER,
        p_stripe_account_id: "acct_verified",
        p_livemode: true,
        p_original_customer_id: "cus_stale",
      },
    ],
  ])
  const bad = {
    rpc: async () => ({ data: { ...row(), user_id: "other" }, error: null }),
  } as unknown as typeof client
  await assert.rejects(
    recoverMembershipReactivationStripeCheckout(bad, {
      reservationId: RESERVATION,
      userId: USER,
      stripeAccountId: "acct_verified",
      livemode: true,
      originalCustomerId: "cus_stale",
    }),
    /context mismatch/,
  )
})

test("a late reconciliation failure cannot reopen a completed payment", async () => {
  const state = { status: "completed" }
  const client = {
    from: () => ({
      update: (values: { status: string }) => ({
        eq: () => ({
          // Resolve update only after all filters, as PostgREST does.
          in: async (_column: string, statuses: string[]) => {
            if (statuses.includes(state.status)) state.status = values.status
            return { error: null }
          },
          then: (resolve: (value: unknown) => void) => {
            state.status = values.status
            resolve({ error: null })
          },
        }),
      }),
    }),
  } as unknown as Parameters<typeof markMembershipReactivationReconciliationRequired>[0]
  await markMembershipReactivationReconciliationRequired(client, RESERVATION)
  assert.equal(state.status, "completed")
})
