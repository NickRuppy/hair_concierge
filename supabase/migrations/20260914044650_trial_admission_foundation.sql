-- Empty, additive foundation only. No backfill, provider calls or real identity writes.
-- Privacy validation is required BEFORE enabling any writer, independently of offer flags.
CREATE TABLE public.trial_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cohort text NOT NULL DEFAULT 'trial_v1' CHECK (cohort = 'trial_v1'),
  accepted_offer jsonb NOT NULL CHECK (jsonb_typeof(accepted_offer) = 'object'),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_agreement_id text CHECK (length(provider_agreement_id) BETWEEN 1 AND 255),
  admission_status text NOT NULL DEFAULT 'reserved'
    CHECK (admission_status IN ('reserved', 'active', 'blocked', 'released')),
  admission_denial_reason text CHECK (admission_denial_reason IN ('trial_used', 'claim_reserved')),
  authorization_succeeded_at timestamptz,
  original_trial_end_at timestamptz,
  first_payment_succeeded_at timestamptz,
  paid_through_at timestamptz,
  renewal_grace_ends_at timestamptz,
  renewal_payment_failed boolean NOT NULL DEFAULT false,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  access_revoked boolean NOT NULL DEFAULT false,
  neutralization_required boolean NOT NULL DEFAULT false,
  neutralization_evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_agreement_id),
  CHECK ((authorization_succeeded_at IS NULL) = (original_trial_end_at IS NULL)),
  CHECK (authorization_succeeded_at IS NULL OR (
    isfinite(authorization_succeeded_at) AND isfinite(original_trial_end_at)
    AND original_trial_end_at = authorization_succeeded_at + interval '604800 seconds'
  )),
  CHECK (admission_status <> 'active' OR (
    authorization_succeeded_at IS NOT NULL AND provider_agreement_id IS NOT NULL
    AND NOT neutralization_required
  )),
  CHECK ((first_payment_succeeded_at IS NULL) = (paid_through_at IS NULL)),
  CHECK (first_payment_succeeded_at IS NULL OR (
    isfinite(first_payment_succeeded_at) AND isfinite(paid_through_at)
    AND paid_through_at > first_payment_succeeded_at
  )),
  CHECK (renewal_grace_ends_at IS NULL OR isfinite(renewal_grace_ends_at))
);
CREATE INDEX trial_enrollments_user_id_idx ON public.trial_enrollments(user_id);
CREATE INDEX trial_enrollments_neutralization_idx ON public.trial_enrollments(id)
  WHERE neutralization_required;

-- HMAC digests only. No raw account, email, card fingerprint or payer ID.
-- Deliberately independent of profile deletion; no invented retention deadline.
-- A lawful erasure procedure may delete these rows; do not create shadow tombstones.
CREATE TABLE public.trial_identity_claims (
  kind text NOT NULL CHECK (kind IN ('account', 'verified_email', 'stripe_card', 'paypal_payer')),
  key_version integer NOT NULL CHECK (key_version > 0),
  namespace text NOT NULL CHECK (length(btrim(namespace)) BETWEEN 1 AND 255),
  claim_digest text NOT NULL CHECK (claim_digest ~ '^[0-9a-f]{64}$'),
  enrollment_id uuid REFERENCES public.trial_enrollments(id) ON DELETE SET NULL,
  consumed_at timestamptz CHECK (consumed_at IS NULL OR isfinite(consumed_at)),
  PRIMARY KEY (kind, key_version, namespace, claim_digest),
  CHECK (consumed_at IS NOT NULL OR enrollment_id IS NOT NULL)
);
CREATE INDEX trial_identity_claims_enrollment_idx ON public.trial_identity_claims(enrollment_id);

ALTER TABLE public.billing_subscriptions ADD COLUMN trial_enrollment_id uuid
  REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT;
CREATE INDEX billing_subscriptions_trial_enrollment_idx
  ON public.billing_subscriptions(trial_enrollment_id) WHERE trial_enrollment_id IS NOT NULL;

-- A routine subscription upsert must not turn a new cohort back into a legacy
-- subscription (which would reintroduce the old expiry grace/profile fallback).
CREATE FUNCTION public.protect_trial_subscription_link() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.trial_enrollment_id IS NOT NULL
    AND NEW.trial_enrollment_id IS DISTINCT FROM OLD.trial_enrollment_id THEN
    RAISE EXCEPTION 'Immutable trial subscription cohort' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_trial_subscription_link BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.protect_trial_subscription_link();

