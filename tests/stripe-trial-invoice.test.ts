import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { handleStripeTrialInvoice } from "../src/lib/stripe/trial-invoice"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import type {
  TrialPaymentEvent,
  TrialPaymentEventResult,
} from "../src/lib/billing/trial-payment-events"
import { handleStripeWebhookEvent } from "../src/app/api/stripe/webhook/route"

function fixture() {
  const enrollmentId = "11111111-1111-4111-8111-111111111111"
  const start = Date.parse("2030-01-21T12:00:00Z") / 1000
  const end = Date.parse("2031-01-21T12:00:00Z") / 1000
  const runtime = {
    stripeAccountId: "acct_live",
    livemode: true,
    identityKeys: [],
    enrollmentMode: "disabled",
    allowedEmails: [],
    catalog: { monthPriceId: "price_month", yearPriceId: "price_year", annualCouponId: "coupon" },
  } satisfies TrialRuntime
  const billing = {
    trial_enrollment_id: enrollmentId as string | null,
    user_id: "user_1",
    provider_customer_id: "cus_1",
  }
  const enrollment = {
    id: enrollmentId,
    user_id: "user_1",
    provider: "stripe",
    provider_agreement_id: "sub_1",
    accepted_offer: createTrialOfferSnapshot("year", runtime.catalog),
    admission_status: "active",
    original_trial_end_at: new Date(start * 1000).toISOString(),
  }
  const sub = {
    id: "sub_1",
    customer: "cus_1",
    livemode: true,
    status: "active",
    cancel_at: null,
    cancel_at_period_end: false,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: enrollmentId } as Record<
      string,
      string
    >,
    items: {
      has_more: false,
      data: [
        {
          id: "si_1",
          quantity: 1,
          current_period_start: start,
          current_period_end: end,
          price: {
            id: "price_year",
            currency: "eur",
            tax_behavior: "inclusive",
            unit_amount: 9999,
            recurring: { interval: "year", interval_count: 1 },
          },
        },
      ],
    },
  }
  const invoice = {
    id: "in_1",
    customer: "cus_1",
    livemode: true,
    currency: "eur",
    status: "paid",
    collection_method: "charge_automatically",
    parent: { subscription_details: { subscription: "sub_1", metadata: sub.metadata } },
    billing_reason: "subscription_cycle",
    amount_due: 6999,
    amount_paid: 6999,
    amount_remaining: 0,
    attempted: true,
    attempt_count: 1,
    lines: {
      has_more: false,
      data: [
        {
          quantity: 1,
          period: { start, end },
          pricing: { price_details: { price: "price_year" } },
          parent: {
            subscription_item_details: {
              subscription: "sub_1",
              subscription_item: "si_1",
              proration: false,
            },
          },
        },
      ],
    },
  }
  const paid = {
    id: "inpay_1",
    invoice: "in_1",
    status: "paid",
    livemode: true,
    currency: "eur",
    amount_paid: 6999,
    payment: { type: "payment_intent", payment_intent: "pi_1" },
    status_transitions: { paid_at: start },
  }
  const intent = {
    id: "pi_1",
    customer: "cus_1",
    status: "succeeded",
    livemode: true,
    currency: "eur",
    amount_received: 6999,
    latest_charge: {
      paid: true,
      captured: true,
      disputed: false,
      amount_refunded: 0,
      amount_captured: 6999,
    },
  }
  const calls: string[] = []
  const recorded: TrialPaymentEvent[] = []
  const analyticsLookups: string[] = []
  const deliveryOutboxIds: string[] = []
  const provider = {
    accounts: {
      retrieve: async () => {
        calls.push("account")
        return { id: "acct_live" }
      },
    },
    subscriptions: {
      retrieve: async () => {
        calls.push("subscription")
        return sub
      },
    },
    invoices: {
      retrieve: async () => {
        calls.push("invoice")
        return invoice
      },
    },
    invoicePayments: {
      list: async () => {
        calls.push("payments")
        return { has_more: false, data: [paid] }
      },
    },
    paymentIntents: {
      retrieve: async () => {
        calls.push("intent")
        return intent
      },
    },
  }
  let linked: Record<string, string> | null = null
  let sourceRepair = false
  const client = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === "read_trial_effective_contract")
        return {
          data: {
            accepted_offer: enrollment.accepted_offer,
            provider: "stripe",
            provider_agreement_id: enrollment.provider_agreement_id,
            revision: 0,
          },
          error: null,
        }
      if (name === "lookup_trial_paid_continuation") return { data: linked, error: null }
      if (name === "is_trial_continuation_source_cancellation")
        return { data: sourceRepair, error: null }
      recorded.push(params.p_event as TrialPaymentEvent)
      return { data: result, error: null }
    },
    from(table: string) {
      const builder = {
        select() {
          return builder
        },
        eq(column: string, value: string) {
          if (table === "billing_analytics_outbox" && column === "event_key")
            analyticsLookups.push(value)
          if (table === "billing_analytics_deliveries" && column === "outbox_id")
            deliveryOutboxIds.push(value)
          return builder
        },
        in() {
          return builder
        },
        or() {
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          assert.equal(table, "billing_analytics_deliveries")
          return Promise.resolve({ data: [], error: null }).then(resolve)
        },
        maybeSingle: async () => ({
          error: null,
          data:
            table === "billing_analytics_outbox"
              ? recorded.length && result.outcome !== "stale"
                ? { id: "atomic_trial_event" }
                : null
              : table === "billing_subscriptions"
                ? billing
                : enrollment,
        }),
      }
      return builder
    },
  }
  let result: TrialPaymentEventResult = { outcome: "applied", phase: "first_paid" }
  return {
    runtime,
    billing,
    enrollment,
    sub,
    invoice,
    paid,
    intent,
    calls,
    recorded,
    analyticsLookups,
    deliveryOutboxIds,
    setResult(next: TrialPaymentEventResult) {
      result = next
    },
    setContinuation(next: Record<string, string> | null) {
      linked = next
    },
    setSourceRepair() {
      sourceRepair = true
    },
    run(
      outcome: "succeeded" | "failed" = "succeeded",
      configuration: TrialRuntime | null = runtime,
    ) {
      return handleStripeTrialInvoice(
        {
          invoice: invoice as unknown as Stripe.Invoice,
          eventId: "evt_1",
          eventCreated: start + 60,
          outcome,
        },
        {
          stripe: provider as unknown as Stripe,
          supabase: client as unknown as SupabaseClient,
          runtime: configuration,
          recordPayment: async (_db, event) => {
            recorded.push(event)
            return result
          },
        },
      )
    },
    async runWebhook(outcome: "succeeded" | "failed", recordBillingAnalytics = false) {
      const keys = {
        TRIAL_IDENTITY_PROCESSING_APPROVED: "true",
        TRIAL_STRIPE_ACCOUNT_ID: "acct_live",
        TRIAL_STRIPE_LIVEMODE: "true",
        TRIAL_IDENTITY_HMAC_KEYS: JSON.stringify([{ version: 1, secretHex: "a".repeat(64) }]),
        TRIAL_STRIPE_PRICE_MONTHLY: "price_month",
        TRIAL_STRIPE_PRICE_ANNUAL: "price_year",
        TRIAL_STRIPE_ANNUAL_COUPON: "coupon",
        TRIAL_ENROLLMENT_MODE: "disabled",
      }
      const before = Object.fromEntries(Object.keys(keys).map((key) => [key, process.env[key]]))
      Object.assign(process.env, keys)
      try {
        const queued: Array<() => void | Promise<void>> = []
        await handleStripeWebhookEvent(
          {
            id: "evt_route",
            type: `invoice.payment_${outcome}`,
            created: start + 60,
            data: { object: invoice },
          } as unknown as Stripe.Event,
          {
            stripe: provider as unknown as Stripe,
            supabase: client as unknown as SupabaseClient,
            recordBillingAnalytics,
            defer: (work) => {
              queued.push(work)
            },
          },
        )
        if (recordBillingAnalytics) {
          for (const work of queued) await work()
        } else {
          assert.deepEqual(
            queued,
            [],
            "trial invoices must not enqueue legacy optional lifecycle messages",
          )
        }
      } finally {
        for (const [key, value] of Object.entries(before)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }
    },
  }
}

