-- dm lookup telemetry is intentionally separate from product intake: raw
-- resolve rows retain their existing scanner semantics, while submit lookups
-- carry no person, barcode, product, payload, or submission reference.
ALTER TABLE public.scan_resolve_events
  ADD COLUMN IF NOT EXISTS dm_lookup_outcome text,
  ADD COLUMN IF NOT EXISTS dm_lookup_duration_ms integer,
  ADD COLUMN IF NOT EXISTS dm_lookup_deadline_ms integer;

ALTER TABLE public.scan_resolve_events
  DROP CONSTRAINT IF EXISTS scan_resolve_events_dm_lookup_outcome_check,
  ADD CONSTRAINT scan_resolve_events_dm_lookup_outcome_check
    CHECK (
      dm_lookup_outcome IS NULL
      OR dm_lookup_outcome IN (
        'disabled', 'hit', 'not_found', 'timeout', 'session_expired',
        'transport', 'malformed', 'gtin_mismatch', 'unexpected', 'invalid_gtin'
      )
    ),
  DROP CONSTRAINT IF EXISTS scan_resolve_events_dm_lookup_duration_check,
  ADD CONSTRAINT scan_resolve_events_dm_lookup_duration_check
    CHECK (dm_lookup_duration_ms IS NULL OR dm_lookup_duration_ms >= 0),
  DROP CONSTRAINT IF EXISTS scan_resolve_events_dm_lookup_deadline_check,
  ADD CONSTRAINT scan_resolve_events_dm_lookup_deadline_check
    CHECK (dm_lookup_deadline_ms IS NULL OR dm_lookup_deadline_ms > 0),
  DROP CONSTRAINT IF EXISTS scan_resolve_events_dm_lookup_measurement_pair_check,
  ADD CONSTRAINT scan_resolve_events_dm_lookup_measurement_pair_check
    CHECK (
      (dm_lookup_duration_ms IS NULL AND dm_lookup_deadline_ms IS NULL)
      OR (dm_lookup_duration_ms IS NOT NULL AND dm_lookup_deadline_ms IS NOT NULL)
    );

