import assert from "node:assert/strict"
import test from "node:test"
import {
  AccountDeletionRefundManualError,
  AccountDeletionRefundPendingError,
  type WebRefundDue,
  type WebRefundHooks,
} from "../src/lib/account-deletion/service"
import {
  addBillingInterval,
  proRataRefundMinor,
  refundPayPalSubscriptionWith,
  refundStripeSubscriptionWith,
  type PayPalRefundApi,
  type StripeRefundApi,
} from "../src/lib/account-deletion/web-refund"
import { PayPalRequestError } from "../src/lib/paypal/client"
import { refundPayPalSubscriptionPayment } from "../src/lib/paypal/subscriptions"

const REQUEST = "33333333-3333-4333-8333-333333333333"
const DAY = 86_400_000
const DAY_S = 86_400
const NOTHING = { refundedMinor: 0, paymentRef: null }

const due = (overrides: Partial<WebRefundDue> = {}): WebRefundDue => ({
  provider: "stripe",
  subscriptionId: "sub_live",
  requestId: REQUEST,
  kind: "deletion",
  recordedAt: new Date(10 * DAY).toISOString(),
  paymentsFrom: null,
  attempts: 0,
  plannedMinor: null,
  plannedPaymentRef: null,
  ...overrides,
})

function hooks() {
  const plans: unknown[] = []
  const value: WebRefundHooks = { plan: async (input) => void plans.push(input) }
  return { value, plans }
}

test("pro-rata math: unused share of the paid amount, rounded down to cents", () => {
  const base = { paidMinor: 1499, periodStart: 0, periodEnd: 30 * DAY }
  assert.equal(proRataRefundMinor({ ...base, endedAt: 15 * DAY }), 749) // mid-period, 749.5 → 749
  assert.equal(proRataRefundMinor({ ...base, endedAt: 10 * DAY }), 999) // 999.33 → 999
  assert.equal(proRataRefundMinor({ ...base, endedAt: 30 * DAY }), 0) // period end
  assert.equal(proRataRefundMinor({ ...base, endedAt: 31 * DAY }), 0) // after the period
  assert.equal(proRataRefundMinor({ ...base, endedAt: -DAY }), 1499) // never more than paid
  assert.equal(proRataRefundMinor({ ...base, paidMinor: 0, endedAt: DAY }), 0) // trial / €0
  assert.equal(proRataRefundMinor({ ...base, periodEnd: 0, endedAt: 0 }), 0) // empty period
})

test("billing intervals are calendar-safe across month ends (M5)", () => {
  const at = (iso: string) => Date.parse(iso)
  const iso = (ms: number) => new Date(ms).toISOString()
  assert.equal(
    iso(addBillingInterval(at("2026-01-31T09:30:00Z"), "MONTH", 1)),
    "2026-02-28T09:30:00.000Z",
  )
  assert.equal(
    iso(addBillingInterval(at("2028-01-31T09:30:00Z"), "MONTH", 1)),
    "2028-02-29T09:30:00.000Z",
  )
  assert.equal(
    iso(addBillingInterval(at("2026-03-31T00:00:00Z"), "MONTH", -1)),
    "2026-02-28T00:00:00.000Z",
  )
  assert.equal(
    iso(addBillingInterval(at("2026-08-31T00:00:00Z"), "MONTH", 3)),
    "2026-11-30T00:00:00.000Z",
  )
  assert.equal(
    iso(addBillingInterval(at("2028-02-29T00:00:00Z"), "YEAR", 1)),
    "2029-02-28T00:00:00.000Z",
  )
  assert.equal(
    iso(addBillingInterval(at("2026-09-01T00:00:00Z"), "WEEK", 1)),
    "2026-09-08T00:00:00.000Z",
  )
  assert.throws(() => addBillingInterval(0, "FORTNIGHT", 1), AccountDeletionRefundManualError)
})

type FakeStripeRefund = { amount: number; status: string; metadata: Record<string, string> | null }

