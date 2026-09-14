import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  activateTrialAdmission,
  createTrialEnrollment,
  releaseTrialAdmission,
  reserveTrialAdmission,
} from "../src/lib/billing/trial-admission"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { createTrialIdentityClaims } from "../src/lib/billing/trial-identity-claims"

/**
 * SQL-level admission coverage. PGlite has one in-process connection, so these
 * assertions prove each transaction's all-or-none result, not a two-session race.
 */
const ROOT = new URL("../", import.meta.url)
const MIGRATION = "supabase/migrations/20260914044650_trial_admission_foundation.sql"
const DAY_SECONDS = 7 * 24 * 60 * 60
const AUTHORIZED_AT = "2020-01-01T10:00:00.000Z"
const MUTANT = process.env.TRIAL_ADMISSION_MUTANT
const DIGEST = (char: string) => char.repeat(64)
const IDS = {
  first: "11111111-1111-4111-8111-111111111111",
  second: "22222222-2222-4222-8222-222222222222",
  third: "33333333-3333-4333-8333-333333333333",
  profile: "44444444-4444-4444-8444-444444444444",
}

const OFFER = createTrialOfferSnapshot("month", {
  monthPriceId: "price_trial_month",
  yearPriceId: "price_trial_year",
  annualCouponId: "coupon_trial_year",
})

type Claim = { kind: string; keyVersion: number; namespace: string; value: string }

