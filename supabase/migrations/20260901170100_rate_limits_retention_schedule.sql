-- Short preparation windows create more expired limiter rows than the previous
-- hour-long bucket. Remove all expired windows regularly so request identifiers
-- are retained only for the short operational period they serve.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_rate_limits') THEN
    PERFORM cron.unschedule('cleanup_expired_rate_limits');
  END IF;
END
$$;

SELECT cron.schedule(
  'cleanup_expired_rate_limits',
  '*/5 * * * *',
  $cron$SELECT public.cleanup_expired_rate_limits();$cron$
);
