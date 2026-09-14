import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
const ROOT = new URL("../", import.meta.url)
const USER = "11111111-1111-4111-8111-111111111111"
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const OFFER = createTrialOfferSnapshot("year", {
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
    "20260914135527_trial_required_notices.sql",
    "20260914140320_trial_management_operations.sql",
    "20260914141036_trial_required_notice_revisions.sql",
  ]) {
    let sql = await readFile(new URL(`supabase/migrations/${file}`, ROOT), "utf8")
    if (process.env.TRIAL_NOTICE_MUTANT === "zero-receipts" && file.includes("required_notices"))
      sql = sql
        .replace("NEW.amount_minor>0", "NEW.amount_minor>=0")
        .replace("NEW.result='applied'", "true")
        .replace("NEW.phase IN ('first_paid','renewal')", "true")
    await pg.exec(sql)
  }
  await pg.query("INSERT INTO public.profiles VALUES ($1)", [USER])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider) VALUES ($1,$2,$3,'stripe')`,
    [ENROLLMENT, USER, JSON.stringify(OFFER)],
  )
  return pg
}
async function authorize(pg: PGlite) {
  await pg.query(
    `UPDATE public.trial_enrollments SET provider_agreement_id='agreement',admission_status='active',
    authorization_succeeded_at='2024-01-01Z',original_trial_end_at='2024-01-08Z' WHERE id=$1`,
    [ENROLLMENT],
  )
}
async function notices(pg: PGlite) {
  return (
    await pg.query<{ kind: string; status: string; snapshot: Record<string, unknown> }>(
      "SELECT kind,status,snapshot FROM private.trial_required_notices ORDER BY created_at,id",
    )
  ).rows
}
async function payment(pg: PGlite, overrides: Record<string, unknown> = {}) {
  const event = {
    provider: "stripe",
    enrollmentId: ENROLLMENT,
    agreementId: "agreement",
    sourceEventId: "evt1",
    sourceObjectId: "in1",
    outcome: "succeeded",
    occurredAt: "2024-01-08T00:00:00Z",
    amountMinor: 6999,
    currency: "EUR",
    periodStartAt: "2024-01-08T00:00:00Z",
    periodEndAt: "2025-01-08T00:00:00Z",
    ...overrides,
  }
  return (
    await pg.query("SELECT public.record_trial_payment_event($1::jsonb) result", [
      JSON.stringify(event),
    ])
  ).rows[0]
}
test("authorization and payment ledger enqueue only confirmed events, once, with accepted facts", async (t) => {
  const pg = await db(t)
  assert.equal((await notices(pg)).length, 0)
  await authorize(pg)
  await authorize(pg)
  assert.deepEqual(
    (await notices(pg)).map((n) => n.kind),
    ["contract_confirmation"],
  )
  assert.equal((await notices(pg))[0]!.snapshot.firstAmountMinor, 6999)
  assert.equal((await notices(pg))[0]!.snapshot.renewalAmountMinor, 9999)
  await payment(pg, { amountMinor: 0 })
  assert.equal((await notices(pg)).length, 1)
  await payment(pg, { sourceEventId: "evt2", sourceObjectId: "in2" })
  await payment(pg, { sourceEventId: "evt2", sourceObjectId: "in2" })
  const paid = (await notices(pg)).find((n) => n.kind === "payment_receipt")!
  assert.equal(paid.snapshot.amountMinor, 6999)
  assert.equal(paid.snapshot.occurredAt, "2024-01-08T00:00:00+00:00")
  assert.equal((await notices(pg)).length, 2)
  await pg.exec(`UPDATE public.trial_enrollments SET paid_through_at='2026-01-08Z'`)
  assert.equal(
    (await notices(pg)).length,
    2,
    "a synthetic entitlement extension must never create a paid receipt",
  )
  await pg.exec("SET ROLE service_role")
  assert.equal(
    (await pg.query("SELECT * FROM public.claim_trial_required_notices(1,90)")).rows.length,
    1,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    pg.query("SELECT * FROM private.trial_required_notices"),
    /permission denied/,
  )
  await assert.rejects(
    pg.query("SELECT * FROM public.claim_trial_required_notices(1,90)"),
    /permission denied/,
  )
})
test("claim fence, immutable snapshot, crash parking, and queue acknowledgement are durable", async (t) => {
  const pg = await db(t)
  await authorize(pg)
  const first = (
    await pg.query<{ notice_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_required_notices(1,90)",
    )
  ).rows[0]!
  assert.equal(
    (await pg.query("SELECT * FROM public.claim_trial_required_notices(1,90)")).rows.length,
    0,
  )
  await assert.rejects(
    pg.exec("UPDATE private.trial_required_notices SET snapshot='{}'::jsonb"),
    /immutable/i,
  )
  const args = [
    first.notice_id,
    first.attempt_id,
    "queued",
    "",
    "delivery1",
    "2024-01-01T00:00:00Z",
    "Betreff",
    "Text",
  ]
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.complete_trial_required_notice($1,$2,$3,$4,$5,$6,$7,$8) ok",
        args,
      )
    ).rows[0]!.ok,
    true,
  )
  assert.equal((await notices(pg))[0]!.status, "queued")
  assert.equal(
    (await pg.query("SELECT * FROM public.claim_trial_required_notices(1,90)")).rows.length,
    0,
  )
  await pg.query(
    `INSERT INTO private.trial_cancellation_declarations(enrollment_id,user_id,request_id,effective_end_at) VALUES ($1,$2,gen_random_uuid(),'2024-01-08Z')`,
    [ENROLLMENT, USER],
  )
  const second = (
    await pg.query<{ notice_id: string; attempt_id: string }>(
      "SELECT * FROM public.claim_trial_required_notices(1,90)",
    )
  ).rows[0]!
  await pg.exec(
    "UPDATE private.trial_required_notices SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE status='sending'",
  )
  await pg.query("SELECT * FROM public.claim_trial_required_notices(1,90)")
  assert.equal((await notices(pg))[1]!.status, "support_required")
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.complete_trial_required_notice($1,$2,'queued','','delivery2','2024-01-01Z','x','y') ok",
        [second.notice_id, second.attempt_id],
      )
    ).rows[0]!.ok,
    false,
  )
})
test("annual due selection excludes unpaid/canceled and parks too-late notices", async (t) => {
  const pg = await db(t)
  await authorize(pg)
  await pg.query("SELECT public.enqueue_due_trial_annual_notices('2024-12-10Z')")
  assert.equal((await notices(pg)).length, 1)
  await payment(pg)
  await pg.query("SELECT public.enqueue_due_trial_annual_notices('2024-12-10Z')")
  await pg.query("SELECT public.enqueue_due_trial_annual_notices('2024-12-10Z')")
  const annual = (await notices(pg)).filter((n) => n.kind === "annual_renewal")
  assert.equal(annual.length, 1)
  assert.equal(annual[0]!.snapshot.amountMinor, 9999)
  assert.equal(annual[0]!.status, "pending")
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  await pg.query("SELECT * FROM public.claim_trial_required_notices(10,90)")
  assert.equal((await notices(pg)).find((n) => n.kind === "annual_renewal")!.status, "superseded")
})

test("annual notices missed within seven days park, and months never get an annual notice", async (t) => {
  const pg = await db(t)
  await authorize(pg)
  await payment(pg)
  await pg.exec(
    "UPDATE public.trial_enrollments SET paid_through_at=clock_timestamp()+interval '6 days'",
  )
  await pg.query("SELECT public.enqueue_due_trial_annual_notices()")
  const annual = (await notices(pg)).find((n) => n.kind === "annual_renewal")!
  assert.equal(annual.status, "support_required")
  await pg.exec("DELETE FROM private.trial_required_notices WHERE kind='annual_renewal'")
  await pg.exec(
    "ALTER TABLE public.trial_enrollments DISABLE TRIGGER protect_trial_enrollment_terms",
  )
  await pg.exec(
    `UPDATE public.trial_enrollments SET accepted_offer=jsonb_set(accepted_offer,'{interval}','"month"'),paid_through_at=clock_timestamp()+interval '20 days'`,
  )
  await pg.query("SELECT public.enqueue_due_trial_annual_notices()")
  assert.equal((await notices(pg)).filter((n) => n.kind === "annual_renewal").length, 0)
})

test("committed switch/restore confirmations use selected revision and preserve original deadline, while pending sends nothing", async (t) => {
  const pg = await db(t)
  const month = createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_year",
  })
  await pg.query("SELECT public.freeze_trial_management_catalog($1,$2)", [
    ENROLLMENT,
    JSON.stringify({ month, year: OFFER }),
  ])
  await pg.query(
    `UPDATE public.trial_enrollments SET admission_status='active',provider_agreement_id='agreement',authorization_succeeded_at=now()-interval '1 day',original_trial_end_at=now()+interval '6 days' WHERE id=$1`,
    [ENROLLMENT],
  )
  await pg.exec(
    "ALTER TABLE public.billing_subscriptions ADD COLUMN user_id uuid, ADD COLUMN provider text, ADD COLUMN provider_subscription_id text, ADD COLUMN provider_customer_id text",
  )
  await pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id) VALUES(gen_random_uuid(),$1,'stripe','agreement','cus_owner',$2)`,
    [USER, ENROLLMENT],
  )
  const opId = "33333333-3333-4333-8333-333333333333"
  const begin = (
    await pg.query<{ o: Record<string, unknown> }>(
      "SELECT public.begin_trial_management_operation($1,$2,$3,'switch',0,'month') o",
      [opId, ENROLLMENT, USER],
    )
  ).rows[0]!.o
  assert.equal((await notices(pg)).length, 1)
  const evidence = {
    provider: "stripe",
    providerCustomerId: "cus_owner",
    sourceAgreementId: "agreement",
    targetAgreementId: "agreement",
    offer: month,
    originalTrialEndAt: begin.originalTrialEndAt,
    cancelAtPeriodEnd: false,
    noImmediatePayment: true,
    sourceAgreementNeutralized: false,
    reference: "verified_test",
  }
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.commit_trial_management_operation($1,$2,$3) ok",
        [opId, USER, JSON.stringify(evidence)],
      )
    ).rows[0]!.ok,
    true,
  )
  await pg.query("SELECT public.commit_trial_management_operation($1,$2,$3)", [
    opId,
    USER,
    JSON.stringify(evidence),
  ])
  const changes = (await notices(pg)).filter((n) => n.kind === "contract_change")
  assert.equal(changes.length, 1)
  assert.equal(changes[0]!.snapshot.interval, "month")
  assert.equal(changes[0]!.snapshot.firstAmountMinor, 999)
  assert.equal(changes[0]!.snapshot.revision, 1)
  assert.equal(changes[0]!.snapshot.trialEndAt, begin.originalTrialEndAt)
  assert.equal(
    (await notices(pg))[0]!.snapshot.interval,
    "year",
    "original confirmation remains frozen",
  )
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  const restoreId = "44444444-4444-4444-8444-444444444444"
  await pg.query("SELECT public.begin_trial_management_operation($1,$2,$3,'restore',1,'month')", [
    restoreId,
    ENROLLMENT,
    USER,
  ])
  assert.equal((await notices(pg)).filter((n) => n.kind === "contract_change").length, 1)
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        "SELECT public.commit_trial_management_operation($1,$2,$3) ok",
        [restoreId, USER, JSON.stringify(evidence)],
      )
    ).rows[0]!.ok,
    true,
  )
  const restored = (await notices(pg)).filter((n) => n.kind === "contract_change")[1]!
  assert.equal(restored.snapshot.changeKind, "restore")
  assert.equal(restored.snapshot.cancelAtPeriodEnd, false)
  // Exercise the downstream ledger-trigger consumer with selected terms. This
  // is synthetic database input, not an assertion of a real provider payment.
  await pg.exec(
    `UPDATE public.trial_enrollments SET first_payment_succeeded_at=now(),paid_through_at=now()+interval '1 month'`,
  )
  await pg.query(
    `INSERT INTO private.trial_payment_events(enrollment_id,provider,source_event_id,source_object_id,outcome,occurred_at,amount_minor,currency,period_start_at,period_end_at,result,phase)
  VALUES($1,'stripe','evt_selected','in_selected','succeeded',now(),999,'EUR',now(),now()+interval '1 month','applied','first_paid')`,
    [ENROLLMENT],
  )
  const paid = (await notices(pg)).find((n) => n.kind === "payment_receipt")!
  assert.equal(paid.snapshot.interval, "month")
  assert.equal(paid.snapshot.firstAmountMinor, 999)
  await pg.query("SELECT public.enqueue_due_trial_annual_notices()")
  assert.equal((await notices(pg)).filter((n) => n.kind === "annual_renewal").length, 0)
})