const account = (value = DIGEST("a")): Claim => ({
  kind: "account",
  keyVersion: 1,
  namespace: "auth-user-v1",
  value,
})
const email = (value = DIGEST("b")): Claim => ({
  kind: "verified_email",
  keyVersion: 1,
  namespace: "email-v1",
  value,
})
const card = (value = DIGEST("c")): Claim => ({
  kind: "stripe_card",
  keyVersion: 1,
  namespace: "stripe-card-v1",
  value,
})

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    CREATE TABLE public.billing_subscriptions (
      id uuid PRIMARY KEY
    );
    GRANT USAGE ON SCHEMA public TO service_role;
  `)
  let migration = await readFile(new URL(MIGRATION, ROOT), "utf8")
  // A local harness-only mutant used to establish semantic red. It is never used
  // in ordinary verification and does not alter the tracked migration.
  if (MUTANT === "skip-consumption") {
    migration = migration.replace(
      "WHERE enrollment_id = p_enrollment_id AND consumed_at IS NULL;\n  UPDATE public.trial_enrollments SET admission_status = 'active'",
      "WHERE false;\n  UPDATE public.trial_enrollments SET admission_status = 'active'",
    )
  }
  await pg.exec(migration)
  return pg
}

async function enrollment(pg: PGlite, id: string, userId: string | null = null) {
  if (userId)
    await pg.query("INSERT INTO public.profiles (id) VALUES ($1) ON CONFLICT DO NOTHING", [userId])
  await pg.query(
    `INSERT INTO public.trial_enrollments (id, user_id, accepted_offer, provider)
       VALUES ($1, $2::uuid, $3::jsonb, 'stripe')`,
    [id, userId, JSON.stringify(OFFER)],
  )
}

async function admit(
  pg: PGlite,
  enrollmentId: string,
  claims: Claim[],
  authorizedAt: string | null = null,
  agreementId: string | null = null,
) {
  const result = await pg.query<{ result: string }>(
    "SELECT public.admit_trial_enrollment($1::uuid, $2::jsonb, $3::timestamptz, $4::text) AS result",
    [enrollmentId, JSON.stringify(claims), authorizedAt, agreementId],
  )
  return result.rows[0]!.result
}

async function release(pg: PGlite, enrollmentId: string, evidence: string) {
  const result = await pg.query<{ result: boolean }>(
    "SELECT public.release_trial_enrollment($1::uuid, $2::text) AS result",
    [enrollmentId, evidence],
  )
  return result.rows[0]!.result
}

test("a confirmed abandoned attempt releases claims and replays the same evidence idempotently", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  assert.equal(await admit(pg, IDS.first, [account()]), "reserved")
  assert.equal(await release(pg, IDS.first, "stripe:expired:cs_abandoned"), true)
  assert.equal(await release(pg, IDS.first, "stripe:expired:cs_abandoned"), true)
  assert.equal(await release(pg, IDS.first, "different-evidence"), false)
  assert.equal(await claimCount(pg, IDS.first), 0)
})

async function claimCount(pg: PGlite, enrollmentId: string) {
  const result = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM public.trial_identity_claims WHERE enrollment_id = $1::uuid",
    [enrollmentId],
  )
  return result.rows[0]!.count
}

/** The adapter's complete, deliberately narrow Supabase surface, backed by real SQL. */
function pgliteAdmissionClient(pg: PGlite) {
  return {
    from(table: string) {
      assert.equal(table, "trial_enrollments")
      return {
        async upsert(
          row: {
            id: string
            user_id: string | null
            provider: string
            cohort: string
            accepted_offer: unknown
          },
          options: { onConflict: string; ignoreDuplicates: boolean },
        ) {
          assert.deepEqual(options, { onConflict: "id", ignoreDuplicates: true })
          await pg.query(
            `INSERT INTO public.trial_enrollments (id, user_id, provider, cohort, accepted_offer)
             VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::jsonb)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.user_id, row.provider, row.cohort, JSON.stringify(row.accepted_offer)],
          )
          return { error: null }
        },
        select(columns: string) {
          assert.equal(columns, "id,user_id,provider,accepted_offer")
          return {
            eq(column: string, value: string) {
              assert.equal(column, "id")
              return {
                async single() {
                  const found = await pg.query<{
                    id: string
                    user_id: string | null
                    provider: string
                    accepted_offer: unknown
                  }>(
                    `SELECT id::text, user_id::text, provider, accepted_offer
                       FROM public.trial_enrollments WHERE id = $1::uuid`,
                    [value],
                  )
                  return found.rows.length === 1
                    ? { data: found.rows[0], error: null }
                    : { data: null, error: { message: "not found" } }
                },
              }
            },
          }
        },
      }
    },
    async rpc(name: string, parameters: Record<string, unknown>) {
      if (name === "admit_trial_enrollment") {
        const result = await pg.query<{ result: string }>(
          `SELECT public.admit_trial_enrollment(
             $1::uuid, $2::jsonb, $3::timestamptz, $4::text
           ) AS result`,
          [
            parameters.p_enrollment_id,
            JSON.stringify(parameters.p_claims),
            parameters.p_authorized_at,
            parameters.p_provider_agreement_id,
          ],
        )
        return { data: result.rows[0]!.result, error: null }
      }
      if (name === "release_trial_enrollment") {
        const result = await pg.query<{ result: boolean }>(
          "SELECT public.release_trial_enrollment($1::uuid, $2::text) AS result",
          [parameters.p_enrollment_id, parameters.p_neutralization_evidence],
        )
        return { data: result.rows[0]!.result, error: null }
      }
      throw new Error(`unexpected RPC: ${name}`)
    },
  }
}

test("trial admission adapter creates one immutable enrollment attempt through its real SQL shape", async (t) => {
  const pg = await database(t)
  const client = pgliteAdmissionClient(pg) as never
  await pg.query("INSERT INTO public.profiles (id) VALUES ($1::uuid)", [IDS.profile])
  const input = { id: IDS.first, userId: IDS.profile, provider: "stripe" as const, offer: OFFER }
  assert.equal(await createTrialEnrollment(client, input), IDS.first)
  assert.equal(await createTrialEnrollment(client, input), IDS.first)

  for (const changed of [
    {
      ...input,
      offer: createTrialOfferSnapshot("year", {
        monthPriceId: "price_trial_month",
        yearPriceId: "price_trial_year",
        annualCouponId: "coupon_trial_year",
      }),
    },
    { ...input, userId: IDS.second },
    { ...input, provider: "paypal" as const },
  ]) {
    await assert.rejects(
      () => createTrialEnrollment(client, changed),
      /does not match accepted terms/,
    )
  }
  const persisted = await pg.query<{
    user_id: string | null
    provider: string
    accepted_offer: unknown
  }>(
    "SELECT user_id::text, provider, accepted_offer FROM public.trial_enrollments WHERE id = $1::uuid",
    [IDS.first],
  )
  assert.deepEqual(persisted.rows[0], {
    user_id: IDS.profile,
    provider: "stripe",
    accepted_offer: OFFER,
  })
})

