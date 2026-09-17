-- Service-only atomic native publication. No paid artifacts, campaign dispatch,
-- authentication tokens, or unverified answers are stored by these routines.
CREATE TABLE public.mobile_registration_publication_receipts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  mode text NOT NULL CHECK (mode IN ('create','keep','replace','missing')),
  result jsonb NOT NULL,
  consent jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);
ALTER TABLE public.mobile_registration_publication_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_registration_publication_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mobile_registration_publication_receipts TO service_role;
CREATE TRIGGER mobile_registration_publication_receipts_immutable BEFORE UPDATE ON public.mobile_registration_publication_receipts
FOR EACH ROW EXECUTE FUNCTION public.scanner_context_immutable();

CREATE FUNCTION public.mobile_registration_publication_receipt(
 p_user_id uuid,p_request_id uuid,p_request_hash text,p_mode text,
 p_attempt_id uuid,p_send_generation uuid,p_email text,p_submission_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.mobile_registration_intents; r public.mobile_registration_publication_receipts;
BEGIN
 IF p_mode NOT IN ('create','keep','replace','missing') OR p_mode IS NULL THEN RETURN jsonb_build_object('outcome','invalid_attempt'); END IF;
 IF p_mode <> 'missing' THEN
  SELECT * INTO i FROM public.mobile_registration_intents WHERE id=p_attempt_id;
  IF NOT FOUND OR i.flow <> 'registration' OR i.request_id IS DISTINCT FROM p_request_id
   OR i.request_hash IS DISTINCT FROM p_submission_hash OR i.email IS DISTINCT FROM p_email
   OR i.verified_user_id IS DISTINCT FROM p_user_id OR i.provider_user_id IS DISTINCT FROM p_user_id
   OR i.verified_at IS NULL OR i.send_generation IS DISTINCT FROM p_send_generation
   OR i.superseded_at IS NOT NULL THEN RETURN jsonb_build_object('outcome','invalid_attempt'); END IF;
 END IF;
 SELECT * INTO r FROM public.mobile_registration_publication_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF r.request_hash IS DISTINCT FROM p_request_hash OR r.mode IS DISTINCT FROM p_mode THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
  RETURN r.result;
 END IF;
 IF p_mode <> 'missing' AND i.expires_at <= clock_timestamp() THEN RETURN jsonb_build_object('outcome','invalid_attempt'); END IF;
 RETURN NULL;
END;
$$;

CREATE FUNCTION public.mobile_registration_publish(
 p_user_id uuid,p_request_id uuid,p_request_hash text,p_mode text,
 p_attempt_id uuid,p_send_generation uuid,p_email text,p_submission_hash text,
 p_expected_profile_revision bigint,p_expected_source_revision bigint,
 p_patch jsonb,p_quiz_answers jsonb,p_lead_id uuid,p_submission jsonb,
 p_source_hash text,p_engine_version text,p_input_snapshot jsonb,p_output_snapshot jsonb,p_snapshot_source text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_profile jsonb; v_clock public.scanner_context_sources; v_receipt jsonb;
 v_columns text; v_values text; v_created boolean := false; v_publication jsonb; v_result jsonb; v_consent jsonb;
BEGIN
 -- Serialize absent-row publication as well as existing-row publication. Other
 -- web writers lock hair_profiles then their AFTER trigger locks the clock.
 -- Never hold the clock while waiting to insert/lock the hair profile.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mobile_registration_owner:'||p_user_id::text,0));
 SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id FOR UPDATE;
 IF p_mode <> 'missing' THEN
  PERFORM 1 FROM public.mobile_registration_intents WHERE id=p_attempt_id FOR UPDATE;
 END IF;
 v_receipt := public.mobile_registration_publication_receipt(p_user_id,p_request_id,p_request_hash,p_mode,p_attempt_id,p_send_generation,p_email,p_submission_hash);
 IF v_receipt IS NOT NULL THEN RETURN v_receipt; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RETURN jsonb_build_object('outcome','invalid_attempt'); END IF;
 IF p_mode='create' AND v_profile IS NOT NULL OR p_mode IN ('keep','replace') AND v_profile IS NULL THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
 IF p_request_id IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
  OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
  OR (p_mode <> 'keep' AND jsonb_typeof(p_quiz_answers) IS DISTINCT FROM 'object')
  OR jsonb_typeof(p_input_snapshot->'source') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_input_snapshot->'userRefinementAnswers') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_input_snapshot->'userRefinementQuestionIds') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'invalid_registration_publication'; END IF;
 -- The caller is service-only and uses the canonical projector; bound the SQL
 -- write surface so it cannot overwrite ownership, arbitrary profile columns,
 -- preferences, products, paid links, or consent via the profile patch.
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN (
  'hair_texture','thickness','density','hair_length','cuticle_condition','protein_moisture_balance',
  'scalp_type','scalp_condition','chemical_treatment','concerns','goals','desired_volume'))
 THEN RAISE EXCEPTION 'invalid_registration_patch'; END IF;
 IF p_mode='keep' AND p_patch <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_keep_patch'; END IF;
 IF p_mode <> 'missing' THEN
  IF jsonb_typeof(p_submission) IS DISTINCT FROM 'object'
   OR p_submission->>'requestId' IS DISTINCT FROM p_request_id::text
   OR p_submission->>'email' IS DISTINCT FROM p_email
   OR jsonb_typeof(p_submission->'marketingOptIn') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(p_submission->'firstName') IS DISTINCT FROM 'string'
   OR length(p_submission->>'firstName') NOT BETWEEN 1 AND 100
   OR (p_mode <> 'keep' AND p_submission->'answers' IS DISTINCT FROM p_quiz_answers)
  THEN RAISE EXCEPTION 'invalid_registration_submission'; END IF;
  v_consent := jsonb_build_object('marketingOptIn',p_submission->'marketingOptIn','source','native_registration','submissionHash',p_submission_hash);
 END IF;
 SELECT string_agg(format('%I',k),',' ORDER BY k),string_agg(format('r.%I',k),',' ORDER BY k)
 INTO v_columns,v_values FROM jsonb_object_keys(p_patch) k;
 IF v_profile IS NULL THEN
  IF p_patch='{}'::jsonb THEN RETURN jsonb_build_object('outcome','profile_required'); END IF;
  -- An ordinary writer may win the absent-row race without our advisory lock.
  -- ON CONFLICT waits BEFORE taking the clock, then refuses to replace it.
  EXECUTE format('INSERT INTO public.hair_profiles(user_id,%s) SELECT $2,%s FROM jsonb_populate_record(NULL::public.hair_profiles,$1) r ON CONFLICT(user_id) DO NOTHING RETURNING to_jsonb(hair_profiles)',v_columns,v_values)
   INTO v_profile USING p_patch,p_user_id;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'registration_cas_conflict' USING ERRCODE='P0002'; END IF;
  v_created := true;
 END IF;
 INSERT INTO public.scanner_context_sources(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
 IF v_clock.profile_revision IS DISTINCT FROM p_expected_profile_revision + v_created::int
  OR v_clock.revision IS DISTINCT FROM p_expected_source_revision + v_created::int
 THEN RAISE EXCEPTION 'registration_cas_conflict' USING ERRCODE='P0002'; END IF;
 IF p_mode <> 'keep' THEN
  IF NOT v_created AND p_patch <> '{}'::jsonb THEN
   EXECUTE format('UPDATE public.hair_profiles SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.hair_profiles,$1)),updated_at=clock_timestamp() WHERE user_id=$2 RETURNING to_jsonb(hair_profiles)',v_columns,v_columns)
    INTO v_profile USING v_profile||p_patch,p_user_id;
  END IF;
  -- Identical explicit replacements still establish a new source authority.
  UPDATE public.scanner_context_sources SET revision=revision+1,profile_revision=profile_revision+1
   WHERE user_id=p_user_id AND profile_revision=v_clock.profile_revision AND NOT v_created;
  IF p_mode IN ('create','replace') THEN
   IF p_lead_id IS NULL OR p_input_snapshot->'source'->>'leadId' IS DISTINCT FROM p_lead_id::text THEN RAISE EXCEPTION 'invalid_registration_lead'; END IF;
   INSERT INTO public.leads(id,name,email,marketing_consent,quiz_answers,quiz_kind,status,user_id)
    VALUES(p_lead_id,p_submission->>'firstName',p_email,(p_submission->>'marketingOptIn')::boolean,p_quiz_answers,'legacy','linked',p_user_id);
  END IF;
 END IF;
 SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id;
 v_publication := public.scanner_context_publish(p_user_id,v_clock.revision,p_source_hash,p_engine_version,p_input_snapshot,p_output_snapshot,p_snapshot_source);
 IF v_publication->>'outcome' IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'registration_context_publication_failed'; END IF;
 IF p_mode <> 'keep' THEN
  INSERT INTO public.scanner_profile_edits(user_id,profile_revision,context_version_id,quiz_answers,profile_snapshot)
   VALUES(p_user_id,v_clock.profile_revision,(v_publication->>'contextRevision')::uuid,p_quiz_answers,v_profile)
   ON CONFLICT(user_id) DO UPDATE SET profile_revision=excluded.profile_revision,context_version_id=excluded.context_version_id,quiz_answers=excluded.quiz_answers,profile_snapshot=excluded.profile_snapshot;
 END IF;
 v_result := jsonb_build_object('outcome','ready','status','ready','profileRevision',v_clock.profile_revision::text,'contextRevision',v_publication->>'contextRevision');
 INSERT INTO public.mobile_registration_publication_receipts(user_id,request_id,request_hash,mode,result,consent)
  VALUES(p_user_id,p_request_id,p_request_hash,p_mode,v_result,v_consent);
 IF p_mode <> 'missing' THEN
  INSERT INTO public.mobile_registration_enrollments(user_id,email,ready_at) VALUES(p_user_id,p_email,clock_timestamp())
   ON CONFLICT(user_id) DO UPDATE SET ready_at=COALESCE(public.mobile_registration_enrollments.ready_at,excluded.ready_at)
   WHERE public.mobile_registration_enrollments.email=excluded.email;
  IF NOT FOUND THEN RAISE EXCEPTION 'registration_enrollment_identity_conflict'; END IF;
  UPDATE public.mobile_registration_intents SET completed_at=clock_timestamp(),completion_receipt=v_result WHERE id=p_attempt_id;
  -- Existing-account keep/replace must not silently rename a shared account.
  IF p_mode='create' THEN UPDATE public.profiles SET full_name=p_submission->>'firstName' WHERE id=p_user_id; END IF;
 END IF;
 RETURN v_result;
EXCEPTION WHEN no_data_found THEN
 -- The exception block rolls back even an absent-profile INSERT and its clock
 -- trigger before returning the conflict. No orphan profile or partial consent.
 RETURN jsonb_build_object('outcome','profile_conflict');
END;
$$;
REVOKE ALL ON FUNCTION public.mobile_registration_publication_receipt(uuid,uuid,text,text,uuid,uuid,text,text),public.mobile_registration_publish(uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,jsonb,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_registration_publication_receipt(uuid,uuid,text,text,uuid,uuid,text,text),public.mobile_registration_publish(uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,jsonb,text,text,jsonb,jsonb,text) TO service_role;
