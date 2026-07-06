-- Automatically bridge new pending product submissions into the durable
-- Codex research queue. The trigger only creates queue rows; workers still
-- perform the long-running research outside the database.

CREATE OR REPLACE FUNCTION public.product_intake_auto_enqueue_research_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending_review' THEN
    PERFORM public.product_intake_enqueue_research_job(NEW.id, 'source_research');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS product_intake_auto_enqueue_research_job
  ON public.product_submissions;
CREATE TRIGGER product_intake_auto_enqueue_research_job
  AFTER INSERT OR UPDATE OF status
  ON public.product_submissions
  FOR EACH ROW
  WHEN (NEW.status = 'pending_review')
  EXECUTE FUNCTION public.product_intake_auto_enqueue_research_job();

INSERT INTO public.product_intake_research_jobs (
  submission_id,
  status,
  stage,
  next_run_at,
  last_error
)
SELECT
  submissions.id,
  'queued',
  'source_research',
  now(),
  NULL
FROM public.product_submissions AS submissions
WHERE submissions.status = 'pending_review'
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_intake_research_jobs AS jobs
    WHERE jobs.submission_id = submissions.id
      AND jobs.status IN (
        'queued',
        'running',
        'waiting_for_review',
        'waiting_for_rework',
        'publish_preflight',
        'publishing',
        'blocked',
        'failed'
      )
  );

REVOKE ALL ON FUNCTION public.product_intake_auto_enqueue_research_job()
  FROM PUBLIC, anon, authenticated;
