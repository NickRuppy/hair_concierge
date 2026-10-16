-- Review evidence foundation only: no approval, publication, rollout or alert activation.
ALTER TABLE public.product_submissions
  ADD COLUMN payload_revision integer NOT NULL DEFAULT 1 CHECK (payload_revision > 0),
  ADD COLUMN payload_sha256 text;

-- SQL NULL and JSON null have the same explicit representation. Hash every row,
-- including non-null legacy research, before enforcing server ownership.
UPDATE public.product_submissions
SET payload_sha256 = encode(sha256(convert_to(COALESCE(researched_payload,'null'::jsonb)::text,'UTF8')),'hex');
ALTER TABLE public.product_submissions
  ALTER COLUMN payload_sha256 SET NOT NULL,
  ADD CONSTRAINT product_submissions_payload_sha256_check CHECK (payload_sha256 ~ '^[0-9a-f]{64}$');

CREATE FUNCTION public.product_intake_guard_payload_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.payload_revision := 1;
    NEW.payload_sha256 := encode(sha256(convert_to(COALESCE(NEW.researched_payload,'null'::jsonb)::text,'UTF8')),'hex');
  ELSIF NEW.payload_revision IS DISTINCT FROM OLD.payload_revision
     OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256 THEN
    RAISE EXCEPTION 'payload revision and hash are server-controlled' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.product_intake_advance_payload_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $function$
BEGIN
  NEW.payload_revision := OLD.payload_revision + 1;
  NEW.payload_sha256 := encode(sha256(convert_to(COALESCE(NEW.researched_payload,'null'::jsonb)::text,'UTF8')),'hex');
  RETURN NEW;
END;
$function$;
-- PostgreSQL orders same-kind triggers alphabetically. The general guard must
-- run first; UPDATE OF distinguishes an identical assignment from status writes.
CREATE TRIGGER product_intake_payload_10_guard
  BEFORE INSERT OR UPDATE ON public.product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.product_intake_guard_payload_revision();
CREATE TRIGGER product_intake_payload_20_advance
  BEFORE UPDATE OF researched_payload ON public.product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.product_intake_advance_payload_revision();
REVOKE ALL ON FUNCTION public.product_intake_guard_payload_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.product_intake_advance_payload_revision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_guard_payload_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_advance_payload_revision() TO service_role;

