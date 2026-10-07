import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { recordPriorPaidMembershipHistory } from "../src/lib/billing/trial-prior-paid-history"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
const ROOT = new URL("../", import.meta.url)
const ID = "11111111-1111-4111-8111-111111111111"
const claims = [{ kind: "account", keyVersion: 1, namespace: "chaarlie", value: "a".repeat(64) }]
async function db(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE public.profiles(id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA public TO service_role;",
  )
  for (const file of [
    "20260914044650_trial_admission_foundation.sql",
    "20260914142559_trial_prior_paid_claims.sql",
  ])
    await pg.exec(await readFile(new URL(`supabase/migrations/${file}`, ROOT), "utf8"))
  const offer = createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_year",
  })
  await pg.query(
    "INSERT INTO public.trial_enrollments(id,provider,accepted_offer) VALUES($1,'stripe',$2)",
    [ID, JSON.stringify(offer)],
  )
  return pg
}
async function record(pg: PGlite, date = "2019-01-01Z") {
  return (
    await pg.query<{ n: number }>("SELECT public.record_prior_paid_trial_claims($1,$2) n", [
      JSON.stringify(claims),
      date,
    ])
  ).rows[0]!.n
}
async function admit(pg: PGlite, activate = false) {
  return (
    await pg.query<{ status: string }>("SELECT public.admit_trial_enrollment($1,$2,$3,$4) status", [
      ID,
      JSON.stringify(claims),
      activate ? "2020-01-01Z" : null,
      activate ? "sub_authorized" : null,
    ])
  ).rows[0]!.status
}
async function rows(pg: PGlite) {
  return (
    await pg.query<{ enrollment_id: string | null; consumed_at: Date }>(
      "SELECT enrollment_id,consumed_at FROM public.trial_identity_claims",
    )
  ).rows
}
test("historical NULL-enrollment claims block a new trial and replay keeps earliest use", async (t) => {
  const pg = await db(t)
  await pg.exec("SET ROLE service_role")
  assert.equal(await record(pg), 1)
  assert.equal(await record(pg, "2021-01-01Z"), 1)
  assert.equal((await rows(pg))[0]!.enrollment_id, null)
  assert.equal(new Date((await rows(pg))[0]!.consumed_at).getUTCFullYear(), 2019)
  assert.equal(await admit(pg), "trial_used")
  assert.equal((await rows(pg)).length, 1)
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(record(pg), /permission denied/)
})
test("prior payment winning before authorization consumes a reservation and denial retains neutralization", async (t) => {
  const pg = await db(t)
  assert.equal(await admit(pg), "reserved")
  await record(pg)
  assert.equal((await rows(pg))[0]!.enrollment_id, null)
  assert.equal(await admit(pg, true), "trial_used")
  assert.deepEqual(
    (
      await pg.query(
        "SELECT admission_status,neutralization_required,provider_agreement_id FROM public.trial_enrollments",
      )
    ).rows[0],
    {
      admission_status: "blocked",
      neutralization_required: true,
      provider_agreement_id: "sub_authorized",
    },
  )
})
test("authorization winning first preserves consumed enrollment ownership and replay", async (t) => {
  const pg = await db(t)
  assert.equal(await admit(pg, true), "active")
  await record(pg)
  assert.equal((await rows(pg))[0]!.enrollment_id, ID)
  assert.equal(await admit(pg, true), "active")
  await assert.rejects(
    pg.query("SELECT public.record_prior_paid_trial_claims($1,'2020-01-01Z')", [
      JSON.stringify([{ ...claims[0], rawEmail: "private@example.com" }]),
    ]),
    /Invalid paid history/,
  )
})
test("history helper writes only normalized versioned HMAC claims, never raw identity or provider proof", async () => {
  let payload: Record<string, unknown> | undefined
  const runtime = {
    identityKeys: [
      { version: 1, secret: Buffer.alloc(32, 7) },
      { version: 2, secret: Buffer.alloc(32, 8) },
    ],
  } as unknown as TrialRuntime
  await recordPriorPaidMembershipHistory(
    {
      rpc: async (name, args) => {
        assert.equal(name, "record_prior_paid_trial_claims")
        payload = args
        return { data: 6, error: null }
      },
    },
    {
      runtime,
      source: { provider: "stripe", agreementId: "sub_history" },
      userId: ID,
      verifiedEmail: " Verified@Example.com ",
      amountMinor: 999,
      paidAt: new Date("2020-01-01Z"),
      paymentIdentity: {
        kind: "stripe_card",
        namespace: "acct_owner:live",
        value: "fingerprint-private",
      },
    },
  )
  assert.equal((payload!.p_claims as unknown[]).length, 6)
  for (const secret of [ID, "Verified@Example.com", "verified@example.com", "fingerprint-private"])
    assert.equal(JSON.stringify(payload).includes(secret), false)
  await assert.rejects(
    recordPriorPaidMembershipHistory(
      {
        rpc: async () => {
          throw new Error("must not write")
        },
      },
      {
        runtime,
        source: { provider: "stripe", agreementId: "sub_history" },
        userId: ID,
        amountMinor: 0,
        paidAt: new Date("2020-01-01Z"),
      },
    ),
    /Invalid verified/,
  )
})
