import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import type { TrialManagementOperation } from "../src/lib/billing/trial-management-operations"
import {
  reconcileStripeTrialManagement,
  requestStripePaidCancellation,
} from "../src/lib/stripe/trial-management"

function fixture(
  source: "month" | "year" = "month",
  target: "month" | "year" = "year",
  kind: "switch" | "restore" = "switch",
) {
  const runtime: TrialRuntime = {
    stripeAccountId: "acct_1",
    livemode: true,
    identityKeys: [],
    enrollmentMode: "disabled",
    allowedEmails: [],
    catalog: { monthPriceId: "price_month", yearPriceId: "price_year", annualCouponId: "coupon" },
  }
  const offers = {
    month: createTrialOfferSnapshot("month", runtime.catalog),
    year: createTrialOfferSnapshot("year", runtime.catalog),
  }
  const op: TrialManagementOperation = {
    id: "op_1",
    enrollmentId: "enr_1",
    userId: "user_1",
    kind,
    status: "pending",
    expectedRevision: 0,
    cancellationVersion: 1,
    provider: "stripe",
    providerCustomerId: "cus_1",
    originalAgreementId: "sub_1",
    sourceAgreementId: "sub_1",
    originalTrialEndAt: "2099-01-08T12:00:00Z",
    sourceOffer: offers[source],
    targetOffer: offers[target],
    cancelAtPeriodEnd: false,
    targetAgreementId: null,
  }
  const deadline = Date.parse(op.originalTrialEndAt) / 1000
  const price = (interval: "month" | "year") => ({
    id: offers[interval].stripePriceId,
    product: "prod_1",
    currency: "eur",
    tax_behavior: "inclusive",
    unit_amount: offers[interval].renewalAmountMinor,
    recurring: { interval, interval_count: 1 },
  })
  const discount = {
    id: "di_1",
    source: { coupon: "coupon" },
    subscription: "sub_1",
    customer: "cus_1",
    subscription_item: null,
  }
  const subscription = {
    id: "sub_1",
    customer: "cus_1",
    status: "trialing",
    livemode: true,
    billing_mode: { type: "flexible" },
    automatic_tax: { enabled: true },
    schedule: null,
    pending_update: null,
    pause_collection: null,
    transfer_data: null,
    on_behalf_of: null,
    collection_method: "charge_automatically",
    trial_end: deadline,
    billing_cycle_anchor: deadline,
    cancel_at: kind === "restore" ? deadline : (null as number | null),
    cancel_at_period_end: kind === "restore",
    metadata: { trial_enrollment_id: "enr_1", trial_cohort: "trial_v1" } as Record<string, string>,
    discounts: source === "year" ? [discount] : [],
    items: {
      has_more: false,
      data: [
        {
          id: "si_1",
          quantity: 1,
          discounts: [],
          current_period_end: deadline,
          price: price(source),
        },
      ],
    },
  }
  const state = {
    guard: true,
    commit: true,
    loseUpdate: false,
    merchant: "acct_1",
    preview: null as number | null,
  }
  const updates: Array<Stripe.SubscriptionUpdateParams> = []
  let commits = 0
  const client = {
    rpc: async (name: string) => {
      if (name === "load_stripe_trial_management_approval") return { data: null, error: null }
      if (name === "load_trial_management_operation") return { data: op, error: null }
      if (name === "guard_trial_management_operation") return { data: state.guard, error: null }
      if (name === "commit_trial_management_operation") {
        commits++
        if (!state.commit) state.guard = false
        return { data: state.commit, error: null }
      }
      if (name === "abandon_trial_management_operation") return { data: true, error: null }
      throw new Error(name)
    },
  }
  const stripe = {
    accounts: { retrieve: async () => ({ id: state.merchant }) },
    customers: { retrieve: async () => ({ id: "cus_1", deleted: false, discount: null }) },
    prices: { retrieve: async () => price(target) },
    coupons: {
      retrieve: async () => ({
        valid: true,
        livemode: true,
        amount_off: 3000,
        percent_off: null,
        currency: "eur",
        duration: "once",
        applies_to: { products: ["prod_1"] },
      }),
    },
    subscriptions: {
      retrieve: async () => subscription,
      update: async (_id: string, args: Stripe.SubscriptionUpdateParams) => {
        updates.push(args)
        if (args.items)
          subscription.items.data[0].price = price(
            args.items[0].price === "price_month" ? "month" : "year",
          )
        if (args.discounts !== undefined)
          subscription.discounts = args.discounts === "" ? [] : [discount]
        if (args.cancel_at !== undefined)
          subscription.cancel_at = args.cancel_at === "" ? null : Number(args.cancel_at)
        if (args.cancel_at_period_end !== undefined)
          subscription.cancel_at_period_end = args.cancel_at_period_end
        if (args.metadata) Object.assign(subscription.metadata, args.metadata)
        if (state.loseUpdate) {
          state.loseUpdate = false
          throw new Error("response lost")
        }
        return subscription
      },
    },
    invoices: {
      list: async () => ({
        has_more: false,
        data: [{ amount_paid: 0, amount_due: 0, amount_remaining: 0, status: "paid" }],
      }),
      createPreview: async () => ({
        currency: "eur",
        amount_due: state.preview ?? offers[target].firstAmountMinor,
        total: state.preview ?? offers[target].firstAmountMinor,
      }),
    },
  }
  const run = () =>
    reconcileStripeTrialManagement({
      operationId: op.id,
      authenticatedUserId: op.userId,
      client,
      stripe: stripe as unknown as Stripe,
      runtime,
    })
  return { run, op, state, subscription, updates, deadline, commits: () => commits }
}