test("uses retrieved payment success time and invoice service boundaries, never webhook arrival", async () => {
  const f = fixture()
  const result = await f.run()
  assert.equal(result?.payment?.amountMinor, 6999)
  assert.deepEqual(f.recorded[0], {
    provider: "stripe",
    enrollmentId: f.enrollment.id,
    agreementId: "sub_1",
    sourceEventId: "evt_1",
    sourceObjectId: "in_1",
    outcome: "succeeded",
    occurredAt: "2030-01-21T12:00:00.000Z",
    amountMinor: 6999,
    currency: "EUR",
    periodStartAt: "2030-01-21T12:00:00.000Z",
    periodEndAt: "2031-01-21T12:00:00.000Z",
  })
})

test("zero authorization invoice records no payment or revenue", async () => {
  const f = fixture()
  Object.assign(f.invoice, { billing_reason: "subscription_create", amount_due: 0, amount_paid: 0 })
  f.sub.status = "trialing"
  assert.equal((await f.run())?.payment, null)
  assert.equal(f.recorded.length, 0)
  assert.equal(f.calls.includes("intent"), false)
})

test("a late failure delivery follows the retrieved successful payment", async () => {
  const f = fixture()
  assert.equal((await f.run("failed"))?.payment?.result.phase, "first_paid")
  assert.equal(f.recorded[0].outcome, "succeeded")
})

