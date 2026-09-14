import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  freezeTrialManagementCatalog,
  type TrialManagementClient,
} from "../src/lib/billing/trial-management-operations"
import {
  beginTrialPaidRecoveryOperation,
  guardTrialPaidRecoveryOperation,
  commitTrialPaidRecoveryOperation,
  abandonTrialPaidRecoveryOperation,
  type TrialPaidRecoveryOperation,
  type TrialPaidRecoveryEvidence,
} from "../src/lib/billing/trial-paid-recovery-operations"
const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222",
  OP = "33333333-3333-4333-8333-333333333333",
  OTHER = "44444444-4444-4444-8444-444444444444"
const catalog = {
  month: createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
  year: createTrialOfferSnapshot("year", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
}
async function setup(
  t: { after(fn: () => Promise<void>): void },
  elapsedDays = 10,
  fullLedger = true,
) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text);
 GRANT USAGE ON SCHEMA public TO service_role;GRANT ALL ON public.billing_subscriptions TO service_role;`)
  for (const name of [
    "20260914044650_trial_admission_foundation",
    "20260914090614_trial_cancellation_declarations",
    "20260914094203_trial_payment_events",
    "20260914135114_stripe_trial_continuation_operations",
    "20260914140320_trial_management_operations",
    "20260914141149_trial_effective_payment_contract",
    "20260914142808_trial_paid_recovery_operations",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    )
  if (fullLedger)
    await pg.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20260914143515_trial_paid_recovery_ledger.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
  await pg.query("INSERT INTO public.profiles VALUES($1),($2)", [USER, OTHER])
  await pg.query(
    "INSERT INTO public.trial_enrollments(id,user_id,provider,accepted_offer) VALUES($1,$2,'paypal',$3)",
    [ENROLLMENT, USER, JSON.stringify(catalog.month)],
  )
  const client: TrialManagementClient = {
    async rpc(name, args) {
      try {
        const values = Object.values(args).map((v) =>
          typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        )
        const result = await pg.query<{ data: unknown }>(
          `SELECT public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) AS data`,
          values,
        )
        return { data: result.rows[0]!.data, error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
  await freezeTrialManagementCatalog(client, { enrollmentId: ENROLLMENT, catalog })
  await pg.query(
    `UPDATE public.trial_enrollments SET admission_status='active',provider_agreement_id='I-ORIGINAL',
 authorization_succeeded_at=now()-($1::integer*interval '1 day'),original_trial_end_at=now()-($1::integer*interval '1 day')+interval '7 days'`,
    [elapsedDays],
  )
  await pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id)
 VALUES($1,$2,'paypal','I-ORIGINAL','PAYER',$1)`,
    [ENROLLMENT, USER],
  )
  return { pg, client }
}
const start = {
  operationId: OP,
  enrollmentId: ENROLLMENT,
  authenticatedUserId: USER,
  kind: "recover_unpaid" as const,
  expectedRevision: 0,
}
function evidence(
  o: TrialPaidRecoveryOperation,
  firstBillingAt: string,
): TrialPaidRecoveryEvidence {
  return {
    provider: o.provider,
    providerCustomerId: o.providerCustomerId,
    sourceAgreementId: o.sourceAgreementId,
    targetAgreementId: "I-CANDIDATE",
    offer: o.offer,
    sourceAgreementNeutralized: true,
    noInFlightSourcePayment: true,
    noAdditionalCharge: o.kind === "repair_paid",
    firstBillingAt,
    reference: "retrieved_provider_facts",
  }
}
async function paidDebt(pg: PGlite) {
  await pg.exec(`UPDATE public.trial_enrollments SET first_payment_succeeded_at=date_trunc('second',now()-interval '1 day'),paid_through_at=date_trunc('second',now()-interval '1 day')+interval '1 month';
 INSERT INTO private.trial_payment_continuation_reconciliations(enrollment_id,provider,source_event_id,source_object_id,payment_succeeded_at,source_period_start_at,source_period_end_at,owed_paid_through_at)
 SELECT id,provider,'evt_old','sale_old',first_payment_succeeded_at,original_trial_end_at,original_trial_end_at+interval '1 month',paid_through_at FROM public.trial_enrollments;`)
}
test("paid recovery requires expired unpaid state or exact outstanding paid-boundary debt", async (t) => {
  const active = await setup(t, 1)
  await assert.rejects(() => beginTrialPaidRecoveryOperation(active.client, start))
  const f = await setup(t)
  await assert.rejects(() =>
    beginTrialPaidRecoveryOperation(f.client, { ...start, kind: "repair_paid" }),
  )
  await paidDebt(f.pg)
  await assert.rejects(() => beginTrialPaidRecoveryOperation(f.client, start))
  const repair = await beginTrialPaidRecoveryOperation(f.client, { ...start, kind: "repair_paid" })
  assert.equal(repair.sourceObjectId, "sale_old")
  assert.ok(repair.paidThroughAt)
  assert.equal(repair.sourceAgreementId, "I-ORIGINAL")
})
test("one durable pending paid action, original owner and revision remain immutable", async (t) => {
  const { pg, client } = await setup(t)
  const o = await beginTrialPaidRecoveryOperation(client, start)
  assert.equal((await beginTrialPaidRecoveryOperation(client, start)).id, o.id)
  await assert.rejects(() =>
    beginTrialPaidRecoveryOperation(client, { ...start, operationId: OTHER }),
  )
  await assert.rejects(() =>
    beginTrialPaidRecoveryOperation(client, { ...start, authenticatedUserId: OTHER }),
  )
  await assert.rejects(() =>
    beginTrialPaidRecoveryOperation(client, { ...start, expectedRevision: 1 }),
  )
  await assert.rejects(
    () => pg.exec("UPDATE private.trial_paid_recovery_operations SET source_agreement_id='forged'"),
    /immutable/,
  )
  assert.equal(
    await guardTrialPaidRecoveryOperation(client, { operationId: OP, authenticatedUserId: USER }),
    true,
  )
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  assert.equal(
    await guardTrialPaidRecoveryOperation(client, { operationId: OP, authenticatedUserId: USER }),
    false,
  )
  assert.equal(
    await abandonTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      reconciliationReference: "candidate_neutralized",
    }),
    true,
  )
  assert.equal(
    (
      await pg.query<{ c: boolean }>(
        "SELECT cancel_at_period_end AS c FROM public.trial_enrollments",
      )
    ).rows[0]!.c,
    true,
  )
})
test("competing old first payment wins before candidate commit", async (t) => {
  const { pg, client } = await setup(t)
  const o = await beginTrialPaidRecoveryOperation(client, start)
  await paidDebt(pg)
  assert.equal(
    await guardTrialPaidRecoveryOperation(client, { operationId: OP, authenticatedUserId: USER }),
    false,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, new Date().toISOString()),
      payment: null,
    }),
    false,
  )
  assert.equal((await pg.query("SELECT * FROM private.trial_paid_continuations")).rows.length, 0)
})
test("repair binds a no-charge successor at the owed deadline without changing cash facts or original terms", async (t) => {
  const { pg, client } = await setup(t)
  await paidDebt(pg)
  const before = (await pg.query("SELECT * FROM public.trial_enrollments")).rows[0]
  const o = await beginTrialPaidRecoveryOperation(client, { ...start, kind: "repair_paid" }),
    proof = evidence(o, o.paidThroughAt!)
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: { ...proof, noAdditionalCharge: false },
      payment: null,
    }),
    false,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: {
        ...proof,
        firstBillingAt: new Date(Date.parse(o.paidThroughAt!) + 1000).toISOString(),
      },
      payment: null,
    }),
    false,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
      payment: null,
    }),
    true,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
      payment: null,
    }),
    true,
  )
  assert.deepEqual((await pg.query("SELECT * FROM public.trial_enrollments")).rows[0], before)
  assert.equal(
    (
      await pg.query<{ s: string }>(
        "SELECT status AS s FROM private.trial_payment_continuation_reconciliations",
      )
    ).rows[0]!.s,
    "resolved",
  )
  assert.equal((await pg.query("SELECT * FROM private.trial_payment_events")).rows.length, 0)
})
test("a missing ledger successor allowance rolls back candidate link, cancellation clear and provider checkpoint", async (t) => {
  const { pg, client } = await setup(t, 10, false)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  const o = await beginTrialPaidRecoveryOperation(client, start)
  const row = (
    await pg.query<{
      start: string
      end: string
    }>(`SELECT to_char(date_trunc('second',now()),'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start,
 to_char(date_trunc('second',now())+interval '1 month','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end`)
  ).rows[0]!
  const payment = {
    provider: "paypal" as const,
    enrollmentId: ENROLLMENT,
    agreementId: "I-CANDIDATE",
    sourceEventId: "evt_candidate",
    sourceObjectId: "sale_candidate",
    outcome: "succeeded" as const,
    occurredAt: row.start,
    amountMinor: 999,
    currency: "EUR" as const,
    periodStartAt: row.start,
    periodEndAt: row.end,
  }
  await assert.rejects(() =>
    commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, row.start),
      payment,
    }),
  )
  assert.equal((await pg.query("SELECT * FROM private.trial_paid_continuations")).rows.length, 0)
  assert.equal((await pg.query("SELECT * FROM private.trial_payment_events")).rows.length, 0)
  const enrollment = (
    await pg.query<{ c: boolean; p: string | null }>(
      "SELECT cancel_at_period_end AS c,first_payment_succeeded_at AS p FROM public.trial_enrollments",
    )
  ).rows[0]!
  assert.equal(enrollment.c, true)
  assert.equal(enrollment.p, null)
  assert.equal(
    (
      await pg.query<{ v: string | null }>(
        "SELECT provider_verified_at AS v FROM private.trial_paid_recovery_operations",
      )
    ).rows[0]!.v,
    null,
  )
})
test("paid recovery RPCs are service-only and raw operation writes are denied", async (t) => {
  const { pg, client } = await setup(t)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(() => beginTrialPaidRecoveryOperation(client, start))
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  await beginTrialPaidRecoveryOperation(client, start)
  await assert.rejects(
    () =>
      pg.exec(
        "UPDATE private.trial_paid_recovery_operations SET status='abandoned',completed_at=now()",
      ),
    /permission denied/,
  )
})

