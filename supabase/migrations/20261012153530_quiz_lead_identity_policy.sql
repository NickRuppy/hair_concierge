-- PUB-3, security audit 2026-10-09, minimal fix ruled by Nick 2026-10-12.
-- Server-only email existence check, before the new lead is inserted.
CREATE OR REPLACE FUNCTION public.is_known_quiz_lead_email(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(btrim(email)) = lower(btrim(p_email)))
      OR EXISTS (SELECT 1 FROM public.profiles WHERE lower(btrim(email)) = lower(btrim(p_email)))
      OR EXISTS (SELECT 1 FROM public.leads WHERE lower(btrim(email)) = lower(btrim(p_email)));
$$;
REVOKE ALL ON FUNCTION public.is_known_quiz_lead_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_known_quiz_lead_email(text) TO service_role;

CREATE INDEX IF NOT EXISTS leads_normalized_email_idx ON public.leads (lower(btrim(email)));
CREATE INDEX IF NOT EXISTS profiles_normalized_email_idx ON public.profiles (lower(btrim(email)));

-- Missing/old policy is conservative; retries never reconstruct consent authority
-- from submitted email or a later account link.
ALTER TABLE public.customerio_profile_sync_outbox
  ADD COLUMN identity_traits_allowed boolean NOT NULL DEFAULT false;

DROP FUNCTION public.save_personal_plan_lead_with_artifact(text, boolean, jsonb, uuid, text, text);

CREATE OR REPLACE FUNCTION public.save_personal_plan_lead_with_artifact(
  p_email text,
  p_marketing_consent boolean,
  p_quiz_answers jsonb,
  p_artifact_id uuid,
  p_claim_token_hash text,
  p_answer_hash text,
  p_identity_traits_allowed boolean DEFAULT false,
  p_authenticated_same_email boolean DEFAULT false
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
       AND p_authenticated_same_email IS TRUE
       AND leads.marketing_consent IS DISTINCT FROM p_marketing_consent;

    UPDATE public.customerio_profile_sync_outbox
       SET identity_traits_allowed = p_authenticated_same_email IS TRUE
     WHERE customerio_profile_sync_outbox.lead_id = matched_lead_id;

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
       AND p_authenticated_same_email IS TRUE
       AND leads.marketing_consent IS DISTINCT FROM p_marketing_consent;
  END IF;

  UPDATE public.customerio_profile_sync_outbox
     SET identity_traits_allowed = p_authenticated_same_email IS TRUE
                                   OR (p_identity_traits_allowed IS TRUE AND NOT lead_was_reused)
   WHERE customerio_profile_sync_outbox.lead_id = matched_lead_id;

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

REVOKE ALL ON FUNCTION public.save_personal_plan_lead_with_artifact(text, boolean, jsonb, uuid, text, text, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_personal_plan_lead_with_artifact(text, boolean, jsonb, uuid, text, text, boolean, boolean)
  TO service_role;
