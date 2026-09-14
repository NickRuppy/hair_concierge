CREATE OR REPLACE FUNCTION public.claim_stripe_trial_continuations(p_limit integer DEFAULT 5, p_enrollment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid continuation batch'; END IF;
  -- Serialize creation with explicit paid recovery, which locks this same enrollment.
  PERFORM 1 FROM public.trial_enrollments e WHERE e.provider='stripe'
    AND (p_enrollment_id IS NULL OR e.id=p_enrollment_id)
    AND EXISTS(SELECT 1 FROM private.trial_payment_continuation_reconciliations d WHERE d.enrollment_id=e.id AND d.status IN ('pending','error'))
    ORDER BY e.id FOR UPDATE;
  INSERT INTO private.stripe_trial_continuation_operations(enrollment_id, original_agreement_id, source_agreement_id, accepted_offer, customer_id,
    source_object_id, paid_through_at, payment_succeeded_at)
  SELECT e.id, e.provider_agreement_id, coalesce(c.continuation_agreement_id,effective.contract->>'provider_agreement_id'), effective.contract->'accepted_offer',
    b.provider_customer_id, d.source_object_id, d.owed_paid_through_at, d.payment_succeeded_at
  FROM private.trial_payment_continuation_reconciliations d
  JOIN public.trial_enrollments e ON e.id = d.enrollment_id AND e.provider = 'stripe'
  CROSS JOIN LATERAL (SELECT public.read_trial_effective_contract(e.id) AS contract) effective
  JOIN public.billing_subscriptions b ON b.trial_enrollment_id = e.id AND b.provider = 'stripe'
    AND b.provider_subscription_id = e.provider_agreement_id AND b.user_id = e.user_id
  LEFT JOIN private.trial_paid_continuations c ON c.enrollment_id=e.id AND c.provider='stripe'
  WHERE NOT EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations r WHERE r.enrollment_id=e.id AND r.status='pending')
    AND d.provider = 'stripe' AND d.status IN ('pending', 'error')
    AND (p_enrollment_id IS NULL OR e.id = p_enrollment_id)
    AND b.provider_customer_id IS NOT NULL AND e.provider_agreement_id IS NOT NULL
    AND e.first_payment_succeeded_at = d.payment_succeeded_at
    AND effective.contract->>'provider' = 'stripe' AND effective.contract->>'provider_agreement_id' IS NOT NULL
  ON CONFLICT (enrollment_id) DO NOTHING;
  WITH candidates AS (
    SELECT o.id FROM private.stripe_trial_continuation_operations o
    JOIN public.trial_enrollments e ON e.id = o.enrollment_id
    WHERE (o.status = 'pending' OR (o.status = 'resolved' AND (e.cancel_at_period_end OR e.access_revoked)))
      AND o.next_attempt_at <= clock_timestamp()
      AND (o.lease_until IS NULL OR o.lease_until < clock_timestamp())
      AND (p_enrollment_id IS NULL OR o.enrollment_id = p_enrollment_id)
    ORDER BY o.next_attempt_at, o.id LIMIT p_limit FOR UPDATE OF o SKIP LOCKED
  ), claimed AS (
    UPDATE private.stripe_trial_continuation_operations o SET status = 'pending', lease_token = gen_random_uuid(),
      lease_until = clock_timestamp() + interval '5 minutes'
    FROM candidates c WHERE o.id = c.id RETURNING o.*
  ) SELECT coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('accepted_offer', coalesce(c.accepted_offer,e.accepted_offer))), '[]'::jsonb)
    INTO result FROM claimed c JOIN public.trial_enrollments e ON e.id = c.enrollment_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_stripe_trial_continuation(p_operation_id uuid, p_lease_token uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.stripe_trial_continuation_operations o
    JOIN public.trial_enrollments e ON e.id = o.enrollment_id
    WHERE o.id = p_operation_id AND o.lease_token = p_lease_token AND o.lease_until > clock_timestamp()
      AND o.status = 'pending' AND e.provider = 'stripe' AND e.admission_status = 'active'
      AND e.user_id IS NOT NULL AND NOT e.cancel_at_period_end AND NOT e.access_revoked
      AND e.provider_agreement_id = o.original_agreement_id
      AND e.first_payment_succeeded_at = o.payment_succeeded_at
      AND e.paid_through_at >= o.paid_through_at
      AND NOT EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations r WHERE r.enrollment_id=e.id AND r.status='pending')
  );
$$;