test("unpaid first invoice enters payment ledger without paid conversion", async () => {
  const f = fixture()
  Object.assign(f.invoice, { status: "open", amount_paid: 0, amount_remaining: 6999 })
  f.sub.status = "past_due"
  assert.equal((await f.run("failed"))?.payment, null)
  assert.equal(f.recorded[0].outcome, "failed")
  assert.equal(f.calls.includes("payments"), false)
})

test("legacy paid invoices work with trial runtime absent or configured", async () => {
  const f = fixture()
  f.billing.trial_enrollment_id = null
  f.sub.metadata = {}
  f.invoice.parent.subscription_details.metadata = {}
  assert.equal(await f.run("succeeded", null), null)
  assert.deepEqual(f.calls, [])
  assert.equal(await f.run(), null)
  assert.deepEqual(f.calls, ["subscription"])
})

for (const [name, mutate] of Object.entries({
  "wrong merchant": (f: ReturnType<typeof fixture>) => {
    f.runtime.stripeAccountId = "acct_wrong"
  },
  "unlinked trial": (f: ReturnType<typeof fixture>) => {
    f.billing.trial_enrollment_id = null
  },
  "wrong owner": (f: ReturnType<typeof fixture>) => {
    f.enrollment.user_id = "other"
  },
  "wrong customer": (f: ReturnType<typeof fixture>) => {
    f.invoice.customer = "other"
  },
  "wrong mode": (f: ReturnType<typeof fixture>) => {
    f.sub.livemode = false
  },
  "wrong subscription marker": (f: ReturnType<typeof fixture>) => {
    f.sub.metadata.trial_enrollment_id = "other"
  },
  "wrong price": (f: ReturnType<typeof fixture>) => {
    f.sub.items.data[0].price.id = "other"
  },
  "additional lines": (f: ReturnType<typeof fixture>) => {
    f.invoice.lines.has_more = true
  },
  proration: (f: ReturnType<typeof fixture>) => {
    f.invoice.lines.data[0].parent.subscription_item_details.proration = true
  },
  "invoice beyond provider end": (f: ReturnType<typeof fixture>) => {
    f.sub.items.data[0].current_period_end--
  },
  "out of band payment": (f: ReturnType<typeof fixture>) => {
    f.paid.payment.type = "payment_record"
  },
  "unsettled intent": (f: ReturnType<typeof fixture>) => {
    f.intent.status = "processing"
  },
  "refunded charge": (f: ReturnType<typeof fixture>) => {
    f.intent.latest_charge.amount_refunded = 6999
  },
  "canceled subscription": (f: ReturnType<typeof fixture>) => {
    f.sub.status = "canceled"
  },
  "wrong paid amount": (f: ReturnType<typeof fixture>) => {
    f.intent.amount_received = 9999
  },
})) {
  test(`${name} never grants access or falls through to legacy revenue`, async () => {
    const f = fixture()
    mutate(f)
    await assert.rejects(f.run(), /requires reconciliation/)
    assert.equal(f.recorded.length, 0)
  })
}

test("short delayed-payment period remains retryable reconciliation, without an invented renewal", async () => {
  const f = fixture()
  f.paid.status_transitions.paid_at += 3 * 86400
  f.setResult({ outcome: "reconciliation_required", phase: "none" })
  await assert.rejects(f.run(), /requires reconciliation/)
  assert.equal(f.recorded[0].occurredAt, "2030-01-24T12:00:00.000Z")
  assert.equal(f.recorded[0].periodEndAt, "2031-01-21T12:00:00.000Z")
})

