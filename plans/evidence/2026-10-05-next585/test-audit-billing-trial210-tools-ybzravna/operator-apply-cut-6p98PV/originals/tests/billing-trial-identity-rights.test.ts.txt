import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { runTrialIdentityRights } from "../scripts/billing/trial-identity-rights"
const ROOT = new URL("../", import.meta.url),
  ID = "11111111-1111-4111-8111-111111111111",
  ID2 = "22222222-2222-4222-8222-222222222222"
const claims = [
  { kind: "account", keyVersion: 1, namespace: "chaarlie", value: "a".repeat(64) },
  { kind: "stripe_card", keyVersion: 1, namespace: "acct_owner:live", value: "b".repeat(64) },
]
async function db(t: { after(fn: () => Promise<void>): void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA private; CREATE TABLE public.profiles(id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions(id uuid PRIMARY KEY,provider text,provider_subscription_id text); CREATE TABLE private.trial_offer_revisions(enrollment_id uuid,provider text,provider_agreement_id text); GRANT USAGE ON SCHEMA public,private TO service_role; GRANT SELECT ON public.billing_subscriptions,private.trial_offer_revisions TO service_role;",
  )
  for (const file of [
    "20260914044650_trial_admission_foundation.sql",
    "20260914142559_trial_prior_paid_claims.sql",
    "20260914144351_trial_identity_rights_lifecycle.sql",
    "20260914153229_trial_identity_key_registry_safe_updates.sql",
    "20260915190000_paypal_trial_frozen_end.sql",
  ])
    await pg.exec(await readFile(new URL(`supabase/migrations/${file}`, ROOT), "utf8"))
  const offer = createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_year",
  })
  for (const id of [ID, ID2])
    await pg.query(
      "INSERT INTO public.trial_enrollments(id,provider,accepted_offer) VALUES($1,'stripe',$2)",
      [id, JSON.stringify(offer)],
    )
  await pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[1])")
  return pg
}
async function paid(pg: PGlite, source = "sub_old", values = claims) {
  return (
    await pg.query<{ n: number }>(
      "SELECT public.record_prior_paid_trial_claims($1,'2020-01-01Z','stripe',$2) n",
      [JSON.stringify(values), source],
    )
  ).rows[0]!.n
}
async function admit(pg: PGlite, id = ID, values = claims) {
  return (
    await pg.query<{ s: string }>(
      "SELECT public.admit_trial_enrollment($1,$2,'2020-01-01Z',$3) s",
      [id, JSON.stringify(values), `sub_${id}`],
    )
  ).rows[0]!.s
}
async function action(
  pg: PGlite,
  action: string,
  kinds = ["account", "stripe_card"],
  source = "sub_old",
  type = "stripe",
) {
  return pg.query("SELECT public.apply_trial_identity_rights($1,$2,$3,$4,'case-rights-verified')", [
    type,
    source,
    action,
    kinds,
  ])
}
async function count(pg: PGlite, table = "public.trial_identity_claims") {
  return (await pg.query<{ n: number }>(`SELECT count(*)::int n FROM ${table}`)).rows[0]!.n
}
test("restriction stops matching and all-version recreation; release restores original used claims", async (t) => {
  const pg = await db(t)
  assert.equal(await paid(pg), 2)
  await action(pg, "restrict")
  assert.equal(await count(pg), 0)
  assert.equal(await paid(pg), 0)
  assert.equal(await paid(pg, "sub_unseen"), 0)
  assert.equal(await admit(pg), "active")
  assert.equal(await count(pg), 0)
  await assert.rejects(
    pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[2])"),
    /overlap/,
  )
  await pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[1,2])")
  await assert.rejects(paid(pg, "sub_stale_key_writer"), /registry mismatch/)
  const rotated = claims.flatMap((c) => [
    c,
    { ...c, keyVersion: 2, value: (c.kind === "account" ? "c" : "d").repeat(64) },
  ])
  assert.equal(await paid(pg, "sub_rotated", rotated), 0)
  await action(pg, "release")
  assert.equal(await count(pg), 2)
  assert.equal(
    await admit(pg, ID, rotated),
    "active",
    "restoration cannot invalidate the trial admitted during restriction",
  )
})
test("erasure removes hashes without personal denial tombstones; old source replay and rotated backfills cannot recreate them", async (t) => {
  const pg = await db(t)
  await paid(pg)
  await action(pg, "erase")
  assert.equal(await count(pg), 0)
  assert.equal(await count(pg, "private.trial_identity_source_claims"), 0)
  assert.equal(await count(pg, "private.trial_identity_restrictions"), 0)
  assert.equal(await paid(pg), 0)
  await pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[2])")
  const rotated = claims.map((c) => ({
    ...c,
    keyVersion: 2,
    value: (c.kind === "account" ? "c" : "d").repeat(64),
  }))
  assert.equal(await paid(pg, "sub_old", rotated), 0)
  assert.equal(await admit(pg, ID2, rotated), "active")
  assert.equal(await count(pg), 2, "a genuinely new enrollment can consume eligibility afresh")
  await assert.rejects(action(pg, "release"), /cannot be restored/)
})
test("enrollment erasure also suppresses its provider agreement and preserves canonical activation replay", async (t) => {
  const pg = await db(t)
  assert.equal(await admit(pg), "active")
  await action(pg, "erase", ["account", "stripe_card"], ID, "enrollment")
  assert.equal(await count(pg), 0)
  assert.equal(await admit(pg), "active")
  assert.equal(await count(pg), 0)
  assert.equal(await paid(pg, `sub_${ID}`), 0)
})
test("shared-card correction retains unrelated account history and prevents every known old source from recreating the card", async (t) => {
  const pg = await db(t)
  await paid(pg)
  await paid(pg, "sub_second")
  await action(pg, "correct", ["stripe_card"])
  assert.equal(await count(pg), 1)
  assert.equal(await paid(pg, "sub_second"), 0)
  const other = [{ ...claims[0]!, value: "f".repeat(64) }, claims[1]!]
  assert.equal(await admit(pg, ID2, other), "active")
})
test("service-only key/source controls reject raw/direct claim writes and unregistered key loss", async (t) => {
  const pg = await db(t)
  await pg.exec("SET ROLE service_role")
  await assert.rejects(
    pg.query(
      "INSERT INTO public.trial_identity_claims VALUES('account',1,'chaarlie',$1,NULL,'2020-01-01Z')",
      ["e".repeat(64)],
    ),
    /source write/,
  )
  await paid(pg)
  await assert.rejects(
    pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[2])"),
    /overlap/,
  )
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(action(pg, "erase"), /permission denied/)
  await assert.rejects(
    pg.query("SELECT * FROM private.trial_identity_sources"),
    /permission denied/,
  )
})
test("operator tooling defaults to inspection; apply is explicit and never needs raw personal identities", async () => {
  const calls: string[] = []
  const client = {
    rpc: async (name: string) => {
      calls.push(name)
      return { data: { source: { kind: "stripe", source_id: "sub_old" } }, error: null }
    },
  }
  const args = ["erase", "--source-kind=stripe", "--source-id=sub_old", "--reference=case-verified"]
  assert.equal((await runTrialIdentityRights(args, client)).mode, "dry-run")
  assert.deepEqual(calls, ["inspect_trial_identity_rights"])
  await runTrialIdentityRights([...args, "--apply"], client)
  assert.equal(calls.at(-1), "apply_trial_identity_rights")
  await runTrialIdentityRights(["keys", "--versions=1,2", "--apply"], client)
  assert.equal(calls.at(-1), "configure_trial_identity_key_versions")
})

