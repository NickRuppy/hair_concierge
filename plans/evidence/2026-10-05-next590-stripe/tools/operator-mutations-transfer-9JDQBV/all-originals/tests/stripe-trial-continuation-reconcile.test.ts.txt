import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import type Stripe from "stripe"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { reconcileStripeTrialContinuations } from "../src/lib/stripe/trial-continuation-reconcile"
import { handleStripeTrialContinuationReconcile } from "../src/app/api/billing/stripe-trial-continuation/reconcile/route"

const ROOT = new URL("../", import.meta.url)
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const USER = "11111111-1111-4111-8111-111111111111"
const MIGRATIONS = [
  "20260914044650_trial_admission_foundation.sql",
  "20260914094203_trial_payment_events.sql",
  "20260914135114_stripe_trial_continuation_operations.sql",
  "20260914135123_trial_paid_continuation_links.sql",
  "20260914090614_trial_cancellation_declarations.sql",
  "20260914093927_trial_cancellation_provider_operations.sql",
  "20260914140320_trial_management_operations.sql",
  "20260914140642_stripe_paid_cancellation_operations.sql",
  "20260914141733_stripe_trial_management_approval.sql",
  "20260914142808_trial_paid_recovery_operations.sql",
  "20260914143613_stripe_continuation_recovery_guard.sql",
  "20260914144207_stripe_trial_paid_recovery_requests.sql",
]
async function database(t: { after(fn: () => Promise<void>): void }, paid = true, expired = false) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY, user_id uuid, provider text, provider_subscription_id text, provider_customer_id text);
    GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON public.profiles, public.billing_subscriptions TO service_role;`)
  for (const file of MIGRATIONS)
    await pg.exec(await readFile(new URL(`supabase/migrations/${file}`, ROOT), "utf8"))
  const offer = createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  })
  await pg.query("INSERT INTO public.profiles VALUES($1)", [USER])
  if (paid) {
    await pg.query(
      `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at)
      VALUES($1,$2,$3,'stripe','sub_old','active','2099-01-01T12:00:00Z','2099-01-08T12:00:00Z')`,
      [ENROLLMENT, USER, JSON.stringify(offer)],
    )
  } else {
    await pg.query(
      "INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider) VALUES($1,$2,$3,'stripe')",
      [ENROLLMENT, USER, JSON.stringify(offer)],
    )
    await pg.query("SELECT public.freeze_trial_management_catalog($1,$2)", [
      ENROLLMENT,
      JSON.stringify({
        month: offer,
        year: createTrialOfferSnapshot("year", {
          monthPriceId: "price_month",
          yearPriceId: "price_year",
          annualCouponId: "coupon",
        }),
      }),
    ])
    await pg.query(
      `UPDATE public.trial_enrollments SET provider_agreement_id='sub_old',admission_status='active',cancel_at_period_end=true,
      authorization_succeeded_at=date_trunc('second',now())-interval '${expired ? "10 days" : "1 day"}',original_trial_end_at=date_trunc('second',now())+interval '${expired ? "-3 days" : "6 days"}' WHERE id=$1`,
      [ENROLLMENT],
    )
  }
  await pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id)
    VALUES(gen_random_uuid(),$1,'stripe','sub_old','cus_1',$2)`,
    [USER, ENROLLMENT],
  )
  if (paid)
    await pg.query("SELECT public.record_trial_payment_event($1::jsonb)", [
      JSON.stringify({
        provider: "stripe",
        enrollmentId: ENROLLMENT,
        agreementId: "sub_old",
        sourceEventId: "evt_1",
        sourceObjectId: "in_1",
        outcome: "succeeded",
        occurredAt: "2099-01-10T12:00:00Z",
        amountMinor: 999,
        currency: "EUR",
        periodStartAt: "2099-01-08T12:00:00Z",
        periodEndAt: "2099-02-08T12:00:00Z",
      }),
    ])
  return pg
}
async function claim(pg: PGlite) {
  return (
    await pg.query<{ result: Array<{ id: string; lease_token: string; paid_through_at: string }> }>(
      "SELECT public.claim_stripe_trial_continuations(2,NULL) AS result",
    )
  ).rows[0].result
}
async function checkpoint(
  pg: PGlite,
  op: { id: string; lease_token: string },
  action: string,
  successor: string | null = null,
) {
  return (
    await pg.query<{ result: boolean }>(
      "SELECT public.checkpoint_stripe_trial_continuation($1,$2,$3,$4) AS result",
      [op.id, op.lease_token, action, successor],
    )
  ).rows[0].result
}

