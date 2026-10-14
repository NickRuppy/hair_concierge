import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import {
  reconcileStripeTrialContinuation,
  type StripeContinuationOperation,
} from "../src/lib/stripe/trial-continuation"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"

function fixture() {
  const now = Date.parse("2030-01-23T12:00:10Z")
  const paidAt = Date.parse("2030-01-23T12:00:00Z") / 1000
  const anchor = Date.parse("2031-01-23T12:00:00Z") / 1000
  const runtime: TrialRuntime = {
    stripeAccountId: "acct_1",
    livemode: true,
    identityKeys: [],
    enrollmentMode: "disabled",
    allowedEmails: [],
    catalog: { monthPriceId: "price_month", yearPriceId: "price_year", annualCouponId: "coupon" },
  }
  const operation: StripeContinuationOperation = {
    id: "op_1",
    enrollment_id: "enr_1",
    original_agreement_id: "sub_old",
    customer_id: "cus_1",
    source_object_id: "in_paid",
    paid_through_at: new Date(anchor * 1000).toISOString(),
    payment_succeeded_at: new Date(paidAt * 1000).toISOString(),
    accepted_offer: createTrialOfferSnapshot("year", runtime.catalog),
    neutralized_at: null,
    continuation_agreement_id: null,
    create_attempted_at: null,
    lease_token: "lease_1",
  }
  const price = {
    id: "price_year",
    currency: "eur",
    tax_behavior: "inclusive",
    unit_amount: 9999,
    recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
    billing_scheme: "per_unit",
  }
  const old = {
    id: "sub_old",
    customer: "cus_1",
    livemode: true,
    status: "active",
    cancel_at: null,
    cancel_at_period_end: false,
    schedule: null,
    pending_update: null,
    pause_collection: null,
    collection_method: "charge_automatically",
    automatic_tax: { enabled: true },
    cancellation_details: { comment: null as string | null },
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: "enr_1" } as Record<string, string>,
    items: {
      has_more: false,
      data: [{ id: "si_old", quantity: 1, price, current_period_end: anchor - 172800 }],
    },
  }
  let successor: any = null
  const calls: Array<{ method: string; args?: any }> = []
  const state = {
    allowed: true,
    bind: true,
    bindError: false,
    loseCreate: false,
    discount: false,
    merchant: "acct_1",
    late: false,
    canceled: false,
  }
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push({ method: name, args })
    if (name === "guard_stripe_trial_continuation") return { data: state.allowed, error: null }
    if (name === "confirm_trial_paid_continuation")
      return {
        data: state.bindError ? null : state.bind,
        error: state.bindError ? new Error("response lost") : null,
      }
    if (name === "checkpoint_stripe_trial_continuation") {
      if (args.p_action === "begin_create")
        operation.create_attempted_at ??= new Date(now).toISOString()
      if (args.p_action === "neutralized") operation.neutralized_at = new Date(now).toISOString()
      if (args.p_action === "observed")
        operation.continuation_agreement_id = String(args.p_subscription_id)
      return { data: true, error: null }
    }
    throw new Error(`Unexpected RPC ${name}`)
  }
  const stripe = {
    accounts: { retrieve: async () => ({ id: state.merchant }) },
    customers: {
      retrieve: async () => ({
        id: "cus_1",
        deleted: false,
        discount: state.discount ? { id: "di_1" } : null,
      }),
    },
    paymentMethods: {
      retrieve: async () => ({ id: "pm_1", customer: "cus_1", type: "card", livemode: true }),
    },
    invoices: {
      retrieve: async () => ({
        id: "in_paid",
        customer: "cus_1",
        status: "paid",
        livemode: true,
        currency: "eur",
        amount_paid: 6999,
        amount_due: 6999,
        amount_remaining: 0,
        parent: { subscription_details: { subscription: "sub_old" } },
      }),
      list: async ({ subscription }: any) => ({
        has_more: false,
        data:
          subscription === "sub_old"
            ? [{ id: "in_paid", status: "paid", amount_remaining: 0 }]
            : [],
      }),
    },
    invoicePayments: {
      list: async () => ({
        has_more: false,
        data: [
          {
            id: "ip_1",
            status: "paid",
            livemode: true,
            invoice: "in_paid",
            currency: "eur",
            amount_paid: 6999,
            status_transitions: { paid_at: paidAt },
            payment: { type: "payment_intent", payment_intent: "pi_1" },
          },
        ],
      }),
    },
    paymentIntents: {
      retrieve: async () => ({
        id: "pi_1",
        customer: "cus_1",
        livemode: true,
        status: "succeeded",
        currency: "eur",
        amount_received: 6999,
        payment_method: "pm_1",
        latest_charge: {
          paid: true,
          captured: true,
          disputed: false,
          amount_refunded: 0,
          amount_captured: 6999,
        },
      }),
    },
    subscriptions: {
      update: async (_id: string, args: any) => {
        Object.assign(old.metadata, args.metadata)
        return old
      },
      retrieve: async (id: string) => (id === "sub_old" ? old : successor),
      list: async () => ({ has_more: false, data: successor ? [old, successor] : [old] }),
      cancel: async (id: string, args: any) => {
        calls.push({ method: "cancel", args: { id, ...args } })
        if (id === "sub_old") {
          old.status = "canceled"
          old.cancellation_details = args.cancellation_details
        } else {
          successor.status = "canceled"
          state.canceled = true
        }
        return id === "sub_old" ? old : successor
      },
      create: async (args: any, options: any) => {
        calls.push({ method: "create", args: { ...args, options } })
        successor = {
          ...old,
          id: "sub_new",
          status: "active",
          billing_cycle_anchor: anchor,
          billing_mode: { type: "flexible" },
          metadata: args.metadata,
          default_payment_method: "pm_1",
          discounts: [],
          trial_start: null,
          trial_end: null,
          items: {
            has_more: false,
            data: [{ id: "si_new", quantity: 1, price, current_period_end: anchor }],
          },
          latest_invoice: null,
        }
        if (state.loseCreate) throw new Error("response lost")
        return successor
      },
    },
  }
  const run = () =>
    reconcileStripeTrialContinuation({
      operation,
      rpc,
      stripe: stripe as unknown as Stripe,
      runtime,
      now: () => (state.late ? Date.parse("2031-01-24T00:00:00Z") : now),
    })
  return { run, state, calls, operation, stripe, anchor, old, successor: () => successor }
}

