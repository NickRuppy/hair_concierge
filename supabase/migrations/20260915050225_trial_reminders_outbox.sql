-- Optional pre-charge reminders are deliberately separate from immutable
-- contractual notices. This table carries no recipient email, raw provider
-- identifiers, or provider payloads. The renderer receives the already
-- validated required-notice contract shape.
CREATE TABLE private.trial_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reminder_version text NOT NULL DEFAULT 'trial_ending_v1' CHECK (reminder_version = 'trial_ending_v1'),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','queued','support_required','superseded')),
  attempt_id uuid,
  lease_expires_at timestamptz,
  dispatch_started_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_delivery_id text,
  provider_queued_at timestamptz,
  subject text,
  receipt_text text,
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(enrollment_id, reminder_version),
  CHECK ((status = 'sending') = (attempt_id IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (status <> 'queued' OR (provider_delivery_id IS NOT NULL AND provider_queued_at IS NOT NULL)),
  CHECK (dispatch_started_at IS NULL OR status IN ('sending','queued','support_required'))
);
ALTER TABLE private.trial_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_reminders FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.trial_reminders TO service_role;
CREATE INDEX trial_reminders_pending_idx ON private.trial_reminders(created_at,id) WHERE status='pending';
CREATE INDEX trial_reminders_enrollment_idx ON private.trial_reminders(enrollment_id);
CREATE INDEX trial_reminders_user_idx ON private.trial_reminders(user_id);

CREATE FUNCTION private.protect_trial_reminder() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id
    OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL)
    OR NEW.reminder_version IS DISTINCT FROM OLD.reminder_version
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.subject IS NOT NULL AND NEW.subject IS DISTINCT FROM OLD.subject)
    OR (OLD.receipt_text IS NOT NULL AND NEW.receipt_text IS DISTINCT FROM OLD.receipt_text)
  THEN RAISE EXCEPTION 'Trial reminder snapshot is immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_trial_reminder BEFORE UPDATE ON private.trial_reminders
  FOR EACH ROW EXECUTE FUNCTION private.protect_trial_reminder();

-- This excludes current ambiguity and cancellation state. It intentionally
-- does not decide recipient email: the dispatcher resolves confirmed account
-- ownership immediately before Customer.io delivery.
CREATE FUNCTION private.trial_reminder_is_current(e public.trial_enrollments, p_snapshot jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(
    e.admission_status='active'
    AND e.user_id IS NOT NULL
    AND e.provider IN ('stripe','paypal')
    AND e.provider_agreement_id IS NOT NULL
    AND e.authorization_succeeded_at IS NOT NULL
    AND e.original_trial_end_at IS NOT NULL
    AND e.original_trial_end_at > clock_timestamp()
    AND e.first_payment_succeeded_at IS NULL
    AND NOT e.cancel_at_period_end
    AND NOT e.access_revoked
    AND NOT e.neutralization_required
    AND p_snapshot IS NOT NULL
    AND p_snapshot->>'version'='trial_required_notices_v1'
    AND p_snapshot->>'contractId'=e.id::text
    AND p_snapshot->>'provider'=e.provider
    AND (p_snapshot->>'trialEndAt')::timestamptz=e.original_trial_end_at,
  false);
$$;

-- These transitions may resolve without ending the trial. Keep the reminder
-- pending until they settle rather than permanently discarding it.
CREATE FUNCTION private.trial_reminder_is_held(e public.trial_enrollments)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM private.trial_management_operations m WHERE m.enrollment_id=e.id AND m.status='pending')
    OR EXISTS(
      SELECT 1 FROM private.trial_cancellation_declarations d
      JOIN private.trial_cancellation_provider_operations c ON c.declaration_id=d.id
      WHERE d.enrollment_id=e.id AND c.status<>'confirmed'
    )
    OR EXISTS(SELECT 1 FROM private.trial_payment_continuation_reconciliations p WHERE p.enrollment_id=e.id AND p.status<>'resolved');