function fakeStripe(overrides: {
  status?: string
  endedAt?: number | null
  missing?: boolean
  invoice?: { status: string; amount_paid: number }
  /** paidDay: day the invoice was paid (status paid) — or processing: an open invoice. */
  invoices?: { id: string; amount_paid: number; paidDay?: number; processing?: boolean }[]
  processingLatest?: boolean
  refunds?: Record<string, FakeStripeRefund[]>
  paymentType?: string
  createError?: { code: string }
}) {
  const created: unknown[] = []
  const refunds = overrides.refunds ?? {}
  const api: StripeRefundApi = {
    subscriptions: {
      retrieve: async () => {
        if (overrides.missing)
          throw Object.assign(new Error("No such subscription"), { code: "resource_missing" })
        return {
          status: overrides.status ?? "canceled",
          ended_at: overrides.endedAt === undefined ? 10 * DAY_S : overrides.endedAt,
          latest_invoice: "in_1",
        }
      },
    },
    invoices: {
      retrieve: async () => ({
        id: "in_1",
        ...(overrides.invoice ?? { status: "paid", amount_paid: 1499 }),
        created: 0,
        status_transitions: { paid_at: 0 },
        lines: { data: [{ period: { start: 0, end: 30 * DAY_S } }] },
      }),
      list: async () => ({
        has_more: false,
        data: (overrides.invoices ?? []).map((invoice) => ({
          id: invoice.id,
          amount_paid: invoice.processing ? 0 : invoice.amount_paid,
          status: invoice.processing ? "open" : "paid",
          created: (invoice.paidDay ?? 20) * DAY_S - 3600,
          status_transitions: {
            paid_at: invoice.processing ? null : (invoice.paidDay ?? 20) * DAY_S,
          },
          lines: { data: [] },
        })),
      }),
    },
    invoicePayments: {
      list: async ({ invoice }) => ({
        data: [
          {
            payment: {
              type: overrides.paymentType ?? "payment_intent",
              payment_intent: `pi_${invoice.replace("in_", "")}`,
            },
          },
        ],
      }),
    },
    paymentIntents: {
      retrieve: async (id) => ({
        status:
          (id === "pi_1" && overrides.processingLatest) ||
          overrides.invoices?.some((i) => i.processing && `pi_${i.id.replace("in_", "")}` === id)
            ? "processing"
            : "requires_payment_method",
      }),
    },
    refunds: {
      list: async ({ payment_intent }) => ({
        has_more: false,
        data: refunds[payment_intent] ?? [],
      }),
      create: async (params, options) => {
        if (overrides.createError) throw Object.assign(new Error("refused"), overrides.createError)
        created.push([params, options])
        ;(refunds[params.payment_intent] ??= []).push({
          amount: params.amount,
          status: "succeeded",
          metadata: params.metadata,
        })
        return { id: "re_new" }
      },
    },
  }
  return { api, created }
}

const OURS = {
  source: "account_deletion",
  kind: "deletion",
  request_id: REQUEST,
  subscription_id: "sub_live",
}

test("Stripe deletion: pro-rata refund of the latest paid invoice, keyed and tagged with the request", async () => {
  const live = fakeStripe({})
  assert.deepEqual(await refundStripeSubscriptionWith(due(), live.api), {
    refundedMinor: 999,
    paymentRef: "pi_1",
  })
  assert.deepEqual(live.created, [
    [
      { payment_intent: "pi_1", amount: 999, reason: "requested_by_customer", metadata: OURS },
      { idempotencyKey: `account-deletion-refund-${REQUEST}-sub_live` },
    ],
  ])
  // Retry after a lost result: our refund is found and its actual amount recorded (M4).
  assert.deepEqual(await refundStripeSubscriptionWith(due(), live.api), {
    refundedMinor: 999,
    paymentRef: "pi_1",
  })
  assert.equal(live.created.length, 1)

  const cases = {
    trial: fakeStripe({ invoice: { status: "paid", amount_paid: 0 } }),
    unpaid: fakeStripe({ invoice: { status: "open", amount_paid: 0 } }),
    periodEnd: fakeStripe({ endedAt: 30 * DAY_S }),
    endedBeforeDeletion: fakeStripe({ endedAt: 2 * DAY_S }),
    neverCreated: fakeStripe({ missing: true }),
  }
  for (const [name, f] of Object.entries(cases)) {
    assert.deepEqual(await refundStripeSubscriptionWith(due(), f.api), NOTHING, name)
    assert.deepEqual(f.created, [], name)
  }
  // Refunded by support: never on top, recorded as 0.
  const foreign = fakeStripe({
    refunds: { pi_1: [{ amount: 1499, status: "succeeded", metadata: {} }] },
  })
  assert.deepEqual(await refundStripeSubscriptionWith(due(), foreign.api), {
    refundedMinor: 0,
    paymentRef: "pi_1",
  })
  assert.deepEqual(foreign.created, [])
  // A failed earlier refund returned nothing: it does not count (M4).
  const failedBefore = fakeStripe({
    refunds: { pi_1: [{ amount: 999, status: "failed", metadata: OURS }] },
  })
  assert.equal((await refundStripeSubscriptionWith(due(), failedBefore.api)).refundedMinor, 999)
  assert.equal(failedBefore.created.length, 1)
})

