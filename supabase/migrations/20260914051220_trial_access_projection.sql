-- Safe, server-derived facts on the existing owner-readable billing row.
-- Identity claims, accepted provider price IDs and reconciliation evidence stay private.
ALTER TABLE public.billing_subscriptions ADD COLUMN trial_access_facts jsonb;

CREATE FUNCTION public.project_trial_access(e public.trial_enrollments) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'version', 1, 'enrollmentId', e.id, 'admissionStatus', e.admission_status,
    'authorizationSucceededAt', e.authorization_succeeded_at,
    'originalTrialEndAt', e.original_trial_end_at,
    'firstPaymentSucceededAt', e.first_payment_succeeded_at,
    'paidThroughAt', e.paid_through_at,
    'renewalGraceEndsAt', e.renewal_grace_ends_at,
    'renewalPaymentFailed', e.renewal_payment_failed,
    'cancelAtPeriodEnd', e.cancel_at_period_end,
    'accessRevoked', e.access_revoked OR e.user_id IS NULL
  );
$$;

CREATE FUNCTION public.derive_billing_trial_access() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE enrollment public.trial_enrollments%ROWTYPE;
BEGIN
  IF NEW.trial_enrollment_id IS NULL THEN
    NEW.trial_access_facts := NULL;
    RETURN NEW;
  END IF;
  -- Serialize projection creation with access changes. Without this lock an
  -- uncommitted insert can escape the enrollment's sync trigger after revocation.
  SELECT * INTO enrollment FROM public.trial_enrollments WHERE id = NEW.trial_enrollment_id FOR SHARE;
  IF NOT FOUND OR (enrollment.user_id IS NOT NULL AND enrollment.user_id <> NEW.user_id) THEN
    RAISE EXCEPTION 'Trial enrollment owner mismatch' USING ERRCODE = '23514';
  END IF;
  NEW.trial_access_facts := public.project_trial_access(enrollment);
  RETURN NEW;
END;
$$;
CREATE TRIGGER derive_billing_trial_access BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.derive_billing_trial_access();

CREATE FUNCTION public.sync_billing_trial_access() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.billing_subscriptions SET trial_access_facts = public.project_trial_access(NEW)
    WHERE trial_enrollment_id = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_billing_trial_access AFTER UPDATE OF
  user_id, admission_status, authorization_succeeded_at, original_trial_end_at,
  first_payment_succeeded_at, paid_through_at, renewal_grace_ends_at,
  renewal_payment_failed, cancel_at_period_end, access_revoked
  ON public.trial_enrollments FOR EACH ROW EXECUTE FUNCTION public.sync_billing_trial_access();

-- Same ordered access decisions as trial-policy.ts, on constrained typed DB facts.
-- Product entitlement (including an active trial) is distinct from paid revenue.
CREATE FUNCTION public.trial_enrollment_has_access(e public.trial_enrollments, at_time timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE
    WHEN e.id IS NULL OR e.user_id IS NULL OR e.admission_status <> 'active'
      OR e.access_revoked OR at_time IS NULL OR NOT isfinite(at_time) THEN false
    WHEN e.first_payment_succeeded_at <= at_time AND e.paid_through_at > at_time THEN true
    WHEN e.first_payment_succeeded_at <= at_time AND e.renewal_payment_failed
      AND NOT e.cancel_at_period_end AND e.paid_through_at <= at_time
      AND e.renewal_grace_ends_at > e.paid_through_at
      THEN e.renewal_grace_ends_at > at_time
    ELSE coalesce(e.authorization_succeeded_at <= at_time AND e.original_trial_end_at > at_time, false)
  END;
$$;

-- Keep existing view column order, appending new fields, so dependent views survive.
CREATE OR REPLACE VIEW public.billing_subscriptions_classified WITH (security_invoker = true) AS
SELECT b.id, b.user_id, b.provider, b.provider_customer_id, b.provider_subscription_id,
  b.provider_status, b.entitlement_status, b.interval, b.current_period_end,
  b.cancel_at_period_end, b.cancelled_at, b.metadata, b.created_at, b.updated_at,
  b.provider_subscriber_email, b.cancel_scheduled_at,
  (
    b.metadata ?| array['qa_seed', 'ci_seed', 'is_internal_test', 'seeded_by', 'local_test', 'seed_source']
    OR coalesce(b.metadata ->> 'source', '') IN ('chat_eval_ci', 'local_dev_login_clean_test', 'codex_link_card_test')
    OR b.provider_subscription_id LIKE '%K0IN8ErFeg%'
    OR coalesce(b.metadata ->> 'checkout_session_id', '') LIKE 'cs_test_%'
    OR b.metadata ? 'backfilled_from_profiles'
  ) AS is_test,
  CASE WHEN b.metadata -> 'trial_cohort' IS NOT NULL
      AND b.metadata -> 'trial_cohort' <> 'null'::jsonb
      AND b.metadata -> 'trial_cohort' <> '"trial_v1"'::jsonb THEN false
    WHEN b.trial_enrollment_id IS NOT NULL THEN public.trial_enrollment_has_access(e, now())
    WHEN b.metadata -> 'trial_cohort' IS NOT NULL
      AND b.metadata -> 'trial_cohort' <> 'null'::jsonb THEN false
    ELSE (
      (b.entitlement_status IN ('active', 'past_due') AND b.current_period_end >= now() - interval '1 day')
      OR (b.entitlement_status = 'canceled' AND b.cancel_at_period_end AND b.current_period_end > now())
    ) END AS is_current,
  b.trial_enrollment_id, b.trial_access_facts
FROM public.billing_subscriptions b
LEFT JOIN public.trial_enrollments e ON e.id = b.trial_enrollment_id;

CREATE OR REPLACE VIEW public.billing_subscriptions_current WITH (security_invoker = true) AS
  SELECT * FROM public.billing_subscriptions_classified WHERE NOT is_test AND is_current;

COMMENT ON VIEW public.billing_subscriptions_classified IS
  'Billing access classification: legacy grace preserved; linked trials use verified enrollment deadlines. is_current is product access, not proof of paid revenue.';
COMMENT ON VIEW public.billing_subscriptions_current IS
  'Non-test subscriptions with current product access, including verified active trials. Not a revenue or paid-conversion source.';
COMMENT ON COLUMN public.billing_subscriptions.trial_access_facts IS
  'Sanitized access projection derived by database triggers; callers cannot override it. No identity claims or provider price IDs.';

REVOKE ALL ON FUNCTION public.project_trial_access(public.trial_enrollments) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_billing_trial_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_billing_trial_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trial_enrollment_has_access(public.trial_enrollments, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_trial_access(public.trial_enrollments) TO service_role;
GRANT EXECUTE ON FUNCTION public.derive_billing_trial_access() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_billing_trial_access() TO service_role;
GRANT EXECUTE ON FUNCTION public.trial_enrollment_has_access(public.trial_enrollments, timestamptz) TO service_role;
REVOKE ALL ON public.billing_subscriptions_classified, public.billing_subscriptions_current FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_subscriptions_classified, public.billing_subscriptions_current TO service_role;
