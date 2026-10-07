-- A lease makes provider retry execution safe across overlapping cron invocations.
-- Declaration rows stay immutable and operations remain pending until an adapter
-- has reconciled the provider state; no receipt delivery is performed here.
ALTER TABLE private.trial_cancellation_provider_operations
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN next_attempt_at timestamptz,
  ADD COLUMN lease_token uuid,
  ADD COLUMN lease_expires_at timestamptz,
  ADD CONSTRAINT trial_cancellation_provider_operation_lease_pair
    CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL));

CREATE INDEX trial_cancellation_provider_operation_due_idx
  ON private.trial_cancellation_provider_operations (next_attempt_at, declaration_id)
  WHERE status = 'pending';

CREATE FUNCTION public.claim_trial_cancellation_provider_operations(
  p_limit integer, p_lease_seconds integer
) RETURNS TABLE (declaration_id uuid, user_id uuid, provider text, lease_token uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_limit NOT BETWEEN 1 AND 10 OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN
    RAISE EXCEPTION 'Invalid cancellation provider operation claim' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH due AS (
    SELECT o.declaration_id
    FROM private.trial_cancellation_provider_operations AS o
    JOIN private.trial_cancellation_declarations AS d ON d.id = o.declaration_id
    JOIN public.trial_enrollments AS e ON e.id = d.enrollment_id
    WHERE o.status = 'pending'
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= clock_timestamp())
      AND (o.lease_expires_at IS NULL OR o.lease_expires_at <= clock_timestamp())
    ORDER BY o.next_attempt_at NULLS FIRST, d.submitted_at
    FOR UPDATE OF o SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE private.trial_cancellation_provider_operations AS o
    SET lease_token = gen_random_uuid(),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        attempt_count = o.attempt_count + 1
    FROM due
    WHERE o.declaration_id = due.declaration_id
    RETURNING o.declaration_id, o.lease_token
  )
  SELECT claimed.declaration_id, d.user_id, e.provider, claimed.lease_token
  FROM claimed
  JOIN private.trial_cancellation_declarations AS d ON d.id = claimed.declaration_id
  JOIN public.trial_enrollments AS e ON e.id = d.enrollment_id;
END;
$$;

CREATE FUNCTION public.complete_trial_cancellation_provider_operation_attempt(
  p_declaration_id uuid, p_lease_token uuid, p_error_code text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE delay_seconds integer;
BEGIN
  IF p_error_code NOT IN ('', 'stripe_reconciliation_pending', 'paypal_reconciliation_pending') THEN
    RAISE EXCEPTION 'Invalid cancellation provider operation result' USING ERRCODE = '22023';
  END IF;
  delay_seconds := CASE p_error_code
    WHEN 'paypal_reconciliation_pending' THEN 300
    WHEN 'stripe_reconciliation_pending' THEN 300
    ELSE 0
  END;
  UPDATE private.trial_cancellation_provider_operations AS o
  SET lease_token = NULL,
      lease_expires_at = NULL,
      error_code = NULLIF(p_error_code, ''),
      next_attempt_at = CASE
        WHEN o.status = 'confirmed' THEN NULL
        WHEN delay_seconds = 0 THEN clock_timestamp()
        ELSE clock_timestamp() + make_interval(secs => delay_seconds)
      END
  WHERE o.declaration_id = p_declaration_id AND o.lease_token = p_lease_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_trial_cancellation_provider_operations(integer, integer),
  public.complete_trial_cancellation_provider_operation_attempt(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trial_cancellation_provider_operations(integer, integer),
  public.complete_trial_cancellation_provider_operation_attempt(uuid, uuid, text)
  TO service_role;