$$;

CREATE FUNCTION private.trial_reminder_is_dispatchable(e public.trial_enrollments,p_user_id uuid,p_snapshot jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT e.user_id IS NOT DISTINCT FROM p_user_id
    AND private.trial_reminder_is_current(e,p_snapshot)
    AND NOT private.trial_reminder_is_held(e);
$$;

-- The passed cutoff is an application-validated rollout boundary. No stored
-- default means a missing/invalid env configuration cannot silently backfill.
CREATE FUNCTION public.enqueue_due_trial_reminders(p_rollout_at timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE inserted integer;
BEGIN
  IF p_rollout_at IS NULL OR NOT isfinite(p_rollout_at) THEN
    RAISE EXCEPTION 'Invalid trial reminder rollout cutoff' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.trial_reminders(enrollment_id,user_id,snapshot)
  SELECT e.id,e.user_id,s.snapshot
  FROM public.trial_enrollments e
  CROSS JOIN LATERAL (SELECT private.trial_notice_snapshot(e) AS snapshot) s
  WHERE e.authorization_succeeded_at >= p_rollout_at
    AND e.original_trial_end_at - interval '48 hours' <= clock_timestamp()
    AND private.trial_reminder_is_dispatchable(e,e.user_id,s.snapshot)
  ON CONFLICT(enrollment_id,reminder_version) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN inserted;
END;
$$;

CREATE FUNCTION public.claim_trial_reminders(p_limit integer DEFAULT 1,p_lease_seconds integer DEFAULT 90)
RETURNS TABLE(reminder_id uuid,attempt_id uuid,user_id uuid,snapshot jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN
    RAISE EXCEPTION 'Invalid trial reminder claim' USING ERRCODE='22023';
  END IF;
  -- Ambiguous external delivery after a crash is support work, never a retry.
  UPDATE private.trial_reminders SET status='support_required',attempt_id=NULL,lease_expires_at=NULL,
    last_error_code='delivery_lease_expired'
    WHERE status='sending' AND lease_expires_at < clock_timestamp();
  UPDATE private.trial_reminders r SET status='superseded',last_error_code='trial_no_longer_eligible'
    WHERE r.status='pending' AND NOT EXISTS(
      SELECT 1 FROM public.trial_enrollments e
      WHERE e.id=r.enrollment_id AND e.user_id IS NOT DISTINCT FROM r.user_id
        AND private.trial_reminder_is_current(e,r.snapshot)
    );
  RETURN QUERY WITH due AS (
    SELECT r.id FROM private.trial_reminders r JOIN public.trial_enrollments e ON e.id=r.enrollment_id
      WHERE r.status='pending' AND private.trial_reminder_is_dispatchable(e,r.user_id,r.snapshot)
      ORDER BY r.created_at,r.id FOR UPDATE OF r SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE private.trial_reminders r SET status='sending',attempt_id=gen_random_uuid(),
      lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=r.attempts+1
    FROM due WHERE r.id=due.id
    RETURNING r.id,r.attempt_id,r.user_id,r.snapshot
  ) SELECT * FROM claimed;
END;
$$;

-- A second fence immediately before the provider call. It returns a send
-- capability once only; repeat callers, stale workers, cancelled contracts,
-- expiry and selected-terms changes cannot send from a stale claim.
CREATE FUNCTION public.prepare_trial_reminder_send(p_reminder_id uuid,p_attempt_id uuid)
RETURNS TABLE(reminder_id uuid,attempt_id uuid,user_id uuid,snapshot jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r private.trial_reminders%ROWTYPE; e public.trial_enrollments%ROWTYPE; current_snapshot jsonb;
BEGIN
  SELECT * INTO r FROM private.trial_reminders WHERE id=p_reminder_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'sending' OR r.attempt_id IS DISTINCT FROM p_attempt_id
    OR r.lease_expires_at <= clock_timestamp() OR r.dispatch_started_at IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO e FROM public.trial_enrollments WHERE id=r.enrollment_id FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE private.trial_reminders SET status='superseded',attempt_id=NULL,lease_expires_at=NULL,last_error_code='enrollment_unavailable' WHERE id=r.id;
    RETURN;
  END IF;
  IF e.user_id IS DISTINCT FROM r.user_id OR NOT private.trial_reminder_is_current(e,r.snapshot) THEN
    UPDATE private.trial_reminders SET status='superseded',attempt_id=NULL,lease_expires_at=NULL,last_error_code='trial_no_longer_eligible' WHERE id=r.id;
    RETURN;
  END IF;
  IF private.trial_reminder_is_held(e) THEN
    UPDATE private.trial_reminders SET status='pending',attempt_id=NULL,lease_expires_at=NULL,last_error_code=NULL WHERE id=r.id;
    RETURN;
  END IF;
  current_snapshot:=private.trial_notice_snapshot(e);
  IF current_snapshot IS DISTINCT FROM r.snapshot THEN
    UPDATE private.trial_reminders SET status='support_required',attempt_id=NULL,lease_expires_at=NULL,last_error_code='terms_changed_before_dispatch' WHERE id=r.id;
    RETURN;
  END IF;
  UPDATE private.trial_reminders SET dispatch_started_at=clock_timestamp() WHERE id=r.id;
  RETURN QUERY SELECT r.id,r.attempt_id,r.user_id,r.snapshot;
END;
$$;

CREATE FUNCTION public.complete_trial_reminder(p_reminder_id uuid,p_attempt_id uuid,p_outcome text,
  p_error_code text,p_provider_delivery_id text,p_provider_queued_at timestamptz,p_subject text,p_receipt_text text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('queued','support_required')
    OR (coalesce(p_error_code,'')<>'' AND p_error_code !~ '^[a-z0-9_]{1,80}$')
    OR (p_outcome='queued' AND (coalesce(length(p_provider_delivery_id),0)=0 OR p_provider_queued_at IS NULL
      OR NOT isfinite(p_provider_queued_at) OR coalesce(length(p_subject),0)=0 OR coalesce(length(p_receipt_text),0)=0))
  THEN RAISE EXCEPTION 'Invalid trial reminder completion' USING ERRCODE='22023'; END IF;
  UPDATE private.trial_reminders SET status=p_outcome,attempt_id=NULL,lease_expires_at=NULL,
    last_error_code=NULLIF(p_error_code,''),provider_delivery_id=NULLIF(p_provider_delivery_id,''),
    provider_queued_at=p_provider_queued_at,subject=NULLIF(p_subject,''),receipt_text=NULLIF(p_receipt_text,'')
  WHERE id=p_reminder_id AND attempt_id=p_attempt_id AND status='sending'
    AND lease_expires_at>clock_timestamp()
    AND (dispatch_started_at IS NOT NULL OR p_outcome='support_required');
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_trial_reminder(),private.trial_reminder_is_current(public.trial_enrollments,jsonb),
  private.trial_reminder_is_held(public.trial_enrollments),private.trial_reminder_is_dispatchable(public.trial_enrollments,uuid,jsonb),
  public.enqueue_due_trial_reminders(timestamptz),public.claim_trial_reminders(integer,integer),
  public.prepare_trial_reminder_send(uuid,uuid),public.complete_trial_reminder(uuid,uuid,text,text,text,timestamptz,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.protect_trial_reminder(),private.trial_reminder_is_current(public.trial_enrollments,jsonb),
  private.trial_reminder_is_held(public.trial_enrollments),private.trial_reminder_is_dispatchable(public.trial_enrollments,uuid,jsonb),
  public.enqueue_due_trial_reminders(timestamptz),public.claim_trial_reminders(integer,integer),
  public.prepare_trial_reminder_send(uuid,uuid),public.complete_trial_reminder(uuid,uuid,text,text,text,timestamptz,text,text)
  TO service_role;
