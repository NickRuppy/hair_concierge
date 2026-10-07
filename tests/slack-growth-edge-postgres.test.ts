import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const enabled = process.env.SLACK_GROWTH_POSTGRES_TEST === "1"
const migrationPath = "supabase/migrations/20260915184112_slack_growth_supabase_webhook.sql"
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
function command(
  args: string[],
  input?: string,
  onStderr?: (text: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "colima-chaarlie", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let out = "",
      err = ""
    child.stdout.on("data", (chunk) => {
      out += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      err += chunk.toString()
      onStderr?.(chunk.toString())
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err || `docker exited ${code}`)),
    )
    child.stdin.end(input)
  })
}

test(
  "Supabase Slack transport on real PostgreSQL",
  { skip: !enabled, timeout: 90000 },
  async (t) => {
    const container = `chaarlie-slack-edge-${crypto.randomUUID()}`
    await command([
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
      await command(["rm", "--force", container])
    })
    for (let attempt = 0; ; attempt++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt === 99) throw error
        await setTimeout(100)
      }
    }
    const sql = (text: string, onStderr?: (text: string) => void) =>
      command(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        text,
        onStderr,
      )
    const sr = (text: string) => sql(`SET ROLE service_role; ${text}`)
    const load = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8")
    await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,email text);
    INSERT INTO profiles VALUES('00000000-0000-4000-8000-000000000001','Mia Beispiel','mia@example.com');
    CREATE TABLE public.funnel_sessions(id uuid PRIMARY KEY,is_internal_test boolean,test_kind text);
    CREATE TABLE private.trial_analytics_contexts(enrollment_id uuid PRIMARY KEY,marketing_consent boolean,acquisition jsonb);
    ${load("20260708133700_billing_analytics_outbox")}
    ${load("20260718120000_allow_funnel_billing_analytics_destination")}
    ALTER TABLE billing_analytics_outbox DROP CONSTRAINT billing_analytics_outbox_event_name_check;
    ALTER TABLE billing_analytics_outbox ALTER COLUMN user_id SET DEFAULT '00000000-0000-4000-8000-000000000001';
    GRANT SELECT,INSERT,UPDATE ON public.billing_analytics_outbox,public.billing_analytics_deliveries TO service_role;
    GRANT SELECT ON public.profiles,public.funnel_sessions,private.trial_analytics_contexts TO service_role;
    ${load("20260915141328_openai_ads_billing_delivery")}
    CREATE TRIGGER guard_trial_analytics_delivery BEFORE INSERT ON public.billing_analytics_deliveries FOR EACH ROW EXECUTE FUNCTION private.guard_trial_analytics_delivery();
    ${load("20260915165617_slack_growth_notifications")}
    -- Network/Vault/cron adapters are fixtures. PostgreSQL locks, transactions and roles are real.
    CREATE SCHEMA net; CREATE SCHEMA vault; CREATE SCHEMA cron;
    CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
    INSERT INTO vault.decrypted_secrets VALUES('slack_growth_dispatch_token','fixture-only-token');
    CREATE TABLE net.requests(id bigint GENERATED ALWAYS AS IDENTITY,url text,body jsonb,headers jsonb);
    CREATE FUNCTION net.http_post(url text,body jsonb DEFAULT '{}'::jsonb,params jsonb DEFAULT '{}'::jsonb,headers jsonb DEFAULT '{}'::jsonb,timeout_milliseconds integer DEFAULT 1000) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE request_id bigint; BEGIN INSERT INTO net.requests(url,body,headers) VALUES(url,body,headers) RETURNING id INTO request_id; RETURN request_id; END $$;
    CREATE TABLE cron.jobs(name text,schedule text,command text);
    CREATE FUNCTION cron.schedule(job_name text,schedule text,command text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.jobs VALUES(job_name,schedule,command) RETURNING 1::bigint $$;`)
    // Stock PostgreSQL does not ship pg_net; replace only extension creation with the adapter above.
    await sql(
      readFileSync(migrationPath, "utf8").replace(
        /CREATE EXTENSION IF NOT EXISTS pg_net[^;]*;/i,
        "",
      ),
    )
    const insert = (key: string) =>
      sr(
        `INSERT INTO billing_analytics_outbox(event_key,event_name,provider,payload,occurred_at) VALUES(${quote(key)},'trial_started','stripe','{"trial_analytics_version":1,"value":0,"trial_authorized_at":"2026-09-15T12:00:00Z"}',clock_timestamp()); SELECT d.id FROM billing_analytics_deliveries d JOIN billing_analytics_outbox e ON e.id=d.outbox_id WHERE e.event_key=${quote(key)} AND d.destination='slack'`,
      )
    const claim = async (id: string) =>
      JSON.parse((await sr(`SELECT public.claim_slack_growth_delivery('${id}')`)) || "null")
    const receipt = (id: string, token: string, outcome: string, retry = "NULL") =>
      sr(
        `SELECT public.complete_slack_growth_delivery('${id}','${token}',${quote(outcome)},'slack_rate_limited',${retry})`,
      )
    const row = async (id: string) =>
      JSON.parse(
        await sql(`SELECT to_jsonb(d) FROM billing_analytics_deliveries d WHERE id='${id}'`),
      )
    const wakeCount = () => sql("SELECT count(*) FROM net.requests")
    await t.test(
      "RPCs and private secrets denied to clients; default disabled has no idle wake",
      async () => {
        for (const role of ["anon", "authenticated"])
          for (const query of [
            "SELECT public.claim_slack_growth_delivery(gen_random_uuid())",
            "SELECT public.check_slack_growth_claim(gen_random_uuid(),gen_random_uuid())",
            "SELECT public.complete_slack_growth_delivery(gen_random_uuid(),gen_random_uuid(),'delivered')",
            "SELECT public.sweep_slack_growth_deliveries()",
            "SELECT * FROM private.slack_growth_edge_config",
            "SELECT * FROM private.slack_growth_edge_leases",
            "SELECT private.wake_slack_growth_delivery(gen_random_uuid())",
          ])
            await assert.rejects(sql(`SET ROLE ${role}; ${query}`), /permission denied/)
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "0")
        assert.equal(await wakeCount(), "0")
        await sr("SELECT public.configure_slack_growth_notifications(true)")
        const id = await insert("disabled-edge")
        assert.equal(await claim(id), null)
        assert.equal(await wakeCount(), "0")
        await sr("UPDATE private.slack_growth_edge_config SET enabled=true WHERE singleton")
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "1")
        const work = await claim(id)
        assert.equal(await receipt(id, work.token, "delivered"), "t")
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "0")
        assert.equal(await wakeCount(), "1")
        assert.equal(await claim(crypto.randomUUID()), null)
        await assert.rejects(sr("SELECT * FROM vault.decrypted_secrets"), /permission denied/)
        assert.equal(
          await sql("SELECT name||':'||schedule||':'||command FROM cron.jobs"),
          "slack-growth-due-deliveries:* * * * *:SELECT public.sweep_slack_growth_deliveries();",
        )
      },
    )
    await t.test(
      "webhook request only after transaction commit, rollback discards request, fixed URL and minimal payload",
      async () => {
        const before = Number(await wakeCount())
        let ready!: () => void
        const started = new Promise<void>((resolve) => {
          ready = resolve
        })
        const pending = sql(
          `BEGIN; INSERT INTO billing_analytics_outbox(event_key,event_name,provider,payload,occurred_at) VALUES('transactional','purchase_completed','stripe','{"value":10}',clock_timestamp()); DO $$ BEGIN RAISE NOTICE 'inserted-uncommitted'; END $$; SELECT pg_sleep(1); COMMIT;`,
          (text) => {
            if (text.includes("inserted-uncommitted")) ready()
          },
        )
        await started
        assert.equal(Number(await wakeCount()), before)
        await pending
        assert.equal(Number(await wakeCount()), before + 1)
        await sql(
          "BEGIN; INSERT INTO billing_analytics_outbox(event_key,event_name,provider,payload,occurred_at) VALUES('rolled-back','purchase_completed','stripe','{\"value\":10}',clock_timestamp()); ROLLBACK",
        )
        assert.equal(Number(await wakeCount()), before + 1)
        const request = JSON.parse(
          await sql("SELECT to_jsonb(r) FROM net.requests r ORDER BY id DESC LIMIT 1"),
        )
        assert.equal(
          request.url,
          "https://pqdkhefxsxkyeqelqegq.supabase.co/functions/v1/slack-growth",
        )
        assert.deepEqual(Object.keys(request.body), ["delivery_id"])
        assert.equal(request.headers["x-slack-growth-token"], "fixture-only-token")
        const work = await claim(request.body.delivery_id)
        await receipt(request.body.delivery_id, work.token, "delivered")
      },
    )
    await t.test(
      "two simultaneous claims yield one owner; token fences stale and repeated receipts",
      async () => {
        const id = await insert("concurrent")
        let locked!: () => void
        const ownerReady = new Promise<void>((resolve) => {
          locked = resolve
        })
        const first = sql(
          `SET ROLE service_role; BEGIN; SELECT public.claim_slack_growth_delivery('${id}'); DO $$ BEGIN RAISE NOTICE 'claim-held'; END $$; SELECT pg_sleep(1); COMMIT;`,
          (text) => {
            if (text.includes("claim-held")) locked()
          },
        )
        await ownerReady
        // The second connection must wait for the first transaction's delivery-row lock.
        const claims = await Promise.all([first.then((value) => JSON.parse(value)), claim(id)])
        assert.equal(claims.filter(Boolean).length, 1)
        const work = claims.find(Boolean)
        assert.deepEqual(work.profile, { full_name: "Mia Beispiel", email: "mia@example.com" })
        assert.equal(work.event.event_key, "concurrent")
        assert.equal((await row(id)).attempts, 1)
        assert.equal(await receipt(id, crypto.randomUUID(), "delivered"), "f")
        await sql(
          `UPDATE billing_analytics_deliveries SET processing_started_at=clock_timestamp()-interval '16 minutes' WHERE id='${id}'`,
        )
        const replacement = await claim(id)
        assert.notEqual(replacement.token, work.token)
        assert.equal(await receipt(id, work.token, "delivered"), "f")
        assert.equal(
          await sr(`SELECT public.check_slack_growth_claim('${id}','${replacement.token}')`),
          "t",
        )
        assert.equal(await receipt(id, replacement.token, "delivered"), "t")
        assert.equal(await receipt(id, replacement.token, "retry"), "f")
        assert.equal(await claim(id), null)
      },
    )
    await t.test(
      "retry timing and pause release preserve attempts; canonical eligibility rechecked",
      async () => {
        const id = await insert("retry-pause")
        const work = await claim(id)
        assert.equal(await receipt(id, work.token, "retry", "3600"), "t")
        const failed = await row(id)
        assert.equal(failed.status, "failed")
        assert.equal(failed.last_error, "slack_rate_limited")
        assert.ok(Date.parse(failed.next_attempt_at) - Date.now() > 3590_000)
        assert.equal(await claim(id), null)
        assert.equal(await sr(`SELECT private.wake_slack_growth_delivery('${id}')`), "f")
        await sql(
          `UPDATE billing_analytics_deliveries SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id='${id}'`,
        )
        const second = await claim(id)
        await sr("SELECT public.configure_slack_growth_notifications(false)")
        assert.equal(
          await sr(`SELECT public.check_slack_growth_claim('${id}','${second.token}')`),
          "f",
        )
        assert.equal(await receipt(id, second.token, "paused"), "t")
        assert.equal((await row(id)).attempts, 1)
        assert.equal((await row(id)).status, "failed")
        await sr("SELECT public.configure_slack_growth_notifications(true)")
        const third = await claim(id)
        await sql(
          `UPDATE billing_analytics_outbox SET payload=payload||'{"is_internal_test":true}'::jsonb WHERE id=(SELECT outbox_id FROM billing_analytics_deliveries WHERE id='${id}')`,
        )
        assert.equal(
          await sr(`SELECT public.check_slack_growth_claim('${id}','${third.token}')`),
          "f",
        )
        await receipt(id, third.token, "skipped")
        assert.equal((await row(id)).status, "skipped")
        assert.equal(await claim(id), null)
      },
    )
    await t.test(
      "fifth abandoned claim becomes terminal without invoking Edge; no idle network calls",
      async () => {
        const id = await insert("crashes")
        for (let attempt = 1; attempt <= 5; attempt++) {
          assert.ok(await claim(id))
          assert.equal((await row(id)).attempts, attempt)
          await sql(
            `UPDATE billing_analytics_deliveries SET processing_started_at=clock_timestamp()-interval '16 minutes' WHERE id='${id}'`,
          )
        }
        const before = await wakeCount()
        await sr("SELECT public.sweep_slack_growth_deliveries()")
        assert.equal((await row(id)).status, "failed_permanent")
        assert.equal(await wakeCount(), before)
        assert.equal(await claim(id), null)
      },
    )
    await t.test(
      "failed pg_net wake cannot roll back billing; sweep repairs and suppresses duplicates by lease",
      async () => {
        await sql(
          "ALTER FUNCTION net.http_post(text,jsonb,jsonb,jsonb,integer) RENAME TO working_http_post",
        )
        const id = await insert("network-down")
        assert.ok(id)
        await sql(
          "ALTER FUNCTION net.working_http_post(text,jsonb,jsonb,jsonb,integer) RENAME TO http_post",
        )
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "1")
        const before = await wakeCount()
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "0")
        assert.equal(await wakeCount(), before)
        await sql(
          `UPDATE private.slack_growth_edge_leases SET wake_until=clock_timestamp()-interval '1 second' WHERE delivery_id='${id}'`,
        )
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "1")
        const work = await claim(id)
        await receipt(id, work.token, "delivered")
      },
    )
    await t.test(
      "recovery wakes only25 due rows per sweep, not future retries or other destinations",
      async () => {
        await sr("SELECT public.configure_slack_growth_notifications(false)")
        await sql(`INSERT INTO billing_analytics_outbox(event_key,event_name,provider,payload,occurred_at)
      SELECT 'bounded-'||i,'purchase_completed','stripe','{"value":10}',clock_timestamp() FROM generate_series(1,27) i;
      INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'meta' FROM billing_analytics_outbox WHERE event_key='bounded-1';`)
        await sr("SELECT public.configure_slack_growth_notifications(true)")
        const before = Number(await wakeCount())
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "25")
        assert.equal(Number(await wakeCount()), before + 25)
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "2")
        assert.equal(await sr("SELECT public.sweep_slack_growth_deliveries()"), "0")
        const otherId = await sql(
          "SELECT id FROM billing_analytics_deliveries WHERE destination='meta'",
        )
        assert.equal(await claim(otherId), null)
        assert.equal((await row(otherId)).attempts, 0)
      },
    )
  },
)
