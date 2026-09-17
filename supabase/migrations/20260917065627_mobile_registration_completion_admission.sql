-- Pending keep is post-email-proof consent evidence, never pre-proof quiz storage.
ALTER TABLE public.mobile_registration_intents ADD COLUMN pending_keep jsonb;

CREATE FUNCTION public.mobile_registration_defer_keep(
 p_attempt_id uuid,p_send_generation uuid,p_user_id uuid,p_email text,p_request_hash text,
 p_expected_profile_revision bigint,p_marketing_opt_in boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE i public.mobile_registration_intents; c public.scanner_context_sources; pending jsonb;
BEGIN
 -- Match publication lock order, including concurrent missing/replace edits.
 PERFORM pg_advisory_xact_lock(hashtextextended('mobile_registration_owner:'||p_user_id::text,0));
 PERFORM 1 FROM public.hair_profiles WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
 SELECT * INTO c FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR c.profile_revision IS DISTINCT FROM p_expected_profile_revision THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
 SELECT * INTO i FROM public.mobile_registration_intents WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR i.flow<>'registration' OR i.email IS DISTINCT FROM p_email OR i.request_hash IS DISTINCT FROM p_request_hash
   OR i.send_generation IS DISTINCT FROM p_send_generation OR i.verified_user_id IS DISTINCT FROM p_user_id OR i.provider_user_id IS DISTINCT FROM p_user_id
   OR i.verified_at IS NULL OR i.expires_at<=now() OR i.superseded_at IS NOT NULL OR i.completed_at IS NOT NULL OR p_marketing_opt_in IS NULL THEN
   RETURN jsonb_build_object('outcome','invalid_attempt');
 END IF;
 pending:=jsonb_build_object('choice','keep','submissionHash',p_request_hash,'marketingOptIn',p_marketing_opt_in,'source','native_registration',
   'acknowledgedProfileRevision',p_expected_profile_revision::text,'sendGeneration',p_send_generation::text);
 IF i.pending_keep IS NOT NULL AND i.pending_keep->>'sendGeneration'=p_send_generation::text AND i.pending_keep IS DISTINCT FROM pending THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
 UPDATE public.mobile_registration_intents SET pending_keep=pending WHERE id=i.id;
 RETURN jsonb_build_object('outcome','pending');
END $$;

CREATE FUNCTION public.mobile_registration_enroll_ready(
 p_attempt_id uuid,p_send_generation uuid,p_user_id uuid,p_email text,p_request_hash text,
 p_context_revision uuid,p_profile_revision bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE i public.mobile_registration_intents; c public.scanner_context_sources; v public.scanner_context_versions; result jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('mobile_registration_owner:'||p_user_id::text,0));
 PERFORM 1 FROM public.hair_profiles WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','profile_required'); END IF;
 SELECT * INTO c FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR c.profile_revision IS DISTINCT FROM p_profile_revision THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
 SELECT ver.* INTO v FROM public.scanner_context_heads h JOIN public.scanner_context_versions ver ON ver.id=h.context_version_id AND ver.user_id=h.user_id
   WHERE h.user_id=p_user_id AND h.context_version_id=p_context_revision;
 IF NOT FOUND OR v.source_revision IS DISTINCT FROM c.revision OR v.profile_revision IS DISTINCT FROM c.profile_revision THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
 SELECT * INTO i FROM public.mobile_registration_intents WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR i.email IS DISTINCT FROM p_email OR i.request_hash IS DISTINCT FROM p_request_hash OR i.send_generation IS DISTINCT FROM p_send_generation
   OR i.verified_user_id IS DISTINCT FROM p_user_id OR i.provider_user_id IS DISTINCT FROM p_user_id OR i.verified_at IS NULL
   OR i.superseded_at IS NOT NULL OR (i.expires_at<=now() AND i.completed_at IS NULL)
   OR (i.flow='registration' AND i.completed_at IS NULL AND (i.pending_keep IS NULL OR i.pending_keep->>'sendGeneration' IS DISTINCT FROM p_send_generation::text)) THEN
   RETURN jsonb_build_object('outcome','invalid_attempt');
 END IF;
 INSERT INTO public.mobile_registration_enrollments(user_id,email,ready_at) VALUES(p_user_id,p_email,clock_timestamp())
 ON CONFLICT(user_id) DO UPDATE SET ready_at=COALESCE(public.mobile_registration_enrollments.ready_at,excluded.ready_at)
 WHERE public.mobile_registration_enrollments.email=excluded.email;
 IF NOT FOUND THEN RAISE EXCEPTION 'registration_enrollment_identity_conflict'; END IF;
 result:=jsonb_build_object('status','ready','profileRevision',c.profile_revision::text,'contextRevision',p_context_revision::text);
 UPDATE public.mobile_registration_intents SET completed_at=COALESCE(completed_at,clock_timestamp()),
  completion_receipt=COALESCE(completion_receipt,result||CASE WHEN pending_keep IS NOT NULL THEN jsonb_build_object('consent',pending_keep) ELSE '{}'::jsonb END)
  WHERE id=i.id;
 RETURN jsonb_build_object('outcome','ready');
END $$;
REVOKE ALL ON FUNCTION public.mobile_registration_defer_keep(uuid,uuid,uuid,text,text,bigint,boolean),public.mobile_registration_enroll_ready(uuid,uuid,uuid,text,text,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_registration_defer_keep(uuid,uuid,uuid,text,text,bigint,boolean),public.mobile_registration_enroll_ready(uuid,uuid,uuid,text,text,uuid,bigint) TO service_role;
