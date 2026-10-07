import assert from "node:assert/strict"
import test from "node:test"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  beginPayPalTrialPaidRecovery as begin,
  reconcilePayPalTrialPaidRecovery as reconcile,
  abandonPayPalTrialPaidRecovery as abandon,
  paypalPaidPeriodEnd,
  paypalPaidRecoveryOverrides,
  assertPayPalPaidRecoveryPlan,
} from "../src/lib/paypal/trial-paid-recovery"
function fixture(kind: "recover_unpaid" | "repair_paid" = "recover_unpaid") {
  const now = new Date(Math.floor(Date.now() / 1000) * 1000 - 5000).toISOString(),
    offer = createTrialOfferSnapshot("year", {
      monthPriceId: "month",
      yearPriceId: "year",
      annualCouponId: "coupon",
    })
  const op: any = {
    id: "op",
    enrollmentId: "enroll",
    userId: "user",
    kind,
    status: "pending",
    provider: "paypal",
    providerCustomerId: "payer",
    originalAgreementId: "old",
    sourceAgreementId: "old",
    offer,
    originalTrialEndAt: new Date(Date.now() - 86400000).toISOString(),
    expectedRevision: 0,
    cancellationVersion: 0,
    cancelAtPeriodEnd: false,
    firstPaymentSucceededAt: kind === "repair_paid" ? now : null,
    paidThroughAt: kind === "repair_paid" ? paypalPaidPeriodEnd(now, "year") : null,
    sourceObjectId: kind === "repair_paid" ? "paid-old" : null,
    targetAgreementId: null,
  }
  const plan = (setup = 0) => ({
    product_id: "product",
    status: "ACTIVE",
    billing_cycles: [
      {
        sequence: 1,
        tenure_type: "REGULAR",
        total_cycles: 0,
        frequency: { interval_unit: "YEAR", interval_count: 1 },
        pricing_scheme: { fixed_price: { value: "99.99", currency_code: "EUR" } },
      },
    ],
    payment_preferences: {
      setup_fee: { value: (setup / 100).toFixed(2), currency_code: "EUR" },
      setup_fee_failure_action: "CANCEL",
    },
    taxes: { percentage: "0.0", inclusive: true },
  })
  const subs: any = {
      old: {
        id: "old",
        plan_id: "initial",
        status: "ACTIVE",
        subscriber: { payer_id: "payer" },
        create_time: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
    },
    tx: any = { old: [], new: [] },
    calls: any[] = []
  let f: any = null,
    guard = true,
    sourceVerified = true,
    projectionFails = false
  const tables: any = {
    billing_subscriptions: [
      {
        id: "billing-old",
        user_id: "user",
        provider: "paypal",
        provider_subscription_id: "old",
        provider_customer_id: "payer",
        trial_enrollment_id: "enroll",
        metadata: { trial_cohort: "trial_v1" },
      },
    ],
    trial_enrollments: [
      {
        id: "enroll",
        user_id: "user",
        paid_through_at: op.paidThroughAt,
        first_payment_succeeded_at: op.firstPaymentSucceededAt,
        cancel_at_period_end: false,
      },
    ],
    profiles: [{ id: "user" }],
  }
  const from = (table: string) => {
    let p: any = null,
      up = false,
      single = false
    const filters: any[] = []
    const q: any = {
      select() {
        return q
      },
      eq(k: string, v: any) {
        filters.push((r: any) => r[k] === v)
        return q
      },
      single() {
        single = true
        return q
      },
      maybeSingle() {
        single = true
        return q
      },
      update(v: any) {
        p = v
        return q
      },
      upsert(v: any) {
        p = v
        up = true
        return q
      },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => {
            if (projectionFails && up) throw new Error("projection unavailable")
            const rows = tables[table] ?? [],
              selected = rows.filter((r: any) => filters.every((f) => f(r)))
            if (up) {
              let row = rows.find(
                (r: any) => r.provider_subscription_id === p.provider_subscription_id,
              )
              if (!row) {
                row = { id: "new-billing" }
                rows.push(row)
              }
              Object.assign(row, p)
              return { data: single ? row : [row], error: null }
            }
            if (p) selected.forEach((r: any) => Object.assign(r, p))
            return { data: single ? selected[0] : selected, error: null }
          })
          .then(resolve, reject)
      },
    }
    return q
  }
  const deps: any = {
    supabase: {
      from,
      rpc: async (name: string, a: any) => {
        calls.push({ rpc: name, args: a })
        let data: any = null
        if (name === "load_trial_paid_recovery_operation") data = { ...op }
        else if (name === "guard_trial_paid_recovery_operation") data = guard
        else if (name === "get_paypal_trial_plan_catalog")
          data = {
            enrollment_id: "enroll",
            app_id: "app",
            product_id: "product",
            month_plan_id: "month",
            year_plan_id: "year",
          }
        else if (name === "get_paypal_trial_paid_recovery_request") data = f ? { ...f } : null
        else if (name === "freeze_paypal_trial_paid_recovery_request")
          data = f = {
            operation_id: "op",
            enrollment_id: "enroll",
            app_id: "app",
            product_id: "product",
            source_plan_id: a.p_source_plan_id,
            target_plan_id: a.p_target_plan_id,
            request_id: "stable",
            request_expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
            created_at: now,
            start_time: op.paidThroughAt ?? paypalPaidPeriodEnd(now, "year"),
            return_url: a.p_return_url,
            cancel_url: a.p_cancel_url,
            request_sent_at: null,
            target_agreement_id: null,
            approval_url: null,
          }
        else if (name === "claim_paypal_trial_paid_recovery_request") {
          data = !f.request_sent_at
          f.request_sent_at ??= now
        } else if (name === "claim_paypal_trial_paid_recovery_source_neutralization") data = guard
        else if (name === "bind_paypal_trial_paid_recovery_response") {
          f.target_agreement_id = a.p_target_agreement_id
          f.approval_url = a.p_approval_url
          data = { ...f }
        } else if (name === "verify_paypal_trial_paid_recovery_source_transactions")
          data = sourceVerified
        else if (name === "commit_trial_paid_recovery_operation") {
          data = guard
          if (data) {
            op.status = "committed"
            op.targetAgreementId = a.p_evidence.targetAgreementId
            if (a.p_payment) {
              tables.trial_enrollments[0].first_payment_succeeded_at = a.p_payment.occurredAt
              tables.trial_enrollments[0].paid_through_at = a.p_payment.periodEndAt
            }
          }
        } else if (name === "abandon_trial_paid_recovery_operation") {
          op.status = "abandoned"
          data = true
        } else throw new Error(name)
        return { data, error: null }
      },
    },
    premiumTierId: "premium",
    renewalAnnualPlanId: "renewal-year",
    attestApp: async () => "app",
    getPlan: async () => plan(),
    retrieve: async (id: string) => structuredClone(subs[id]),
    transactions: async (id: string) => structuredClone(tx[id]),
    cancel: async (id: string) => {
      calls.push({ cancel: id })
      subs[id].status = "CANCELLED"
    },
    patchStart: async (id: string, at: string) => {
      calls.push({ patch: id, at })
      subs[id].start_time = at
      subs[id].billing_info.next_billing_time = at
    },
    request: async (path: string, init: any) => {
      const body = JSON.parse(init.body)
      calls.push({ path, body, requestId: init.headers["PayPal-Request-Id"] })
      subs.new = {
        id: "new",
        plan_id: body.plan_id,
        custom_id: body.custom_id,
        start_time: body.start_time,
        create_time: now,
        status: "APPROVAL_PENDING",
        plan: plan(kind === "recover_unpaid" ? 6999 : 0),
        billing_info: { next_billing_time: body.start_time },
        links: [{ rel: "approve", href: "https://www.paypal.com/approve" }],
      }
      return structuredClone(subs.new)
    },
  }
  const input = {
    operationId: "op",
    authenticatedUserId: "user",
    returnUrl: "https://chaarlie.de/profile",
    cancelUrl: "https://chaarlie.de/profile",
  }
  function approve() {
    subs.new.status = "ACTIVE"
    subs.new.subscriber = { payer_id: "payer" }
    if (kind === "recover_unpaid")
      tx.new = [
        {
          id: "setup",
          time: new Date(Date.parse(now) + 2000).toISOString(),
          status: "COMPLETED",
          amount_with_breakdown: { gross_amount: { value: "69.99", currency_code: "EUR" } },
        },
      ]
  }
  return {
    deps,
    input,
    op,
    subs,
    tx,
    calls,
    tables,
    approve,
    plan,
    frozen: () => f,
    setGuard: (v: boolean) => (guard = v),
    setSourceVerified: (v: boolean) => (sourceVerified = v),
    setProjectionFail: (v: boolean) => (projectionFails = v),
  }
}
test("calendar periods clamp month and leap year using provider success", () => {
  assert.equal(paypalPaidPeriodEnd("2028-01-31T10:12:13Z", "month"), "2028-02-29T10:12:13.000Z")
  assert.equal(paypalPaidPeriodEnd("2028-02-29T10:12:13Z", "year"), "2029-02-28T10:12:13.000Z")
})
test("recovery uses explicit first price setup and REGULAR renewal-only annual plan", async () => {
  const f = fixture()
  const r = await begin(f.input, f.deps)
  assert.equal(r.status, "approval_required")
  const create = f.calls.find((c) => c.path)
  assert.equal(create.body.plan_id, "renewal-year")
  assert.deepEqual(create.body.plan, paypalPaidRecoveryOverrides(f.op.offer, "recover_unpaid"))
  assert.ok(f.calls.findIndex((c) => c.cancel) < f.calls.findIndex((c) => c.path))
  assert.equal(f.op.status, "pending")
})
test("verified setup payment patches a complete year before atomic paid commit", async () => {
  const f = fixture()
  await begin(f.input, f.deps)
  f.approve()
  assert.equal((await reconcile(f.input, f.deps)).status, "committed")
  const commit = f.calls.find((c) => c.rpc === "commit_trial_paid_recovery_operation")
  assert.equal(commit.args.p_payment.amountMinor, 6999)
  assert.equal(commit.args.p_payment.periodStartAt, f.tx.new[0].time)
  assert.equal(commit.args.p_payment.periodEndAt, f.subs.new.start_time)
  assert.equal(f.tables.billing_subscriptions.length, 2)
  assert.equal(f.tables.billing_subscriptions[0].metadata.trial_management_superseded_by, "new")
})
test("ACTIVE and browser approval without completed setup payment never grant paid access", async () => {
  const f = fixture()
  await begin(f.input, f.deps)
  f.approve()
  f.tx.new = []
  assert.equal((await reconcile(f.input, f.deps)).status, "pending")
  assert.equal(f.op.status, "pending")
})
test("repair preserves already-paid full period with zero setup and no second free week", async () => {
  const f = fixture("repair_paid")
  await begin(f.input, f.deps)
  const create = f.calls.find((c) => c.path)
  assert.equal(create.body.start_time, f.op.paidThroughAt)
  assert.equal(create.body.plan.payment_preferences.setup_fee.value, "0.00")
  f.approve()
  assert.equal((await reconcile(f.input, f.deps)).status, "committed")
  const commit = f.calls.find((c) => c.rpc === "commit_trial_paid_recovery_operation")
  assert.equal(commit.args.p_payment, null)
  assert.equal(commit.args.p_evidence.firstBillingAt, f.op.paidThroughAt)
  assert.equal(commit.args.p_evidence.noAdditionalCharge, true)
})
test("unknown/in-flight old collection blocks creating a second payment approval", async () => {
  const f = fixture()
  f.setSourceVerified(false)
  await assert.rejects(begin(f.input, f.deps), /source payment/)
  assert.equal(f.calls.filter((c) => c.path).length, 0)
})
test("lost create response retries exact durable body/id; lost PATCH succeeds only after GET proof", async () => {
  const f = fixture()
  const create = f.deps.request
  let first = true
  f.deps.request = async (...a: any[]) => {
    const s = await create(...a)
    if (first) {
      first = false
      throw new Error("lost response")
    }
    return s
  }
  await assert.rejects(begin(f.input, f.deps), /lost response/)
  await begin({ ...f.input, returnUrl: "https://different.example" }, f.deps)
  const c = f.calls.filter((c) => c.path)
  assert.deepEqual(c[0], c[1])
  f.approve()
  const patch = f.deps.patchStart
  f.deps.patchStart = async (...a: any[]) => {
    await patch(...a)
    throw new Error("lost patch")
  }
  assert.equal((await reconcile(f.input, f.deps)).status, "committed")
})
test("wrong payer, amount, or unverified future boundary cannot commit", async () => {
  for (const mismatch of ["payer", "amount", "boundary"]) {
    const f = fixture()
    await begin(f.input, f.deps)
    f.approve()
    if (mismatch === "payer") f.subs.new.subscriber.payer_id = "other"
    if (mismatch === "amount") f.tx.new[0].amount_with_breakdown.gross_amount.value = "99.99"
    if (mismatch === "boundary") f.deps.patchStart = async () => {}
    await assert.rejects(reconcile(f.input, f.deps))
    assert.equal(f.op.status, "pending")
  }
})
test("committed retry repairs interrupted billing projection", async () => {
  const f = fixture()
  await begin(f.input, f.deps)
  f.approve()
  f.setProjectionFail(true)
  await assert.rejects(reconcile(f.input, f.deps), /projection unavailable/)
  assert.equal(f.op.status, "committed")
  f.setProjectionFail(false)
  assert.equal((await reconcile(f.input, f.deps)).status, "committed")
  assert.equal(f.calls.filter((c) => c.rpc === "commit_trial_paid_recovery_operation").length, 1)
})
test("paid abandonment remains reconciliation debt; zero-charge candidate can abandon after cancellation", async () => {
  const paid = fixture()
  await begin(paid.input, paid.deps)
  paid.approve()
  assert.equal((await abandon(paid.input, paid.deps)).status, "reconciliation_required")
  const free = fixture("repair_paid")
  await begin(free.input, free.deps)
  assert.equal((await abandon(free.input, free.deps)).status, "abandoned")
  assert.equal(free.subs.new.status, "CANCELLED")
})
test("annual introductory paid cycle is rejected as renewal-only continuation", () => {
  const f = fixture()
  const p = f.plan()
  p.billing_cycles[0].tenure_type = "TRIAL"
  assert.throws(() => assertPayPalPaidRecoveryPlan(p, f.op.offer, "product", 0), /accepted terms/)
})

