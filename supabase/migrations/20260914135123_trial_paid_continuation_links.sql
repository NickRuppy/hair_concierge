-- Provider-verified paid successor binding; the original trial agreement remains immutable.
CREATE FUNCTION public.lookup_trial_paid_continuation(p_provider text, p_agreement_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(c) FROM private.trial_paid_continuations c
    WHERE c.provider = p_provider AND c.continuation_agreement_id = p_agreement_id;
$$;
REVOKE ALL ON FUNCTION public.lookup_trial_paid_continuation(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_trial_paid_continuation(text,text) TO service_role;

CREATE FUNCTION public.lookup_trial_paid_continuation_by_enrollment(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(c) FROM private.trial_paid_continuations c WHERE c.enrollment_id = p_enrollment_id;
$$;
REVOKE ALL ON FUNCTION public.lookup_trial_paid_continuation_by_enrollment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_trial_paid_continuation_by_enrollment(uuid) TO service_role;

CREATE FUNCTION public.confirm_trial_paid_continuation(
  p_enrollment_id uuid, p_provider text, p_original_agreement_id text,
  p_continuation_agreement_id text, p_customer_id text, p_source_object_id text,
  p_paid_through_at timestamptz, p_operation_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  operation record;
  existing private.trial_paid_continuations%ROWTYPE;
BEGIN
  IF p_provider IS DISTINCT FROM 'stripe' OR p_operation_id IS NULL
    OR p_paid_through_at IS NULL OR NOT isfinite(p_paid_through_at)
    OR p_original_agreement_id IS NULL OR p_continuation_agreement_id IS NULL
    OR p_original_agreement_id = p_continuation_agreement_id
    OR length(btrim(p_continuation_agreement_id)) NOT BETWEEN 1 AND 255
    OR p_customer_id IS NULL OR p_source_object_id IS NULL
  THEN RETURN false; END IF;
  SELECT * INTO enrollment FROM public.trial_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO existing FROM private.trial_paid_continuations WHERE enrollment_id = p_enrollment_id;
  IF FOUND THEN
    RETURN existing.provider = p_provider AND existing.original_agreement_id = p_original_agreement_id
      AND existing.continuation_agreement_id = p_continuation_agreement_id
      AND existing.customer_id = p_customer_id AND existing.source_object_id = p_source_object_id
      AND existing.paid_through_at = p_paid_through_at AND existing.operation_id = p_operation_id;
  END IF;
  IF enrollment.provider <> p_provider OR enrollment.provider_agreement_id <> p_original_agreement_id
    OR enrollment.admission_status <> 'active' OR enrollment.user_id IS NULL
    OR enrollment.first_payment_succeeded_at IS NULL OR enrollment.paid_through_at <> p_paid_through_at
    OR enrollment.access_revoked OR enrollment.cancel_at_period_end OR p_paid_through_at <= clock_timestamp()
  THEN RETURN false; END IF;
  SELECT * INTO operation FROM private.stripe_trial_continuation_operations
    WHERE id = p_operation_id AND enrollment_id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND OR operation.original_agreement_id <> p_original_agreement_id
    OR operation.customer_id <> p_customer_id OR operation.source_object_id <> p_source_object_id
    OR operation.paid_through_at <> p_paid_through_at OR operation.neutralized_at IS NULL
    OR operation.continuation_agreement_id IS DISTINCT FROM p_continuation_agreement_id
    OR operation.status <> 'pending'
    OR NOT EXISTS (
      SELECT 1 FROM private.trial_payment_continuation_reconciliations d
      WHERE d.enrollment_id = p_enrollment_id AND d.provider = p_provider
        AND d.source_object_id = p_source_object_id AND d.owed_paid_through_at = p_paid_through_at
        AND d.payment_succeeded_at = enrollment.first_payment_succeeded_at
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.billing_subscriptions b
      WHERE b.trial_enrollment_id = p_enrollment_id AND b.user_id = enrollment.user_id
        AND b.provider = p_provider AND b.provider_subscription_id = p_original_agreement_id
        AND b.provider_customer_id = p_customer_id
    )
  THEN RETURN false; END IF;
  INSERT INTO private.trial_paid_continuations(enrollment_id,provider,original_agreement_id,
    continuation_agreement_id,customer_id,source_object_id,paid_through_at,operation_id)
  VALUES(p_enrollment_id,p_provider,p_original_agreement_id,p_continuation_agreement_id,
    p_customer_id,p_source_object_id,p_paid_through_at,p_operation_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_trial_paid_continuation(uuid,text,text,text,text,text,timestamptz,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_trial_paid_continuation(uuid,text,text,text,text,text,timestamptz,uuid)
  TO service_role;

-- Called only after the verified Stripe event also matches the exact operation
-- metadata and cancellation comment. A pending operation alone cannot prove who canceled.
CREATE FUNCTION public.is_trial_continuation_source_cancellation(
  p_enrollment_id uuid, p_original_agreement_id text, p_customer_id text, p_operation_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM private.stripe_trial_continuation_operations o
    JOIN public.trial_enrollments e ON e.id = o.enrollment_id
    JOIN private.trial_payment_continuation_reconciliations d ON d.enrollment_id = e.id
    WHERE o.id = p_operation_id AND e.id = p_enrollment_id
      AND coalesce(o.source_agreement_id,o.original_agreement_id) = p_original_agreement_id
      AND e.provider_agreement_id = o.original_agreement_id
      AND o.customer_id = p_customer_id AND e.provider = 'stripe'
      AND e.first_payment_succeeded_at = o.payment_succeeded_at
      AND d.source_object_id = o.source_object_id AND d.owed_paid_through_at = o.paid_through_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.is_trial_continuation_source_cancellation(uuid,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_trial_continuation_source_cancellation(uuid,text,text,uuid)
  TO service_role;
