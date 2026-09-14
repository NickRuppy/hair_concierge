import assert from "node:assert/strict"
import test from "node:test"
import { ensureCheckoutAccount } from "../src/lib/stripe/checkout-activation"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

const userId = "00000000-0000-4000-8000-000000000001"
const enrollmentId = "00000000-0000-4000-8000-000000000002"
const start = Date.parse("2026-09-14T12:00:00Z") / 1000
const end = start + 604800

function fixture() {
  const offer = createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_intro",
  })
  const metadata = { trial_cohort: "trial_v1", trial_enrollment_id: enrollmentId }
  const session: any = {
    id: "cs_trial",
    mode: "subscription",
    status: "complete",
    payment_status: "no_payment_required",
    amount_total: 0,
    livemode: false,
    customer: "cus_trial",
    subscription: "sub_trial",
    customer_details: { email: "owner@example.com" },
    metadata,
  }
  const subscription: any = {
    id: "sub_trial",
    created: start,
    status: "trialing",
    livemode: false,
    customer: "cus_trial",
    default_payment_method: "pm_trial",
    pending_setup_intent: null,
    billing_mode: { type: "flexible" },
    trial_start: start,
    trial_end: end,
    discounts: [],
    metadata,
    items: {
      data: [
        {
          quantity: 1,
          discounts: [],
          current_period_end: end,
          price: {
            id: "price_month",
            currency: "eur",
            unit_amount: 999,
            tax_behavior: "inclusive",
            recurring: { interval: "month", interval_count: 1 },
          },
        },
      ],
    },
  }
  const enrollment: any = {
    id: enrollmentId,
    user_id: null,
    provider: "stripe",
    accepted_offer: offer,
    admission_status: "reserved",
    first_payment_succeeded_at: null,
    provider_agreement_id: null,
    access_revoked: false,
  }
  const tables: Record<string, any[]> = {
    trial_enrollments: [enrollment],
    profiles: [],
    billing_subscriptions: [],
    billing_one_time_purchases: [],
    manual_access_grants: [],
  }
  const users: any[] = []
  const effects: any[] = []
  let admissionResult = "active"
  let cancelFailure = false
  let bindRace = false
  let profileFailure = false
  let releaseFailure = false
  let lostCancelResponse = false
  let positiveInvoice = false
  const supabase: any = {
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: users.find((u) => u.id === id) },
          error: null,
        }),
        createUser: async (input: any) => {
          effects.push(["create_user"])
          const user = { id: userId, ...input }
          users.push(user)
          tables.profiles.push({ id: userId, email: input.email, subscription_status: null })
          return { data: { user }, error: null }
        },
      },
    },
    from(table: string) {
      const rows = tables[table] ?? []
      const filters: ((row: any) => boolean)[] = []
      let patch: any
      let insert: any
      const execute = (single: boolean) => {
        if (patch && table === "trial_enrollments" && bindRace)
          enrollment.user_id = "competing-owner"
        let matches = rows.filter((r) => filters.every((f) => f(r)))
        if (insert) {
          if (table === "profiles" && profileFailure)
            return { data: null, error: new Error("profile unavailable") }
          let row = rows.find((r) =>
            table === "profiles"
              ? r.id === insert.id
              : r.provider_subscription_id === insert.provider_subscription_id,
          )
          if (row) Object.assign(row, insert)
          else {
            row = { ...insert }
            rows.push(row)
          }
          matches = [row]
          effects.push([table, { ...insert }])
        }
        if (patch)
          for (const row of matches) {
            Object.assign(row, patch)
            effects.push([table, { ...patch }])
          }
        return {
          data: single ? (matches[0] ? { ...matches[0] } : null) : matches.map((r) => ({ ...r })),
          error: null,
        }
      }
      const q: any = {
        select: () => q,
        order: () => q,
        limit: () => q,
        eq: (k: string, v: any) => {
          filters.push((r) => r[k] === v)
          return q
        },
        is: (k: string, v: any) => {
          filters.push((r) => (r[k] ?? null) === v)
          return q
        },
        in: (k: string, v: any[]) => {
          filters.push((r) => v.includes(r[k]))
          return q
        },
        ilike: (k: string, v: string) => {
          filters.push((r) => r[k]?.toLowerCase() === v.toLowerCase())
          return q
        },
        or: () => q,
        update: (v: any) => {
          patch = v
          return q
        },
        insert: (v: any) => {
          insert = v
          return q
        },
        upsert: (v: any) => {
          insert = v
          return q
        },
        maybeSingle: async () => execute(true),
        single: async () => execute(true),
        then: (resolve: any, reject: any) => Promise.resolve(execute(false)).then(resolve, reject),
      }
      return q
    },
    rpc: async (name: string, args: any) => {
      effects.push([name, args])
      if (name === "get_personal_plan_one_time_access_state") return { data: "none", error: null }
      if (name === "admit_trial_enrollment") {
        enrollment.admission_status = admissionResult === "active" ? "active" : "blocked"
        enrollment.provider_agreement_id = args.p_provider_agreement_id
        enrollment.neutralization_required = admissionResult !== "active"
        if (admissionResult === "active") {
          enrollment.authorization_succeeded_at = args.p_authorized_at
          enrollment.original_trial_end_at = new Date(end * 1000).toISOString()
        }
        return { data: admissionResult, error: null }
      }
      if (name === "release_trial_enrollment") {
        if (releaseFailure) return { data: null, error: new Error("database unavailable") }
        enrollment.admission_status = "released"
        enrollment.neutralization_required = false
        return { data: true, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    },
  }
  const deps: any = {
    supabase,
    premiumTierId: "premium",
    now: () => new Date("2026-09-15T12:00:00Z"),
    trialRuntime: {
      stripeAccountId: "acct_trial",
      livemode: false,
      identityKeys: [{ version: 1, secret: new Uint8Array(32).fill(7) }],
    },
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct_trial" }) },
      checkout: { sessions: { retrieve: async () => session } },
      subscriptions: {
        retrieve: async () => subscription,
        cancel: async (id: string, params: any) => {
          effects.push(["cancel", id, params])
          if (cancelFailure) throw new Error("provider timeout")
          subscription.status = "canceled"
          if (lostCancelResponse) throw new Error("response lost")
          return { id, status: "canceled" }
        },
      },
      invoices: {
        list: async () => ({
          has_more: false,
          data: [
            {
              subscription: "sub_trial",
              status: "paid",
              amount_paid: positiveInvoice ? 999 : 0,
              amount_remaining: 0,
            },
          ],
        }),
      },
      paymentMethods: {
        retrieve: async () => ({
          id: "pm_trial",
          type: "card",
          livemode: false,
          customer: "cus_trial",
          card: { fingerprint: "private-card-fingerprint" },
        }),
      },
    },
    linkQuizToProfile: async (...args: any[]) => {
      effects.push(["link_quiz", ...args])
    },
  }
  return {
    deps,
    session,
    subscription,
    enrollment,
    tables,
    effects,
    deny: () => {
      admissionResult = "trial_used"
    },
    failCancel: () => {
      cancelFailure = true
    },
    raceOwner: () => {
      bindRace = true
    },
    failProfile: () => {
      profileFailure = true
    },
    restoreProfile: () => {
      profileFailure = false
    },
    failRelease: () => {
      releaseFailure = true
    },
    restoreRelease: () => {
      releaseFailure = false
    },
    loseCancelResponse: () => {
      lostCancelResponse = true
    },
    addPaidInvoice: () => {
      positiveInvoice = true
    },
  }
}