test("Stripe: not yet cancelled retries; disputed charges and non-PaymentIntent payments go to manual review", async () => {
  const active = fakeStripe({ status: "active", endedAt: null })
  await assert.rejects(refundStripeSubscriptionWith(due(), active.api), /not cancelled/)
  await assert.rejects(
    refundStripeSubscriptionWith(
      due(),
      fakeStripe({ createError: { code: "charge_disputed" } }).api,
    ),
    AccountDeletionRefundManualError,
  )
  await assert.rejects(
    refundStripeSubscriptionWith(due(), fakeStripe({ paymentType: "out_of_band_payment" }).api),
    AccountDeletionRefundManualError,
  )
  const transient = fakeStripe({ createError: { code: "rate_limit" } })
  await assert.rejects(refundStripeSubscriptionWith(due(), transient.api), (error) => {
    return !(error instanceof AccountDeletionRefundManualError)
  })
})

test("Stripe post-deletion (R-a): every paid invoice refunded in full, per-payment keys, never twice", async () => {
  const f = fakeStripe({
    invoices: [
      { id: "in_old", amount_paid: 1499, paidDay: 12 },
      { id: "in_a", amount_paid: 3999, paidDay: 16 },
      { id: "in_b", amount_paid: 0, paidDay: 16 },
      { id: "in_c", amount_paid: 499, paidDay: 18 },
    ],
    refunds: {
      pi_c: [{ amount: 100, status: "succeeded", metadata: {} }],
    },
  })
  // Deleted on day 15: the payment of day 12 was before the deletion and is never refunded (I-2).
  const post = due({
    kind: "post_deletion",
    recordedAt: new Date(20 * DAY).toISOString(),
    paymentsFrom: new Date(15 * DAY).toISOString(),
  })
  assert.deepEqual(await refundStripeSubscriptionWith(post, f.api), {
    refundedMinor: 3999 + 399,
    paymentRef: "pi_c",
  })
  assert.deepEqual(
    (f.created as [unknown, unknown][]).map(([params, options]) => [
      (params as { payment_intent: string; amount: number }).payment_intent,
      (params as { amount: number }).amount,
      (options as { idempotencyKey: string }).idempotencyKey,
    ]),
    [
      ["pi_a", 3999, `account-deletion-refund-${REQUEST}-sub_live-pi_a`],
      ["pi_c", 399, `account-deletion-refund-${REQUEST}-sub_live-pi_c`],
    ],
  )
  // Retry: ours are recognised, nothing is created again.
  assert.equal((await refundStripeSubscriptionWith(post, f.api)).refundedMinor, 3999 + 399)
  assert.equal(f.created.length, 2)
  // Without a deletion time the scope is unknown: manual review, never a guess.
  await assert.rejects(
    refundStripeSubscriptionWith({ ...post, paymentsFrom: null }, f.api),
    AccountDeletionRefundManualError,
  )
})

