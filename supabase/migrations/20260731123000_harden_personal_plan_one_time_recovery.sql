CREATE OR REPLACE FUNCTION public.enforce_personal_plan_one_time_consent_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
      AND NOT (OLD.user_id IS NOT NULL AND NEW.user_id IS NULL)
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

  -- An expired Stripe Checkout Session may be replaced while preserving the same accepted
  -- consent. PayPal references remain write-once, and provider switching stays forbidden.
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

DO $$
DECLARE
  old_constraint_name text;
BEGIN
  SELECT conname
  INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.personal_plan_one_time_checkout_consents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%generation_started_at%'
    AND pg_get_constraintdef(oid) ILIKE '%confirmation_status%'
  LIMIT 1;

  IF old_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.personal_plan_one_time_checkout_consents DROP CONSTRAINT %I',
      old_constraint_name
    );
  END IF;
END;
$$;

ALTER TABLE public.personal_plan_one_time_checkout_consents
  ADD CONSTRAINT personal_plan_one_time_generation_requires_confirmation_sent
  CHECK (
    generation_started_at IS NULL
    OR confirmation_status IN ('sent', 'delivered')
  );

COMMENT ON CONSTRAINT personal_plan_one_time_generation_requires_confirmation_sent
  ON public.personal_plan_one_time_checkout_consents IS
  'Plan generation may begin after the required durable-medium confirmation was accepted by the transactional email provider.';