for (const [source, target] of [
  ["month", "year"],
  ["year", "month"],
] as const) {
  test(`Stripe ${source} to ${target} switch preserves deadline and first-payment coupon without immediate billing`, async () => {
    const f = fixture(source, target)
    assert.equal((await f.run()).status, "committed")
    assert.equal(f.subscription.trial_end, Date.parse("2099-01-08T12:00:00Z") / 1000)
    assert.equal(f.updates[0].billing_cycle_anchor, "unchanged")
    assert.equal(f.updates[0].proration_behavior, "none")
    assert.equal(f.updates[0].trial_end, undefined)
    assert.equal(f.updates[0].trial_from_plan, undefined)
    assert.deepEqual(f.updates[0].discounts, target === "year" ? [{ coupon: "coupon" }] : "")
  })
}
test("restore clears both Stripe cancellation forms and leaves the original deadline", async () => {
  const f = fixture("month", "month", "restore")
  assert.equal((await f.run()).status, "committed")
  assert.equal(f.subscription.cancel_at, null)
  assert.equal(f.subscription.cancel_at_period_end, false)
  assert.equal(f.subscription.trial_end, f.deadline)
  assert.equal(f.updates[0].items, undefined)
})
test("fully canceled Stripe source needs fresh hosted approval and cannot silently become collectible", async () => {
  const f = fixture("month", "month", "restore")
  f.subscription.status = "canceled"
  assert.equal((await f.run()).status, "requires_approval")
  assert.equal(f.updates.length, 0)
})
test("lost update response is read back and committed without reapplying the discount", async () => {
  const f = fixture()
  f.state.loseUpdate = true
  assert.equal((await f.run()).status, "pending")
  assert.equal((await f.run()).status, "committed")
  assert.equal(f.updates.length, 1)
})
test("a newer cancellation prevents commit and leaves the original deadline noncollectible", async () => {
  const f = fixture()
  f.state.commit = false
  f.state.guard = true
  assert.equal((await f.run()).status, "abandoned")
  assert.equal(f.subscription.cancel_at, f.deadline)
  assert.equal(f.subscription.items.data[0].price.id, "price_month")
  assert.equal(f.updates.at(-1)?.proration_behavior, "none")
})
test("wrong future total rolls back to the existing offer and reports an abandoned change", async () => {
  const f = fixture()
  f.state.preview = 99999
  assert.equal((await f.run()).status, "abandoned")
  assert.equal(f.subscription.items.data[0].price.id, "price_month")
  assert.equal(f.subscription.cancel_at, null)
  assert.equal(f.commits(), 0)
})
for (const reason of ["guard", "merchant", "paid"] as const) {
  test(`${reason} prevents changes to a trial operation`, async () => {
    const f = fixture()
    if (reason === "guard") f.state.guard = false
    if (reason === "merchant") f.state.merchant = "acct_other"
    if (reason === "paid") f.subscription.status = "active"
    assert.equal((await f.run()).status, "pending")
    assert.equal(f.updates.length, 0)
  })
}

test("paid cancellation persists before provider work and cancels only the owned successor at paidThrough", async () => {
  const calls: string[] = []
  const through = Date.parse("2099-02-10T12:00:00Z") / 1000
  const operation = {
    id: "op_paid",
    enrollment_id: "enr",
    user_id: "user",
    agreement_id: "sub_new",
    original_agreement_id: "sub_old",
    customer_id: "cus",
    paid_through_at: "2099-02-10T12:00:00Z",
    status: "pending",
    lease_token: "lease",
  }
  const subscription = {
    id: "sub_new",
    customer: "cus",
    livemode: true,
    status: "active",
    cancel_at: null as number | null,
    metadata: {
      trial_cohort: "trial_v1",
      trial_enrollment_id: "enr",
      trial_original_agreement_id: "sub_old",
    },
    items: { has_more: false, data: [{ current_period_end: through }] },
    schedule: null,
  }
  const runtime: TrialRuntime = {
    stripeAccountId: "acct",
    livemode: true,
    identityKeys: [],
    enrollmentMode: "disabled",
    allowedEmails: [],
    catalog: { monthPriceId: "p_m", yearPriceId: "p_y", annualCouponId: null },
  }
  const result = await requestStripePaidCancellation({
    requestId: "op_paid",
    enrollmentId: "enr",
    authenticatedUserId: "user",
    runtime,
    client: {
      rpc: async (name, args) => {
        calls.push(name)
        return {
          error: null,
          data:
            name === "request_stripe_paid_cancellation"
              ? operation
              : name === "claim_stripe_paid_cancellations"
                ? [operation]
                : args.p_confirmed,
        }
      },
    },
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct" }) },
      subscriptions: {
        retrieve: async () => subscription,
        update: async (id: string, args: Stripe.SubscriptionUpdateParams) => {
          calls.push("provider")
          assert.equal(id, "sub_new")
          assert.equal(args.cancel_at, through)
          assert.equal(args.proration_behavior, "none")
          subscription.cancel_at = through
          return subscription
        },
      },
    } as unknown as Stripe,
  })
  assert.equal(result.status, "confirmed")
  assert.equal(calls[0], "request_stripe_paid_cancellation")
  assert.ok(calls.indexOf("provider") > 0)
  assert.equal(result.paidThroughAt, "2099-02-10T12:00:00Z")
})
