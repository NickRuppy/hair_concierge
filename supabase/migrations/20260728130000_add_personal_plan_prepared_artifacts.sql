CREATE TABLE IF NOT EXISTS public.personal_plan_prepared_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_hash text NOT NULL CHECK (answer_hash ~ '^[0-9a-f]{64}$'),
  claim_token_hash text NOT NULL UNIQUE CHECK (claim_token_hash ~ '^[0-9a-f]{64}$'),
  quiz_answers jsonb NOT NULL,
  canonical_profile jsonb NOT NULL,
  fallback_metadata jsonb NOT NULL,
  priorities jsonb NOT NULL,
  diagnostic_scores jsonb NOT NULL,
  public_offer_model jsonb NOT NULL,
  locked_plan jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'attached', 'superseded')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_by uuid REFERENCES public.personal_plan_prepared_artifacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  attached_at timestamptz,
  user_attached_at timestamptz,
  CONSTRAINT personal_plan_prepared_artifact_attachment_check CHECK (
    (status = 'prepared' AND lead_id IS NULL AND attached_at IS NULL AND superseded_by IS NULL)
    OR (status = 'attached' AND lead_id IS NOT NULL AND attached_at IS NOT NULL AND superseded_by IS NULL)
    OR (status = 'superseded' AND lead_id IS NOT NULL AND attached_at IS NOT NULL AND superseded_by IS NOT NULL)
  )
);

ALTER TABLE public.personal_plan_prepared_artifacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS personal_plan_prepared_artifacts_expiry_idx
  ON public.personal_plan_prepared_artifacts (expires_at)
  WHERE status = 'prepared';

