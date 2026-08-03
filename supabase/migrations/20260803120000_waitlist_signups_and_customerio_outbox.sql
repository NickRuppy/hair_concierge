CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL,
  normalized_email text NOT NULL,
  first_name text,
  marketing_consent boolean NOT NULL DEFAULT false,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  survey_token_hash text NOT NULL,
  survey_response_id text,
  survey_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_signups_campaign_normalized_email_key UNIQUE (campaign, normalized_email),
  CONSTRAINT waitlist_signups_survey_response_id_key UNIQUE (survey_response_id),
  CONSTRAINT waitlist_signups_survey_completion_consistency CHECK (
    (survey_response_id IS NULL AND survey_completed_at IS NULL)
    OR (survey_response_id IS NOT NULL AND survey_completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS waitlist_signups_campaign_created_at_idx
  ON public.waitlist_signups (campaign, created_at);

CREATE TABLE IF NOT EXISTS public.waitlist_customerio_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid NOT NULL REFERENCES public.waitlist_signups (id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('waitlist_signup', 'waitlist_survey_completed')),
  message_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'delivered', 'failed', 'failed_permanent')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  processing_started_at timestamptz,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_customerio_outbox_signup_event_key UNIQUE (signup_id, event_type)
);

CREATE INDEX IF NOT EXISTS waitlist_customerio_outbox_status_due_idx
  ON public.waitlist_customerio_outbox (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS waitlist_customerio_outbox_processing_started_idx
  ON public.waitlist_customerio_outbox (status, processing_started_at);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_customerio_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_waitlist_signup(
  p_campaign text,
  p_normalized_email text,
  p_first_name text,
  p_marketing_consent boolean,
  p_attribution jsonb,
  p_survey_token_hash text
)
RETURNS TABLE (signup_id uuid, created boolean, survey_already_completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  was_created boolean;
BEGIN
  INSERT INTO public.waitlist_signups AS signup (
    campaign, normalized_email, first_name, marketing_consent, attribution, survey_token_hash
  ) VALUES (
    p_campaign, p_normalized_email, p_first_name, p_marketing_consent,
    COALESCE(p_attribution, '{}'::jsonb), p_survey_token_hash
  )
  ON CONFLICT (campaign, normalized_email) DO UPDATE
     -- A public duplicate proves neither mailbox nor browser ownership. Preserve
     -- the original profile and survey token so a known email cannot take over
     -- an incomplete survey association.
     SET updated_at = signup.updated_at
  RETURNING signup.id, (xmax = 0) INTO target_id, was_created;

  INSERT INTO public.waitlist_customerio_outbox (signup_id, event_type, message_id)
  VALUES (target_id, 'waitlist_signup', 'waitlist-signup:' || target_id::text)
  ON CONFLICT (signup_id, event_type) DO NOTHING;

  RETURN QUERY
  SELECT target_id, was_created, signup.survey_completed_at IS NOT NULL
  FROM public.waitlist_signups AS signup
  WHERE signup.id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_waitlist_survey(
  p_survey_token_hash text,
  p_survey_response_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  UPDATE public.waitlist_signups
     SET survey_response_id = p_survey_response_id,
         survey_completed_at = COALESCE(survey_completed_at, now()),
         updated_at = now()
   WHERE survey_token_hash = p_survey_token_hash
     AND (survey_response_id IS NULL OR survey_response_id = p_survey_response_id)
  RETURNING id INTO target_id;

  IF target_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.waitlist_customerio_outbox (signup_id, event_type, message_id)
  VALUES (target_id, 'waitlist_survey_completed', 'waitlist-survey-completed:' || target_id::text)
  ON CONFLICT (signup_id, event_type) DO NOTHING;
  RETURN target_id;
END;
$$;

REVOKE ALL ON TABLE public.waitlist_signups FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.waitlist_customerio_outbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_waitlist_signup(text, text, text, boolean, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_waitlist_survey(text, text)
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.waitlist_signups TO service_role;
GRANT ALL ON TABLE public.waitlist_customerio_outbox TO service_role;
GRANT EXECUTE ON FUNCTION public.create_waitlist_signup(text, text, text, boolean, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_waitlist_survey(text, text)
  TO service_role;

COMMENT ON TABLE public.waitlist_signups IS
  'Authoritative waitlist registrations. Survey completion is client-attested and grants no entitlement. Direct browser access is denied by RLS.';
COMMENT ON TABLE public.waitlist_customerio_outbox IS
  'Retry state for asynchronously projecting waitlist registrations to Customer.io.';
