-- Private, service-role-only recovery state for the personal-plan quiz.
CREATE TABLE IF NOT EXISTS public.personal_plan_quiz_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_token_hash text NOT NULL UNIQUE CHECK (resume_token_hash ~ '^[0-9a-f]{64}$'),
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  browser_generation integer NOT NULL DEFAULT 1 CHECK (browser_generation >= 1),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  draft jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT personal_plan_quiz_drafts_expiry_bound CHECK (expires_at <= created_at + interval '7 days')
);

CREATE INDEX IF NOT EXISTS personal_plan_quiz_drafts_active_expiry_idx
  ON public.personal_plan_quiz_drafts (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS personal_plan_quiz_drafts_funnel_session_idx
  ON public.personal_plan_quiz_drafts (funnel_session_id);

ALTER TABLE public.personal_plan_quiz_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_quiz_drafts FROM anon, authenticated, public;
GRANT ALL ON TABLE public.personal_plan_quiz_drafts TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_personal_plan_quiz_drafts(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT id FROM public.personal_plan_quiz_drafts
    WHERE expires_at < now() OR (status = 'completed' AND completed_at < now() - interval '1 day')
    ORDER BY expires_at ASC LIMIT LEAST(GREATEST(p_limit, 1), 500) FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.personal_plan_quiz_drafts d USING candidates c WHERE d.id = c.id RETURNING d.id
  ) SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END; $$;

CREATE OR REPLACE FUNCTION public.create_personal_plan_quiz_draft(
  p_funnel_session_id uuid, p_visitor_id uuid, p_package_key text, p_resume_token_hash text, p_draft jsonb
) RETURNS TABLE (draft_id uuid, revision integer, browser_generation integer, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved public.personal_plan_quiz_drafts%ROWTYPE;
BEGIN
  IF p_resume_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid draft credential' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.funnel_sessions s WHERE s.id = p_funnel_session_id AND s.visitor_id = p_visitor_id AND s.package_key = p_package_key) THEN
    RAISE EXCEPTION 'trusted funnel session unavailable' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.personal_plan_quiz_drafts (resume_token_hash, funnel_session_id, draft, expires_at)
  VALUES (p_resume_token_hash, p_funnel_session_id, p_draft, LEAST(now() + interval '24 hours', now() + interval '7 days'))
  RETURNING * INTO saved;
  RETURN QUERY SELECT saved.id, saved.revision, saved.browser_generation, saved.expires_at;
END; $$;

CREATE OR REPLACE FUNCTION public.read_personal_plan_quiz_draft(p_draft_id uuid, p_browser_generation integer)
RETURNS TABLE (draft jsonb, revision integer, browser_generation integer, expires_at timestamptz, resume_token_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT d.draft, d.revision, d.browser_generation, d.expires_at, d.resume_token_hash
    FROM public.personal_plan_quiz_drafts d
   WHERE d.id = p_draft_id AND d.browser_generation = p_browser_generation AND d.status = 'active' AND d.expires_at > now();
END; $$;

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
  UPDATE public.personal_plan_quiz_drafts d SET draft = p_draft, revision = d.revision + 1,
    updated_at = now(), expires_at = LEAST(d.created_at + interval '7 days', now() + interval '24 hours')
   WHERE d.id = p_draft_id AND d.browser_generation = p_browser_generation
     AND (
       d.revision = p_expected_revision OR
       (p_allow_revision_catchup IS TRUE AND d.revision = p_expected_revision + 1)
     )
     AND d.status = 'active' AND d.expires_at > now() RETURNING * INTO saved;
  IF saved.id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT saved.revision, saved.browser_generation, saved.expires_at;
END; $$;

CREATE OR REPLACE FUNCTION public.exchange_personal_plan_quiz_draft(
  p_resume_token_hash text, p_replacement_token_hash text
) RETURNS TABLE (draft_id uuid, draft jsonb, revision integer, browser_generation integer, expires_at timestamptz, visitor_id uuid, session_id uuid, package_key text, funnel_issued_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved public.personal_plan_quiz_drafts%ROWTYPE;
BEGIN
  IF p_resume_token_hash !~ '^[0-9a-f]{64}$' OR p_replacement_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
  SELECT * INTO saved FROM public.personal_plan_quiz_drafts d WHERE d.resume_token_hash = p_resume_token_hash
    AND d.status = 'active' AND d.expires_at > now() FOR UPDATE;
  IF saved.id IS NULL THEN RETURN; END IF;
  UPDATE public.personal_plan_quiz_drafts SET resume_token_hash = p_replacement_token_hash,
    browser_generation = saved.browser_generation + 1, revision = saved.revision + 1, updated_at = now(),
    expires_at = LEAST(saved.created_at + interval '7 days', now() + interval '24 hours') WHERE id = saved.id RETURNING * INTO saved;
  RETURN QUERY SELECT saved.id, saved.draft, saved.revision, saved.browser_generation, saved.expires_at,
    s.visitor_id, s.id, s.package_key, s.first_seen_at FROM public.funnel_sessions s WHERE s.id = saved.funnel_session_id;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_personal_plan_quiz_draft(p_draft_id uuid, p_browser_generation integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.personal_plan_quiz_drafts SET status = 'completed', completed_at = now(), updated_at = now()
   WHERE id = p_draft_id AND browser_generation = p_browser_generation AND status = 'active';
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.purge_expired_personal_plan_quiz_drafts(integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_personal_plan_quiz_draft(uuid, uuid, text, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_personal_plan_quiz_draft(uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_personal_plan_quiz_draft(uuid, integer, integer, jsonb, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.exchange_personal_plan_quiz_draft(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_personal_plan_quiz_draft(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_personal_plan_quiz_drafts(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_personal_plan_quiz_draft(uuid, uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_personal_plan_quiz_draft(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_personal_plan_quiz_draft(uuid, integer, integer, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.exchange_personal_plan_quiz_draft(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_personal_plan_quiz_draft(uuid, integer) TO service_role;
