-- Phase 1 scanner telemetry: retain the legacy lookup outcome during the
-- dual-write rollout, while adding a terminal outcome that says whether a
-- response was actually completed for the user.
ALTER TABLE public.scan_resolve_events
  ADD COLUMN IF NOT EXISTS telemetry_version smallint,
  ADD COLUMN IF NOT EXISTS lookup_outcome text,
  ADD COLUMN IF NOT EXISTS terminal_outcome text,
  ADD COLUMN IF NOT EXISTS failure_stage text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- A v2 attempt is inserted before lookup starts. Preserve the legacy outcome
-- check constraint, but permit NULL until the terminal update dual-writes it.
ALTER TABLE public.scan_resolve_events
  ALTER COLUMN outcome DROP NOT NULL;

ALTER TABLE public.scan_resolve_events
  DROP CONSTRAINT IF EXISTS scan_resolve_events_lookup_outcome_check,
  ADD CONSTRAINT scan_resolve_events_lookup_outcome_check
    CHECK (
      lookup_outcome IS NULL
      OR lookup_outcome IN ('invalid', 'hit', 'miss', 'quarantined')
    ),
  DROP CONSTRAINT IF EXISTS scan_resolve_events_terminal_outcome_check,
  ADD CONSTRAINT scan_resolve_events_terminal_outcome_check
    CHECK (
      terminal_outcome IS NULL
      OR terminal_outcome IN (
        'resolved',
        'unknown_product',
        'pending_submission',
        'invalid_identifier',
        'profile_ineligible',
        'temporarily_unavailable',
        'legacy_unknown'
      )
    ),
  DROP CONSTRAINT IF EXISTS scan_resolve_events_failure_stage_check,
  ADD CONSTRAINT scan_resolve_events_failure_stage_check
    CHECK (
      failure_stage IS NULL
      OR failure_stage IN (
        'identifier_lookup',
        'quarantine_lookup',
        'submission_lookup',
        'profile_context',
        'decision',
        'product_facts',
        'verdict',
        'post_verdict_load',
        'alternative_filter',
        'response_build'
      )
    );

-- Every row that predates these columns records only a lookup result. The
-- table can continue receiving legitimate v1 rows until this migration lands,
-- so classify the complete legacy set by shape instead of pinning a row count.
-- None may be reclassified as a proven successful response.
UPDATE public.scan_resolve_events
   SET telemetry_version = 1,
       terminal_outcome = 'legacy_unknown'
 WHERE telemetry_version IS NULL
   AND terminal_outcome IS NULL;

ALTER TABLE public.scan_resolve_events
  ALTER COLUMN telemetry_version SET DEFAULT 2,
  ALTER COLUMN telemetry_version SET NOT NULL;

-- Reassert the original raw-event boundary while this migration changes the
-- table. No browser role can read or write either raw events or aggregates.
ALTER TABLE public.scan_resolve_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_resolve_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.scan_resolve_events TO service_role;

-- Long-lived reporting is intentionally aggregate-only: no raw identifier,
-- user, or product reference leaves the 30-day operational event window.
CREATE TABLE IF NOT EXISTS public.scan_resolve_daily_aggregates (
  day date NOT NULL,
  canonical_gtin text NOT NULL,
  lookup_outcome text NOT NULL,
  terminal_outcome text NOT NULL,
  failure_stage text NOT NULL,
  attempt_count bigint NOT NULL CHECK (attempt_count >= 0),
  completed_count bigint NOT NULL CHECK (completed_count >= 0),
  incomplete_count bigint NOT NULL CHECK (incomplete_count >= 0),
  distinct_user_count bigint NOT NULL CHECK (distinct_user_count >= 0),
  PRIMARY KEY (day, canonical_gtin, lookup_outcome, terminal_outcome, failure_stage),
  CHECK (completed_count + incomplete_count = attempt_count)
);

ALTER TABLE public.scan_resolve_daily_aggregates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_resolve_daily_aggregates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.scan_resolve_daily_aggregates TO service_role;

DROP POLICY IF EXISTS scan_resolve_daily_aggregates_service_role_all
  ON public.scan_resolve_daily_aggregates;
CREATE POLICY scan_resolve_daily_aggregates_service_role_all
  ON public.scan_resolve_daily_aggregates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- This routine is deliberately SECURITY INVOKER. The cron owner or an
-- explicitly granted service role performs the retention work; it is not an
-- RPC surface and has a fixed path to avoid search-path hijacking.
CREATE OR REPLACE FUNCTION private.run_scan_resolve_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  raw_cutoff_day date;
  aggregate_cutoff_day date;
BEGIN
  -- UTC whole-day boundary: preserve the most recent 30 complete calendar days.
  raw_cutoff_day := (pg_catalog.now() AT TIME ZONE 'UTC')::date - 30;
  aggregate_cutoff_day := ((pg_catalog.now() AT TIME ZONE 'UTC')::date - INTERVAL '12 months')::date;

  -- Upsert first, then delete. Re-running after an interrupted invocation
  -- writes the same daily bucket and is therefore idempotent.
  INSERT INTO public.scan_resolve_daily_aggregates (
    day,
    canonical_gtin,
    lookup_outcome,
    terminal_outcome,
    failure_stage,
    attempt_count,
    completed_count,
    incomplete_count,
    distinct_user_count
  )
  SELECT
    (event.created_at AT TIME ZONE 'UTC')::date,
    coalesce(event.canonical_value, '__no_canonical_gtin__'),
    coalesce(event.lookup_outcome, 'legacy_unknown'),
    coalesce(event.terminal_outcome, 'legacy_unknown'),
    coalesce(event.failure_stage, 'none'),
    pg_catalog.count(*),
    pg_catalog.count(*) FILTER (WHERE event.completed_at IS NOT NULL),
    pg_catalog.count(*) FILTER (WHERE event.completed_at IS NULL),
    pg_catalog.count(DISTINCT event.user_id)
  FROM public.scan_resolve_events AS event
  WHERE event.created_at < (raw_cutoff_day::timestamp AT TIME ZONE 'UTC')
  GROUP BY 1, 2, 3, 4, 5
  ON CONFLICT (day, canonical_gtin, lookup_outcome, terminal_outcome, failure_stage)
  DO UPDATE SET
    attempt_count = EXCLUDED.attempt_count,
    completed_count = EXCLUDED.completed_count,
    incomplete_count = EXCLUDED.incomplete_count,
    distinct_user_count = EXCLUDED.distinct_user_count;

  DELETE FROM public.scan_resolve_events
  WHERE created_at < (raw_cutoff_day::timestamp AT TIME ZONE 'UTC');

  DELETE FROM public.scan_resolve_daily_aggregates
  WHERE day < aggregate_cutoff_day;

  -- pg_cron does not clean its run history itself. Limit only this job's
  -- operational history, never every scheduled job in the project.
  DELETE FROM cron.job_run_details AS run
  USING cron.job AS job
  WHERE run.jobid = job.jobid
    AND job.jobname = 'scan-resolve-retention-daily-v1'
    AND run.start_time < pg_catalog.now() - INTERVAL '30 days';
END;
$$;

REVOKE ALL ON FUNCTION private.run_scan_resolve_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.run_scan_resolve_retention() TO service_role;

-- Same-name cron.schedule is an upsert, so this stable job can be reapplied
-- safely without duplicate daily retention jobs.
SELECT cron.schedule(
  'scan-resolve-retention-daily-v1',
  '15 3 * * *',
  $$SELECT private.run_scan_resolve_retention()$$
);
