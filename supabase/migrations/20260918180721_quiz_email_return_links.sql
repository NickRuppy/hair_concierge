-- Service-only bearer credentials for Customer.io returning-quiz links.
-- This is deliberately distinct from personal_plan_result_returns: that table
-- backs a same-browser flow and must not be rotated by email delivery.
CREATE TABLE public.quiz_email_return_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  source_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_key text NOT NULL CHECK (campaign_key = btrim(campaign_key) AND campaign_key <> ''),
  package_key text NOT NULL CHECK (package_key = btrim(package_key) AND package_key <> ''),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT quiz_email_return_links_timestamp_order
    CHECK (expires_at > created_at AND (revoked_at IS NULL OR revoked_at >= created_at)),
  CONSTRAINT quiz_email_return_links_expiry_bound
    CHECK (expires_at <= created_at + interval '720 hours')
);

CREATE INDEX quiz_email_return_links_source_lead_id_idx
  ON public.quiz_email_return_links (source_lead_id);
CREATE INDEX quiz_email_return_links_expiry_idx
  ON public.quiz_email_return_links (expires_at);

ALTER TABLE public.quiz_email_return_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_email_return_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quiz_email_return_links TO service_role;

-- The function returns only the bound lead and trusted package. It does not
-- consume the reusable credential, mutate a visit counter, or return PII.
CREATE FUNCTION public.resolve_quiz_email_return_link(p_token_hash text)
RETURNS TABLE (link_id uuid, lead_id uuid, quiz_kind text, campaign_key text, package_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;

  RETURN QUERY
    SELECT link.id, link.source_lead_id, lead.quiz_kind, link.campaign_key, link.package_key
      FROM public.quiz_email_return_links AS link
      JOIN public.leads AS lead ON lead.id = link.source_lead_id
     WHERE link.token_hash = p_token_hash
       AND link.revoked_at IS NULL
       AND link.expires_at > pg_catalog.now()
       AND lead.quiz_kind IN ('legacy', 'personal_plan')
       AND lead.quiz_answers IS NOT NULL;
END; $$;

CREATE FUNCTION public.resolve_quiz_email_return_link_by_id(p_link_id uuid)
RETURNS TABLE (link_id uuid, lead_id uuid, quiz_kind text, campaign_key text, package_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
    SELECT link.id, link.source_lead_id, lead.quiz_kind, link.campaign_key, link.package_key
      FROM public.quiz_email_return_links AS link
      JOIN public.leads AS lead ON lead.id = link.source_lead_id
     WHERE link.id = p_link_id
       AND link.revoked_at IS NULL
       AND link.expires_at > pg_catalog.now()
       AND lead.quiz_kind IN ('legacy', 'personal_plan')
       AND lead.quiz_answers IS NOT NULL;
END; $$;

REVOKE ALL ON FUNCTION public.resolve_quiz_email_return_link(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_quiz_email_return_link_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_quiz_email_return_link(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_quiz_email_return_link_by_id(uuid) TO service_role;
