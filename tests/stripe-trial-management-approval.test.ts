import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import {
  startStripeTrialManagementApproval,
  reconcileStripeTrialManagementApproval,
  handleStripeTrialManagementApprovalCompleted,
} from "../src/lib/stripe/trial-management-approval"

function fixture() {
  const runtime: TrialRuntime = {
    stripeAccountId: "acct_1",
    livemode: true,
    identityKeys: [],
    enrollmentMode: "disabled",
    allowedEmails: [],
    catalog: { monthPriceId: "price_month", yearPriceId: "price_year", annualCouponId: "coupon" },
  }
  const offer = createTrialOfferSnapshot("year", runtime.catalog)
  const op = {
    id: "op_1",
    enrollmentId: "enr_1",
    userId: "user_1",
    kind: "restore",
    status: "pending",
    expectedRevision: 0,
    cancellationVersion: 1,
    provider: "stripe",
    providerCustomerId: "cus_1",
    originalAgreementId: "sub_old",
    sourceAgreementId: "sub_old",
    originalTrialEndAt: "2099-01-08T12:00:00Z",
    sourceOffer: offer,
    targetOffer: offer,
    cancelAtPeriodEnd: false,
    targetAgreementId: null,
  }
  const anchor = Date.parse(op.originalTrialEndAt) / 1000
  let approval: any = null,
    session: any = null,
    target: any = null
  const state = {
    allowed: true,
    commit: true,
    committed: false,
    loseSession: false,
    loseSubscription: false,
    cancel: false,
    merchant: "acct_1",
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
  const source = {
    id: "sub_old",
    status: "canceled",
    customer: "cus_1",
    livemode: true,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: "enr_1" },
  }
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      if (name === "load_trial_management_operation")
        return {
          error: null,
          data: {
            ...op,
            status: state.committed ? "committed" : "pending",
            targetAgreementId: state.committed ? target.id : null,
          },
        }
      if (name === "guard_trial_management_operation") return { error: null, data: state.allowed }
      if (name === "load_stripe_trial_management_approval") return { error: null, data: approval }
      if (name === "freeze_stripe_trial_management_approval") {
        approval ??= {
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
        return { error: null, data: approval }
      }
      if (name === "checkpoint_stripe_trial_management_approval") {
        if (args.p_action === "session") approval.session_id = args.p_provider_id
        if (args.p_action === "begin_subscription") {
          approval.subscription_params = args.p_params
          approval.subscription_create_started_at ??= new Date().toISOString()
        }
        if (args.p_action === "subscription") approval.subscription_id = args.p_provider_id
        if (args.p_action === "resolved") approval.status = "resolved"
        if (args.p_action === "canceled") approval.status = "canceled"
        return { error: null, data: true }
      }
      if (name === "commit_trial_management_operation") {
        state.committed = state.commit
        return { error: null, data: state.commit }
      }
      throw new Error(name)
    },
  }
  const stripe = {
    accounts: { retrieve: async () => ({ id: state.merchant }) },
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
        create: async (args: any, options: any) => {
          calls.push({ name: "create_session", args: { ...args, options } })
          session = {
            id: "cs_1",
            mode: "setup",
            status: "open",
            livemode: true,
            customer: "cus_1",
            client_reference_id: op.id,
            metadata: args.metadata,
            url: "https://checkout.stripe.com/approved",
            setup_intent: "seti_1",
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
        metadata: { trial_management_operation_id: op.id },
      }),
    },
    paymentMethods: {
      retrieve: async () => ({ id: "pm_1", customer: "cus_1", type: "card", livemode: true }),
    },
    subscriptions: {
      retrieve: async (id: string) => (id === "sub_old" ? source : target),
      list: async () => ({ has_more: false, data: target ? [source, target] : [source] }),
      cancel: async () => {
        state.cancel = true
        target.status = "canceled"
        return target
      },
      create: async (args: any, options: any) => {
        calls.push({ name: "create_subscription", args: { ...args, options } })
        target = {
          id: "sub_new",
          customer: "cus_1",
          livemode: true,
          metadata: args.metadata,
          status: "active",
          billing_mode: { type: "flexible" },
          billing_cycle_anchor: anchor,
          trial_start: null,
          trial_end: null,
          automatic_tax: { enabled: true },
          cancel_at: null,
          cancel_at_period_end: false,
          default_payment_method: "pm_1",
          discounts: [{ id: "di_1", source: { coupon: "coupon" } }],
          items: {
            has_more: false,
            data: [{ id: "si_1", price, quantity: 1, discounts: [], current_period_end: anchor }],
          },
        }
        if (state.loseSubscription) throw new Error("response lost")
        return target
      },
    },
    invoices: {
      list: async () => ({ has_more: false, data: [] }),
      createPreview: async () => ({ currency: "eur", total: 6999, amount_due: 6999 }),
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
    startStripeTrialManagementApproval({
      ...input,
      successUrl: "https://chaarlie.de/profile?trialManagement=op_1",
      cancelUrl: "https://chaarlie.de/profile?trialManagement=op_1",
    })
  const run = () => reconcileStripeTrialManagementApproval(input)
  return {
    start,
    run,
    input,
    calls,
    state,
    source,
    anchor,
    complete: () => {
      session.status = "complete"
    },
    approval: () => approval,
  }
}

