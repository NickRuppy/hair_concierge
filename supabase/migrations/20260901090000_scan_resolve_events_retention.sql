-- 90-day retention for the scan attempt log (public-launch ruling): user_id is
-- anonymized automatically after 90 days rather than deleted outright, since
-- the miss-ranking (docs/scan-attempt-log.md) and field-test debugging trail
-- stay useful without the identifying column. Account deletion already
-- cascades via the auth.users FK (migration 20260821120000_scan_resolve_events.sql),
-- so this only covers the steady-state background anonymization.

-- The anonymize UPDATE below sets user_id to NULL, which the original NOT NULL
-- constraint would reject. Relax it here; ON DELETE CASCADE on the FK still
-- applies to any row that still carries a user_id.
ALTER TABLE public.scan_resolve_events ALTER COLUMN user_id DROP NOT NULL;

-- pg_cron must be installed in pg_catalog on Supabase (installing it into the
-- shared "extensions" schema errors); its jobs live in the separate "cron"
-- schema regardless of install schema.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Idempotent (re-)schedule: drop any existing job of this name, then schedule
-- fresh, so re-running this migration (or a future migration editing the
-- schedule/command) never leaves a duplicate or stale job behind.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scan_resolve_events_anonymize') THEN
    PERFORM cron.unschedule('scan_resolve_events_anonymize');
  END IF;
END
$$;

SELECT cron.schedule(
  'scan_resolve_events_anonymize',
  '0 3 * * *',
  $cron$UPDATE public.scan_resolve_events SET user_id = NULL WHERE user_id IS NOT NULL AND created_at < now() - interval '90 days';$cron$
);
