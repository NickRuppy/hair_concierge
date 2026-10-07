import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  reconcileTrialCancellationProviderOperations,
  type TrialCancellationRetryClient,
} from "../src/lib/billing/trial-cancellation-reconcile"
import { handleTrialCancellationReconcile } from "../src/app/api/billing/trial-cancellation/reconcile/route"

const ids = {
  declaration: "11111111-1111-4111-8111-111111111111",
  user: "22222222-2222-4222-8222-222222222222",
  lease: "33333333-3333-4333-8333-333333333333",
}
const ROOT = new URL("../", import.meta.url)
const MUTANT = process.env.TRIAL_CANCELLATION_RETRY_MUTANT
const MIGRATIONS = [
  "supabase/migrations/20260914044650_trial_admission_foundation.sql",
  "supabase/migrations/20260914090614_trial_cancellation_declarations.sql",
  "supabase/migrations/20260914093927_trial_cancellation_provider_operations.sql",
  "supabase/migrations/20260914101500_trial_cancellation_provider_retry.sql",
] as const

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE public.profiles (id uuid PRIMARY KEY); CREATE TABLE public.billing_subscriptions (id uuid PRIMARY KEY, user_id uuid, provider text, provider_customer_id text, provider_subscription_id text); GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON public.profiles, public.billing_subscriptions TO service_role;",
  )
  for (const migration of MIGRATIONS) {
    let sql = await readFile(new URL(migration, ROOT), "utf8")
    // Harness-only mutation proof: stale workers must never finish a newer
    // lease, even after a provider timeout and retry.
    if (
      MUTANT === "skip-lease-owner" &&
      migration.endsWith("trial_cancellation_provider_retry.sql")
    ) {
      sql = sql.replace("AND o.lease_token = p_lease_token;", "AND TRUE;")
    }
    await pg.exec(sql)
  }
  await pg.exec("GRANT USAGE ON SCHEMA private TO service_role")
  await pg.query("INSERT INTO public.profiles(id) VALUES ($1::uuid)", [ids.user])
  await pg.query(
    "INSERT INTO public.trial_enrollments(id,user_id,accepted_offer,provider,provider_agreement_id,admission_status,authorization_succeeded_at,original_trial_end_at) VALUES ($1::uuid,$2::uuid,'{}','stripe','sub_1','active','2099-01-01T00:00:00Z','2099-01-08T00:00:00Z')",
    ["44444444-4444-4444-8444-444444444444", ids.user],
  )
  await pg.query(
    "INSERT INTO public.billing_subscriptions(id,user_id,provider,provider_customer_id,provider_subscription_id,trial_enrollment_id) VALUES ($1::uuid,$2::uuid,'stripe','cus_1','sub_1',$3::uuid)",
    ["55555555-5555-4555-8555-555555555555", ids.user, "44444444-4444-4444-8444-444444444444"],
  )
  const saved = await pg.query<{ declaration_id: string }>(
    "SELECT * FROM public.submit_trial_cancellation_declaration($1::uuid,$2::uuid,$3::uuid)",
    [ids.declaration, ids.user, "44444444-4444-4444-8444-444444444444"],
  )
  return { pg, declarationId: saved.rows[0]!.declaration_id }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    declaration_id: ids.declaration,
    user_id: ids.user,
    provider: "stripe",
    lease_token: ids.lease,
    ...overrides,
  }
}

