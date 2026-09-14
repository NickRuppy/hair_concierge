import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  retrieveVerifiedStripeTrialAuthorization,
  type StripeTrialAuthorizationClient,
  verifyStripeTrialAuthorization,
} from "../src/lib/stripe/trial-authorization"

const ENROLLMENT_ID = "892ae2a0-4a3c-45db-bf22-2f38c3bf0e49"
const CUSTOMER_ID = "cus_trial_customer"
const SUBSCRIPTION_ID = "sub_trial_agreement"
const PAYMENT_METHOD_ID = "pm_trial_card"
const SETUP_INTENT_ID = "seti_trial_card"
const DISCOUNT_ID = "di_annual_intro"
const TRIAL_START = Math.floor(Date.parse("2026-09-13T12:00:00.000Z") / 1000)
const TRIAL_END = TRIAL_START + 7 * 24 * 60 * 60
const NOW = new Date("2026-09-16T12:00:00.000Z")
const OFFER = createTrialOfferSnapshot("year", {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_once",
})

function fixtures(
  overrides: {
    session?: Record<string, unknown>
    subscription?: Record<string, unknown>
    paymentMethod?: Record<string, unknown>
    pendingSetupIntent?: Stripe.SetupIntent | null
    subscriptionDiscount?: Stripe.Discount | null
    coupon?: Stripe.Coupon | null
  } = {},
) {
  const session = {
    id: "cs_trial",
    mode: "subscription",
    status: "complete",
    payment_status: "no_payment_required",
    amount_total: 0,
    livemode: false,
    customer: CUSTOMER_ID,
    subscription: SUBSCRIPTION_ID,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: ENROLLMENT_ID },
    ...overrides.session,
  } as unknown as Stripe.Checkout.Session
  const subscription = {
    id: SUBSCRIPTION_ID,
    status: "trialing",
    livemode: false,
    customer: CUSTOMER_ID,
    default_payment_method: PAYMENT_METHOD_ID,
    billing_mode: { type: "flexible" },
    pending_setup_intent: null,
    trial_start: TRIAL_START,
    trial_end: TRIAL_END,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: ENROLLMENT_ID },
    discounts: [DISCOUNT_ID],
    items: {
      data: [
        {
          quantity: 1,
          discounts: [],
          price: {
            id: OFFER.stripePriceId,
            active: true,
            currency: "eur",
            unit_amount: OFFER.renewalAmountMinor,
            tax_behavior: "inclusive",
            product: "prod_year",
            recurring: { interval: OFFER.interval, interval_count: 1 },
          },
        },
      ],
    },
    ...overrides.subscription,
  } as unknown as Stripe.Subscription
  const paymentMethod = {
    id: PAYMENT_METHOD_ID,
    type: "card",
    livemode: false,
    customer: CUSTOMER_ID,
    card: { fingerprint: "fp_server_only" },
    ...overrides.paymentMethod,
  } as unknown as Stripe.PaymentMethod
  const subscriptionDiscount =
    overrides.subscriptionDiscount ??
    ({
      id: DISCOUNT_ID,
      customer: CUSTOMER_ID,
      subscription: SUBSCRIPTION_ID,
      subscription_item: null,
      invoice: null,
      checkout_session: null,
      source: { type: "coupon", coupon: OFFER.stripeCouponId },
    } as unknown as Stripe.Discount)
  const coupon =
    overrides.coupon ??
    ({
      id: OFFER.stripeCouponId,
      livemode: false,
      duration: "once",
      valid: true,
      amount_off: 3000,
      currency: "eur",
      percent_off: null,
      applies_to: { products: ["prod_year"] },
    } as Stripe.Coupon)
  if (subscription.discounts[0] === DISCOUNT_ID) subscription.discounts = [subscriptionDiscount]
  return {
    session,
    subscription,
    paymentMethod,
    pendingSetupIntent: overrides.pendingSetupIntent ?? null,
    subscriptionDiscount,
    coupon,
  }
}

function verify(overrides: Parameters<typeof fixtures>[0] = {}) {
  return verifyStripeTrialAuthorization({
    ...fixtures(overrides),
    expected: { enrollmentId: ENROLLMENT_ID, offer: OFFER },
    now: NOW,
    expectedLivemode: false,
  })
}

function retrievalClient(values = fixtures()) {
  const calls: Array<{ resource: string; id: string; expand?: readonly string[] }> = []
  return {
    calls,
    client: {
      checkout: {
        sessions: {
          retrieve: async (id: string, options?: { expand?: readonly string[] }) => {
            calls.push({ resource: "session", id, expand: options?.expand })
            return values.session
          },
        },
      },
      subscriptions: {
        retrieve: async (id: string, options?: { expand?: readonly string[] }) => {
          calls.push({ resource: "subscription", id, expand: options?.expand })
          return values.subscription
        },
      },
      paymentMethods: {
        retrieve: async (id: string) => {
          calls.push({ resource: "payment_method", id })
          return values.paymentMethod
        },
      },
      setupIntents: {
        retrieve: async (id: string) => {
          calls.push({ resource: "setup_intent", id })
          return values.pendingSetupIntent
        },
      },
      coupons: {
        retrieve: async (id: string, options?: { expand?: readonly string[] }) => {
          calls.push({ resource: "coupon", id, expand: options?.expand })
          if (!values.coupon || options?.expand?.includes("applies_to")) return values.coupon
          const { applies_to: _appliesTo, ...unexpandedCoupon } = values.coupon
          return unexpandedCoupon
        },
      },
    } as unknown as StripeTrialAuthorizationClient,
  }
}