test("Stripe: a processing payment keeps the refund due until it is final (m4)", async () => {
  const latest = fakeStripe({ invoice: { status: "open", amount_paid: 0 }, processingLatest: true })
  await assert.rejects(
    refundStripeSubscriptionWith(due(), latest.api),
    AccountDeletionRefundPendingError,
  )
  const failedLatest = fakeStripe({ invoice: { status: "open", amount_paid: 0 } })
  assert.deepEqual(await refundStripeSubscriptionWith(due(), failedLatest.api), NOTHING)

  const post = due({ kind: "post_deletion", paymentsFrom: new Date(15 * DAY).toISOString() })
  const f = fakeStripe({
    invoices: [
      { id: "in_a", amount_paid: 3999, paidDay: 16 },
      { id: "in_sepa", amount_paid: 499, paidDay: 17, processing: true },
    ],
  })
  await assert.rejects(refundStripeSubscriptionWith(post, f.api), AccountDeletionRefundPendingError)
  assert.equal(f.created.length, 1, "the final payment is refunded already")
})

function fakePayPal(overrides: {
  status?: string
  missing?: boolean
  nextBilling?: string
  transactions?: { id: string; status: string; time: string; value?: string }[]
}) {
  const refunds: unknown[] = []
  const windows: string[][] = []
  const api: PayPalRefundApi = {
    retrieve: async () => {
      if (overrides.missing) throw new PayPalRequestError("not found", 404)
      return {
        status: overrides.status ?? "CANCELLED",
        status_update_time: "2026-09-16T00:00:00Z",
        start_time: "2026-07-01T00:00:00Z",
        plan_id: "P-MONTH",
        billing_info: overrides.nextBilling ? { next_billing_time: overrides.nextBilling } : {},
      }
    },
    plan: async () => ({
      billing_cycles: [
        { tenure_type: "TRIAL", frequency: { interval_unit: "DAY", interval_count: 7 } },
        { tenure_type: "REGULAR", frequency: { interval_unit: "MONTH", interval_count: 1 } },
      ],
    }),
    transactions: async (_id, from, to) => {
      windows.push([from, to])
      return (overrides.transactions ?? []).map((t) => ({
        id: t.id,
        status: t.status,
        time: t.time,
        amount_with_breakdown: {
          gross_amount: { value: t.value ?? "14.99", currency_code: "EUR" },
        },
      }))
    },
    refund: async (...args) => void refunds.push(args),
  }
  return { api, refunds, windows }
}

const PAYPAL_DUE = due({
  provider: "paypal",
  subscriptionId: "I-HANNA",
  recordedAt: "2026-09-16T00:00:00Z",
})
const SEPT = { id: "TX-SEPT", status: "COMPLETED", time: "2026-09-01T00:00:00Z" }

test("PayPal deletion: pro-rata refund of the last completed payment, planned first, with a PayPal-Request-Id", async () => {
  const live = fakePayPal({
    transactions: [{ id: "OLD", status: "COMPLETED", time: "2026-08-01T00:00:00Z" }, SEPT],
  })
  const h = hooks()
  // Sept 1 → Oct 1 (30 days), cancelled Sept 16: 15/30 of €14.99 = 749.5 → €7.49.
  assert.deepEqual(await refundPayPalSubscriptionWith(PAYPAL_DUE, live.api, h.value), {
    refundedMinor: 749,
    paymentRef: "TX-SEPT",
  })
  assert.deepEqual(h.plans, [{ amountMinor: 749, paymentRef: "TX-SEPT" }])
  assert.deepEqual(live.refunds, [
    [
      "TX-SEPT",
      { value: "7.49", currency_code: "EUR" },
      `account-deletion-refund-${REQUEST}-I-HANNA`,
    ],
  ])
  assert.ok(live.windows[0][0] < "2026-08-16T00:00:00Z", "window covers one interval back")

  // M5: a day-after collection is anchored on the agreement's cycle when PayPal reports it.
  const anchored = fakePayPal({
    nextBilling: "2026-10-01T00:00:00Z",
    transactions: [{ ...SEPT, time: "2026-09-02T00:00:00Z" }],
  })
  assert.equal(
    (await refundPayPalSubscriptionWith(PAYPAL_DUE, anchored.api, hooks().value)).refundedMinor,
    749,
  )
  // Jan 31 payment, calendar-safe period to Feb 28 (28 days), cancelled Feb 14: 14/28 → €7.49.
  const january = fakePayPal({
    transactions: [{ ...SEPT, time: "2026-01-31T00:00:00Z" }],
  })
  const february = { ...PAYPAL_DUE, recordedAt: "2026-02-14T00:00:00Z" }
  january.api.retrieve = async () => ({
    status: "CANCELLED",
    status_update_time: "2026-02-14T00:00:00Z",
    plan_id: "P-MONTH",
  })
  assert.equal(
    (await refundPayPalSubscriptionWith(february, january.api, hooks().value)).refundedMinor,
    749,
  )
})

