ALTER TABLE public.funnel_sessions
  ADD COLUMN IF NOT EXISTS is_internal_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.funnel_sessions.is_internal_test IS
  'True only for a server-authorized production QA assignment; excluded from experiment reporting.';

CREATE INDEX IF NOT EXISTS funnel_sessions_personal_plan_pricing_report_idx
  ON public.funnel_sessions (offer_variant, first_seen_at DESC)
  WHERE package_key = 'meta_personal_plan_v1' AND NOT is_internal_test;

CREATE OR REPLACE FUNCTION public.assign_personal_plan_one_time_qa(
  p_lead_id uuid,
  p_session_id uuid,
  p_package_key text,
  p_arm text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_package_key <> 'meta_personal_plan_v1' OR p_arm <> 'personal-plan-one-time-v1' THEN
    RETURN false;
  END IF;

  UPDATE public.funnel_sessions AS sessions
  SET offer_variant = p_arm,
      is_internal_test = true
  WHERE sessions.id = p_session_id
    AND sessions.lead_id = p_lead_id
    AND sessions.package_key = p_package_key
    AND sessions.quiz_variant = 'personal-plan-quiz-v1'
    AND sessions.offer_viewed_at IS NULL
    AND sessions.checkout_started_at IS NULL;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_personal_plan_one_time_qa(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_personal_plan_one_time_qa(uuid, uuid, text, text)
  TO service_role;

-- Keep the persisted session arm authoritative when funnel events are appended.  The old
-- package default remains valid only for a newly created session, before any assignment.
CREATE OR REPLACE FUNCTION public.record_funnel_event(
  p_session_id uuid, p_visitor_id uuid, p_package_key text, p_channel text, p_event_id text,
  p_event_name text, p_landing_slug text DEFAULT NULL, p_landing_variant text DEFAULT 'default',
  p_offer_variant text DEFAULT 'default', p_quiz_variant text DEFAULT NULL,
  p_entry_path text DEFAULT NULL, p_entry_url text DEFAULT NULL, p_referrer text DEFAULT NULL,
  p_first_touch jsonb DEFAULT '{}'::jsonb, p_first_seen_at timestamptz DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now(), p_lead_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL,
  p_checkout_provider text DEFAULT NULL, p_checkout_reference text DEFAULT NULL,
  p_properties jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(inserted boolean, funnel_session_id uuid, funnel_package_key text, lead_id uuid, user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE existing_event public.funnel_events%ROWTYPE; session_row public.funnel_sessions%ROWTYPE;
BEGIN
  IF p_event_name IS NULL OR p_event_name NOT IN ('landing_viewed','quiz_started','quiz_completed','lead_captured','offer_viewed','checkout_started','purchase_completed') THEN RAISE EXCEPTION 'unsupported funnel event name: %', p_event_name USING ERRCODE = '22023'; END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = '' THEN RAISE EXCEPTION 'funnel event_id is required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
  SELECT events.* INTO existing_event FROM public.funnel_events AS events WHERE events.event_id = p_event_id;
  IF existing_event.event_id IS NOT NULL THEN
    SELECT sessions.* INTO session_row FROM public.funnel_sessions AS sessions WHERE sessions.id = existing_event.funnel_session_id;
    RETURN QUERY SELECT false, existing_event.funnel_session_id, existing_event.package_key, existing_event.lead_id, session_row.user_id; RETURN;
  END IF;
  INSERT INTO public.funnel_sessions AS sessions (id,visitor_id,package_key,landing_slug,channel,landing_variant,offer_variant,quiz_variant,entry_path,entry_url,referrer,first_touch,first_seen_at,last_seen_at,lead_id,user_id)
  VALUES (p_session_id,p_visitor_id,p_package_key,p_landing_slug,p_channel,p_landing_variant,p_offer_variant,CASE WHEN p_quiz_variant IS NOT NULL THEN p_quiz_variant WHEN p_package_key = 'meta_personal_plan_v1' THEN 'personal-plan-quiz-v1' ELSE 'legacy-quiz-v1' END,p_entry_path,p_entry_url,p_referrer,COALESCE(p_first_touch,'{}'::jsonb),COALESCE(p_first_seen_at,p_occurred_at),p_occurred_at,p_lead_id,p_user_id)
  ON CONFLICT (id) DO UPDATE SET last_seen_at=GREATEST(sessions.last_seen_at,EXCLUDED.last_seen_at),landing_slug=COALESCE(sessions.landing_slug,EXCLUDED.landing_slug),entry_path=COALESCE(sessions.entry_path,EXCLUDED.entry_path),entry_url=COALESCE(sessions.entry_url,EXCLUDED.entry_url),referrer=COALESCE(sessions.referrer,EXCLUDED.referrer),first_touch=CASE WHEN sessions.first_touch='{}'::jsonb THEN EXCLUDED.first_touch ELSE sessions.first_touch END,lead_id=COALESCE(sessions.lead_id,EXCLUDED.lead_id),user_id=COALESCE(sessions.user_id,EXCLUDED.user_id)
  RETURNING * INTO session_row;
  INSERT INTO public.funnel_events (event_id,funnel_session_id,package_key,event_name,occurred_at,lead_id,checkout_provider,checkout_reference,properties)
  VALUES (p_event_id,session_row.id,session_row.package_key,p_event_name,p_occurred_at,p_lead_id,p_checkout_provider,p_checkout_reference,jsonb_set(COALESCE(p_properties,'{}'::jsonb),'{offer_variant}',to_jsonb(session_row.offer_variant),true));
  UPDATE public.funnel_sessions AS sessions SET
    landing_viewed_at=CASE WHEN p_event_name='landing_viewed' THEN COALESCE(sessions.landing_viewed_at,p_occurred_at) ELSE sessions.landing_viewed_at END,
    quiz_started_at=CASE WHEN p_event_name='quiz_started' THEN COALESCE(sessions.quiz_started_at,p_occurred_at) ELSE sessions.quiz_started_at END,
    quiz_completed_at=CASE WHEN p_event_name='quiz_completed' THEN COALESCE(sessions.quiz_completed_at,p_occurred_at) ELSE sessions.quiz_completed_at END,
    lead_captured_at=CASE WHEN p_event_name='lead_captured' THEN COALESCE(sessions.lead_captured_at,p_occurred_at) ELSE sessions.lead_captured_at END,
    offer_viewed_at=CASE WHEN p_event_name='offer_viewed' THEN COALESCE(sessions.offer_viewed_at,p_occurred_at) ELSE sessions.offer_viewed_at END,
    checkout_started_at=CASE WHEN p_event_name='checkout_started' THEN COALESCE(sessions.checkout_started_at,p_occurred_at) ELSE sessions.checkout_started_at END,
    purchase_completed_at=CASE WHEN p_event_name='purchase_completed' THEN COALESCE(sessions.purchase_completed_at,p_occurred_at) ELSE sessions.purchase_completed_at END,
    lead_id=COALESCE(sessions.lead_id,p_lead_id), user_id=COALESCE(sessions.user_id,p_user_id),
    purchase_provider=CASE WHEN p_event_name='purchase_completed' THEN COALESCE(sessions.purchase_provider,p_checkout_provider) ELSE sessions.purchase_provider END,
    purchase_reference=CASE WHEN p_event_name='purchase_completed' THEN COALESCE(sessions.purchase_reference,p_checkout_reference) ELSE sessions.purchase_reference END
  WHERE sessions.id=session_row.id RETURNING * INTO session_row;
  RETURN QUERY SELECT true, session_row.id, session_row.package_key, session_row.lead_id, session_row.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_funnel_event(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,timestamptz,uuid,uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_funnel_event(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,timestamptz,uuid,uuid,text,text,jsonb)
  TO service_role;
