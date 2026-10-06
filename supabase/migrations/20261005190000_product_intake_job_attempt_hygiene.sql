-- Attempts count claims within the current stage. Exhausted queue rows must
-- surface as failures, and closed submissions must not enter worker processing.

CREATE OR REPLACE FUNCTION public.product_intake_claim_research_jobs(
  worker_id text,
  claim_limit integer DEFAULT 2,
  stale_after interval DEFAULT interval '10 minutes'
)
RETURNS SETOF public.product_intake_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF worker_id IS NULL OR btrim(worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF claim_limit IS NULL OR claim_limit < 1 THEN
    RAISE EXCEPTION 'claim_limit must be at least 1'
      USING ERRCODE = '22023';
  END IF;

  IF stale_after IS NULL OR stale_after <= interval '0 seconds' THEN
    RAISE EXCEPTION 'stale_after must be positive'
      USING ERRCODE = '22023';
  END IF;

  -- Do not fail a running job's final permitted attempt while its lease is live.
  -- Exhaustion is final even if a queued row has a future next_run_at.
  WITH exhausted_jobs AS (
    SELECT jobs.id
    FROM public.product_intake_research_jobs AS jobs
    WHERE jobs.attempt_count >= jobs.max_attempts
      AND (
        jobs.status IN ('queued', 'waiting_for_rework')
        OR (
          jobs.status = 'running'
          AND (
            jobs.locked_at IS NULL
            OR jobs.locked_at <= now() - stale_after
          )
        )
      )
    FOR UPDATE OF jobs SKIP LOCKED
  )
  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'failed',
      last_error = 'attempts_exhausted: ' || jobs.stage,
      completed_at = now(),
      locked_by = NULL,
      locked_at = NULL
  FROM exhausted_jobs
  WHERE jobs.id = exhausted_jobs.id;

  RETURN QUERY
  WITH candidate_jobs AS (
    SELECT jobs.id
    FROM public.product_intake_research_jobs AS jobs
    INNER JOIN public.product_submissions AS submissions
      ON submissions.id = jobs.submission_id
    WHERE jobs.next_run_at <= now()
      AND jobs.attempt_count < jobs.max_attempts
      AND submissions.status IN (
        'pending_review',
        'researching',
        'ready_for_review',
        'needs_more_info'
      )
      AND (
        jobs.status IN ('queued', 'waiting_for_rework')
        OR (
          jobs.status = 'running'
          AND (
            jobs.locked_at IS NULL
            OR jobs.locked_at <= now() - stale_after
          )
        )
      )
    ORDER BY jobs.priority DESC, jobs.next_run_at ASC, jobs.created_at ASC
    LIMIT claim_limit
    -- Serialize claims with submission disposition changes as well as other workers.
    FOR UPDATE OF jobs, submissions SKIP LOCKED
  )
  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'running',
      locked_by = worker_id,
      locked_at = now(),
      started_at = COALESCE(jobs.started_at, now()),
      completed_at = NULL,
      attempt_count = jobs.attempt_count + 1,
      last_error = NULL
  FROM candidate_jobs
  WHERE jobs.id = candidate_jobs.id
  RETURNING jobs.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_retry_research_job(
  target_job_id uuid,
  retry_progress jsonb DEFAULT NULL
)
RETURNS public.product_intake_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_job_stage text;
  current_job_status text;
  submission_status text;
  job_row public.product_intake_research_jobs;
BEGIN
  SELECT jobs.status, jobs.stage, submissions.status
  INTO current_job_status, current_job_stage, submission_status
  FROM public.product_intake_research_jobs AS jobs
  INNER JOIN public.product_submissions AS submissions
    ON submissions.id = jobs.submission_id
  WHERE jobs.id = target_job_id
  FOR UPDATE OF jobs;

  IF current_job_status IS NULL THEN
    RAISE EXCEPTION 'Product intake research job % does not exist', target_job_id
      USING ERRCODE = '02000';
  END IF;

  IF submission_status NOT IN (
    'pending_review',
    'researching',
    'ready_for_review',
    'needs_more_info'
  ) THEN
    RAISE EXCEPTION 'Product submission for job % is not open for research: %', target_job_id, submission_status
      USING ERRCODE = '23514';
  END IF;

  IF current_job_status NOT IN ('blocked', 'failed') THEN
    RAISE EXCEPTION 'Product intake research job % is not retryable from status %', target_job_id, current_job_status
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'queued',
      stage = current_job_stage,
      attempt_count = 0,
      progress = CASE
        WHEN retry_progress IS NULL THEN jobs.progress
        ELSE jobs.progress || retry_progress
      END,
      last_error = NULL,
      locked_by = NULL,
      locked_at = NULL,
      started_at = NULL,
      completed_at = NULL,
      next_run_at = now()
  WHERE jobs.id = target_job_id
  RETURNING *
  INTO job_row;

  RETURN job_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_update_research_job(
  target_job_id uuid,
  next_status text,
  next_stage text,
  next_progress jsonb DEFAULT NULL,
  next_last_error text DEFAULT NULL,
  expected_locked_by text DEFAULT NULL,
  expected_locked_at timestamptz DEFAULT NULL
)
RETURNS public.product_intake_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  job_row public.product_intake_research_jobs;
BEGIN
  IF next_status NOT IN (
    'queued',
    'running',
    'waiting_for_review',
    'waiting_for_rework',
    'publish_preflight',
    'publishing',
    'blocked',
    'failed',
    'done',
    'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid product intake research status: %', next_status
      USING ERRCODE = '22023';
  END IF;

  IF next_stage NOT IN (
    'identity',
    'source_research',
    'property_research',
    'image_search',
    'image_judging',
    'preview_build',
    'rework',
    'publish_preflight',
    'publish',
    'notify'
  ) THEN
    RAISE EXCEPTION 'Invalid product intake research stage: %', next_stage
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_intake_research_jobs AS jobs
  SET status = next_status,
      stage = next_stage,
      attempt_count = CASE
        WHEN jobs.stage IS DISTINCT FROM next_stage THEN 0
        ELSE jobs.attempt_count
      END,
      progress = COALESCE(next_progress, jobs.progress),
      last_error = next_last_error,
      locked_by = CASE WHEN next_status = 'running' THEN jobs.locked_by ELSE NULL END,
      locked_at = CASE WHEN next_status = 'running' THEN now() ELSE NULL END,
      started_at = CASE
        WHEN next_status = 'running' THEN COALESCE(jobs.started_at, now())
        ELSE jobs.started_at
      END,
      completed_at = CASE
        WHEN next_status IN ('done', 'cancelled') THEN COALESCE(jobs.completed_at, now())
        ELSE NULL
      END,
      next_run_at = CASE
        WHEN next_status = 'queued' THEN now()
        ELSE jobs.next_run_at
      END
  WHERE jobs.id = target_job_id
    AND (
      expected_locked_by IS NULL
      OR (
        jobs.locked_by = expected_locked_by
        AND jobs.locked_at = expected_locked_at
      )
    )
  RETURNING *
  INTO job_row;

  IF job_row.id IS NULL THEN
    RAISE EXCEPTION 'Product intake research job % does not exist or lock no longer matches', target_job_id
      USING ERRCODE = '02000';
  END IF;

  RETURN job_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_claim_research_jobs(text, integer, interval)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_retry_research_job(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_update_research_job(uuid, text, text, jsonb, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_intake_claim_research_jobs(text, integer, interval)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_retry_research_job(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_update_research_job(uuid, text, text, jsonb, text, text, timestamptz)
  TO service_role;
