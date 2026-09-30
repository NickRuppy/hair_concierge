-- Central user profile, clean switch task 3 (plans/2026-09-30-central-user-profile-clean-switch.md
-- §4): the iOS profile edit (and, since task 5, the web profile editors) save their facts through
-- `public.user_facts_save_v1` inside this function's transaction instead of writing hair_profiles
-- columns.
--
-- Supersedes `scanner_profile_edit_publish` from 20260916175239_hosted_mobile_profile_edit.sql
-- (applied in production, therefore not edited in place). The column patch is gone: the former
-- `p_patch` (a hair_profiles column patch written by a dynamic UPDATE) is replaced, in the same
-- position, by the required `p_facts` — `{"diagnostics": {"patch", "provenance"}}` built by
-- src/lib/mobile/profile-facts-patch.ts (iOS edit) or src/lib/hair-profile/profile-answers.ts
-- (web editors) — which is handed to the door exactly once, with the row's current
-- `facts_revision` (read under this function's row lock) as the expected revision. The door
-- derives the legacy columns; nothing here writes a fact column. (Its last column-patch caller,
-- `PUT /api/profile`, was deleted in clean-switch fix round 1.)
--
-- Door status -> this function's outcome:
--   ok                 -> publication continues as before ("ready").
--   revision_conflict  -> {"outcome":"profile_conflict"} with nothing written (unreachable under
--                         the row lock, kept so a future caller change cannot drop an edit).
--   anything else      -> RAISE (invalid_input / draft_conflict / preserved are caller bugs);
--                         the whole publication rolls back and the client sees a 503.
--
-- Scanner clock arithmetic is unchanged: +1 revision / +1 profile_revision per publish. The
-- door's single UPDATE of the row always changes it (facts_revision), so the AFTER trigger
-- `scanner_context_source_changed` bumps the clock once and the explicit bump below, guarded by
-- the pre-read profile_revision, is a no-op — exactly the path an old non-no-op edit took.

-- ---------------------------------------------------------------------------
-- Internal: apply `p_facts` through the door. Shared with mobile_registration_publish
-- (20260930090100). Not callable by any role: only the SECURITY DEFINER publishers (running as
-- the owner) call it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.mobile_profile_facts_save_v1(
  p_user_id uuid,
  p_facts jsonb,
  p_allow_quiz_context boolean
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_revision integer;
  v_domain text;
  v_part jsonb;
  v_result jsonb;
  v_writes integer := 0;
BEGIN
  IF pg_catalog.jsonb_typeof(p_facts) IS DISTINCT FROM 'object'
     OR NOT (p_facts ? 'diagnostics')
     OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_object_keys(p_facts) AS k
        WHERE k NOT IN ('diagnostics', 'quiz_context'))
     OR (p_facts ? 'quiz_context' AND NOT p_allow_quiz_context) THEN
    RAISE EXCEPTION 'invalid_profile_facts';
  END IF;

  -- The row's current revision, under the caller's row lock (NULL row -> 0: the door creates it).
  SELECT h.facts_revision INTO v_revision
    FROM public.hair_profiles AS h WHERE h.user_id = p_user_id FOR UPDATE;
  v_revision := COALESCE(v_revision, 0);

  -- Diagnostics first, then quiz_context — the account link's order.
  FOREACH v_domain IN ARRAY ARRAY['diagnostics', 'quiz_context'] LOOP
    CONTINUE WHEN NOT (p_facts ? v_domain);
    v_part := p_facts -> v_domain;
    IF pg_catalog.jsonb_typeof(v_part) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_object_keys(v_part) AS k
          WHERE k NOT IN ('patch', 'provenance'))
       OR pg_catalog.jsonb_typeof(v_part -> 'patch') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_part -> 'provenance') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid_profile_facts';
    END IF;

    v_result := public.user_facts_save_v1(
      p_user_id, v_domain, v_part -> 'patch', v_part -> 'provenance', v_revision, 'upsert');
    IF v_result ->> 'status' = 'revision_conflict' THEN
      -- A conflict AFTER a completed door write must never come back as a status: a caller
      -- without an EXCEPTION block (scanner_profile_edit_publish) could RETURN on it and commit
      -- the half-written facts. Raise instead; the whole publication rolls back (P0002 is the
      -- registration publisher's profile_conflict).
      IF v_writes > 0 THEN
        RAISE EXCEPTION 'profile_facts_partial_conflict' USING ERRCODE = 'P0002';
      END IF;
      RETURN pg_catalog.jsonb_build_object('status', 'revision_conflict', 'writes', v_writes);
    ELSIF v_result ->> 'status' IS DISTINCT FROM 'ok' THEN
      RAISE EXCEPTION 'profile_facts_rejected' USING DETAIL = v_result::text;
    END IF;
    v_revision := (v_result ->> 'revision')::integer;
    v_writes := v_writes + 1;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('status', 'ok', 'writes', v_writes, 'revision', v_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.mobile_profile_facts_save_v1(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- scanner_profile_edit_publish, superseded.
-- ---------------------------------------------------------------------------
DROP FUNCTION public.scanner_profile_edit_publish(
  uuid, uuid, text, bigint, bigint, jsonb, jsonb, text, text, jsonb, jsonb, text);

CREATE FUNCTION public.scanner_profile_edit_publish(
  p_user_id uuid,p_request_id uuid,p_request_hash text,
  p_expected_profile_revision bigint,p_expected_source_revision bigint,
  p_facts jsonb,p_quiz_answers jsonb,p_source_hash text,p_engine_version text,
  p_input_snapshot jsonb,p_output_snapshot jsonb,p_snapshot_source text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_clock public.scanner_context_sources; v_profile jsonb; v_receipt jsonb;
  v_context jsonb; v_published jsonb; v_result jsonb; v_facts jsonb;
BEGIN
  -- Existing web writes lock hair_profiles then their AFTER trigger locks the
  -- clock. Match that order; never take the clock and then wait on a profile.
  SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id FOR UPDATE;
  v_receipt := public.scanner_profile_edit_receipt(p_user_id,p_request_id,p_request_hash);
  IF v_receipt IS NOT NULL THEN RETURN v_receipt; END IF;
  IF v_profile IS NULL THEN RETURN jsonb_build_object('outcome','profile_required'); END IF;
  SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_clock.profile_revision IS DISTINCT FROM p_expected_profile_revision
    OR v_clock.revision IS DISTINCT FROM p_expected_source_revision THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
  IF p_request_id IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_facts) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_quiz_answers) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_input_snapshot->'source') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_input_snapshot->'userRefinementAnswers') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_input_snapshot->'userRefinementQuestionIds') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'invalid_profile_edit'; END IF;
  -- One door call; the door writes the facts and derives the columns.
  v_facts := public.mobile_profile_facts_save_v1(p_user_id,p_facts,false);
  IF v_facts->>'status' = 'revision_conflict' THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
  SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id;
  -- Even accepting identical basics establishes a new authority boundary and
  -- must invalidate a pre-edit paid binding (including ABA/no-op edits).
  UPDATE public.scanner_context_sources SET revision=revision+1,profile_revision=profile_revision+1
    WHERE user_id=p_user_id AND profile_revision=v_clock.profile_revision;
  SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id;
  v_published := public.scanner_context_publish(p_user_id,v_clock.revision,p_source_hash,p_engine_version,p_input_snapshot,p_output_snapshot,p_snapshot_source);
  IF v_published->>'outcome' IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'profile_edit_publication_failed'; END IF;
  SELECT to_jsonb(c) INTO v_context FROM public.scanner_context_versions c WHERE id=(v_published->>'contextRevision')::uuid AND user_id=p_user_id;
  INSERT INTO public.scanner_profile_edits(user_id,profile_revision,context_version_id,quiz_answers,profile_snapshot)
    VALUES(p_user_id,v_clock.profile_revision,(v_published->>'contextRevision')::uuid,p_quiz_answers,v_profile)
    ON CONFLICT(user_id) DO UPDATE SET profile_revision=excluded.profile_revision,context_version_id=excluded.context_version_id,quiz_answers=excluded.quiz_answers,profile_snapshot=excluded.profile_snapshot;
  v_result := jsonb_build_object('outcome','ready','profileRevision',v_clock.profile_revision::text,'contextRevision',v_published->>'contextRevision','profile',v_profile,'quizAnswers',p_quiz_answers,'context',v_context);
  INSERT INTO public.scanner_profile_edit_receipts(user_id,request_id,request_hash,result) VALUES(p_user_id,p_request_id,p_request_hash,v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.scanner_profile_edit_publish(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scanner_profile_edit_publish(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text) TO service_role;