test("trial admission adapter composes reserve, activation, replay, and active-release refusal", async (t) => {
  const pg = await database(t)
  const client = pgliteAdmissionClient(pg) as never
  await createTrialEnrollment(client, {
    id: IDS.first,
    userId: null,
    provider: "stripe",
    offer: OFFER,
  })
  const claims = [account(), email()]
  assert.equal(await reserveTrialAdmission(client, IDS.first, claims), "reserved")
  assert.equal(
    await activateTrialAdmission(client, {
      enrollmentId: IDS.first,
      claims,
      authorizationSucceededAt: new Date(AUTHORIZED_AT),
      providerAgreementId: "adapter-agreement",
    }),
    "active",
  )
  assert.equal(
    await activateTrialAdmission(client, {
      enrollmentId: IDS.first,
      claims,
      authorizationSucceededAt: new Date(AUTHORIZED_AT),
      providerAgreementId: "adapter-agreement",
    }),
    "active",
  )
  assert.equal(
    await releaseTrialAdmission(client, IDS.first, "active subscriptions cannot release"),
    false,
  )
})

test("trial admission adapter fails closed before provider calls and on unknown RPC output", async () => {
  let calls = 0
  const forbiddenClient = {
    from() {
      calls += 1
      throw new Error("unexpected persistence call")
    },
    rpc() {
      calls += 1
      throw new Error("unexpected RPC call")
    },
  } as never
  await assert.rejects(
    () =>
      createTrialEnrollment(forbiddenClient, {
        id: "not-a-uuid",
        userId: null,
        provider: "stripe",
        offer: OFFER,
      }),
    /Invalid trial enrollment/,
  )
  await assert.rejects(
    () =>
      createTrialEnrollment(forbiddenClient, {
        id: IDS.first,
        userId: null,
        provider: "bogus" as "stripe",
        offer: OFFER,
      }),
    /Invalid trial enrollment/,
  )
  await assert.rejects(
    () =>
      activateTrialAdmission(forbiddenClient, {
        enrollmentId: IDS.first,
        claims: [account()],
        authorizationSucceededAt: new Date("invalid"),
        providerAgreementId: "agreement",
      }),
    /Invalid verified trial authorization/,
  )
  assert.equal(calls, 0)

  const unknownResult = { rpc: async () => ({ data: "unexpected", error: null }) } as never
  await assert.rejects(
    () => reserveTrialAdmission(unknownResult, IDS.first, [account()]),
    /reconciliation required/,
  )
})

test("trial enrollment adapter rejects a successful upsert whose readback has different accepted terms", async () => {
  const existing = { id: IDS.first, user_id: null, provider: "stripe", accepted_offer: OFFER }
  const mismatchedReadback = {
    from(table: string) {
      assert.equal(table, "trial_enrollments")
      return {
        async upsert() {
          return { error: null }
        },
        select(columns: string) {
          assert.equal(columns, "id,user_id,provider,accepted_offer")
          return { eq: () => ({ single: async () => ({ data: existing, error: null }) }) }
        },
      }
    },
  } as never
  await assert.rejects(
    () =>
      createTrialEnrollment(mismatchedReadback, {
        id: IDS.first,
        userId: null,
        provider: "stripe",
        offer: createTrialOfferSnapshot("year", {
          monthPriceId: "price_trial_month",
          yearPriceId: "price_trial_year",
          annualCouponId: "coupon_trial_year",
        }),
      }),
    /does not match accepted terms/,
  )
})

