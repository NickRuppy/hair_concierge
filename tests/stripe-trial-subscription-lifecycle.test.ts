import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import {
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "../src/lib/stripe/webhook-handlers"

const enrollmentId = "11111111-1111-4111-8111-111111111111"
const originalTrialEnd = "2099-09-21T12:00:00.000Z"

function offer(interval: "month" | "year" = "month") {
  return {
    cohort: "trial_v1",
    offerVersion: "trial_launch_v1",
    interval,
    currency: "EUR",
    trialDays: 7,
    firstAmountMinor: interval === "year" ? 6999 : 999,
    renewalAmountMinor: interval === "year" ? 9999 : 999,
    taxBehavior: "inclusive",
    stripePriceId: interval === "year" ? "price_year" : "price_month",
    stripeCouponId: interval === "year" ? "coupon_year" : null,
  }
}

function trialFacts(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    enrollmentId,
    admissionStatus: "active",
    authorizationSucceededAt: new Date(Date.now() - 60_000).toISOString(),
    originalTrialEndAt: originalTrialEnd,
    firstPaymentSucceededAt: null,
    paidThroughAt: null,
    renewalGraceEndsAt: null,
    renewalPaymentFailed: false,
    cancelAtPeriodEnd: false,
    accessRevoked: false,
    ...overrides,
  }
}

function lifecycleDeps(input: {
  profile?: Record<string, unknown>
  billing?: Record<string, unknown>
  enrollment?: Record<string, unknown> | null
}) {
  const profiles = input.profile ? [input.profile] : []
  const billing = input.billing ? [input.billing] : []
  const enrollments: Array<Record<string, unknown>> =
    input.enrollment === undefined
      ? []
      : input.enrollment
        ? [
            {
              admission_status: "active",
              authorization_succeeded_at: new Date(Date.now() - 60_000).toISOString(),
              original_trial_end_at: new Date(Date.now() + 60_000).toISOString(),
              first_payment_succeeded_at: null,
              paid_through_at: null,
              renewal_grace_ends_at: null,
              renewal_payment_failed: false,
              cancel_at_period_end: false,
              access_revoked: false,
              ...input.enrollment,
            },
          ]
        : []
  const writes: Array<{ table: string; row: Record<string, unknown> }> = []
  const state = {
    revision: 0,
    cancellationVersion: 0,
    technicalCancellation: false,
    beforeCancellationWrite: (() => {}) as () => void,
    providerSnapshot: null as ReturnType<typeof subscription> | null,
  }
  const supabase = {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "read_trial_effective_contract") {
        const row = enrollments[0]
        return {
          data: row
            ? {
                accepted_offer: row.accepted_offer,
                provider: row.provider,
                provider_agreement_id: row.provider_agreement_id,
                revision: state.revision,
              }
            : null,
          error: null,
        }
      }
      if (
        name === "is_trial_continuation_source_cancellation" ||
        name === "is_trial_paid_recovery_source_cancellation"
      )
        return { data: state.technicalCancellation, error: null }
      if (name === "read_stripe_trial_cancellation_fence") {
        return {
          data: { revision: state.revision, cancellationVersion: state.cancellationVersion },
          error: null,
        }
      }
      if (name === "confirm_stripe_trial_cancellation") {
        state.beforeCancellationWrite()
        if (
          args.p_expected_revision !== state.revision ||
          args.p_expected_cancellation_version !== state.cancellationVersion
        )
          return { data: null, error: null }
        const row = enrollments[0]
        if (!row.cancel_at_period_end) {
          row.cancel_at_period_end = true
          state.cancellationVersion++
        }
        return { data: { ...row }, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    },
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const rows = () =>
        table === "profiles"
          ? profiles
          : table === "billing_subscriptions"
            ? billing
            : table === "trial_enrollments"
              ? enrollments
              : []
      const builder: any = {
        select() {
          return builder
        },
        eq(key: string, value: unknown) {
          filters.push([key, value])
          return builder
        },
        in() {
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        async maybeSingle() {
          return {
            data: rows().find((row) => filters.every(([key, value]) => row[key] === value)) ?? null,
            error: null,
          }
        },
        update(patch: Record<string, unknown>) {
          const updateFilters: Array<[string, unknown]> = []
          const updateBuilder: any = {
            eq(key: string, value: unknown) {
              updateFilters.push([key, value])
              return updateBuilder
            },
            select() {
              return updateBuilder
            },
            async maybeSingle() {
              if (table === "trial_enrollments") state.beforeCancellationWrite()
              const row = rows().find((row) =>
                updateFilters.every(([key, value]) => row[key] === value),
              )
              if (row) Object.assign(row, patch)
              return { data: row ?? null, error: null }
            },
          }
          return updateBuilder
        },
        upsert(row: Record<string, unknown>) {
          const existing = rows().find(
            (candidate) =>
              candidate.provider === row.provider &&
              candidate.provider_subscription_id === row.provider_subscription_id,
          )
          if (existing) Object.assign(existing, row)
          else billing.push(row)
          writes.push({ table, row })
          return {
            select: () => ({ single: async () => ({ data: existing ?? row, error: null }) }),
          }
        },
      }
      return builder
    },
  }
  const stripe = {
    subscriptions: {
      retrieve: async () =>
        state.providerSnapshot ?? subscription({ cancel_at_period_end: true, status: "canceled" }),
    },
  }
  return { deps: { supabase, stripe } as any, profiles, billing, enrollments, writes, state }
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_trial",
    customer: "cus_trial",
    status: "trialing",
    cancel_at_period_end: false,
    metadata: { trial_cohort: "trial_v1", trial_enrollment_id: enrollmentId },
    items: {
      data: [
        {
          current_period_end: Math.floor(Date.parse(originalTrialEnd) / 1000),
          price: { id: "price_month", interval: "month", interval_count: 1 },
        },
      ],
    },
    ...overrides,
  } as any
}

