CREATE TABLE public.paypal_expired_order_reset_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id uuid NOT NULL REFERENCES public.personal_plan_one_time_checkout_consents(id) ON DELETE RESTRICT,
  intent_id uuid NOT NULL REFERENCES public.paypal_order_intents(id) ON DELETE RESTRICT,
  prior_provider_order_id text NOT NULL UNIQUE,
  provider_state text NOT NULL CHECK (provider_state = 'voided'),
  provider_verified_at timestamptz NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now(),
  requested_by text NOT NULL DEFAULT current_user,
  CHECK (length(trim(prior_provider_order_id)) > 0)
);

ALTER TABLE public.paypal_expired_order_reset_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.paypal_expired_order_reset_audit FROM anon, authenticated;
GRANT ALL ON TABLE public.paypal_expired_order_reset_audit TO service_role;

CREATE OR REPLACE FUNCTION public.deny_paypal_expired_order_reset_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PayPal expired-order reset audit is append-only' USING ERRCODE = '22000';
END;
$$;

CREATE TRIGGER deny_paypal_expired_order_reset_audit_mutation
  BEFORE UPDATE OR DELETE ON public.paypal_expired_order_reset_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.deny_paypal_expired_order_reset_audit_mutation();

REVOKE ALL ON FUNCTION public.deny_paypal_expired_order_reset_audit_mutation() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enforce_personal_plan_one_time_consent_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reset_audit_id uuid;
  new_reset_intent_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.funnel_sessions
    WHERE id = NEW.funnel_session_id AND lead_id = NEW.lead_id
  ) THEN
    RAISE EXCEPTION 'checkout consent lead and funnel session must match' USING ERRCODE = '23514';
  END IF;

  IF NEW.lead_id IS DISTINCT FROM OLD.lead_id
    OR NEW.funnel_session_id IS DISTINCT FROM OLD.funnel_session_id
    OR (
      NEW.user_id IS DISTINCT FROM OLD.user_id
      AND NOT (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL)
    )
    OR NEW.product_kind IS DISTINCT FROM OLD.product_kind
    OR NEW.offer_variant IS DISTINCT FROM OLD.offer_variant
    OR NEW.copy_version IS DISTINCT FROM OLD.copy_version
    OR NEW.consent_text IS DISTINCT FROM OLD.consent_text
    OR NEW.consent_text_sha256 IS DISTINCT FROM OLD.consent_text_sha256
    OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'accepted checkout consent evidence is immutable' USING ERRCODE = '22000';
  END IF;

  reset_audit_id := nullif(current_setting('app.personal_plan_one_time_paypal_reset_audit_id', true), '')::uuid;
  SELECT intent_id INTO new_reset_intent_id
  FROM public.paypal_expired_order_reset_audit
  WHERE id = reset_audit_id
    AND consent_id = OLD.id
    AND prior_provider_order_id = OLD.paypal_order_id;

  IF (
      OLD.stripe_checkout_session_id IS NOT NULL
      AND NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
      AND (
        NEW.stripe_checkout_session_id IS NULL
        OR OLD.paypal_order_id IS NOT NULL
        OR NEW.paypal_order_id IS NOT NULL
        OR OLD.paypal_capture_id IS NOT NULL
        OR NEW.paypal_capture_id IS NOT NULL
      )
    )
    OR (
      OLD.paypal_order_id IS NOT NULL
      AND NEW.paypal_order_id IS DISTINCT FROM OLD.paypal_order_id
      AND NOT (
        NEW.paypal_order_id IS NULL
        AND OLD.paypal_capture_id IS NULL
        AND NEW.paypal_capture_id IS NULL
        AND OLD.stripe_checkout_session_id IS NULL
        AND NEW.stripe_checkout_session_id IS NULL
        AND new_reset_intent_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.paypal_order_intents reset_intent
          WHERE reset_intent.id = new_reset_intent_id
            AND reset_intent.consent_id = OLD.id
            AND reset_intent.provider_order_id IS NULL
            AND reset_intent.provider_capture_id IS NULL
            AND reset_intent.status = 'created'
        )
      )
    )
    OR (
      OLD.paypal_capture_id IS NOT NULL
      AND NEW.paypal_capture_id IS DISTINCT FROM OLD.paypal_capture_id
    ) THEN
    RAISE EXCEPTION 'provider references violate one-provider recovery rules' USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_expired_uncaptured_paypal_order(
  p_provider_order_id text,
  p_provider_state text,
  p_provider_verified_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  intent public.paypal_order_intents%ROWTYPE;
  consent public.personal_plan_one_time_checkout_consents%ROWTYPE;
  audit_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for PayPal order reset' USING ERRCODE = '42501';
  END IF;
  IF p_provider_order_id IS NULL OR length(trim(p_provider_order_id)) = 0 THEN
    RAISE EXCEPTION 'provider order is required' USING ERRCODE = '22023';
  END IF;
  IF p_provider_state <> 'voided'
    OR p_provider_verified_at IS NULL
    OR p_provider_verified_at < now() - interval '5 minutes'
    OR p_provider_verified_at > now() + interval '30 seconds' THEN
    RAISE EXCEPTION 'fresh terminal provider verification is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intent
  FROM public.paypal_order_intents
  WHERE provider_order_id = p_provider_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PayPal order intent is not resettable' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO consent
  FROM public.personal_plan_one_time_checkout_consents
  WHERE id = intent.consent_id
  FOR UPDATE;
  IF NOT FOUND
    OR consent.paypal_order_id IS DISTINCT FROM p_provider_order_id
    OR consent.stripe_checkout_session_id IS NOT NULL
    OR intent.status <> 'created'
    OR intent.expires_at > now()
    OR intent.provider_capture_id IS NOT NULL THEN
    RAISE EXCEPTION 'PayPal order intent is not resettable' USING ERRCODE = '22000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_one_time_purchases purchase
    WHERE purchase.consent_id = intent.consent_id
       OR purchase.provider_order_id = p_provider_order_id
  ) THEN
    RAISE EXCEPTION 'PayPal order intent has purchase evidence' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.paypal_expired_order_reset_audit (
    consent_id,
    intent_id,
    prior_provider_order_id,
    provider_state,
    provider_verified_at
  ) VALUES (
    consent.id,
    intent.id,
    p_provider_order_id,
    p_provider_state,
    p_provider_verified_at
  ) RETURNING id INTO audit_id;

  PERFORM set_config('app.personal_plan_one_time_paypal_reset_audit_id', audit_id::text, true);

  UPDATE public.paypal_order_intents
  SET provider_order_id = NULL,
      expires_at = now() + interval '24 hours',
      status = 'created'
  WHERE id = intent.id
    AND provider_order_id = p_provider_order_id;

  UPDATE public.personal_plan_one_time_checkout_consents
  SET paypal_order_id = NULL
  WHERE id = consent.id
    AND paypal_order_id = p_provider_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_expired_uncaptured_paypal_order(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_expired_uncaptured_paypal_order(text, text, timestamptz) TO service_role;

COMMENT ON TABLE public.paypal_expired_order_reset_audit IS
  'Append-only service-only audit for narrowly resetting expired PayPal orders proven uncaptured externally.';
