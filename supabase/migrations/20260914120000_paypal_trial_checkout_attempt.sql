CREATE TABLE private.paypal_trial_checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope_kind text NOT NULL CHECK (scope_kind IN ('user','lead')), scope_id uuid NOT NULL, client_attempt_id uuid NOT NULL,
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT, intent_id uuid NOT NULL UNIQUE REFERENCES public.paypal_checkout_intents(id) ON DELETE RESTRICT,
  accepted_offer jsonb NOT NULL, status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','frozen','provider_created','reconciliation_required')),
  paypal_app_id text, paypal_product_id text, paypal_plan_id text, request_id text, request_expires_at timestamptz, provider_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(scope_kind,scope_id,client_attempt_id), CHECK ((request_id IS NULL) = (request_expires_at IS NULL)), CHECK (request_expires_at IS NULL OR isfinite(request_expires_at))
);
ALTER TABLE private.paypal_trial_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.paypal_trial_checkout_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.paypal_trial_checkout_attempts TO service_role;

CREATE OR REPLACE FUNCTION private.paypal_trial_offer_is_valid(p_offer jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p_offer IS NOT NULL AND jsonb_typeof(p_offer)='object' AND p_offer->>'cohort'='trial_v1' AND p_offer->>'offerVersion'='trial_launch_v1'
  AND p_offer->>'interval' IN ('month','year') AND p_offer->>'currency'='EUR' AND p_offer->>'trialDays'='7' AND p_offer->>'taxBehavior'='inclusive'
  AND p_offer->>'stripePriceId' ~ '^\S{1,255}$' AND (p_offer->'stripeCouponId'='null'::jsonb OR p_offer->>'stripeCouponId' ~ '^\S{1,255}$')
  AND ((p_offer->>'interval'='month' AND p_offer->'stripeCouponId'='null'::jsonb AND p_offer->>'firstAmountMinor'='999' AND p_offer->>'renewalAmountMinor'='999')
       OR (p_offer->>'interval'='year' AND p_offer->>'renewalAmountMinor'='9999' AND ((p_offer->'stripeCouponId'='null'::jsonb AND p_offer->>'firstAmountMinor'='9999') OR (p_offer->'stripeCouponId'<>'null'::jsonb AND p_offer->>'firstAmountMinor'='6999'))));
$$;
CREATE OR REPLACE FUNCTION private.paypal_trial_attempt_row(p private.paypal_trial_checkout_attempts) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(p)||jsonb_build_object('intent_token',i.token) FROM public.paypal_checkout_intents i WHERE i.id=p.intent_id;
$$;

CREATE OR REPLACE FUNCTION public.create_paypal_trial_checkout_attempt(p_scope_kind text,p_scope_id uuid,p_client_attempt_id uuid,p_offer jsonb,p_email text,p_lead_id uuid,p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts; e uuid; i uuid;
BEGIN
 IF p_scope_kind NOT IN ('user','lead') OR p_scope_id IS NULL OR p_client_attempt_id IS NULL OR NOT private.paypal_trial_offer_is_valid(p_offer)
  OR p_source NOT IN ('pricing_page','quiz_result_offer','premium_sheet')
  OR (p_scope_kind='user' AND (p_lead_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_scope_id)))
  OR (p_scope_kind='lead' AND p_lead_id IS DISTINCT FROM p_scope_id)
  OR (p_email IS NOT NULL AND (length(btrim(p_email)) NOT BETWEEN 3 AND 320 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 THEN RAISE EXCEPTION 'PayPal trial checkout attempt invalid scope or offer'; END IF;
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE scope_kind=p_scope_kind AND scope_id=p_scope_id AND client_attempt_id=p_client_attempt_id FOR UPDATE;
 IF FOUND THEN IF a.accepted_offer<>p_offer THEN RAISE EXCEPTION 'PayPal trial checkout attempt conflict'; END IF; RETURN private.paypal_trial_attempt_row(a); END IF;
 BEGIN
  e:=gen_random_uuid();
  INSERT INTO public.trial_enrollments(id,user_id,provider,cohort,accepted_offer,admission_status) VALUES(e,CASE WHEN p_scope_kind='user' THEN p_scope_id ELSE NULL END,'paypal','trial_v1',p_offer,'reserved');
  INSERT INTO public.paypal_checkout_intents(token,interval,source,lead_id,email,user_id,expires_at,metadata) VALUES(replace(gen_random_uuid()::text,'-',''),p_offer->>'interval',p_source,CASE WHEN p_scope_kind='lead' THEN p_scope_id ELSE NULL END,lower(nullif(btrim(p_email),'')),CASE WHEN p_scope_kind='user' THEN p_scope_id ELSE NULL END,clock_timestamp()+interval '24 hours',jsonb_build_object('trial_cohort','trial_v1','trial_enrollment_id',e,'accepted_offer',p_offer)) RETURNING id INTO i;
  INSERT INTO private.paypal_trial_checkout_attempts(scope_kind,scope_id,client_attempt_id,enrollment_id,intent_id,accepted_offer) VALUES(p_scope_kind,p_scope_id,p_client_attempt_id,e,i,p_offer) RETURNING * INTO a;
 EXCEPTION WHEN unique_violation THEN
  SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE scope_kind=p_scope_kind AND scope_id=p_scope_id AND client_attempt_id=p_client_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE; END IF;
  IF a.accepted_offer<>p_offer THEN RAISE EXCEPTION 'PayPal trial checkout attempt conflict'; END IF;
 END;
 RETURN private.paypal_trial_attempt_row(a);
END $$;

CREATE OR REPLACE FUNCTION public.freeze_paypal_trial_checkout_attempt(p_attempt_id uuid,p_app_id text,p_product_id text,p_plan_id text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts;
BEGIN
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.status IN ('provider_created','reconciliation_required') OR p_app_id !~ '^\S{1,255}$' OR p_product_id !~ '^\S{1,255}$' OR p_plan_id !~ '^\S{1,255}$' OR p_request_id IS DISTINCT FROM ('paypal-trial:'||a.id::text||':v1') THEN RAISE EXCEPTION 'PayPal trial checkout reconciliation required'; END IF;
 IF a.request_id IS NOT NULL THEN
  IF a.paypal_app_id<>p_app_id OR a.paypal_product_id<>p_product_id OR a.paypal_plan_id<>p_plan_id OR a.request_id<>p_request_id THEN RAISE EXCEPTION 'PayPal trial checkout attempt conflict'; END IF;
  IF a.request_expires_at<=clock_timestamp() THEN UPDATE private.paypal_trial_checkout_attempts SET status='reconciliation_required',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a; END IF;
  RETURN private.paypal_trial_attempt_row(a);
 END IF;
 UPDATE private.paypal_trial_checkout_attempts SET paypal_app_id=p_app_id,paypal_product_id=p_product_id,paypal_plan_id=p_plan_id,request_id=p_request_id,request_expires_at=clock_timestamp()+interval '72 hours',status='frozen',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 UPDATE public.paypal_checkout_intents SET metadata=metadata||jsonb_build_object('paypal_app_id',p_app_id,'paypal_product_id',p_product_id,'paypal_plan_id',p_plan_id,'paypal_request_id',p_request_id),updated_at=clock_timestamp() WHERE id=a.intent_id;
 RETURN private.paypal_trial_attempt_row(a);
END $$;

CREATE OR REPLACE FUNCTION public.bind_paypal_trial_checkout_reference(p_attempt_id uuid,p_provider_reference text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts; intent public.paypal_checkout_intents;
BEGIN
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.status='reconciliation_required' OR a.request_id IS NULL OR a.request_expires_at<=clock_timestamp() OR p_provider_reference !~ '^\S{1,255}$' THEN
  IF FOUND AND a.request_expires_at<=clock_timestamp() THEN UPDATE private.paypal_trial_checkout_attempts SET status='reconciliation_required',updated_at=clock_timestamp() WHERE id=a.id; END IF;
  RAISE EXCEPTION 'PayPal trial checkout reconciliation required';
 END IF;
 IF a.provider_reference IS NOT NULL THEN IF a.provider_reference<>p_provider_reference THEN RAISE EXCEPTION 'PayPal trial checkout attempt conflict'; END IF; RETURN private.paypal_trial_attempt_row(a); END IF;
 SELECT * INTO intent FROM public.paypal_checkout_intents WHERE id=a.intent_id FOR UPDATE;
 IF NOT FOUND OR intent.provider_subscription_id IS NOT NULL OR intent.status<>'created' THEN RAISE EXCEPTION 'PayPal trial checkout attempt conflict'; END IF;
 UPDATE private.paypal_trial_checkout_attempts SET provider_reference=p_provider_reference,status='provider_created',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 UPDATE public.paypal_checkout_intents SET provider_subscription_id=p_provider_reference,status='approved',updated_at=clock_timestamp() WHERE id=a.intent_id;
 RETURN private.paypal_trial_attempt_row(a);
END $$;

CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_checkout_attempt_rewrite() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.scope_kind IS DISTINCT FROM OLD.scope_kind OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR NEW.client_attempt_id IS DISTINCT FROM OLD.client_attempt_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.intent_id IS DISTINCT FROM OLD.intent_id OR NEW.accepted_offer IS DISTINCT FROM OLD.accepted_offer
  OR (OLD.paypal_app_id IS NOT NULL AND NEW.paypal_app_id IS DISTINCT FROM OLD.paypal_app_id)
  OR (OLD.paypal_product_id IS NOT NULL AND NEW.paypal_product_id IS DISTINCT FROM OLD.paypal_product_id)
  OR (OLD.paypal_plan_id IS NOT NULL AND NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id)
  OR (OLD.request_id IS NOT NULL AND NEW.request_id IS DISTINCT FROM OLD.request_id)
  OR (OLD.request_expires_at IS NOT NULL AND NEW.request_expires_at IS DISTINCT FROM OLD.request_expires_at)
  OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
 THEN RAISE EXCEPTION 'PayPal trial checkout attempt immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER paypal_trial_checkout_attempt_immutable BEFORE UPDATE ON private.paypal_trial_checkout_attempts FOR EACH ROW EXECUTE FUNCTION private.prevent_paypal_trial_checkout_attempt_rewrite();
REVOKE ALL ON FUNCTION private.paypal_trial_offer_is_valid(jsonb),private.paypal_trial_attempt_row(private.paypal_trial_checkout_attempts),private.prevent_paypal_trial_checkout_attempt_rewrite() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_paypal_trial_checkout_attempt(text,uuid,uuid,jsonb,text,uuid,text),public.freeze_paypal_trial_checkout_attempt(uuid,text,text,text,text),public.bind_paypal_trial_checkout_reference(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_paypal_trial_checkout_attempt(text,uuid,uuid,jsonb,text,uuid,text),public.freeze_paypal_trial_checkout_attempt(uuid,text,text,text,text),public.bind_paypal_trial_checkout_reference(uuid,text) TO service_role;
