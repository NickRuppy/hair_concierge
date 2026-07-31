CREATE TABLE public.paypal_order_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  consent_id uuid NOT NULL UNIQUE REFERENCES public.personal_plan_one_time_checkout_consents(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (email = lower(email)),
  checkout_attempt_id uuid NOT NULL UNIQUE,
  product_kind text NOT NULL CHECK (product_kind = 'personal_plan_once'),
  provider_order_id text UNIQUE,
  provider_capture_id text UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'approved', 'captured', 'duplicate', 'failed', 'expired')),
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (provider_capture_id IS NULL OR status = 'captured')
);
CREATE INDEX paypal_order_intents_user_status_idx ON public.paypal_order_intents (user_id, status);
CREATE INDEX paypal_order_intents_lead_session_idx ON public.paypal_order_intents (lead_id, funnel_session_id);
ALTER TABLE public.paypal_order_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.paypal_order_intents FROM anon, authenticated;
GRANT ALL ON TABLE public.paypal_order_intents TO service_role;
CREATE OR REPLACE FUNCTION public.validate_paypal_order_intent_binding()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personal_plan_one_time_checkout_consents c WHERE c.id = NEW.consent_id AND c.lead_id = NEW.lead_id AND c.funnel_session_id = NEW.funnel_session_id AND c.product_kind = NEW.product_kind) THEN
    RAISE EXCEPTION 'PayPal order intent must bind its canonical consent, lead, and session' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_paypal_order_intent_binding BEFORE INSERT OR UPDATE ON public.paypal_order_intents FOR EACH ROW EXECUTE FUNCTION public.validate_paypal_order_intent_binding();
CREATE TRIGGER set_updated_at_paypal_order_intents BEFORE UPDATE ON public.paypal_order_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.paypal_order_intents IS 'Service-owned opaque PayPal Orders v2 recovery records bound to canonical consent.';