test("SQL only leases ledger debt once, preserves full paid period, and fences stale workers", async (t) => {
  const pg = await database(t)
  await pg.exec("SET ROLE service_role")
  const [op] = await claim(pg)
  assert.ok(op)
  assert.equal(op.paid_through_at, "2099-02-10T12:00:00+00:00")
  assert.equal((await claim(pg)).length, 0)
  assert.equal(await checkpoint(pg, op, "begin_create"), false)
  assert.equal(await checkpoint(pg, op, "neutralized"), true)
  assert.equal(await checkpoint(pg, op, "begin_create"), true)
  await pg.exec(
    "UPDATE private.stripe_trial_continuation_operations SET lease_until = clock_timestamp() - interval '1 second'",
  )
  const [newOwner] = await claim(pg)
  assert.notEqual(newOwner.lease_token, op.lease_token)
  assert.equal(await checkpoint(pg, op, "observed", "sub_new"), false)
  assert.equal(await checkpoint(pg, newOwner, "observed", "sub_new"), true)
  assert.equal(await checkpoint(pg, newOwner, "observed", "sub_other"), false)
  assert.equal(
    await checkpoint(pg, newOwner, "resolved"),
    false,
    "cannot resolve before parent CAS binds successor",
  )
})

test("SQL cancellation prevents creation and binding while retaining the received paid period", async (t) => {
  const pg = await database(t)
  const [op] = await claim(pg)
  await checkpoint(pg, op, "neutralized")
  await checkpoint(pg, op, "begin_create")
  await checkpoint(pg, op, "observed", "sub_new")
  await pg.query("UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=$1", [
    ENROLLMENT,
  ])
  assert.equal(await checkpoint(pg, op, "begin_create"), false)
  const bound = await pg.query<{ result: boolean }>(
    `SELECT public.confirm_trial_paid_continuation($1,'stripe','sub_old','sub_new','cus_1','in_1','2099-02-10T12:00:00Z',$2) AS result`,
    [ENROLLMENT, op.id],
  )
  assert.equal(bound.rows[0].result, false)
  assert.equal(
    (
      await pg.query<{ through: string }>(
        "SELECT paid_through_at::text AS through FROM public.trial_enrollments",
      )
    ).rows[0].through,
    "2099-02-10 12:00:00+00",
  )
})

test("SQL binding is idempotent, preserves the original link, and resolves durable debt", async (t) => {
  const pg = await database(t)
  const [op] = await claim(pg)
  await checkpoint(pg, op, "neutralized")
  await checkpoint(pg, op, "begin_create")
  await checkpoint(pg, op, "observed", "sub_new")
  for (let i = 0; i < 2; i++) {
    const result = await pg.query<{ ok: boolean }>(
      `SELECT public.confirm_trial_paid_continuation($1,'stripe','sub_old','sub_new','cus_1','in_1','2099-02-10T12:00:00Z',$2) AS ok`,
      [ENROLLMENT, op.id],
    )
    assert.equal(result.rows[0].ok, true)
  }
  assert.equal(await checkpoint(pg, op, "resolved"), true)
  assert.equal((await claim(pg)).length, 0)
  const result = await pg.query<{
    original: string
    status: string
  }>(`SELECT e.provider_agreement_id AS original, d.status
    FROM public.trial_enrollments e JOIN private.trial_payment_continuation_reconciliations d ON d.enrollment_id=e.id`)
  assert.deepEqual(result.rows[0], { original: "sub_old", status: "resolved" })
  await pg.query("UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=$1", [
    ENROLLMENT,
  ])
  const [compensation] = await claim(pg)
  assert.equal(
    compensation.id,
    op.id,
    "late cancellation reopens bound operation for provider compensation",
  )
  assert.equal(await checkpoint(pg, compensation, "begin_create"), false)
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    pg.query("SELECT public.claim_stripe_trial_continuations(2,NULL)"),
    /permission denied/,
  )
})

test("authenticated retry route invokes consumer and leaves failed repair scheduled without changing payment access", async () => {
  let called = 0
  const reconcile = async () => {
    called++
    return { claimed: 1, pending: 1, resolved: 0, canceled: 0 }
  }
  assert.equal(
    (
      await handleStripeTrialContinuationReconcile(new Request("https://test"), {
        cronSecret: "secret",
        reconcile,
      })
    ).status,
    401,
  )
  assert.equal(called, 0)
  const response = await handleStripeTrialContinuationReconcile(
    new Request("https://test", { headers: { authorization: "Bearer secret" } }),
    { cronSecret: "secret", reconcile },
  )
  assert.equal(response.status, 200)
  assert.equal(called, 1)
})