test("claims stable operations and completes a Stripe reconciliation with its lease", async () => {
  const calls: Array<{ name: string; args: Record<string, string> }> = []
  const client: TrialCancellationRetryClient = {
    rpc: async (name, args) => {
      calls.push({ name, args })
      return name === "claim_trial_cancellation_provider_operations"
        ? { data: [row()], error: null }
        : { data: true, error: null }
    },
  }
  const result = await reconcileTrialCancellationProviderOperations({
    client,
    reconcileStripe: async ({ declarationId, userId }) => {
      assert.equal(declarationId, ids.declaration)
      assert.equal(userId, ids.user)
      return "confirmed"
    },
  })
  assert.deepEqual(result, { claimed: 1, confirmed: 1, pending: 0, unsupported: 0 })
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "claim_trial_cancellation_provider_operations",
      "complete_trial_cancellation_provider_operation_attempt",
    ],
  )
  assert.deepEqual(calls[1]!.args, {
    p_declaration_id: ids.declaration,
    p_lease_token: ids.lease,
    p_error_code: "",
  })
})

test("a Stripe timeout remains pending and releases only the owned leased operation", async () => {
  const calls: Array<{ name: string; args: Record<string, string> }> = []
  const result = await reconcileTrialCancellationProviderOperations({
    client: {
      rpc: async (name, args) => {
        calls.push({ name, args })
        return name === "claim_trial_cancellation_provider_operations"
          ? { data: [row()], error: null }
          : { data: true, error: null }
      },
    },
    reconcileStripe: async () => "pending",
  })
  assert.deepEqual(result, { claimed: 1, confirmed: 0, pending: 1, unsupported: 0 })
  assert.equal(calls[1]!.args.p_error_code, "stripe_reconciliation_pending")
  assert.equal(calls[1]!.args.p_lease_token, ids.lease)
})

test("PayPal runs its adapter under the owned lease and remains pending only when reconciliation says so", async () => {
  let stripeCalls = 0,
    paypalCalls = 0
  const calls: Array<{ name: string; args: Record<string, string> }> = []
  const result = await reconcileTrialCancellationProviderOperations({
    client: {
      rpc: async (name, args) => {
        calls.push({ name, args })
        return name === "claim_trial_cancellation_provider_operations"
          ? { data: [row({ provider: "paypal" })], error: null }
          : { data: true, error: null }
      },
    },
    reconcileStripe: async () => {
      stripeCalls++
      return "confirmed"
    },
    reconcilePayPal: async ({ declarationId, userId }) => {
      paypalCalls++
      assert.equal(declarationId, ids.declaration)
      assert.equal(userId, ids.user)
      return "confirmed"
    },
  })
  assert.deepEqual(result, { claimed: 1, confirmed: 1, pending: 0, unsupported: 0 })
  assert.equal(stripeCalls, 0)
  assert.equal(paypalCalls, 1)
  assert.equal(calls[1]!.args.p_error_code, "")
})

test("malformed leased rows fail closed without a provider or completion RPC", async () => {
  let completions = 0
  await assert.rejects(() =>
    reconcileTrialCancellationProviderOperations({
      client: {
        rpc: async (name) => {
          if (name === "claim_trial_cancellation_provider_operations") {
            return { data: [row({ lease_token: "not-a-uuid" })], error: null }
          }
          completions++
          return { data: true, error: null }
        },
      },
      reconcileStripe: async () => {
        throw new Error("must not run")
      },
    }),
  )
  assert.equal(completions, 0)
})

test("a lost completion acknowledgement fails the invocation and leaves its lease for retry", async () => {
  await assert.rejects(() =>
    reconcileTrialCancellationProviderOperations({
      client: {
        rpc: async (name) =>
          name === "claim_trial_cancellation_provider_operations"
            ? { data: [row()], error: null }
            : { data: false, error: null },
      },
      reconcileStripe: async () => "pending",
    }),
  )
})

test("a still-running provider call retains its lease instead of starting an immediate duplicate", async () => {
  const calls: string[] = []
  const result = await reconcileTrialCancellationProviderOperations({
    client: {
      rpc: async (name) => {
        calls.push(name)
        return { data: [row()], error: null }
      },
    },
    reconcileStripe: async () => "in_progress",
  })
  assert.deepEqual(result, { claimed: 1, confirmed: 0, pending: 1, unsupported: 0 })
  assert.deepEqual(calls, ["claim_trial_cancellation_provider_operations"])
})

