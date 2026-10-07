-- Pin the original verified ACTIVATED event before changing PayPal start_time.
ALTER TABLE private.paypal_trial_checkout_attempts ADD COLUMN authorization_succeeded_at timestamptz;
ALTER TABLE private.paypal_trial_checkout_attempts ADD COLUMN activation_event_id text;
ALTER TABLE private.paypal_trial_checkout_attempts ADD CONSTRAINT paypal_trial_activation_evidence_pair CHECK (
 (authorization_succeeded_at IS NULL) = (activation_event_id IS NULL)
 AND (authorization_succeeded_at IS NULL OR isfinite(authorization_succeeded_at))
);
CREATE FUNCTION public.get_paypal_trial_checkout_attempt(p_token text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.paypal_trial_attempt_row(a) FROM private.paypal_trial_checkout_attempts a
 JOIN public.paypal_checkout_intents i ON i.id=a.intent_id WHERE i.token=p_token;
$$;
CREATE FUNCTION public.pin_paypal_trial_activation(p_token text,p_agreement_id text,p_event_id text,p_authorized_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts; i public.paypal_checkout_intents;
BEGIN
 SELECT * INTO i FROM public.paypal_checkout_intents WHERE token=p_token;
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE intent_id=i.id FOR UPDATE;
 IF NOT FOUND OR a.provider_reference IS DISTINCT FROM p_agreement_id OR i.provider_subscription_id IS DISTINCT FROM p_agreement_id
  OR a.status<>'provider_created' OR p_event_id IS NULL OR length(btrim(p_event_id)) NOT BETWEEN 1 AND 255
  OR p_authorized_at IS NULL OR NOT isfinite(p_authorized_at) OR p_authorized_at<i.created_at OR p_authorized_at>i.expires_at
  OR p_authorized_at>clock_timestamp()
 THEN RAISE EXCEPTION 'PayPal trial activation evidence mismatch'; END IF;
 IF a.authorization_succeeded_at IS NOT NULL THEN
  IF a.authorization_succeeded_at<>p_authorized_at THEN RAISE EXCEPTION 'PayPal trial activation clock conflict'; END IF;
  RETURN private.paypal_trial_attempt_row(a);
 END IF;
 UPDATE private.paypal_trial_checkout_attempts SET authorization_succeeded_at=p_authorized_at,activation_event_id=p_event_id,updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 RETURN private.paypal_trial_attempt_row(a);
END $$;
CREATE FUNCTION private.prevent_paypal_trial_activation_clock_rewrite() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.authorization_succeeded_at IS NOT NULL AND (NEW.authorization_succeeded_at IS DISTINCT FROM OLD.authorization_succeeded_at OR NEW.activation_event_id IS DISTINCT FROM OLD.activation_event_id)
 THEN RAISE EXCEPTION 'PayPal trial activation evidence immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER paypal_trial_activation_clock_immutable BEFORE UPDATE ON private.paypal_trial_checkout_attempts FOR EACH ROW EXECUTE FUNCTION private.prevent_paypal_trial_activation_clock_rewrite();
REVOKE ALL ON FUNCTION public.get_paypal_trial_checkout_attempt(text),public.pin_paypal_trial_activation(text,text,text,timestamptz),private.prevent_paypal_trial_activation_clock_rewrite() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paypal_trial_checkout_attempt(text),public.pin_paypal_trial_activation(text,text,text,timestamptz) TO service_role;
