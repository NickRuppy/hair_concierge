import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { dispatchTrialReminders } from "../src/lib/billing/trial-reminders-delivery"

const ROOT = new URL("../", import.meta.url)
const USER = "11111111-1111-4111-8111-111111111111"
const STRIPE = "22222222-2222-4222-8222-222222222222"
const PAYPAL = "33333333-3333-4333-8333-333333333333"
const PAID = "44444444-4444-4444-8444-444444444444"
const REVOKED = "55555555-5555-4555-8555-555555555555"
const EXPIRED = "66666666-6666-4666-8666-666666666666"
const UNRESOLVED = "77777777-7777-4777-8777-777777777777"
const NOT_DUE = "88888888-8888-4888-8888-888888888888"
const YEAR = createTrialOfferSnapshot("year", {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_year",
})
const MONTH = createTrialOfferSnapshot("month", {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_year",
})

async function db(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public TO service_role;`)
  for (const file of [
    "20260914044650_trial_admission_foundation.sql",
    "20260914090614_trial_cancellation_declarations.sql",
    "20260914094203_trial_payment_events.sql",
    "20260914140320_trial_management_operations.sql",
    "20260914135527_trial_required_notices.sql",
    "20260914141036_trial_required_notice_revisions.sql",
    "20260915050225_trial_reminders_outbox.sql",
  ])
    await pg.exec(await readFile(new URL(`supabase/migrations/${file}`, ROOT), "utf8"))
  await pg.query("INSERT INTO public.profiles VALUES ($1)", [USER])
  return pg
}

async function enroll(
  pg: PGlite,
  id: string,
  provider: "stripe" | "paypal",
  offer = YEAR,
  authorization = "now()-interval '5 days'-interval '1 minute'",
) {
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,
    authorization_succeeded_at,original_trial_end_at) VALUES($1,$2,$3,$4,$5,'active',${authorization},${authorization}+interval '7 days')`,
    [id, USER, JSON.stringify(offer), provider, `${provider}_${id}`],
  )
}

async function due(pg: PGlite) {
  return (
    await pg.query<{ n: number }>(
      "SELECT public.enqueue_due_trial_reminders(clock_timestamp()-interval '5 days'-interval '2 minutes') n",
    )
  ).rows[0]!.n
}

test("queues each eligible Stripe and PayPal new trial exactly once using the frozen required-notice contract shape", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe", YEAR)
  await enroll(pg, PAYPAL, "paypal", MONTH)
  await pg.exec("SET ROLE service_role")
  assert.equal(await due(pg), 2)
  assert.equal(await due(pg), 0)
  const rows = (
    await pg.query<{
      enrollment_id: string
      reminder_version: string
      snapshot: Record<string, unknown>
    }>(
      "SELECT enrollment_id,reminder_version,snapshot FROM private.trial_reminders ORDER BY enrollment_id",
    )
  ).rows
  assert.equal(rows.length, 2)
  assert.equal(rows[0]!.reminder_version, "trial_ending_v1")
  assert.equal(rows[0]!.snapshot.version, "trial_required_notices_v1")
  assert.equal(typeof rows[0]!.snapshot.trialEndAt, "string")
  assert.deepEqual(rows.map((row) => row.snapshot.interval).sort(), ["month", "year"])
})

test("does not queue before the immutable trial end is within 48 hours", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await enroll(pg, NOT_DUE, "paypal", MONTH, "now()-interval '4 days'-interval '23 hours'")
  await pg.exec("SET ROLE service_role")
  assert.equal(await due(pg), 1)
  assert.deepEqual(
    (
      await pg.query<{ enrollment_id: string }>("SELECT enrollment_id FROM private.trial_reminders")
    ).rows.map((row) => row.enrollment_id),
    [STRIPE],
  )
})

test("rollout cutoff excludes earlier trials and cancellation suppresses an already queued reminder", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe", YEAR, "now()-interval '5 days'-interval '3 minutes'")
  await enroll(pg, PAYPAL, "paypal")
  await pg.exec("SET ROLE service_role")
  assert.equal(await due(pg), 1, "only cutoff-eligible PayPal trial queues")
  await pg.exec(
    `UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id='${PAYPAL}'`,
  )
  assert.equal((await pg.query("SELECT * FROM public.claim_trial_reminders(3,90)")).rows.length, 0)
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "SELECT status FROM private.trial_reminders WHERE enrollment_id=$1",
        [PAYPAL],
      )
    ).rows[0]!.status,
    "superseded",
  )
})