CREATE INDEX IF NOT EXISTS personal_plan_prepared_artifacts_answer_hash_idx
  ON public.personal_plan_prepared_artifacts (answer_hash, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS personal_plan_prepared_artifacts_attached_lead_idx
  ON public.personal_plan_prepared_artifacts (lead_id)
  WHERE status = 'attached';

CREATE OR REPLACE FUNCTION public.purge_expired_personal_plan_artifacts(
  p_limit integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT artifacts.id
      FROM public.personal_plan_prepared_artifacts AS artifacts
     WHERE (
       artifacts.status = 'prepared'
       AND artifacts.expires_at < now()
     ) OR (
       artifacts.status = 'superseded'
       AND artifacts.attached_at < now() - interval '1 day'
     )
     ORDER BY artifacts.expires_at ASC
     LIMIT LEAST(GREATEST(p_limit, 1), 500)
     FOR UPDATE SKIP LOCKED
  ),
  deleted AS (
    DELETE FROM public.personal_plan_prepared_artifacts AS artifacts
     USING candidates
     WHERE artifacts.id = candidates.id
     RETURNING artifacts.id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_personal_plan_lead_with_artifact(
  p_email text,
  p_marketing_consent boolean,
  p_quiz_answers jsonb,
  p_artifact_id uuid,
  p_claim_token_hash text,
  p_answer_hash text
)
RETURNS TABLE (lead_id uuid, reused boolean, artifact_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_artifact public.personal_plan_prepared_artifacts%ROWTYPE;
  canonical_artifact_id uuid;
  matched_lead_id uuid;
  lead_was_reused boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('personal_plan:' || lower(btrim(p_email)), 0)
  );

  SELECT artifacts.*
    INTO claimed_artifact
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.id = p_artifact_id
     AND artifacts.claim_token_hash = p_claim_token_hash
   FOR UPDATE;

  IF claimed_artifact.id IS NULL THEN
    RAISE EXCEPTION 'invalid personal-plan artifact claim' USING ERRCODE = '22023';
  END IF;
  IF claimed_artifact.answer_hash <> p_answer_hash
     OR claimed_artifact.quiz_answers <> p_quiz_answers THEN
    RAISE EXCEPTION 'personal-plan answer hash mismatch' USING ERRCODE = '22023';
  END IF;
  IF claimed_artifact.status = 'prepared' AND claimed_artifact.expires_at <= now() THEN
    RAISE EXCEPTION 'personal-plan artifact claim expired' USING ERRCODE = '22023';
  END IF;

  IF claimed_artifact.status IN ('attached', 'superseded') THEN
    SELECT leads.id
      INTO matched_lead_id
      FROM public.leads
     WHERE leads.id = claimed_artifact.lead_id
       AND leads.quiz_kind = 'personal_plan'
       AND leads.email = lower(btrim(p_email))
       AND leads.quiz_answers = p_quiz_answers
     FOR UPDATE;

    IF matched_lead_id IS NULL THEN
      RAISE EXCEPTION 'personal-plan artifact already belongs to another lead'
        USING ERRCODE = '23505';
    END IF;

    UPDATE public.leads
       SET marketing_consent = p_marketing_consent
     WHERE leads.id = matched_lead_id
       AND leads.marketing_consent IS DISTINCT FROM p_marketing_consent;

    RETURN QUERY
      SELECT matched_lead_id,
             true,
             CASE
               WHEN claimed_artifact.status = 'superseded'
                 THEN claimed_artifact.superseded_by
               ELSE claimed_artifact.id
             END;
    RETURN;
  END IF;

  SELECT leads.id
    INTO matched_lead_id
    FROM public.leads
   WHERE leads.quiz_kind = 'personal_plan'
     AND leads.email = lower(btrim(p_email))
     AND leads.created_at >= now() - interval '15 minutes'
     AND leads.quiz_answers = p_quiz_answers
   ORDER BY leads.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF matched_lead_id IS NULL THEN
    INSERT INTO public.leads (
      name,
      email,
      marketing_consent,
      quiz_answers,
      quiz_kind,
      status
    )
    VALUES (
      '',
      lower(btrim(p_email)),
      p_marketing_consent,
      p_quiz_answers,
      'personal_plan',
      'captured'
    )
    RETURNING leads.id INTO matched_lead_id;
  ELSE
    lead_was_reused := true;
    UPDATE public.leads
       SET marketing_consent = p_marketing_consent
     WHERE leads.id = matched_lead_id
       AND leads.marketing_consent IS DISTINCT FROM p_marketing_consent;
  END IF;

  SELECT artifacts.id
    INTO canonical_artifact_id
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.lead_id = matched_lead_id
     AND artifacts.answer_hash = p_answer_hash
     AND artifacts.status = 'attached'
   ORDER BY artifacts.attached_at ASC, artifacts.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF canonical_artifact_id IS NOT NULL THEN
    UPDATE public.personal_plan_prepared_artifacts
       SET status = 'superseded',
           lead_id = matched_lead_id,
           attached_at = now(),
           superseded_by = canonical_artifact_id
     WHERE id = claimed_artifact.id;
    RETURN QUERY SELECT matched_lead_id, true, canonical_artifact_id;
    RETURN;
  END IF;

  UPDATE public.personal_plan_prepared_artifacts
     SET status = 'attached',
         lead_id = matched_lead_id,
         attached_at = now()
   WHERE id = claimed_artifact.id;

  RETURN QUERY SELECT matched_lead_id, lead_was_reused, claimed_artifact.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_personal_plan_artifact_to_user(
  p_lead_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  artifact_id uuid,
  canonical_profile jsonb,
  fallback_metadata jsonb,
  locked_plan jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  artifact public.personal_plan_prepared_artifacts%ROWTYPE;
BEGIN
  SELECT artifacts.*
    INTO artifact
    FROM public.personal_plan_prepared_artifacts AS artifacts
   WHERE artifacts.lead_id = p_lead_id
     AND artifacts.status = 'attached'
   FOR UPDATE;

  IF artifact.id IS NULL THEN
    RAISE EXCEPTION 'personal-plan artifact not found for lead' USING ERRCODE = 'P0002';
  END IF;
  IF artifact.user_id IS NOT NULL AND artifact.user_id <> p_user_id THEN
    RAISE EXCEPTION 'personal-plan artifact belongs to another user' USING ERRCODE = '23505';
  END IF;

  IF artifact.user_id IS NULL THEN
    UPDATE public.personal_plan_prepared_artifacts
       SET user_id = p_user_id,
           user_attached_at = now()
     WHERE id = artifact.id;
  END IF;

  RETURN QUERY
    SELECT artifact.id, artifact.canonical_profile, artifact.fallback_metadata, artifact.locked_plan;
END;
$$;

REVOKE ALL ON TABLE public.personal_plan_prepared_artifacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_personal_plan_artifacts(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_personal_plan_lead_with_artifact(
  text, boolean, jsonb, uuid, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_personal_plan_artifact_to_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.personal_plan_prepared_artifacts TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_personal_plan_artifacts(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.save_personal_plan_lead_with_artifact(
  text, boolean, jsonb, uuid, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_personal_plan_artifact_to_user(uuid, uuid)
  TO service_role;