test("the retry migration denies stale lease completion, defers timeout replay, and preserves its declaration", async (t) => {
  const { pg, declarationId } = await database(t)
  const first = await pg.query<{ declaration_id: string; lease_token: string }>(
    "SELECT * FROM public.claim_trial_cancellation_provider_operations(1, 60)",
  )
  assert.equal(first.rows.length, 1)
  assert.equal(first.rows[0]!.declaration_id, declarationId)
  assert.equal(
    (await pg.query("SELECT * FROM public.claim_trial_cancellation_provider_operations(1, 60)"))
      .rows.length,
    0,
  )
  assert.equal(
    (
      await pg.query<{ completed: boolean }>(
        "SELECT public.complete_trial_cancellation_provider_operation_attempt($1::uuid,$2::uuid,$3) AS completed",
        [declarationId, "66666666-6666-4666-8666-666666666666", "stripe_reconciliation_pending"],
      )
    ).rows[0]!.completed,
    false,
  )
  assert.equal(
    (
      await pg.query<{ completed: boolean }>(
        "SELECT public.complete_trial_cancellation_provider_operation_attempt($1::uuid,$2::uuid,$3) AS completed",
        [declarationId, first.rows[0]!.lease_token, "stripe_reconciliation_pending"],
      )
    ).rows[0]!.completed,
    true,
  )
  const state = await pg.query<{ status: string; error_code: string; lease_token: string | null }>(
    "SELECT status, error_code, lease_token FROM private.trial_cancellation_provider_operations",
  )
  assert.deepEqual(state.rows[0], {
    status: "pending",
    error_code: "stripe_reconciliation_pending",
    lease_token: null,
  })
  assert.equal(
    (await pg.query("SELECT * FROM public.claim_trial_cancellation_provider_operations(1, 60)"))
      .rows.length,
    0,
  )
  const declaration = await pg.query<{ count: number; submitted_at: string }>(
    "SELECT count(*)::int AS count, min(submitted_at)::text AS submitted_at FROM private.trial_cancellation_declarations",
  )
  assert.equal(declaration.rows[0]!.count, 1)
  assert.equal(Number.isFinite(Date.parse(declaration.rows[0]!.submitted_at)), true)
  await pg.exec(
    "UPDATE private.trial_cancellation_provider_operations SET next_attempt_at = clock_timestamp() - interval '1 second'",
  )
  const replay = await pg.query<{ declaration_id: string; lease_token: string }>(
    "SELECT * FROM public.claim_trial_cancellation_provider_operations(1, 60)",
  )
  assert.equal(replay.rows.length, 1)
  assert.equal(replay.rows[0]!.declaration_id, declarationId)
  assert.notEqual(replay.rows[0]!.lease_token, first.rows[0]!.lease_token)
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    () => pg.query("SELECT * FROM public.claim_trial_cancellation_provider_operations(1, 60)"),
    /permission denied/,
  )
})

test("the retry endpoint is cron-secret guarded and reports only aggregate worker state", async () => {
  let invoked = false
  const unauthorized = await handleTrialCancellationReconcile(new Request("https://x"), {
    cronSecret: "worker-secret",
    client: {} as never,
  })
  assert.deepEqual(unauthorized, { status: 401, body: { error: "unauthorized" } })
  const success = await handleTrialCancellationReconcile(
    new Request("https://x", { headers: { authorization: "Bearer worker-secret" } }),
    {
      cronSecret: "worker-secret",
      client: {} as never,
      reconcile: async () => {
        invoked = true
        return { claimed: 2, confirmed: 1, pending: 1, unsupported: 0 }
      },
    },
  )
  assert.equal(invoked, true)
  assert.deepEqual(success, {
    status: 200,
    body: { cancellationProviderRetry: { claimed: 2, confirmed: 1, pending: 1, unsupported: 0 } },
  })
})
