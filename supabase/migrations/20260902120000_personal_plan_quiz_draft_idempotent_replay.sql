CREATE OR REPLACE FUNCTION public.update_personal_plan_quiz_draft(
  p_draft_id uuid,
  p_browser_generation integer,
  p_expected_revision integer,
  p_draft jsonb,
  p_allow_revision_catchup boolean DEFAULT false
) RETURNS TABLE (revision integer, browser_generation integer, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved public.personal_plan_quiz_drafts%ROWTYPE;
BEGIN
  SELECT * INTO saved FROM public.personal_plan_quiz_drafts d
   WHERE d.id = p_draft_id AND d.browser_generation = p_browser_generation
     AND d.status = 'active' AND d.expires_at > now()
   FOR UPDATE;
  IF saved.id IS NULL THEN RETURN; END IF;

  IF saved.revision::bigint = p_expected_revision::bigint
    AND saved.revision < 2147483647 THEN
    UPDATE public.personal_plan_quiz_drafts d SET draft = p_draft, revision = d.revision + 1,
      updated_at = now(), expires_at = LEAST(d.created_at + interval '7 days', now() + interval '24 hours')
     WHERE d.id = saved.id RETURNING * INTO saved;
  ELSIF saved.revision::bigint = p_expected_revision::bigint + 1 AND saved.draft = p_draft THEN
    -- An identical cross-document replay is already durable. Do not extend its TTL.
    RETURN QUERY SELECT saved.revision, saved.browser_generation, saved.expires_at;
    RETURN;
  ELSIF p_allow_revision_catchup IS TRUE
    AND saved.revision::bigint = p_expected_revision::bigint + 1
    AND saved.revision < 2147483647 THEN
    UPDATE public.personal_plan_quiz_drafts d SET draft = p_draft, revision = d.revision + 1,
      updated_at = now(), expires_at = LEAST(d.created_at + interval '7 days', now() + interval '24 hours')
     WHERE d.id = saved.id RETURNING * INTO saved;
  ELSE
    RETURN;
  END IF;

  RETURN QUERY SELECT saved.revision, saved.browser_generation, saved.expires_at;
END; $$;

REVOKE ALL ON FUNCTION public.update_personal_plan_quiz_draft(uuid, integer, integer, jsonb, boolean)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_personal_plan_quiz_draft(uuid, integer, integer, jsonb, boolean)
  TO service_role;
