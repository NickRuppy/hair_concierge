-- Durable customer declarations are intentionally independent of provider mutation
-- and receipt delivery. They store no raw recipient email or provider response.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.trial_cancellation_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(submitted_at)),
  effective_end_at timestamptz NOT NULL CHECK (isfinite(effective_end_at)),
  UNIQUE (user_id, request_id)
);
CREATE INDEX trial_cancellation_declarations_enrollment_idx
  ON private.trial_cancellation_declarations(enrollment_id);

CREATE FUNCTION private.protect_trial_cancellation_declaration()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Trial cancellation declaration is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trial_cancellation_declaration_immutable
BEFORE UPDATE ON private.trial_cancellation_declarations
FOR EACH ROW EXECUTE FUNCTION private.protect_trial_cancellation_declaration();
REVOKE ALL ON FUNCTION private.protect_trial_cancellation_declaration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.protect_trial_cancellation_declaration() TO service_role;

CREATE TABLE private.trial_cancellation_receipts (
  declaration_id uuid PRIMARY KEY REFERENCES private.trial_cancellation_declarations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'error')),
  delivery_attempt_id uuid,
  sent_at timestamptz,
  failed_at timestamptz,
  CHECK ((delivery_status = 'sent') = (sent_at IS NOT NULL)),
  CHECK ((delivery_status = 'error') = (failed_at IS NOT NULL))
);

CREATE TABLE private.trial_cancellation_provider_operations (
  declaration_id uuid PRIMARY KEY REFERENCES private.trial_cancellation_declarations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'error')),
  reconciled_at timestamptz,
  error_code text CHECK (error_code IS NULL OR length(error_code) BETWEEN 1 AND 120),
  CHECK ((status = 'confirmed') = (reconciled_at IS NOT NULL))
);

ALTER TABLE private.trial_cancellation_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_cancellation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.trial_cancellation_provider_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_cancellation_declarations, private.trial_cancellation_receipts,
  private.trial_cancellation_provider_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.trial_cancellation_declarations, private.trial_cancellation_receipts,
  private.trial_cancellation_provider_operations TO service_role;

CREATE FUNCTION public.submit_trial_cancellation_declaration(
  p_request_id uuid,
  p_authenticated_user_id uuid,
  p_enrollment_id uuid
) RETURNS TABLE (
  declaration_id uuid,
  submitted_at timestamptz,
  effective_end_at timestamptz
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  existing private.trial_cancellation_declarations%ROWTYPE;
BEGIN
  -- A lost response must replay its already-accepted declaration even if a
  -- later provider event changed current enrollment eligibility. The request
  -- remains bound to this authenticated owner and exact enrollment.
  SELECT * INTO existing FROM private.trial_cancellation_declarations
    WHERE user_id = p_authenticated_user_id AND request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF existing.enrollment_id <> p_enrollment_id THEN
      RAISE EXCEPTION 'Cancellation request does not match its original declaration' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT existing.id, existing.submitted_at, existing.effective_end_at;
    RETURN;
  END IF;

  SELECT * INTO enrollment
    FROM public.trial_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND
    OR enrollment.user_id IS DISTINCT FROM p_authenticated_user_id
    OR enrollment.admission_status <> 'active'
    OR enrollment.access_revoked
    OR enrollment.authorization_succeeded_at IS NULL
    OR enrollment.original_trial_end_at IS NULL
    OR enrollment.first_payment_succeeded_at IS NOT NULL
    OR enrollment.original_trial_end_at <= clock_timestamp()
  THEN
    RAISE EXCEPTION 'Trial cancellation declaration is not available' USING ERRCODE = '22023';
  END IF;

  -- This is an app-side collection guard, not provider confirmation. The immutable
  -- trial deadline remains the sole effective end and access remains unrevised.
  UPDATE public.trial_enrollments SET cancel_at_period_end = true
    WHERE id = enrollment.id;

  INSERT INTO private.trial_cancellation_declarations(
    enrollment_id, user_id, request_id, effective_end_at
  ) VALUES (
    enrollment.id, p_authenticated_user_id, p_request_id, enrollment.original_trial_end_at
  ) RETURNING * INTO existing;

  INSERT INTO private.trial_cancellation_receipts(declaration_id, user_id)
    VALUES (existing.id, p_authenticated_user_id);
  INSERT INTO private.trial_cancellation_provider_operations(declaration_id)
    VALUES (existing.id);

  RETURN QUERY SELECT existing.id, existing.submitted_at, existing.effective_end_at;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_trial_cancellation_declaration(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_trial_cancellation_declaration(uuid, uuid, uuid)
  TO service_role;
