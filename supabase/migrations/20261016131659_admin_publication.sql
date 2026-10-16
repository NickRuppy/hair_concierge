-- Local implementation only. No publication, notification or automatic rollout.
ALTER TABLE public.product_intake_review_decisions
  ADD COLUMN review_sequence bigint GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN request_id uuid UNIQUE,
  ADD COLUMN request_digest text CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  ADD COLUMN review_cycle_id uuid,
  ADD COLUMN review_source text CHECK (review_source IN ('admin','legacy_package')),
  ADD COLUMN review_action text,
  ADD COLUMN notification_status text CHECK (notification_status IN ('pending','sent','failed','not_required')),
  ADD COLUMN notification_message_id uuid,
  ADD COLUMN notification_error_code text,
  ADD COLUMN notification_snapshot jsonb;
REVOKE ALL ON public.product_intake_review_decisions FROM service_role;
GRANT SELECT ON public.product_intake_review_decisions TO service_role;

CREATE TABLE public.product_intake_publication_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  brand_id uuid,
  product_line_id uuid,
  job_id uuid REFERENCES public.product_intake_research_jobs(id) ON DELETE SET NULL,
  review_cycle_id uuid,
  payload_revision integer NOT NULL CHECK (payload_revision > 0),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  persisted_payload_revision integer NOT NULL,
  persisted_payload_sha256 text NOT NULL CHECK (persisted_payload_sha256 ~ '^[0-9a-f]{64}$'),
  data_decision_id uuid NOT NULL REFERENCES public.product_intake_review_decisions(id),
  image_decision_id uuid NOT NULL REFERENCES public.product_intake_review_decisions(id),
  approved_asset_sha256 text CHECK (approved_asset_sha256 ~ '^[0-9a-f]{64}$'),
  public_image jsonb,
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_status text NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sent','failed','not_required')),
  notification_message_id uuid,
  notification_error_code text,
  notification_snapshot jsonb NOT NULL
);
ALTER TABLE public.product_intake_publication_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_intake_publication_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.product_intake_publication_receipts TO service_role;
CREATE POLICY publication_receipts_service_read ON public.product_intake_publication_receipts
  FOR SELECT TO service_role USING(true);

