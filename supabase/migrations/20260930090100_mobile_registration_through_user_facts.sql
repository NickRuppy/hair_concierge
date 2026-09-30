-- Central user profile, clean switch task 4 (plans/2026-09-30-central-user-profile-clean-switch.md
-- §4): iOS registration / profile completion saves its facts through `public.user_facts_save_v1`
-- inside its own transaction instead of writing hair_profiles columns.
--
-- Supersedes `mobile_registration_publish` from 20260917063827_mobile_registration_publication.sql
-- (applied in production, therefore not edited in place). Its only caller is
-- src/lib/mobile/registration-completion.ts, so there is no column-patch branch left: the
-- former `p_patch` (a whitelisted column patch) is replaced, in the same position, by `p_facts`
-- — `{"diagnostics": {"patch", "provenance"}, "quiz_context"?: {...}}` built by
-- src/lib/mobile/profile-facts-patch.ts — and handed to the door by
-- `public.mobile_profile_facts_save_v1` (20260930090000), which passes the row's current
-- `facts_revision` as the expected revision.
--
-- What TypeScript decides and what SQL enforces: the "latest own quiz wins" rule and the
-- completeness defaults live only in TypeScript (`quizSupersedesFacts`,
-- `quizWinnerDiagnosticsWrite`, shared with the web account link), and they need the stored
-- document, which TypeScript read through `scanner_context_read_source` in the same request.
-- This function enforces that nothing changed since that read: the scanner clock CAS
-- (`p_expected_profile_revision`) moves on EVERY hair_profiles change including every door
-- write, so a facts write TypeScript did not see makes the publish a `profile_conflict`.
--
-- Modes:
--   create   no row yet; p_facts required (full document); the door creates the row.
--   replace  existing row; p_facts required (full replacement; + quiz_context clearing when the
--            profile has one from an earlier artifact, F4).
--   missing  p_facts names only the missing answers; NULL when nothing is missing (then nothing
--            is written, exactly like the former empty patch). May create the row.
--   keep     p_facts must be NULL; writes nothing.
--
-- Door status -> outcome: ok -> continue; revision_conflict -> the whole publication rolls
-- back and returns {"outcome":"profile_conflict"} (never a partial or dropped write); anything
-- else raises (caller bug) -> rollback, the client sees a 503.
--
-- Scanner clock deltas (source revision / profile_revision), old -> new:
--   create                     +2 / +1  ->  +3 / +2   (door INSERT + door UPDATE, then the lead)
--   replace                    +2 / +1  ->  +2 / +1   (one door UPDATE, then the lead)
--   replace clearing a quiz_context      ->  +3 / +2   (a second door UPDATE)
--   missing, row exists        +1 / +1  ->  +1 / +1
--   missing, no row yet        +1 / +1  ->  +2 / +2
--   keep                        0 /  0  ->   0 /  0
-- The creating paths' own CAS below expects exactly those deltas. Every client reads the
-- returned profileRevision as an opaque token; nothing adds to it.

DROP FUNCTION public.mobile_registration_publish(
  uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,jsonb,text,text,jsonb,jsonb,text);

CREATE FUNCTION public.mobile_registration_publish(
 p_user_id uuid,p_request_id uuid,p_request_hash text,p_mode text,
 p_attempt_id uuid,p_send_generation uuid,p_email text,p_submission_hash text,
 p_expected_profile_revision bigint,p_expected_source_revision bigint,
 p_facts jsonb,p_quiz_answers jsonb,p_lead_id uuid,p_submission jsonb,
 p_source_hash text,p_engine_version text,p_input_snapshot jsonb,p_output_snapshot jsonb,p_snapshot_source text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_profile jsonb; v_clock public.scanner_context_sources; v_receipt jsonb;
 v_created boolean := false; v_delta integer := 0; v_saved jsonb; v_publication jsonb; v_result jsonb; v_consent jsonb;
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
  OR (p_mode='keep' AND p_facts IS NOT NULL)
  OR (p_mode IN ('create','replace') AND jsonb_typeof(p_facts) IS DISTINCT FROM 'object')
  OR (p_mode <> 'keep' AND jsonb_typeof(p_quiz_answers) IS DISTINCT FROM 'object')
  OR jsonb_typeof(p_input_snapshot->'source') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_input_snapshot->'userRefinementAnswers') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_input_snapshot->'userRefinementQuestionIds') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'invalid_registration_publication'; END IF;
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
 IF v_profile IS NULL THEN
  IF p_facts IS NULL THEN RETURN jsonb_build_object('outcome','profile_required'); END IF;
  -- The door creates the row (its own INSERT ... ON CONFLICT DO NOTHING, expected revision 0)
  -- and then writes it: one clock bump for the INSERT plus one per door write. A concurrent
  -- creator that won the absent-row race is caught by the door's CAS (its row carries a facts
  -- revision) or by the clock CAS below; either way everything rolls back.
  v_saved := public.mobile_profile_facts_save_v1(p_user_id,p_facts,false);
  IF v_saved->>'status' <> 'ok' THEN RAISE EXCEPTION 'registration_cas_conflict' USING ERRCODE='P0002'; END IF;
  SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id;
  v_created := true;
  v_delta := 1 + (v_saved->>'writes')::integer;
 END IF;
 INSERT INTO public.scanner_context_sources(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
 IF v_clock.profile_revision IS DISTINCT FROM p_expected_profile_revision + v_delta
  OR v_clock.revision IS DISTINCT FROM p_expected_source_revision + v_delta
 THEN RAISE EXCEPTION 'registration_cas_conflict' USING ERRCODE='P0002'; END IF;
 IF p_mode <> 'keep' THEN
  IF NOT v_created AND p_facts IS NOT NULL THEN
   v_saved := public.mobile_profile_facts_save_v1(p_user_id,p_facts,p_mode='replace');
   IF v_saved->>'status' <> 'ok' THEN RAISE EXCEPTION 'registration_cas_conflict' USING ERRCODE='P0002'; END IF;
   SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id;
  END IF;
  -- Identical explicit replacements still establish a new source authority. A no-op here
  -- whenever the door wrote the row (its trigger already moved the clock).
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
 -- The exception block rolls back even an absent-profile INSERT (the door's) and its clock
 -- trigger before returning the conflict. No orphan profile, facts or partial consent.
 RETURN jsonb_build_object('outcome','profile_conflict');
END;
$$;
REVOKE ALL ON FUNCTION public.mobile_registration_publish(uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,jsonb,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_registration_publish(uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,jsonb,text,text,jsonb,jsonb,text) TO service_role;