test("paid, revoked, expired, and provider-unresolved trials never queue", async (t) => {
  const pg = await db(t)
  await enroll(pg, PAID, "stripe")
  await enroll(pg, REVOKED, "paypal")
  await enroll(pg, EXPIRED, "stripe", YEAR, "now()-interval '8 days'")
  await enroll(pg, UNRESOLVED, "paypal")
  await pg.exec("SET ROLE service_role")
  await pg.exec(`UPDATE public.trial_enrollments SET first_payment_succeeded_at=clock_timestamp(),paid_through_at=clock_timestamp()+interval '1 month' WHERE id='${PAID}';
    UPDATE public.trial_enrollments SET access_revoked=true WHERE id='${REVOKED}';
    INSERT INTO private.trial_cancellation_declarations(id,enrollment_id,user_id,request_id,effective_end_at)
      VALUES(gen_random_uuid(),'${UNRESOLVED}','${USER}',gen_random_uuid(),clock_timestamp()+interval '2 days');
    INSERT INTO private.trial_cancellation_provider_operations(declaration_id,status)
      SELECT id,'pending' FROM private.trial_cancellation_declarations WHERE enrollment_id='${UNRESOLVED}';`)
  assert.equal(await due(pg), 0)
  assert.equal((await pg.query("SELECT * FROM private.trial_reminders")).rows.length, 0)
})

test("fresh prepare fences cancellation and repeated workers before a provider call", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await pg.exec("SET ROLE service_role")
  await due(pg)
  const claimed = (
    await pg.query<{
      reminder_id: string
      attempt_id: string
      user_id: string
      snapshot: Record<string, unknown>
    }>("SELECT * FROM public.claim_trial_reminders(3,90)")
  ).rows[0]!
  const prepared = (
    await pg.query("SELECT * FROM public.prepare_trial_reminder_send($1,$2)", [
      claimed.reminder_id,
      claimed.attempt_id,
    ])
  ).rows
  assert.equal(prepared.length, 1)
  assert.equal(
    (
      await pg.query("SELECT * FROM public.prepare_trial_reminder_send($1,$2)", [
        claimed.reminder_id,
        claimed.attempt_id,
      ])
    ).rows.length,
    0,
    "one attempt must not obtain a second send permission",
  )
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.complete_trial_reminder($1,$2,'queued','', 'cio_1', '2026-09-20T00:00:01Z','Betreff','Text') ok",
        [claimed.reminder_id, claimed.attempt_id],
      )
    ).rows[0]!.ok,
    true,
  )
  assert.equal((await pg.query("SELECT * FROM public.claim_trial_reminders(3,90)")).rows.length, 0)
})

test("cancellation after claim is a fresh no-send fence, while an undispatched failure can be parked", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await pg.exec("SET ROLE service_role")
  await due(pg)
  const claimed = (
    await pg.query<{ reminder_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_reminders(3,90)",
    )
  ).rows[0]!
  await pg.exec(
    `UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id='${STRIPE}'`,
  )
  assert.equal(
    (
      await pg.query("SELECT * FROM public.prepare_trial_reminder_send($1,$2)", [
        claimed.reminder_id,
        claimed.attempt_id,
      ])
    ).rows.length,
    0,
  )
  assert.equal(
    (
      await pg.query<{ status: string }>("SELECT status FROM private.trial_reminders WHERE id=$1", [
        claimed.reminder_id,
      ])
    ).rows[0]!.status,
    "superseded",
  )

  await enroll(pg, PAYPAL, "paypal")
  await due(pg)
  const failedBeforeDispatch = (
    await pg.query<{ reminder_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_reminders(3,90)",
    )
  ).rows[0]!
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.complete_trial_reminder($1,$2,'support_required','recipient_owner_unavailable',NULL,NULL,NULL,NULL) ok",
        [failedBeforeDispatch.reminder_id, failedBeforeDispatch.attempt_id],
      )
    ).rows[0]!.ok,
    true,
  )
})

test("a temporary management change holds a claimed reminder and releases it after reconciliation", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await pg.exec("SET ROLE service_role")
  await due(pg)
  const first = (
    await pg.query<{ reminder_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_reminders(3,90)",
    )
  ).rows[0]!
  const operation = (
    await pg.query<{ id: string }>(
      `INSERT INTO private.trial_management_operations(
      id,enrollment_id,user_id,kind,expected_revision,cancellation_version,provider,provider_customer_id,
      original_agreement_id,source_agreement_id,original_trial_end_at,source_offer,target_offer,
      source_cancel_at_period_end,cancel_at_period_end)
     SELECT gen_random_uuid(),e.id,e.user_id,'switch',0,0,e.provider,'customer',e.provider_agreement_id,e.provider_agreement_id,
       e.original_trial_end_at,$2::jsonb,$2::jsonb,false,false
     FROM public.trial_enrollments e WHERE e.id=$1 RETURNING id`,
      [STRIPE, JSON.stringify(YEAR)],
    )
  ).rows[0]!
  assert.equal(
    (
      await pg.query("SELECT * FROM public.prepare_trial_reminder_send($1,$2)", [
        first.reminder_id,
        first.attempt_id,
      ])
    ).rows.length,
    0,
  )
  assert.equal(
    (
      await pg.query<{ status: string }>("SELECT status FROM private.trial_reminders WHERE id=$1", [
        first.reminder_id,
      ])
    ).rows[0]!.status,
    "pending",
  )
  await pg.query(
    "UPDATE private.trial_management_operations SET status='abandoned',completed_at=clock_timestamp(),reconciliation_reference='test' WHERE id=$1",
    [operation.id],
  )
  const second = (
    await pg.query<{ reminder_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_reminders(3,90)",
    )
  ).rows[0]!
  assert.notEqual(second.attempt_id, first.attempt_id)
  assert.equal(
    (
      await pg.query("SELECT * FROM public.prepare_trial_reminder_send($1,$2)", [
        second.reminder_id,
        second.attempt_id,
      ])
    ).rows.length,
    1,
  )
})

