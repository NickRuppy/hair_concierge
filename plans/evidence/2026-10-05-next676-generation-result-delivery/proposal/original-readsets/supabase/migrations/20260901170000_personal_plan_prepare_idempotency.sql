CREATE OR REPLACE FUNCTION public.prepare_personal_plan_artifact(
  p_id uuid,
  p_answer_hash text,
  p_claim_token_hash text,
  p_quiz_answers jsonb,
  p_canonical_profile jsonb,
  p_fallback_metadata jsonb,
  p_priorities jsonb,
  p_diagnostic_scores jsonb,
  p_public_offer_model jsonb,
  p_locked_plan jsonb,
  p_user_id uuid,
  p_expires_at timestamptz
)
RETURNS TABLE (
  artifact_id uuid,
  artifact_expires_at timestamptz,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  existing_artifact public.personal_plan_prepared_artifacts%ROWTYPE;
BEGIN
  IF p_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'personal-plan preparation expiry must be in the future'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-prepare:' || p_id::text, 0)
  );

  SELECT artifacts.*
    INTO existing_artifact
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.id = p_id
   FOR UPDATE;

  IF existing_artifact.id IS NOT NULL THEN
    IF existing_artifact.answer_hash IS DISTINCT FROM p_answer_hash
       OR existing_artifact.claim_token_hash IS DISTINCT FROM p_claim_token_hash
       OR existing_artifact.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'personal-plan preparation replay mismatch'
        USING ERRCODE = '22023';
    END IF;
    IF existing_artifact.status = 'prepared'
       AND existing_artifact.expires_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'personal-plan preparation replay expired'
        USING ERRCODE = '22023';
    END IF;

    RETURN QUERY SELECT existing_artifact.id, existing_artifact.expires_at, true;
    RETURN;
  END IF;

  INSERT INTO public.personal_plan_prepared_artifacts (
    id,
    answer_hash,
    claim_token_hash,
    quiz_answers,
    canonical_profile,
    fallback_metadata,
    priorities,
    diagnostic_scores,
    public_offer_model,
    locked_plan,
    user_id,
    expires_at
  )
  VALUES (
    p_id,
    p_answer_hash,
    p_claim_token_hash,
    p_quiz_answers,
    p_canonical_profile,
    p_fallback_metadata,
    p_priorities,
    p_diagnostic_scores,
    p_public_offer_model,
    p_locked_plan,
    p_user_id,
    p_expires_at
  );

  RETURN QUERY SELECT p_id, p_expires_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_personal_plan_artifact(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_personal_plan_artifact(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  timestamptz
) TO service_role;
