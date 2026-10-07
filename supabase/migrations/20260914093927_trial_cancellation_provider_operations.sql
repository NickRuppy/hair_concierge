ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE FUNCTION public.issue_trial_cancellation_capability(p_enrollment_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trial_enrollments AS e
    JOIN public.billing_subscriptions AS b ON b.trial_enrollment_id = e.id
      AND b.user_id = e.user_id AND b.provider = e.provider
      AND b.provider_subscription_id = e.provider_agreement_id
    WHERE e.id = p_enrollment_id AND e.user_id = p_user_id
      AND e.admission_status = 'active' AND NOT e.access_revoked
      AND e.authorization_succeeded_at IS NOT NULL
      AND e.original_trial_end_at > clock_timestamp()
      AND e.first_payment_succeeded_at IS NULL AND e.provider IN ('stripe', 'paypal')
      AND b.provider_customer_id IS NOT NULL
  );
$$;

CREATE FUNCTION public.load_trial_cancellation_provider_operation(p_declaration_id uuid, p_user_id uuid)
RETURNS TABLE (enrollment_id uuid, user_id uuid, provider text, provider_customer_id text,
  provider_agreement_id text, original_trial_end_at timestamptz, status text,
  cancel_at_period_end boolean, trial_cohort text, provider_plan_id text)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT e.id, e.user_id, e.provider, b.provider_customer_id,
    e.provider_agreement_id, e.original_trial_end_at, o.status, e.cancel_at_period_end,
    b.metadata ->> 'trial_cohort', b.metadata ->> 'paypal_plan_id'
  FROM private.trial_cancellation_provider_operations AS o
  JOIN private.trial_cancellation_declarations AS d ON d.id = o.declaration_id
  JOIN public.trial_enrollments AS e ON e.id = d.enrollment_id
  JOIN public.billing_subscriptions AS b ON b.trial_enrollment_id = e.id
    AND b.user_id = e.user_id AND b.provider = e.provider
    AND b.provider_subscription_id = e.provider_agreement_id
  WHERE d.id = p_declaration_id AND d.user_id = p_user_id AND e.user_id = p_user_id
    AND e.admission_status = 'active' AND NOT e.access_revoked
    AND e.authorization_succeeded_at IS NOT NULL AND e.first_payment_succeeded_at IS NULL
    AND e.original_trial_end_at = d.effective_end_at AND b.provider_customer_id IS NOT NULL
    AND o.status IN ('pending', 'confirmed');
$$;

CREATE FUNCTION public.confirm_trial_cancellation_provider_operation(
  p_declaration_id uuid, p_user_id uuid, p_enrollment_id uuid,
  p_provider text, p_provider_agreement_id text, p_provider_customer_id text,
  p_original_trial_end_at timestamptz, p_trial_cohort text DEFAULT NULL,
  p_provider_plan_id text DEFAULT NULL, p_lease_token uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE operation private.trial_cancellation_provider_operations%ROWTYPE;
BEGIN
  SELECT o.* INTO operation
  FROM private.trial_cancellation_provider_operations AS o
  JOIN private.trial_cancellation_declarations AS d ON d.id = o.declaration_id
  JOIN public.trial_enrollments AS e ON e.id = d.enrollment_id
  JOIN public.billing_subscriptions AS b ON b.trial_enrollment_id = e.id
    AND b.user_id = e.user_id AND b.provider = e.provider
    AND b.provider_subscription_id = e.provider_agreement_id
  WHERE o.declaration_id = p_declaration_id AND d.user_id = p_user_id AND e.user_id = p_user_id
    AND e.id = p_enrollment_id AND e.provider = p_provider
    AND e.provider_agreement_id = p_provider_agreement_id
    AND b.provider_customer_id = p_provider_customer_id AND e.original_trial_end_at = p_original_trial_end_at
    AND e.admission_status = 'active' AND NOT e.access_revoked
    AND e.authorization_succeeded_at IS NOT NULL AND e.first_payment_succeeded_at IS NULL
    AND e.cancel_at_period_end AND e.original_trial_end_at = d.effective_end_at
    AND b.provider_customer_id IS NOT NULL AND o.status IN ('pending', 'confirmed')
    AND (e.provider <> 'paypal' OR o.lease_token IS NOT DISTINCT FROM p_lease_token)
    AND (e.provider <> 'paypal' OR (
      p_trial_cohort = 'trial_v1' AND p_provider_plan_id IS NOT NULL
      AND b.metadata ->> 'trial_cohort' = p_trial_cohort
      AND b.metadata ->> 'paypal_plan_id' = p_provider_plan_id
    ))
  FOR UPDATE OF e, b, o;
  IF NOT FOUND THEN RETURN false; END IF;
  IF operation.status = 'confirmed' THEN RETURN true; END IF;
  UPDATE private.trial_cancellation_provider_operations
    SET status = 'confirmed', reconciled_at = clock_timestamp(), error_code = NULL
    WHERE declaration_id = operation.declaration_id AND status = 'pending';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.issue_trial_cancellation_capability(uuid, uuid),
  public.load_trial_cancellation_provider_operation(uuid, uuid),
  public.confirm_trial_cancellation_provider_operation(uuid, uuid, uuid, text, text, text, timestamptz, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_trial_cancellation_capability(uuid, uuid),
  public.load_trial_cancellation_provider_operation(uuid, uuid),
  public.confirm_trial_cancellation_provider_operation(uuid, uuid, uuid, text, text, text, timestamptz, text, text, uuid) TO service_role;
