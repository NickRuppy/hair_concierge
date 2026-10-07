import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const enabled = process.env.SCAN_DM_TELEMETRY_POSTGRES_TEST === "1"
const migrationPath = "supabase/migrations/20260917062353_scan_dm_lookup_telemetry.sql"

function command(args: string[], input?: string): Promise<string> {
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

test(
  "dm telemetry migration: real PostgreSQL RLS, grants, and two-run retention",
  { skip: !enabled, timeout: 120_000 },
  async (t) => {
    const container = `chaarlie-dm-telemetry-${crypto.randomUUID()}`
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
    t.after(() => command(["rm", "--force", container]))

    for (let attempt = 0; ; attempt++) {
      try {
        await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])
        break
      } catch (error) {
        if (attempt === 99) throw error
        await setTimeout(100)
      }
    }

    const sql = (statement: string) =>
      command(
        ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
        statement,
      )
    await sql(`
      CREATE EXTENSION pgcrypto;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA private; CREATE SCHEMA cron;
      CREATE TABLE cron.job (jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, jobname text UNIQUE, schedule text, command text);
      CREATE TABLE cron.job_run_details (jobid bigint NOT NULL, start_time timestamptz NOT NULL DEFAULT now());
      CREATE FUNCTION cron.schedule(p_name text, p_schedule text, p_command text)
      RETURNS bigint LANGUAGE plpgsql AS $$
      DECLARE result bigint;
      BEGIN
        INSERT INTO cron.job(jobname, schedule, command) VALUES (p_name, p_schedule, p_command)
        ON CONFLICT (jobname) DO UPDATE SET schedule = excluded.schedule, command = excluded.command
        RETURNING jobid INTO result;
        RETURN result;
      END;
      $$;
      CREATE TABLE public.scan_resolve_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, identifier_type text NOT NULL,
        raw_value text NOT NULL, canonical_value text, outcome text, lookup_outcome text,
        terminal_outcome text, failure_stage text, completed_at timestamptz,
        matched_product_id uuid, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.scan_resolve_daily_aggregates (
        day date NOT NULL, canonical_gtin text NOT NULL, lookup_outcome text NOT NULL,
        terminal_outcome text NOT NULL, failure_stage text NOT NULL, attempt_count bigint NOT NULL,
        completed_count bigint NOT NULL, incomplete_count bigint NOT NULL, distinct_user_count bigint NOT NULL,
        PRIMARY KEY(day, canonical_gtin, lookup_outcome, terminal_outcome, failure_stage)
      );
    `)
    await sql(readFileSync(migrationPath, "utf8"))
    await sql(`
      INSERT INTO public.scan_resolve_events (
        user_id, identifier_type, raw_value, outcome, created_at,
        dm_lookup_outcome, dm_lookup_duration_ms, dm_lookup_deadline_ms
      ) VALUES (
        '11111111-1111-4111-8111-111111111111', 'ean', 'private-test', 'miss',
        now() - interval '31 days', 'hit', 420, 1500
      );
      INSERT INTO public.scan_submit_dm_lookup_events(created_at, outcome, duration_ms, deadline_ms)
      VALUES (now() - interval '31 days', 'timeout', 1500, 1500);
      SELECT private.run_scan_resolve_retention();
      SELECT private.run_scan_resolve_retention();
    `)

    assert.equal(
      await sql(
        `SELECT has_table_privilege('anon', 'public.scan_submit_dm_lookup_events', 'SELECT')`,
      ),
      "f",
    )
    assert.equal(
      await sql(
        `SELECT has_table_privilege('authenticated', 'public.scan_dm_lookup_daily_aggregates', 'SELECT')`,
      ),
      "f",
    )
    assert.equal(
      await sql(
        `SELECT has_table_privilege('service_role', 'public.scan_submit_dm_lookup_events', 'INSERT')`,
      ),
      "t",
    )
    assert.equal(
      await sql(`SELECT sum(event_count)::integer FROM public.scan_dm_lookup_daily_aggregates`),
      "2",
    )
    assert.equal(await sql(`SELECT count(*) FROM public.scan_submit_dm_lookup_events`), "0")
  },
)
