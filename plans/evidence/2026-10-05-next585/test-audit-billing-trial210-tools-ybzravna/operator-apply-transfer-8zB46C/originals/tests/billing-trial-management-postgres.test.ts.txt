import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  freezeTrialManagementCatalog,
  beginTrialManagementOperation,
  commitTrialManagementOperation,
  loadTrialManagementState,
  guardTrialManagementOperation,
  abandonTrialManagementOperation,
  type TrialManagementProviderEvidence,
  type TrialManagementClient,
} from "../src/lib/billing/trial-management-operations"
const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222"
const OP = "33333333-3333-4333-8333-333333333333",
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
async function setup(t: { after(fn: () => Promise<void>): void }, elapsedDays = 1) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,user_id uuid,provider text,provider_subscription_id text,provider_customer_id text);
 GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON public.billing_subscriptions TO service_role;`)
  for (const name of [
    "20260914044650_trial_admission_foundation",
    "20260914090614_trial_cancellation_declarations",
    "20260914140320_trial_management_operations",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"),
    )
  await pg.query("INSERT INTO public.profiles VALUES($1),($2)", [USER, OTHER])
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider) VALUES($1,$2,$3,'stripe')`,
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
    `UPDATE public.trial_enrollments SET provider_agreement_id='sub_original',admission_status='active',
 authorization_succeeded_at=now()-($2::integer * interval '1 day'),original_trial_end_at=now()-($2::integer * interval '1 day')+interval '7 days' WHERE id=$1`,
    [ENROLLMENT, elapsedDays],
  )
  return { pg, client }
}
async function ready(t: { after(fn: () => Promise<void>): void }, elapsedDays = 1) {
  const result = await setup(t, elapsedDays)
  await result.pg.query(
    `INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_subscription_id,provider_customer_id,trial_enrollment_id)
 VALUES($1,$2,'stripe','sub_original','cus_owner',$1)`,
    [ENROLLMENT, USER],
  )
  return result
}
const start = {
  operationId: OP,
  enrollmentId: ENROLLMENT,
  authenticatedUserId: USER,
  kind: "switch" as const,
  expectedRevision: 0,
  targetInterval: "year" as const,
}
function evidence(
  o: Awaited<ReturnType<typeof beginTrialManagementOperation>>,
  extra: Partial<TrialManagementProviderEvidence> = {},
): TrialManagementProviderEvidence {
  return {
    provider: o.provider,
    providerCustomerId: o.providerCustomerId,
    sourceAgreementId: o.sourceAgreementId,
    targetAgreementId: o.sourceAgreementId,
    originalTrialEndAt: o.originalTrialEndAt,
    offer: o.targetOffer,
    cancelAtPeriodEnd: o.cancelAtPeriodEnd,
    noImmediatePayment: true,
    sourceAgreementNeutralized: false,
    reference: "retrieved_verified",
    ...extra,
  }
}
test("switch/reversal append selected terms without rewriting accepted offer, deadline or identity claims", async (t) => {
  const { pg, client } = await ready(t)
  const before = (await pg.query("SELECT * FROM public.trial_enrollments")).rows[0]
  const o = await beginTrialManagementOperation(client, start)
  assert.equal(
    await guardTrialManagementOperation(client, { operationId: OP, authenticatedUserId: USER }),
    true,
  )
  assert.equal((await loadTrialManagementState(client, start)).effectiveOffer.interval, "month")
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    true,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    true,
  )
  const state = await loadTrialManagementState(client, start)
  assert.equal(state.revision, 1)
  assert.deepEqual(state.effectiveOffer, catalog.year)
  const reverse = await beginTrialManagementOperation(client, {
    ...start,
    operationId: OTHER,
    expectedRevision: 1,
    targetInterval: "month",
  })
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OTHER,
      authenticatedUserId: USER,
      evidence: evidence(reverse),
    }),
    true,
  )
  assert.deepEqual((await pg.query("SELECT * FROM public.trial_enrollments")).rows[0], before)
  assert.equal((await pg.query("SELECT * FROM private.trial_offer_revisions")).rows.length, 2)
  assert.equal((await pg.query("SELECT * FROM public.trial_identity_claims")).rows.length, 0)
})
test("one pending operation, owner binding, expected revision, immutable catalog and revisions", async (t) => {
  const { pg, client } = await ready(t)
  const o = await beginTrialManagementOperation(client, start)
  assert.equal((await beginTrialManagementOperation(client, start)).id, o.id)
  await assert.rejects(() =>
    beginTrialManagementOperation(client, { ...start, operationId: OTHER }),
  )
  await assert.rejects(() =>
    beginTrialManagementOperation(client, { ...start, authenticatedUserId: OTHER }),
  )
  await assert.rejects(() =>
    beginTrialManagementOperation(client, { ...start, expectedRevision: 2 }),
  )
  await assert.rejects(() =>
    freezeTrialManagementCatalog(client, {
      enrollmentId: ENROLLMENT,
      catalog: { ...catalog, year: { ...catalog.year, stripePriceId: "price_new" } },
    }),
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: OTHER,
      evidence: evidence(o),
    }),
    false,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, { providerCustomerId: "cus_wrong" }),
    }),
    false,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, { offer: catalog.month }),
    }),
    false,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    true,
  )
  await assert.rejects(
    () => pg.exec("UPDATE private.trial_offer_revisions SET revision=4"),
    /immutable/,
  )
  await assert.rejects(() => pg.exec("DELETE FROM private.trial_offer_revisions"), /immutable/)
  await assert.rejects(
    () =>
      pg.exec("UPDATE private.trial_management_operations SET status='pending',completed_at=NULL"),
    /immutable/,
  )
})
test("cancellation and first payment between provider request and commit invalidate CAS", async (t) => {
  const { pg, client } = await ready(t)
  const o = await beginTrialManagementOperation(client, start)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  assert.equal(
    await guardTrialManagementOperation(client, { operationId: OP, authenticatedUserId: USER }),
    false,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    false,
  )
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=false")
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    false,
  )
  assert.equal(
    await abandonTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      reconciliationReference: "provider_unchanged",
    }),
    true,
  )
  const next = await beginTrialManagementOperation(client, { ...start, operationId: OTHER })
  await pg.exec(
    "UPDATE public.trial_enrollments SET first_payment_succeeded_at=now(),paid_through_at=now()+interval '1 month'",
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OTHER,
      authenticatedUserId: USER,
      evidence: evidence(next),
    }),
    false,
  )
})
test("restore keeps cancellation until verified commit; replacement retains original agreement; replay cannot clear new cancellation", async (t) => {
  const { pg, client } = await ready(t)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  const o = await beginTrialManagementOperation(client, {
    ...start,
    kind: "restore",
    targetInterval: "month",
  })
  assert.equal(
    (
      await pg.query<{ cancel_at_period_end: boolean }>(
        "SELECT cancel_at_period_end FROM public.trial_enrollments",
      )
    ).rows[0]!.cancel_at_period_end,
    true,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, { targetAgreementId: "sub_restored" }),
    }),
    false,
  )
  const proof = evidence(o, { targetAgreementId: "sub_restored", sourceAgreementNeutralized: true })
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
    }),
    true,
  )
  const state = await loadTrialManagementState(client, start)
  assert.equal(state.originalAgreementId, "sub_original")
  assert.equal(state.currentAgreementId, "sub_restored")
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: proof,
    }),
    true,
  )
  assert.equal(
    (
      await pg.query<{ cancel_at_period_end: boolean }>(
        "SELECT cancel_at_period_end FROM public.trial_enrollments",
      )
    ).rows[0]!.cancel_at_period_end,
    true,
  )
})
test("a repeated cancellation declaration while canceled blocks pending restore, abandoned action leaves old state", async (t) => {
  const { pg, client } = await ready(t)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  const o = await beginTrialManagementOperation(client, {
    ...start,
    kind: "restore",
    targetInterval: "month",
  })
  await pg.query("SELECT public.submit_trial_cancellation_declaration($1,$2,$3)", [
    OTHER,
    USER,
    ENROLLMENT,
  ])
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    false,
  )
  assert.equal(
    await abandonTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      reconciliationReference: "provider_old_state_verified",
    }),
    true,
  )
  assert.equal((await loadTrialManagementState(client, start)).revision, 0)
  await assert.rejects(() =>
    beginTrialManagementOperation(client, {
      ...start,
      operationId: OTHER,
      kind: "restore",
      targetInterval: "month",
    }),
  )
})
test("service-only RPCs and immutable history deny anonymous/authenticated callers", async (t) => {
  const { pg, client } = await ready(t)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(() => beginTrialManagementOperation(client, start))
    await assert.rejects(() => pg.exec("SELECT * FROM private.trial_offer_revisions"))
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  const o = await beginTrialManagementOperation(client, start)
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o),
    }),
    true,
  )
  await assert.rejects(
    () => pg.exec("DELETE FROM private.trial_management_operations"),
    /permission denied/,
  )
})