test("verified zero trial uses existing account/quiz flow after admission and billing, without paid migration", async () => {
  const f = fixture()
  const result = await ensureCheckoutAccount(f.session, f.deps)
  assert.equal(result.userId, userId)
  assert.equal(result.trialEnrollmentId, enrollmentId)
  assert.equal(result.trialEndAt, "2026-09-21T12:00:00.000Z")
  assert.equal(result.legacyQuizFuturePurchaseEligible, false)
  assert.equal(result.subscriptionStatus, "trialing")
  const billing = f.tables.billing_subscriptions[0]
  assert.equal(billing.trial_enrollment_id, enrollmentId)
  assert.equal(billing.current_period_end, "2026-09-21T12:00:00.000Z")
  assert.equal(billing.metadata.trial_cohort, "trial_v1")
  const order = f.effects.map((e) => e[0])
  assert.ok(order.indexOf("admit_trial_enrollment") < order.indexOf("billing_subscriptions"))
  assert.ok(order.indexOf("billing_subscriptions") < order.indexOf("profiles"))
  assert.ok(order.indexOf("profiles") < order.indexOf("link_quiz"))
  assert.ok(!JSON.stringify(f.effects).includes("private-card-fingerprint"))
})

test("activation retry after profile outage reuses account, admission and original clock", async () => {
  const f = fixture()
  f.failProfile()
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /profile unavailable/)
  f.restoreProfile()
  f.deps.now = () => new Date("2026-09-16T12:00:00Z")
  const result = await ensureCheckoutAccount(f.session, f.deps)
  assert.equal(result.trialEndAt, "2026-09-21T12:00:00.000Z")
  assert.equal(f.effects.filter((e) => e[0] === "create_user").length, 1)
  assert.equal(f.tables.billing_subscriptions.length, 1)
})

test("a paid zero-total checkout activates trial access without marking the first payment successful", async () => {
  const f = fixture()
  f.session.payment_status = "paid"
  const result = await ensureCheckoutAccount(f.session, f.deps)
  assert.equal(result.userId, userId)
  assert.equal(result.trialEnrollmentId, enrollmentId)
  assert.equal(result.subscriptionStatus, "trialing")
  assert.equal(result.trialEndAt, "2026-09-21T12:00:00.000Z")
  const billing = f.tables.billing_subscriptions[0]
  assert.equal(billing.trial_enrollment_id, enrollmentId)
  assert.equal(billing.metadata.trial_cohort, "trial_v1")
  assert.equal(f.enrollment.first_payment_succeeded_at, null)
  assert.equal(billing.provider_status, "trialing")
  assert.equal(f.effects.filter((effect) => effect[0] === "create_user").length, 1)
  assert.ok(f.effects.some((effect) => effect[0] === "link_quiz"))
})