test("canceled source gets hosted setup approval; no payment or new trial is created", async () => {
  const f = fixture()
  assert.equal((await f.start()).status, "approval_required")
  const request = f.calls.find((c) => c.name === "create_session")!.args
  assert.equal(request.mode, "setup")
  assert.equal(request.customer, "cus_1")
  assert.equal(request.ui_mode, "hosted_page")
  assert.equal(request.line_items, undefined)
  assert.equal(request.subscription_data, undefined)
  assert.match(request.custom_text.submit.message, /69,99 €.*99,99 €/)
  assert.equal(f.calls.filter((c) => c.name === "create_subscription").length, 0)
})

test("verified SetupIntent restores only remaining original time with first-paid coupon and no new free cycle", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  assert.equal((await f.run()).status, "committed")
  const request = f.calls.find((c) => c.name === "create_subscription")!.args
  assert.equal(request.billing_cycle_anchor, Date.parse("2099-01-08T12:00:00Z") / 1000)
  assert.equal(request.proration_behavior, "none")
  assert.equal(request.trial_end, undefined)
  assert.equal(request.trial_period_days, undefined)
  assert.deepEqual(request.discounts, [{ coupon: "coupon" }])
  const committed = f.calls.find((c) => c.name === "commit_trial_management_operation")!.args
    .p_evidence
  assert.equal(committed.noImmediatePayment, true)
  assert.equal(committed.sourceAgreementNeutralized, true)
  assert.equal(committed.originalTrialEndAt, "2099-01-08T12:00:00Z")
})

test("lost setup session response recovers the original hosted session", async () => {
  const f = fixture()
  f.state.loseSession = true
  assert.equal((await f.start()).status, "pending")
  f.state.loseSession = false
  assert.equal((await f.start()).status, "approval_required")
  assert.equal(f.calls.filter((c) => c.name === "create_session").length, 1)
})

test("lost replacement response adopts one operation-tagged subscription", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.loseSubscription = true
  assert.equal((await f.run()).status, "pending")
  f.state.loseSubscription = false
  assert.equal((await f.run()).status, "committed")
  assert.equal(f.calls.filter((c) => c.name === "create_subscription").length, 1)
})

test("new cancellation beats approved setup and prevents a new collectible agreement", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.allowed = false
  assert.equal((await f.run()).status, "pending")
  assert.equal(f.calls.filter((c) => c.name === "create_subscription").length, 0)
})

test("cancellation after uncertain creation discovers and cancels the replacement", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.loseSubscription = true
  await f.run()
  f.state.allowed = false
  assert.equal((await f.run()).status, "pending")
  assert.equal(f.state.cancel, true)
})

test("rejected management CAS neutralizes the replacement without shortening paid access or extending trial", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  f.state.commit = false
  assert.equal((await f.run()).status, "pending")
  assert.equal(f.state.cancel, true)
})

test("completed setup webhook resolves owner from the durable record and commits provider proof", async () => {
  const f = fixture()
  await f.start()
  f.complete()
  const result = await handleStripeTrialManagementApprovalCompleted({
    ...f.input,
    sessionId: "cs_1",
  })
  assert.equal(result?.status, "committed")
})

test("noncanceled old source cannot be replaced by setup approval", async () => {
  const f = fixture()
  f.source.status = "trialing"
  assert.equal((await f.start()).status, "pending")
  assert.equal(f.calls.filter((c) => c.name === "create_session").length, 0)
})