test("verified paid consent commits candidate, first payment and full period atomically through the real ledger", async (t) => {
  const { pg, client } = await setup(t)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  const original = (
    await pg.query<{ offer: unknown; deadline: unknown }>(
      "SELECT accepted_offer AS offer,original_trial_end_at AS deadline FROM public.trial_enrollments",
    )
  ).rows[0]!
  const o = await beginTrialPaidRecoveryOperation(client, start)
  const row = (
    await pg.query<{
      start: string
      end: string
    }>(`SELECT to_char(date_trunc('second',now()),'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start,
 to_char(date_trunc('second',now())+interval '1 month','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end`)
  ).rows[0]!
  const payment = {
    provider: "paypal" as const,
    enrollmentId: ENROLLMENT,
    agreementId: "I-CANDIDATE",
    sourceEventId: "evt_candidate",
    sourceObjectId: "sale_candidate",
    outcome: "succeeded" as const,
    occurredAt: row.start,
    amountMinor: 999,
    currency: "EUR" as const,
    periodStartAt: new Date(Date.parse(row.start) - 1000).toISOString(),
    periodEndAt: new Date(Date.parse(row.end) - 1000).toISOString(),
  }
  const proof = evidence(o, row.start)
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: { ...proof, providerCustomerId: "OTHER_PAYER" },
      payment,
    }),
    false,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
      payment: { ...payment, amountMinor: 1 },
    }),
    false,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
      payment,
    }),
    true,
  )
  assert.equal(
    await commitTrialPaidRecoveryOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
      payment,
    }),
    true,
  )
  const saved = (
    await pg.query<{ c: boolean; p: Date; end: Date; offer: unknown; deadline: unknown }>(
      "SELECT cancel_at_period_end AS c,first_payment_succeeded_at AS p,paid_through_at AS end,accepted_offer AS offer,original_trial_end_at AS deadline FROM public.trial_enrollments",
    )
  ).rows[0]!
  assert.equal(saved.c, false)
  assert.equal(saved.p.toISOString(), new Date(row.start).toISOString())
  assert.equal(saved.end.toISOString(), new Date(row.end).toISOString())
  assert.deepEqual(saved.offer, original.offer)
  assert.deepEqual(saved.deadline, original.deadline)
  const ledger = (
    await pg.query<{ result: string; phase: string }>(
      "SELECT result,phase FROM private.trial_payment_events",
    )
  ).rows
  assert.deepEqual(ledger, [{ result: "applied", phase: "first_paid" }])
  assert.equal(
    (
      await pg.query<{ s: string }>(
        "SELECT status AS s FROM private.trial_payment_continuation_reconciliations",
      )
    ).rows[0]!.s,
    "pending",
  )
  assert.equal(
    (
      await pg.query<{ c: any }>("SELECT public.read_trial_effective_contract($1) AS c", [
        ENROLLMENT,
      ])
    ).rows[0]!.c.provider_agreement_id,
    "I-CANDIDATE",
  )
  assert.equal((await pg.query("SELECT * FROM public.trial_identity_claims")).rows.length, 0)
})