test("verifies a server-retrieved seven-day card trial and records later invoice proof obligations", () => {
  assert.deepEqual(verify(), {
    enrollmentId: ENROLLMENT_ID,
    providerAgreementId: SUBSCRIPTION_ID,
    authorizationSucceededAt: "2026-09-13T12:00:00.000Z",
    trialEndAt: "2026-09-20T12:00:00.000Z",
    customerId: CUSTOMER_ID,
    paymentMethodId: PAYMENT_METHOD_ID,
    cardFingerprint: "fp_server_only",
    unverifiedFutureInvoiceObligations: [
      "verify_first_paid_invoice_amount",
      "verify_renewal_invoice_amount",
    ],
  })
})

test("requires Stripe's exact seven-day provider interval and the current time to remain inside it", () => {
  assert.equal(verify({ subscription: { trial_end: TRIAL_END - 1 } }), null)
  assert.equal(verify({ subscription: { trial_start: TRIAL_START + 1 } }), null)
  const outside = fixtures()
  assert.equal(
    verifyStripeTrialAuthorization({
      ...outside,
      expected: { enrollmentId: ENROLLMENT_ID, offer: OFFER },
      now: new Date("2026-09-20T12:00:00.000Z"),
      expectedLivemode: false,
    }),
    null,
  )
})

test("rejects untrusted completion, binding, identity, price, or saved-card mismatches", () => {
  for (const invalid of [
    { session: { payment_status: "unpaid" } },
    { session: { payment_status: "paid", amount_total: 1 } },
    { session: { payment_status: "paid", status: "open" } },
    { session: { payment_status: "paid" }, subscription: { status: "active" } },
    { session: { metadata: { trial_cohort: "trial_v1", trial_enrollment_id: "other" } } },
    { subscription: { customer: "cus_other" } },
    { subscription: { metadata: { trial_cohort: "trial_v1", trial_enrollment_id: "other" } } },
    { subscription: { items: { data: [{ quantity: 1, price: { id: "price_other" } }] } } },
    { paymentMethod: { customer: "cus_other" } },
    { paymentMethod: { card: { fingerprint: "" } } },
    { subscription: { default_payment_method: "pm_other" } },
  ]) {
    assert.equal(verify(invalid), null)
  }
})

test("accepts Stripe's paid status for a completed zero-total checkout with a verified trial", async () => {
  const values = fixtures({ session: { payment_status: "paid" } })
  const { client } = retrievalClient(values)
  const proof = await retrieveVerifiedStripeTrialAuthorization(
    client,
    values.session.id,
    { enrollmentId: ENROLLMENT_ID, offer: OFFER },
    NOW,
    false,
  )
  assert.equal(proof?.enrollmentId, ENROLLMENT_ID)
  assert.equal(proof?.trialEndAt, "2026-09-20T12:00:00.000Z")
  assert.deepEqual(proof?.unverifiedFutureInvoiceObligations, [
    "verify_first_paid_invoice_amount",
    "verify_renewal_invoice_amount",
  ])
})

test("accepts no pending setup intent with a saved card, but requires any present intent to succeed and bind", () => {
  assert.notEqual(verify(), null)
  const succeeded = {
    id: SETUP_INTENT_ID,
    status: "succeeded",
    livemode: false,
    customer: CUSTOMER_ID,
    payment_method: PAYMENT_METHOD_ID,
  } as unknown as Stripe.SetupIntent
  assert.notEqual(
    verify({
      subscription: { pending_setup_intent: SETUP_INTENT_ID },
      pendingSetupIntent: succeeded,
    }),
    null,
  )
  for (const pendingSetupIntent of [
    { ...succeeded, status: "requires_action" },
    { ...succeeded, status: "processing" },
    { ...succeeded, status: "canceled" },
    { ...succeeded, payment_method: "pm_other" },
  ] as Stripe.SetupIntent[]) {
    assert.equal(
      verify({ subscription: { pending_setup_intent: SETUP_INTENT_ID }, pendingSetupIntent }),
      null,
    )
  }
})

test("requires flexible billing and the expected Stripe mode on every retrieved authority object", () => {
  assert.equal(verify({ subscription: { billing_mode: { type: "classic" } } }), null)
  assert.equal(verify({ session: { livemode: true } }), null)
  assert.equal(verify({ subscription: { livemode: true } }), null)
  assert.equal(verify({ paymentMethod: { livemode: true } }), null)
})