test("consumer releases pending operations through the fenced retry checkpoint", async () => {
  const calls: string[] = []
  const result = await reconcileStripeTrialContinuations({
    stripe: {} as Stripe,
    runtime: {
      stripeAccountId: "acct",
      livemode: true,
      identityKeys: [],
      enrollmentMode: "disabled",
      allowedEmails: [],
      catalog: { monthPriceId: "p_month", yearPriceId: "p_year", annualCouponId: null },
    },
    rpc: async (name, args) => {
      calls.push(`${name}:${args.p_action ?? ""}`)
      return {
        error: null,
        data:
          name === "claim_stripe_trial_continuations"
            ? [
                {
                  id: "op",
                  enrollment_id: ENROLLMENT,
                  original_agreement_id: "sub",
                  customer_id: "cus",
                  source_object_id: "in",
                  paid_through_at: "2099-02-10T12:00:00Z",
                  payment_succeeded_at: "2099-01-10T12:00:00Z",
                  lease_token: "lease",
                },
              ]
            : true,
      }
    },
    reconcile: async () => "pending",
  })
  assert.deepEqual(result, { claimed: 1, pending: 1, resolved: 0, canceled: 0 })
  assert.equal(calls.at(-1), "checkpoint_stripe_trial_continuation:retry")
})

test("paid cancellation SQL verifies owner and persists paid-through access before provider work", async (t) => {
  const pg = await database(t)
  const requestId = "33333333-3333-4333-8333-333333333333"
  const wrong = await pg.query<{ result: unknown }>(
    "SELECT public.request_stripe_paid_cancellation($1,$2,$3) AS result",
    [requestId, ENROLLMENT, requestId],
  )
  assert.equal(wrong.rows[0].result, null)
  const requested = await pg.query<{
    result: { id: string; agreement_id: string; paid_through_at: string }
  }>("SELECT public.request_stripe_paid_cancellation($1,$2,$3) AS result", [
    requestId,
    ENROLLMENT,
    USER,
  ])
  assert.equal(requested.rows[0].result.agreement_id, "sub_old")
  assert.equal(requested.rows[0].result.paid_through_at, "2099-02-10T12:00:00+00:00")
  const enrollment = await pg.query<{ canceled: boolean; paid: boolean }>(
    "SELECT cancel_at_period_end AS canceled,first_payment_succeeded_at IS NOT NULL AS paid FROM public.trial_enrollments",
  )
  assert.deepEqual(enrollment.rows[0], { canceled: true, paid: true })
  const claim = await pg.query<{ result: Array<{ lease_token: string }> }>(
    "SELECT public.claim_stripe_paid_cancellations(2,NULL) AS result",
  )
  const lease = claim.rows[0].result[0].lease_token
  const stale = await pg.query<{ result: boolean }>(
    "SELECT public.finish_stripe_paid_cancellation($1,$2,true) AS result",
    [requestId, requestId],
  )
  assert.equal(stale.rows[0].result, false)
  const confirmed = await pg.query<{ result: boolean }>(
    "SELECT public.finish_stripe_paid_cancellation($1,$2,true) AS result",
    [requestId, lease],
  )
  assert.equal(confirmed.rows[0].result, true)
})

test("paid cancellation confirmation waits for an uncertain hidden successor to be neutralized", async (t) => {
  const pg = await database(t)
  const [continuation] = await claim(pg)
  await checkpoint(pg, continuation, "neutralized")
  await checkpoint(pg, continuation, "begin_create")
  const requestId = "33333333-3333-4333-8333-333333333333"
  await pg.query("SELECT public.request_stripe_paid_cancellation($1,$2,$3)", [
    requestId,
    ENROLLMENT,
    USER,
  ])
  const leased = await pg.query<{ result: Array<{ lease_token: string }> }>(
    "SELECT public.claim_stripe_paid_cancellations(2,NULL) AS result",
  )
  const confirmed = await pg.query<{ result: boolean }>(
    "SELECT public.finish_stripe_paid_cancellation($1,$2,true) AS result",
    [requestId, leased.rows[0].result[0].lease_token],
  )
  assert.equal(confirmed.rows[0].result, false)
})

