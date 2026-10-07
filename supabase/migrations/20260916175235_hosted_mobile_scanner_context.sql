-- Scanner-only derived context. No personal-plan/routine/billing writer is called.
-- A source clock covers INSERT/UPDATE/DELETE (including ABA changes and absent
-- source becoming present), not wall-clock timestamps. Every relevant writer
-- must increment it in the same transaction before its source change commits.
CREATE TABLE public.scanner_context_sources (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  profile_revision bigint NOT NULL DEFAULT 0 CHECK (profile_revision >= 0)
);
CREATE TABLE public.scanner_context_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_revision bigint NOT NULL CHECK (source_revision >= 0),
  profile_revision bigint NOT NULL CHECK (profile_revision >= 0),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  engine_version text NOT NULL CHECK (length(engine_version) > 0),
  snapshot_source text NOT NULL CHECK (snapshot_source IN ('initial','refined')),
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  output_snapshot jsonb NOT NULL CHECK (jsonb_typeof(output_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,user_id),
  UNIQUE(user_id,source_revision,source_hash,engine_version)
);
CREATE TABLE public.scanner_context_heads (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  context_version_id uuid NOT NULL,
  FOREIGN KEY(context_version_id,user_id) REFERENCES public.scanner_context_versions(id,user_id)
);
ALTER TABLE public.scanner_context_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_context_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scanner_context_sources, public.scanner_context_versions, public.scanner_context_heads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.scanner_context_versions, public.scanner_context_heads TO authenticated;
GRANT ALL ON public.scanner_context_sources, public.scanner_context_versions, public.scanner_context_heads TO service_role;
CREATE POLICY scanner_context_versions_owner_read ON public.scanner_context_versions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY scanner_context_heads_owner_read ON public.scanner_context_heads FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE FUNCTION public.scanner_context_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'scanner_context_version_immutable'; END;
$$;
CREATE TRIGGER scanner_context_versions_immutable BEFORE UPDATE ON public.scanner_context_versions
FOR EACH ROW EXECUTE FUNCTION public.scanner_context_immutable();

-- Definer only because ordinary owner profile writes cannot write the service-
-- owned clock. Trigger takes identity exclusively from the actual source row.
CREATE FUNCTION public.scanner_context_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid; v_old_user uuid; v_profile bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - 'updated_at' = to_jsonb(OLD) - 'updated_at' THEN RETURN NEW; END IF;
  v_profile := CASE WHEN TG_TABLE_NAME = 'hair_profiles' THEN 1 ELSE 0 END;
  IF TG_OP <> 'INSERT' THEN v_old_user := OLD.user_id; END IF;
  IF TG_OP <> 'DELETE' THEN v_user := NEW.user_id; ELSE v_user := v_old_user; END IF;
  -- Lock multiple owners in a deterministic order if an approved source-linking
  -- path changes ownership. A deleted account must never recreate a clock.
  FOR v_user IN SELECT DISTINCT x FROM unnest(ARRAY[v_user,v_old_user]) x WHERE x IS NOT NULL ORDER BY x LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
      INSERT INTO public.scanner_context_sources(user_id,revision,profile_revision) VALUES(v_user,1,v_profile)
      ON CONFLICT(user_id) DO UPDATE SET revision = public.scanner_context_sources.revision + 1,
        profile_revision = public.scanner_context_sources.profile_revision + v_profile;
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.scanner_context_source_changed() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE v_table text; BEGIN
  FOREACH v_table IN ARRAY ARRAY['hair_profiles','leads','personal_plans','personal_plan_need_versions','personal_plan_refinement_drafts'] LOOP
    EXECUTE format('CREATE TRIGGER scanner_context_source_changed AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.scanner_context_source_changed()',v_table);
  END LOOP;
END $$;