test("a used card receives no profile/billing access and its trial agreement is canceled without invoicing", async () => {
  const f = fixture()
  f.deny()
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /trial_used/)
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.equal(f.tables.profiles[0].subscription_status, null)
  assert.deepEqual(
    f.effects.find((e) => e[0] === "cancel"),
    ["cancel", "sub_trial", { invoice_now: false, prorate: false }],
  )
  assert.ok(f.effects.some((e) => e[0] === "release_trial_enrollment"))
})

test("provider neutralization timeout remains retryable and does not release the claim or grant access", async () => {
  const f = fixture()
  f.deny()
  f.failCancel()
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /provider timeout/)
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.ok(!f.effects.some((e) => e[0] === "release_trial_enrollment"))
})

test("missing runtime, foreign enrollment, revoked admission and invalid card proof fail before account writes", async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      delete f.deps.trialRuntime
    },
    (f: ReturnType<typeof fixture>) => {
      f.enrollment.provider = "paypal"
    },
    (f: ReturnType<typeof fixture>) => {
      f.enrollment.access_revoked = true
    },
    (f: ReturnType<typeof fixture>) => {
      f.subscription.default_payment_method = null
    },
    (f: ReturnType<typeof fixture>) => {
      f.session.metadata.trial_cohort = "unknown"
    },
  ]) {
    const f = fixture()
    mutate(f)
    await assert.rejects(ensureCheckoutAccount(f.session, f.deps))
    assert.equal(f.effects.length, 0)
  }
})

test("competing enrollment ownership cannot be overwritten or grant product access", async () => {
  const f = fixture()
  f.raceOwner()
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /owner/)
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.ok(!f.effects.some((e) => e[0] === "admit_trial_enrollment"))
})

test("lost cancellation response or claim release failure converges from persisted denial on redelivery", async () => {
  for (const fault of ["response", "release"]) {
    const f = fixture()
    f.deny()
    if (fault === "response") f.loseCancelResponse()
    else f.failRelease()
    await assert.rejects(ensureCheckoutAccount(f.session, f.deps))
    assert.equal(f.subscription.status, "canceled")
    f.restoreRelease()
    await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /admission denied/)
    assert.equal(f.enrollment.admission_status, "released")
    assert.equal(f.tables.billing_subscriptions.length, 0)
    assert.equal(f.effects.filter((e) => e[0] === "cancel").length, 1)
  }
})

test("a successful payment discovered while neutralizing remains a reconciliation case", async () => {
  const f = fixture()
  f.deny()
  f.addPaidInvoice()
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /collection reconciliation/)
  assert.ok(!f.effects.some((e) => e[0] === "release_trial_enrollment"))
})

test("existing independent paid access cancels the duplicate trial and leaves original access intact", async () => {
  const f = fixture()
  f.tables.profiles.push({
    id: userId,
    email: "owner@example.com",
    subscription_status: "active",
    current_period_end: "2027-01-01T00:00:00Z",
  })
  await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /already has access/)
  assert.equal(f.subscription.status, "canceled")
  assert.equal(f.tables.profiles[0].subscription_status, "active")
  assert.equal(f.tables.billing_subscriptions.length, 0)
  assert.ok(!f.effects.some((e) => e[0] === "admit_trial_enrollment"))
})

test("a deleted or missing bound owner never recreates an account on late trial callbacks", async () => {
  for (const owner of [null, userId]) {
    const f = fixture()
    f.enrollment.admission_status = "active"
    f.enrollment.user_id = owner
    f.enrollment.provider_agreement_id = "sub_trial"
    await assert.rejects(ensureCheckoutAccount(f.session, f.deps), /owner/)
    assert.equal(f.effects.length, 0)
  }
})

test("accepted trial callbacks use configured runtime even when new enrollment is disabled", async () => {
  const values = {
    TRIAL_IDENTITY_PROCESSING_APPROVED: "true",
    TRIAL_STRIPE_ACCOUNT_ID: "acct_trial",
    TRIAL_STRIPE_LIVEMODE: "false",
    TRIAL_IDENTITY_HMAC_KEYS: JSON.stringify([{ version: 1, secretHex: "07".repeat(32) }]),
    TRIAL_STRIPE_PRICE_MONTHLY: "price_month",
    TRIAL_STRIPE_PRICE_ANNUAL: "price_year",
    TRIAL_STRIPE_ANNUAL_COUPON: "coupon_intro",
    TRIAL_ENROLLMENT_MODE: "disabled",
  }
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  try {
    Object.assign(process.env, values)
    const f = fixture()
    delete f.deps.trialRuntime
    const result = await ensureCheckoutAccount(f.session, f.deps)
    assert.equal(result.trialEnrollmentId, enrollmentId)
    assert.equal(f.enrollment.admission_status, "active")
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