test("trial marker before activation cannot create an unlinked legacy billing row", async () => {
  const { deps, billing, writes } = lifecycleDeps({})
  const result = await handleSubscriptionUpdated(subscription(), deps)
  assert.equal(result.matchedCurrentSubscription, false)
  assert.equal(result.trialEnrollmentId, undefined)
  assert.equal(billing.length, 0)
  assert.equal(writes.length, 0)
})

test("deleted trial preserves canonical deadline and premium mirror while access remains valid", async () => {
  const { deps, profiles, billing } = lifecycleDeps({
    profile: {
      id: "user-1",
      stripe_customer_id: "cus_trial",
      stripe_subscription_id: "sub_trial",
      subscription_status: "active",
      subscription_tier_id: "premium",
    },
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "trialing",
      entitlement_status: "active",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts({
        originalTrialEndAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment: {
      id: enrollmentId,
      user_id: "user-1",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
      original_trial_end_at: originalTrialEnd,
    },
  })
  const result = await handleSubscriptionDeleted(subscription({ status: "canceled" }), {
    ...deps,
    freeTierId: "free",
  })
  assert.deepEqual(result, { matchedCurrentSubscription: false, trialEnrollmentId: enrollmentId })
  assert.equal(profiles[0].subscription_status, "active")
  assert.equal(profiles[0].subscription_tier_id, "premium")
  assert.equal(billing[0].current_period_end, originalTrialEnd)
  assert.equal(billing[0].provider_status, "canceled")
  assert.equal(billing[0].cancel_at_period_end, true)
})

test("provider active after trial expiry does not fabricate a paid entitlement", async () => {
  const { deps, profiles, billing } = lifecycleDeps({
    profile: {
      id: "user-1",
      stripe_customer_id: "cus_trial",
      stripe_subscription_id: "sub_trial",
      subscription_status: "active",
      subscription_tier_id: "premium",
    },
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "trialing",
      entitlement_status: "active",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts({ originalTrialEndAt: "2020-01-01T00:00:00.000Z" }),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment: {
      id: enrollmentId,
      user_id: "user-1",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
      original_trial_end_at: "2020-01-01T00:00:00.000Z",
    },
  })
  const result = await handleSubscriptionUpdated(subscription({ status: "active" }), deps)
  assert.equal(result.matchedCurrentSubscription, false)
  assert.equal(result.trialEnrollmentId, enrollmentId)
  assert.equal(profiles[0].subscription_status, "canceled")
  assert.equal(billing[0].entitlement_status, "active")
  assert.equal(
    (billing[0].trial_access_facts as Record<string, unknown>).firstPaymentSucceededAt,
    null,
  )
})

test("owner mismatch stays fail-closed and cannot reach legacy profile writes", async () => {
  const { deps, profiles, billing, writes } = lifecycleDeps({
    profile: {
      id: "user-1",
      stripe_customer_id: "cus_trial",
      stripe_subscription_id: "sub_trial",
      subscription_status: "active",
    },
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "trialing",
      entitlement_status: "active",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts(),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment: {
      id: enrollmentId,
      user_id: "other-user",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
    },
  })
  const result = await handleSubscriptionUpdated(subscription(), deps)
  assert.deepEqual(result, { matchedCurrentSubscription: false, trialEnrollmentId: enrollmentId })
  assert.equal(profiles[0].subscription_status, "active")
  assert.equal(billing[0].provider_status, "trialing")
  assert.equal(writes.length, 0)
})

test("any partial trial marker is quarantined instead of taking the legacy lifecycle path", async () => {
  const { deps, profiles, billing, writes } = lifecycleDeps({
    profile: {
      id: "user-1",
      stripe_customer_id: "cus_trial",
      stripe_subscription_id: "sub_trial",
      subscription_status: "active",
    },
  })
  const result = await handleSubscriptionUpdated(
    subscription({ metadata: { trial_offer_version: "trial_launch_v1" }, status: "active" }),
    deps,
  )
  assert.deepEqual(result, { matchedCurrentSubscription: false })
  assert.equal(profiles[0].subscription_status, "active")
  assert.equal(billing.length, 0)
  assert.equal(writes.length, 0)
})

test("mismatched provider customer cannot update the linked trial lifecycle", async () => {
  const { deps, billing, writes } = lifecycleDeps({
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_owned",
      provider_status: "trialing",
      entitlement_status: "active",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts(),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment: {
      id: enrollmentId,
      user_id: "user-1",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
    },
  })
  const result = await handleSubscriptionUpdated(subscription({ customer: "cus_foreign" }), deps)
  assert.deepEqual(result, { matchedCurrentSubscription: false, trialEnrollmentId: enrollmentId })
  assert.equal(billing[0].provider_customer_id, "cus_owned")
  assert.equal(writes.length, 0)
})

test("valid trial metadata cannot attach an unlinked legacy billing row", async () => {
  const { deps, billing, writes } = lifecycleDeps({
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "active",
      entitlement_status: "active",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: null,
      metadata: {},
    },
    enrollment: {
      id: enrollmentId,
      user_id: "user-1",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
    },
  })
  const result = await handleSubscriptionUpdated(subscription(), deps)
  assert.deepEqual(result, { matchedCurrentSubscription: false })
  assert.equal(billing[0].trial_enrollment_id, null)
  assert.equal(writes.length, 0)
})

test("provider cancellation only sets canonical cancellation and keeps the immutable trial deadline", async () => {
  const canonicalEnd = new Date(Date.now() + 60_000).toISOString()
  const enrollment = {
    id: enrollmentId,
    user_id: "user-1",
    provider: "stripe",
    provider_agreement_id: "sub_trial",
    accepted_offer: offer(),
    admission_status: "active",
    authorization_succeeded_at: new Date(Date.now() - 60_000).toISOString(),
    original_trial_end_at: canonicalEnd,
    first_payment_succeeded_at: null,
    paid_through_at: null,
    renewal_grace_ends_at: null,
    renewal_payment_failed: false,
    cancel_at_period_end: false,
    access_revoked: false,
  }
  const { deps, billing, enrollments } = lifecycleDeps({
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "trialing",
      entitlement_status: "active",
      interval: "month",
      current_period_end: canonicalEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts({ originalTrialEndAt: canonicalEnd }),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment,
  })
  await handleSubscriptionUpdated(
    subscription({
      cancel_at_period_end: true,
      cancel_at: 1,
      items: {
        data: [
          {
            current_period_end: 1,
            price: { id: "price_month", interval: "month", interval_count: 1 },
          },
        ],
      },
    }),
    deps,
  )
  assert.equal(enrollments[0].cancel_at_period_end, true)
  assert.equal(billing[0].current_period_end, canonicalEnd)
  assert.equal(billing[0].cancel_scheduled_at, canonicalEnd)
})

test("blocked trial enrollment cannot refresh billing or profile access", async () => {
  const { deps, profiles, billing, writes } = lifecycleDeps({
    profile: {
      id: "user-1",
      stripe_customer_id: "cus_trial",
      stripe_subscription_id: "sub_trial",
      subscription_status: "canceled",
    },
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "canceled",
      entitlement_status: "canceled",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      cancel_scheduled_at: null,
      cancelled_at: null,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts({ admissionStatus: "blocked" }),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment: {
      id: enrollmentId,
      user_id: "user-1",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
      admission_status: "blocked",
    },
  })
  const result = await handleSubscriptionUpdated(subscription({ status: "active" }), deps)
  assert.deepEqual(result, { matchedCurrentSubscription: false, trialEnrollmentId: enrollmentId })
  assert.equal(profiles[0].subscription_status, "canceled")
  assert.equal(billing[0].provider_status, "canceled")
  assert.equal(writes.length, 0)
})

function cancellationRaceFixture() {
  return lifecycleDeps({
    billing: {
      id: "billing-1",
      user_id: "user-1",
      provider: "stripe",
      provider_subscription_id: "sub_trial",
      provider_customer_id: "cus_trial",
      provider_status: "trialing",
      entitlement_status: "active",
      interval: "month",
      current_period_end: originalTrialEnd,
      cancel_at_period_end: false,
      trial_enrollment_id: enrollmentId,
      trial_access_facts: trialFacts(),
      metadata: { trial_cohort: "trial_v1" },
    },
    enrollment: {
      id: enrollmentId,
      user_id: "user-1",
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      accepted_offer: offer(),
      original_trial_end_at: originalTrialEnd,
    },
  })
}
test("restoration committed after Stripe retrieval fences stale cancellation and all mirrors", async () => {
  const f = cancellationRaceFixture()
  f.state.beforeCancellationWrite = () => {
    // A real restore appends a revision and advances the cancellation generation.
    f.state.revision++
    f.state.cancellationVersion += 2
    f.enrollments[0].cancel_at_period_end = false
  }
  await handleSubscriptionUpdated(subscription({ cancel_at_period_end: true }), f.deps)
  assert.equal(f.enrollments[0].cancel_at_period_end, false)
  assert.equal(f.writes.length, 0)
  assert.equal(f.billing[0].cancel_at_period_end, false)
})
test("restore completed before fence capture is resolved by a fresh provider read", async () => {
  const f = cancellationRaceFixture()
  f.state.revision = 1
  f.state.cancellationVersion = 2
  f.state.providerSnapshot = subscription({ cancel_at_period_end: false, cancel_at: null })
  await handleSubscriptionUpdated(subscription({ cancel_at_period_end: true }), f.deps)
  assert.equal(f.enrollments[0].cancel_at_period_end, false)
  assert.equal(f.writes.length, 0)
})
test("a newer cancellation declaration invalidates the snapshot even without changing revision", async () => {
  const f = cancellationRaceFixture()
  f.state.beforeCancellationWrite = () => {
    f.state.cancellationVersion++
    f.enrollments[0].cancel_at_period_end = true
  }
  await handleSubscriptionUpdated(subscription({ cancel_at_period_end: true }), f.deps)
  assert.equal(f.enrollments[0].cancel_at_period_end, true)
  assert.equal(f.writes.length, 0)
})

test("database cancellation CAS rejects a snapshot taken before an actual restore commit", async (t) => {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text);
    GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON public.profiles,public.billing_subscriptions TO service_role;`)
  for (const file of [
    "20260914044650_trial_admission_foundation",
    "20260914090614_trial_cancellation_declarations",
    "20260914094203_trial_payment_events",
    "20260914140320_trial_management_operations",
    "20260914151514_stripe_trial_lifecycle_cancellation_fence",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), "utf8"),
    )
  const user = "22222222-2222-4222-8222-222222222222",
    operation = "33333333-3333-4333-8333-333333333333"
  await pg.query("INSERT INTO public.profiles VALUES($1)", [user])
  await pg.query(
    "INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider) VALUES($1,$2,$3,'stripe')",
    [enrollmentId, user, JSON.stringify(offer())],
  )
  await pg.query("SELECT public.freeze_trial_management_catalog($1,$2)", [
    enrollmentId,
    JSON.stringify({ month: offer(), year: offer("year") }),
  ])
  await pg.query(
    `UPDATE public.trial_enrollments SET provider_agreement_id='sub_trial',admission_status='active',
    authorization_succeeded_at=date_trunc('second',now())-interval '1 day',original_trial_end_at=date_trunc('second',now())+interval '6 days',cancel_at_period_end=true WHERE id=$1`,
    [enrollmentId],
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions VALUES(gen_random_uuid(),$1,'stripe','sub_trial','cus_trial',$2)",
    [user, enrollmentId],
  )
  await pg.exec("SET ROLE service_role")
  const fence = async () =>
    (
      await pg.query<{ value: { revision: number; cancellationVersion: number } }>(
        "SELECT public.read_stripe_trial_cancellation_fence($1,'sub_trial','cus_trial',$2) AS value",
        [enrollmentId, user],
      )
    ).rows[0].value
  const confirm = async (captured: { revision: number; cancellationVersion: number }) =>
    (
      await pg.query<{ value: any }>(
        "SELECT public.confirm_stripe_trial_cancellation($1,'sub_trial','cus_trial',$2,$3,$4) AS value",
        [enrollmentId, user, captured.revision, captured.cancellationVersion],
      )
    ).rows[0].value
  const before = await fence()
  assert.ok(before)
  const begin = (
    await pg.query<{ value: { originalTrialEndAt: string } }>(
      "SELECT public.begin_trial_management_operation($1,$2,$3,'restore',0,'month') AS value",
      [operation, enrollmentId, user],
    )
  ).rows[0].value
  const proof = {
    provider: "stripe",
    providerCustomerId: "cus_trial",
    sourceAgreementId: "sub_trial",
    targetAgreementId: "sub_trial",
    originalTrialEndAt: begin.originalTrialEndAt,
    offer: offer(),
    cancelAtPeriodEnd: false,
    noImmediatePayment: true,
    sourceAgreementNeutralized: false,
    reference: "stripe-restore-verified",
  }
  assert.equal(
    (
      await pg.query<{ value: boolean }>(
        "SELECT public.commit_trial_management_operation($1,$2,$3) AS value",
        [operation, user, JSON.stringify(proof)],
      )
    ).rows[0].value,
    true,
  )
  assert.equal(await confirm(before), null)
  assert.equal(
    (
      await pg.query<{ canceled: boolean }>(
        "SELECT cancel_at_period_end AS canceled FROM public.trial_enrollments WHERE id=$1",
        [enrollmentId],
      )
    ).rows[0].canceled,
    false,
  )
  const after = await fence()
  assert.equal(after.revision, before.revision + 1)
  assert.ok(after.cancellationVersion > before.cancellationVersion)
  const wrongOwner = await pg.query<{ value: unknown }>(
    "SELECT public.confirm_stripe_trial_cancellation($1,'sub_trial','cus_foreign',$2,$3,$4) AS value",
    [enrollmentId, user, after.revision, after.cancellationVersion],
  )
  assert.equal(wrongOwner.rows[0].value, null)
  assert.equal(
    (await confirm(after)).cancel_at_period_end,
    true,
    "a fresh provider cancellation still applies",
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(() => fence(), /permission denied/)
})

test("technical source cancellation appearing during the fresh read never becomes customer cancellation", async () => {
  const f = cancellationRaceFixture(),
    operation = "33333333-3333-4333-8333-333333333333"
  f.state.technicalCancellation = true
  f.state.providerSnapshot = subscription({
    status: "canceled",
    cancel_at_period_end: false,
    metadata: {
      trial_cohort: "trial_v1",
      trial_enrollment_id: enrollmentId,
      trial_continuation_operation_id: operation,
    },
    cancellation_details: { comment: `trial-paid-continuation:${operation}` },
  })
  await handleSubscriptionUpdated(subscription({ cancel_at_period_end: true }), f.deps)
  assert.equal(f.enrollments[0].cancel_at_period_end, false)
  assert.equal(f.writes.length, 0)
})
