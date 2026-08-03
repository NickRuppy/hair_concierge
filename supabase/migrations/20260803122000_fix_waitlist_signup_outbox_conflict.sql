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
     SET updated_at = signup.updated_at
  RETURNING signup.id, (xmax = 0) INTO target_id, was_created;

  INSERT INTO public.waitlist_customerio_outbox (signup_id, event_type, message_id)
  VALUES (target_id, 'waitlist_signup', 'waitlist-signup:' || target_id::text)
  ON CONFLICT ON CONSTRAINT waitlist_customerio_outbox_signup_event_key
  DO NOTHING;

  RETURN QUERY
  SELECT target_id, was_created, signup.survey_completed_at IS NOT NULL
  FROM public.waitlist_signups AS signup
  WHERE signup.id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_waitlist_signup(text, text, text, boolean, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_waitlist_signup(text, text, text, boolean, jsonb, text)
  TO service_role;

COMMENT ON FUNCTION public.create_waitlist_signup(text, text, text, boolean, jsonb, text) IS
  'Creates an authoritative waitlist signup and its Customer.io outbox event atomically.';
