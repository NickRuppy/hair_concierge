-- PayPal trial end fixed at checkout freeze.
--
-- PayPal computes a subscription's billing clock once, from the start_time it
-- was created with, and never recomputes it after a start_time PATCH (observed
-- live 2026-09-15: patched start applied, next_billing_time frozen at the old
-- date). The PayPal trial end is therefore fixed BEFORE approval, at checkout
-- freeze, as the next UTC midnight strictly after freeze + 8 days: every
-- approval inside the 24-hour checkout intent window still gets at least the
-- promised 7 × 24 h, the customer sees one date for trial end and first
-- charge, and activation verifies the provider's echoed start_time exactly.
-- Stripe keeps the exact seven-day end (authorization + 7 days).
--
-- 1. trial_enrollments: the trial end is at least seven days after
--    authorization (exact for Stripe, 8–9 days for PayPal), never more than ten.
DO $$
DECLARE c text; n integer := 0;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.trial_enrollments'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%original_trial_end_at = (authorization_succeeded_at + %'
  LOOP
    EXECUTE format('ALTER TABLE public.trial_enrollments DROP CONSTRAINT %I', c);
    n := n + 1;
  END LOOP;
  IF n <> 1 THEN RAISE EXCEPTION 'Expected exactly one seven-day trial end constraint, found %', n; END IF;
END $$;
ALTER TABLE public.trial_enrollments ADD CONSTRAINT trial_enrollments_trial_end_bounds CHECK (
  authorization_succeeded_at IS NULL OR (
    isfinite(authorization_succeeded_at) AND isfinite(original_trial_end_at)
    AND original_trial_end_at >= authorization_succeeded_at + interval '604800 seconds'
    AND original_trial_end_at <= authorization_succeeded_at + interval '10 days'
  )
);