test("original deadline is strict and provider evidence cannot extend it or collect immediately", async (t) => {
  const expired = await ready(t, 7)
  await assert.rejects(() => beginTrialManagementOperation(expired.client, start))
  const { client } = await ready(t)
  const o = await beginTrialManagementOperation(client, start)
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, {
        originalTrialEndAt: new Date(Date.parse(o.originalTrialEndAt) + 1000).toISOString(),
      }),
    }),
    false,
  )
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: { ...evidence(o), noImmediatePayment: false } as any,
    }),
    false,
  )
})

test("effective contract refuses a missing selected revision instead of reverting to original", async (t) => {
  const { pg, client } = await ready(t)
  await pg.exec("UPDATE private.trial_management_state SET revision=2")
  await assert.rejects(
    () => pg.query("SELECT public.read_trial_effective_contract($1)", [ENROLLMENT]),
    /reconciliation/,
  )
  await assert.rejects(() =>
    beginTrialManagementOperation(client, { ...start, expectedRevision: 2 }),
  )
})

test("replacement agreement and original admission share one binding namespace", async (t) => {
  const { pg, client } = await ready(t)
  const o = await beginTrialManagementOperation(client, start)
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(o, {
        targetAgreementId: "sub_replacement",
        sourceAgreementNeutralized: true,
      }),
    }),
    true,
  )
  await pg.query(
    `INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider)
    VALUES($1,$1,$2,'stripe')`,
    [OTHER, JSON.stringify(catalog.month)],
  )
  await assert.rejects(
    () =>
      pg.query(
        `UPDATE public.trial_enrollments SET provider_agreement_id='sub_replacement' WHERE id=$1`,
        [OTHER],
      ),
    /already belongs/,
  )
  await assert.rejects(
    () =>
      pg.query(
        `UPDATE public.trial_enrollments SET provider_agreement_id='sub_original' WHERE id=$1`,
        [OTHER],
      ),
    /duplicate key|already belongs/,
  )
  const bindings = await pg.query("SELECT * FROM private.trial_management_agreement_bindings")
  assert.equal(bindings.rows.length, 2)
})