-- A submit lookup cannot be joined to an individual, scan, or submission.
CREATE TABLE IF NOT EXISTS public.scan_submit_dm_lookup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (
    outcome IN (
      'disabled', 'hit', 'not_found', 'timeout', 'session_expired',
      'transport', 'malformed', 'gtin_mismatch', 'unexpected', 'invalid_gtin'
    )
  ),
  duration_ms integer,
  deadline_ms integer,
  CHECK (duration_ms IS NULL OR duration_ms >= 0),
  CHECK (deadline_ms IS NULL OR deadline_ms > 0),
  CHECK (
    (duration_ms IS NULL AND deadline_ms IS NULL)
    OR (duration_ms IS NOT NULL AND deadline_ms IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scan_submit_dm_lookup_events_created_at
  ON public.scan_submit_dm_lookup_events (created_at);

ALTER TABLE public.scan_submit_dm_lookup_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_submit_dm_lookup_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.scan_submit_dm_lookup_events TO service_role;

DROP POLICY IF EXISTS scan_submit_dm_lookup_events_service_role_all
  ON public.scan_submit_dm_lookup_events;
CREATE POLICY scan_submit_dm_lookup_events_service_role_all
  ON public.scan_submit_dm_lookup_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- deadline_ms = 0 represents no outbound dm operation. It keeps the primary
-- key deterministic for disabled/invalid rollups; not_called is its bucket.
CREATE TABLE IF NOT EXISTS public.scan_dm_lookup_daily_aggregates (
  day date NOT NULL,
  route text NOT NULL CHECK (route IN ('resolve', 'submit')),
  outcome text NOT NULL CHECK (
    outcome IN (
      'disabled', 'hit', 'not_found', 'timeout', 'session_expired',
      'transport', 'malformed', 'gtin_mismatch', 'unexpected', 'invalid_gtin'
    )
  ),
  deadline_ms integer NOT NULL CHECK (deadline_ms >= 0),
  latency_bucket text NOT NULL CHECK (
    latency_bucket IN (
      'not_called', '0_249', '250_499', '500_999', '1000_1499',
      '1500_1999', '2000_2999', '3000_4999', '5000_plus'
    )
  ),
  event_count bigint NOT NULL CHECK (event_count >= 0),
  duration_sum_ms bigint NOT NULL CHECK (duration_sum_ms >= 0),
  PRIMARY KEY (day, route, outcome, deadline_ms, latency_bucket)
);

ALTER TABLE public.scan_dm_lookup_daily_aggregates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_dm_lookup_daily_aggregates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.scan_dm_lookup_daily_aggregates TO service_role;

DROP POLICY IF EXISTS scan_dm_lookup_daily_aggregates_service_role_all
  ON public.scan_dm_lookup_daily_aggregates;
CREATE POLICY scan_dm_lookup_daily_aggregates_service_role_all
  ON public.scan_dm_lookup_daily_aggregates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Keep the established scanner aggregate unchanged, then add the dm-only
-- rollup before either raw source is deleted. A repeated run replaces exact
-- buckets instead of incrementing them.
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
  raw_cutoff_day := (pg_catalog.now() AT TIME ZONE 'UTC')::date - 30;
  aggregate_cutoff_day := ((pg_catalog.now() AT TIME ZONE 'UTC')::date - INTERVAL '12 months')::date;

  INSERT INTO public.scan_resolve_daily_aggregates (
    day, canonical_gtin, lookup_outcome, terminal_outcome, failure_stage,
    attempt_count, completed_count, incomplete_count, distinct_user_count
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

  WITH dm_events AS (
    SELECT
      (event.created_at AT TIME ZONE 'UTC')::date AS day,
      'resolve'::text AS route,
      event.dm_lookup_outcome AS outcome,
      event.dm_lookup_duration_ms AS duration_ms,
      event.dm_lookup_deadline_ms AS deadline_ms
    FROM public.scan_resolve_events AS event
    WHERE event.created_at < (raw_cutoff_day::timestamp AT TIME ZONE 'UTC')
      AND event.dm_lookup_outcome IS NOT NULL
    UNION ALL
    SELECT
      (event.created_at AT TIME ZONE 'UTC')::date,
      'submit'::text,
      event.outcome,
      event.duration_ms,
      event.deadline_ms
    FROM public.scan_submit_dm_lookup_events AS event
    WHERE event.created_at < (raw_cutoff_day::timestamp AT TIME ZONE 'UTC')
  )
  INSERT INTO public.scan_dm_lookup_daily_aggregates (
    day, route, outcome, deadline_ms, latency_bucket, event_count, duration_sum_ms
  )
  SELECT
    day,
    route,
    outcome,
    coalesce(deadline_ms, 0),
    CASE
      WHEN duration_ms IS NULL THEN 'not_called'
      WHEN duration_ms < 250 THEN '0_249'
      WHEN duration_ms < 500 THEN '250_499'
      WHEN duration_ms < 1000 THEN '500_999'
      WHEN duration_ms < 1500 THEN '1000_1499'
      WHEN duration_ms < 2000 THEN '1500_1999'
      WHEN duration_ms < 3000 THEN '2000_2999'
      WHEN duration_ms < 5000 THEN '3000_4999'
      ELSE '5000_plus'
    END,
    pg_catalog.count(*),
    coalesce(pg_catalog.sum(duration_ms), 0::bigint)
  FROM dm_events
  GROUP BY 1, 2, 3, 4, 5
  ON CONFLICT (day, route, outcome, deadline_ms, latency_bucket)
  DO UPDATE SET
    event_count = EXCLUDED.event_count,
    duration_sum_ms = EXCLUDED.duration_sum_ms;

  DELETE FROM public.scan_resolve_events
  WHERE created_at < (raw_cutoff_day::timestamp AT TIME ZONE 'UTC');

  DELETE FROM public.scan_submit_dm_lookup_events
  WHERE created_at < (raw_cutoff_day::timestamp AT TIME ZONE 'UTC');

  DELETE FROM public.scan_resolve_daily_aggregates
  WHERE day < aggregate_cutoff_day;

  DELETE FROM public.scan_dm_lookup_daily_aggregates
  WHERE day < aggregate_cutoff_day;

  DELETE FROM cron.job_run_details AS run
  USING cron.job AS job
  WHERE run.jobid = job.jobid
    AND job.jobname = 'scan-resolve-retention-daily-v1'
    AND run.start_time < pg_catalog.now() - INTERVAL '30 days';
END;
$$;

REVOKE ALL ON FUNCTION private.run_scan_resolve_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.run_scan_resolve_retention() TO service_role;
