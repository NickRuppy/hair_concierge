CREATE TABLE private.stripe_trial_continuation_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  original_agreement_id text NOT NULL,
  source_agreement_id text,
  accepted_offer jsonb,
  customer_id text NOT NULL,
  source_object_id text NOT NULL,
  paid_through_at timestamptz NOT NULL CHECK (isfinite(paid_through_at)),
  payment_succeeded_at timestamptz NOT NULL CHECK (isfinite(payment_succeeded_at)),
  neutralized_at timestamptz,
  continuation_agreement_id text UNIQUE,
  create_attempted_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'canceled')),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (paid_through_at > payment_succeeded_at),
  CHECK (continuation_agreement_id IS NULL OR continuation_agreement_id <> original_agreement_id)
);
ALTER TABLE private.stripe_trial_continuation_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stripe_trial_continuation_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.stripe_trial_continuation_operations TO service_role;

-- Only ledger-created debt can authorize a provider operation. Original terms
-- and payment boundaries are copied once and never rebuilt from current config.
CREATE FUNCTION public.claim_stripe_trial_continuations(p_limit integer DEFAULT 5, p_enrollment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid continuation batch'; END IF;
  INSERT INTO private.stripe_trial_continuation_operations(enrollment_id, original_agreement_id, source_agreement_id, accepted_offer, customer_id,
    source_object_id, paid_through_at, payment_succeeded_at)
  SELECT e.id, e.provider_agreement_id, effective.contract->>'provider_agreement_id', effective.contract->'accepted_offer',
    b.provider_customer_id, d.source_object_id, d.owed_paid_through_at, d.payment_succeeded_at
  FROM private.trial_payment_continuation_reconciliations d
  JOIN public.trial_enrollments e ON e.id = d.enrollment_id AND e.provider = 'stripe'
  CROSS JOIN LATERAL (SELECT public.read_trial_effective_contract(e.id) AS contract) effective
  JOIN public.billing_subscriptions b ON b.trial_enrollment_id = e.id AND b.provider = 'stripe'
    AND b.provider_subscription_id = e.provider_agreement_id AND b.user_id = e.user_id
  WHERE d.provider = 'stripe' AND d.status IN ('pending', 'error')
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

CREATE FUNCTION public.guard_stripe_trial_continuation(p_operation_id uuid, p_lease_token uuid)
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
  );
$$;

CREATE FUNCTION public.checkpoint_stripe_trial_continuation(p_operation_id uuid, p_lease_token uuid,
  p_action text, p_subscription_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE operation private.stripe_trial_continuation_operations%ROWTYPE;
BEGIN
  SELECT * INTO operation FROM private.stripe_trial_continuation_operations o
    WHERE o.id = p_operation_id AND o.lease_token = p_lease_token
      AND o.lease_until > clock_timestamp() AND o.status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_action = 'begin_create' THEN
    IF NOT public.guard_stripe_trial_continuation(p_operation_id, p_lease_token) OR operation.neutralized_at IS NULL
      OR operation.paid_through_at <= clock_timestamp() + interval '1 minute'
      OR (operation.create_attempted_at IS NOT NULL AND operation.create_attempted_at <= clock_timestamp() - interval '23 hours')
    THEN RETURN false; END IF;
    UPDATE private.stripe_trial_continuation_operations SET create_attempted_at = coalesce(create_attempted_at, clock_timestamp()) WHERE id = operation.id;
  ELSIF p_action = 'neutralized' THEN
    UPDATE private.stripe_trial_continuation_operations SET neutralized_at = coalesce(neutralized_at, clock_timestamp()) WHERE id = operation.id;
  ELSIF p_action = 'observed' THEN
    IF p_subscription_id IS NULL OR length(p_subscription_id) NOT BETWEEN 1 AND 255
      OR p_subscription_id = operation.original_agreement_id OR operation.neutralized_at IS NULL
      OR (operation.continuation_agreement_id IS NOT NULL AND operation.continuation_agreement_id <> p_subscription_id)
    THEN RETURN false; END IF;
    UPDATE private.stripe_trial_continuation_operations SET continuation_agreement_id = p_subscription_id WHERE id = operation.id;
  ELSIF p_action IN ('resolved', 'canceled') THEN
    IF p_action = 'resolved' AND NOT EXISTS (
      SELECT 1 FROM private.trial_paid_continuations c WHERE c.operation_id = operation.id
        AND c.provider = 'stripe' AND c.continuation_agreement_id = operation.continuation_agreement_id
    ) THEN RETURN false; END IF;
    UPDATE private.stripe_trial_continuation_operations SET status = p_action, lease_token = NULL, lease_until = NULL WHERE id = operation.id;
    UPDATE private.trial_payment_continuation_reconciliations SET status = 'resolved' WHERE enrollment_id = operation.enrollment_id;
  ELSIF p_action = 'retry' THEN
    UPDATE private.stripe_trial_continuation_operations SET next_attempt_at = clock_timestamp() + interval '5 minutes',
      lease_token = NULL, lease_until = NULL WHERE id = operation.id;
  ELSE RETURN false;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_trial_continuations(integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_stripe_trial_continuation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkpoint_stripe_trial_continuation(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_trial_continuations(integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_stripe_trial_continuation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkpoint_stripe_trial_continuation(uuid, uuid, text, text) TO service_role;
