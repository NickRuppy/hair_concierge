import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

// Explicit opt-in only. Uses the task-owned Docker container and a fresh disposable database.
// This verifies actual PostgreSQL sessions/locking; it is not a production-schema or provider E2E test.
const configuredUrl = process.env.OPENAI_ADS_TEST_DATABASE_URL
const dockerPrefix = ["--context", "colima-chaarlie", "exec", "-i", "chaarlie-openai-ads-pg"]
function processSql(database: string, sql: string) {
  const child = spawn(
    "docker",
    [
      ...dockerPrefix,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  )
  let out = "",
    err = ""
  let signal!: () => void
  const barrier = new Promise<void>((resolve) => {
    signal = resolve
  })
  const done = new Promise<string>((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      out += chunk.toString()
      if (out.includes("LOCK_BARRIER")) signal()
    })
    child.stderr.on("data", (chunk) => {
      err += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err || `psql exited ${code}`)),
    )
  })
  child.stdin.end(sql)
  return { done, barrier }
}
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
const C = "11111111-1111-4111-8111-111111111111",
  S = "22222222-2222-4222-8222-222222222222",
  V = "33333333-3333-4333-8333-333333333333"
function choice(
  consent: string,
  revision: number,
  marketing: boolean,
  session: string | null = null,
) {
  return `SELECT manage_openai_ads_context('${consent}',clock_timestamp()+interval '89 days','choice','${crypto.randomUUID()}',${revision},${marketing},${session ? quote(session) : "NULL"},'${V}','https://chaarlie.de/result','opaque%2Bref',NULL);`
}
const trial = {
  funnel_session_id: S,
  trial_analytics_version: 1,
  value: 0,
  trial_authorized_at: new Date().toISOString(),
}
function event(key: string, name: string, payload: Record<string, unknown>) {
  return `INSERT INTO billing_analytics_outbox(event_key,event_name,provider,payload) VALUES(${quote(key)},${quote(name)},'stripe',${quote(JSON.stringify(payload))}::jsonb) ON CONFLICT(event_key) DO NOTHING;`
}
test(
  "real PostgreSQL consent races, privileges, expiry and optional billing delivery",
  { skip: !configuredUrl, timeout: 60000 },
  async (t) => {
    const url = new URL(configuredUrl!)
    assert.ok(["postgres:", "postgresql:"].includes(url.protocol))
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.port, "32768")
    assert.equal(url.username, "postgres")
    assert.equal(url.pathname, "/postgres")
    const database = `openai_ads_test_${crypto.randomUUID().replaceAll("-", "")}`
    await processSql("postgres", `CREATE DATABASE ${database};`).done
    t.after(async () => {
      await processSql("postgres", `DROP DATABASE ${database} WITH (FORCE);`).done
    })
    const sql = (text: string) => processSql(database, text).done
    const assertWaitingOnLock = async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        if (
          (await sql(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='openai-race-waiter' AND wait_event_type='Lock');",
          )) === "t"
        )
          return
      }
      assert.fail("Second PostgreSQL session did not reach the expected lock wait")
    }
    const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8")
    await sql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;
 CREATE TABLE public.funnel_sessions(id uuid PRIMARY KEY,visitor_id uuid,is_internal_test boolean DEFAULT false,test_kind text);
 INSERT INTO funnel_sessions(id,visitor_id) VALUES('${S}','${V}'); GRANT SELECT ON funnel_sessions TO service_role;`)
    await sql(migration("20260915141251_openai_ads_consent_context"))
    await sql(`CREATE TABLE private.trial_analytics_contexts(enrollment_id uuid PRIMARY KEY,marketing_consent boolean,acquisition jsonb);
 CREATE TABLE public.billing_analytics_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text UNIQUE NOT NULL,event_name text NOT NULL,provider text NOT NULL,payload jsonb NOT NULL);
 CREATE TABLE public.billing_analytics_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),outbox_id uuid REFERENCES billing_analytics_outbox(id),destination text CONSTRAINT billing_analytics_deliveries_destination_check CHECK(destination IN('customerio','meta','posthog','funnel')),status text DEFAULT 'pending' CONSTRAINT billing_analytics_deliveries_status_check CHECK(status IN('pending','processing','delivered','failed','failed_permanent')),UNIQUE(outbox_id,destination));
 GRANT SELECT,INSERT,UPDATE ON billing_analytics_outbox,billing_analytics_deliveries TO service_role; GRANT SELECT ON private.trial_analytics_contexts TO service_role;
 ${event("historical", "trial_started", trial)}`)
    await sql(migration("20260915141328_openai_ads_billing_delivery"))
    await sql(migration("20260915145322_openai_ads_canonical_test_exclusion"))
    await sql(
      `CREATE TRIGGER guard_trial_analytics_delivery BEFORE INSERT ON billing_analytics_deliveries FOR EACH ROW EXECUTE FUNCTION private.guard_trial_analytics_delivery();`,
    )

    await t.test(
      "grant and withdrawal interleave across locked sessions in both orders",
      async () => {
        await sql(choice(C, 0, true))
        // Revoke holds the row lock while a stale grant waits behind it.
        let first = processSql(
          database,
          `BEGIN; ${choice(C, 0, false)}\n\\echo LOCK_BARRIER\nSELECT pg_sleep(2); COMMIT;`,
        )
        await Promise.race([
          first.barrier,
          first.done.then(() => {
            throw new Error("missing barrier")
          }),
        ])
        let second = sql(`SET application_name='openai-race-waiter'; ${choice(C, 1, true)}`)
        await assertWaitingOnLock()
        await first.done
        assert.equal(JSON.parse(await second).conflict, true)
        assert.equal(
          await sql(`SELECT marketing FROM private.openai_ads_consents WHERE id='${C}'`),
          "f",
        )
        await sql(choice(C, 2, true))
        // A repeated grant holds the lock; stale withdrawal still wins after waiting.
        first = processSql(
          database,
          `BEGIN; ${choice(C, 3, true)}\n\\echo LOCK_BARRIER\nSELECT pg_sleep(2); COMMIT;`,
        )
        await Promise.race([
          first.barrier,
          first.done.then(() => {
            throw new Error("missing barrier")
          }),
        ])
        second = sql(`SET application_name='openai-race-waiter'; ${choice(C, 0, false)}`)
        await assertWaitingOnLock()
        await first.done
        assert.equal(JSON.parse(await second).marketing, false)
        assert.equal(
          await sql(
            `SELECT revision||':'||marketing FROM private.openai_ads_consents WHERE id='${C}'`,
          ),
          "5:false",
        )
      },
    )
    await t.test("concurrent different identities cannot steal a session association", async () => {
      const one = crypto.randomUUID(),
        two = crypto.randomUUID()
      const first = processSql(
        database,
        `BEGIN; ${choice(one, 0, true, S)}\n\\echo LOCK_BARRIER\nSELECT pg_sleep(2); COMMIT;`,
      )
      await Promise.race([
        first.barrier,
        first.done.then(() => {
          throw new Error("missing barrier")
        }),
      ])
      const second = sql(`SET application_name='openai-race-waiter'; ${choice(two, 0, true, S)}`)
      await assertWaitingOnLock()
      await first.done
      assert.equal(JSON.parse(await second).conflict, true)
      assert.equal(
        await sql(`SELECT consent_id FROM private.openai_ads_contexts WHERE session_id='${S}'`),
        one,
      )
    })
    await t.test(
      "public roles denied, service role allowed, and expiry removes context",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await assert.rejects(
            sql(`SET ROLE ${role}; SELECT * FROM private.openai_ads_consents;`),
            /permission denied/,
          )
          await assert.rejects(
            sql(`SET ROLE ${role}; SELECT cleanup_openai_ads_context();`),
            /permission denied/,
          )
          await assert.rejects(
            sql(
              `SET ROLE ${role}; SELECT read_openai_ads_event_context('${S}',clock_timestamp());`,
            ),
            /permission denied/,
          )
        }
        assert.equal(
          JSON.parse(await sql(`SET ROLE service_role; ${choice(crypto.randomUUID(), 0, true)}`))
            .marketing,
          true,
        )
        await sql(
          `UPDATE private.openai_ads_consents SET expires_at=clock_timestamp()-interval '1 second';`,
        )
        assert.equal(
          await sql(`SELECT read_openai_ads_event_context('${S}',clock_timestamp()) IS NULL;`),
          "t",
        )
        assert.ok(
          Number(await sql(`SET ROLE service_role; SELECT cleanup_openai_ads_context();`)) >= 4,
        )
        assert.equal(await sql("SELECT count(*) FROM private.openai_ads_contexts;"), "0")
      },
    )
    await t.test(
      "only fresh eligible billing events enqueue; duplicate, renewal, exclusions and history do not",
      async () => {
        await sql(`SET ROLE service_role; ${event("new-trial", "trial_started", trial)} ${event("first-paid", "purchase_completed", { ...trial, value: 20, attempt_phase: "first_paid" })} ${event("new-trial", "trial_started", trial)}
  ${event("renewal", "purchase_completed", { ...trial, attempt_phase: "renewal" })}
  ${event("excluded", "trial_started", { ...trial, is_internal_test: true })}
  ${event("field-test", "trial_started", { ...trial, test_kind: "field_test" })}
  ${event("no-session", "trial_started", { ...trial, funnel_session_id: null })}`)
        assert.equal(
          await sql(
            `SELECT string_agg(o.event_key,',' ORDER BY o.event_key) FROM billing_analytics_deliveries d JOIN billing_analytics_outbox o ON o.id=d.outbox_id WHERE d.destination='openai';`,
          ),
          "first-paid,new-trial",
        )
        await sql(
          `UPDATE billing_analytics_deliveries SET status='skipped' WHERE destination='openai';`,
        )
        assert.equal(
          await sql("SELECT count(*) FROM billing_analytics_deliveries WHERE status='skipped';"),
          "2",
        )
        await sql(
          `INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'openai' FROM billing_analytics_outbox WHERE event_key='renewal';`,
        )
        assert.equal(await sql("SELECT count(*) FROM billing_analytics_deliveries;"), "2")
      },
    )
    await t.test(
      "canonical test sessions block unmarked purchases and late classifications suppress queued context",
      async () => {
        const sessionIds = [
          crypto.randomUUID(),
          crypto.randomUUID(),
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]
        for (const [index, session] of sessionIds.entries()) {
          const internal = index === 0
          const kind = index === 1 ? "field_test" : index === 2 ? "partner" : null
          await sql(
            `INSERT INTO funnel_sessions(id,visitor_id,is_internal_test,test_kind) VALUES('${session}','${V}',${internal},${kind ? quote(kind) : "NULL"}); ${choice(crypto.randomUUID(), 0, true, session)}`,
          )
          await sql(
            `SET ROLE service_role; ${event(`canonical-${index}`, "purchase_completed", { funnel_session_id: session, value: 20, currency: "EUR" })}`,
          )
          const count = await sql(
            `SELECT count(*) FROM billing_analytics_deliveries d JOIN billing_analytics_outbox e ON e.id=d.outbox_id WHERE e.event_key='canonical-${index}'`,
          )
          assert.equal(count, index === 3 ? "1" : "0")
          const absent = await sql(
            `SET ROLE service_role; SELECT read_openai_ads_event_context('${session}',clock_timestamp()) IS NULL;`,
          )
          assert.equal(absent, index === 3 ? "f" : "t")
        }
        const commercial = sessionIds[3]
        assert.equal(
          await sql(
            "SELECT provolatile FROM pg_proc WHERE oid='private.is_openai_ads_billing_event(public.billing_analytics_outbox)'::regprocedure",
          ),
          "s",
        )
        await sql(`UPDATE funnel_sessions SET test_kind='field_test' WHERE id='${commercial}';`)
        assert.equal(
          await sql(
            `SET ROLE service_role; SELECT read_openai_ads_event_context('${commercial}',clock_timestamp()) IS NULL;`,
          ),
          "t",
        )
        // Existing destination remains for the dispatcher to mark skipped; it can no longer resolve context.
        assert.equal(
          await sql(
            "SELECT count(*) FROM billing_analytics_deliveries d JOIN billing_analytics_outbox e ON e.id=d.outbox_id WHERE e.event_key='canonical-3'",
          ),
          "1",
        )
        await sql(
          `DELETE FROM billing_analytics_deliveries WHERE outbox_id IN(SELECT id FROM billing_analytics_outbox WHERE event_key LIKE 'canonical-%');`,
        )
      },
    )
    await t.test(
      "optional trigger failure does not roll back the canonical billing insert",
      async () => {
        await sql(`CREATE FUNCTION private.test_fail_openai_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected optional failure'; END $$;
   CREATE TRIGGER test_fail_openai_delivery BEFORE INSERT ON billing_analytics_deliveries FOR EACH ROW EXECUTE FUNCTION private.test_fail_openai_delivery();
   ${event("survives-optional-failure", "trial_started", trial)}`)
        assert.equal(
          await sql(
            "SELECT count(*) FROM billing_analytics_outbox WHERE event_key='survives-optional-failure';",
          ),
          "1",
        )
        assert.equal(await sql("SELECT count(*) FROM billing_analytics_deliveries;"), "2")
      },
    )
  },
)
