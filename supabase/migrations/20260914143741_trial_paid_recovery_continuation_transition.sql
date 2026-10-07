CREATE TABLE private.trial_paid_continuation_history (
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  replaced_by_operation_id uuid PRIMARY KEY,
  binding jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.trial_paid_continuation_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_paid_continuation_history FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.trial_paid_continuation_history TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_trial_paid_continuation(
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
  IF FOUND AND existing.operation_id=p_operation_id THEN
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
  -- Exactly one extra hop is permitted for the verified first paid recovery
  -- candidate. Its already paid period remains authoritative if repair fails.
  IF existing.enrollment_id IS NOT NULL THEN
    IF operation.source_agreement_id IS DISTINCT FROM existing.continuation_agreement_id
      OR existing.provider <> p_provider OR existing.customer_id <> p_customer_id
      OR NOT EXISTS (SELECT 1 FROM private.trial_paid_recovery_operations r
        WHERE r.id=existing.operation_id AND r.enrollment_id=p_enrollment_id
          AND r.kind='recover_unpaid' AND r.status='committed'
          AND r.target_agreement_id=existing.continuation_agreement_id
          AND r.provider_verified_at IS NOT NULL)
    THEN RETURN false; END IF;
    INSERT INTO private.trial_paid_continuation_history(enrollment_id,replaced_by_operation_id,binding)
      VALUES(p_enrollment_id,p_operation_id,to_jsonb(existing));
    DELETE FROM private.trial_paid_continuations WHERE enrollment_id=p_enrollment_id
      AND operation_id=existing.operation_id;
  ELSIF coalesce(operation.source_agreement_id,operation.original_agreement_id)
    IS DISTINCT FROM (public.read_trial_effective_contract(p_enrollment_id)->>'provider_agreement_id')
  THEN RETURN false;
  END IF;
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


CREATE FUNCTION public.is_trial_paid_recovery_source_cancellation(
 p_enrollment_id uuid,p_source_agreement_id text,p_customer_id text,p_operation_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations o
 JOIN public.trial_enrollments e ON e.id=o.enrollment_id
 WHERE o.id=p_operation_id AND o.enrollment_id=p_enrollment_id AND o.provider='stripe'
 AND o.source_agreement_id=p_source_agreement_id AND o.provider_customer_id=p_customer_id
 AND o.status IN ('pending','committed') AND e.provider='stripe'
 AND e.provider_agreement_id=o.original_agreement_id AND e.user_id=o.user_id);
$$;
REVOKE ALL ON FUNCTION public.is_trial_paid_recovery_source_cancellation(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_trial_paid_recovery_source_cancellation(uuid,text,text,uuid) TO service_role;