test("trial admission reserves, activates atomically, and replays only the exact provider receipt", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first, IDS.profile)
  const claims = [account(), email()]

  assert.equal(await admit(pg, IDS.first, claims), "reserved")
  assert.equal(await claimCount(pg, IDS.first), 2)
  assert.equal(await admit(pg, IDS.first, claims), "reserved")

  const authorizedAt = AUTHORIZED_AT
  assert.equal(await admit(pg, IDS.first, claims, authorizedAt, "sub_agreement_1"), "active")
  const stored = await pg.query<{
    admission_status: string
    authorization_succeeded_at: string
    original_trial_end_at: string
    provider_agreement_id: string
  }>(
    `SELECT admission_status, authorization_succeeded_at::text, original_trial_end_at::text, provider_agreement_id
       FROM public.trial_enrollments WHERE id = $1::uuid`,
    [IDS.first],
  )
  assert.equal(stored.rows[0]!.admission_status, "active")
  assert.equal(stored.rows[0]!.provider_agreement_id, "sub_agreement_1")
  assert.equal(
    new Date(stored.rows[0]!.original_trial_end_at).getTime() -
      new Date(stored.rows[0]!.authorization_succeeded_at).getTime(),
    DAY_SECONDS * 1000,
  )
  assert.equal(await admit(pg, IDS.first, claims, authorizedAt, "sub_agreement_1"), "active")
  assert.equal(
    await admit(pg, IDS.first, claims, "2020-01-01T10:00:01.000Z", "sub_agreement_1"),
    "invalid_state",
  )
  assert.equal(
    await admit(pg, IDS.first, [...claims, card()], authorizedAt, "sub_agreement_1"),
    "invalid_state",
  )
  assert.equal(await claimCount(pg, IDS.first), 2)
})

test("trial admission rejects malformed claims and invalid authorization before any write", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  for (const claims of [
    [],
    [{ ...account(), kind: "unknown" }],
    [{ ...account(), keyVersion: 0 }],
    [{ ...account(), namespace: "" }],
    [{ ...account(), value: "not-a-digest" }],
  ]) {
    await assert.rejects(() => admit(pg, IDS.first, claims), { code: "22023" })
    assert.equal(await claimCount(pg, IDS.first), 0)
  }
  await assert.rejects(() => admit(pg, IDS.first, [account()], "infinity", "agreement"), {
    code: "22023",
  })
  await assert.rejects(
    () => admit(pg, IDS.first, [account()], "2999-01-01T00:00:00Z", "agreement"),
    { code: "22023" },
  )
  assert.equal(await claimCount(pg, IDS.first), 0)
})

test("a claimed identity blocks the loser without partially writing its other identities", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  await enrollment(pg, IDS.second)
  await enrollment(pg, IDS.third)
  assert.equal(await admit(pg, IDS.first, [account(), email()]), "reserved")
  assert.equal(await admit(pg, IDS.third, [account(), card()]), "claim_reserved")
  assert.equal(await claimCount(pg, IDS.third), 0)
  const state = await pg.query<{ admission_status: string }>(
    "SELECT admission_status FROM public.trial_enrollments WHERE id = $1::uuid",
    [IDS.third],
  )
  assert.equal(state.rows[0]!.admission_status, "blocked")
  assert.equal(
    await admit(pg, IDS.third, [account(), card()], AUTHORIZED_AT, "agreement-c"),
    "claim_reserved",
  )
  const lateBlocked = await pg.query<{
    neutralization_required: boolean
    provider_agreement_id: string
  }>(
    "SELECT neutralization_required, provider_agreement_id FROM public.trial_enrollments WHERE id = $1::uuid",
    [IDS.third],
  )
  assert.deepEqual(lateBlocked.rows[0], {
    neutralization_required: true,
    provider_agreement_id: "agreement-c",
  })
  assert.equal(await claimCount(pg, IDS.third), 0)

  assert.equal(
    await admit(pg, IDS.first, [account(), email(), card()], AUTHORIZED_AT, "agreement-a"),
    "active",
  )
  assert.equal(await admit(pg, IDS.second, [account(DIGEST("e"))]), "reserved")
  assert.equal(
    await admit(pg, IDS.second, [account(DIGEST("e")), card()], AUTHORIZED_AT, "agreement-b"),
    "trial_used",
  )
  const loser = await pg.query<{ neutralization_required: boolean; provider_agreement_id: string }>(
    "SELECT neutralization_required, provider_agreement_id FROM public.trial_enrollments WHERE id = $1::uuid",
    [IDS.second],
  )
  assert.deepEqual(loser.rows[0], {
    neutralization_required: true,
    provider_agreement_id: "agreement-b",
  })
  assert.equal(await claimCount(pg, IDS.second), 1)
  const retainedReservation = await pg.query<{ consumed_at: string | null }>(
    "SELECT consumed_at::text FROM public.trial_identity_claims WHERE enrollment_id = $1::uuid",
    [IDS.second],
  )
  assert.equal(retainedReservation.rows[0]!.consumed_at, null)
})

