import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import {
  beginStripeTrialPaidRecovery,
  reconcileStripeTrialPaidRecovery,
  handleStripeTrialPaidRecoveryInvoice,
} from "../src/lib/stripe/trial-paid-recovery"

function fixture(kind: "recover_unpaid" | "repair_paid" = "recover_unpaid") {
  const runtime: TrialRuntime = {
    stripeAccountId: "acct_1",
    livemode: true,
    identityKeys: [],
    enrollmentMode: "disabled",
    allowedEmails: [],
    catalog: { monthPriceId: "price_month", yearPriceId: "price_year", annualCouponId: "coupon" },
  }
  const offer = createTrialOfferSnapshot("year", runtime.catalog)
  const op: any = {
    id: "op_1",
    enrollmentId: "enr_1",
    userId: "user_1",
    kind,
    status: "pending",
    expectedRevision: 0,
    cancellationVersion: 1,
    provider: "stripe",
    providerCustomerId: "cus_1",
    originalAgreementId: "sub_old",
    sourceAgreementId: "sub_old",
    originalTrialEndAt: "2026-01-08T12:00:00Z",
    offer,
    cancelAtPeriodEnd: false,
    targetAgreementId: null,
    firstPaymentSucceededAt: kind === "repair_paid" ? "2026-01-10T12:00:00Z" : null,
    paidThroughAt: kind === "repair_paid" ? "2099-01-10T12:00:00Z" : null,
    sourceObjectId: kind === "repair_paid" ? "in_old" : null,
  }
  const boundary = Date.parse("2027-01-08T12:00:00Z") / 1000,
    paidAt = Date.parse("2026-01-10T12:00:00Z") / 1000
  let request: any = null,
    session: any = null,
    target: any = null
  const state = {
    allowed: true,
    commit: true,
    loseSession: false,
    loseSubscription: false,
    loseCommit: false,
    paid: true,
    oldProcessing: false,
    oldOpen: false,
    oldVoided: false,
    oldPaid: kind === "repair_paid",
    wrongCustomer: false,
    canceled: false,
  }
  const calls: Array<{ name: string; args?: any }> = []
  const price = {
    id: "price_year",
    active: true,
    livemode: true,
    type: "recurring",
    currency: "eur",
    unit_amount: 9999,
    tax_behavior: "inclusive",
    billing_scheme: "per_unit",
    tiers_mode: null,
    custom_unit_amount: null,
    transform_quantity: null,
    product: { id: "prod_1", active: true },
    recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
  }
  const source: any = {
    id: "sub_old",
    status: "canceled",
    customer: "cus_1",
    livemode: true,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: "enr_1" },
    collection_method: "charge_automatically",
    automatic_tax: { enabled: true },
    items: {
      has_more: false,
      data: [{ id: "si_old", price, quantity: 1, discounts: [], current_period_end: boundary }],
    },
  }
  const invoice = (subscription = "sub_new") => ({
    id: subscription === "sub_new" ? "in_1" : "in_old",
    status: state.paid ? "paid" : "open",
    livemode: true,
    customer: "cus_1",
    parent: { subscription_details: { subscription } },
    currency: "eur",
    collection_method: "charge_automatically",
    amount_paid: state.paid ? 6999 : 0,
    amount_due: 6999,
    amount_remaining: state.paid ? 0 : 6999,
    lines: {
      has_more: false,
      data: [
        {
          quantity: 1,
          pricing: { price_details: { price: "price_year" } },
          parent: {
            subscription_item_details: {
              subscription,
              subscription_item: subscription === "sub_new" ? "si_1" : "si_old",
              proration: false,
            },
          },
          period: { start: Date.parse("2026-01-08T12:00:00Z") / 1000, end: boundary },
        },
      ],
    },
  })
  const client = {
    rpc: async (name: string, args: any) => {
      calls.push({ name, args })
      if (name === "load_trial_paid_recovery_operation") return { error: null, data: op }
      if (name === "guard_trial_paid_recovery_operation")
        return { error: null, data: state.allowed }
      if (name === "load_stripe_trial_paid_recovery_request") return { error: null, data: request }
      if (name === "freeze_stripe_trial_paid_recovery_request") {
        request ??= {
          operation_id: op.id,
          user_id: op.userId,
          session_params: args.p_session_params,
          session_id: null,
          session_create_started_at: new Date().toISOString(),
          subscription_id: null,
          subscription_params: null,
          subscription_create_started_at: null,
          status: "pending",
        }
        return { error: null, data: request }
      }
      if (name === "checkpoint_stripe_trial_paid_recovery_request") {
        if (args.p_action === "session") request.session_id = args.p_provider_id
        if (args.p_action === "begin_subscription") {
          request.subscription_params = args.p_params
          request.subscription_create_started_at ??= new Date().toISOString()
        }
        if (args.p_action === "subscription") request.subscription_id = args.p_provider_id
        if (args.p_action === "resolved") request.status = "resolved"
        if (args.p_action === "canceled") request.status = "canceled"
        return { error: null, data: true }
      }
      if (name === "commit_trial_paid_recovery_operation") {
        if (state.commit) {
          op.status = "committed"
          op.targetAgreementId = target.id
        }
        if (state.loseCommit) throw new Error("lost commit response")
        return { error: null, data: state.commit }
      }
      if (name === "abandon_trial_paid_recovery_operation") {
        op.status = "abandoned"
        return { error: null, data: true }
      }
      if (name === "record_trial_payment_event")
        return { error: null, data: { outcome: "applied", phase: "first_paid" } }
      throw new Error(name)
    },
  }
  const makeTarget = (metadata: any, anchor = boundary) => ({
    ...source,
    id: "sub_new",
    status: "active",
    metadata,
    trial_start: null,
    trial_end: null,
    cancel_at: null,
    cancel_at_period_end: false,
    billing_cycle_anchor: anchor,
    billing_mode: { type: "flexible" },
    default_payment_method: "pm_1",
    discounts: [],
    items: {
      has_more: false,
      data: [{ id: "si_1", price, quantity: 1, discounts: [], current_period_end: anchor }],
    },
  })
  const stripe = {
    accounts: { retrieve: async () => ({ id: "acct_1" }) },
    customers: { retrieve: async () => ({ id: "cus_1", deleted: false, discount: null }) },
    prices: { retrieve: async () => price },
    coupons: {
      retrieve: async () => ({
        id: "coupon",
        valid: true,
        livemode: true,
        currency: "eur",
        amount_off: 3000,
        percent_off: null,
        duration: "once",
        applies_to: { products: ["prod_1"] },
      }),
    },
    checkout: {
      sessions: {
        retrieve: async () => session,
        list: async () => ({ has_more: false, data: session ? [session] : [] }),
        expire: async () => {
          calls.push({ name: "expire" })
          session.status = "expired"
          return session
        },
        create: async (args: any, options: any) => {
          calls.push({ name: "create_session", args: { ...args, options } })
          session = {
            id: "cs_1",
            mode: args.mode,
            status: "open",
            livemode: true,
            customer: "cus_1",
            client_reference_id: op.id,
            metadata: args.metadata,
            url: "https://checkout.stripe.com/approved",
            setup_intent: "seti_1",
            subscription: null,
            invoice: "in_1",
            payment_status: "paid",
            amount_total: 6999,
            currency: "eur",
          }
          if (state.loseSession) throw new Error("response lost")
          return session
        },
      },
    },
    setupIntents: {
      retrieve: async () => ({
        id: "seti_1",
        status: "succeeded",
        customer: "cus_1",
        livemode: true,
        usage: "off_session",
        payment_method: "pm_1",
        metadata: { trial_paid_recovery_operation_id: op.id },
      }),
    },
    paymentMethods: {
      retrieve: async () => ({ id: "pm_1", customer: "cus_1", type: "card", livemode: true }),
    },
    subscriptions: {
      retrieve: async (id: string) => (id === "sub_old" ? source : target),
      list: async () => ({ has_more: false, data: target ? [source, target] : [source] }),
      update: async (_id: string, args: any) => {
        calls.push({ name: "update_source", args })
        source.metadata = { ...source.metadata, ...args.metadata }
        return source
      },
      cancel: async (id: string, args: any) => {
        calls.push({ name: "cancel", args })
        const s = id === source.id ? source : target
        s.status = "canceled"
        s.cancellation_details = args.cancellation_details
        state.canceled = true
        return s
      },
      create: async (args: any, options: any) => {
        calls.push({ name: "create_subscription", args: { ...args, options } })
        target = makeTarget(args.metadata, args.billing_cycle_anchor)
        if (state.loseSubscription) throw new Error("response lost")
        return target
      },
    },
    invoices: {
      retrieve: async (id: string) =>
        id === "in_old" && state.oldVoided
          ? { ...invoice("sub_old"), status: "void", amount_paid: 0, amount_remaining: 0 }
          : invoice(id === "in_old" ? "sub_old" : "sub_new"),
      voidInvoice: async () => {
        calls.push({ name: "void_invoice" })
        state.oldVoided = true
        return { ...invoice("sub_old"), status: "void", amount_paid: 0, amount_remaining: 0 }
      },
      list: async (args: any) => ({
        has_more: false,
        data:
          args.subscription === "sub_old"
            ? state.oldVoided
              ? [{ ...invoice("sub_old"), status: "void", amount_paid: 0, amount_remaining: 0 }]
              : state.oldPaid
                ? [invoice("sub_old")]
                : state.oldProcessing || state.oldOpen
                  ? [
                      {
                        ...invoice("sub_old"),
                        status: "open",
                        amount_paid: 0,
                        amount_remaining: 6999,
                      },
                    ]
                  : []
            : kind === "recover_unpaid"
              ? [invoice()]
              : [],
      }),
    },
    invoicePayments: {
      list: async (args: any) => ({
        has_more: false,
        data: [
          {
            id: "inpay_1",
            invoice: args.invoice,
            status: "paid",
            livemode: true,
            currency: "eur",
            amount_paid: 6999,
            payment: { type: "payment_intent", payment_intent: "pi_1" },
            status_transitions: { paid_at: paidAt },
          },
        ],
      }),
    },
    paymentIntents: {
      retrieve: async () => ({
        id: "pi_1",
        customer: state.wrongCustomer ? "cus_other" : "cus_1",
        status: state.oldVoided
          ? "canceled"
          : state.oldOpen
            ? "requires_payment_method"
            : state.oldProcessing
              ? "processing"
              : "succeeded",
        livemode: true,
        amount_received: state.oldProcessing || state.oldOpen || state.oldVoided ? 0 : 6999,
        currency: "eur",
        latest_charge: {
          paid: true,
          captured: true,
          disputed: false,
          amount_refunded: 0,
          amount_captured: 6999,
        },
      }),
    },
  }
  const input = {
    operationId: op.id,
    authenticatedUserId: op.userId,
    client,
    stripe: stripe as unknown as Stripe,
    runtime,
  }
  const start = () =>
    beginStripeTrialPaidRecovery({
      ...input,
      successUrl: "https://chaarlie.de/profile",
      cancelUrl: "https://chaarlie.de/profile",
    })
  const complete = () => {
    session.status = "complete"
    if (kind === "recover_unpaid") {
      target = makeTarget(session.metadata)
      session.subscription = target.id
    }
  }
  return {
    start,
    complete,
    run: () => reconcileStripeTrialPaidRecovery(input),
    input,
    op,
    state,
    calls,
    source,
    request: () => request,
    session: () => session,
    target: () => target,
  }
}

