CREATE OR REPLACE FUNCTION public.product_intake_request_rework_job(
  target_submission_id uuid,
  rework_progress jsonb DEFAULT NULL
)
RETURNS public.product_intake_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  job_row public.product_intake_research_jobs;
BEGIN
  SELECT *
  INTO job_row
  FROM public.product_intake_research_jobs AS jobs
  WHERE jobs.submission_id = target_submission_id
    AND jobs.status IN ('waiting_for_review', 'waiting_for_rework', 'blocked', 'failed')
  ORDER BY jobs.updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF job_row.id IS NULL THEN
    RAISE EXCEPTION 'No review-ready, blocked, or failed research job exists for submission %', target_submission_id
      USING ERRCODE = '02000';
  END IF;

  UPDATE public.product_intake_research_jobs AS jobs
  SET status = 'waiting_for_rework',
      stage = 'rework',
      attempt_count = 0,
      progress = CASE
        WHEN rework_progress IS NULL THEN jobs.progress
        ELSE jobs.progress || rework_progress
      END,
      last_error = NULL,
      locked_by = NULL,
      locked_at = NULL,
      completed_at = NULL,
      next_run_at = now()
  WHERE jobs.id = job_row.id
  RETURNING *
  INTO job_row;

  RETURN job_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_request_rework_job(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_intake_request_rework_job(uuid, jsonb)
  TO service_role;
