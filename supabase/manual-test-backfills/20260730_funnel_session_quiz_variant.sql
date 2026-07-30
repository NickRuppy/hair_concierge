-- Local-only verification for 20260730120000_add_funnel_session_quiz_variant.sql.
-- Run after `supabase db reset`; never run against production.

BEGIN;

-- Full old named 20-argument shape: every pre-migration parameter is supplied
-- while p_quiz_variant is omitted and defaults safely.
SELECT *
FROM public.record_funnel_event(
  p_session_id := '10000000-0000-4000-8000-000000000001',
  p_visitor_id := '20000000-0000-4000-8000-000000000002',
  p_package_key := 'default_organic',
  p_channel := 'organic',
  p_event_id := '30000000-0000-4000-8000-000000000003',
  p_event_name := 'quiz_started',
  p_landing_slug := NULL,
  p_landing_variant := 'default',
  p_offer_variant := 'guided-story',
  p_entry_path := '/quiz?source=old-named-rpc',
  p_entry_url := 'https://example.test/quiz?source=old-named-rpc',
  p_referrer := 'https://example.test/',
  p_first_touch := '{"utm_campaign":"old-named-rpc"}'::jsonb,
  p_first_seen_at := '2026-07-30T08:00:00Z',
  p_occurred_at := '2026-07-30T08:01:00Z',
  p_lead_id := NULL,
  p_user_id := NULL,
  p_checkout_provider := NULL,
  p_checkout_reference := NULL,
  p_properties := '{"proof":"old-named-rpc"}'::jsonb
);

DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.funnel_sessions
    WHERE id = '10000000-0000-4000-8000-000000000001'
      AND quiz_variant = 'legacy-quiz-v1'
      AND landing_variant = 'default'
      AND offer_variant = 'guided-story'
      AND entry_path = '/quiz?source=old-named-rpc'
      AND entry_url = 'https://example.test/quiz?source=old-named-rpc'
      AND referrer = 'https://example.test/'
      AND first_touch = '{"utm_campaign":"old-named-rpc"}'::jsonb
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.funnel_events
    WHERE event_id = '30000000-0000-4000-8000-000000000003'
      AND properties = '{"proof":"old-named-rpc"}'::jsonb
  ) THEN
    RAISE EXCEPTION 'old named RPC fields did not map around the defaulted quiz variant';
  END IF;
END
$assert$;

-- During expand-first deploys, an old Personal Plan caller omits the new
-- parameter. The RPC must still derive the correct immutable snapshot.
SELECT *
FROM public.record_funnel_event(
  p_session_id := '90000000-0000-4000-8000-000000000009',
  p_visitor_id := 'a0000000-0000-4000-8000-00000000000a',
  p_package_key := 'meta_personal_plan_v1',
  p_channel := 'meta',
  p_event_id := 'b0000000-0000-4000-8000-00000000000b',
  p_event_name := 'quiz_started'
);

DO $assert$
BEGIN
  IF (SELECT quiz_variant FROM public.funnel_sessions WHERE id = '90000000-0000-4000-8000-000000000009')
      <> 'personal-plan-quiz-v1' THEN
    RAISE EXCEPTION 'old Personal Plan RPC call did not derive the personal plan quiz variant';
  END IF;
END
$assert$;

-- New named shape uses the registered Personal Plan quiz variant.
SELECT *
FROM public.record_funnel_event(
  p_session_id := '40000000-0000-4000-8000-000000000004',
  p_visitor_id := '50000000-0000-4000-8000-000000000005',
  p_package_key := 'meta_personal_plan_v1',
  p_channel := 'meta',
  p_event_id := '60000000-0000-4000-8000-000000000006',
  p_event_name := 'quiz_started',
  p_quiz_variant := 'personal-plan-quiz-v1'
);

-- A subsequent event cannot overwrite the immutable session snapshot.
SELECT *
FROM public.record_funnel_event(
  p_session_id := '40000000-0000-4000-8000-000000000004',
  p_visitor_id := '50000000-0000-4000-8000-000000000005',
  p_package_key := 'meta_personal_plan_v1',
  p_channel := 'meta',
  p_event_id := '70000000-0000-4000-8000-000000000007',
  p_event_name := 'offer_viewed',
  p_quiz_variant := 'legacy-quiz-v1'
);

-- Retrying the original id also cannot mutate the already recorded session.
SELECT *
FROM public.record_funnel_event(
  p_session_id := '40000000-0000-4000-8000-000000000004',
  p_visitor_id := '50000000-0000-4000-8000-000000000005',
  p_package_key := 'meta_personal_plan_v1',
  p_channel := 'meta',
  p_event_id := '60000000-0000-4000-8000-000000000006',
  p_event_name := 'quiz_started',
  p_quiz_variant := 'legacy-quiz-v1'
);

DO $assert$
BEGIN
  IF (SELECT quiz_variant FROM public.funnel_sessions WHERE id = '40000000-0000-4000-8000-000000000004')
      <> 'personal-plan-quiz-v1' THEN
    RAISE EXCEPTION 'subsequent session event overwrote quiz_variant';
  END IF;
END
$assert$;

-- Purchase records continue to use the same session and snapshot.
SELECT *
FROM public.record_funnel_event(
  p_session_id := '40000000-0000-4000-8000-000000000004',
  p_visitor_id := '50000000-0000-4000-8000-000000000005',
  p_package_key := 'meta_personal_plan_v1',
  p_channel := 'meta',
  p_event_id := '80000000-0000-4000-8000-000000000008',
  p_event_name := 'purchase_completed',
  p_quiz_variant := 'legacy-quiz-v1',
  p_checkout_provider := 'stripe',
  p_checkout_reference := 'local-quiz-variant-purchase'
);

DO $assert$
DECLARE
  new_signature regprocedure :=
    'public.record_funnel_event(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,timestamptz,uuid,uuid,text,text,jsonb)'::regprocedure;
BEGIN
  IF NOT has_function_privilege('service_role', new_signature::oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role lacks execute on the new RPC signature';
  END IF;
  IF has_function_privilege('anon', new_signature::oid, 'EXECUTE')
     OR has_function_privilege('authenticated', new_signature::oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'browser roles received execute on the new RPC signature';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.funnel_sessions
    WHERE id = '40000000-0000-4000-8000-000000000004'
      AND quiz_variant = 'personal-plan-quiz-v1'
      AND purchase_provider = 'stripe'
      AND purchase_reference = 'local-quiz-variant-purchase'
      AND purchase_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'purchase recording no longer preserves the session quiz snapshot';
  END IF;
END
$assert$;

ROLLBACK;
