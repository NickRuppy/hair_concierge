import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

// Opt in to an isolated, disposable PostgreSQL 17 container. No host ports or real data.
const enabled = process.env.SLACK_GROWTH_POSTGRES_TEST === "1"
const migrationPath = "supabase/migrations/20260915165617_slack_growth_notifications.sql"
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
const trial = { trial_analytics_version: 1, value: 0, trial_authorized_at: "2026-09-15T12:00:00Z" }
function event(
  key: string,
  name = "trial_started",
  payload: Record<string, unknown> = trial,
  provider = "stripe",
  at = "clock_timestamp()",
) {
  return `INSERT INTO public.billing_analytics_outbox(event_key,event_name,provider,payload,occurred_at) VALUES(${quote(key)},${quote(name)},${quote(provider)},${quote(JSON.stringify(payload))}::jsonb,${at}) ON CONFLICT(event_key) DO NOTHING;`
}
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
  "Slack queue on real PostgreSQL: eligibility, cutoff, repair, concurrency and privileges",
  { skip: !enabled, timeout: 60000 },
  async (t) => {
    const container = `chaarlie-slack-test-${crypto.randomUUID()}`
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
    await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY); INSERT INTO profiles VALUES('00000000-0000-4000-8000-000000000001');
    CREATE TABLE public.funnel_sessions(id uuid PRIMARY KEY,is_internal_test boolean,test_kind text);
    CREATE TABLE private.trial_analytics_contexts(enrollment_id uuid PRIMARY KEY,marketing_consent boolean,acquisition jsonb);
    ${readFileSync("supabase/migrations/20260708133700_billing_analytics_outbox.sql", "utf8")}
    ${readFileSync("supabase/migrations/20260718120000_allow_funnel_billing_analytics_destination.sql", "utf8")}
    ALTER TABLE billing_analytics_outbox DROP CONSTRAINT billing_analytics_outbox_event_name_check;
    ALTER TABLE billing_analytics_outbox ALTER COLUMN user_id SET DEFAULT '00000000-0000-4000-8000-000000000001';
    GRANT SELECT,INSERT,UPDATE ON public.billing_analytics_outbox,public.billing_analytics_deliveries TO service_role;
    GRANT SELECT ON public.funnel_sessions,private.trial_analytics_contexts TO service_role;
    ${readFileSync("supabase/migrations/20260915141328_openai_ads_billing_delivery.sql", "utf8")}
    CREATE TRIGGER guard_trial_analytics_delivery BEFORE INSERT ON public.billing_analytics_deliveries FOR EACH ROW EXECUTE FUNCTION private.guard_trial_analytics_delivery();
    ${event("historical")}`)
    await sql(readFileSync(migrationPath, "utf8"))
    const count = (key: string) =>
      sql(
        `SELECT count(*) FROM public.billing_analytics_deliveries d JOIN public.billing_analytics_outbox e ON e.id=d.outbox_id WHERE destination='slack' AND e.event_key=${quote(key)}`,
      )
    let cutoff = ""
    await t.test(
      "disabled by default; exact role permissions; first enable freezes cutoff",
      async () => {
        assert.deepEqual(
          JSON.parse(
            await sql(
              "SET ROLE service_role; SELECT public.read_slack_growth_notification_state()",
            ),
          ),
          { enabled: false, enabled_at: null },
        )
        for (const role of ["anon", "authenticated"]) {
          for (const statement of [
            "SELECT public.configure_slack_growth_notifications(true)",
            "SELECT public.read_slack_growth_notification_state()",
            "SELECT public.reconcile_slack_growth_deliveries()",
            "SELECT * FROM private.slack_growth_notification_state",
          ]) {
            await assert.rejects(sql(`SET ROLE ${role}; ${statement}`), /permission denied/)
          }
        }
        await sql(`SET ROLE service_role; ${event("disabled")}`)
        assert.equal(await count("disabled"), "0")
        const state = JSON.parse(
          await sql(
            "SET ROLE service_role; SELECT public.configure_slack_growth_notifications(true)",
          ),
        )
        assert.equal(state.enabled, true)
        assert.ok(Number.isFinite(Date.parse(state.enabled_at)))
        cutoff = state.enabled_at
        await sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries()")
        assert.equal(await count("historical"), "0")
        assert.equal(await count("disabled"), "0")
      },
    )
    await t.test(
      "both providers, positive first payments/direct purchases, unknown sources, no renewal or malformed facts",
      async () => {
        const cases: [string, string, Record<string, unknown>, string, boolean][] = [
          ["stripe-trial", "trial_started", trial, "stripe", true],
          ["paypal-trial", "trial_started", trial, "paypal", true],
          [
            "first-paid",
            "purchase_completed",
            { ...trial, value: 9.99, attempt_phase: "first_paid" },
            "paypal",
            true,
          ],
          ["direct", "purchase_completed", { value: 29.99 }, "stripe", true],
          [
            "unknown-session",
            "trial_started",
            { ...trial, funnel_session_id: crypto.randomUUID() },
            "stripe",
            true,
          ],
          [
            "malformed-session",
            "trial_started",
            { ...trial, funnel_session_id: "unknown" },
            "stripe",
            true,
          ],
          [
            "renewal",
            "purchase_completed",
            { value: 9.99, attempt_phase: "renewal" },
            "stripe",
            false,
          ],
          [
            "unclassified-trial-payment",
            "purchase_completed",
            { ...trial, value: 9.99 },
            "stripe",
            false,
          ],
          ["zero-purchase", "purchase_completed", { value: 0 }, "stripe", false],
          ["string-purchase", "purchase_completed", { value: "9.99" }, "stripe", false],
          ["negative-purchase", "purchase_completed", { value: -1 }, "stripe", false],
          [
            "no-authorization",
            "trial_started",
            { trial_analytics_version: 1, value: 0 },
            "stripe",
            false,
          ],
          [
            "bad-authorization",
            "trial_started",
            { ...trial, trial_authorized_at: "invalid" },
            "stripe",
            false,
          ],
          [
            "infinite-authorization",
            "trial_started",
            { ...trial, trial_authorized_at: "infinity" },
            "stripe",
            false,
          ],
          ["payment-event", "payment_completed", { value: 9.99 }, "stripe", false],
          [
            "payload-internal",
            "trial_started",
            { ...trial, is_internal_test: true },
            "stripe",
            false,
          ],
          ["payload-partner", "trial_started", { ...trial, test_kind: "partner" }, "stripe", false],
        ]
        for (const [key, name, payload, provider, eligible] of cases) {
          await sql(`SET ROLE service_role; ${event(key, name, payload, provider)}`)
          assert.equal(await count(key), eligible ? "1" : "0", key)
        }
        await sql(
          `SET ROLE service_role; ${event("stripe-trial")} ${event("late-old", "trial_started", trial, "stripe", `${quote(cutoff)}::timestamptz - interval '1 second'`)}`,
        )
        assert.equal(await count("stripe-trial"), "1")
        assert.equal(await count("late-old"), "0")
        // created_at uses transaction-start now(); a valid new fact can be committed
        // by a transaction that started before activation.
        await sql(`SET ROLE service_role; INSERT INTO billing_analytics_outbox(event_key,event_name,provider,payload,occurred_at,created_at)
          VALUES('older-transaction','trial_started','stripe',${quote(JSON.stringify(trial))}::jsonb,clock_timestamp(),${quote(cutoff)}::timestamptz-interval '1 second')`)
        assert.equal(await count("older-transaction"), "1")
        await sql(
          "SET ROLE service_role; INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'slack' FROM billing_analytics_outbox WHERE event_key IN ('historical','late-old','renewal')",
        )
        for (const key of ["historical", "late-old", "renewal"]) assert.equal(await count(key), "0")
      },
    )
    await t.test(
      "canonical funnel and frozen trial context exclude known tests without marketing requirement",
      async () => {
        for (const [index, flags] of [
          "true,NULL",
          "false,'field_test'",
          "false,'partner'",
        ].entries()) {
          const session = crypto.randomUUID(),
            enrollment = crypto.randomUUID()
          await sql(`INSERT INTO funnel_sessions VALUES('${session}',${flags});
        INSERT INTO private.trial_analytics_contexts VALUES('${enrollment}',false,'{"funnel_session_id":"${session}"}');
        SET ROLE service_role;
        ${event(`canonical-${index}`, "purchase_completed", { value: 10, funnel_session_id: session })}
        ${event(`frozen-${index}`, "trial_started", { ...trial, trial_enrollment_id: enrollment })}`)
          assert.equal(await count(`canonical-${index}`), "0")
          assert.equal(await count(`frozen-${index}`), "0")
        }
        const enrollment = crypto.randomUUID()
        await sql(
          `INSERT INTO private.trial_analytics_contexts VALUES('${enrollment}',false,'{"is_internal_test":true}'); SET ROLE service_role; ${event("frozen-marker", "trial_started", { ...trial, trial_enrollment_id: enrollment })}`,
        )
        assert.equal(await count("frozen-marker"), "0")
      },
    )
    await t.test(
      "pause leaves queue intact; resume catches up after original cutoff; repair bounded oldest first",
      async () => {
        const before = await sql(
          "SELECT count(*) FROM billing_analytics_deliveries WHERE destination='slack'",
        )
        await sql(
          "SET ROLE service_role; SELECT public.configure_slack_growth_notifications(false)",
        )
        await sql(`SET ROLE service_role; ${event("paused-one")} ${event("paused-two")}`)
        assert.equal(
          await sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries()"),
          "0",
        )
        assert.equal(
          await sql("SELECT count(*) FROM billing_analytics_deliveries WHERE destination='slack'"),
          before,
        )
        assert.equal(
          JSON.parse(
            await sql(
              "SET ROLE service_role; SELECT public.configure_slack_growth_notifications(true)",
            ),
          ).enabled_at,
          cutoff,
        )
        assert.equal(
          await sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries(1)"),
          "1",
        )
        assert.equal(await count("paused-one"), "1")
        assert.equal(await count("paused-two"), "0")
        assert.equal(
          await sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries(1)"),
          "1",
        )
        assert.equal(
          await sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries(1)"),
          "0",
        )
      },
    )
    await t.test(
      "optional enqueue failure preserves billing and is repaired; concurrent reconciliation deduplicates",
      async () => {
        let warnings = ""
        await sql(
          `CREATE FUNCTION private.fail_slack_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.destination='slack' THEN RAISE EXCEPTION 'secret payload must not be logged'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_slack_test BEFORE INSERT ON billing_analytics_deliveries FOR EACH ROW EXECUTE FUNCTION private.fail_slack_test();
      SET ROLE service_role; ${event("repair-one")} ${event("repair-two")}`,
          (text) => {
            warnings += text
          },
        )
        assert.match(warnings, /Slack growth delivery could not be queued; reconciliation required/)
        assert.doesNotMatch(warnings, /secret payload must not be logged/)
        assert.equal(
          await sql(
            "SELECT count(*) FROM billing_analytics_outbox WHERE event_key LIKE 'repair-%'",
          ),
          "2",
        )
        assert.equal(await count("repair-one"), "0")
        await sql("DROP TRIGGER fail_slack_test ON billing_analytics_deliveries")
        const results = await Promise.all([
          sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries(100)"),
          sql("SET ROLE service_role; SELECT public.reconcile_slack_growth_deliveries(100)"),
        ])
        assert.equal(
          results.reduce((total, value) => total + Number(value), 0),
          2,
        )
        assert.equal(await count("repair-one"), "1")
        assert.equal(await count("repair-two"), "1")
      },
    )
    await t.test("existing trial guard branches and other destinations are preserved", async () => {
      await sql(`SET ROLE service_role;
      INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'posthog' FROM billing_analytics_outbox WHERE event_key='stripe-trial';
      INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'customerio' FROM billing_analytics_outbox WHERE event_key='stripe-trial';
      INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'customerio' FROM billing_analytics_outbox WHERE event_key='first-paid';
      INSERT INTO billing_analytics_deliveries(outbox_id,destination) SELECT id,'meta' FROM billing_analytics_outbox WHERE event_key='direct';`)
      assert.equal(
        await sql(
          "SELECT string_agg(e.event_key||':'||d.destination,',' ORDER BY e.event_key,d.destination) FROM billing_analytics_deliveries d JOIN billing_analytics_outbox e ON e.id=d.outbox_id WHERE d.destination IN ('posthog','customerio','meta')",
        ),
        "direct:meta,first-paid:customerio,stripe-trial:posthog",
      )
    })
  },
)
