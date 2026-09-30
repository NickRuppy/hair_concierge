-- Explicit profile edits are durable scanner authority, independent of paid pointers.
CREATE TABLE public.scanner_profile_edits (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_revision bigint NOT NULL CHECK (profile_revision >= 0),
  context_version_id uuid NOT NULL,
  quiz_answers jsonb NOT NULL CHECK (jsonb_typeof(quiz_answers) = 'object'),
  profile_snapshot jsonb NOT NULL CHECK (jsonb_typeof(profile_snapshot) = 'object'),
  FOREIGN KEY(context_version_id,user_id) REFERENCES public.scanner_context_versions(id,user_id)
);
CREATE TABLE public.scanner_profile_edit_receipts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  PRIMARY KEY(user_id,request_id)
);
-- Bind future paid publications to the profile revision observed in their own
-- transaction. Do not backfill: old snapshots must not acquire new authority.
CREATE TABLE public.scanner_paid_source_bindings (
  need_version_id uuid PRIMARY KEY REFERENCES public.personal_plan_need_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_revision bigint NOT NULL CHECK (profile_revision >= 0)
);
ALTER TABLE public.scanner_profile_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_profile_edit_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_paid_source_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scanner_profile_edits, public.scanner_profile_edit_receipts, public.scanner_paid_source_bindings FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.scanner_profile_edits, public.scanner_profile_edit_receipts, public.scanner_paid_source_bindings TO service_role;
CREATE TRIGGER scanner_profile_edit_receipts_immutable BEFORE UPDATE ON public.scanner_profile_edit_receipts
FOR EACH ROW EXECUTE FUNCTION public.scanner_context_immutable();
CREATE TRIGGER scanner_paid_source_bindings_immutable BEFORE UPDATE ON public.scanner_paid_source_bindings
FOR EACH ROW EXECUTE FUNCTION public.scanner_context_immutable();

CREATE FUNCTION public.scanner_bind_paid_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile bigint;
BEGIN
  INSERT INTO public.scanner_context_sources(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
  SELECT profile_revision INTO v_profile FROM public.scanner_context_sources WHERE user_id=NEW.user_id FOR UPDATE;
  INSERT INTO public.scanner_paid_source_bindings(need_version_id,user_id,profile_revision) VALUES(NEW.id,NEW.user_id,v_profile);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.scanner_bind_paid_source() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scanner_bind_paid_source AFTER INSERT ON public.personal_plan_need_versions
FOR EACH ROW EXECUTE FUNCTION public.scanner_bind_paid_source();

CREATE OR REPLACE FUNCTION public.scanner_context_read_source(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_clock public.scanner_context_sources; v_plan public.personal_plans; v_profile jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RETURN NULL; END IF;
  INSERT INTO public.scanner_context_sources(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_plan FROM public.personal_plans WHERE user_id=p_user_id;
  SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id;
  RETURN jsonb_build_object('userId',p_user_id,'sourceRevision',v_clock.revision::text,'profileRevision',v_clock.profile_revision::text,
    'edit',(SELECT jsonb_build_object('profileRevision',e.profile_revision::text,'quizAnswers',e.quiz_answers,'profile',e.profile_snapshot,'input',c.input_snapshot) FROM public.scanner_profile_edits e JOIN public.scanner_context_versions c ON c.id=e.context_version_id AND c.user_id=e.user_id WHERE e.user_id=p_user_id),
    'paidBindings',COALESCE((SELECT jsonb_object_agg(b.need_version_id::text,b.profile_revision::text) FROM public.scanner_paid_source_bindings b WHERE b.user_id=p_user_id),'{}'::jsonb),
    'profile',v_profile,'plan',CASE WHEN v_plan.id IS NULL THEN NULL ELSE to_jsonb(v_plan) END,
    'initial',(SELECT to_jsonb(n) FROM public.personal_plan_need_versions n WHERE n.id=v_plan.current_initial_need_version_id AND n.personal_plan_id=v_plan.id AND n.user_id=p_user_id AND n.kind='initial'),
    'refined',(SELECT to_jsonb(n) FROM public.personal_plan_need_versions n WHERE n.id=v_plan.current_refined_need_version_id AND n.personal_plan_id=v_plan.id AND n.user_id=p_user_id AND n.kind='refined'),
    'refinements',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM public.personal_plan_refinement_drafts d WHERE d.user_id=p_user_id AND d.personal_plan_id=v_plan.id),'[]'::jsonb),
    'leads',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'user_id',l.user_id,'quiz_kind',l.quiz_kind,'quiz_answers',l.quiz_answers) ORDER BY l.id) FROM public.leads l WHERE l.user_id=p_user_id AND l.quiz_kind='legacy'),'[]'::jsonb));
END;
$$;


CREATE FUNCTION public.scanner_profile_edit_receipt(p_user_id uuid,p_request_id uuid,p_request_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_receipt public.scanner_profile_edit_receipts;
BEGIN
  SELECT * INTO v_receipt FROM public.scanner_profile_edit_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_receipt.request_hash IS DISTINCT FROM p_request_hash THEN RETURN jsonb_build_object('outcome','profile_conflict'); END IF;
  RETURN v_receipt.result;
END;
$$;
CREATE FUNCTION public.scanner_profile_edit_publish(
  p_user_id uuid,p_request_id uuid,p_request_hash text,
  p_expected_profile_revision bigint,p_expected_source_revision bigint,
  p_patch jsonb,p_quiz_answers jsonb,p_source_hash text,p_engine_version text,
  p_input_snapshot jsonb,p_output_snapshot jsonb,p_snapshot_source text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_clock public.scanner_context_sources; v_profile jsonb; v_receipt jsonb;
  v_context jsonb; v_published jsonb; v_columns text; v_result jsonb;
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
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch='{}'::jsonb
    OR jsonb_typeof(p_quiz_answers) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_input_snapshot->'source') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_input_snapshot->'userRefinementAnswers') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_input_snapshot->'userRefinementQuestionIds') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'invalid_profile_edit'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k IN ('id','user_id','created_at','updated_at') OR NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.hair_profiles'::regclass AND a.attname=k AND a.attnum>0 AND NOT a.attisdropped))
    THEN RAISE EXCEPTION 'invalid_profile_edit_patch'; END IF;
  SELECT string_agg(format('%I',k),',' ORDER BY k) INTO v_columns FROM jsonb_object_keys(p_patch) k;
  EXECUTE format('UPDATE public.hair_profiles SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.hair_profiles,$1)), updated_at=clock_timestamp() WHERE user_id=$2 RETURNING to_jsonb(hair_profiles)',v_columns,v_columns)
    INTO v_profile USING v_profile || p_patch,p_user_id;
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
REVOKE ALL ON FUNCTION public.scanner_profile_edit_receipt(uuid,uuid,text), public.scanner_profile_edit_publish(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scanner_profile_edit_receipt(uuid,uuid,text), public.scanner_profile_edit_publish(uuid,uuid,text,bigint,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text) TO service_role;