test("paid first year continues once at the exact paid-through boundary without coupon, trial, or immediate invoice", async () => {
  const f = fixture()
  assert.equal(await f.run(), "resolved")
  const create = f.calls.find((c) => c.method === "create")!.args
  assert.equal(create.billing_cycle_anchor, Date.parse("2031-01-23T12:00:00Z") / 1000)
  assert.equal(create.proration_behavior, "none")
  assert.deepEqual(create.items, [{ price: "price_year", quantity: 1 }])
  assert.equal(create.default_payment_method, "pm_1")
  assert.deepEqual(create.automatic_tax, { enabled: true })
  assert.equal(create.trial_end, undefined)
  assert.equal(create.trial_period_days, undefined)
  assert.equal(create.discounts, undefined)
  assert.deepEqual(f.calls.find((c) => c.method === "cancel")!.args, {
    id: "sub_old",
    invoice_now: false,
    prorate: false,
    cancellation_details: { comment: "trial-paid-continuation:op_1" },
  })
  assert.ok(
    f.calls.findIndex((c) => c.method === "cancel") <
      f.calls.findIndex((c) => c.method === "create"),
  )
})

test("lost create response is reconciled by stable operation metadata without another subscription", async () => {
  const f = fixture()
  f.state.loseCreate = true
  assert.equal(await f.run(), "pending")
  f.state.loseCreate = false
  assert.equal(await f.run(), "resolved")
  assert.equal(f.calls.filter((c) => c.method === "create").length, 1)
})