test("released unused reservations purge private matching associations as well as public claims", async (t) => {
  const pg = await db(t)
  await pg.query("SELECT public.admit_trial_enrollment($1,$2)", [ID, JSON.stringify(claims)])
  assert.equal(await count(pg, "private.trial_identity_source_claims"), 2)
  await pg.query("SELECT public.release_trial_enrollment($1,'verified-provider-abandoned')", [ID])
  assert.equal(await count(pg), 0)
  assert.equal(await count(pg, "private.trial_identity_source_claims"), 0)
})

test("pending enrollment erasure also fences its later authorized agreement", async (t) => {
  const pg = await db(t)
  await pg.query("SELECT public.admit_trial_enrollment($1,$2)", [ID, JSON.stringify(claims)])
  await action(pg, "erase", ["account", "stripe_card"], ID, "enrollment")
  assert.equal(await admit(pg), "active")
  assert.equal(await count(pg), 0)
  assert.equal(await paid(pg, `sub_${ID}`), 0)
})
test("authorization consumes all reserved identity kinds even when final proof contains only card/account", async (t) => {
  const pg = await db(t),
    email = { kind: "verified_email", keyVersion: 1, namespace: "chaarlie", value: "e".repeat(64) }
  await pg.query("SELECT public.admit_trial_enrollment($1,$2)", [
    ID,
    JSON.stringify([...claims, email]),
  ])
  assert.equal(await admit(pg), "active")
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "SELECT count(*)::int n FROM public.trial_identity_claims WHERE consumed_at IS NOT NULL",
      )
    ).rows[0]!.n,
    3,
  )
})

