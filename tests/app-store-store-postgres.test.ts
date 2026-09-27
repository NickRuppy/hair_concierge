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

const upsertTx = (id: string, user: string | null, signed: string, extra = "NULL, NULL") =>
  `SELECT coalesce(app_store_upsert_transaction('${id}', '1000', ${user ? `'${user}'` : "NULL"}, NULL,
    'de.chaarlie.scanner.monthly', 'Production', '2026-09-01T10:00:00Z', '2026-10-01T10:00:00Z',
    NULL, false, ${extra}, '${signed}')::text, 'unbound');`
const upsertStatus = (user: string | null, retry: boolean, signed: string) =>
  `SELECT coalesce(app_store_upsert_subscription_status('1000', ${user ? `'${user}'` : "NULL"}, true,
    'de.chaarlie.scanner.monthly', ${retry}, NULL, NULL, '${signed}', 'DID_RENEW')::text, 'unbound');`

test(
  "real PostgreSQL: newer-wins guard, bind-once ownership and service-only access",
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
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');
      ${migration}
    `)
    const service = (input: string) => sql(`SET ROLE service_role; ${input}`)

    // Unbound notification write, then the owning app binds it; nobody can rebind.
    assert.equal(await service(upsertTx("t1", null, "2026-09-01T10:00:01Z")), "unbound")
    assert.equal(await service(upsertTx("t1", owner, "2026-09-01T10:00:01Z")), owner)
    assert.equal(await service(upsertTx("t1", other, "2026-09-05T00:00:00Z")), owner)
    assert.equal(await service(upsertTx("t1", null, "2026-09-06T00:00:00Z")), owner)

    // REFUND (newer) sticks; a stale unrevoked copy is ignored; REFUND_REVERSED (newer) clears.
    await service(upsertTx("t1", null, "2026-09-10T00:00:00Z", "'2026-09-10T00:00:00Z', 0"))
    await service(upsertTx("t1", null, "2026-09-02T00:00:00Z"))
    assert.equal(
      await service(
        "SELECT revocation_date IS NOT NULL FROM app_store_transactions WHERE transaction_id = 't1';",
      ),
      "t",
    )
    await service(upsertTx("t1", null, "2026-09-11T00:00:00Z"))
    assert.equal(
      await service(
        "SELECT revocation_date IS NULL FROM app_store_transactions WHERE transaction_id = 't1';",
      ),
      "t",
    )

    // Status rows follow the same rules.
    assert.equal(await service(upsertStatus(null, true, "2026-09-10T00:00:00Z")), "unbound")
    assert.equal(await service(upsertStatus(owner, false, "2026-09-09T00:00:00Z")), owner)
    assert.equal(
      await service(
        "SELECT in_billing_retry FROM app_store_subscription_status WHERE original_transaction_id = '1000';",
      ),
      "t",
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
      service(
        `SELECT app_store_upsert_transaction('t2','1000',NULL,NULL,'p','LocalTesting',now(),now(),NULL,false,NULL,NULL,now());`,
      ),
      /check constraint/,
    )
    await sql(`DELETE FROM public.profiles WHERE id = '${owner}';`)
    assert.equal(
      await sql(
        "SELECT (SELECT count(*) FROM app_store_transactions) || ',' || (SELECT count(*) FROM app_store_subscription_status);",
      ),
      "0,0",
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
        if (url.pathname.endsWith("/rpc/app_store_upsert_transaction")) return Response.json(owner)
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
  assert.equal(await upsertAppStoreTransaction(db, row, owner), owner)
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
