CREATE TABLE private.stripe_paid_cancellation_operations (
  id uuid PRIMARY KEY,
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  agreement_id text NOT NULL,
  original_agreement_id text NOT NULL,
  customer_id text NOT NULL,
  paid_through_at timestamptz NOT NULL CHECK (isfinite(paid_through_at)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.stripe_paid_cancellation_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stripe_paid_cancellation_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.stripe_paid_cancellation_operations TO service_role;

CREATE FUNCTION public.request_stripe_paid_cancellation(p_request_id uuid, p_enrollment_id uuid, p_authenticated_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; operation private.stripe_paid_cancellation_operations%ROWTYPE;
  billing record; successor text;
BEGIN
  IF p_request_id IS NULL OR p_enrollment_id IS NULL OR p_authenticated_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id AND user_id=p_authenticated_user_id FOR UPDATE;
  IF NOT FOUND OR e.provider <> 'stripe' OR e.admission_status <> 'active' OR e.first_payment_succeeded_at IS NULL
    OR e.paid_through_at IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO operation FROM private.stripe_paid_cancellation_operations WHERE enrollment_id=e.id;
  IF FOUND THEN
    IF operation.user_id <> p_authenticated_user_id THEN RETURN NULL; END IF;
    RETURN to_jsonb(operation);
  END IF;
  SELECT b.* INTO billing FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id
    AND b.provider='stripe' AND b.user_id=e.user_id AND b.provider_subscription_id=e.provider_agreement_id;
  IF NOT FOUND OR billing.provider_customer_id IS NULL THEN RETURN NULL; END IF;
  SELECT c.continuation_agreement_id INTO successor FROM private.trial_paid_continuations c WHERE c.enrollment_id=e.id AND c.provider='stripe';
  IF successor IS NULL THEN
    SELECT o.continuation_agreement_id INTO successor FROM private.stripe_trial_continuation_operations o WHERE o.enrollment_id=e.id;
  END IF;
  IF successor IS NULL THEN successor := public.read_trial_effective_contract(e.id)->>'provider_agreement_id'; END IF;
  UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id;
  INSERT INTO private.stripe_paid_cancellation_operations(id,enrollment_id,user_id,agreement_id,original_agreement_id,customer_id,paid_through_at)
    VALUES(p_request_id,e.id,e.user_id,coalesce(successor,e.provider_agreement_id),e.provider_agreement_id,billing.provider_customer_id,e.paid_through_at)
    RETURNING * INTO operation;
  RETURN to_jsonb(operation);
END;
$$;

CREATE FUNCTION public.claim_stripe_paid_cancellations(p_limit integer DEFAULT 5, p_operation_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid cancellation batch'; END IF;
  WITH candidates AS (
    SELECT o.id FROM private.stripe_paid_cancellation_operations o WHERE o.status='pending'
      AND (p_operation_id IS NULL OR o.id=p_operation_id) AND o.next_attempt_at <= clock_timestamp()
      AND (o.lease_until IS NULL OR o.lease_until < clock_timestamp())
    ORDER BY o.next_attempt_at,o.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE private.stripe_paid_cancellation_operations o SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes'
      FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO result FROM claimed c;
  RETURN result;
END;
$$;

CREATE FUNCTION public.finish_stripe_paid_cancellation(p_operation_id uuid,p_lease_token uuid,p_confirmed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE operation private.stripe_paid_cancellation_operations%ROWTYPE;
BEGIN
  SELECT * INTO operation FROM private.stripe_paid_cancellation_operations o WHERE o.id=p_operation_id AND o.lease_token=p_lease_token
    AND o.lease_until > clock_timestamp() AND o.status='pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  -- A response-lost continuation creation must be neutralized by its own worker
  -- before confirming that no hidden agreement can collect.
  IF p_confirmed AND EXISTS (SELECT 1 FROM private.stripe_trial_continuation_operations o WHERE o.enrollment_id=operation.enrollment_id
    AND o.status='pending' AND o.create_attempted_at IS NOT NULL) THEN p_confirmed := false; END IF;
  UPDATE private.stripe_paid_cancellation_operations SET status=CASE WHEN p_confirmed THEN 'confirmed' ELSE 'pending' END,
    lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+interval '5 minutes' WHERE id=operation.id;
  RETURN p_confirmed;
END;
$$;
REVOKE ALL ON FUNCTION public.request_stripe_paid_cancellation(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_stripe_paid_cancellations(integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_stripe_paid_cancellation(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_stripe_paid_cancellation(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_stripe_paid_cancellations(integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_paid_cancellation(uuid,uuid,boolean) TO service_role;
