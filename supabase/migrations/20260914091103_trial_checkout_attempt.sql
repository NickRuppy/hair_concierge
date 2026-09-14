CREATE TABLE public.trial_checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind text NOT NULL CHECK (scope_kind IN ('user', 'lead')),
  scope_id uuid NOT NULL,
  client_attempt_id uuid NOT NULL,
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
  accepted_offer jsonb NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'frozen', 'provider_created', 'reconciliation_required')),
  stripe_account_id text,
  stripe_livemode boolean,
  stripe_params jsonb,
  expires_at timestamptz,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_kind, scope_id, client_attempt_id),
  CHECK ((stripe_account_id IS NULL) = (stripe_livemode IS NULL)),
  CHECK ((stripe_account_id IS NULL) = (stripe_params IS NULL)),
  CHECK ((stripe_account_id IS NULL) = (expires_at IS NULL))
);

ALTER TABLE public.trial_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trial_checkout_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.trial_checkout_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.create_trial_checkout_attempt(
  p_scope_kind text, p_scope_id uuid, p_client_attempt_id uuid, p_offer jsonb
) RETURNS public.trial_checkout_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_existing public.trial_checkout_attempts; v_enrollment uuid;
BEGIN
  SELECT * INTO v_existing FROM public.trial_checkout_attempts
   WHERE scope_kind=p_scope_kind AND scope_id=p_scope_id AND client_attempt_id=p_client_attempt_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.accepted_offer->>'interval' <> p_offer->>'interval' OR p_scope_kind NOT IN ('user','lead') THEN RAISE EXCEPTION 'trial checkout attempt conflict'; END IF;
    RETURN v_existing;
  END IF;
  IF p_scope_kind NOT IN ('user','lead') OR p_scope_id IS NULL OR p_client_attempt_id IS NULL OR p_offer IS NULL OR jsonb_typeof(p_offer)<>'object' THEN RAISE EXCEPTION 'trial checkout attempt invalid'; END IF;
  v_enrollment := pg_catalog.gen_random_uuid();
  INSERT INTO public.trial_enrollments (id,user_id,provider,cohort,accepted_offer,admission_status)
  VALUES (v_enrollment, CASE WHEN p_scope_kind='user' THEN p_scope_id ELSE NULL END, 'stripe','trial_v1',p_offer,'reserved');
  INSERT INTO public.trial_checkout_attempts(scope_kind,scope_id,client_attempt_id,enrollment_id,accepted_offer)
  VALUES(p_scope_kind,p_scope_id,p_client_attempt_id,v_enrollment,p_offer) RETURNING * INTO v_existing;
  RETURN v_existing;
END $$;

CREATE OR REPLACE FUNCTION public.load_trial_checkout_attempt(p_scope_kind text,p_scope_id uuid,p_client_attempt_id uuid)
RETURNS public.trial_checkout_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_attempt public.trial_checkout_attempts;
BEGIN
  SELECT * INTO v_attempt FROM public.trial_checkout_attempts
   WHERE scope_kind=p_scope_kind AND scope_id=p_scope_id AND client_attempt_id=p_client_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'trial checkout attempt unavailable'; END IF;
  RETURN v_attempt;
END $$;