test("fresh recovery requires paid Checkout with frozen once coupon and no new trial", async () => {
  const f = fixture()
  f.source.status = "past_due"
  assert.equal((await f.start()).status, "approval_required")
  const params = f.calls.find((c) => c.name === "create_session")!.args
  assert.equal(params.mode, "subscription")
  assert.deepEqual(params.discounts, [{ coupon: "coupon" }])
  assert.deepEqual(params.line_items, [{ price: "price_year", quantity: 1 }])
  assert.equal(params.subscription_data.trial_end, undefined)
  assert.equal(params.subscription_data.billing_cycle_anchor, undefined)
  assert.equal(f.source.status, "canceled")
  assert.equal(f.source.cancellation_details.comment, "trial-paid-recovery:op_1")
  assert.equal(
    f.calls.some((c) => c.name === "commit_trial_paid_recovery_operation"),
    false,
  )
})
test("delayed verified first payment submits actual invoice bounds and payment time to atomic ledger", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  assert.equal((await f.run()).status, "committed")
  const args = f.calls.find((c) => c.name === "commit_trial_paid_recovery_operation")!.args
  assert.equal(args.p_payment.agreementId, "sub_new")
  assert.equal(args.p_payment.occurredAt, "2026-01-10T12:00:00.000Z")
  assert.equal(args.p_payment.periodStartAt, "2026-01-08T12:00:00.000Z")
  assert.equal(args.p_payment.periodEndAt, "2027-01-08T12:00:00.000Z")
  assert.equal(args.p_evidence.firstBillingAt, args.p_payment.occurredAt)
  assert.equal((await f.run()).status, "committed")
  assert.equal(f.calls.filter((c) => c.name === "commit_trial_paid_recovery_operation").length, 1)
})
test("lost Checkout response is discovered without a second session", async () => {
  const f = fixture()
  f.state.loseSession = true
  assert.equal((await f.start()).status, "pending")
  f.state.loseSession = false
  assert.equal((await f.start()).status, "approval_required")
  assert.equal(f.calls.filter((c) => c.name === "create_session").length, 1)
})
test("expired create window is not retried after provider key retention", async () => {
  const f = fixture()
  f.state.loseSession = true
  await f.start()
  f.request().session_create_started_at = "2000-01-01T00:00:00Z"
  // Existing session still recovers even outside the create window.
  assert.equal((await f.run()).status, "approval_required")
  assert.equal(f.calls.filter((c) => c.name === "create_session").length, 1)
})
test("processing old source stops all neutralization and replacement", async () => {
  const f = fixture()
  f.state.oldProcessing = true
  f.source.status = "past_due"
  assert.equal((await f.start()).status, "pending")
  assert.equal(
    f.calls.some((c) => ["cancel", "create_session"].includes(c.name)),
    false,
  )
})
test("old source successful payment is recorded and recovery abandoned before another Checkout", async () => {
  const f = fixture()
  f.state.oldPaid = true
  assert.equal((await f.start()).status, "abandoned")
  assert.equal(
    f.calls.find((c) => c.name === "record_trial_payment_event")!.args.p_event.agreementId,
    "sub_old",
  )
  assert.equal(
    f.calls.some((c) => c.name === "create_session"),
    false,
  )
})
test("wrong payment customer cannot bind or grant access", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.wrongCustomer = true
  assert.equal((await f.run()).status, "pending")
  assert.equal(
    f.calls.some((c) => c.name === "commit_trial_paid_recovery_operation"),
    false,
  )
})
test("cancellation while approval open expires Checkout and abandons without collection", async () => {
  const f = fixture()
  await f.start()
  f.state.allowed = false
  assert.equal((await f.run()).status, "abandoned")
  assert.equal(f.session().status, "expired")
  assert.equal(
    f.calls.some((c) => c.name === "commit_trial_paid_recovery_operation"),
    false,
  )
})
test("lost successful commit is recovered without canceling the paid membership", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.loseCommit = true
  assert.equal((await f.run()).status, "pending")
  assert.equal(f.state.canceled, false)
  assert.equal((await f.run()).status, "committed")
})
test("rejected paid candidate is neutralized but remains durable for money reconciliation", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.commit = false
  assert.equal((await f.run()).status, "pending")
  assert.equal(f.target().status, "canceled")
  assert.equal(f.op.status, "pending")
  assert.equal(
    f.calls.find((c) => c.name === "record_trial_payment_event")!.args.p_event.agreementId,
    "sub_new",
  )
})
test("already paid recovery uses setup then original owed boundary with no coupon or invoice", async () => {
  const f = fixture("repair_paid")
  assert.equal((await f.start()).status, "approval_required")
  assert.equal(f.request().session_params.mode, "setup")
  assert.equal(f.request().session_params.line_items, undefined)
  f.complete()
  assert.equal((await f.run()).status, "committed")
  const params = f.calls.find((c) => c.name === "create_subscription")!.args
  assert.equal(params.billing_cycle_anchor, Date.parse(f.op.paidThroughAt) / 1000)
  assert.equal(params.proration_behavior, "none")
  assert.equal(params.discounts, undefined)
  assert.equal(params.trial_end, undefined)
  const args = f.calls.find((c) => c.name === "commit_trial_paid_recovery_operation")!.args
  assert.equal(args.p_payment, null)
  assert.equal(args.p_evidence.noAdditionalCharge, true)
})
test("lost repair creation is discovered and never creates another successor", async () => {
  const f = fixture("repair_paid")
  await f.start()
  f.complete()
  f.state.loseSubscription = true
  assert.equal((await f.run()).status, "pending")
  f.state.loseSubscription = false
  assert.equal((await f.run()).status, "committed")
  assert.equal(f.calls.filter((c) => c.name === "create_subscription").length, 1)
})
test("invoice hook acknowledges original recovered charge but lets later renewal use normal ledger", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  await f.run()
  assert.equal(
    (
      await handleStripeTrialPaidRecoveryInvoice({
        ...f.input,
        subscriptionId: "sub_new",
        invoiceId: "in_1",
      })
    )?.status,
    "committed",
  )
  assert.equal(
    await handleStripeTrialPaidRecoveryInvoice({
      ...f.input,
      subscriptionId: "sub_new",
      invoiceId: "in_renewal",
    }),
    null,
  )
})

test("open failed invoice is voided and its intent verified canceled before fresh Checkout", async () => {
  const f = fixture()
  f.state.oldOpen = true
  f.source.status = "past_due"
  assert.equal((await f.start()).status, "approval_required")
  const writes = f.calls
    .filter((c) => ["void_invoice", "cancel", "create_session"].includes(c.name))
    .map((c) => c.name)
  assert.deepEqual(writes, ["void_invoice", "cancel", "create_session"])
  assert.equal(f.state.oldVoided, true)
})