-- Both APIs are server-only; caller must pass the auth-verified UID. The clock
-- lock is the linearization boundary. Source writers can be uncommitted while
-- waiting for it, so reads see the prior committed source, never a partial one.
CREATE FUNCTION public.scanner_context_read_source(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_clock public.scanner_context_sources; v_plan public.personal_plans; v_profile jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RETURN NULL; END IF;
  INSERT INTO public.scanner_context_sources(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_plan FROM public.personal_plans WHERE user_id=p_user_id;
  SELECT to_jsonb(h) INTO v_profile FROM public.hair_profiles h WHERE user_id=p_user_id;
  RETURN jsonb_build_object('userId',p_user_id,'sourceRevision',v_clock.revision::text,'profileRevision',v_clock.profile_revision::text,
    'profile',v_profile,'plan',CASE WHEN v_plan.id IS NULL THEN NULL ELSE to_jsonb(v_plan) END,
    'initial',(SELECT to_jsonb(n) FROM public.personal_plan_need_versions n WHERE n.id=v_plan.current_initial_need_version_id AND n.personal_plan_id=v_plan.id AND n.user_id=p_user_id AND n.kind='initial'),
    'refined',(SELECT to_jsonb(n) FROM public.personal_plan_need_versions n WHERE n.id=v_plan.current_refined_need_version_id AND n.personal_plan_id=v_plan.id AND n.user_id=p_user_id AND n.kind='refined'),
    'refinements',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM public.personal_plan_refinement_drafts d WHERE d.user_id=p_user_id AND d.personal_plan_id=v_plan.id),'[]'::jsonb),
    'leads',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'user_id',l.user_id,'quiz_kind',l.quiz_kind,'quiz_answers',l.quiz_answers) ORDER BY l.id) FROM public.leads l WHERE l.user_id=p_user_id AND l.quiz_kind='legacy'),'[]'::jsonb));
END;
$$;

CREATE FUNCTION public.scanner_context_publish(p_user_id uuid,p_expected_source_revision bigint,p_source_hash text,p_engine_version text,p_input_snapshot jsonb,p_output_snapshot jsonb,p_snapshot_source text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_clock public.scanner_context_sources; v_context uuid; v_existing public.scanner_context_versions;
BEGIN
  SELECT * INTO v_clock FROM public.scanner_context_sources WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_clock.revision IS DISTINCT FROM p_expected_source_revision THEN RETURN jsonb_build_object('outcome','stale_source'); END IF;
  IF p_source_hash IS NULL OR p_source_hash !~ '^[0-9a-f]{64}$' OR p_engine_version IS NULL OR length(p_engine_version)=0
    OR jsonb_typeof(p_input_snapshot) IS DISTINCT FROM 'object' OR jsonb_typeof(p_output_snapshot) IS DISTINCT FROM 'object'
    OR p_output_snapshot->>'computationVersion' IS DISTINCT FROM p_engine_version
    OR p_snapshot_source IS NULL OR p_snapshot_source NOT IN ('initial','refined') THEN RAISE EXCEPTION 'invalid_scanner_context'; END IF;
  SELECT * INTO v_existing FROM public.scanner_context_versions WHERE user_id=p_user_id AND source_revision=p_expected_source_revision AND source_hash=p_source_hash AND engine_version=p_engine_version;
  IF FOUND THEN
    IF v_existing.input_snapshot IS DISTINCT FROM p_input_snapshot OR v_existing.output_snapshot IS DISTINCT FROM p_output_snapshot OR v_existing.snapshot_source IS DISTINCT FROM p_snapshot_source THEN RAISE EXCEPTION 'scanner_context_input_collision'; END IF;
    v_context := v_existing.id;
  ELSE
    INSERT INTO public.scanner_context_versions(user_id,source_revision,profile_revision,source_hash,engine_version,input_snapshot,output_snapshot,snapshot_source)
    VALUES(p_user_id,p_expected_source_revision,v_clock.profile_revision,p_source_hash,p_engine_version,p_input_snapshot,p_output_snapshot,p_snapshot_source) RETURNING id INTO v_context;
  END IF;
  INSERT INTO public.scanner_context_heads(user_id,context_version_id) VALUES(p_user_id,v_context)
  ON CONFLICT(user_id) DO UPDATE SET context_version_id=excluded.context_version_id;
  RETURN jsonb_build_object('outcome','ready','contextRevision',v_context::text);
END;
$$;
REVOKE ALL ON FUNCTION public.scanner_context_read_source(uuid), public.scanner_context_publish(uuid,bigint,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scanner_context_read_source(uuid), public.scanner_context_publish(uuid,bigint,text,text,jsonb,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION public.scanner_context_immutable() FROM PUBLIC,anon,authenticated;