-- Helpers are private SQL authority, never service-callable endpoints.
CREATE FUNCTION public.product_intake_review_request_check(p_request jsonb,p_extra text[])
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text;
BEGIN
 IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'review_validation_failed: invalid review request' USING ERRCODE='22023'; END IF;
 IF NOT(p_request ?& ARRAY['request_id','submission_id','job_id','review_cycle_id','payload_revision','payload_sha256','reviewed_by'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_request) key WHERE key <> ALL(ARRAY['request_id','submission_id','job_id','review_cycle_id','payload_revision','payload_sha256','reviewed_by']||p_extra))
 THEN RAISE EXCEPTION 'review_validation_failed: invalid review request fields' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['request_id','submission_id'] LOOP
  IF jsonb_typeof(p_request->k) IS DISTINCT FROM 'string' OR (p_request->>k)::uuid IS NULL THEN RAISE EXCEPTION 'review_validation_failed: review request UUID required' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_typeof(p_request->'payload_revision') IS DISTINCT FROM 'number' OR (p_request->>'payload_revision')::integer < 1
 OR jsonb_typeof(p_request->'payload_sha256') IS DISTINCT FROM 'string' OR p_request->>'payload_sha256' !~ '^[0-9a-f]{64}$'
 OR jsonb_typeof(p_request->'reviewed_by') IS DISTINCT FROM 'string' OR length(btrim(p_request->>'reviewed_by')) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'review_validation_failed: invalid review revision or actor' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION public.product_intake_review_context(p_request jsonb,p_legacy boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s public.product_submissions; j public.product_intake_research_jobs;
BEGIN
 SELECT * INTO s FROM public.product_submissions WHERE id=(p_request->>'submission_id')::uuid FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'review_validation_failed: submission not found' USING ERRCODE='02000'; END IF;
 SELECT * INTO j FROM public.product_intake_research_jobs WHERE submission_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF s.payload_revision IS DISTINCT FROM (p_request->>'payload_revision')::integer OR s.payload_sha256 IS DISTINCT FROM p_request->>'payload_sha256'
 THEN RAISE EXCEPTION 'review_revision_stale: payload revision no longer matches' USING ERRCODE='02000'; END IF;
 IF p_legacy THEN
  IF j.id IS NOT NULL OR p_request->>'job_id' IS NOT NULL OR p_request->>'review_cycle_id' IS NOT NULL THEN RAISE EXCEPTION 'review_validation_failed: legacy bridge requires a genuinely no-job submission' USING ERRCODE='22023'; END IF;
 ELSE
  IF j.id IS NULL OR j.id IS DISTINCT FROM (p_request->>'job_id')::uuid OR j.review_cycle_id IS DISTINCT FROM (p_request->>'review_cycle_id')::uuid
  THEN RAISE EXCEPTION 'review_validation_failed: review job or cycle no longer matches' USING ERRCODE='02000'; END IF;
 END IF;
 IF s.status NOT IN ('pending_review','researching','ready_for_review','needs_more_info') THEN RAISE EXCEPTION 'review_validation_failed: submission is not open for review' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('submission',to_jsonb(s),'job',CASE WHEN j.id IS NULL THEN NULL ELSE to_jsonb(j) END);
END $$;

CREATE FUNCTION public.product_intake_review_preflight(p_submission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.product_submissions; j public.product_intake_research_jobs; d public.product_intake_review_decisions; i public.product_intake_review_decisions;
 f public.product_intake_review_assets; t public.product_intake_review_assets; receipt public.product_intake_publication_receipts;
 blockers jsonb:='[]'; legacy boolean:=false; no_image boolean:=false;
BEGIN
 SELECT * INTO s FROM public.product_submissions WHERE id=p_submission_id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'review_validation_failed: submission not found' USING ERRCODE='02000'; END IF;
 SELECT * INTO receipt FROM public.product_intake_publication_receipts WHERE submission_id=s.id;
 SELECT * INTO j FROM public.product_intake_research_jobs WHERE submission_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT * INTO d FROM public.product_intake_review_decisions WHERE submission_id=s.id AND payload_revision=s.payload_revision AND payload_sha256=s.payload_sha256
  AND job_id IS NOT DISTINCT FROM j.id AND review_cycle_id IS NOT DISTINCT FROM j.review_cycle_id AND field_path='final.properties'
  AND review_source IN ('admin','legacy_package') ORDER BY review_sequence DESC LIMIT 1;
 SELECT * INTO i FROM public.product_intake_review_decisions WHERE submission_id=s.id AND payload_revision=s.payload_revision AND payload_sha256=s.payload_sha256
  AND job_id IS NOT DISTINCT FROM j.id AND review_cycle_id IS NOT DISTINCT FROM j.review_cycle_id AND field_path='final.image'
  AND review_source IN ('admin','legacy_package') ORDER BY review_sequence DESC LIMIT 1;
 legacy:=j.id IS NULL AND d.review_source='legacy_package' AND i.review_source='legacy_package';
 IF s.status<>'ready_for_review' THEN blockers:=blockers||jsonb_build_array('submission_not_ready'); END IF;
 IF NOT COALESCE(legacy,false) AND (j.id IS NULL OR j.status<>'waiting_for_review') THEN blockers:=blockers||jsonb_build_array('job_not_reviewable'); END IF;
 IF d.id IS NULL OR d.decision<>'approved' OR d.review_action<>'approve_data' THEN blockers:=blockers||jsonb_build_array('data_approval_missing'); END IF;
 IF i.id IS NULL OR i.decision<>'image_approved' OR i.review_action<>'approve_image' THEN blockers:=blockers||jsonb_build_array('image_approval_missing'); END IF;
 IF EXISTS(SELECT 1 FROM public.product_intake_review_decisions WHERE submission_id=s.id AND decision='change_requested' AND resolved_at IS NULL)
 THEN blockers:=blockers||jsonb_build_array('unresolved_review_questions'); END IF;
 SELECT * INTO f FROM public.product_intake_review_assets WHERE submission_id=s.id AND payload_revision=s.payload_revision AND kind='final' AND job_id IS NOT DISTINCT FROM j.id;
 SELECT * INTO t FROM public.product_intake_review_assets WHERE submission_id=s.id AND payload_revision=s.payload_revision AND kind='search_thumbnail' AND job_id IS NOT DISTINCT FROM j.id;
 no_image:=i.reviewer_value='{"no_image":true}'::jsonb AND i.approved_asset_sha256 IS NULL AND f.id IS NULL
  AND s.researched_payload#>'{final,product,image_url}'='null'::jsonb
  AND s.researched_payload#>'{final,product,canonical_image_sha256}'='null'::jsonb
  AND s.researched_payload#>'{final,product,thumbnail_image_url}'='null'::jsonb;
 IF NOT COALESCE(no_image,false) AND (f.id IS NULL OR t.id IS NULL OR i.approved_asset_sha256 IS DISTINCT FROM f.sha256)
 THEN blockers:=blockers||jsonb_build_array('approved_private_image_missing'); END IF;
 RETURN jsonb_build_object('submission_id',s.id,'ok',jsonb_array_length(blockers)=0,'blockers',blockers,
  'payload_revision',s.payload_revision,'payload_sha256',s.payload_sha256,'job_id',j.id,'review_cycle_id',j.review_cycle_id,
  'data_decision_id',d.id,'image_decision_id',i.id,'approved_asset_sha256',i.approved_asset_sha256,
  'final_asset',CASE WHEN f.id IS NULL THEN NULL ELSE to_jsonb(f) END,'thumbnail_asset',CASE WHEN t.id IS NULL THEN NULL ELSE to_jsonb(t) END,
  'no_image',COALESCE(no_image,false),'publication',CASE WHEN receipt.id IS NULL THEN NULL ELSE to_jsonb(receipt) END,'legacy_package',COALESCE(legacy,false));
END $$;

CREATE FUNCTION public.product_intake_record_review_decision(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.product_submissions; j public.product_intake_research_jobs; d public.product_intake_review_decisions; context jsonb;
 digest text; action text:=p_request->>'action'; field text; decision_value text; value jsonb:=p_request->'reviewer_value'; asset public.product_intake_review_assets; changed jsonb; pins jsonb;
BEGIN
 PERFORM public.product_intake_review_request_check(p_request,ARRAY['action','field_path','reviewer_value','comment','approved_asset_sha256']);
 digest:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
 SELECT * INTO s FROM public.product_submissions WHERE id=(p_request->>'submission_id')::uuid FOR UPDATE;
 SELECT * INTO d FROM public.product_intake_review_decisions WHERE request_id=(p_request->>'request_id')::uuid;
 IF d.id IS NOT NULL THEN
  IF d.request_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'review_validation_failed: review decision replay does not match' USING ERRCODE='22023'; END IF;
  SELECT * INTO j FROM public.product_intake_research_jobs WHERE id=d.job_id;
  RETURN jsonb_build_object('decision',to_jsonb(d),'submission',to_jsonb(s),'job',CASE WHEN j.id IS NULL THEN NULL ELSE to_jsonb(j) END);
 END IF;
 context:=public.product_intake_review_context(p_request,action IN ('request_info','reject','link_existing') AND p_request->>'job_id' IS NULL);
 SELECT * INTO s FROM jsonb_populate_record(NULL::public.product_submissions,context->'submission');
 SELECT * INTO j FROM jsonb_populate_record(NULL::public.product_intake_research_jobs,NULLIF(context->'job','null'::jsonb));
 field:=CASE action WHEN 'approve_data' THEN 'final.properties' WHEN 'approve_image' THEN 'final.image' WHEN 'reject_image' THEN 'final.image'
  WHEN 'approve_raw' THEN 'raw.image' WHEN 'rework' THEN 'review.rework' WHEN 'request_info' THEN 'review.request_info'
  WHEN 'reject' THEN 'review.reject' WHEN 'link_existing' THEN 'review.link_existing' WHEN 'answer' THEN p_request->>'field_path' END;
 IF field IS NULL OR (p_request ? 'field_path' AND p_request->>'field_path' IS DISTINCT FROM field) THEN RAISE EXCEPTION 'review_validation_failed: invalid review action or field' USING ERRCODE='22023'; END IF;
 IF action IN ('approve_data','approve_image','reject_image','approve_raw') AND (s.status<>'ready_for_review' OR j.status<>'waiting_for_review')
 THEN RAISE EXCEPTION 'review_validation_failed: review approvals require ready submission and job' USING ERRCODE='23514'; END IF;
 IF action='answer' AND (field NOT IN ('product.canonical_brand','product.product_line','product.clean_name','research.separate_deep_cleanser_listing')
   OR value IS NULL OR value='null'::jsonb) THEN RAISE EXCEPTION 'review_validation_failed: answer requires a known field and exact value' USING ERRCODE='22023'; END IF;
 IF action='answer' THEN
  IF field='research.separate_deep_cleanser_listing' THEN
   IF s.category<>'shampoo' OR jsonb_typeof(value) IS DISTINCT FROM 'object'
    OR jsonb_typeof(value->'choice') IS DISTINCT FROM 'string' OR value->>'choice' NOT IN ('keep_regular_only','review_extra_separately')
    OR NOT(value ? 'choice') OR EXISTS(SELECT 1 FROM jsonb_object_keys(value) k WHERE k<>'choice')
   THEN RAISE EXCEPTION 'review_answer_invalid: invalid deep-cleanser listing choice' USING ERRCODE='22023'; END IF;
   SELECT artifact.payload->'engine' INTO pins FROM public.product_intake_research_artifacts artifact
    WHERE artifact.job_id=j.id AND artifact.submission_id=s.id AND artifact.kind='property_synthesis'
     AND COALESCE(j.progress->'artifact_ids','[]'::jsonb) @> jsonb_build_array(artifact.id::text)
    ORDER BY artifact.created_at DESC,artifact.id DESC LIMIT 1;
   IF pins->>'input_hash' IS NULL OR pins->>'input_hash' !~ '^[0-9a-f]{64}$' OR NULLIF(pins->>'methodology','') IS NULL
   THEN RAISE EXCEPTION 'review_answer_missing_pins: frozen research engine missing' USING ERRCODE='22023'; END IF;
  ELSE
   IF jsonb_typeof(value) IS DISTINCT FROM 'object' OR jsonb_typeof(value->split_part(field,'.',2)) IS DISTINCT FROM 'string'
    OR NULLIF(btrim(value->>split_part(field,'.',2)),'') IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(value) k WHERE k<>split_part(field,'.',2))
   THEN RAISE EXCEPTION 'review_answer_invalid: exact identity value required' USING ERRCODE='22023'; END IF;
  END IF;
 END IF;
 IF action IN ('rework','reject_image') AND NULLIF(btrim(p_request->>'comment'),'') IS NULL THEN RAISE EXCEPTION 'review_validation_failed: review comment required' USING ERRCODE='22023'; END IF;
 IF action IN ('approve_image','approve_raw') THEN
  SELECT * INTO asset FROM public.product_intake_review_assets WHERE submission_id=s.id AND payload_revision=s.payload_revision AND job_id=j.id
    AND kind=CASE action WHEN 'approve_raw' THEN 'raw' ELSE 'final' END;
  IF action='approve_image' AND value='{"no_image":true}'::jsonb THEN
   IF asset.id IS NOT NULL OR p_request->>'approved_asset_sha256' IS NOT NULL
    OR s.researched_payload#>'{final,product,image_url}' IS DISTINCT FROM 'null'::jsonb
    OR s.researched_payload#>'{final,product,canonical_image_sha256}' IS DISTINCT FROM 'null'::jsonb
    OR s.researched_payload#>'{final,product,thumbnail_image_url}' IS DISTINCT FROM 'null'::jsonb
   THEN RAISE EXCEPTION 'review_validation_failed: no-image approval requires explicit null image metadata' USING ERRCODE='22023'; END IF;
  ELSIF asset.id IS NULL OR asset.sha256 IS DISTINCT FROM p_request->>'approved_asset_sha256' THEN
   RAISE EXCEPTION 'review_validation_failed: approval must match exact current private asset' USING ERRCODE='22023';
  END IF;
 END IF;
 decision_value:=CASE action WHEN 'approve_image' THEN 'image_approved' WHEN 'approve_raw' THEN 'image_approved' WHEN 'reject_image' THEN 'image_rejected'
 WHEN 'rework' THEN 'change_requested' WHEN 'request_info' THEN 'needs_more_info' WHEN 'reject' THEN 'reject' ELSE 'approved' END;
 IF action IN ('request_info','reject','link_existing') THEN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'review_validation_failed: disposition value required' USING ERRCODE='22023'; END IF;
  IF action='request_info' AND (NOT(value ?& ARRAY['reason','next_step','missing_fields']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(value) k WHERE k NOT IN ('reason','next_step','missing_fields')) OR jsonb_typeof(value->'missing_fields') IS DISTINCT FROM 'array')
   THEN RAISE EXCEPTION 'review_validation_failed: invalid information request' USING ERRCODE='22023'; END IF;
  IF action IN ('request_info','reject') AND (jsonb_typeof(value->'reason') IS DISTINCT FROM 'string' OR NULLIF(btrim(value->>'reason'),'') IS NULL)
   THEN RAISE EXCEPTION 'review_validation_failed: disposition requires exact reason' USING ERRCODE='22023'; END IF;
  IF action='request_info' AND (jsonb_typeof(value->'next_step') IS DISTINCT FROM 'string' OR NULLIF(btrim(value->>'next_step'),'') IS NULL)
   THEN RAISE EXCEPTION 'review_validation_failed: information request requires exact next step' USING ERRCODE='22023'; END IF;
  IF action='reject' AND value->'next_step' IS NOT NULL AND jsonb_typeof(value->'next_step') NOT IN ('null','string')
   THEN RAISE EXCEPTION 'review_validation_failed: rejection next step must be null or string' USING ERRCODE='22023'; END IF;
  IF action='request_info' AND EXISTS(SELECT 1 FROM jsonb_array_elements(value->'missing_fields') AS missing(value) WHERE jsonb_typeof(missing.value) IS DISTINCT FROM 'string' OR NULLIF(btrim(missing.value#>>'{}'),'') IS NULL)
   THEN RAISE EXCEPTION 'review_validation_failed: missing fields must be nonblank strings' USING ERRCODE='22023'; END IF;
  IF action='reject' AND EXISTS(SELECT 1 FROM jsonb_object_keys(value) k WHERE k NOT IN ('reason','next_step')) THEN RAISE EXCEPTION 'review_validation_failed: invalid rejection' USING ERRCODE='22023'; END IF;
  IF action='link_existing' AND (NOT(value ? 'product_id') OR EXISTS(SELECT 1 FROM jsonb_object_keys(value) k WHERE k<>'product_id')) THEN RAISE EXCEPTION 'review_validation_failed: invalid existing product link' USING ERRCODE='22023'; END IF;
  -- Freeze the research lease before human disposition; stale workers cannot complete.
  UPDATE public.product_intake_research_jobs SET status=CASE WHEN action='request_info' THEN 'blocked' ELSE 'cancelled' END,
    locked_by=NULL,locked_at=NULL,completed_at=clock_timestamp(),last_error=CASE WHEN action='request_info' THEN 'awaiting_customer_information' ELSE 'human_disposition' END
    WHERE submission_id=s.id AND status NOT IN ('done','cancelled');
  IF action='request_info' THEN changed:=public.product_intake_request_more_info(s.id,p_request->>'reviewed_by',value->>'reason',value->>'next_step',value->'missing_fields',now(),p_request->>'comment');
  ELSIF action='reject' THEN changed:=public.product_intake_reject_submission(s.id,p_request->>'reviewed_by',value->>'reason',value->>'next_step',now(),p_request->>'comment');
  ELSE changed:=public.product_intake_link_existing_product(s.id,(value->>'product_id')::uuid,p_request->>'reviewed_by',now(),p_request->>'comment'); END IF;
  SELECT * INTO s FROM public.product_submissions WHERE id=s.id;
 END IF;
 INSERT INTO public.product_intake_review_decisions(submission_id,job_id,field_path,decision,reviewer_value,comment,reviewed_by,
  payload_revision,payload_sha256,approved_asset_sha256,request_id,request_digest,review_cycle_id,review_source,review_action,proposed_value,
  notification_status,notification_snapshot)
 VALUES(s.id,j.id,field,decision_value,value,p_request->>'comment',p_request->>'reviewed_by',s.payload_revision,s.payload_sha256,
  p_request->>'approved_asset_sha256',(p_request->>'request_id')::uuid,digest,j.review_cycle_id,'admin',action,CASE WHEN pins IS NULL THEN NULL ELSE jsonb_build_object('engine',pins) END,
  CASE WHEN action IN ('request_info','reject','link_existing') THEN 'pending' ELSE NULL END,
  CASE WHEN action IN ('request_info','reject','link_existing') THEN to_jsonb(s) ELSE NULL END) RETURNING * INTO d;
 IF action IN ('answer','rework','approve_raw') THEN
  IF j.status NOT IN ('waiting_for_review','waiting_for_rework','blocked','failed') THEN RAISE EXCEPTION 'review_validation_failed: job is busy or closed for explicit rework' USING ERRCODE='23514'; END IF;
  SELECT * INTO j FROM public.product_intake_request_rework_job(s.id,jsonb_build_object('review_decision_id',d.id,'review_comment',p_request->>'comment'));
  IF action='approve_raw' THEN
   UPDATE public.product_intake_research_jobs SET status='queued',stage='image_judging',
    progress=progress||jsonb_build_object('next_step','process_image_for_final_review','raw_image_approved_at',clock_timestamp(),
     'review_decision_id',d.id,'approved_raw_asset_id',asset.id,'approved_raw_asset_sha256',asset.sha256,'approved_raw_payload_revision',asset.payload_revision,'source','admin_review')
    WHERE id=j.id RETURNING * INTO j;
  ELSE
   -- Ordinary human rework must not carry authority for an older raw rendition.
   UPDATE public.product_intake_research_jobs
    SET progress=progress-ARRAY['approved_raw_asset_id','approved_raw_asset_sha256','approved_raw_payload_revision']
    WHERE id=j.id RETURNING * INTO j;
  END IF;
 ELSE SELECT * INTO j FROM public.product_intake_research_jobs WHERE id=j.id; END IF;
 RETURN jsonb_build_object('decision',to_jsonb(d),'submission',to_jsonb(s),'job',CASE WHEN j.id IS NULL THEN NULL ELSE to_jsonb(j) END);
END $$;

-- Only this transaction may create the durable proof for a genuinely no-job
-- package. Service callers cannot fabricate decisions through table writes.
CREATE OR REPLACE FUNCTION public.product_intake_guard_review_asset()
RETURNS trigger LANGUAGE plpgsql SET search_path='pg_catalog','public' AS $$
DECLARE current_revision integer; owning_submission uuid; owning_status text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.job_id IS NOT NULL AND NEW.job_id IS NULL AND (to_jsonb(NEW)-'job_id')=(to_jsonb(OLD)-'job_id')
   AND NOT EXISTS(SELECT 1 FROM public.product_intake_research_jobs WHERE id=OLD.job_id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'review_validation_failed: review assets are immutable' USING ERRCODE='22023';
 END IF;
 SELECT payload_revision INTO current_revision FROM public.product_submissions WHERE id=NEW.submission_id FOR UPDATE;
 IF NEW.job_id IS NULL AND current_revision=NEW.payload_revision
  AND NOT EXISTS(SELECT 1 FROM public.product_intake_research_jobs WHERE submission_id=NEW.submission_id)
  AND EXISTS(SELECT 1 FROM public.product_intake_review_decisions WHERE submission_id=NEW.submission_id AND payload_revision=NEW.payload_revision
   AND review_source='legacy_package' AND review_action='approve_data' AND request_id IS NOT NULL)
 THEN RETURN NEW; END IF;
 SELECT submission_id,status INTO owning_submission,owning_status FROM public.product_intake_research_jobs WHERE id=NEW.job_id FOR UPDATE;
 IF NEW.job_id IS NULL OR owning_submission IS DISTINCT FROM NEW.submission_id OR owning_status IS DISTINCT FROM 'running' OR current_revision IS DISTINCT FROM NEW.payload_revision
 THEN RAISE EXCEPTION 'review_validation_failed: review asset requires the current submission revision and owning running job' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.product_intake_register_legacy_review(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb; s public.product_submissions; d public.product_intake_review_decisions; i public.product_intake_review_decisions;
 digest text; a jsonb; image_id uuid:=gen_random_uuid(); final_hash text; no_image boolean;
BEGIN
 PERFORM public.product_intake_review_request_check(p_request,ARRAY['review_assets','approve_data','approve_image','no_image','comment']);
 digest:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
 SELECT * INTO s FROM public.product_submissions WHERE id=(p_request->>'submission_id')::uuid FOR UPDATE;
 SELECT * INTO d FROM public.product_intake_review_decisions WHERE request_id=(p_request->>'request_id')::uuid;
 IF d.id IS NOT NULL THEN
  IF d.request_digest IS DISTINCT FROM digest OR d.review_source IS DISTINCT FROM 'legacy_package' THEN RAISE EXCEPTION 'review_validation_failed: legacy review replay does not match' USING ERRCODE='22023'; END IF;
  SELECT * INTO i FROM public.product_intake_review_decisions WHERE id=(d.proposed_value->>'legacy_image_decision_id')::uuid;
  RETURN jsonb_build_object('data_decision',to_jsonb(d),'image_decision',to_jsonb(i),'submission',to_jsonb(s));
 END IF;
 context:=public.product_intake_review_context(p_request,true);
 SELECT * INTO s FROM jsonb_populate_record(NULL::public.product_submissions,context->'submission');
 IF s.status<>'ready_for_review' OR p_request->'approve_data' IS DISTINCT FROM 'true'::jsonb OR p_request->'approve_image' IS DISTINCT FROM 'true'::jsonb
  OR jsonb_typeof(p_request->'no_image') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_request->'review_assets') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'review_validation_failed: legacy exact data and image approvals required' USING ERRCODE='22023'; END IF;
 no_image:=(p_request->>'no_image')::boolean;
 IF no_image THEN
  IF NULLIF(btrim(p_request->>'comment'),'') IS NULL THEN RAISE EXCEPTION 'review_validation_failed: no-image reason required' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_request->'review_assets')<>0 OR s.researched_payload#>'{final,product,image_url}' IS DISTINCT FROM 'null'::jsonb
   OR s.researched_payload#>'{final,product,canonical_image_sha256}' IS DISTINCT FROM 'null'::jsonb OR s.researched_payload#>'{final,product,thumbnail_image_url}' IS DISTINCT FROM 'null'::jsonb
  THEN RAISE EXCEPTION 'review_validation_failed: legacy no-image requires explicit null metadata and no assets' USING ERRCODE='22023'; END IF;
 ELSE
  SELECT value->>'sha256' INTO final_hash FROM jsonb_array_elements(p_request->'review_assets') WHERE value->>'kind'='final';
  IF final_hash IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_request->'review_assets') WHERE value->>'kind'='search_thumbnail')
  THEN RAISE EXCEPTION 'review_validation_failed: legacy private final and thumbnail required' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.product_intake_review_decisions(submission_id,field_path,decision,reviewed_by,payload_revision,payload_sha256,request_id,request_digest,review_source,review_action,proposed_value,comment)
 VALUES(s.id,'final.properties','approved',p_request->>'reviewed_by',s.payload_revision,s.payload_sha256,(p_request->>'request_id')::uuid,digest,'legacy_package','approve_data',jsonb_build_object('legacy_image_decision_id',image_id),p_request->>'comment') RETURNING * INTO d;
 INSERT INTO public.product_intake_review_decisions(id,submission_id,field_path,decision,reviewed_by,payload_revision,payload_sha256,approved_asset_sha256,review_source,review_action,reviewer_value,comment)
 VALUES(image_id,s.id,'final.image','image_approved',p_request->>'reviewed_by',s.payload_revision,s.payload_sha256,final_hash,'legacy_package','approve_image',CASE WHEN no_image THEN '{"no_image":true}'::jsonb ELSE NULL END,p_request->>'comment') RETURNING * INTO i;
 FOR a IN SELECT value FROM jsonb_array_elements(p_request->'review_assets') LOOP
  IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'review_validation_failed: invalid legacy asset' USING ERRCODE='22023'; END IF;
  IF NOT(a ?& ARRAY['kind','sha256','storage_key','media_type','byte_length']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(a) k WHERE k NOT IN ('kind','sha256','storage_key','media_type','byte_length'))
   OR jsonb_typeof(a->'byte_length') IS DISTINCT FROM 'number' OR (a->>'byte_length')::numeric <> trunc((a->>'byte_length')::numeric)
  THEN RAISE EXCEPTION 'review_validation_failed: invalid legacy asset manifest' USING ERRCODE='22023'; END IF;
  INSERT INTO public.product_intake_review_assets(submission_id,payload_revision,job_id,kind,sha256,storage_key,media_type,byte_length)
   VALUES(s.id,s.payload_revision,NULL,a->>'kind',a->>'sha256',a->>'storage_key',a->>'media_type',(a->>'byte_length')::numeric::bigint);
 END LOOP;
 RETURN jsonb_build_object('data_decision',to_jsonb(d),'image_decision',to_jsonb(i),'submission',to_jsonb(s));
END $$;

-- Preserve the complete catalog chain as private delegates, rather than copying
-- or weakening its category, identifier, protocol and owner-isolation guards.
ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid,jsonb,jsonb,text,timestamptz,text)
 RENAME TO product_intake_approve_catalog_private;
ALTER FUNCTION public.product_intake_approve_bondbuilder_owner_v1(uuid,uuid,jsonb,jsonb,text,timestamptz,text)
 RENAME TO product_intake_approve_bondbuilder_private;
-- The independently reviewed scan-expansion executor is the sole separate caller.
-- Replace exactly its known internal call, retaining every other byte/settings.
DO $delegate$
DECLARE definition text; old_call text:='public.product_intake_approve_reviewed_product('; new_call text:='public.product_intake_approve_catalog_private(';
BEGIN
 definition:=pg_get_functiondef('public.apply_scan_expansion_batch_v1(text,text,text,text,text,boolean)'::regprocedure);
 IF (length(definition)-length(replace(definition,old_call,'')))/length(old_call)<>1 THEN
  RAISE EXCEPTION 'review_validation_failed: scan expansion catalog delegate lineage changed';
 END IF;
 EXECUTE replace(definition,old_call,new_call);
END $delegate$;

CREATE FUNCTION public.product_intake_publish_reviewed_submission(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.product_submissions; j public.product_intake_research_jobs; receipt public.product_intake_publication_receipts;
 context jsonb; preflight jsonb; digest text; result jsonb; stored_final jsonb; supplied_final jsonb; image jsonb:=p_request->'public_image'; prefix text:='https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/'; legacy boolean;
BEGIN
 PERFORM public.product_intake_review_request_check(p_request,ARRAY['data_decision_id','image_decision_id','final_payload','spec_operations','public_image','confirm','owner_default']);
 IF p_request->'confirm' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_request->'owner_default') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(p_request->'final_payload') IS DISTINCT FROM 'object' OR jsonb_typeof(p_request->'spec_operations') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'review_validation_failed: publication exact confirmation and validated payload required' USING ERRCODE='22023'; END IF;
 digest:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
 SELECT * INTO s FROM public.product_submissions WHERE id=(p_request->>'submission_id')::uuid FOR UPDATE;
 SELECT * INTO receipt FROM public.product_intake_publication_receipts WHERE submission_id=s.id OR request_id=(p_request->>'request_id')::uuid;
 IF receipt.id IS NOT NULL THEN
  IF receipt.request_id IS DISTINCT FROM (p_request->>'request_id')::uuid OR receipt.request_digest IS DISTINCT FROM digest
  THEN RAISE EXCEPTION 'review_validation_failed: publication replay does not match existing receipt' USING ERRCODE='22023'; END IF;
  SELECT * INTO j FROM public.product_intake_research_jobs WHERE id=receipt.job_id;
  RETURN jsonb_build_object('publication',to_jsonb(receipt),'submission',to_jsonb(s),'job',CASE WHEN j.id IS NULL THEN NULL ELSE to_jsonb(j) END);
 END IF;
 legacy:=p_request->>'job_id' IS NULL;
 context:=public.product_intake_review_context(p_request,legacy);
 SELECT * INTO s FROM jsonb_populate_record(NULL::public.product_submissions,context->'submission');
 SELECT * INTO j FROM jsonb_populate_record(NULL::public.product_intake_research_jobs,NULLIF(context->'job','null'::jsonb));
 preflight:=public.product_intake_review_preflight(s.id);
 IF preflight->'ok' IS DISTINCT FROM 'true'::jsonb OR preflight->>'data_decision_id' IS DISTINCT FROM p_request->>'data_decision_id'
  OR preflight->>'image_decision_id' IS DISTINCT FROM p_request->>'image_decision_id'
 THEN RAISE EXCEPTION 'review_validation_failed: publication preflight or approval binding failed' USING ERRCODE='23514'; END IF;
 stored_final:=s.researched_payload->'final'; supplied_final:=p_request->'final_payload';
 IF (stored_final #- '{product,image_url}' #- '{product,canonical_image_sha256}' #- '{product,thumbnail_image_url}')
  IS DISTINCT FROM (supplied_final #- '{product,image_url}' #- '{product,canonical_image_sha256}' #- '{product,thumbnail_image_url}')
 THEN RAISE EXCEPTION 'review_validation_failed: publication payload differs from approved research' USING ERRCODE='22023'; END IF;
 IF preflight->'no_image'='true'::jsonb THEN
  IF image IS DISTINCT FROM 'null'::jsonb AND image IS NOT NULL THEN RAISE EXCEPTION 'review_validation_failed: publication no-image handoff must be null' USING ERRCODE='22023'; END IF;
  IF supplied_final#>'{product,image_url}' IS DISTINCT FROM 'null'::jsonb OR supplied_final#>'{product,canonical_image_sha256}' IS DISTINCT FROM 'null'::jsonb
   OR supplied_final#>'{product,thumbnail_image_url}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'review_validation_failed: publication no-image metadata changed' USING ERRCODE='22023'; END IF;
 ELSE
  IF jsonb_typeof(image) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'review_validation_failed: publication verified image handoff required' USING ERRCODE='22023'; END IF;
  IF NOT(image ?& ARRAY['canonical_url','canonical_sha256','thumbnail_url','thumbnail_sha256']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(image) k WHERE k NOT IN ('canonical_url','canonical_sha256','thumbnail_url','thumbnail_sha256'))
   OR image->>'canonical_sha256' IS DISTINCT FROM preflight->>'approved_asset_sha256'
   OR image->>'thumbnail_sha256' IS DISTINCT FROM preflight#>>'{thumbnail_asset,sha256}'
   OR image->>'canonical_url' IS DISTINCT FROM prefix||'product-intake/review/'||(image->>'canonical_sha256')||'.webp'
   OR image->>'thumbnail_url' IS DISTINCT FROM prefix||'thumbnails/search-v1/'||(image->>'canonical_sha256')||'.webp'
   OR supplied_final#>>'{product,image_url}' IS DISTINCT FROM image->>'canonical_url'
   OR supplied_final#>>'{product,canonical_image_sha256}' IS DISTINCT FROM image->>'canonical_sha256'
   OR supplied_final#>>'{product,thumbnail_image_url}' IS DISTINCT FROM image->>'thumbnail_url'
  THEN RAISE EXCEPTION 'review_validation_failed: publication public image does not match approved bytes' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_request->'owner_default'='true'::jsonb THEN
  result:=public.product_intake_approve_bondbuilder_private(s.id,s.user_id,supplied_final,p_request->'spec_operations',p_request->>'reviewed_by',now(),NULL);
 ELSE result:=public.product_intake_approve_catalog_private(s.id,supplied_final,p_request->'spec_operations',p_request->>'reviewed_by',now(),NULL); END IF;
 UPDATE public.products SET suitable_thicknesses=ARRAY(
  SELECT DISTINCT thickness FROM (
   SELECT jsonb_array_elements_text(COALESCE(supplied_final#>'{product,suitable_thicknesses}','[]'::jsonb)) thickness
   -- Oil's product thicknesses and eligibility rows were reviewed separately in the Lab.
   UNION ALL SELECT row->>'thickness' FROM jsonb_array_elements(p_request->'spec_operations') operation,
    jsonb_array_elements(operation->'rows') row WHERE s.category<>'oil'
  ) AS approved_values WHERE thickness IN ('fine','normal','coarse') ORDER BY thickness
 ) WHERE id=(result->>'product_id')::uuid;
 IF p_request->'owner_default'='true'::jsonb AND EXISTS(SELECT 1 FROM public.products WHERE id=(result->>'product_id')::uuid AND cardinality(suitable_thicknesses)>0)
 THEN RAISE EXCEPTION 'publication_owner_isolation_failed: owner default cannot acquire global thickness eligibility'; END IF;
 INSERT INTO public.product_intake_publication_receipts(request_id,request_digest,submission_id,product_id,brand_id,product_line_id,job_id,review_cycle_id,
  payload_revision,payload_sha256,persisted_payload_revision,persisted_payload_sha256,data_decision_id,image_decision_id,approved_asset_sha256,public_image,reviewed_by,notification_snapshot)
 SELECT (p_request->>'request_id')::uuid,digest,s.id,(result->>'product_id')::uuid,(result->>'brand_id')::uuid,(result->>'product_line_id')::uuid,j.id,j.review_cycle_id,
  s.payload_revision,s.payload_sha256,saved.payload_revision,saved.payload_sha256,(p_request->>'data_decision_id')::uuid,(p_request->>'image_decision_id')::uuid,
  preflight->>'approved_asset_sha256',image,p_request->>'reviewed_by',to_jsonb(saved) FROM public.product_submissions saved WHERE saved.id=s.id RETURNING * INTO receipt;
 UPDATE public.product_intake_research_jobs SET status='done',stage='notify',locked_by=NULL,locked_at=NULL,completed_at=clock_timestamp()
  WHERE submission_id=s.id AND status NOT IN ('done','cancelled');
 SELECT * INTO s FROM public.product_submissions WHERE id=s.id;
 SELECT * INTO j FROM public.product_intake_research_jobs WHERE id=j.id;
 RETURN jsonb_build_object('publication',to_jsonb(receipt),'submission',to_jsonb(s),'job',CASE WHEN j.id IS NULL THEN NULL ELSE to_jsonb(j) END);
END $$;

CREATE FUNCTION public.product_intake_finish_review_notification(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt public.product_intake_publication_receipts; decision public.product_intake_review_decisions; next_status text:=p_request->>'status'; target uuid;
BEGIN
 IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR ((p_request->>'publication_id' IS NOT NULL)::integer+(p_request->>'decision_id' IS NOT NULL)::integer)<>1
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN ('publication_id','decision_id','status','message_id','error_code'))
  OR next_status IS NULL OR next_status NOT IN ('sent','failed','not_required')
  OR (next_status='sent' AND p_request->>'message_id' IS NULL)
 THEN RAISE EXCEPTION 'review_validation_failed: notification invalid completion request' USING ERRCODE='22023'; END IF;
 IF p_request->>'publication_id' IS NOT NULL THEN
  target:=(p_request->>'publication_id')::uuid;
  SELECT * INTO receipt FROM public.product_intake_publication_receipts WHERE id=target FOR UPDATE;
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'review_validation_failed: notification publication not found' USING ERRCODE='02000'; END IF;
  IF receipt.notification_status='sent' THEN RETURN jsonb_build_object('publication',to_jsonb(receipt)); END IF;
  UPDATE public.product_intake_publication_receipts SET notification_status=next_status,notification_message_id=(p_request->>'message_id')::uuid,
   notification_error_code=CASE WHEN next_status='failed' THEN left(p_request->>'error_code',160) ELSE NULL END WHERE id=target RETURNING * INTO receipt;
  RETURN jsonb_build_object('publication',to_jsonb(receipt));
 ELSE
  target:=(p_request->>'decision_id')::uuid;
  SELECT * INTO decision FROM public.product_intake_review_decisions WHERE id=target FOR UPDATE;
  IF decision.id IS NULL OR decision.notification_status IS NULL THEN RAISE EXCEPTION 'review_validation_failed: notification decision not found' USING ERRCODE='02000'; END IF;
  IF decision.notification_status='sent' THEN RETURN jsonb_build_object('decision',to_jsonb(decision)); END IF;
  UPDATE public.product_intake_review_decisions SET notification_status=next_status,notification_message_id=(p_request->>'message_id')::uuid,
   notification_error_code=CASE WHEN next_status='failed' THEN left(p_request->>'error_code',160) ELSE NULL END WHERE id=target RETURNING * INTO decision;
  RETURN jsonb_build_object('decision',to_jsonb(decision));
 END IF;
END $$;

DO $permissions$
DECLARE fn regprocedure;
BEGIN
 FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND
  (proname LIKE 'product_intake_approve_%' OR proname LIKE 'product_intake_link_existing_product%'
  OR proname IN ('product_intake_request_more_info','product_intake_reject_submission') OR proname IN ('product_intake_review_request_check','product_intake_review_context',
  'product_intake_record_review_decision','product_intake_register_legacy_review','product_intake_review_preflight','product_intake_publish_reviewed_submission','product_intake_finish_review_notification'))
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',fn); END LOOP;
END $permissions$;
GRANT EXECUTE ON FUNCTION public.product_intake_record_review_decision(jsonb),public.product_intake_register_legacy_review(jsonb),public.product_intake_review_preflight(uuid),
 public.product_intake_publish_reviewed_submission(jsonb),public.product_intake_finish_review_notification(jsonb) TO service_role;
