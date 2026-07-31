CREATE TABLE public.personal_plan_one_time_checkout_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_kind text NOT NULL CHECK (product_kind = 'personal_plan_once'),
  offer_variant text NOT NULL,
  copy_version text NOT NULL,
  consent_text text NOT NULL,
  consent_text_sha256 text NOT NULL CHECK (consent_text_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  paypal_order_id text UNIQUE,
  paypal_capture_id text UNIQUE,
  confirmation_provider text,
  confirmation_status text NOT NULL DEFAULT 'pending' CHECK (
    confirmation_status IN ('pending', 'sent', 'delivered', 'failed')
  ),
  confirmation_reference text,
  confirmation_sent_at timestamptz,
  confirmation_delivered_at timestamptz,
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  generated_content_sha256 text CHECK (
    generated_content_sha256 IS NULL OR generated_content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  delivery_provider text,
  delivery_reference text,
  delivered_at timestamptz,
  first_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (stripe_checkout_session_id IS NOT NULL AND paypal_order_id IS NOT NULL)),
  CHECK (
    (confirmation_status = 'pending' AND confirmation_provider IS NULL AND confirmation_reference IS NULL
      AND confirmation_sent_at IS NULL AND confirmation_delivered_at IS NULL)
    OR (confirmation_status IN ('sent', 'delivered', 'failed') AND confirmation_provider IS NOT NULL
      AND confirmation_reference IS NOT NULL AND confirmation_sent_at IS NOT NULL)
  ),
  CHECK (confirmation_delivered_at IS NULL OR confirmation_status = 'delivered'),
  CHECK (generation_started_at IS NULL OR confirmation_status = 'delivered'),
  CHECK (generation_completed_at IS NULL OR generation_started_at IS NOT NULL),
  CHECK (delivered_at IS NULL OR generation_completed_at IS NOT NULL),
  CHECK (first_accessed_at IS NULL OR delivered_at IS NOT NULL)
);

CREATE UNIQUE INDEX personal_plan_one_time_checkout_consents_lead_session_product_idx
  ON public.personal_plan_one_time_checkout_consents (lead_id, funnel_session_id, product_kind);

CREATE INDEX personal_plan_one_time_checkout_consents_user_idx
  ON public.personal_plan_one_time_checkout_consents (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.personal_plan_one_time_checkout_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.personal_plan_one_time_checkout_consents FROM anon, authenticated;
GRANT ALL ON TABLE public.personal_plan_one_time_checkout_consents TO service_role;

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
  IF (OLD.stripe_checkout_session_id IS NOT NULL AND NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id)
    OR (OLD.paypal_order_id IS NOT NULL AND NEW.paypal_order_id IS DISTINCT FROM OLD.paypal_order_id)
    OR (OLD.paypal_capture_id IS NOT NULL AND NEW.paypal_capture_id IS DISTINCT FROM OLD.paypal_capture_id) THEN
    RAISE EXCEPTION 'provider references may be bound only once' USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_personal_plan_one_time_consent_binding()
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_personal_plan_one_time_consent_binding
  BEFORE INSERT ON public.personal_plan_one_time_checkout_consents
  FOR EACH ROW EXECUTE FUNCTION public.validate_personal_plan_one_time_consent_binding();

CREATE TRIGGER enforce_personal_plan_one_time_consent_immutability
  BEFORE UPDATE ON public.personal_plan_one_time_checkout_consents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_personal_plan_one_time_consent_immutability();

CREATE TRIGGER set_updated_at_personal_plan_one_time_checkout_consents
  BEFORE UPDATE ON public.personal_plan_one_time_checkout_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.personal_plan_one_time_checkout_consents IS
  'Service-written immutable immediate-performance consent, confirmation, generation, delivery, and first-access evidence.';
