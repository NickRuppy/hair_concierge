import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"
import { createClient } from "@supabase/supabase-js"
import { hasActiveAppStoreAccess, transactionSnapshot } from "../src/lib/app-store/state"
import { loadAppStoreEntitlement, upsertAppStoreTransaction } from "../src/lib/app-store/store"

const enabled = process.env.APP_STORE_POSTGRES_TEST === "1"
const migration = readFileSync(
  "supabase/migrations/20260927133426_app_store_subscriptions.sql",
  "utf8",
)
const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"

function docker(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let output = ""
    let error = ""
    child.stdout.on("data", (chunk) => (output += chunk.toString()))
    child.stderr.on("data", (chunk) => (error += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error || `docker exited ${code}`)),
    )
    child.stdin.end(input)
  })
}

const q = (value: string | null) => (value === null ? "NULL" : `'${value}'`)
const outcome = (call: string) =>
  `SELECT r->>'outcome' || ',' || coalesce(r->>'owner', 'unbound') FROM (SELECT ${call} AS r) x;`
function upsertTx(
  id: string,
  user: string | null,
  signed: string,
  { original = "1000", environment = "Production", revoked = null as string | null } = {},
) {
  return outcome(`app_store_upsert_transaction(${q(id)}, ${q(original)}, ${q(user)}, NULL,
    'de.chaarlie.scanner.monthly', ${q(environment)}, '2026-09-01T10:00:00Z', '2026-10-01T10:00:00Z',
    NULL, false, ${q(revoked)}, ${revoked ? "0" : "NULL"}, ${q(signed)})`)
}
function upsertStatus(
  user: string | null,
  retry: boolean,
  signed: string,
  { original = "1000", environment = "Production" } = {},
) {
  return outcome(`app_store_upsert_subscription_status(${q(original)}, ${q(user)}, ${q(environment)},
    true, 'de.chaarlie.scanner.monthly', ${retry}, NULL, NULL, ${q(signed)}, 'DID_RENEW')`)
}

