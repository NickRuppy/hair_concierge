import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260826093828_scan_resolve_terminal_telemetry_expand.sql",
)

function migration() {
  return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase()
}

test("adds nullable v2 terminal telemetry without changing the legacy outcome contract", () => {
  const sql = migration()

  assert.match(sql, /alter column outcome drop not null/)
  assert.match(sql, /add column if not exists telemetry_version smallint/)
  assert.match(sql, /alter column telemetry_version set default 2/)
  assert.match(sql, /add column if not exists lookup_outcome text/)
  assert.match(sql, /add column if not exists terminal_outcome text/)
  assert.match(sql, /add column if not exists failure_stage text/)
  assert.match(sql, /add column if not exists completed_at timestamptz/)
  for (const value of ["invalid", "hit", "miss", "quarantined"]) {
    assert.match(sql, new RegExp(`lookup_outcome[^;]*'${value}'`))
  }
  for (const value of [
    "resolved",
    "verdict_unknown",
    "unknown_product",
    "pending_submission",
    "invalid_identifier",
    "profile_ineligible",
    "temporarily_unavailable",
    "legacy_unknown",
  ]) {
    assert.match(sql, new RegExp(`terminal_outcome[^;]*'${value}'`))
  }
  for (const value of [
    "identifier_lookup",
    "quarantine_lookup",
    "submission_lookup",
    "profile_context",
    "decision",
    "product_facts",
    "verdict",
    "post_verdict_load",
    "alternative_filter",
    "response_build",
  ]) {
    assert.match(sql, new RegExp(`failure_stage[^;]*'${value}'`))
  }
  assert.doesNotMatch(sql, /drop column[^;]*outcome/)
  assert.doesNotMatch(sql, /drop constraint[^;]*scan_resolve_events_outcome_check/)
})

test("backfills every legacy event as terminal-unknown, never as a proven resolution", () => {
  const sql = migration()

  assert.match(
    sql,
    /update public\.scan_resolve_events[\s\S]*set telemetry_version = 1,[\s\S]*terminal_outcome = 'legacy_unknown'/,
  )
  assert.doesNotMatch(sql, /terminal_outcome\s*=\s*'resolved'[\s\S]{0,250}legacy/)
})

test("materializes only non-PII aggregates before raw data deletion and remains idempotent", () => {
  const sql = migration()

  assert.match(sql, /create table if not exists public\.scan_resolve_daily_aggregates/)
  for (const field of [
    "day date",
    "canonical_gtin text",
    "lookup_outcome text",
    "terminal_outcome text",
    "failure_stage text",
    "attempt_count bigint",
    "completed_count bigint",
    "incomplete_count bigint",
    "distinct_user_count bigint",
  ]) {
    assert.match(sql, new RegExp(field.replace(/ /g, "\\s+")))
  }
  const aggregateInsert = sql.indexOf("insert into public.scan_resolve_daily_aggregates")
  const rawDelete = sql.indexOf("delete from public.scan_resolve_events")
  assert.ok(aggregateInsert >= 0, "retention must aggregate raw terminal events")
  assert.ok(rawDelete > aggregateInsert, "raw deletion must follow aggregate upsert")
  assert.match(
    sql,
    /on conflict \(day, canonical_gtin, lookup_outcome, terminal_outcome, failure_stage\) do update/,
  )
  const aggregateDefinition = sql.slice(
    sql.indexOf("create table if not exists public.scan_resolve_daily_aggregates"),
    sql.indexOf("alter table public.scan_resolve_daily_aggregates enable row level security"),
  )
  assert.doesNotMatch(aggregateDefinition, /raw_value|user_id|matched_product_id/)
})

test("keeps telemetry service-role-only, with bounded UTC retention and a stable daily cron job", () => {
  const sql = migration()

  assert.match(sql, /alter table public\.scan_resolve_daily_aggregates enable row level security/)
  assert.match(
    sql,
    /revoke all on table public\.scan_resolve_events from public, anon, authenticated/,
  )
  assert.match(sql, /grant all on table public\.scan_resolve_events to service_role/)
  assert.match(
    sql,
    /revoke all on table public\.scan_resolve_daily_aggregates from public, anon, authenticated/,
  )
  assert.match(sql, /grant all on table public\.scan_resolve_daily_aggregates to service_role/)
  assert.match(
    sql,
    /create or replace function private\.run_scan_resolve_retention\(\)[\s\S]*security invoker[\s\S]*set search_path = pg_catalog, public/,
  )
  assert.doesNotMatch(sql, /pg_catalog\.coalesce/)
  assert.doesNotMatch(sql, /revoke all on schema private/)
  assert.match(sql, /grant usage on schema private to service_role/)
  assert.match(
    sql,
    /revoke all on function private\.run_scan_resolve_retention\(\) from public, anon, authenticated/,
  )
  assert.match(
    sql,
    /grant execute on function private\.run_scan_resolve_retention\(\) to service_role/,
  )
  assert.match(sql, /at time zone 'utc'\)\s*::date\s*-\s*30/)
  assert.match(sql, /raw_cutoff_day::timestamp\s+at time zone 'utc'/)
  assert.match(sql, /interval '12 months'/)
  assert.match(sql, /cron\.job_run_details/)
  assert.match(sql, /cron\.schedule\(\s*'scan-resolve-retention-daily-v1',\s*'15 3 \* \* \*'/)
})