test("PayPal deletion: never billed, unknown, expired or already refunded resolve without a refund", async () => {
  const cases = {
    trial: fakePayPal({ transactions: [] }),
    approvalPending: fakePayPal({ status: "APPROVAL_PENDING" }),
    approved: fakePayPal({ status: "APPROVED" }),
    missing: fakePayPal({ missing: true }),
    expired: fakePayPal({ status: "EXPIRED" }),
  }
  for (const [name, f] of Object.entries(cases)) {
    assert.deepEqual(
      await refundPayPalSubscriptionWith(PAYPAL_DUE, f.api, hooks().value),
      NOTHING,
      name,
    )
    assert.deepEqual(f.refunds, [], name)
  }
  const refunded = { ...SEPT, status: "PARTIALLY_REFUNDED" }
  // Ours (planned before the call, result lost): its actual amount (M4).
  const ours = fakePayPal({ transactions: [refunded] })
  assert.deepEqual(
    await refundPayPalSubscriptionWith(
      { ...PAYPAL_DUE, plannedMinor: 749, plannedPaymentRef: "TX-SEPT" },
      ours.api,
      hooks().value,
    ),
    { refundedMinor: 749, paymentRef: "TX-SEPT" },
  )
  // Someone else's: never on top.
  const foreign = fakePayPal({ transactions: [refunded] })
  assert.deepEqual(await refundPayPalSubscriptionWith(PAYPAL_DUE, foreign.api, hooks().value), {
    refundedMinor: 0,
    paymentRef: "TX-SEPT",
  })
  assert.deepEqual([...ours.refunds, ...foreign.refunds], [])
  await assert.rejects(
    refundPayPalSubscriptionWith(PAYPAL_DUE, fakePayPal({ status: "ACTIVE" }).api, hooks().value),
    /not cancelled/,
  )
})

test("PayPal post-deletion (R-a): payments from the deletion on refunded in full, each planned (m3)", async () => {
  const f = fakePayPal({
    transactions: [
      { id: "TX-2", status: "COMPLETED", time: "2026-09-20T00:00:00Z", value: "4.99" },
      { id: "TX-1", status: "COMPLETED", time: "2026-09-18T00:00:00Z", value: "39.99" },
      { id: "TX-0", status: "REFUNDED", time: "2026-09-17T00:00:00Z", value: "4.99" },
      { id: "TX-D", status: "DECLINED", time: "2026-09-17T12:00:00Z" },
      // Paid before the deletion (Sept 16): never refunded by R-a (I-2).
      { id: "TX-OLD", status: "COMPLETED", time: "2026-09-10T00:00:00Z", value: "39.99" },
    ],
  })
  const post = {
    ...PAYPAL_DUE,
    kind: "post_deletion" as const,
    paymentsFrom: "2026-09-16T00:00:00Z",
  }
  const h = hooks()
  assert.deepEqual(await refundPayPalSubscriptionWith(post, f.api, h.value), {
    refundedMinor: 499 + 3999 + 499,
    paymentRef: "TX-0",
  })
  assert.deepEqual(f.refunds, [
    [
      "TX-2",
      { value: "4.99", currency_code: "EUR" },
      `account-deletion-refund-${REQUEST}-I-HANNA-TX-2`,
    ],
    [
      "TX-1",
      { value: "39.99", currency_code: "EUR" },
      `account-deletion-refund-${REQUEST}-I-HANNA-TX-1`,
    ],
  ])
  // m3: each refunded payment is stored before its call (webhooks for all are recognised).
  assert.deepEqual(h.plans, [
    { amountMinor: 499, paymentRef: "TX-2" },
    { amountMinor: 3999, paymentRef: "TX-1" },
  ])
  assert.ok(f.windows[0][0] < "2026-09-16T00:00:00Z", "the window starts at the deletion")
  await assert.rejects(
    refundPayPalSubscriptionWith(
      post,
      fakePayPal({
        transactions: [{ ...SEPT, time: "2026-09-18T00:00:00Z", status: "PARTIALLY_REFUNDED" }],
      }).api,
      h.value,
    ),
    AccountDeletionRefundManualError,
  )
  // Never approved: nothing was charged.
  assert.deepEqual(
    await refundPayPalSubscriptionWith(
      post,
      fakePayPal({ status: "APPROVAL_PENDING" }).api,
      h.value,
    ),
    NOTHING,
  )
})