ALTER TABLE public.trial_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_identity_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_enrollments, public.trial_identity_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trial_enrollments, public.trial_identity_claims TO service_role;

CREATE FUNCTION public.protect_trial_enrollment_terms() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.accepted_offer IS DISTINCT FROM OLD.accepted_offer
    OR NEW.cohort IS DISTINCT FROM OLD.cohort
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR (OLD.authorization_succeeded_at IS NOT NULL AND (
      NEW.authorization_succeeded_at IS DISTINCT FROM OLD.authorization_succeeded_at
      OR NEW.original_trial_end_at IS DISTINCT FROM OLD.original_trial_end_at
    ))
    OR (OLD.provider_agreement_id IS NOT NULL
      AND NEW.provider_agreement_id IS DISTINCT FROM OLD.provider_agreement_id)
    OR (OLD.admission_status = 'active' AND NEW.admission_status <> 'active')
    OR (OLD.admission_status = 'released' AND NEW.admission_status <> 'released')
  THEN
    RAISE EXCEPTION 'Immutable trial enrollment terms' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_trial_enrollment_terms BEFORE UPDATE ON public.trial_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.protect_trial_enrollment_terms();

-- Trusted backend only: verify ownership, existing entitlements, offer and provider
-- evidence before calling. Neither client redirects nor this RPC prove authorization.
-- A reserved claim never expires automatically: reconcile the provider before release.
CREATE FUNCTION public.admit_trial_enrollment(
  p_enrollment_id uuid,
  p_claims jsonb,
  p_authorized_at timestamptz DEFAULT NULL,
  p_provider_agreement_id text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  claim jsonb;
  conflict_reason text;
  identity_lock bigint;
BEGIN
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

  SELECT * INTO enrollment FROM public.trial_enrollments
    WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid_state'; END IF;
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
    original_trial_end_at = p_authorized_at + interval '604800 seconds'
    WHERE id = p_enrollment_id;
  RETURN 'active';
END;
$$;

-- Evidence is a trusted reconciliation reference, never a raw provider response.
-- The caller must first prove there is no outstanding authorization/collection.
CREATE FUNCTION public.release_trial_enrollment(p_enrollment_id uuid, p_neutralization_evidence text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE enrollment public.trial_enrollments%ROWTYPE;
BEGIN
  IF p_neutralization_evidence IS NULL OR length(btrim(p_neutralization_evidence)) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Provider reconciliation evidence required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO enrollment FROM public.trial_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF FOUND AND enrollment.admission_status = 'released' AND NOT enrollment.neutralization_required THEN
    -- A lost expiry/cancellation response replays the same confirmed release;
    -- unrelated evidence cannot reset consumed identity history.
    RETURN enrollment.neutralization_evidence = p_neutralization_evidence;
  END IF;
  IF NOT FOUND OR (enrollment.admission_status NOT IN ('reserved', 'blocked')
    AND NOT (enrollment.admission_status = 'released' AND enrollment.neutralization_required))
  THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.trial_identity_claims WHERE enrollment_id = p_enrollment_id AND consumed_at IS NOT NULL)
  THEN RETURN false; END IF;
  DELETE FROM public.trial_identity_claims WHERE enrollment_id = p_enrollment_id AND consumed_at IS NULL;
  UPDATE public.trial_enrollments SET admission_status = 'released', neutralization_required = false,
    neutralization_evidence = p_neutralization_evidence WHERE id = p_enrollment_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_trial_enrollment_terms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_trial_subscription_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admit_trial_enrollment(uuid, jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_trial_enrollment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_trial_enrollment_terms() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_trial_subscription_link() TO service_role;
GRANT EXECUTE ON FUNCTION public.admit_trial_enrollment(uuid, jsonb, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_trial_enrollment(uuid, text) TO service_role;

COMMENT ON TABLE public.trial_identity_claims IS
  'Private versioned identity HMAC claims. Privacy validation precedes every real writer; no automatic eligibility reset. Consumed claims survive account deletion subject to lawful rights handling.';
COMMENT ON TABLE public.trial_enrollments IS
  'Explicit trial_v1 enrollment facts; authorization is not revenue. Existing billing rows remain unlinked and retain legacy behavior.';