test(
  "real PostgreSQL: newer-wins, immutable identity, one account per subscription, service-only",
  { skip: !enabled, timeout: 60000 },
  async (t) => {
    const container = `chaarlie-app-store-${crypto.randomUUID()}`
    await docker([
      "run",
      "--rm",
      "--detach",
      "--name",
      container,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:17",
    ])
    t.after(async () => {
      await docker(["rm", "--force", container])
    })
    for (let attempt = 0; ; attempt++) {
      try {
        await docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt === 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (input: string) =>
      docker(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        input,
      )
    await sql(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');
      ${migration}
    `)
    const service = (input: string) => sql(`SET ROLE service_role; ${input}`)
    const tx1 = (column: string) =>
      service(`SELECT ${column} FROM app_store_transactions WHERE transaction_id = 't1';`)

    // Unbound notification write, then the owning app binds it (equal signedDate = replay).
    assert.equal(await service(upsertTx("t1", null, "2026-09-01T10:00:01Z")), "applied,unbound")
    assert.equal(await service(upsertTx("t1", owner, "2026-09-01T10:00:01Z")), `applied,${owner}`)
    // Another account is refused (A3) but Apple's newer state is still recorded for the owner.
    assert.equal(
      await service(upsertTx("t1", other, "2026-09-05T00:00:00Z")),
      `owned_by_other_account,${owner}`,
    )
    assert.equal(await tx1("signed_date = '2026-09-05T00:00:00Z'"), "t")
    assert.equal(await service(upsertTx("t1", null, "2026-09-06T00:00:00Z")), `applied,${owner}`)

    // REFUND (newer) sticks; a stale unrevoked copy is ignored; REFUND_REVERSED (newer) clears.
    await service(upsertTx("t1", null, "2026-09-10T00:00:00Z", { revoked: "2026-09-10T00:00:00Z" }))
    assert.equal(await service(upsertTx("t1", null, "2026-09-02T00:00:00Z")), `stale,${owner}`)
    assert.equal(await tx1("revocation_date IS NOT NULL"), "t")
    await service(upsertTx("t1", null, "2026-09-11T00:00:00Z"))
    assert.equal(await tx1("revocation_date IS NULL"), "t")

    // Ownership is per subscription: new periods inherit the owner, others are refused.
    assert.equal(
      await service(upsertTx("t2", other, "2026-10-01T10:00:00Z")),
      `owned_by_other_account,${owner}`,
    )
    assert.equal(await service(upsertTx("t3", null, "2026-11-01T10:00:00Z")), `applied,${owner}`)
    assert.equal(
      await service(upsertTx("t4", other, "2026-09-01T10:00:01Z", { original: "2000" })),
      `applied,${other}`,
    )
    assert.equal(
      await service(upsertTx("t5", owner, "2026-10-01T10:00:01Z", { original: "2000" })),
      `owned_by_other_account,${other}`,
    )

    // Status rows: inherit the subscription owner, newer-wins, same A3 refusal.
    assert.equal(
      await service(upsertStatus(null, true, "2026-09-10T00:00:00Z")),
      `applied,${owner}`,
    )
    assert.equal(
      await service(upsertStatus(owner, false, "2026-09-09T00:00:00Z")),
      `stale,${owner}`,
    )
    assert.equal(
      await service(
        "SELECT in_billing_retry FROM app_store_subscription_status WHERE original_transaction_id = '1000';",
      ),
      "t",
    )
    assert.equal(
      await service(upsertStatus(other, false, "2026-09-12T00:00:00Z")),
      `owned_by_other_account,${owner}`,
    )

    // Identity is immutable: environment / original transaction never change on conflict.
    assert.equal(
      await service(upsertTx("t1", owner, "2026-12-01T00:00:00Z", { environment: "Sandbox" })),
      `environment_mismatch,${owner}`,
    )
    assert.equal(
      await service(upsertTx("t1", owner, "2026-12-01T00:00:00Z", { original: "9999" })),
      `identity_mismatch,${owner}`,
    )
    assert.equal(
      await tx1(
        "environment || ',' || original_transaction_id || ',' || (signed_date < '2026-12-01')",
      ),
      "Production,1000,true",
    )
    assert.equal(
      await service(upsertStatus(owner, false, "2026-12-01T00:00:00Z", { environment: "Sandbox" })),
      `environment_mismatch,${owner}`,
    )

    // Concurrent first binds of one subscription by two accounts: exactly one owner wins.
    const first = sql(`
      SET ROLE service_role; BEGIN;
      ${upsertTx("c1", owner, "2026-09-01T10:00:01Z", { original: "3000" })}
      SELECT pg_sleep(0.4); COMMIT;
    `)
    await setTimeout(75)
    const second = service(upsertTx("c2", other, "2026-09-01T10:00:02Z", { original: "3000" }))
    const [, secondResult] = await Promise.all([first, second])
    assert.equal(secondResult, `owned_by_other_account,${owner}`)
    assert.equal(
      await service(
        "SELECT string_agg(DISTINCT user_id::text, ',') FROM app_store_transactions WHERE original_transaction_id = '3000';",
      ),
      owner,
    )

    // Service-only: RLS on, no grants for client roles, functions not executable by them.
    assert.equal(
      await sql(
        "SELECT string_agg(relname || ':' || relrowsecurity, ',' ORDER BY relname) FROM pg_class WHERE relname LIKE 'app_store_%' AND relkind = 'r';",
      ),
      "app_store_subscription_status:true,app_store_transactions:true",
    )
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(
        sql(`SET ROLE ${role}; SELECT count(*) FROM app_store_transactions;`),
        /permission denied/,
      )
      await assert.rejects(
        sql(`SET ROLE ${role}; ${upsertTx("t9", null, "2026-09-01T00:00:00Z")}`),
        /permission denied/,
      )
    }

    // Environment is constrained; account deletion cascades.
    await assert.rejects(
      service(upsertTx("t8", null, "2026-09-01T00:00:00Z", { environment: "LocalTesting" })),
      /check constraint/,
    )
    await sql(`DELETE FROM public.profiles WHERE id = '${owner}';`)
    assert.equal(
      await sql(
        "SELECT (SELECT count(*) FROM app_store_transactions WHERE original_transaction_id <> '2000') || ',' || (SELECT count(*) FROM app_store_subscription_status);",
      ),
      "0,0",
    )
    // A deleted owner no longer holds the subscription: another account may claim it.
    assert.equal(await service(upsertTx("t1", other, "2026-09-01T10:00:00Z")), `applied,${other}`)
    assert.equal(
      await service(upsertStatus(other, false, "2026-09-01T10:00:00Z")),
      `applied,${other}`,
    )
  },
)

test("store maps rows to the upsert RPC and reads a user's entitlement back", async () => {
  const calls: Array<{ path: string; search: string; body: unknown }> = []
  const db = createClient("https://db.example.test", "synthetic-service", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input))
        calls.push({
          path: url.pathname,
          search: url.search,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        })
        if (url.pathname.endsWith("/rpc/app_store_upsert_transaction"))
          return Response.json({ outcome: "applied", owner })
        if (url.pathname.endsWith("/app_store_transactions"))
          return Response.json([
            {
              transaction_id: "t1",
              original_transaction_id: "1000",
              app_account_token: owner,
              product_id: "de.chaarlie.scanner.yearly",
              environment: "Production",
              purchase_date: "2026-09-01T10:00:00+00:00",
              expires_date: "2026-09-08T10:00:00+00:00",
              offer_type: 1,
              is_trial: true,
              revocation_date: null,
              revocation_reason: null,
              signed_date: "2026-09-01T10:00:01+00:00",
            },
          ])
        return Response.json([
          {
            original_transaction_id: "1000",
            environment: "Production",
            auto_renew_status: true,
            auto_renew_product_id: "de.chaarlie.scanner.yearly",
            in_billing_retry: false,
            grace_period_expires_date: null,
            expiration_intent: null,
            signed_date: "2026-09-01T10:00:01+00:00",
            last_notification_type: "SUBSCRIBED",
          },
        ])
      },
    },
  })
  const row = transactionSnapshot(
    {
      transactionId: "t1",
      originalTransactionId: "1000",
      productId: "de.chaarlie.scanner.yearly",
      type: "Auto-Renewable Subscription",
      purchaseDate: Date.parse("2026-09-01T10:00:00Z"),
      expiresDate: Date.parse("2026-09-08T10:00:00Z"),
      signedDate: Date.parse("2026-09-01T10:00:01Z"),
      environment: "Production",
      appAccountToken: owner,
      offerType: 1,
      offerDiscountType: "FREE_TRIAL",
    },
    { environment: "Production", notificationType: "SUBSCRIBED" },
  )
  assert.deepEqual(await upsertAppStoreTransaction(db, row, owner), { outcome: "applied", owner })
  assert.deepEqual(calls[0].body, {
    p_transaction_id: "t1",
    p_original_transaction_id: "1000",
    p_user_id: owner,
    p_app_account_token: owner,
    p_product_id: "de.chaarlie.scanner.yearly",
    p_environment: "Production",
    p_purchase_date: "2026-09-01T10:00:00.000Z",
    p_expires_date: "2026-09-08T10:00:00.000Z",
    p_offer_type: 1,
    p_is_trial: true,
    p_revocation_date: null,
    p_revocation_reason: null,
    p_signed_date: "2026-09-01T10:00:01.000Z",
  })

  const snapshot = await loadAppStoreEntitlement(db, owner)
  assert.match(calls[1].search, /user_id=eq\.11111111/)
  assert.match(calls[2].search, /original_transaction_id=in\.%281000%29/)
  assert.deepEqual(snapshot.transactions[0], row)
  assert.equal(snapshot.statuses[0].autoRenewStatus, true)
  assert.equal(hasActiveAppStoreAccess(snapshot, new Date("2026-09-05T00:00:00Z")), true)
})
