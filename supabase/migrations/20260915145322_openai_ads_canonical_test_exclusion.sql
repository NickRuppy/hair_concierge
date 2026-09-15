-- Purchase payloads can omit test markers. Resolve eligibility from the exact
-- canonical funnel session at both enqueue and send time, including queued events.
BEGIN;
CREATE OR REPLACE FUNCTION private.is_openai_ads_billing_event(e public.billing_analytics_outbox)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(
  e.payload->'is_internal_test' IS DISTINCT FROM 'true'::jsonb
  AND coalesce(e.payload->>'test_kind','') NOT IN ('field_test','partner')
  AND jsonb_typeof(e.payload->'funnel_session_id')='string'
  AND (e.payload->>'funnel_session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
   SELECT 1 FROM public.funnel_sessions f
   WHERE f.id=CASE WHEN (e.payload->>'funnel_session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (e.payload->>'funnel_session_id')::uuid ELSE NULL END
   AND coalesce(f.is_internal_test,false)=false
   AND coalesce(f.test_kind,'') NOT IN ('field_test','partner')
  )
  AND ((e.event_name='trial_started' AND e.payload->'trial_analytics_version'='1'::jsonb
        AND e.payload->'value'='0'::jsonb AND jsonb_typeof(e.payload->'trial_authorized_at')='string')
    OR (e.event_name='purchase_completed' AND coalesce(e.payload->>'attempt_phase','')<>'renewal'
        AND (e.payload->'trial_analytics_version' IS DISTINCT FROM '1'::jsonb
             OR e.payload->>'attempt_phase'='first_paid'))),false)
$$;
CREATE OR REPLACE FUNCTION public.read_openai_ads_event_context(p_session_id uuid,p_occurred_at timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('sourceUrl',a.source_url,'oppref',a.oppref,'obref',a.obref)
 FROM private.openai_ads_contexts a JOIN private.openai_ads_consents c ON c.id=a.consent_id
 JOIN public.funnel_sessions f ON f.id=a.session_id
 WHERE a.session_id=p_session_id AND c.marketing AND c.expires_at>clock_timestamp()
 AND c.grant_revision=a.grant_revision AND c.granted_at<=p_occurred_at
 AND a.captured_at<=p_occurred_at AND p_occurred_at<=clock_timestamp()
 AND coalesce(f.is_internal_test,false)=false
 AND coalesce(f.test_kind,'') NOT IN ('field_test','partner')
$$;
REVOKE ALL ON FUNCTION private.is_openai_ads_billing_event(public.billing_analytics_outbox),public.read_openai_ads_event_context(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.is_openai_ads_billing_event(public.billing_analytics_outbox),public.read_openai_ads_event_context(uuid,timestamptz) TO service_role;
COMMIT;
