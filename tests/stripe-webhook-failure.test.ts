import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import {
  TrialInvoiceBillingLinkPending,
  TrialInvoiceReconciliationRequired,
} from "../src/lib/stripe/trial-invoice"
import {
  isInitialTrialInvoiceBindingRetry,
  respondToStripeWebhookFailure,
} from "../src/lib/stripe/webhook-failure"

const created = 1900000000
function event() {
  return {
    id: "evt_initial",
    livemode: true,
    type: "invoice.payment_succeeded",
    created,
    data: {
      object: {
        id: "in_initial",
        livemode: true,
        object: "invoice",
        status: "paid",
        billing_reason: "subscription_create",
        amount_due: 0,
        amount_paid: 0,
        amount_remaining: 0,
        total: 0,
        currency: "eur",
        collection_method: "charge_automatically",
        parent: {
          subscription_details: {
            subscription: "sub_initial",
            metadata: {
              trial_cohort: "trial_v1",
              trial_enrollment_id: "enrollment_initial",
            },
          },
        },
      },
    },
  } as unknown as Stripe.Event
}
const pending = () => new TrialInvoiceBillingLinkPending("sub_initial", "enrollment_initial", true)

for (const age of [0, 1, 119, 120]) {
  test(`initial typed binding retry at ${age}s is warning-only`, () => {
    assert.equal(
      isInitialTrialInvoiceBindingRetry(event(), pending(), (created + age) * 1000),
      true,
    )
  })
}
for (const age of [-1, 120.001, 121, 3600, NaN, Infinity]) {
  test(`age ${age} does not suppress the failure`, () => {
    assert.equal(
      isInitialTrialInvoiceBindingRetry(event(), pending(), (created + age) * 1000),
      false,
    )
  })
}
for (const [name, change] of Object.entries({
  "wrong event mode": { livemode: false },
  "missing event mode": { livemode: undefined },
  failure: { type: "invoice.payment_failed" },
  "missing timestamp": { created: undefined },
  "fractional timestamp": { created: created + 0.5 },
  "zero timestamp": { created: 0 },
})) {
  test(`${name} alerts`, () => {
    assert.equal(
      isInitialTrialInvoiceBindingRetry(Object.assign(event(), change), pending(), created * 1000),
      false,
    )
  })
}
for (const [name, change] of Object.entries({
  "wrong invoice mode": { livemode: false },
  "missing invoice mode": { livemode: undefined },
  "nonzero due": { amount_due: 1 },
  "nonzero paid": { amount_paid: 1 },
  "nonzero remaining": { amount_remaining: 1 },
  "nonzero total": { total: 1 },
  "missing total": { total: undefined },
  "string amount": { amount_due: "0" },
  "unpaid status": { status: "open" },
  renewal: { billing_reason: "subscription_cycle" },
  "wrong currency": { currency: "usd" },
  "manual collection": { collection_method: "send_invoice" },
  "wrong object": { object: "charge" },
  "missing invoice id": { id: undefined },
  "missing parent": { parent: null },
  "conflicting marker": { metadata: { trial_enrollment_id: "different" } },
  "conflicting agreement": { subscription: "sub_other" },
  "continuation marker": { metadata: { trial_continuation_role: "paid_successor" } },
  "recovery marker": { metadata: { trial_paid_recovery_operation_id: "op_1" } },
})) {
  test(`${name} alerts`, () => {
    const e = event()
    Object.assign(e.data.object, change)
    assert.equal(isInitialTrialInvoiceBindingRetry(e, pending(), created * 1000), false)
  })
}
test("only the typed reason with matching agreement and enrollment can suppress", () => {
  for (const error of [
    new Error("missing binding"),
    new TrialInvoiceReconciliationRequired(),
    { name: "TrialInvoiceBillingLinkPending" },
    new TrialInvoiceBillingLinkPending("other", "enrollment_initial", true),
    new TrialInvoiceBillingLinkPending("sub_initial", "other", true),
  ]) {
    assert.equal(isInitialTrialInvoiceBindingRetry(event(), error, created * 1000), false)
  }
})