test("expired leases park for support and stale completion cannot overwrite the outcome", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await pg.exec("SET ROLE service_role")
  await due(pg)
  const claimed = (
    await pg.query<{ reminder_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_reminders(3,90)",
    )
  ).rows[0]!
  await pg.exec(
    "UPDATE private.trial_reminders SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id='" +
      claimed.reminder_id +
      "'",
  )
  assert.equal((await pg.query("SELECT * FROM public.claim_trial_reminders(3,90)")).rows.length, 0)
  assert.equal(
    (
      await pg.query<{ status: string }>("SELECT status FROM private.trial_reminders WHERE id=$1", [
        claimed.reminder_id,
      ])
    ).rows[0]!.status,
    "support_required",
  )
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.complete_trial_reminder($1,$2,'queued','', 'cio_1', '2026-09-20T00:00:01Z','Betreff','Text') ok",
        [claimed.reminder_id, claimed.attempt_id],
      )
    ).rows[0]!.ok,
    false,
  )
})

test("private rows and RPCs remain service-only", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(pg.query("SELECT * FROM private.trial_reminders"), /permission denied/)
  await assert.rejects(
    pg.query(
      "SELECT public.enqueue_due_trial_reminders(clock_timestamp()-interval '5 days'-interval '2 minutes')",
    ),
    /permission denied/,
  )
})

test("the dispatcher consumes the actual SQL RPC shape and records a fake Customer.io acknowledgement", async (t) => {
  const pg = await db(t)
  await enroll(pg, STRIPE, "stripe")
  await pg.exec("SET ROLE service_role")
  const stats = await dispatchTrialReminders({
    enabled: true,
    rolloutAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - 2 * 60 * 1000).toISOString(),
    messageId: "15",
    sender: "Chaarlie <info@chaarlie.de>",
    apiKeyPresent: true,
    enqueue: async (cutoff) => {
      await pg.query("SELECT public.enqueue_due_trial_reminders($1::timestamptz)", [cutoff])
    },
    claim: async () =>
      (
        await pg.query<{
          reminder_id: string
          attempt_id: string
          user_id: string
          snapshot: unknown
        }>("SELECT * FROM public.claim_trial_reminders(3,90)")
      ).rows,
    recipient: async () => "trial@example.test",
    prepare: async (claim) =>
      (
        await pg.query<{
          reminder_id: string
          attempt_id: string
          user_id: string
          snapshot: unknown
        }>("SELECT * FROM public.prepare_trial_reminder_send($1,$2)", [
          claim.reminder_id,
          claim.attempt_id,
        ])
      ).rows[0] ?? null,
    send: async () => ({ deliveryId: "cio_test_delivery", queuedAt: new Date().toISOString() }),
    settle: async (claim, outcome, message) => {
      const result = await pg.query<{ ok: boolean }>(
        `SELECT public.complete_trial_reminder($1,$2,$3,$4,$5,$6::timestamptz,$7,$8) ok`,
        [
          claim.reminder_id,
          claim.attempt_id,
          outcome.status,
          "errorCode" in outcome ? outcome.errorCode : "",
          "deliveryId" in outcome ? outcome.deliveryId : "",
          "queuedAt" in outcome ? outcome.queuedAt : null,
          message?.subject ?? "",
          message?.receipt_text ?? "",
        ],
      )
      assert.equal(result.rows[0]!.ok, true)
    },
  })
  assert.deepEqual(stats, {
    claimed: 1,
    queued: 1,
    supportRequired: 0,
    skipped: 0,
    blocked: false,
    disabled: false,
  })
  assert.equal(
    (await pg.query<{ status: string }>("SELECT status FROM private.trial_reminders")).rows[0]!
      .status,
    "queued",
  )
})
