-- OpenAI-only consent and attribution. No changes to existing provider consent semantics.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.openai_ads_consents (
 id uuid PRIMARY KEY,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision >= 0),
 marketing boolean NOT NULL DEFAULT false,
 grant_revision bigint,
 granted_at timestamptz,
 expires_at timestamptz NOT NULL,
 last_request_id uuid,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((marketing AND granted_at IS NOT NULL AND grant_revision IS NOT NULL) OR NOT marketing)
);
CREATE TABLE private.openai_ads_contexts (
 session_id uuid PRIMARY KEY REFERENCES public.funnel_sessions(id) ON DELETE CASCADE,
 consent_id uuid NOT NULL REFERENCES private.openai_ads_consents(id) ON DELETE CASCADE,
 grant_revision bigint NOT NULL,
 source_url text NOT NULL CHECK(length(source_url) <= 2048),
 oppref text CHECK(octet_length(oppref) <= 2048),
 obref text CHECK(octet_length(obref) <= 2048),
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX openai_ads_contexts_consent_idx ON private.openai_ads_contexts(consent_id);
CREATE INDEX openai_ads_consents_expiry_idx ON private.openai_ads_consents(expires_at);
ALTER TABLE private.openai_ads_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.openai_ads_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.openai_ads_consents,private.openai_ads_contexts FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.openai_ads_consents,private.openai_ads_contexts TO service_role;

CREATE OR REPLACE FUNCTION public.manage_openai_ads_context(
 p_consent_id uuid,p_expires_at timestamptz,p_action text,
 p_request_id uuid DEFAULT NULL,p_expected_revision bigint DEFAULT 0,p_marketing boolean DEFAULT NULL,
 p_session_id uuid DEFAULT NULL,p_visitor_id uuid DEFAULT NULL,p_source_url text DEFAULT NULL,
 p_oppref text DEFAULT NULL,p_obref text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c private.openai_ads_consents%ROWTYPE; n timestamptz := clock_timestamp(); conflict boolean := false;
BEGIN
 IF p_action NOT IN ('get','choice','context') OR p_expected_revision < 0 OR
    p_expires_at <= n OR p_expires_at > n + interval '90 days 1 minute' OR
    (p_action <> 'get' AND p_request_id IS NULL) OR
    (p_action = 'choice' AND p_marketing IS NULL) THEN
  RAISE EXCEPTION 'Invalid OpenAI consent request';
 END IF;
 INSERT INTO private.openai_ads_consents(id,expires_at) VALUES(p_consent_id,p_expires_at) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM private.openai_ads_consents WHERE id=p_consent_id FOR UPDATE;
 IF c.expires_at <= n THEN
  RETURN jsonb_build_object('revision',c.revision,'marketing',false,'expiresAt',c.expires_at,'conflict',p_action <> 'get');
 END IF;
 IF p_action='choice' THEN
  IF c.last_request_id=p_request_id THEN
   NULL; -- Exact retry of last mutation; never repeat a grant after a later withdrawal.
  ELSIF p_marketing AND c.revision <> p_expected_revision THEN
   conflict := true;
  ELSE
   UPDATE private.openai_ads_consents SET
    revision=revision+1, marketing=p_marketing,
    grant_revision=CASE WHEN p_marketing AND NOT marketing THEN revision+1 ELSE grant_revision END,
    granted_at=CASE WHEN p_marketing AND NOT marketing THEN n ELSE granted_at END,
    last_request_id=p_request_id,updated_at=n WHERE id=c.id RETURNING * INTO c;
   IF NOT p_marketing THEN
    UPDATE private.openai_ads_contexts SET oppref=NULL,obref=NULL WHERE consent_id=c.id;
   END IF;
  END IF;
 ELSIF p_action='context' AND (c.revision <> p_expected_revision OR NOT c.marketing) THEN
  conflict := true;
 END IF;
 IF p_action <> 'get' AND NOT conflict AND c.marketing AND p_session_id IS NOT NULL AND p_source_url IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.funnel_sessions WHERE id=p_session_id AND visitor_id=p_visitor_id) THEN
   conflict := true;
  ELSIF EXISTS(SELECT 1 FROM private.openai_ads_contexts WHERE session_id=p_session_id AND consent_id<>c.id) THEN
   conflict := true;
  ELSE
   INSERT INTO private.openai_ads_contexts(session_id,consent_id,grant_revision,source_url,oppref,obref,captured_at)
   VALUES(p_session_id,c.id,c.grant_revision,p_source_url,p_oppref,p_obref,n)
   ON CONFLICT(session_id) DO UPDATE SET
    grant_revision=EXCLUDED.grant_revision,
    source_url=CASE WHEN openai_ads_contexts.grant_revision=EXCLUDED.grant_revision THEN openai_ads_contexts.source_url ELSE EXCLUDED.source_url END,
    oppref=CASE WHEN openai_ads_contexts.grant_revision=EXCLUDED.grant_revision THEN coalesce(openai_ads_contexts.oppref,EXCLUDED.oppref) ELSE EXCLUDED.oppref END,
    obref=CASE WHEN openai_ads_contexts.grant_revision=EXCLUDED.grant_revision THEN coalesce(openai_ads_contexts.obref,EXCLUDED.obref) ELSE EXCLUDED.obref END,
    captured_at=CASE WHEN openai_ads_contexts.grant_revision=EXCLUDED.grant_revision THEN openai_ads_contexts.captured_at ELSE EXCLUDED.captured_at END
   WHERE openai_ads_contexts.consent_id=EXCLUDED.consent_id;
   IF NOT FOUND THEN conflict := true; END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('revision',c.revision,'marketing',c.marketing,'expiresAt',c.expires_at,'conflict',conflict);
END $$;

CREATE OR REPLACE FUNCTION public.read_openai_ads_event_context(p_session_id uuid,p_occurred_at timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('sourceUrl',a.source_url,'oppref',a.oppref,'obref',a.obref)
 FROM private.openai_ads_contexts a JOIN private.openai_ads_consents c ON c.id=a.consent_id
 WHERE a.session_id=p_session_id AND c.marketing AND c.expires_at>clock_timestamp()
 AND c.grant_revision=a.grant_revision AND c.granted_at<=p_occurred_at
 AND a.captured_at<=p_occurred_at AND p_occurred_at<=clock_timestamp()
$$;
CREATE OR REPLACE FUNCTION public.cleanup_openai_ads_context() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
 DELETE FROM private.openai_ads_consents WHERE id IN (
  SELECT id FROM private.openai_ads_consents WHERE expires_at<=clock_timestamp()
  ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
 ); GET DIAGNOSTICS removed = ROW_COUNT; RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.manage_openai_ads_context(uuid,timestamptz,text,uuid,bigint,boolean,uuid,uuid,text,text,text),public.read_openai_ads_event_context(uuid,timestamptz),public.cleanup_openai_ads_context() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_openai_ads_context(uuid,timestamptz,text,uuid,bigint,boolean,uuid,uuid,text,text,text),public.read_openai_ads_event_context(uuid,timestamptz),public.cleanup_openai_ads_context() TO service_role;
