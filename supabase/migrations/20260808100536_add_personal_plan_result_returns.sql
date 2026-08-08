-- Private, service-role-only capability state for same-browser Personal Plan result returns.
CREATE TABLE IF NOT EXISTS public.personal_plan_result_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT personal_plan_result_returns_timestamp_order
    CHECK (expires_at > created_at AND (revoked_at IS NULL OR revoked_at >= created_at)),
  CONSTRAINT personal_plan_result_returns_expiry_bound
    CHECK (expires_at <= created_at + interval '720 hours')
);

CREATE INDEX IF NOT EXISTS personal_plan_result_returns_expiry_idx
  ON public.personal_plan_result_returns (expires_at);
CREATE INDEX IF NOT EXISTS personal_plan_result_returns_revoked_at_idx
  ON public.personal_plan_result_returns (revoked_at);

ALTER TABLE public.personal_plan_result_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_result_returns FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_plan_result_returns TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_personal_plan_result_return(p_token_hash text)
RETURNS TABLE (lead_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;

  RETURN QUERY
    SELECT result_return.lead_id
      FROM public.personal_plan_result_returns AS result_return
      JOIN public.leads AS lead ON lead.id = result_return.lead_id
     WHERE result_return.token_hash = p_token_hash
       AND result_return.revoked_at IS NULL
       AND result_return.expires_at > pg_catalog.now()
       AND lead.quiz_kind = 'personal_plan';
END; $$;

-- Keep expired credentials and revoked credentials only long enough for bounded diagnosis.
CREATE OR REPLACE FUNCTION public.purge_expired_personal_plan_result_returns(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE deleted_count integer;
BEGIN
  WITH candidates AS (
    SELECT result_return.id
      FROM public.personal_plan_result_returns AS result_return
     WHERE result_return.expires_at < pg_catalog.now()
        OR result_return.revoked_at < pg_catalog.now() - interval '1 day'
     ORDER BY result_return.expires_at ASC, result_return.revoked_at ASC
     LIMIT CASE
       WHEN p_limit IS NULL THEN 100
       WHEN p_limit < 1 THEN 1
       WHEN p_limit > 500 THEN 500
       ELSE p_limit
     END
     FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.personal_plan_result_returns AS result_return
     USING candidates
     WHERE result_return.id = candidates.id
     RETURNING result_return.id
  )
  SELECT pg_catalog.count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END; $$;

REVOKE ALL ON FUNCTION public.resolve_personal_plan_result_return(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_personal_plan_result_returns(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_personal_plan_result_return(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_personal_plan_result_returns(integer) TO service_role;