test("erased enrollment also suppresses a selected provider revision first observed by the later backfill", async (t) => {
  const pg = await db(t)
  await admit(pg)
  await action(pg, "erase", ["account", "stripe_card"], ID, "enrollment")
  await pg.query(
    "INSERT INTO private.trial_offer_revisions VALUES($1,'stripe','sub_selected_later')",
    [ID],
  )
  assert.equal(await paid(pg, "sub_selected_later"), 0)
  assert.equal(await count(pg), 0)
})

test("key registry updates are scoped, idempotent and retain claimed versions", async (t) => {
  const pg = await db(t)
  await pg.exec("SET ROLE service_role")
  await pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[1,2])")
  await pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[1,2])")
  await pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[1])")
  assert.deepEqual(
    (await pg.query("SELECT version FROM private.trial_identity_key_versions ORDER BY version"))
      .rows,
    [{ version: 1 }],
  )
  await paid(pg)
  await assert.rejects(
    pg.query("SELECT public.configure_trial_identity_key_versions(ARRAY[2])"),
    /overlap/,
  )
  assert.deepEqual(
    (await pg.query("SELECT version FROM private.trial_identity_key_versions ORDER BY version"))
      .rows,
    [{ version: 1 }],
  )
  const source = await readFile(
    new URL(
      "supabase/migrations/20260914153229_trial_identity_key_registry_safe_updates.sql",
      ROOT,
    ),
    "utf8",
  )
  assert.match(
    source,
    /DELETE FROM private\.trial_identity_key_versions WHERE NOT\(version=ANY\(p_versions\)\)/,
  )
  assert.doesNotMatch(source, /DELETE FROM private\.trial_identity_key_versions\s*;/)
})

test("admission stores a verified provider trial end of at least seven and at most ten days", async (t) => {
  const pg = await db(t)
  const admitWithEnd = async (end: string, id = ID, values = claims) =>
    (
      await pg.query<{ s: string }>(
        "SELECT public.admit_trial_enrollment($1,$2,'2020-01-01Z',$3,$4::timestamptz) s",
        [id, JSON.stringify(values), `sub_${id}`, end],
      )
    ).rows[0]!.s
  const storedEnd = async (id: string) =>
    (
      await pg.query<{ e: number }>(
        "SELECT extract(epoch FROM original_trial_end_at)::bigint AS e FROM public.trial_enrollments WHERE id=$1",
        [id],
      )
    ).rows[0]!.e
  await assert.rejects(admitWithEnd("2020-01-07T23:59:59Z"), /Invalid verified trial end/)
  await assert.rejects(admitWithEnd("2020-01-11T00:00:01Z"), /Invalid verified trial end/)
  // Frozen PayPal end: the UTC midnight nine days after a midnight freeze.
  assert.equal(await admitWithEnd("2020-01-10T00:00:00Z"), "active")
  assert.equal(Number(await storedEnd(ID)), Date.parse("2020-01-10T00:00:00Z") / 1000)
  // Replays with the same end, or without one, stay idempotent; a different end is a foreign clock.
  assert.equal(await admitWithEnd("2020-01-10T00:00:00Z"), "active")
  assert.equal(await admit(pg), "active")
  assert.equal(await admitWithEnd("2020-01-09T00:00:00Z"), "invalid_state")
  assert.equal(Number(await storedEnd(ID)), Date.parse("2020-01-10T00:00:00Z") / 1000)
  // Without a provider end (Stripe) the exact seven-day end is stored.
  const other = [
    { kind: "account", keyVersion: 1, namespace: "chaarlie", value: "c".repeat(64) },
    { kind: "stripe_card", keyVersion: 1, namespace: "acct_owner:live", value: "d".repeat(64) },
  ]
  assert.equal(await admit(pg, ID2, other), "active")
  assert.equal(Number(await storedEnd(ID2)), Date.parse("2020-01-08T00:00:00Z") / 1000)
  // The table itself bounds the end (terms are immutable after authorization, so probe via insert).
  for (const end of ["2020-01-07T00:00:00Z", "2020-01-11T00:00:01Z"]) {
    await assert.rejects(
      pg.query(
        "INSERT INTO public.trial_enrollments(id,provider,accepted_offer,authorization_succeeded_at,original_trial_end_at) VALUES(gen_random_uuid(),'paypal',$1,'2020-01-01Z',$2::timestamptz)",
        [
          JSON.stringify(
            createTrialOfferSnapshot("month", {
              monthPriceId: "price_month",
              yearPriceId: "price_year",
              annualCouponId: "coupon_year",
            }),
          ),
          end,
        ],
      ),
      /trial_enrollments_trial_end_bounds/,
      end,
    )
  }
})