test("telemetry migration executes, accepts v2 starts, and aggregates before retention deletion", async (t) => {
  const pg = new PGlite()
  t.after(async () => pg.close())

  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA private TO authenticated;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job (
      jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      jobname text NOT NULL UNIQUE,
      schedule text NOT NULL,
      command text NOT NULL
    );
    CREATE TABLE cron.job_run_details (
      jobid bigint NOT NULL,
      start_time timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION cron.schedule(p_name text, p_schedule text, p_command text)
    RETURNS bigint LANGUAGE plpgsql AS $$
    DECLARE v_jobid bigint;
    BEGIN
      INSERT INTO cron.job (jobname, schedule, command)
      VALUES (p_name, p_schedule, p_command)
      ON CONFLICT (jobname) DO UPDATE
        SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
      RETURNING jobid INTO v_jobid;
      RETURN v_jobid;
    END;
    $$;

    CREATE TABLE public.scan_resolve_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      identifier_type text NOT NULL,
      raw_value text NOT NULL,
      canonical_value text,
      outcome text NOT NULL CHECK (
        outcome IN ('hit', 'miss', 'pending_submission', 'quarantined', 'invalid')
      ),
      matched_product_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO public.scan_resolve_events (
      user_id, identifier_type, raw_value, canonical_value, outcome, created_at
    )
    SELECT
      '11111111-1111-4111-8111-111111111111',
      'ean',
      '4006381333931',
      '04006381333931',
      CASE WHEN value <= 2 THEN 'hit' ELSE 'miss' END,
      now() - interval '31 days'
    FROM generate_series(1, 10) AS value;
  `)

  await pg.exec(readFileSync(migrationPath, "utf8"))

  const authenticatedSchemaAccess = await pg.query<{ allowed: boolean }>(`
    SELECT has_schema_privilege('authenticated', 'private', 'USAGE') AS allowed
  `)
  assert.equal(authenticatedSchemaAccess.rows[0]?.allowed, true)
  const retentionPrivileges = await pg.query<{
    authenticated: boolean
    anon: boolean
    service_role: boolean
  }>(`
    SELECT
      has_function_privilege(
        'authenticated', 'private.run_scan_resolve_retention()', 'EXECUTE'
      ) AS authenticated,
      has_function_privilege('anon', 'private.run_scan_resolve_retention()', 'EXECUTE') AS anon,
      has_function_privilege(
        'service_role', 'private.run_scan_resolve_retention()', 'EXECUTE'
      ) AS service_role
  `)
  assert.deepEqual(retentionPrivileges.rows[0], {
    authenticated: false,
    anon: false,
    service_role: true,
  })

  const legacy = await pg.query<{ count: number }>(`
    SELECT count(*)::integer AS count
    FROM public.scan_resolve_events
    WHERE telemetry_version = 1 AND terminal_outcome = 'legacy_unknown'
  `)
  assert.equal(legacy.rows[0]?.count, 10)

  await pg.exec(`
    INSERT INTO public.scan_resolve_events (
      user_id, identifier_type, raw_value, canonical_value, outcome
    ) VALUES (
      '22222222-2222-4222-8222-222222222222',
      'ean',
      '40170725',
      '00000040170725',
      NULL
    );
  `)

  await pg.exec(readFileSync(migrationPath, "utf8"))

  const inFlight = await pg.query<{ telemetry_version: number; terminal_outcome: string | null }>(`
    SELECT telemetry_version, terminal_outcome
    FROM public.scan_resolve_events
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
  `)
  assert.deepEqual(inFlight.rows[0], { telemetry_version: 2, terminal_outcome: null })

  await pg.exec(`
    SELECT private.run_scan_resolve_retention();
    SELECT private.run_scan_resolve_retention();
  `)

  const raw = await pg.query<{ count: number }>(
    "SELECT count(*)::integer AS count FROM public.scan_resolve_events",
  )
  assert.equal(raw.rows[0]?.count, 1)
  const aggregate = await pg.query<{ attempts: number }>(`
    SELECT sum(attempt_count)::integer AS attempts
    FROM public.scan_resolve_daily_aggregates
  `)
  assert.equal(aggregate.rows[0]?.attempts, 10)
})