test("verified activation webhook completes paid recovery when the browser is gone", async () => {
  const { handlePayPalTrialWebhook } = await import("../src/lib/paypal/trial-webhook")
  const f = fixture()
  await begin(f.input, f.deps)
  f.approve()
  const rpc = f.deps.supabase.rpc
  f.deps.supabase.rpc = async (name: string, a: any) =>
    name === "find_paypal_trial_paid_recovery_callback"
      ? {
          data: { operationId: f.op.id, authenticatedUserId: f.op.userId, status: f.op.status },
          error: null,
        }
      : rpc(name, a)
  const deps: any = {
    supabase: f.deps.supabase,
    premiumTierId: "premium",
    attestPayPalApp: f.deps.attestApp,
    retrievePayPalSubscription: f.deps.retrieve,
    listPayPalTrialTransactions: f.deps.transactions,
    patchPayPalTrialStart: f.deps.patchStart,
    cancelPayPalSubscription: f.deps.cancel,
  }
  assert.equal(
    await handlePayPalTrialWebhook(
      { id: "verified-event", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: f.subs.new },
      f.subs.new,
      deps,
    ),
    true,
  )
  assert.equal(f.op.status, "committed")
  assert.equal(f.tables.billing_subscriptions.length, 2)
})

test("new cancellation wins paid recovery CAS and neutralizes candidate without inventing a refund", async () => {
  const f = fixture()
  await begin(f.input, f.deps)
  f.approve()
  f.setGuard(false)
  assert.equal((await reconcile(f.input, f.deps)).status, "reconciliation_required")
  assert.equal(f.subs.new.status, "CANCELLED")
  assert.equal(f.op.status, "pending")
  assert.equal(f.tx.new.length, 1)
})

test("paid recovery plan validation rejects malformed nested provider fields without permissive casts", () => {
  const f = fixture()
  assert.doesNotThrow(() => assertPayPalPaidRecoveryPlan(f.plan(), f.op.offer, "product", 0))
  for (const malformed of [null, [], "unexpected"]) {
    for (const field of ["frequency", "pricing_scheme"]) {
      const plan = f.plan()
      assert.throws(
        () =>
          assertPayPalPaidRecoveryPlan(
            { ...plan, billing_cycles: [{ ...plan.billing_cycles[0], [field]: malformed }] },
            f.op.offer,
            "product",
            0,
          ),
        /differs from accepted terms/,
      )
    }
    for (const field of ["billing_cycles", "payment_preferences", "taxes"]) {
      assert.throws(() =>
        assertPayPalPaidRecoveryPlan({ ...f.plan(), [field]: malformed }, f.op.offer, "product", 0),
      )
    }
  }
})