test("an abandoned reservation can be released only with evidence, then its identities can be retried", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  await enrollment(pg, IDS.second)
  assert.equal(await admit(pg, IDS.first, [account()]), "reserved")
  await assert.rejects(() =>
    pg.query("DELETE FROM public.trial_enrollments WHERE id = $1::uuid", [IDS.first]),
  )
  await assert.rejects(() => release(pg, IDS.first, ""), { code: "22023" })
  assert.equal(await claimCount(pg, IDS.first), 1)
  assert.equal(await release(pg, IDS.first, "provider setup abandoned"), true)
  assert.equal(await claimCount(pg, IDS.first), 0)
  assert.equal(
    await admit(pg, IDS.first, [account()], AUTHORIZED_AT, "late-agreement"),
    "invalid_state",
  )
  const releasedLateCallback = await pg.query<{
    admission_status: string
    neutralization_required: boolean
    provider_agreement_id: string
  }>(
    `SELECT admission_status, neutralization_required, provider_agreement_id
       FROM public.trial_enrollments WHERE id = $1::uuid`,
    [IDS.first],
  )
  assert.deepEqual(releasedLateCallback.rows[0], {
    admission_status: "released",
    neutralization_required: true,
    provider_agreement_id: "late-agreement",
  })
  assert.equal(await release(pg, IDS.first, "late callback neutralized"), true)
  assert.equal(await admit(pg, IDS.second, [account()]), "reserved")
  assert.equal(await admit(pg, IDS.second, [account()], AUTHORIZED_AT, "agreement"), "active")
  assert.equal(await release(pg, IDS.second, "cannot release active"), false)
})

test("identity namespace and key version separate claims, while consumed claims survive nullable FK deletion", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first, IDS.profile)
  await enrollment(pg, IDS.second)
  await enrollment(pg, IDS.third)
  assert.equal(
    await admit(pg, IDS.first, [account(DIGEST("d"))], AUTHORIZED_AT, "agreement"),
    "active",
  )
  await pg.query("DELETE FROM public.profiles WHERE id = $1::uuid", [IDS.profile])
  await pg.query("DELETE FROM public.trial_enrollments WHERE id = $1::uuid", [IDS.first])
  const consumed = await pg.query<{ enrollment_id: string | null; consumed_at: string | null }>(
    "SELECT enrollment_id::text, consumed_at::text FROM public.trial_identity_claims WHERE claim_digest = $1",
    [DIGEST("d")],
  )
  assert.equal(consumed.rows[0]!.enrollment_id, null)
  assert.notEqual(consumed.rows[0]!.consumed_at, null)
  assert.equal(await admit(pg, IDS.second, [account(DIGEST("d"))]), "trial_used")
  assert.equal(
    await admit(pg, IDS.third, [
      { ...account(DIGEST("d")), keyVersion: 2, namespace: "auth-user-v2" },
    ]),
    "reserved",
  )
})