test("cancellation racing the successor bind cancels the new subscription and preserves the debt", async () => {
  const f = fixture()
  f.state.bind = false
  assert.equal(await f.run(), "pending")
  assert.equal(f.state.canceled, true)
})

for (const reason of ["merchant", "discount", "late", "canceled"] as const) {
  test(`${reason} prevents new collection`, async () => {
    const f = fixture()
    if (reason === "merchant") f.state.merchant = "acct_wrong"
    if (reason === "discount") f.state.discount = true
    if (reason === "late") f.state.late = true
    if (reason === "canceled") f.state.allowed = false
    await f.run()
    assert.equal(f.calls.filter((c) => c.method === "create").length, 0)
  })
}

test("expired idempotency window never recreates an uncertain absent subscription", async () => {
  const f = fixture()
  f.operation.create_attempted_at = "2030-01-21T12:00:00Z"
  assert.equal(await f.run(), "pending")
  assert.equal(f.calls.filter((c) => c.method === "create").length, 0)
})

test("late customer cancellation compensates an already bound successor without altering the paid period", async () => {
  const f = fixture()
  assert.equal(await f.run(), "resolved")
  f.state.allowed = false
  assert.equal(await f.run(), "canceled")
  assert.equal(f.state.canceled, true)
  assert.equal(f.calls.filter((c) => c.method === "create").length, 1)
})

test("cancellation after a lost create response discovers and stops the successor", async () => {
  const f = fixture()
  f.state.loseCreate = true
  assert.equal(await f.run(), "pending")
  f.state.allowed = false
  assert.equal(await f.run(), "canceled")
  assert.equal(f.state.canceled, true)
  assert.equal(f.calls.filter((c) => c.method === "create").length, 1)
})

test("ambiguous bind response is retried without canceling a possibly committed successor", async () => {
  const f = fixture()
  f.state.bindError = true
  assert.equal(await f.run(), "pending")
  assert.equal(f.state.canceled, false)
  f.state.bindError = false
  assert.equal(await f.run(), "resolved")
  assert.equal(f.calls.filter((c) => c.method === "create").length, 1)
})

test("an external cancellation of the source is never treated as permission for a new agreement", async () => {
  const f = fixture()
  f.old.status = "canceled"
  assert.equal(await f.run(), "pending")
  assert.equal(f.calls.filter((c) => c.method === "create").length, 0)
})

test("provider source neutralization failure prevents successor creation", async () => {
  const f = fixture()
  f.stripe.subscriptions.cancel = async () => {
    throw new Error("provider unavailable")
  }
  assert.equal(await f.run(), "pending")
  assert.equal(f.calls.filter((c) => c.method === "create").length, 0)
})

test("incorrect successor anchor is canceled rather than left to collect at an unaccepted date", async () => {
  const f = fixture()
  const create = f.stripe.subscriptions.create
  f.stripe.subscriptions.create = async (args, options) => {
    const subscription = await create(args, options)
    subscription.billing_cycle_anchor += 60
    return subscription
  }
  assert.equal(await f.run(), "pending")
  assert.equal(f.state.canceled, true)
  assert.equal(f.calls.filter((c) => c.method === "confirm_trial_paid_continuation").length, 0)
})

test("unrelated customer pages do not hide a successor after a lost response", async () => {
  const f = fixture()
  f.state.loseCreate = true
  assert.equal(await f.run(), "pending")
  let pages = 0
  f.stripe.subscriptions.list = async () =>
    ++pages === 1 ? { has_more: true, data: [f.old] } : { has_more: false, data: [f.successor()] }
  assert.equal(await f.run(), "resolved")
  assert.equal(pages, 2)
  assert.equal(f.calls.filter((c) => c.method === "create").length, 1)
})