test("restoration SQL freezes setup/subscription requests, rejects a new trial, and fences newer cancellation", async (t) => {
  const pg = await database(t, false)
  const operationId = "33333333-3333-4333-8333-333333333333"
  await pg.query("SELECT public.begin_trial_management_operation($1,$2,$3,'restore',0,'month')", [
    operationId,
    ENROLLMENT,
    USER,
  ])
  const params = {
    mode: "setup",
    customer: "cus_1",
    client_reference_id: operationId,
    metadata: { trial_management_operation_id: operationId },
  }
  const frozen = await pg.query<{ result: { session_params: unknown } }>(
    "SELECT public.freeze_stripe_trial_management_approval($1,$2,$3) AS result",
    [operationId, USER, JSON.stringify(params)],
  )
  assert.deepEqual(frozen.rows[0].result.session_params, params)
  await pg.query(
    "SELECT public.checkpoint_stripe_trial_management_approval($1,'session','cs_1',NULL)",
    [operationId],
  )
  const epoch = await pg.query<{ anchor: number }>(
    "SELECT extract(epoch FROM original_trial_end_at)::bigint AS anchor FROM public.trial_enrollments",
  )
  const subscription = {
    customer: "cus_1",
    default_payment_method: "pm_1",
    billing_cycle_anchor: Number(epoch.rows[0].anchor),
    billing_mode: { type: "flexible" },
    proration_behavior: "none",
    items: [{ price: "price_month", quantity: 1 }],
  }
  const write = async (value: unknown) =>
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.checkpoint_stripe_trial_management_approval($1,'begin_subscription',NULL,$2) AS ok",
        [operationId, JSON.stringify(value)],
      )
    ).rows[0].ok
  assert.equal(await write({ ...subscription, trial_period_days: 7 }), false)
  assert.equal(await write(subscription), true)
  assert.equal(await write({ ...subscription, default_payment_method: "pm_other" }), false)
  await pg.query("UPDATE public.trial_enrollments SET access_revoked=true WHERE id=$1", [
    ENROLLMENT,
  ])
  assert.equal(await write(subscription), false)
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    pg.query("SELECT public.load_stripe_trial_management_approval($1)", [operationId]),
    /permission denied/,
  )
})

test("recovery SQL freezes exactly one request and excludes automatic repair while recovery is pending", async (t) => {
  const pg = await database(t, false, true)
  const operationId = "33333333-3333-4333-8333-333333333333"
  await pg.exec("SET ROLE service_role")
  const begun = await pg.query<{ result: unknown }>(
    "SELECT public.begin_trial_paid_recovery_operation($1,$2,$3,'recover_unpaid',0) AS result",
    [operationId, ENROLLMENT, USER],
  )
  assert.ok(begun.rows[0].result)
  const params = {
    mode: "subscription",
    customer: "cus_1",
    client_reference_id: operationId,
    line_items: [{ price: "price_month", quantity: 1 }],
    metadata: { trial_paid_recovery_operation_id: operationId },
    subscription_data: {
      billing_mode: { type: "flexible" },
      metadata: { trial_paid_recovery_operation_id: operationId },
    },
  }
  const freeze = async (value: unknown) =>
    (
      await pg.query<{ result: any }>(
        "SELECT public.freeze_stripe_trial_paid_recovery_request($1,$2,$3) AS result",
        [operationId, USER, JSON.stringify(value)],
      )
    ).rows[0].result
  assert.equal(
    await freeze({
      ...params,
      subscription_data: { ...params.subscription_data, trial_period_days: 7 },
    }),
    null,
  )
  assert.equal(
    await freeze({ ...params, line_items: [{ price: "price_other", quantity: 1 }] }),
    null,
  )
  const first = await freeze(params)
  assert.ok(first)
  assert.deepEqual(
    (await freeze({ ...params, success_url: "https://other.example" })).session_params,
    first.session_params,
  )
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.checkpoint_stripe_trial_paid_recovery_request($1,'session','cs_1') AS ok",
        [operationId],
      )
    ).rows[0].ok,
    true,
  )
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.checkpoint_stripe_trial_paid_recovery_request($1,'session','cs_other') AS ok",
        [operationId],
      )
    ).rows[0].ok,
    false,
  )
  await pg.query(
    `UPDATE public.trial_enrollments SET first_payment_succeeded_at=now(),paid_through_at=now()+interval '1 month' WHERE id=$1`,
    [ENROLLMENT],
  )
  await pg.query(
    `INSERT INTO private.trial_payment_continuation_reconciliations(enrollment_id,provider,source_event_id,source_object_id,payment_succeeded_at,source_period_start_at,source_period_end_at,owed_paid_through_at,status)
    SELECT id,'stripe','evt_1','in_1',first_payment_succeeded_at,first_payment_succeeded_at-interval '2 days',paid_through_at-interval '2 days',paid_through_at,'pending' FROM public.trial_enrollments WHERE id=$1`,
    [ENROLLMENT],
  )
  assert.deepEqual(
    await claim(pg),
    [],
    "pending explicit recovery cannot race an automatic continuation creation",
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT public.load_stripe_trial_paid_recovery_request($1)", [operationId]),
    /permission denied/,
  )
})
