-- Atomic final research-pass handoff and a private administrative-alert outbox.
-- Delivery remains controlled by the application feature flag; this migration only
-- records immutable, review-safe snapshots for terminal review outcomes.

CREATE TABLE IF NOT EXISTS public.product_intake_admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.product_intake_research_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ready_for_review', 'needs_nick')),
  transition_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'needs_reconciliation')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  lease_token uuid,
  locked_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_delivery_id text,
  provider_queued_at text,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_intake_admin_notifications_lock_check CHECK (
    (lease_token IS NULL AND locked_at IS NULL) OR (lease_token IS NOT NULL AND locked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_product_intake_admin_notifications_claim
  ON public.product_intake_admin_notifications (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'sending');

ALTER TABLE public.product_intake_admin_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_intake_admin_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.product_intake_admin_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.product_intake_commit_research_pass(
  target_job_id uuid,
  expected_locked_by text,
  expected_locked_at timestamptz,
  next_status text,
  next_stage text,
  next_progress jsonb,
  next_last_error text,
  researched_payload jsonb DEFAULT NULL,
  resolve_decision_ids uuid[] DEFAULT '{}',
  review_outcome text DEFAULT 'continue',
  notification_payload jsonb DEFAULT NULL
)
RETURNS public.product_intake_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  job_row public.product_intake_research_jobs;
  submission_row public.product_submissions;
  completion_key text;
  requested_decisions integer;
  resolved_decisions integer;
  notification_kind text;
  payload_key_count integer;
  submission_next_status text;
BEGIN
  IF expected_locked_by IS NULL OR btrim(expected_locked_by) = '' OR expected_locked_at IS NULL THEN
    RAISE EXCEPTION 'a non-null running lease is required' USING ERRCODE = '22023';
  END IF;
  IF review_outcome IS NULL OR review_outcome NOT IN ('continue', 'ready_for_review', 'needs_nick') THEN
    RAISE EXCEPTION 'invalid review outcome: %', review_outcome USING ERRCODE = '22023';
  END IF;
  IF next_progress IS NOT NULL AND jsonb_typeof(next_progress) <> 'object' THEN
    RAISE EXCEPTION 'next progress must be an object' USING ERRCODE = '22023';
  END IF;

  -- Match the claim path's submission-then-job lock order.
  SELECT submissions.* INTO submission_row
  FROM public.product_submissions submissions
  JOIN public.product_intake_research_jobs jobs ON jobs.submission_id = submissions.id
  WHERE jobs.id = target_job_id
  FOR UPDATE OF submissions;
  IF submission_row.id IS NULL OR submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission for job % is not open for research', target_job_id USING ERRCODE = '23514';
  END IF;

  SELECT * INTO job_row FROM public.product_intake_research_jobs
  WHERE id = target_job_id FOR UPDATE;
  IF job_row.id IS NULL THEN
    RAISE EXCEPTION 'product intake research job % does not exist', target_job_id USING ERRCODE = '02000';
  END IF;
  completion_key := target_job_id::text || ':' || extract(epoch FROM expected_locked_at)::text;

  -- A lost RPC response may be retried exactly after its successful completion.
  IF job_row.status <> 'running'
     AND job_row.progress ->> 'completion_key' = completion_key
     AND job_row.progress ->> 'review_outcome' = review_outcome
     AND job_row.status = next_status
     AND job_row.stage = next_stage THEN
    RETURN job_row;
  END IF;
  IF job_row.status <> 'running'
     OR job_row.locked_by IS DISTINCT FROM expected_locked_by
     OR job_row.locked_at IS DISTINCT FROM expected_locked_at THEN
    RAISE EXCEPTION 'product intake research job % does not exist or lock no longer matches', target_job_id
      USING ERRCODE = '02000';
  END IF;

  IF (review_outcome = 'continue' AND (next_status <> 'queued' OR next_stage <> 'image_judging'))
     OR (review_outcome = 'ready_for_review' AND next_status <> 'waiting_for_review')
     OR (review_outcome = 'needs_nick' AND next_status NOT IN ('blocked', 'waiting_for_review')) THEN
    RAISE EXCEPTION 'review outcome % is inconsistent with job state %/%', review_outcome, next_status, next_stage
      USING ERRCODE = '22023';
  END IF;

  IF review_outcome = 'continue' AND notification_payload IS NOT NULL THEN
    RAISE EXCEPTION 'continue does not create an admin notification' USING ERRCODE = '22023';
  END IF;
  IF review_outcome <> 'continue' THEN
    IF notification_payload IS NULL OR jsonb_typeof(notification_payload) <> 'object' THEN
      RAISE EXCEPTION 'terminal review outcome requires notification payload' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO payload_key_count FROM jsonb_object_keys(notification_payload);
    IF payload_key_count <> 8
       OR NOT (notification_payload ?& ARRAY['product_name', 'category_label', 'outcome_label', 'question_1', 'question_2', 'question_3', 'review_url', 'is_test'])
       OR jsonb_typeof(notification_payload -> 'is_test') <> 'boolean'
       OR (notification_payload ->> 'is_test') <> 'false'
       OR EXISTS (
         SELECT 1 FROM unnest(ARRAY['product_name', 'category_label', 'outcome_label', 'question_1', 'question_2', 'question_3', 'review_url']) AS key
         WHERE jsonb_typeof(notification_payload -> key) <> 'string'
       )
       OR length(notification_payload ->> 'product_name') NOT BETWEEN 1 AND 180
       OR length(notification_payload ->> 'category_label') NOT BETWEEN 1 AND 180
       OR length(notification_payload ->> 'outcome_label') NOT BETWEEN 1 AND 180
       OR length(notification_payload ->> 'question_1') > 180
       OR length(notification_payload ->> 'question_2') > 180
       OR length(notification_payload ->> 'question_3') > 180
       OR notification_payload ->> 'outcome_label' IS DISTINCT FROM (CASE review_outcome WHEN 'ready_for_review' THEN 'Bereit zur Prüfung' ELSE 'Entscheidung nötig' END)
       OR notification_payload ->> 'review_url' <> 'https://chaarlie.de/admin/produkt-intake/' || submission_row.id::text THEN
      RAISE EXCEPTION 'invalid admin notification payload' USING ERRCODE = '22023';
    END IF;
    notification_kind := review_outcome;
  END IF;

  SELECT cardinality(ARRAY(SELECT DISTINCT id FROM unnest(COALESCE(resolve_decision_ids, '{}')) id))
  INTO requested_decisions;
  SELECT count(*) INTO resolved_decisions
  FROM public.product_intake_review_decisions decisions
  WHERE decisions.id = ANY(COALESCE(resolve_decision_ids, '{}'))
    AND decisions.submission_id = submission_row.id
    AND decisions.decision = 'change_requested'
    AND decisions.resolved_at IS NULL;
  IF requested_decisions <> resolved_decisions THEN
    RAISE EXCEPTION 'review decisions must be unresolved change requests for this submission' USING ERRCODE = '22023';
  END IF;

  IF researched_payload IS NOT NULL AND jsonb_typeof(researched_payload) <> 'object' THEN
    RAISE EXCEPTION 'researched payload must be an object' USING ERRCODE = '22023';
  END IF;
  submission_next_status := CASE review_outcome
    WHEN 'ready_for_review' THEN 'ready_for_review'
    ELSE 'researching'
  END;
  UPDATE public.product_submissions
  SET researched_payload = COALESCE(product_intake_commit_research_pass.researched_payload, product_submissions.researched_payload),
      status = submission_next_status
  WHERE id = submission_row.id;

  UPDATE public.product_intake_review_decisions
  SET resolved_at = now()
  WHERE id = ANY(COALESCE(resolve_decision_ids, '{}'))
    AND submission_id = submission_row.id
    AND decision = 'change_requested'
    AND resolved_at IS NULL;

  -- Reuse the existing job lifecycle writer rather than maintaining a second
  -- copy of attempt resets, timestamps and lease release behavior.
  SELECT * INTO job_row FROM public.product_intake_update_research_job(
    target_job_id, next_status, next_stage,
    COALESCE(next_progress, job_row.progress, '{}'::jsonb)
      || jsonb_build_object(
        'completion_key', completion_key,
        'review_outcome', review_outcome,
        'saved_submission_status', submission_next_status,
        'resolved_review_decisions', resolved_decisions
      ),
    next_last_error, expected_locked_by, expected_locked_at
  );

  IF review_outcome <> 'continue' THEN
    INSERT INTO public.product_intake_admin_notifications (submission_id, job_id, kind, transition_key, payload)
    VALUES (submission_row.id, job_row.id, notification_kind, completion_key || ':' || notification_kind, notification_payload)
    ON CONFLICT (transition_key) DO NOTHING;
  END IF;
  RETURN job_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_claim_admin_notification()
RETURNS SETOF public.product_intake_admin_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  row_to_claim public.product_intake_admin_notifications;
BEGIN
  LOOP
    SELECT * INTO row_to_claim
    FROM public.product_intake_admin_notifications
    WHERE (status = 'pending' AND next_attempt_at <= now() AND attempts < 5)
       OR (status = 'sending' AND locked_at <= now() - interval '5 minutes')
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    IF row_to_claim.id IS NULL THEN RETURN; END IF;

    IF row_to_claim.status = 'sending' THEN
      -- A crashed sender may already have delivered. Never grant a new send lease
      -- for that row; retain the attempt count and require provider reconciliation.
      UPDATE public.product_intake_admin_notifications
      SET status = 'needs_reconciliation', error = 'delivery_lease_expired', lease_token = NULL, locked_at = NULL
      WHERE id = row_to_claim.id;
      CONTINUE;
    ELSE
      UPDATE public.product_intake_admin_notifications
      SET status = 'sending', lease_token = gen_random_uuid(), locked_at = now(), attempts = attempts + 1, error = NULL
      WHERE id = row_to_claim.id
      RETURNING * INTO row_to_claim;
    END IF;
    RETURN NEXT row_to_claim;
    RETURN;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_settle_admin_notification(
  target_id uuid,
  expected_lease_token uuid,
  result text,
  delivery_id text DEFAULT NULL,
  queued_at text DEFAULT NULL,
  error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  row_to_settle public.product_intake_admin_notifications;
  retry_delay interval;
BEGIN
  IF result IS NULL OR result NOT IN ('sent', 'definite_transient', 'ambiguous', 'permanent') THEN
    RAISE EXCEPTION 'invalid notification settlement result' USING ERRCODE = '22023';
  END IF;
  IF error_code IS NOT NULL AND error_code !~ '^[a-z0-9_]{1,80}$' THEN
    RAISE EXCEPTION 'invalid notification error code' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO row_to_settle FROM public.product_intake_admin_notifications
  WHERE id = target_id AND status = 'sending' AND lease_token = expected_lease_token FOR UPDATE;
  IF row_to_settle.id IS NULL THEN RETURN false; END IF;
  IF result = 'sent' THEN
    IF NULLIF(btrim(delivery_id), '') IS NULL OR NULLIF(btrim(queued_at), '') IS NULL THEN
      RAISE EXCEPTION 'sent notification requires provider receipt' USING ERRCODE = '22023';
    END IF;
    UPDATE public.product_intake_admin_notifications
    SET status = 'sent', provider_delivery_id = delivery_id, provider_queued_at = queued_at, sent_at = now(),
        lease_token = NULL, locked_at = NULL, error = NULL
    WHERE id = target_id;
  ELSIF result = 'ambiguous' THEN
    UPDATE public.product_intake_admin_notifications
    SET status = 'needs_reconciliation', lease_token = NULL, locked_at = NULL,
        error = COALESCE(error_code, 'ambiguous_delivery')
    WHERE id = target_id;
  ELSIF result = 'definite_transient' AND row_to_settle.attempts < 5 THEN
    retry_delay := make_interval(secs => LEAST(3600, 30 * (2 ^ GREATEST(row_to_settle.attempts - 1, 0)))::integer);
    UPDATE public.product_intake_admin_notifications
    SET status = 'pending', lease_token = NULL, locked_at = NULL, next_attempt_at = now() + retry_delay,
        error = COALESCE(error_code, 'definite_transient') WHERE id = target_id;
  ELSE
    UPDATE public.product_intake_admin_notifications
    SET status = 'failed', lease_token = NULL, locked_at = NULL,
        error = COALESCE(error_code, CASE WHEN result = 'definite_transient' THEN 'definite_transient_exhausted' ELSE 'permanent' END)
    WHERE id = target_id;
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_commit_research_pass(uuid, text, timestamptz, text, text, jsonb, text, jsonb, uuid[], text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_claim_admin_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_settle_admin_notification(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_commit_research_pass(uuid, text, timestamptz, text, text, jsonb, text, jsonb, uuid[], text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_claim_admin_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_settle_admin_notification(uuid, uuid, text, text, text, text) TO service_role;
