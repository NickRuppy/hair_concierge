-- Phase 2/4 review cockpit foundation: durable research artifacts and review decisions.
-- These tables do not publish products and do not alter product_submissions status values.

CREATE TABLE IF NOT EXISTS public.product_intake_research_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.product_intake_research_jobs(id) ON DELETE SET NULL,
  submission_id uuid NOT NULL REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  source_urls text[],
  model text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_intake_research_artifacts_kind_check CHECK (
    kind IN (
      'identity_candidate',
      'existing_product_match',
      'source_page',
      'property_extract',
      'property_synthesis',
      'image_candidate',
      'image_judgment',
      'processed_image',
      'publication_preview',
      'publish_result'
    )
  ),
  CONSTRAINT product_intake_research_artifacts_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_product_intake_research_artifacts_submission_created
  ON public.product_intake_research_artifacts (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_intake_research_artifacts_job_kind
  ON public.product_intake_research_artifacts (job_id, kind);

ALTER TABLE public.product_intake_research_artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_intake_research_artifacts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.product_intake_research_artifacts TO service_role;

DROP POLICY IF EXISTS product_intake_research_artifacts_service_role_all
  ON public.product_intake_research_artifacts;
CREATE POLICY product_intake_research_artifacts_service_role_all
  ON public.product_intake_research_artifacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.product_intake_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.product_intake_research_jobs(id) ON DELETE SET NULL,
  field_path text NOT NULL,
  decision text NOT NULL,
  proposed_value jsonb,
  reviewer_value jsonb,
  comment text,
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_intake_review_decisions_decision_check CHECK (
    decision IN (
      'approved',
      'change_requested',
      'image_approved',
      'image_rejected',
      'publish_approved',
      'needs_more_info',
      'reject'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_product_intake_review_decisions_submission_created
  ON public.product_intake_review_decisions (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_intake_review_decisions_unresolved
  ON public.product_intake_review_decisions (submission_id, decision, resolved_at)
  WHERE resolved_at IS NULL;

ALTER TABLE public.product_intake_review_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_intake_review_decisions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.product_intake_review_decisions TO service_role;

DROP POLICY IF EXISTS product_intake_review_decisions_service_role_all
  ON public.product_intake_review_decisions;
CREATE POLICY product_intake_review_decisions_service_role_all
  ON public.product_intake_review_decisions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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
