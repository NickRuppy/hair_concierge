-- Retain repaired predecessors: their captured answers remain immutable provenance.
ALTER TABLE public.personal_plan_prepared_artifacts
  ADD COLUMN retained_for_return_repair boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.personal_plan_return_fact_valid(p_key text, p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE allowed text[]; item jsonb;
BEGIN
  allowed := CASE p_key
    WHEN 'texture' THEN ARRAY['straight','wavy','curly','coily']
    WHEN 'thickness' THEN ARRAY['fine','normal','coarse']
    WHEN 'density' THEN ARRAY['low','medium','high']
    WHEN 'hairLength' THEN ARRAY['very_short','short','medium','long','very_long']
    WHEN 'hairSurface' THEN ARRAY['smooth','slightly_uneven','rough']
    WHEN 'elasticResponse' THEN ARRAY['stretches_bounces','stretches_stays','snaps']
    WHEN 'scalpOiliness' THEN ARRAY['oily','balanced','dry']
    WHEN 'goals' THEN ARRAY['moisture','frizz_surface','shine','shape_definition','strength_ends','scalp_balance','manageability_styling','volume_balance']
    WHEN 'chemicalTreatments' THEN ARRAY['natural','colored','lightened','permed','chemically_straightened']
    ELSE NULL END;
  IF allowed IS NULL THEN RETURN false; END IF;
  IF p_key IN ('goals','chemicalTreatments') THEN
    IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    IF jsonb_array_length(p_value) = 0 THEN RETURN false; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
      IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR NOT ((item #>> '{}') = ANY(allowed)) THEN RETURN false; END IF;
    END LOOP;
    IF (SELECT count(*) <> count(DISTINCT value) FROM jsonb_array_elements(p_value)) THEN RETURN false; END IF;
    IF p_key = 'chemicalTreatments' AND p_value ? 'natural' AND jsonb_array_length(p_value) > 1 THEN RETURN false; END IF;
    RETURN true;
  END IF;
  RETURN coalesce(jsonb_typeof(p_value) = 'string' AND (p_value #>> '{}') = ANY(allowed), false);
END;
$$;

-- Serialize Stage1 inserts against supersession. A plain reference check in the
-- repair RPC cannot protect against an insert that already read the old source.
CREATE FUNCTION public.guard_personal_plan_return_artifact_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE source public.personal_plan_prepared_artifacts%ROWTYPE;
BEGIN
  IF NEW.prepared_artifact_source_id IS NOT NULL THEN
    SELECT a.* INTO source FROM public.personal_plan_prepared_artifacts a
      WHERE a.id = NEW.prepared_artifact_source_id FOR SHARE;
    IF source.id IS NULL OR source.status <> 'attached' OR source.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'personal-plan artifact is not an attached owner source' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER personal_plan_return_artifact_source_guard
  BEFORE INSERT ON public.personal_plan_need_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_personal_plan_return_artifact_source();

-- Explicit post-access repair; supersede only facts that were missing/invalid.
CREATE FUNCTION public.repair_return_personal_plan_artifact(
  p_lead_id uuid,
  p_user_id uuid,
  p_expected_quiz_answers jsonb,
  p_answer_hash text,
  p_claim_token_hash text,
  p_canonical_profile jsonb,
  p_fallback_metadata jsonb,
  p_priorities jsonb,
  p_diagnostic_scores jsonb,
  p_public_offer_model jsonb,
  p_locked_plan jsonb
)
RETURNS TABLE(status text, artifact_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  source public.leads%ROWTYPE;
  existing public.personal_plan_prepared_artifacts%ROWTYPE;
  inserted_id uuid;
  changed_key text;
BEGIN
  SELECT l.* INTO source FROM public.leads l WHERE l.id = p_lead_id FOR UPDATE;
  IF source.id IS NULL OR p_user_id IS NULL OR source.user_id IS DISTINCT FROM p_user_id
     OR source.quiz_kind IS DISTINCT FROM 'personal_plan' THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid;
    RETURN;
  END IF;
  IF p_expected_quiz_answers IS NULL OR source.quiz_answers IS DISTINCT FROM p_expected_quiz_answers THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT a.* INTO existing FROM public.personal_plan_prepared_artifacts a
   WHERE a.lead_id = p_lead_id AND a.status = 'attached' FOR UPDATE;
  IF existing.id IS NOT NULL THEN
    IF existing.user_id IS NOT NULL AND existing.user_id <> p_user_id THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
      RETURN;
    END IF;
    IF existing.quiz_answers = p_expected_quiz_answers AND existing.answer_hash = p_answer_hash THEN
      IF existing.user_id IS NULL THEN
        UPDATE public.personal_plan_prepared_artifacts SET user_id = p_user_id, user_attached_at = now() WHERE id = existing.id;
      END IF;
      RETURN QUERY SELECT 'already_present'::text, existing.id;
      RETURN;
    END IF;
    IF (existing.quiz_answers - 'answers') IS DISTINCT FROM (p_expected_quiz_answers - 'answers')
       OR jsonb_typeof(existing.quiz_answers->'answers') IS DISTINCT FROM 'object'
       OR existing.quiz_answers = p_expected_quiz_answers
       OR EXISTS (SELECT 1 FROM public.personal_plan_need_versions WHERE prepared_artifact_source_id = existing.id) THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
      RETURN;
    END IF;
    FOR changed_key IN
      SELECT key FROM jsonb_object_keys((existing.quiz_answers->'answers') || (p_expected_quiz_answers->'answers')) AS keys(key)
      WHERE (existing.quiz_answers->'answers'->key) IS DISTINCT FROM (p_expected_quiz_answers->'answers'->key)
    LOOP
      -- This accepts cumulative missing-fact patches, but no edit of a valid fact
      -- and no incidental change to context, optional answers, kind or version.
      IF public.personal_plan_return_fact_valid(changed_key, existing.quiz_answers->'answers'->changed_key)
         OR NOT public.personal_plan_return_fact_valid(changed_key, p_expected_quiz_answers->'answers'->changed_key) THEN
        RETURN QUERY SELECT 'conflict'::text, NULL::uuid;
        RETURN;
      END IF;
    END LOOP;
  END IF;

  IF p_expected_quiz_answers->>'kind' IS DISTINCT FROM 'personal_plan'
     OR (p_expected_quiz_answers->>'version') NOT IN ('2', '3')
     OR (p_expected_quiz_answers->>'version') IS NULL
     OR p_answer_hash IS NULL OR p_answer_hash !~ '^[0-9a-f]{64}$'
     OR p_claim_token_hash IS NULL OR p_claim_token_hash !~ '^[0-9a-f]{64}$'
     OR p_canonical_profile->>'modelVersion' IS DISTINCT FROM 'personal_plan_canonical_v1'
     OR p_public_offer_model->>'modelVersion' IS DISTINCT FROM 'personal_plan_offer_v2'
     OR p_locked_plan->>'modelVersion' IS DISTINCT FROM 'personal_plan_locked_v1'
     OR jsonb_typeof(p_fallback_metadata) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_priorities) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_diagnostic_scores) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid personal-plan repair payload' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.personal_plan_prepared_artifacts (
    answer_hash, claim_token_hash, quiz_answers, canonical_profile, fallback_metadata,
    priorities, diagnostic_scores, public_offer_model, locked_plan, status,
    lead_id, user_id, attached_at, user_attached_at, expires_at
  ) VALUES (
    p_answer_hash, p_claim_token_hash, p_expected_quiz_answers, p_canonical_profile, p_fallback_metadata,
    p_priorities, p_diagnostic_scores, p_public_offer_model, p_locked_plan, 'prepared',
    NULL, p_user_id, NULL, now(), now()
  ) RETURNING id INTO inserted_id;
  IF existing.id IS NOT NULL THEN
    UPDATE public.personal_plan_prepared_artifacts SET status = 'superseded',
      superseded_by = inserted_id, retained_for_return_repair = true WHERE id = existing.id;
  END IF;
  UPDATE public.personal_plan_prepared_artifacts SET status = 'attached',
    lead_id = p_lead_id, attached_at = now() WHERE id = inserted_id;
  RETURN QUERY SELECT 'repaired'::text, inserted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_return_personal_plan_artifact(
  uuid, uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_return_personal_plan_artifact(
  uuid, uuid, jsonb, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.personal_plan_return_fact_valid(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_return_fact_valid(text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.guard_personal_plan_return_artifact_source() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_personal_plan_artifacts(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT artifacts.id FROM public.personal_plan_prepared_artifacts AS artifacts
    WHERE NOT artifacts.retained_for_return_repair AND (
      (artifacts.status = 'prepared' AND artifacts.expires_at < now()) OR
      (artifacts.status = 'superseded' AND artifacts.attached_at < now() - interval '1 day')
    )
    ORDER BY artifacts.expires_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 500) FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.personal_plan_prepared_artifacts AS artifacts USING candidates
    WHERE artifacts.id = candidates.id RETURNING artifacts.id
  ) SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;