test("public paid recovery snapshot distinguishes expired consent and existing paid repair without leaking provider IDs", async (t) => {
  const active = await setup(t, 1)
  const get = async (pg: PGlite) =>
    (
      await pg.query<{ v: any }>("SELECT public.load_trial_paid_recovery_public_view($1,$2) AS v", [
        ENROLLMENT,
        USER,
      ])
    ).rows[0]!.v
  assert.equal((await get(active.pg)).kind, null)
  const unpaid = await setup(t)
  const view = await get(unpaid.pg)
  assert.equal(view.kind, "recover_unpaid")
  assert.equal(view.offer.firstAmountMinor, 999)
  assert.doesNotMatch(JSON.stringify(view), /I-ORIGINAL|PAYER|price_month|coupon/)
  await beginTrialPaidRecoveryOperation(unpaid.client, start)
  assert.deepEqual((await get(unpaid.pg)).pendingOperation, {
    operationId: OP,
    kind: "recover_unpaid",
  })
  const foreign = await unpaid.pg.query<{ v: any }>(
    "SELECT public.load_trial_paid_recovery_public_view($1,$2) AS v",
    [ENROLLMENT, OTHER],
  )
  assert.equal(foreign.rows[0]!.v, null)
  const paid = await setup(t)
  await paidDebt(paid.pg)
  assert.equal((await get(paid.pg)).kind, "repair_paid")
  await paid.pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  assert.equal((await get(paid.pg)).kind, null)
})