test("public management snapshot atomically reflects committed revision and preserves canceled state", async (t) => {
  const { pg, client } = await ready(t)
  const read = async () =>
    (
      await pg.query<{ v: any }>("SELECT public.load_trial_management_public_view($1,$2) AS v", [
        ENROLLMENT,
        USER,
      ])
    ).rows[0]!.v
  const initial = await read()
  assert.equal(initial.canManage, true)
  assert.equal(initial.revision, 0)
  assert.equal(initial.offers.year.firstAmountMinor, 6999)
  assert.doesNotMatch(JSON.stringify(initial), /price_month|coupon|cus_owner|sub_original/)
  await pg.exec("UPDATE public.trial_enrollments SET cancel_at_period_end=true")
  const restore = await beginTrialManagementOperation(client, {
    ...start,
    kind: "restore",
    targetInterval: "month",
  })
  assert.equal((await read()).pendingOperation.operationId, OP)
  assert.equal((await read()).cancelAtPeriodEnd, true)
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OP,
      authenticatedUserId: USER,
      evidence: evidence(restore, {
        targetAgreementId: "sub_new",
        sourceAgreementNeutralized: true,
      }),
    }),
    true,
  )
  const restored = await read()
  assert.equal(restored.revision, 1)
  assert.equal(restored.cancelAtPeriodEnd, false)
  assert.equal(restored.pendingOperation, null)
  // A subsequent switch uses immutable root customer ownership and the selected replacement binding.
  const switched = await beginTrialManagementOperation(client, {
    ...start,
    operationId: OTHER,
    expectedRevision: 1,
  })
  assert.equal(switched.sourceAgreementId, "sub_new")
  assert.equal(switched.providerCustomerId, "cus_owner")
  assert.equal(
    await commitTrialManagementOperation(client, {
      operationId: OTHER,
      authenticatedUserId: USER,
      evidence: evidence(switched),
    }),
    true,
  )
  await pg.exec("UPDATE public.trial_enrollments SET access_revoked=true")
  assert.equal((await read()).canManage, false)
  const foreign = await pg.query<{ v: any }>(
    "SELECT public.load_trial_management_public_view($1,$2) AS v",
    [ENROLLMENT, OTHER],
  )
  assert.equal(foreign.rows[0]!.v, null)
})