-- 2. admit_trial_enrollment accepts an explicit verified trial end. Body is the
--    identity-rights-lifecycle version plus the p_original_trial_end_at contract.
DROP FUNCTION public.admit_trial_enrollment(uuid, jsonb, timestamptz, text);
CREATE FUNCTION public.admit_trial_enrollment(
  p_enrollment_id uuid,
  p_claims jsonb,
  p_authorized_at timestamptz DEFAULT NULL,
  p_provider_agreement_id text DEFAULT NULL,
  p_original_trial_end_at timestamptz DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  claim jsonb;
  conflict_reason text;
  identity_lock bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(74144351);
  IF p_claims IS NULL OR jsonb_typeof(p_claims) <> 'array' THEN
    RAISE EXCEPTION 'Verified identity claims required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_claims) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Invalid identity claim count' USING ERRCODE = '22023';
  END IF;
  FOR claim IN SELECT value FROM jsonb_array_elements(p_claims) LOOP
    IF jsonb_typeof(claim) IS DISTINCT FROM 'object'
      OR jsonb_typeof(claim->'kind') IS DISTINCT FROM 'string'
      OR coalesce(claim->>'kind', '') NOT IN ('account', 'verified_email', 'stripe_card', 'paypal_payer')
      OR jsonb_typeof(claim->'keyVersion') IS DISTINCT FROM 'number'
      OR coalesce(claim->>'keyVersion', '') !~ '^[1-9][0-9]{0,8}$'
      OR jsonb_typeof(claim->'namespace') IS DISTINCT FROM 'string'
      OR coalesce(length(btrim(claim->>'namespace')), 0) NOT BETWEEN 1 AND 255
      OR jsonb_typeof(claim->'value') IS DISTINCT FROM 'string'
      OR coalesce(claim->>'value', '') !~ '^[0-9a-f]{64}$'
    THEN
      RAISE EXCEPTION 'Invalid verified identity claim' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (p_authorized_at IS NULL) <> (p_provider_agreement_id IS NULL)
    OR (p_authorized_at IS NOT NULL AND (
      NOT isfinite(p_authorized_at) OR p_authorized_at > clock_timestamp()
      OR length(btrim(p_provider_agreement_id)) NOT BETWEEN 1 AND 255
    ))
  THEN
    RAISE EXCEPTION 'Invalid verified authorization' USING ERRCODE = '22023';
  END IF;
  -- A provider-specific trial end (PayPal: the frozen collection midnight) must
  -- still grant at least the promised seven days and stay within the bounded
  -- approval window; Stripe passes NULL and keeps the exact seven-day end.
  IF p_original_trial_end_at IS NOT NULL AND (
    p_authorized_at IS NULL OR NOT isfinite(p_original_trial_end_at)
    OR p_original_trial_end_at < p_authorized_at + interval '604800 seconds'
    OR p_original_trial_end_at > p_authorized_at + interval '10 days'
  ) THEN
    RAISE EXCEPTION 'Invalid verified trial end' USING ERRCODE = '22023';
  END IF;

  p_claims := private.prepare_trial_identity_source('enrollment',p_enrollment_id::text,p_claims);
  SELECT * INTO enrollment FROM public.trial_enrollments
    WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid_state'; END IF;
  IF coalesce(enrollment.provider_agreement_id,p_provider_agreement_id) IS NOT NULL THEN
    INSERT INTO private.trial_identity_sources(kind,source_id,status,rights_reference)
    SELECT enrollment.provider,coalesce(enrollment.provider_agreement_id,p_provider_agreement_id),'erased',rights_reference
    FROM private.trial_identity_sources WHERE kind='enrollment' AND source_id=p_enrollment_id::text AND status='erased'
    ON CONFLICT(kind,source_id) DO UPDATE SET status='erased',rights_reference=excluded.rights_reference;
  END IF;
  IF coalesce(enrollment.provider_agreement_id,p_provider_agreement_id) IS NOT NULL AND jsonb_array_length(p_claims)>0 THEN
    p_claims := private.prepare_trial_identity_source(enrollment.provider,coalesce(enrollment.provider_agreement_id,p_provider_agreement_id),p_claims);
    INSERT INTO private.trial_identity_source_claims(source_kind,source_id,kind,key_version,namespace,claim_digest)
    SELECT enrollment.provider,coalesce(enrollment.provider_agreement_id,p_provider_agreement_id),c.kind,c.key_version,c.namespace,c.claim_digest
    FROM private.trial_identity_source_claims c JOIN private.trial_identity_sources s ON s.kind=enrollment.provider AND s.source_id=coalesce(enrollment.provider_agreement_id,p_provider_agreement_id)
    WHERE c.source_kind='enrollment' AND c.source_id=p_enrollment_id::text AND s.status='active' ON CONFLICT DO NOTHING;
  END IF;
  IF enrollment.provider_agreement_id IS NOT NULL
    AND p_provider_agreement_id IS NOT NULL
    AND enrollment.provider_agreement_id <> p_provider_agreement_id
  THEN RETURN 'invalid_state'; END IF;

  IF enrollment.admission_status IN ('blocked', 'released') THEN
    -- Approval may arrive after an earlier denial or reconciled abandonment.
    -- Persist the agreement for reconciliation; never resurrect the entitlement.
    IF p_authorized_at IS NOT NULL THEN
      UPDATE public.trial_enrollments SET provider_agreement_id = p_provider_agreement_id,
        neutralization_required = true WHERE id = p_enrollment_id;
    END IF;
    RETURN CASE WHEN enrollment.admission_status = 'blocked'
      THEN coalesce(enrollment.admission_denial_reason, 'invalid_state') ELSE 'invalid_state' END;
  END IF;

  IF enrollment.admission_status = 'active' THEN
    IF p_authorized_at IS DISTINCT FROM enrollment.authorization_succeeded_at
      OR p_provider_agreement_id IS DISTINCT FROM enrollment.provider_agreement_id
      OR (p_original_trial_end_at IS NOT NULL
        AND p_original_trial_end_at IS DISTINCT FROM enrollment.original_trial_end_at)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_claims) c
        WHERE NOT EXISTS (
          SELECT 1 FROM public.trial_identity_claims t
          WHERE t.kind = c->>'kind' AND t.key_version = (c->>'keyVersion')::integer
            AND t.namespace = c->>'namespace' AND t.claim_digest = c->>'value'
            AND t.enrollment_id = p_enrollment_id AND t.consumed_at IS NOT NULL
        )
      )
    THEN RETURN 'invalid_state'; END IF;
    RETURN 'active';
  END IF;

  -- Lock the same identity tuple in canonical order, including absent rows.
  -- Unique keys remain the final guard; advisory hash collisions only serialize work.
  FOR identity_lock IN SELECT lock_key FROM (
    SELECT DISTINCT hashtextextended(jsonb_build_array(
      c->>'kind', (c->>'keyVersion')::integer, c->>'namespace', c->>'value'
    )::text, 7319) AS lock_key FROM jsonb_array_elements(p_claims) c
  ) locks ORDER BY lock_key LOOP
    PERFORM pg_advisory_xact_lock(identity_lock);
  END LOOP;

  SELECT CASE WHEN bool_or(t.consumed_at IS NOT NULL) THEN 'trial_used' ELSE 'claim_reserved' END
    INTO conflict_reason
    FROM public.trial_identity_claims t JOIN jsonb_array_elements(p_claims) c
      ON t.kind = c->>'kind' AND t.key_version = (c->>'keyVersion')::integer
      AND t.namespace = c->>'namespace' AND t.claim_digest = c->>'value'
    WHERE t.enrollment_id IS DISTINCT FROM p_enrollment_id
    HAVING count(*) > 0;
  IF conflict_reason IS NOT NULL THEN
    UPDATE public.trial_enrollments SET admission_status = 'blocked', admission_denial_reason = conflict_reason,
      provider_agreement_id = coalesce(p_provider_agreement_id, provider_agreement_id),
      neutralization_required = (coalesce(p_provider_agreement_id, provider_agreement_id) IS NOT NULL)
      WHERE id = p_enrollment_id;
    RETURN conflict_reason;
  END IF;

  INSERT INTO public.trial_identity_claims(kind, key_version, namespace, claim_digest, enrollment_id)
    SELECT DISTINCT c->>'kind', (c->>'keyVersion')::integer, c->>'namespace', c->>'value', p_enrollment_id
    FROM jsonb_array_elements(p_claims) c
    ON CONFLICT (kind, key_version, namespace, claim_digest) DO NOTHING;
  -- Fail closed if a separate trusted writer bypassed our advisory-lock protocol.
  IF EXISTS (
    SELECT 1 FROM public.trial_identity_claims t JOIN jsonb_array_elements(p_claims) c
      ON t.kind = c->>'kind' AND t.key_version = (c->>'keyVersion')::integer
      AND t.namespace = c->>'namespace' AND t.claim_digest = c->>'value'
    WHERE t.enrollment_id IS DISTINCT FROM p_enrollment_id
  ) THEN
    RAISE EXCEPTION 'Trial identity ownership changed; retry reconciliation' USING ERRCODE = '40001';
  END IF;
  IF p_authorized_at IS NULL THEN RETURN 'reserved'; END IF;

  UPDATE public.trial_identity_claims SET consumed_at = p_authorized_at
    WHERE enrollment_id = p_enrollment_id AND consumed_at IS NULL;
  UPDATE public.trial_enrollments SET admission_status = 'active',
    provider_agreement_id = p_provider_agreement_id,
    authorization_succeeded_at = p_authorized_at,
    original_trial_end_at = coalesce(p_original_trial_end_at, p_authorized_at + interval '604800 seconds')
    WHERE id = p_enrollment_id;
  RETURN 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.admit_trial_enrollment(uuid, jsonb, timestamptz, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_trial_enrollment(uuid, jsonb, timestamptz, text, timestamptz) TO service_role;

-- 3. Collection window twins (SQL mirror of trialFirstCollectionWindowEnd):
--    an end exactly seven days after authorization (Stripe, legacy PayPal)
--    keeps its original window, next UTC midnight after the end plus two days,
--    even when that end sits on a midnight; a frozen PayPal end (more than
--    seven days out, always a midnight) is its own collection start and closes
--    two days later. Bodies are otherwise verbatim from the first-collection
--    bridge; the paid-recovery gate twins follow in the next migration.
CREATE OR REPLACE FUNCTION public.trial_enrollment_has_access(e public.trial_enrollments, at_time timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE
    WHEN e.id IS NULL OR e.user_id IS NULL OR e.admission_status <> 'active'
      OR e.access_revoked OR at_time IS NULL OR NOT isfinite(at_time) THEN false
    WHEN e.first_payment_succeeded_at <= at_time AND e.paid_through_at > at_time THEN true
    WHEN e.first_payment_succeeded_at <= at_time AND e.renewal_payment_failed
      AND NOT e.cancel_at_period_end AND e.paid_through_at <= at_time
      AND e.renewal_grace_ends_at > e.paid_through_at
      THEN e.renewal_grace_ends_at > at_time
    ELSE coalesce(
      e.authorization_succeeded_at <= at_time AND (
        e.original_trial_end_at > at_time
        OR (e.first_payment_succeeded_at IS NULL AND NOT e.cancel_at_period_end
          AND (((CASE WHEN e.original_trial_end_at = e.authorization_succeeded_at + interval '604800 seconds' THEN date_trunc('day', e.original_trial_end_at AT TIME ZONE 'UTC') ELSE date_trunc('day', (e.original_trial_end_at - interval '1 microsecond') AT TIME ZONE 'UTC') END + interval '3 days')) AT TIME ZONE 'UTC') > at_time)
      ), false)
  END;
$$;

