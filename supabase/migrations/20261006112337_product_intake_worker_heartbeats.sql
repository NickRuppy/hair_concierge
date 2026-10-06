CREATE TABLE IF NOT EXISTS public.product_intake_worker_heartbeats (
  worker_id text PRIMARY KEY,
  host text NOT NULL,
  pid integer NOT NULL,
  release_sha text,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  current_job_id uuid
);

ALTER TABLE public.product_intake_worker_heartbeats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_intake_worker_heartbeats FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.product_intake_worker_heartbeats TO service_role;

CREATE OR REPLACE FUNCTION public.product_intake_record_worker_heartbeat(
  worker_id text,
  host text,
  pid integer,
  release_sha text,
  current_job_id uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.product_intake_worker_heartbeats
    (worker_id, host, pid, release_sha, started_at, last_seen_at, current_job_id)
  VALUES ($1, $2, $3, $4, now(), now(), $5)
  ON CONFLICT (worker_id) DO UPDATE
  SET host = EXCLUDED.host,
      pid = EXCLUDED.pid,
      release_sha = EXCLUDED.release_sha,
      last_seen_at = EXCLUDED.last_seen_at,
      current_job_id = EXCLUDED.current_job_id;
$$;

CREATE OR REPLACE FUNCTION public.product_intake_renew_research_job_lease(
  target_job_id uuid,
  expected_locked_by text
) RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.product_intake_research_jobs
  SET locked_at = now()
  WHERE id = $1 AND status = 'running' AND locked_by = $2
  RETURNING locked_at;
$$;

REVOKE ALL ON FUNCTION public.product_intake_record_worker_heartbeat(text, text, integer, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_renew_research_job_lease(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_record_worker_heartbeat(text, text, integer, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_renew_research_job_lease(uuid, text)
  TO service_role;
