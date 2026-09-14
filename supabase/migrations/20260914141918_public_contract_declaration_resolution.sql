-- Trusted operator resolution for enrollment-bound trial-cohort contracts only.
-- Submitted email/name are assertions, never matching or cancellation authority.
CREATE TABLE private.public_contract_declaration_matches (
  declaration_id uuid PRIMARY KEY REFERENCES private.public_contract_declarations(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES public.trial_enrollments(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL,
  verification_reference text NOT NULL CHECK(length(btrim(verification_reference)) BETWEEN 1 AND 200),
  matched_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX public_declaration_matches_user_idx ON private.public_contract_declaration_matches(user_id);
CREATE INDEX public_declaration_matches_enrollment_idx ON private.public_contract_declaration_matches(enrollment_id);
CREATE TABLE private.public_contract_declaration_applications (
  declaration_id uuid PRIMARY KEY REFERENCES private.public_contract_declarations(id) ON DELETE RESTRICT,
  trial_declaration_id uuid NOT NULL UNIQUE REFERENCES private.trial_cancellation_declarations(id) ON DELETE RESTRICT,
  interpretation_reference text NOT NULL CHECK(length(btrim(interpretation_reference)) BETWEEN 1 AND 200),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.public_contract_declaration_completions (
  declaration_id uuid PRIMARY KEY REFERENCES private.public_contract_declarations(id) ON DELETE RESTRICT,
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION private.protect_public_declaration_resolution_record() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF TG_TABLE_NAME='public_contract_declaration_matches' AND
   (to_jsonb(NEW)-ARRAY['user_id','enrollment_id'])=(to_jsonb(OLD)-ARRAY['user_id','enrollment_id'])
   AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id OR NEW.user_id IS NULL)
   AND (NEW.enrollment_id IS NOT DISTINCT FROM OLD.enrollment_id OR NEW.enrollment_id IS NULL) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Declaration resolution record is immutable';
END; $$;
CREATE TRIGGER protect_public_declaration_match BEFORE UPDATE ON private.public_contract_declaration_matches
 FOR EACH ROW EXECUTE FUNCTION private.protect_public_declaration_resolution_record();
CREATE TRIGGER protect_public_declaration_application BEFORE UPDATE ON private.public_contract_declaration_applications
 FOR EACH ROW EXECUTE FUNCTION private.protect_public_declaration_resolution_record();
CREATE TRIGGER protect_public_declaration_completion BEFORE UPDATE ON private.public_contract_declaration_completions
 FOR EACH ROW EXECUTE FUNCTION private.protect_public_declaration_resolution_record();
ALTER TABLE private.public_contract_declaration_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.public_contract_declaration_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.public_contract_declaration_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.public_contract_declaration_matches,private.public_contract_declaration_applications,
 private.public_contract_declaration_completions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.public_contract_declaration_matches,private.public_contract_declaration_applications,
 private.public_contract_declaration_completions TO service_role;
-- Private, scoped state columns become writable only with the workflow guards below.
GRANT UPDATE(status,resolved_at,resolution_reference) ON private.public_contract_declaration_reviews TO service_role;

CREATE FUNCTION public.match_public_contract_declaration(p_declaration_id uuid,p_verified_user_id uuid,p_enrollment_id uuid,p_verification_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d private.public_contract_declarations%ROWTYPE; e public.trial_enrollments%ROWTYPE; m private.public_contract_declaration_matches%ROWTYPE;
BEGIN
 IF p_verified_user_id IS NULL OR p_enrollment_id IS NULL OR coalesce(length(btrim(p_verification_reference)),0) NOT BETWEEN 1 AND 200
   THEN RAISE EXCEPTION 'Verified matching reference and owner required'; END IF;
 PERFORM 1 FROM private.public_contract_declaration_reviews WHERE declaration_id=p_declaration_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Declaration review unavailable'; END IF;
 SELECT * INTO d FROM private.public_contract_declarations WHERE id=p_declaration_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Declaration unavailable'; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND OR e.user_id IS DISTINCT FROM p_verified_user_id OR e.authorization_succeeded_at IS NULL OR e.admission_status<>'active'
   THEN RAISE EXCEPTION 'Verified contract owner does not match'; END IF;
 SELECT * INTO m FROM private.public_contract_declaration_matches WHERE declaration_id=d.id;
 IF FOUND THEN
   IF m.user_id IS DISTINCT FROM p_verified_user_id OR m.enrollment_id IS DISTINCT FROM p_enrollment_id OR m.verification_reference IS DISTINCT FROM p_verification_reference
     THEN RAISE EXCEPTION 'Declaration match is immutable'; END IF;
 ELSE
   INSERT INTO private.public_contract_declaration_matches(declaration_id,user_id,enrollment_id,submitted_at,verification_reference)
    VALUES(d.id,e.user_id,e.id,d.submitted_at,p_verification_reference);
   UPDATE private.public_contract_declaration_reviews SET status='in_review' WHERE declaration_id=d.id AND status='pending';
 END IF;
 RETURN jsonb_build_object('declarationId',d.id,'enrollmentId',e.id,'submittedAt',d.submitted_at,'status',(SELECT status FROM private.public_contract_declaration_reviews WHERE declaration_id=d.id));
END; $$;

CREATE FUNCTION public.apply_public_trial_cancellation(p_declaration_id uuid,p_interpretation_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d private.public_contract_declarations%ROWTYPE; m private.public_contract_declaration_matches%ROWTYPE;
 e public.trial_enrollments%ROWTYPE; a private.public_contract_declaration_applications%ROWTYPE; trial_id uuid;
BEGIN
 IF coalesce(length(btrim(p_interpretation_reference)),0) NOT BETWEEN 1 AND 200 THEN
 RAISE EXCEPTION 'Verified requested-end interpretation required'; END IF;
 PERFORM 1 FROM private.public_contract_declaration_reviews WHERE declaration_id=p_declaration_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Declaration review unavailable'; END IF;
 SELECT * INTO d FROM private.public_contract_declarations WHERE id=p_declaration_id;
 SELECT * INTO m FROM private.public_contract_declaration_matches WHERE declaration_id=p_declaration_id;
 IF d.id IS NULL OR m.declaration_id IS NULL OR m.user_id IS NULL OR m.enrollment_id IS NULL THEN
 RAISE EXCEPTION 'Verified declaration match required'; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=m.enrollment_id FOR UPDATE;
 IF e.user_id IS DISTINCT FROM m.user_id OR m.submitted_at IS DISTINCT FROM d.submitted_at THEN
 RAISE EXCEPTION 'Verified declaration owner or timestamp changed'; END IF;
 SELECT * INTO a FROM private.public_contract_declaration_applications WHERE declaration_id=d.id;
 IF FOUND THEN
  IF a.interpretation_reference IS DISTINCT FROM p_interpretation_reference THEN RAISE EXCEPTION 'Declaration application is immutable'; END IF;
  RETURN jsonb_build_object('outcome','provider_operation_queued','trialDeclarationId',a.trial_declaration_id);
 END IF;
 IF EXISTS(SELECT 1 FROM private.public_contract_declaration_completions WHERE declaration_id=d.id) THEN
 RAISE EXCEPTION 'Declaration already completed'; END IF;
 IF d.payload->>'kind'<>'ordinary_cancellation' OR e.admission_status<>'active' OR e.authorization_succeeded_at IS NULL
   OR m.submitted_at<e.authorization_succeeded_at OR m.submitted_at>=e.original_trial_end_at OR e.access_revoked
 THEN RETURN jsonb_build_object('outcome','external_review_required'); END IF;
 -- Payment and cancellation serialize on the same enrollment row. A charge that
 -- won earlier cannot be relabeled as an unpaid canceled trial.
 IF e.first_payment_succeeded_at IS NOT NULL OR EXISTS(SELECT 1 FROM private.trial_payment_events p
   WHERE p.enrollment_id=e.id AND p.outcome='succeeded' AND p.amount_minor>0)
 THEN RETURN jsonb_build_object('outcome','payment_review_required'); END IF;
 UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id;
 INSERT INTO private.trial_cancellation_declarations(enrollment_id,user_id,request_id,submitted_at,effective_end_at)
 VALUES(e.id,e.user_id,d.id,m.submitted_at,e.original_trial_end_at) RETURNING id INTO trial_id;
 INSERT INTO private.trial_cancellation_receipts(declaration_id,user_id) VALUES(trial_id,e.user_id);
 INSERT INTO private.trial_cancellation_provider_operations(declaration_id) VALUES(trial_id);
 INSERT INTO private.public_contract_declaration_applications(declaration_id,trial_declaration_id,interpretation_reference)
 VALUES(d.id,trial_id,p_interpretation_reference);
 RETURN jsonb_build_object('outcome','provider_operation_queued','trialDeclarationId',trial_id);
END; $$;

CREATE FUNCTION public.complete_public_contract_declaration_resolution(p_declaration_id uuid,p_evidence jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d private.public_contract_declarations%ROWTYPE; m private.public_contract_declaration_matches%ROWTYPE;
 e public.trial_enrollments%ROWTYPE; a private.public_contract_declaration_applications%ROWTYPE;
 prior private.public_contract_declaration_completions%ROWTYPE; effective_end timestamptz; successful_payment boolean; timely_trial boolean;
BEGIN
 IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
   OR NOT (p_evidence ?& ARRAY['completionReference','providerTerminationReference','effectiveEndAt','refundDisposition','refundReference','refundAssessmentReference'])
   OR p_evidence-ARRAY['completionReference','providerTerminationReference','effectiveEndAt','refundDisposition','refundReference','refundAssessmentReference']<>'{}'::jsonb
   OR jsonb_typeof(p_evidence->'completionReference')<>'string' OR coalesce(length(btrim(p_evidence->>'completionReference')),0) NOT BETWEEN 1 AND 200
   OR jsonb_typeof(p_evidence->'providerTerminationReference')<>'string' OR coalesce(length(btrim(p_evidence->>'providerTerminationReference')),0) NOT BETWEEN 1 AND 200
   OR jsonb_typeof(p_evidence->'refundAssessmentReference')<>'string' OR coalesce(length(btrim(p_evidence->>'refundAssessmentReference')),0) NOT BETWEEN 1 AND 200
   OR jsonb_typeof(p_evidence->'effectiveEndAt')<>'string' OR p_evidence->>'effectiveEndAt' !~ '^\d{4}-\d{2}-\d{2}T'
   OR jsonb_typeof(p_evidence->'refundDisposition')<>'string'
   OR p_evidence->>'refundDisposition' NOT IN ('not_due','completed')
   OR (p_evidence->>'refundDisposition'='not_due' AND p_evidence->'refundReference'<>'null'::jsonb)
   OR (p_evidence->>'refundDisposition'='completed' AND (jsonb_typeof(p_evidence->'refundReference')<>'string' OR coalesce(length(btrim(p_evidence->>'refundReference')),0) NOT BETWEEN 1 AND 200))
 THEN RAISE EXCEPTION 'Verified provider completion and refund evidence required'; END IF;
 effective_end:=(p_evidence->>'effectiveEndAt')::timestamptz;
 IF NOT isfinite(effective_end) THEN RAISE EXCEPTION 'Invalid completion effective end'; END IF;
 PERFORM 1 FROM private.public_contract_declaration_reviews WHERE declaration_id=p_declaration_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Declaration review unavailable'; END IF;
 SELECT * INTO d FROM private.public_contract_declarations WHERE id=p_declaration_id;
 SELECT * INTO m FROM private.public_contract_declaration_matches WHERE declaration_id=p_declaration_id;
 IF d.id IS NULL OR m.declaration_id IS NULL OR m.user_id IS NULL OR m.enrollment_id IS NULL THEN RAISE EXCEPTION 'Verified match required'; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=m.enrollment_id FOR UPDATE;
 IF e.user_id IS DISTINCT FROM m.user_id OR m.submitted_at IS DISTINCT FROM d.submitted_at THEN RAISE EXCEPTION 'Verified match changed'; END IF;
 SELECT * INTO prior FROM private.public_contract_declaration_completions WHERE declaration_id=d.id;
 IF FOUND THEN
  IF prior.evidence IS DISTINCT FROM p_evidence THEN RAISE EXCEPTION 'Completion evidence is immutable'; END IF;
  RETURN true;
 END IF;
 IF NOT e.cancel_at_period_end AND NOT e.access_revoked THEN RAISE EXCEPTION 'Canonical provider termination must be reconciled before completion'; END IF;
 timely_trial:=d.payload->>'kind'='ordinary_cancellation' AND m.submitted_at>=e.authorization_succeeded_at AND m.submitted_at<e.original_trial_end_at;
 successful_payment:=e.first_payment_succeeded_at IS NOT NULL OR EXISTS(SELECT 1 FROM private.trial_payment_events p WHERE p.enrollment_id=e.id AND p.outcome='succeeded' AND p.amount_minor>0);
 IF effective_end<m.submitted_at THEN RAISE EXCEPTION 'Completion end precedes declaration'; END IF;
 IF timely_trial AND effective_end IS DISTINCT FROM e.original_trial_end_at THEN RAISE EXCEPTION 'Timely trial cancellation keeps original effective end'; END IF;
 IF successful_payment AND (timely_trial OR d.payload->>'kind'='withdrawal') AND p_evidence->>'refundDisposition'<>'completed' THEN
 RAISE EXCEPTION 'Verified refund completion evidence required'; END IF;
 SELECT * INTO a FROM private.public_contract_declaration_applications WHERE declaration_id=d.id;
 IF FOUND AND NOT EXISTS(SELECT 1 FROM private.trial_cancellation_provider_operations p WHERE p.declaration_id=a.trial_declaration_id AND p.status='confirmed') THEN
 RAISE EXCEPTION 'Cancellation provider operation is not confirmed'; END IF;
 INSERT INTO private.public_contract_declaration_completions(declaration_id,evidence) VALUES(d.id,p_evidence);
 UPDATE private.public_contract_declaration_reviews SET status='resolved',resolved_at=clock_timestamp(),resolution_reference=p_evidence->>'completionReference'
 WHERE declaration_id=d.id AND status='in_review';
 IF NOT FOUND THEN RAISE EXCEPTION 'Declaration review transition failed'; END IF;
 RETURN true;
END; $$;

CREATE FUNCTION private.guard_public_declaration_review_resolution() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF OLD.status='resolved' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Declaration review is already resolved'; END IF;
 IF NEW.status='pending' AND OLD.status<>'pending' THEN RAISE EXCEPTION 'Declaration review cannot regress'; END IF;
 IF NEW.status='in_review' AND NOT EXISTS(SELECT 1 FROM private.public_contract_declaration_matches m WHERE m.declaration_id=NEW.declaration_id) THEN
 RAISE EXCEPTION 'Verified match required for review transition'; END IF;
 IF NEW.status='resolved' AND NOT EXISTS(SELECT 1 FROM private.public_contract_declaration_completions c
 WHERE c.declaration_id=NEW.declaration_id AND c.evidence->>'completionReference'=NEW.resolution_reference) THEN
 RAISE EXCEPTION 'Completion evidence required for resolution'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_public_declaration_review_resolution BEFORE UPDATE ON private.public_contract_declaration_reviews
 FOR EACH ROW EXECUTE FUNCTION private.guard_public_declaration_review_resolution();
CREATE FUNCTION public.inspect_public_contract_declaration_resolution(p_declaration_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('declarationId',d.id,'submittedAt',d.submitted_at,'kind',d.payload->>'kind','reviewStatus',r.status,
 'receiptDeliveryStatus',receipt.delivery_status,'match',to_jsonb(m),'application',to_jsonb(a),'completion',to_jsonb(c))
 FROM private.public_contract_declarations d JOIN private.public_contract_declaration_reviews r ON r.declaration_id=d.id
 JOIN private.public_contract_declaration_receipts receipt ON receipt.declaration_id=d.id
 LEFT JOIN private.public_contract_declaration_matches m ON m.declaration_id=d.id
 LEFT JOIN private.public_contract_declaration_applications a ON a.declaration_id=d.id
 LEFT JOIN private.public_contract_declaration_completions c ON c.declaration_id=d.id WHERE d.id=p_declaration_id;
$$;
REVOKE ALL ON FUNCTION private.protect_public_declaration_resolution_record(),private.guard_public_declaration_review_resolution(),
 public.match_public_contract_declaration(uuid,uuid,uuid,text),public.apply_public_trial_cancellation(uuid,text),
 public.complete_public_contract_declaration_resolution(uuid,jsonb),public.inspect_public_contract_declaration_resolution(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_public_declaration_resolution_record(),private.guard_public_declaration_review_resolution(),
 public.match_public_contract_declaration(uuid,uuid,uuid,text),public.apply_public_trial_cancellation(uuid,text),
 public.complete_public_contract_declaration_resolution(uuid,jsonb),public.inspect_public_contract_declaration_resolution(uuid) TO service_role;