CREATE OR REPLACE FUNCTION public.freeze_trial_stripe_checkout_attempt(
  p_attempt_id uuid, p_stripe_account_id text, p_livemode boolean, p_params jsonb, p_expires_at timestamptz
) RETURNS public.trial_checkout_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_attempt public.trial_checkout_attempts;
BEGIN
  SELECT * INTO v_attempt FROM public.trial_checkout_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.status IN ('provider_created','reconciliation_required') THEN RAISE EXCEPTION 'trial checkout reconciliation required'; END IF;
  IF p_stripe_account_id IS NULL OR p_livemode IS NULL OR p_params IS NULL OR jsonb_typeof(p_params)<>'object' OR p_expires_at IS NULL OR NOT pg_catalog.isfinite(p_expires_at) OR p_stripe_account_id !~ '^acct_[[:alnum:]_]+$' THEN RAISE EXCEPTION 'trial checkout attempt invalid'; END IF;
  IF v_attempt.stripe_params IS NOT NULL THEN
    IF v_attempt.stripe_account_id<>p_stripe_account_id OR v_attempt.stripe_livemode<>p_livemode OR v_attempt.stripe_params<>p_params OR v_attempt.expires_at<>p_expires_at THEN RAISE EXCEPTION 'trial checkout attempt conflict'; END IF;
    RETURN v_attempt;
  END IF;
  IF p_expires_at <= pg_catalog.now() OR p_expires_at > pg_catalog.now()+interval '23 hours' OR v_attempt.created_at <= pg_catalog.now()-interval '23 hours' THEN
    UPDATE public.trial_checkout_attempts SET status='reconciliation_required',updated_at=pg_catalog.now() WHERE id=v_attempt.id RETURNING * INTO v_attempt;
    RETURN v_attempt;
  END IF;
  UPDATE public.trial_checkout_attempts SET stripe_account_id=p_stripe_account_id,stripe_livemode=p_livemode,stripe_params=p_params,expires_at=p_expires_at,status='frozen',updated_at=pg_catalog.now()
   WHERE id=v_attempt.id RETURNING * INTO v_attempt;
  RETURN v_attempt;
END $$;

CREATE OR REPLACE FUNCTION public.bind_trial_stripe_checkout_reference(p_attempt_id uuid,p_provider_reference text)
RETURNS public.trial_checkout_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_attempt public.trial_checkout_attempts;
BEGIN
  SELECT * INTO v_attempt FROM public.trial_checkout_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.stripe_params IS NULL OR v_attempt.status='reconciliation_required' THEN RAISE EXCEPTION 'trial checkout reconciliation required'; END IF;
  IF p_provider_reference IS NULL OR pg_catalog.length(p_provider_reference)=0 THEN RAISE EXCEPTION 'trial checkout attempt invalid'; END IF;
  IF v_attempt.provider_reference IS NOT NULL THEN
    IF v_attempt.provider_reference<>p_provider_reference THEN RAISE EXCEPTION 'trial checkout attempt conflict'; END IF;
    RETURN v_attempt;
  END IF;
  UPDATE public.trial_checkout_attempts SET provider_reference=p_provider_reference,status='provider_created',updated_at=pg_catalog.now() WHERE id=v_attempt.id RETURNING * INTO v_attempt;
  RETURN v_attempt;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_trial_checkout_attempt_rewrite()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.scope_kind IS DISTINCT FROM OLD.scope_kind OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR NEW.client_attempt_id IS DISTINCT FROM OLD.client_attempt_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.accepted_offer IS DISTINCT FROM OLD.accepted_offer OR NEW.provider IS DISTINCT FROM OLD.provider OR (OLD.stripe_params IS NOT NULL AND (NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id OR NEW.stripe_livemode IS DISTINCT FROM OLD.stripe_livemode OR NEW.stripe_params IS DISTINCT FROM OLD.stripe_params OR NEW.expires_at IS DISTINCT FROM OLD.expires_at)) OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference) THEN
    RAISE EXCEPTION 'trial checkout attempt immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trial_checkout_attempt_immutable BEFORE UPDATE ON public.trial_checkout_attempts FOR EACH ROW EXECUTE FUNCTION public.prevent_trial_checkout_attempt_rewrite();

REVOKE ALL ON FUNCTION public.create_trial_checkout_attempt(text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.load_trial_checkout_attempt(text,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_trial_stripe_checkout_attempt(uuid,text,boolean,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_trial_stripe_checkout_reference(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trial_checkout_attempt(text,uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.load_trial_checkout_attempt(text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.freeze_trial_stripe_checkout_attempt(uuid,text,boolean,jsonb,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_trial_stripe_checkout_reference(uuid,text) TO service_role;
