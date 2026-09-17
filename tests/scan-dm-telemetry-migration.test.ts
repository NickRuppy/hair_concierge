import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260917062353_scan_dm_lookup_telemetry.sql",
)

function migration() {
  return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase()
}

test("adds bounded resolve telemetry and private submit telemetry", () => {
  const sql = migration()

  for (const field of [
    "dm_lookup_outcome text",
    "dm_lookup_duration_ms integer",
    "dm_lookup_deadline_ms integer",
  ]) {
    assert.match(sql, new RegExp(field.replace(/ /g, "\\s+")))
  }
  for (const outcome of [
    "disabled",
    "hit",
    "not_found",
    "timeout",
    "session_expired",
    "transport",
    "malformed",
    "gtin_mismatch",
    "unexpected",
    "invalid_gtin",
  ]) {
    assert.match(sql, new RegExp(`dm_lookup_outcome[^;]*'${outcome}'`))
  }
  assert.match(sql, /create table if not exists public\.scan_submit_dm_lookup_events/)
  const submitDefinition = sql.slice(
    sql.indexOf("create table if not exists public.scan_submit_dm_lookup_events"),
    sql.indexOf("alter table public.scan_submit_dm_lookup_events enable row level security"),
  )
  assert.doesNotMatch(
    submitDefinition,
    /\buser_id\b|\bgtin\b|\bbarcode\b|\bname\b|\bsubmission_id\b|\bpayload\b/,
  )
})

test("adds a privacy-safe daily aggregate before deleting either dm raw source", () => {
  const sql = migration()

  assert.match(sql, /create table if not exists public\.scan_dm_lookup_daily_aggregates/)
  for (const field of [
    "day date",
    "route text",
    "outcome text",
    "deadline_ms integer",
    "latency_bucket text",
    "event_count bigint",
    "duration_sum_ms bigint",
  ]) {
    assert.match(sql, new RegExp(field.replace(/ /g, "\\s+")))
  }
  const rollup = sql.indexOf("insert into public.scan_dm_lookup_daily_aggregates")
  const resolveDelete = sql.indexOf("delete from public.scan_resolve_events")
  const submitDelete = sql.indexOf("delete from public.scan_submit_dm_lookup_events")
  assert.ok(rollup >= 0, "retention must roll up dm raw events")
  assert.ok(resolveDelete > rollup, "resolve raw deletion follows dm rollup")
  assert.ok(submitDelete > rollup, "submit raw deletion follows dm rollup")
  assert.match(sql, /on conflict \(day, route, outcome, deadline_ms, latency_bucket\) do update/)
  assert.match(sql, /event_count = excluded\.event_count/)
  assert.match(sql, /duration_sum_ms = excluded\.duration_sum_ms/)
})

test("keeps both new relations service-role-only and preserves the invoker retention boundary", () => {
  const sql = migration()

  for (const table of ["scan_submit_dm_lookup_events", "scan_dm_lookup_daily_aggregates"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`),
    )
    assert.match(sql, new RegExp(`grant all on table public\\.${table} to service_role`))
  }
  assert.match(
    sql,
    /create or replace function private\.run_scan_resolve_retention\(\)[\s\S]*security invoker[\s\S]*set search_path = pg_catalog, public/,
  )
})

test("migration rolls up each source exactly once across two retention runs and preserves the 30-day boundary", async (t) => {
  const pg = new PGlite()
  t.after(async () => pg.close())

  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA private TO authenticated;
    CREATE SCHEMA cron;
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
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      identifier_type text NOT NULL,
      raw_value text NOT NULL,
      canonical_value text,
      outcome text,
      lookup_outcome text,
      terminal_outcome text,
      failure_stage text,
      completed_at timestamptz,
      matched_product_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_resolve_daily_aggregates (
      day date NOT NULL,
      canonical_gtin text NOT NULL,
      lookup_outcome text NOT NULL,
      terminal_outcome text NOT NULL,
      failure_stage text NOT NULL,
      attempt_count bigint NOT NULL,
      completed_count bigint NOT NULL,
      incomplete_count bigint NOT NULL,
      distinct_user_count bigint NOT NULL,
      PRIMARY KEY (day, canonical_gtin, lookup_outcome, terminal_outcome, failure_stage)
    );
  `)

  await pg.exec(readFileSync(migrationPath, "utf8"))
  await pg.exec(`
    INSERT INTO public.scan_resolve_events (
      user_id, identifier_type, raw_value, canonical_value, outcome, lookup_outcome,
      terminal_outcome, failure_stage, completed_at, created_at,
      dm_lookup_outcome, dm_lookup_duration_ms, dm_lookup_deadline_ms
    ) VALUES
      ('11111111-1111-4111-8111-111111111111', 'ean', 'old', 'old', 'miss', 'miss',
       'unknown_product', NULL, now(), now() - interval '31 days',
       'hit', 420, 1500),
      ('22222222-2222-4222-8222-222222222222', 'ean', 'boundary', 'boundary', 'miss', 'miss',
       'unknown_product', NULL, now(), ((now() at time zone 'UTC')::date - 30)::timestamp at time zone 'UTC',
       'timeout', 1500, 1500);
    INSERT INTO public.scan_submit_dm_lookup_events (
      created_at, outcome, duration_ms, deadline_ms
    ) VALUES
      (now() - interval '31 days', 'disabled', NULL, NULL),
      (((now() at time zone 'UTC')::date - 30)::timestamp at time zone 'UTC', 'hit', 251, 1500);
    SELECT private.run_scan_resolve_retention();
    SELECT private.run_scan_resolve_retention();
  `)

  const aggregate = await pg.query<{
    route: string
    outcome: string
    latency_bucket: string
    count: number
    duration: number
  }>(`
    SELECT route, outcome, latency_bucket, event_count::integer AS count, duration_sum_ms::integer AS duration
    FROM public.scan_dm_lookup_daily_aggregates
    ORDER BY route, outcome
  `)
  assert.deepEqual(aggregate.rows, [
    { route: "resolve", outcome: "hit", latency_bucket: "250_499", count: 1, duration: 420 },
    { route: "submit", outcome: "disabled", latency_bucket: "not_called", count: 1, duration: 0 },
  ])

  const raw = await pg.query<{ source: string; count: number }>(`
    SELECT 'resolve' AS source, count(*)::integer AS count FROM public.scan_resolve_events
    UNION ALL
    SELECT 'submit' AS source, count(*)::integer AS count FROM public.scan_submit_dm_lookup_events
    ORDER BY source
  `)
  assert.deepEqual(raw.rows, [
    { source: "resolve", count: 1 },
    { source: "submit", count: 1 },
  ])
})