test("requires the accepted once coupon on annual introductory terms and no discount on monthly terms", () => {
  assert.equal(
    verify({ subscription: { discounts: [] }, subscriptionDiscount: null, coupon: null }),
    null,
  )
  assert.equal(verify({ coupon: { ...fixtures().coupon!, duration: "forever" } }), null)
  assert.equal(verify({ coupon: { ...fixtures().coupon!, id: "coupon_other" } }), null)

  const annualWithoutIntro = createTrialOfferSnapshot("year", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: null,
  })
  const annualWithUnexpectedDiscount = fixtures()
  assert.equal(
    verifyStripeTrialAuthorization({
      ...annualWithUnexpectedDiscount,
      expected: { enrollmentId: ENROLLMENT_ID, offer: annualWithoutIntro },
      now: NOW,
      expectedLivemode: false,
    }),
    null,
  )

  const monthOffer = createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_once",
  })
  const monthly = fixtures({
    subscription: {
      items: {
        data: [
          {
            quantity: 1,
            discounts: [],
            price: {
              id: monthOffer.stripePriceId,
              active: true,
              currency: "eur",
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      },
    },
  })
  assert.equal(
    verifyStripeTrialAuthorization({
      ...monthly,
      expected: { enrollmentId: ENROLLMENT_ID, offer: monthOffer },
      now: NOW,
      expectedLivemode: false,
    }),
    null,
  )
})

test("requires immutable provider terms while allowing an already-attached Price or Coupon to retire", () => {
  for (const invalid of [
    {
      subscription: {
        items: {
          data: [
            {
              ...fixtures().subscription.items.data[0],
              price: { ...fixtures().subscription.items.data[0].price, unit_amount: 6999 },
            },
          ],
        },
      },
    },
    {
      subscription: {
        items: {
          data: [
            {
              ...fixtures().subscription.items.data[0],
              price: { ...fixtures().subscription.items.data[0].price, tax_behavior: "exclusive" },
            },
          ],
        },
      },
    },
    { coupon: { ...fixtures().coupon!, amount_off: 2999 } },
    { coupon: { ...fixtures().coupon!, currency: "usd" } },
    { coupon: { ...fixtures().coupon!, percent_off: 30 } },
    { coupon: { ...fixtures().coupon!, applies_to: { products: ["prod_other"] } } },
  ]) {
    assert.equal(verify(invalid), null)
  }

  assert.notEqual(
    verify({
      subscription: {
        items: {
          data: [
            {
              quantity: 1,
              discounts: [],
              price: { ...fixtures().subscription.items.data[0].price, active: false },
            },
          ],
        },
      },
      coupon: { ...fixtures().coupon!, valid: false },
    }),
    null,
  )
})

test("retrieves provider authorities itself before returning verified trial facts", async () => {
  const { client, calls } = retrievalClient()
  const authorization = await retrieveVerifiedStripeTrialAuthorization(
    client,
    "cs_trial",
    { enrollmentId: ENROLLMENT_ID, offer: OFFER },
    NOW,
    false,
  )
  assert.equal(authorization?.providerAgreementId, SUBSCRIPTION_ID)
  assert.deepEqual(
    calls.map(({ resource, id }) => [resource, id]),
    [
      ["session", "cs_trial"],
      ["subscription", SUBSCRIPTION_ID],
      ["payment_method", PAYMENT_METHOD_ID],
      ["coupon", OFFER.stripeCouponId],
    ],
  )
  assert.ok(calls[1].expand?.includes("discounts"))
  assert.deepEqual(calls.find(({ resource }) => resource === "coupon")?.expand, ["applies_to"])
})

test("retrieval adapter fails closed for cross-customer and unresolved setup authorities", async () => {
  for (const values of [
    fixtures({ session: { customer: "cus_other" } }),
    fixtures({
      subscription: { pending_setup_intent: SETUP_INTENT_ID },
      pendingSetupIntent: {
        id: SETUP_INTENT_ID,
        status: "requires_action",
        livemode: false,
        customer: CUSTOMER_ID,
        payment_method: PAYMENT_METHOD_ID,
      } as unknown as Stripe.SetupIntent,
    }),
  ]) {
    const { client } = retrievalClient(values)
    assert.equal(
      await retrieveVerifiedStripeTrialAuthorization(
        client,
        "cs_trial",
        { enrollmentId: ENROLLMENT_ID, offer: OFFER },
        NOW,
        false,
      ),
      null,
    )
  }
})

test("a provider outage remains retryable instead of becoming an authorization denial", async () => {
  const { client } = retrievalClient()
  const unavailable = new Error("provider read unavailable")
  client.checkout.sessions.retrieve = (async () => {
    throw unavailable
  }) as typeof client.checkout.sessions.retrieve
  await assert.rejects(
    () =>
      retrieveVerifiedStripeTrialAuthorization(
        client,
        "cs_trial",
        { enrollmentId: ENROLLMENT_ID, offer: OFFER },
        NOW,
        false,
      ),
    (error) => error === unavailable,
  )
})
