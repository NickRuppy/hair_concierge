-- First-party operational attribution for package-specific funnel journeys.
-- Sessions keep reporting-friendly first-occurrence milestones; events retain
-- the append-only, replayable action history behind those summaries.

CREATE TABLE IF NOT EXISTS public.funnel_sessions (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  package_key text NOT NULL,
  landing_slug text,
  channel text NOT NULL,
  landing_variant text NOT NULL DEFAULT 'default',
  offer_variant text NOT NULL DEFAULT 'default',
  entry_path text,
  entry_url text,
  referrer text,
  first_touch jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  landing_viewed_at timestamptz,
  quiz_started_at timestamptz,
  quiz_completed_at timestamptz,
  lead_captured_at timestamptz,
  offer_viewed_at timestamptz,
  checkout_started_at timestamptz,
  purchase_completed_at timestamptz,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  purchase_provider text,
  purchase_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.funnel_sessions IS
  'First-party operational attribution snapshots for package-specific browser journeys.';
COMMENT ON COLUMN public.funnel_sessions.visitor_id IS
  'Stable first-party browser identifier linking multiple package journeys.';
COMMENT ON COLUMN public.funnel_sessions.first_touch IS
  'Compact first-touch reporting metadata captured when this package journey began; never overwritten by later events.';
COMMENT ON COLUMN public.funnel_sessions.landing_variant IS
  'Historical landing variant shown for this journey, retained independently from offer_variant.';
COMMENT ON COLUMN public.funnel_sessions.offer_variant IS
  'Historical offer variant shown for this journey, retained independently from landing_variant.';
COMMENT ON COLUMN public.funnel_sessions.purchase_reference IS
  'Provider-specific reference for the first confirmed purchase recorded for this journey.';

CREATE INDEX IF NOT EXISTS funnel_sessions_visitor_first_seen_idx
  ON public.funnel_sessions (visitor_id, first_seen_at);
CREATE INDEX IF NOT EXISTS funnel_sessions_package_first_seen_idx
  ON public.funnel_sessions (package_key, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS funnel_sessions_lead_id_idx
  ON public.funnel_sessions (lead_id);
CREATE INDEX IF NOT EXISTS funnel_sessions_user_id_idx
  ON public.funnel_sessions (user_id);
CREATE INDEX IF NOT EXISTS funnel_sessions_purchase_reference_idx
  ON public.funnel_sessions (purchase_provider, purchase_reference);

DROP TRIGGER IF EXISTS set_updated_at_funnel_sessions ON public.funnel_sessions;
CREATE TRIGGER set_updated_at_funnel_sessions
  BEFORE UPDATE ON public.funnel_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.funnel_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.funnel_events (
  event_id text PRIMARY KEY,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE CASCADE,
  package_key text NOT NULL,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  checkout_provider text,
  checkout_reference text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.funnel_events IS
  'Append-only first-party funnel actions. event_id is the stable idempotency and downstream forwarding key.';
COMMENT ON COLUMN public.funnel_events.event_id IS
  'Producer-supplied stable event identifier; retries must reuse it and genuine repeated actions must use a new value.';
COMMENT ON COLUMN public.funnel_events.package_key IS
  'Compact immutable package identifier copied from the recorded event context.';
COMMENT ON COLUMN public.funnel_events.properties IS
  'Append-only event-specific operational metadata; full package snapshot remains on funnel_sessions.';

CREATE INDEX IF NOT EXISTS funnel_events_session_occurred_at_idx
  ON public.funnel_events (funnel_session_id, occurred_at);
CREATE INDEX IF NOT EXISTS funnel_events_package_occurred_at_idx
  ON public.funnel_events (package_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_lead_id_idx
  ON public.funnel_events (lead_id);
CREATE INDEX IF NOT EXISTS funnel_events_checkout_reference_idx
  ON public.funnel_events (checkout_provider, checkout_reference);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_funnel_event(
  p_session_id uuid,
  p_visitor_id uuid,
  p_package_key text,
  p_channel text,
  p_event_id text,
  p_event_name text,
  p_landing_slug text DEFAULT NULL,
  p_landing_variant text DEFAULT 'default',
  p_offer_variant text DEFAULT 'default',
  p_entry_path text DEFAULT NULL,
  p_entry_url text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_first_touch jsonb DEFAULT '{}'::jsonb,
  p_first_seen_at timestamptz DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now(),
  p_lead_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_checkout_provider text DEFAULT NULL,
  p_checkout_reference text DEFAULT NULL,
  p_properties jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  inserted boolean,
  funnel_session_id uuid,
  funnel_package_key text,
  lead_id uuid,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_event public.funnel_events%ROWTYPE;
  session_row public.funnel_sessions%ROWTYPE;
BEGIN
  IF p_event_name IS NULL OR p_event_name NOT IN (
    'landing_viewed',
    'quiz_started',
    'quiz_completed',
    'lead_captured',
    'offer_viewed',
    'checkout_started',
    'purchase_completed'
  ) THEN
    RAISE EXCEPTION 'unsupported funnel event name: %', p_event_name
      USING ERRCODE = '22023';
  END IF;

  IF p_event_id IS NULL OR btrim(p_event_id) = '' THEN
    RAISE EXCEPTION 'funnel event_id is required' USING ERRCODE = '22023';
  END IF;

  -- Serializing a single event ID prevents a concurrent retry from mutating
  -- the session after another transaction has already recorded that event.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id, 0));

  SELECT events.*
  INTO existing_event
  FROM public.funnel_events AS events
  WHERE events.event_id = p_event_id;

  IF existing_event.event_id IS NOT NULL THEN
    SELECT sessions.*
    INTO session_row
    FROM public.funnel_sessions AS sessions
    WHERE sessions.id = existing_event.funnel_session_id;

    RETURN QUERY
    SELECT
      false,
      existing_event.funnel_session_id,
      existing_event.package_key,
      existing_event.lead_id,
      session_row.user_id;
    RETURN;
  END IF;

  INSERT INTO public.funnel_sessions AS sessions (
    id,
    visitor_id,
    package_key,
    landing_slug,
    channel,
    landing_variant,
    offer_variant,
    entry_path,
    entry_url,
    referrer,
    first_touch,
    first_seen_at,
    last_seen_at,
    lead_id,
    user_id
  )
  VALUES (
    p_session_id,
    p_visitor_id,
    p_package_key,
    p_landing_slug,
    p_channel,
    p_landing_variant,
    p_offer_variant,
    p_entry_path,
    p_entry_url,
    p_referrer,
    COALESCE(p_first_touch, '{}'::jsonb),
    COALESCE(p_first_seen_at, p_occurred_at),
    p_occurred_at,
    p_lead_id,
    p_user_id
  )
  ON CONFLICT (id) DO UPDATE
  SET last_seen_at = GREATEST(sessions.last_seen_at, EXCLUDED.last_seen_at),
      landing_slug = COALESCE(sessions.landing_slug, EXCLUDED.landing_slug),
      entry_path = COALESCE(sessions.entry_path, EXCLUDED.entry_path),
      entry_url = COALESCE(sessions.entry_url, EXCLUDED.entry_url),
      referrer = COALESCE(sessions.referrer, EXCLUDED.referrer),
      first_touch = CASE
        WHEN sessions.first_touch = '{}'::jsonb THEN EXCLUDED.first_touch
        ELSE sessions.first_touch
      END,
      lead_id = COALESCE(sessions.lead_id, EXCLUDED.lead_id),
      user_id = COALESCE(sessions.user_id, EXCLUDED.user_id)
  RETURNING * INTO session_row;

  INSERT INTO public.funnel_events (
    event_id,
    funnel_session_id,
    package_key,
    event_name,
    occurred_at,
    lead_id,
    checkout_provider,
    checkout_reference,
    properties
  )
  VALUES (
    p_event_id,
    session_row.id,
    session_row.package_key,
    p_event_name,
    p_occurred_at,
    p_lead_id,
    p_checkout_provider,
    p_checkout_reference,
    COALESCE(p_properties, '{}'::jsonb)
  );

  UPDATE public.funnel_sessions AS sessions
  SET landing_viewed_at = CASE
        WHEN p_event_name = 'landing_viewed' THEN COALESCE(sessions.landing_viewed_at, p_occurred_at)
        ELSE sessions.landing_viewed_at
      END,
      quiz_started_at = CASE
        WHEN p_event_name = 'quiz_started' THEN COALESCE(sessions.quiz_started_at, p_occurred_at)
        ELSE sessions.quiz_started_at
      END,
      quiz_completed_at = CASE
        WHEN p_event_name = 'quiz_completed' THEN COALESCE(sessions.quiz_completed_at, p_occurred_at)
        ELSE sessions.quiz_completed_at
      END,
      lead_captured_at = CASE
        WHEN p_event_name = 'lead_captured' THEN COALESCE(sessions.lead_captured_at, p_occurred_at)
        ELSE sessions.lead_captured_at
      END,
      offer_viewed_at = CASE
        WHEN p_event_name = 'offer_viewed' THEN COALESCE(sessions.offer_viewed_at, p_occurred_at)
        ELSE sessions.offer_viewed_at
      END,
      checkout_started_at = CASE
        WHEN p_event_name = 'checkout_started' THEN COALESCE(sessions.checkout_started_at, p_occurred_at)
        ELSE sessions.checkout_started_at
      END,
      purchase_completed_at = CASE
        WHEN p_event_name = 'purchase_completed' THEN COALESCE(sessions.purchase_completed_at, p_occurred_at)
        ELSE sessions.purchase_completed_at
      END,
      lead_id = COALESCE(sessions.lead_id, p_lead_id),
      user_id = COALESCE(sessions.user_id, p_user_id),
      purchase_provider = CASE
        WHEN p_event_name = 'purchase_completed' THEN COALESCE(sessions.purchase_provider, p_checkout_provider)
        ELSE sessions.purchase_provider
      END,
      purchase_reference = CASE
        WHEN p_event_name = 'purchase_completed' THEN COALESCE(sessions.purchase_reference, p_checkout_reference)
        ELSE sessions.purchase_reference
      END
  WHERE sessions.id = session_row.id
  RETURNING * INTO session_row;

  RETURN QUERY
  SELECT true, session_row.id, session_row.package_key, session_row.lead_id, session_row.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_funnel_event(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  jsonb, timestamptz, timestamptz, uuid, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_funnel_event(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  jsonb, timestamptz, timestamptz, uuid, uuid, text, text, jsonb
) TO service_role;