test("invoked success webhook routes the trial payment through the canonical ledger", async () => {
  const f = fixture()
  await f.runWebhook("succeeded")
  assert.equal(f.recorded[0].sourceEventId, "evt_route")
  assert.equal(f.recorded[0].outcome, "succeeded")
})

test("invoked failure webhook never applies legacy grace or optional failure messages to a trial", async () => {
  const f = fixture()
  Object.assign(f.invoice, { status: "open", amount_paid: 0, amount_remaining: 6999 })
  f.sub.status = "past_due"
  await f.runWebhook("failed")
  assert.equal(f.recorded[0].outcome, "failed")
})

test("invoked webhook propagates reconciliation so its event claim can be retried", async () => {
  const f = fixture()
  f.setResult({ outcome: "reconciliation_required", phase: "none" })
  await assert.rejects(f.runWebhook("succeeded"), /requires reconciliation/)
})

test("approved continuation renewal uses original enrollment and current provider agreement", async () => {
  const f = fixture()
  f.sub.id = "sub_new"
  f.sub.metadata.trial_original_agreement_id = "sub_1"
  f.sub.metadata.trial_continuation_role = "paid_successor"
  f.sub.metadata.trial_continuation_operation_id = "op_1"
  f.invoice.parent.subscription_details.subscription = "sub_new"
  f.invoice.lines.data[0].parent.subscription_item_details.subscription = "sub_new"
  f.setContinuation({
    enrollment_id: f.enrollment.id,
    original_agreement_id: "sub_1",
    continuation_agreement_id: "sub_new",
    customer_id: "cus_1",
    source_object_id: "in_first",
    paid_through_at: "2031-01-21T12:00:00Z",
    operation_id: "op_1",
  })
  f.setResult({ outcome: "applied", phase: "renewal" })
  const result = await f.run()
  assert.equal(result?.payment?.result.phase, "renewal")
  assert.equal(f.recorded[0].agreementId, "sub_new")
  assert.equal(f.enrollment.provider_agreement_id, "sub_1")
})

test("unbound provider continuation cannot use metadata alone to grant paid access", async () => {
  const f = fixture()
  f.sub.metadata.trial_original_agreement_id = "sub_1"
  f.sub.metadata.trial_continuation_role = "paid_successor"
  f.sub.metadata.trial_continuation_operation_id = "op_1"
  await assert.rejects(f.run(), /requires reconciliation/)
  assert.equal(f.recorded.length, 0)
})

test("duplicate source invoice still reaches dedup after verified repair cancellation", async () => {
  const f = fixture()
  f.sub.status = "canceled"
  f.sub.metadata.trial_continuation_operation_id = "op_1"
  Object.assign(f.sub, { cancellation_details: { comment: "trial-paid-continuation:op_1" } })
  f.setSourceRepair()
  f.setResult({ outcome: "duplicate", phase: "first_paid" })
  assert.equal((await f.run())?.payment?.result.outcome, "duplicate")
})

test("verified first-payment failure immediately dispatches its atomic outbox key with analytics enabled", async () => {
  const f = fixture()
  Object.assign(f.invoice, { status: "open", amount_paid: 0, amount_remaining: 6999 })
  f.sub.status = "past_due"
  f.setResult({ outcome: "applied", phase: "none" })
  await f.runWebhook("failed", true)
  assert.equal(f.recorded.length, 1)
  assert.equal(f.recorded[0].outcome, "failed")
  assert.deepEqual(f.analyticsLookups, ["stripe:trial_first_payment_failed:in_1"])
  assert.deepEqual(f.deliveryOutboxIds, ["atomic_trial_event"])
})

test("late failure retrieving paid truth dispatches Purchase, while absent failure facts stay a no-op", async () => {
  const paid = fixture()
  await paid.runWebhook("failed", true)
  assert.equal(paid.recorded[0].outcome, "succeeded")
  assert.deepEqual(paid.analyticsLookups, ["stripe:purchase_completed:in_1"])
  const stale = fixture()
  Object.assign(stale.invoice, { status: "open", amount_paid: 0, amount_remaining: 6999 })
  stale.setResult({ outcome: "stale", phase: "none" })
  await stale.runWebhook("failed", true)
  assert.deepEqual(stale.analyticsLookups, ["stripe:trial_first_payment_failed:in_1"])
  assert.deepEqual(stale.deliveryOutboxIds, [])
})
