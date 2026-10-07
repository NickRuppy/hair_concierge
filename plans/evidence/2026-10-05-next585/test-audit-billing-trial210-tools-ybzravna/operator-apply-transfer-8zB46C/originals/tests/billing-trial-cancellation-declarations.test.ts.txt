import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  submitTrialCancellationDeclaration,
  type TrialCancellationDeclarationClient,
} from "../src/lib/billing/trial-cancellation-declarations"
import { resolveTrialAccess } from "../src/lib/billing/trial-policy"

const ROOT = new URL("../", import.meta.url)
const MIGRATIONS = [
  "supabase/migrations/20260914044650_trial_admission_foundation.sql",
  "supabase/migrations/20260914090614_trial_cancellation_declarations.sql",
] as const
const MUTANT = process.env.TRIAL_CANCELLATION_MUTANT
const USER = "11111111-1111-4111-8111-111111111111"
const OTHER_USER = "22222222-2222-4222-8222-222222222222"
const ENROLLMENT = "33333333-3333-4333-8333-333333333333"
const OTHER_ENROLLMENT = "44444444-4444-4444-8444-444444444444"
const REQUEST = "55555555-5555-4555-8555-555555555555"
const OTHER_REQUEST = "66666666-6666-4666-8666-666666666666"
const TRIAL_END = "2099-01-08T00:00:00.000Z"

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    CREATE TABLE public.billing_subscriptions (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT ALL ON public.profiles, public.billing_subscriptions TO service_role;
  `)
  for (const file of MIGRATIONS) {
    let sql = await readFile(new URL(file, ROOT), "utf8")
    // Harness-only mutation proof: declarations must immediately block further
    // merchant-initiated collection, while retaining trial access to its deadline.
    if (MUTANT === "skip-cancel-flag" && file.endsWith("trial_cancellation_declarations.sql")) {
      sql = sql.replace(
        "UPDATE public.trial_enrollments SET cancel_at_period_end = true\n    WHERE id = enrollment.id;",
        "UPDATE public.trial_enrollments SET cancel_at_period_end = false\n    WHERE id = enrollment.id;",
      )
    }
    await pg.exec(sql)
  }
  await pg.exec("GRANT USAGE ON SCHEMA private TO service_role")
  return pg
}

async function seedEnrollment(
  pg: PGlite,
  input: { id?: string; userId?: string; paid?: boolean; revoked?: boolean } = {},
) {
  const id = input.id ?? ENROLLMENT
  const userId = input.userId ?? USER
  await pg.query("INSERT INTO public.profiles (id) VALUES ($1::uuid) ON CONFLICT DO NOTHING", [
    userId,
  ])
  await pg.query(
    `INSERT INTO public.trial_enrollments (
      id, user_id, accepted_offer, provider, provider_agreement_id, admission_status,
      authorization_succeeded_at, original_trial_end_at, first_payment_succeeded_at,
      paid_through_at, access_revoked
    ) VALUES (
      $1::uuid, $2::uuid, '{}'::jsonb, 'stripe', $3, 'active',
      '2099-01-01T00:00:00Z', $4::timestamptz, $5::timestamptz,
      $6::timestamptz, $7::boolean
    )`,
    [
      id,
      userId,
      `agreement-${id.slice(0, 8)}`,
      TRIAL_END,
      input.paid ? "2099-01-02T00:00:00Z" : null,
      input.paid ? "2099-02-02T00:00:00Z" : null,
      input.revoked ?? false,
    ],
  )
  return id
}

function client(pg: PGlite): TrialCancellationDeclarationClient {
  return {
    async rpc(name, args) {
      assert.equal(name, "submit_trial_cancellation_declaration")
      try {
        const result = await pg.query<{
          declaration_id: string
          submitted_at: string | Date
          effective_end_at: string | Date
        }>(
          `SELECT * FROM public.submit_trial_cancellation_declaration(
            $1::uuid, $2::uuid, $3::uuid
          )`,
          [args.p_request_id, args.p_authenticated_user_id, args.p_enrollment_id],
        )
        return {
          data: result.rows.map((row) => ({
            ...row,
            submitted_at:
              row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
            effective_end_at:
              row.effective_end_at instanceof Date
                ? row.effective_end_at.toISOString()
                : row.effective_end_at,
          })),
          error: null,
        }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
}

async function declarationCount(pg: PGlite) {
  const result = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM private.trial_cancellation_declarations",
  )
  return result.rows[0]!.count
}

test("accepts an initial owner declaration before provider work and preserves trial access through the immutable deadline", async (t) => {
  const pg = await database(t)
  await seedEnrollment(pg)
  const result = await submitTrialCancellationDeclaration(
    { requestId: REQUEST, authenticatedUserId: USER, enrollmentId: ENROLLMENT },
    client(pg),
  )
  assert.equal(result.effectiveEndAt, TRIAL_END)
  assert.match(result.submittedAt, /^\d{4}-\d{2}-\d{2}T/)

  const persisted = await pg.query<{
    cancel_at_period_end: boolean
    access_revoked: boolean
    first_payment_succeeded_at: string | null
    receipt_status: string
    provider_status: string
  }>(
    `SELECT e.cancel_at_period_end, e.access_revoked, e.first_payment_succeeded_at,
      r.delivery_status AS receipt_status, o.status AS provider_status
     FROM public.trial_enrollments e
     JOIN private.trial_cancellation_declarations d ON d.enrollment_id = e.id
     JOIN private.trial_cancellation_receipts r ON r.declaration_id = d.id
     JOIN private.trial_cancellation_provider_operations o ON o.declaration_id = d.id
     WHERE e.id = $1::uuid`,
    [ENROLLMENT],
  )
  assert.deepEqual(persisted.rows[0], {
    cancel_at_period_end: true,
    access_revoked: false,
    first_payment_succeeded_at: null,
    receipt_status: "pending",
    provider_status: "pending",
  })
  assert.equal(
    resolveTrialAccess(
      {
        authorizationSucceededAt: "2099-01-01T00:00:00.000Z",
        originalTrialEndAt: TRIAL_END,
        firstPaymentSucceededAt: null,
        paidThroughAt: null,
        renewalGraceEndsAt: null,
        renewalPaymentFailed: false,
        cancelAtPeriodEnd: persisted.rows[0]!.cancel_at_period_end,
        accessRevoked: persisted.rows[0]!.access_revoked,
      },
      new Date("2099-01-07T23:59:59Z"),
    ).hasAccess,
    true,
  )
})

test("returns the original declaration facts on same-owner retry and rejects altered request ownership", async (t) => {
  const pg = await database(t)
  await seedEnrollment(pg)
  await seedEnrollment(pg, { id: OTHER_ENROLLMENT, userId: USER })
  const first = await submitTrialCancellationDeclaration(
    { requestId: REQUEST, authenticatedUserId: USER, enrollmentId: ENROLLMENT },
    client(pg),
  )
  const repeated = await submitTrialCancellationDeclaration(
    { requestId: REQUEST, authenticatedUserId: USER, enrollmentId: ENROLLMENT },
    client(pg),
  )
  assert.deepEqual(repeated, first)
  assert.equal(await declarationCount(pg), 1)
  await pg.query(
    `UPDATE public.trial_enrollments
       SET first_payment_succeeded_at = '2099-01-02T00:00:00Z',
           paid_through_at = '2099-02-02T00:00:00Z',
           access_revoked = true
     WHERE id = $1::uuid`,
    [ENROLLMENT],
  )
  const replayAfterLifecycleChange = await submitTrialCancellationDeclaration(
    { requestId: REQUEST, authenticatedUserId: USER, enrollmentId: ENROLLMENT },
    client(pg),
  )
  assert.deepEqual(replayAfterLifecycleChange, first)
  assert.equal(await declarationCount(pg), 1)
  await assert.rejects(
    () =>
      submitTrialCancellationDeclaration(
        { requestId: REQUEST, authenticatedUserId: USER, enrollmentId: OTHER_ENROLLMENT },
        client(pg),
      ),
    /could not be accepted/,
  )
  await assert.rejects(
    () =>
      submitTrialCancellationDeclaration(
        { requestId: OTHER_REQUEST, authenticatedUserId: OTHER_USER, enrollmentId: ENROLLMENT },
        client(pg),
      ),
    /could not be accepted/,
  )
})

test("rejects paid, revoked, and malformed cancellation declarations without persisting receipt work", async (t) => {
  const pg = await database(t)
  await seedEnrollment(pg, { id: ENROLLMENT, paid: true })
  await seedEnrollment(pg, { id: OTHER_ENROLLMENT, revoked: true })
  await assert.rejects(
    () =>
      submitTrialCancellationDeclaration(
        { requestId: REQUEST, authenticatedUserId: USER, enrollmentId: ENROLLMENT },
        client(pg),
      ),
    /could not be accepted/,
  )
  await assert.rejects(
    () =>
      submitTrialCancellationDeclaration(
        { requestId: OTHER_REQUEST, authenticatedUserId: USER, enrollmentId: OTHER_ENROLLMENT },
        client(pg),
      ),
    /could not be accepted/,
  )
  await assert.rejects(
    () =>
      submitTrialCancellationDeclaration(
        { requestId: "not-a-uuid", authenticatedUserId: USER, enrollmentId: ENROLLMENT },
        client(pg),
      ),
    /Invalid trial cancellation declaration/,
  )
  assert.equal(await declarationCount(pg), 0)
})

test("keeps cancellation declaration RPC execution service-role-only", async (t) => {
  const pg = await database(t)
  await seedEnrollment(pg)
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    () =>
      pg.query(
        "SELECT * FROM public.submit_trial_cancellation_declaration($1::uuid, $2::uuid, $3::uuid)",
        [REQUEST, USER, ENROLLMENT],
      ),
    /permission denied/,
  )
  await pg.exec("RESET ROLE; SET ROLE authenticated")
  await assert.rejects(
    () =>
      pg.query(
        "SELECT * FROM public.submit_trial_cancellation_declaration($1::uuid, $2::uuid, $3::uuid)",
        [REQUEST, USER, ENROLLMENT],
      ),
    /permission denied/,
  )
  await pg.exec("RESET ROLE; SET ROLE service_role")
  const accepted = await pg.query<{ declaration_id: string }>(
    "SELECT * FROM public.submit_trial_cancellation_declaration($1::uuid, $2::uuid, $3::uuid)",
    [REQUEST, USER, ENROLLMENT],
  )
  assert.equal(accepted.rows.length, 1)
  await assert.rejects(
    () =>
      pg.query(
        "UPDATE private.trial_cancellation_declarations SET effective_end_at=effective_end_at+interval '1 day' WHERE id=$1::uuid",
        [accepted.rows[0].declaration_id],
      ),
    /immutable/,
  )
})