test("PayPal: a pending payment keeps the refund due until it is final (m4)", async () => {
  const pendingLatest = fakePayPal({
    transactions: [SEPT, { id: "TX-OCT", status: "PENDING", time: "2026-09-15T00:00:00Z" }],
  })
  await assert.rejects(
    refundPayPalSubscriptionWith(PAYPAL_DUE, pendingLatest.api, hooks().value),
    AccountDeletionRefundPendingError,
  )
  assert.deepEqual(pendingLatest.refunds, [])
  const post = {
    ...PAYPAL_DUE,
    kind: "post_deletion" as const,
    paymentsFrom: "2026-09-16T00:00:00Z",
  }
  const mixed = fakePayPal({
    transactions: [
      { id: "TX-1", status: "COMPLETED", time: "2026-09-18T00:00:00Z" },
      { id: "TX-2", status: "PENDING", time: "2026-09-19T00:00:00Z" },
    ],
  })
  await assert.rejects(
    refundPayPalSubscriptionWith(post, mixed.api, hooks().value),
    AccountDeletionRefundPendingError,
  )
  assert.equal(mixed.refunds.length, 1, "the completed payment is refunded already")
})

test("PayPal refund call: v1 sale refund first, v2 capture only on 404, request id on every call (I3)", async () => {
  const fake = (responses: (number | null)[]) => {
    const calls: { path: string; headers: unknown; body: unknown }[] = []
    const request = async <T>(path: string, init: RequestInit): Promise<T> => {
      calls.push({ path, headers: init.headers, body: JSON.parse(String(init.body)) })
      const status = responses[calls.length - 1]
      if (status !== null) throw new PayPalRequestError(`PayPal ${status}`, status)
      return {} as T
    }
    return { calls, request }
  }
  const amount = { value: "7.49", currency_code: "EUR" }
  const sale = fake([null])
  await refundPayPalSubscriptionPayment("TX-1", amount, "key-1", sale.request)
  assert.deepEqual(sale.calls, [
    {
      path: "/v1/payments/sale/TX-1/refund",
      headers: { "PayPal-Request-Id": "key-1" },
      body: { amount: { total: "7.49", currency: "EUR" } },
    },
  ])
  const capture = fake([404, null])
  await refundPayPalSubscriptionPayment("TX-1", amount, "key-1", capture.request)
  assert.deepEqual(capture.calls[1], {
    path: "/v2/payments/captures/TX-1/refund",
    headers: { "PayPal-Request-Id": "key-1" },
    body: { amount },
  })
  for (const status of [403, 422, 500]) {
    const refused = fake([status, null])
    await assert.rejects(
      refundPayPalSubscriptionPayment("TX-1", amount, "key-1", refused.request),
      (error) => (error as PayPalRequestError).status === status,
    )
    assert.equal(refused.calls.length, 1, `no fallback on ${status}`)
  }
})