ALTER TABLE public.product_intake_review_decisions
  ADD COLUMN payload_revision integer CHECK (payload_revision > 0),
  ADD COLUMN payload_sha256 text CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN approved_asset_sha256 text CHECK (approved_asset_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT product_intake_review_decisions_revision_pair_check
    CHECK ((payload_revision IS NULL) = (payload_sha256 IS NULL)),
  ADD CONSTRAINT product_intake_review_decisions_asset_binding_check
    CHECK (approved_asset_sha256 IS NULL OR payload_revision IS NOT NULL);
-- Existing decisions deliberately retain NULL bindings: historical audit only.

INSERT INTO storage.buckets(id,name,public)
VALUES ('product-intake-review','product-intake-review',false)
ON CONFLICT(id) DO UPDATE SET public=false;
-- Restrictive policy prevents an unrelated broad permissive policy from exposing
-- this private bucket. Service-role access bypasses RLS; signed URLs are server-owned.
CREATE POLICY product_intake_review_private_objects ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon,authenticated
  USING (bucket_id <> 'product-intake-review')
  WITH CHECK (bucket_id <> 'product-intake-review');

CREATE TABLE public.product_intake_review_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  payload_revision integer NOT NULL CHECK (payload_revision > 0),
  job_id uuid REFERENCES public.product_intake_research_jobs(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('raw','magenta','neutral','final','search_thumbnail')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image/png','image/jpeg','image/webp','image/avif')),
  byte_length bigint NOT NULL CHECK (byte_length > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id,payload_revision,kind),
  CHECK (storage_key = submission_id::text || '/' || payload_revision::text || '/' || sha256)
);
CREATE INDEX product_intake_review_assets_job_idx ON public.product_intake_review_assets(job_id);
ALTER TABLE public.product_intake_review_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_intake_review_assets FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON TABLE public.product_intake_review_assets TO service_role;
CREATE POLICY product_intake_review_assets_service_select ON public.product_intake_review_assets
  FOR SELECT TO service_role USING (true);
CREATE POLICY product_intake_review_assets_service_insert ON public.product_intake_review_assets
  FOR INSERT TO service_role WITH CHECK (true);

CREATE FUNCTION public.product_intake_guard_review_asset()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  current_revision integer;
  owning_submission uuid;
  owning_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Preserve history when the FK deletes its job. No caller may rewrite bytes,
    -- ownership or revision, including a privileged maintenance caller.
    IF OLD.job_id IS NOT NULL AND NEW.job_id IS NULL
       AND (to_jsonb(NEW) - 'job_id') = (to_jsonb(OLD) - 'job_id')
       AND NOT EXISTS (SELECT 1 FROM public.product_intake_research_jobs WHERE id=OLD.job_id) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'review assets are immutable' USING ERRCODE = '22023';
  END IF;
  SELECT payload_revision INTO current_revision FROM public.product_submissions
    WHERE id=NEW.submission_id FOR UPDATE;
  SELECT submission_id,status INTO owning_submission,owning_status FROM public.product_intake_research_jobs
    WHERE id=NEW.job_id FOR UPDATE;
  IF NEW.job_id IS NULL OR owning_submission IS DISTINCT FROM NEW.submission_id
     OR owning_status IS DISTINCT FROM 'running' OR current_revision IS DISTINCT FROM NEW.payload_revision THEN
    RAISE EXCEPTION 'review asset requires the current submission revision and owning running job' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER product_intake_review_asset_guard BEFORE INSERT OR UPDATE ON public.product_intake_review_assets
  FOR EACH ROW EXECUTE FUNCTION public.product_intake_guard_review_asset();
REVOKE ALL ON FUNCTION public.product_intake_guard_review_asset() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_guard_review_asset() TO service_role;

-- One defaulted signature preserves old calls without ambiguous overloads.
DROP FUNCTION public.product_intake_commit_research_pass(uuid,text,timestamptz,text,text,jsonb,text,jsonb,uuid[],text,jsonb,uuid,jsonb,boolean);

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
  request_auto_rework boolean DEFAULT false,
  expected_payload_revision integer DEFAULT NULL,
  review_assets jsonb DEFAULT '[]'
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
  review_asset jsonb;
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
    expected_review_cycle_id, research_artifacts, request_auto_rework,
    expected_payload_revision, review_assets
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

  -- Replay above intentionally precedes CAS: an identical response retry still
  -- names the old revision and must not bump it or append evidence a second time.
  IF expected_payload_revision IS NOT NULL
     AND expected_payload_revision IS DISTINCT FROM submission_row.payload_revision THEN
    RAISE EXCEPTION 'payload revision no longer matches' USING ERRCODE = '02000';
  END IF;
  IF review_assets IS NULL OR jsonb_typeof(review_assets) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'review assets must be an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(review_assets) > 0 AND expected_payload_revision IS NULL THEN
    RAISE EXCEPTION 'review assets require expected payload revision' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(review_assets) > 5 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(review_assets) value
    GROUP BY value ->> 'kind' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'review asset kinds must be unique' USING ERRCODE = '22023';
  END IF;
  FOR review_asset IN SELECT value FROM jsonb_array_elements(review_assets) LOOP
    IF jsonb_typeof(review_asset) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid review asset manifest' USING ERRCODE = '22023';
    END IF;
    IF NOT (review_asset ?& ARRAY['kind','sha256','storage_key','media_type','byte_length'])
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(review_asset) key
         WHERE key NOT IN ('kind','sha256','storage_key','media_type','byte_length'))
       OR jsonb_typeof(review_asset -> 'kind') IS DISTINCT FROM 'string'
       OR review_asset ->> 'kind' NOT IN ('raw','magenta','neutral','final','search_thumbnail')
       OR jsonb_typeof(review_asset -> 'sha256') IS DISTINCT FROM 'string'
       OR review_asset ->> 'sha256' !~ '^[0-9a-f]{64}$'
       OR jsonb_typeof(review_asset -> 'storage_key') IS DISTINCT FROM 'string'
       OR review_asset ->> 'storage_key' IS DISTINCT FROM
          submission_row.id::text || '/' || (submission_row.payload_revision + 1)::text || '/' || (review_asset ->> 'sha256')
       OR jsonb_typeof(review_asset -> 'media_type') IS DISTINCT FROM 'string'
       OR review_asset ->> 'media_type' NOT IN ('image/png','image/jpeg','image/webp','image/avif')
       OR jsonb_typeof(review_asset -> 'byte_length') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'invalid review asset manifest' USING ERRCODE = '22023';
    END IF;
    IF (review_asset ->> 'byte_length')::numeric <= 0
       OR (review_asset ->> 'byte_length')::numeric > 9223372036854775807
       OR trunc((review_asset ->> 'byte_length')::numeric) <> (review_asset ->> 'byte_length')::numeric THEN
      RAISE EXCEPTION 'invalid review asset byte length' USING ERRCODE = '22023';
    END IF;
  END LOOP;

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
         WHERE key NOT IN ('kind','status','payload','confidence','source_urls','model','prompt_version'))
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
      (job_id, submission_id, kind, status, payload, confidence, source_urls, model, prompt_version)
    VALUES (job_row.id, submission_row.id, artifact ->> 'kind', COALESCE(artifact ->> 'status', 'proposed'),
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
  WHERE id = submission_row.id RETURNING * INTO submission_row;

  FOR review_asset IN SELECT value FROM jsonb_array_elements(review_assets) LOOP
    INSERT INTO public.product_intake_review_assets
      (submission_id,payload_revision,job_id,kind,sha256,storage_key,media_type,byte_length)
    VALUES (submission_row.id,submission_row.payload_revision,job_row.id,
      review_asset ->> 'kind',review_asset ->> 'sha256',review_asset ->> 'storage_key',
      review_asset ->> 'media_type',(review_asset ->> 'byte_length')::bigint);
  END LOOP;
  completion_progress := completion_progress || jsonb_build_object(
    'payload_revision',submission_row.payload_revision,'payload_sha256',submission_row.payload_sha256);

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

REVOKE ALL ON FUNCTION public.product_intake_commit_research_pass(uuid,text,timestamptz,text,text,jsonb,text,jsonb,uuid[],text,jsonb,uuid,jsonb,boolean,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_commit_research_pass(uuid,text,timestamptz,text,text,jsonb,text,jsonb,uuid[],text,jsonb,uuid,jsonb,boolean,integer,jsonb) TO service_role;