for (const shouldWarn of [true, false]) {
  test(`failure boundary releases claim, ${shouldWarn ? "warns" : "captures"} and returns HTTP 500`, async () => {
    const calls: string[] = []
    const diagnostics: unknown[] = []
    const response = await respondToStripeWebhookFailure(
      event(),
      shouldWarn ? pending() : new TrialInvoiceReconciliationRequired(),
      {
        now: () => created * 1000,
        releaseClaim: async () => {
          calls.push("release")
        },
        captureFailure: () => {
          calls.push("capture")
        },
        warn: (...args: unknown[]) => {
          calls.push("warn")
          diagnostics.push(args)
        },
        error: () => {
          calls.push("error")
        },
      },
    )
    assert.equal(response.status, 500)
    assert.match(await response.text(), /requires reconciliation/)
    assert.deepEqual(calls, shouldWarn ? ["release", "warn"] : ["release", "capture", "error"])
    if (shouldWarn)
      assert.deepEqual(diagnostics, [
        [
          "[stripe:webhook] retry pending",
          {
            eventId: "evt_initial",
            type: "invoice.payment_succeeded",
            invoiceId: "in_initial",
            reason: "billing_link_pending",
            retryClassification: "initial_trial_binding_grace",
          },
        ],
      ])
  })
}

test("failed claim release cannot become a warning-only response", async () => {
  const calls: string[] = []
  await assert.rejects(
    respondToStripeWebhookFailure(event(), pending(), {
      now: () => created * 1000,
      releaseClaim: async () => {
        throw new Error("claim release failed")
      },
      captureFailure: () => {
        calls.push("capture")
      },
      warn: () => {
        calls.push("warn")
      },
      error: () => {
        calls.push("error")
      },
    }),
    /claim release failed/,
  )
  assert.deepEqual(calls, [])
})

test("malformed invoice object fails closed", () => {
  const e = event()
  Object.assign(e.data, { object: null })
  assert.equal(isInitialTrialInvoiceBindingRetry(e, pending(), created * 1000), false)
})

for (const scenario of ["stale", "nonzero"]) {
  test(`${scenario} typed pending failure still captures and returns 500`, async () => {
    const e = event()
    if (scenario === "nonzero") Object.assign(e.data.object, { amount_due: 1 })
    const calls: string[] = []
    const response = await respondToStripeWebhookFailure(e, pending(), {
      now: () => (created + (scenario === "stale" ? 121 : 1)) * 1000,
      releaseClaim: async () => {
        calls.push("release")
      },
      captureFailure: () => {
        calls.push("capture")
      },
      warn: () => {
        calls.push("warn")
      },
      error: (_message, context) => {
        calls.push("error")
        assert.deepEqual(context, {
          eventId: "evt_initial",
          type: "invoice.payment_succeeded",
          invoiceId: "in_initial",
          reason: "billing_link_pending",
          retryClassification: "alert",
        })
      },
    })
    assert.equal(response.status, 500)
    assert.deepEqual(calls, ["release", "capture", "error"])
  })
}

test("null invoice failure still releases, captures and returns 500", async () => {
  const e = event()
  Object.assign(e.data, { object: null })
  const calls: string[] = []
  const response = await respondToStripeWebhookFailure(e, pending(), {
    now: () => created * 1000,
    releaseClaim: async () => {
      calls.push("release")
    },
    captureFailure: () => {
      calls.push("capture")
    },
    warn: () => {
      calls.push("warn")
    },
    error: (_message, context) => {
      calls.push("error")
      assert.equal(context.invoiceId, undefined)
      assert.equal(context.retryClassification, "alert")
    },
  })
  assert.equal(response.status, 500)
  assert.deepEqual(calls, ["release", "capture", "error"])
})