test("accepted terms and original trial timestamps are immutable, and legacy subscriptions remain unlinked", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  assert.equal(await admit(pg, IDS.first, [account()], AUTHORIZED_AT, "agreement"), "active")
  await assert.rejects(() =>
    pg.query(
      "UPDATE public.trial_enrollments SET accepted_offer = '{}'::jsonb WHERE id = $1::uuid",
      [IDS.first],
    ),
  )
  await assert.rejects(() =>
    pg.query(
      "UPDATE public.trial_enrollments SET original_trial_end_at = now() WHERE id = $1::uuid",
      [IDS.first],
    ),
  )
  await pg.query("INSERT INTO public.billing_subscriptions (id) VALUES ($1::uuid)", [IDS.second])
  const legacy = await pg.query<{ trial_enrollment_id: string | null }>(
    "SELECT trial_enrollment_id::text FROM public.billing_subscriptions WHERE id = $1::uuid",
    [IDS.second],
  )
  assert.equal(legacy.rows[0]!.trial_enrollment_id, null)
  await pg.query(
    "UPDATE public.billing_subscriptions SET trial_enrollment_id = $1::uuid WHERE id = $2::uuid",
    [IDS.first, IDS.second],
  )
  await assert.rejects(() =>
    pg.query("DELETE FROM public.trial_enrollments WHERE id = $1::uuid", [IDS.first]),
  )
  await assert.rejects(() =>
    pg.query(
      "UPDATE public.billing_subscriptions SET trial_enrollment_id = NULL WHERE id = $1::uuid",
      [IDS.second],
    ),
  )
})

test("retained HMAC keys block a second trial after key rotation without writing new claims", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  await enrollment(pg, IDS.second)
  const identities = [
    {
      kind: "stripe_card" as const,
      namespace: "stripe:live:synthetic",
      normalizedIdentity: "synthetic-fingerprint",
    },
  ]
  const oldKey = { version: 1, secret: new Uint8Array(32).fill(1) }
  const newKey = { version: 2, secret: new Uint8Array(32).fill(2) }
  const oldClaims = createTrialIdentityClaims(identities, [oldKey])
  const rotatedClaims = createTrialIdentityClaims(identities, [newKey, oldKey])
  assert.equal(
    await admit(pg, IDS.first, [...oldClaims], AUTHORIZED_AT, "original-agreement"),
    "active",
  )
  assert.equal(await admit(pg, IDS.second, [...rotatedClaims]), "trial_used")
  assert.equal(await claimCount(pg, IDS.second), 0)
})

test("admission tables stay private and only service_role can execute the RPC", async (t) => {
  const pg = await database(t)
  await enrollment(pg, IDS.first)
  const privileges = await pg.query<{ service: boolean; anon: boolean; authenticated: boolean }>(
    `SELECT has_function_privilege('service_role',
       'public.admit_trial_enrollment(uuid,jsonb,timestamp with time zone,text)', 'EXECUTE') AS service,
       has_function_privilege('anon',
       'public.admit_trial_enrollment(uuid,jsonb,timestamp with time zone,text)', 'EXECUTE') AS anon,
       has_function_privilege('authenticated',
       'public.admit_trial_enrollment(uuid,jsonb,timestamp with time zone,text)', 'EXECUTE') AS authenticated`,
  )
  assert.deepEqual(privileges.rows[0], { service: true, anon: false, authenticated: false })
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(() => admit(pg, IDS.first, [account()]), /permission denied for function/)
    await assert.rejects(
      () => pg.query("SELECT * FROM public.trial_enrollments"),
      /permission denied for table/,
    )
    await assert.rejects(
      () => pg.query("SELECT * FROM public.trial_identity_claims"),
      /permission denied for table/,
    )
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  assert.equal(await admit(pg, IDS.first, [account()]), "reserved")
  await pg.exec("RESET ROLE")
})
