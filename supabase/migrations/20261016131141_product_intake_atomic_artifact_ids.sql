-- Allow server-allocated artifact IDs to bind references inside the same atomic handoff.
-- The cycle, lease, replay, readiness and notification contracts are unchanged.

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
  notification_payload jsonb DEFAULT NULL,
  expected_review_cycle_id uuid DEFAULT NULL,
  research_artifacts jsonb DEFAULT '[]',
  request_auto_rework boolean DEFAULT false
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
  request_digest text;
  artifact jsonb;
  artifact_id uuid;
  artifact_ids uuid[] := '{}';
  processed_image_id uuid;
  completion_progress jsonb;
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
  IF (job_row.reserved_model_runs > 0 AND expected_review_cycle_id IS NULL) THEN
    RAISE EXCEPTION 'current review cycle is required after model reservation' USING ERRCODE = '22023';
  END IF;
  IF expected_review_cycle_id IS NOT NULL AND job_row.review_cycle_id IS DISTINCT FROM expected_review_cycle_id THEN
    RAISE EXCEPTION 'review cycle no longer matches' USING ERRCODE = '02000';
  END IF;
  IF research_artifacts IS NULL OR jsonb_typeof(research_artifacts) <> 'array'
     OR request_auto_rework IS NULL THEN
    RAISE EXCEPTION 'research artifacts must be an array and auto rework must be boolean' USING ERRCODE = '22023';
  END IF;
  -- Canonical JSON + epoch avoids timezone changes invalidating a response retry.
  request_digest := encode(sha256(convert_to(jsonb_build_array(
    target_job_id, expected_locked_by, extract(epoch FROM expected_locked_at),
    next_status, next_stage, next_progress, next_last_error, researched_payload,
    resolve_decision_ids, review_outcome, notification_payload,
    expected_review_cycle_id, research_artifacts, request_auto_rework
  )::text, 'UTF8')), 'hex');
  completion_key := target_job_id::text || ':' || extract(epoch FROM expected_locked_at)::text;

  -- A lost RPC response may be retried exactly after its successful completion.
  IF job_row.status <> 'running' AND job_row.progress ->> 'completion_key' = completion_key THEN
    IF job_row.progress ->> 'completion_request_digest' IS DISTINCT FROM request_digest
       OR job_row.progress ->> 'review_outcome' IS DISTINCT FROM review_outcome
       OR job_row.status IS DISTINCT FROM next_status OR job_row.stage IS DISTINCT FROM next_stage THEN
      RAISE EXCEPTION 'completion replay does not match committed request' USING ERRCODE = '22023';
    END IF;
    RETURN job_row;
  END IF;
  IF job_row.status <> 'running'
     OR job_row.locked_by IS DISTINCT FROM expected_locked_by
     OR job_row.locked_at IS DISTINCT FROM expected_locked_at THEN
    RAISE EXCEPTION 'product intake research job % does not exist or lock no longer matches', target_job_id
      USING ERRCODE = '02000';
  END IF;

  IF job_row.cycle_deadline_at IS NOT NULL AND job_row.cycle_deadline_at <= clock_timestamp()
     AND NOT (review_outcome = 'needs_nick' AND next_status = 'blocked') THEN
    RAISE EXCEPTION 'review cycle deadline exhausted' USING ERRCODE = '23514', DETAIL = 'cycle_deadline';
  END IF;
  IF request_auto_rework THEN
    IF expected_review_cycle_id IS NULL OR review_outcome <> 'continue'
       OR next_status <> 'waiting_for_rework' OR next_stage <> 'rework'
       OR notification_payload IS NOT NULL THEN
      RAISE EXCEPTION 'invalid automatic rework handoff' USING ERRCODE = '22023';
    END IF;
    IF job_row.auto_rework_count >= 2 OR job_row.reserved_model_runs > 4
       OR job_row.cycle_deadline_at IS NULL OR job_row.cycle_deadline_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'automatic rework budget exhausted' USING ERRCODE = '23514', DETAIL = 'auto_rework_limit';
    END IF;
  END IF;

  IF (review_outcome = 'continue' AND NOT request_auto_rework AND (next_status <> 'queued' OR next_stage <> 'image_judging'))
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
  FOR artifact IN SELECT value FROM jsonb_array_elements(research_artifacts) LOOP
    IF jsonb_typeof(artifact) IS DISTINCT FROM 'object'
       OR jsonb_typeof(artifact -> 'kind') IS DISTINCT FROM 'string'
       OR NULLIF(btrim(artifact ->> 'kind'), '') IS NULL
       OR jsonb_typeof(artifact -> 'payload') IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(artifact) key
         WHERE key NOT IN ('id','kind','status','payload','confidence','source_urls','model','prompt_version'))
       OR (artifact ? 'id' AND jsonb_typeof(artifact -> 'id') IS DISTINCT FROM 'string')
       OR (artifact ? 'status' AND (jsonb_typeof(artifact -> 'status') IS DISTINCT FROM 'string' OR btrim(artifact ->> 'status') = ''))
       OR (artifact ? 'confidence' AND jsonb_typeof(artifact -> 'confidence') NOT IN ('number','null'))
       OR (artifact ? 'source_urls' AND jsonb_typeof(artifact -> 'source_urls') NOT IN ('array','null'))
       OR (artifact ? 'model' AND jsonb_typeof(artifact -> 'model') NOT IN ('string','null'))
       OR (artifact ? 'prompt_version' AND jsonb_typeof(artifact -> 'prompt_version') NOT IN ('string','null')) THEN
      RAISE EXCEPTION 'invalid research artifact' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(artifact -> 'source_urls') = 'array' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(artifact -> 'source_urls') value WHERE jsonb_typeof(value) <> 'string'
    ) THEN
      RAISE EXCEPTION 'invalid research artifact source URLs' USING ERRCODE = '22023';
    END IF;
    IF (artifact ->> 'confidence')::numeric NOT BETWEEN 0 AND 1 THEN
      RAISE EXCEPTION 'invalid research artifact confidence' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_intake_research_artifacts
      (id, job_id, submission_id, kind, status, payload, confidence, source_urls, model, prompt_version)
    VALUES (COALESCE((artifact ->> 'id')::uuid, gen_random_uuid()), job_row.id, submission_row.id, artifact ->> 'kind', COALESCE(artifact ->> 'status', 'proposed'),
      artifact -> 'payload', (artifact ->> 'confidence')::numeric,
      CASE WHEN jsonb_typeof(artifact -> 'source_urls') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(artifact -> 'source_urls')) ELSE NULL END,
      artifact ->> 'model', artifact ->> 'prompt_version')
    RETURNING id INTO artifact_id;
    artifact_ids := array_append(artifact_ids, artifact_id);
    IF artifact ->> 'kind' = 'processed_image' THEN processed_image_id := artifact_id; END IF;
  END LOOP;
  completion_progress := (COALESCE(next_progress, job_row.progress, '{}'::jsonb) - 'processed_image_artifact_id')
    || jsonb_build_object('artifact_ids', artifact_ids, 'artifacts_created', cardinality(artifact_ids));
  IF job_row.progress -> 'inci_retry_attempted' = 'true'::jsonb
     OR next_progress -> 'inci_retry_attempted' = 'true'::jsonb THEN
    completion_progress := completion_progress || jsonb_build_object('inci_retry_attempted', true);
  END IF;
  IF processed_image_id IS NOT NULL THEN
    completion_progress := completion_progress || jsonb_build_object('processed_image_artifact_id', processed_image_id);
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
    completion_progress || jsonb_build_object(
        'completion_key', completion_key,
        'completion_request_digest', request_digest,
        'review_outcome', review_outcome,
        'saved_submission_status', submission_next_status,
        'resolved_review_decisions', resolved_decisions
      ),
    next_last_error, expected_locked_by, expected_locked_at
  );

  IF request_auto_rework THEN
    UPDATE public.product_intake_research_jobs SET auto_rework_count = auto_rework_count + 1,
      attempt_count = 0, next_run_at = clock_timestamp()
    WHERE id = target_job_id RETURNING * INTO job_row;
  END IF;

  IF review_outcome <> 'continue' THEN
    INSERT INTO public.product_intake_admin_notifications (submission_id, job_id, kind, transition_key, payload)
    VALUES (submission_row.id, job_row.id, notification_kind, completion_key || ':' || notification_kind, notification_payload)
    ON CONFLICT (transition_key) DO NOTHING;
  END IF;
  RETURN job_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_commit_research_pass(uuid,text,timestamptz,text,text,jsonb,text,jsonb,uuid[],text,jsonb,uuid,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_commit_research_pass(uuid,text,timestamptz,text,text,jsonb,text,jsonb,uuid[],text,jsonb,uuid,jsonb,boolean) TO service_role;
