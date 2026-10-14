import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import {
  reconcileStripePriorPaidMembership,
  StripePaidHistoryReviewRequired,
} from "../src/lib/stripe/trial-prior-paid-history"
const USER = "11111111-1111-4111-8111-111111111111"
const runtime = {
  stripeAccountId: "acct_owner",
  livemode: true,
  identityKeys: [{ version: 1, secret: Buffer.alloc(32, 9) }],
  enrollmentMode: "disabled",
} as unknown as TrialRuntime
function fixture() {
  const invoice = {
    id: "in_paid",
    livemode: true,
    status: "paid",
    amount_paid: 999,
    amount_remaining: 0,
    currency: "eur",
    customer: "cus_owner",
    parent: { subscription_details: { subscription: "sub_legacy" } },
  }
  const charge = {
    id: "ch_paid",
    status: "succeeded",
    paid: true,
    captured: true,
    disputed: false,
    livemode: true,
    customer: "cus_owner",
    currency: "eur",
    amount_captured: 999,
    amount_refunded: 0,
    payment_intent: "pi_paid",
    payment_method_details: { type: "card", card: { fingerprint: "card-actual-paid" } },
  }
  const intent = {
    id: "pi_paid",
    status: "succeeded",
    livemode: true,
    customer: "cus_owner",
    currency: "eur",
    amount_received: 999,
    latest_charge: charge,
  }
  const payment = {
    id: "inpay_paid",
    status: "paid",
    livemode: true,
    invoice: "in_paid",
    currency: "eur",
    amount_paid: 999,
    payment: { type: "payment_intent", payment_intent: "pi_paid", charge: "ch_paid" },
    status_transitions: { paid_at: 1577836800 },
  }
  const subscription = {
    id: "sub_legacy",
    livemode: true,
    status: "canceled",
    customer: "cus_owner",
  }
  const billing = {
    metadata: {} as Record<string, unknown>,
    user_id: USER,
    provider_customer_id: "cus_owner",
    provider_subscription_id: "sub_legacy",
  }
  const user = { id: USER, email: "owner@example.com", email_confirmed_at: "2019-01-01Z" }
  const writes: unknown[] = []
  let reads = 0
  const stripe = {
    accounts: {
      retrieve: async () => {
        reads++
        return { id: "acct_owner" }
      },
    },
    invoices: { retrieve: async () => invoice },
    subscriptions: { retrieve: async () => subscription },
    invoicePayments: { list: async () => ({ has_more: false, data: [payment] }) },
    paymentIntents: { retrieve: async () => intent },
    charges: { retrieve: async () => charge },
  } as unknown as Stripe
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "billing_subscriptions")
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: billing, error: null }) }) }),
        }),
      }
    },
    auth: {
      admin: {
        getUserById: async (id: string) => {
          assert.equal(id, USER)
          return { data: { user }, error: null }
        },
      },
    },
  } as unknown as SupabaseClient
  const deps = {
    stripe,
    supabase,
    runtime,
    now: new Date("2025-01-01Z"),
    recordHistory: async (_client: unknown, input: unknown) => {
      writes.push(input)
    },
  }
  return {
    invoice,
    charge,
    intent,
    payment,
    subscription,
    billing,
    user,
    writes,
    deps,
    reads: () => reads,
  }
}
test("dry run verifies historical canceled membership without writing; apply uses actual captured card and verified canonical owner", async () => {
  const f = fixture()
  assert.deepEqual(await reconcileStripePriorPaidMembership({ invoiceId: "in_paid" }, f.deps), {
    status: "verified",
    payments: 1,
    cardPayments: 1,
  })
  assert.equal(f.writes.length, 0)
  assert.equal(
    (await reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps))
      .status,
    "recorded",
  )
  const input = f.writes[0] as Record<string, unknown>
  assert.equal(input.userId, USER)
  assert.equal(input.verifiedEmail, "owner@example.com")
  assert.deepEqual(input.paymentIdentity, {
    kind: "stripe_card",
    namespace: "acct_owner:live",
    value: "card-actual-paid",
  })
})
test("processing approval gates even provider reads; free and non-subscription invoices cannot seed history", async () => {
  const f = fixture()
  assert.equal(
    (
      await reconcileStripePriorPaidMembership(
        { invoiceId: "in_paid", apply: true },
        { ...f.deps, runtime: null },
      )
    ).status,
    "processing_disabled",
  )
  assert.equal(f.reads(), 0)
  f.invoice.amount_paid = 0
  assert.equal(
    (await reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps))
      .status,
    "not_paid_membership",
  )
  assert.equal(f.writes.length, 0)
})
test("identity mismatch, unverified email, failed or disputed capture, future timestamp and partial invoice evidence never write", async () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => {
      f.invoice.livemode = false
    },
    (f: ReturnType<typeof fixture>) => {
      f.subscription.customer = "cus_other"
    },
    (f: ReturnType<typeof fixture>) => {
      f.user.email_confirmed_at = ""
    },
    (f: ReturnType<typeof fixture>) => {
      f.charge.captured = false
    },
    (f: ReturnType<typeof fixture>) => {
      f.charge.disputed = true
    },
    (f: ReturnType<typeof fixture>) => {
      f.payment.status_transitions.paid_at = 4102444800
    },
    (f: ReturnType<typeof fixture>) => {
      f.invoice.amount_paid = 1998
    },
    (f: ReturnType<typeof fixture>) => {
      f.charge.customer = "cus_other"
    },
  ]
  for (const mutate of mutations) {
    const f = fixture()
    mutate(f)
    await assert.rejects(
      reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps),
      StripePaidHistoryReviewRequired,
    )
    assert.equal(f.writes.length, 0)
  }
})
test("older direct charge invoices and refunds retain genuine prior use; absent card fingerprint writes only owner claims", async () => {
  const f = fixture()
  f.payment.payment.type = "charge"
  f.charge.amount_refunded = 999
  f.charge.payment_method_details = { type: "sepa_debit", card: { fingerprint: "" } }
  assert.deepEqual(
    await reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps),
    { status: "recorded", payments: 1, cardPayments: 0 },
  )
  assert.equal(Object.hasOwn(f.writes[0] as object, "paymentIdentity"), false)
})
test("manual payment records and truncated invoice payment collections require review", async () => {
  const f = fixture()
  f.payment.payment.type = "payment_record"
  await assert.rejects(
    reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps),
    StripePaidHistoryReviewRequired,
  )
  f.payment.payment.type = "payment_intent"
  f.deps.stripe.invoicePayments.list = (() =>
    Promise.resolve({
      has_more: true,
      data: [f.payment],
    })) as unknown as Stripe["invoicePayments"]["list"]
  await assert.rejects(
    reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps),
    StripePaidHistoryReviewRequired,
  )
  assert.equal(f.writes.length, 0)
})

test("explicit existing QA seed classification excludes history but real profile backfills remain eligible for verification", async () => {
  const f = fixture()
  f.billing.metadata = { qa_seed: true }
  assert.deepEqual(
    await reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps),
    { status: "excluded_test", payments: 0, cardPayments: 0 },
  )
  assert.equal(f.writes.length, 0)
  f.billing.metadata = { backfilled_from_profiles: true }
  assert.equal(
    (await reconcileStripePriorPaidMembership({ invoiceId: "in_paid", apply: true }, f.deps))
      .status,
    "recorded",
  )
  assert.equal(f.writes.length, 1)
})
