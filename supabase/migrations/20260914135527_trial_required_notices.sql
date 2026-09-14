-- Required transactional notices only; no campaign or pre-trial reminder.
-- No recipient email, raw payment identity, or provider payload in this outbox.
CREATE TABLE private.trial_required_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.trial_enrollments(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  declaration_id uuid REFERENCES private.trial_cancellation_declarations(id) ON DELETE SET NULL,
  event_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('contract_confirmation','cancellation_receipt','payment_receipt','annual_renewal')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','queued','delivered','support_required','superseded')),
  attempt_id uuid,
  lease_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  provider_delivery_id text,
  provider_queued_at timestamptz,
  delivered_at timestamptz,
  subject text,
  receipt_text text,
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status = 'sending') = (attempt_id IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (status NOT IN ('queued','delivered') OR (provider_delivery_id IS NOT NULL AND provider_queued_at IS NOT NULL)),
  CHECK ((status = 'delivered') = (delivered_at IS NOT NULL))
);
ALTER TABLE private.trial_required_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_required_notices FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.trial_required_notices TO service_role;
CREATE INDEX trial_required_notices_pending_idx ON private.trial_required_notices(created_at,id) WHERE status='pending';
CREATE INDEX trial_required_notices_enrollment_idx ON private.trial_required_notices(enrollment_id);
CREATE INDEX trial_required_notices_user_idx ON private.trial_required_notices(user_id);
CREATE INDEX trial_required_notices_declaration_idx ON private.trial_required_notices(declaration_id);

CREATE FUNCTION private.protect_trial_required_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.event_key IS DISTINCT FROM OLD.event_key
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.subject IS NOT NULL AND NEW.subject IS DISTINCT FROM OLD.subject)
    OR (OLD.receipt_text IS NOT NULL AND NEW.receipt_text IS DISTINCT FROM OLD.receipt_text)
  THEN RAISE EXCEPTION 'Required notice snapshot is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_trial_required_notice BEFORE UPDATE ON private.trial_required_notices
  FOR EACH ROW EXECUTE FUNCTION private.protect_trial_required_notice();

-- Deliberately versioned: future terms require a new renderer, never rewrite v1.
CREATE FUNCTION private.trial_notice_snapshot(e public.trial_enrollments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('version','trial_required_notices_v1','contractId',e.id,
    'provider',e.provider,'termsVersion',e.accepted_offer->>'offerVersion',
    'interval',e.accepted_offer->>'interval','currency',e.accepted_offer->>'currency',
    'firstAmountMinor',e.accepted_offer->'firstAmountMinor','renewalAmountMinor',e.accepted_offer->'renewalAmountMinor',
    'authorizedAt',e.authorization_succeeded_at,'trialEndAt',e.original_trial_end_at,
    'taxBehavior',e.accepted_offer->>'taxBehavior');
$$;
CREATE FUNCTION private.enqueue_trial_contract_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.admission_status='active' AND NEW.authorization_succeeded_at IS NOT NULL THEN
    INSERT INTO private.trial_required_notices(enrollment_id,user_id,event_key,kind,snapshot)
      VALUES(NEW.id,NEW.user_id,'contract:'||NEW.id,'contract_confirmation',private.trial_notice_snapshot(NEW))
      ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enqueue_trial_contract_notice AFTER INSERT OR UPDATE ON public.trial_enrollments
  FOR EACH ROW EXECUTE FUNCTION private.enqueue_trial_contract_notice();

CREATE FUNCTION private.enqueue_trial_cancellation_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM public.trial_enrollments WHERE id=NEW.enrollment_id;
  INSERT INTO private.trial_required_notices(enrollment_id,user_id,declaration_id,event_key,kind,snapshot)
    VALUES(e.id,NEW.user_id,NEW.id,'cancellation:'||NEW.id,'cancellation_receipt',
      private.trial_notice_snapshot(e)||jsonb_build_object('declarationId',NEW.id,
        'submittedAt',NEW.submitted_at,'effectiveEndAt',NEW.effective_end_at))
    ON CONFLICT(event_key) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enqueue_trial_cancellation_notice AFTER INSERT ON private.trial_cancellation_declarations
  FOR EACH ROW EXECUTE FUNCTION private.enqueue_trial_cancellation_notice();

-- Observe the ledger after application, never entitlement timestamps or redirects.
-- Existing provider receipts may replace this only with event-specific delivery proof.
CREATE FUNCTION private.enqueue_trial_payment_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE;
BEGIN
  IF NEW.outcome='succeeded' AND NEW.result='applied' AND NEW.phase IN ('first_paid','renewal') AND NEW.amount_minor>0 THEN
    SELECT * INTO STRICT e FROM public.trial_enrollments WHERE id=NEW.enrollment_id;
    INSERT INTO private.trial_required_notices(enrollment_id,user_id,event_key,kind,snapshot)
      VALUES(e.id,e.user_id,'payment:'||NEW.id,'payment_receipt',private.trial_notice_snapshot(e)||
        jsonb_build_object('paymentEventId',NEW.id,'phase',NEW.phase,'occurredAt',NEW.occurred_at,
          'amountMinor',NEW.amount_minor,'currency',NEW.currency,'paidThroughAt',e.paid_through_at))
      ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enqueue_trial_payment_notice AFTER INSERT OR UPDATE ON private.trial_payment_events
  FOR EACH ROW EXECUTE FUNCTION private.enqueue_trial_payment_notice();

CREATE FUNCTION public.enqueue_due_trial_annual_notices(p_now timestamptz DEFAULT clock_timestamp()) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE count_inserted integer;
BEGIN
  IF p_now IS NULL OR NOT isfinite(p_now) THEN RAISE EXCEPTION 'Invalid notice clock'; END IF;
  INSERT INTO private.trial_required_notices(enrollment_id,user_id,event_key,kind,snapshot,status,last_error_code)
    SELECT e.id,e.user_id,'annual:'||e.id||':'||extract(epoch FROM e.paid_through_at)::text,'annual_renewal',
      private.trial_notice_snapshot(e)||jsonb_build_object('renewalAt',e.paid_through_at,'amountMinor',e.accepted_offer->'renewalAmountMinor'),
      CASE WHEN e.paid_through_at<p_now+interval '7 days' THEN 'support_required'
        WHEN EXISTS(SELECT 1 FROM private.trial_payment_continuation_reconciliations c WHERE c.enrollment_id=e.id AND c.status<>'resolved') THEN 'support_required'
        ELSE 'pending' END,
      CASE WHEN e.paid_through_at<p_now+interval '7 days' THEN 'annual_notice_window_missed'
        WHEN EXISTS(SELECT 1 FROM private.trial_payment_continuation_reconciliations c WHERE c.enrollment_id=e.id AND c.status<>'resolved') THEN 'annual_provider_date_unconfirmed'
        ELSE NULL END
    FROM public.trial_enrollments e
    WHERE e.admission_status='active' AND e.user_id IS NOT NULL AND NOT e.cancel_at_period_end AND NOT e.access_revoked
      AND e.first_payment_succeeded_at IS NOT NULL AND e.accepted_offer->>'interval'='year'
      AND e.paid_through_at<=p_now+interval '30 days'
    ON CONFLICT(event_key) DO NOTHING;
  GET DIAGNOSTICS count_inserted=ROW_COUNT;
  RETURN count_inserted;
END;
$$;

CREATE FUNCTION public.claim_trial_required_notices(p_limit integer,p_lease_seconds integer)
RETURNS TABLE(notice_id uuid,attempt_id uuid,user_id uuid,kind text,snapshot jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 300
    THEN RAISE EXCEPTION 'Invalid notice claim'; END IF;
  UPDATE private.trial_required_notices SET status='support_required',attempt_id=NULL,lease_expires_at=NULL,last_error_code='delivery_lease_expired'
    WHERE status='sending' AND lease_expires_at<clock_timestamp();
  UPDATE private.trial_required_notices n SET status='superseded'
    WHERE n.status='pending' AND n.kind='annual_renewal' AND NOT EXISTS(
      SELECT 1 FROM public.trial_enrollments e WHERE e.id=n.enrollment_id AND NOT e.cancel_at_period_end AND NOT e.access_revoked
        AND e.paid_through_at=(n.snapshot->>'renewalAt')::timestamptz);
  UPDATE private.trial_required_notices n SET status='support_required',last_error_code='annual_notice_window_missed'
    WHERE n.status='pending' AND n.kind='annual_renewal' AND (n.snapshot->>'renewalAt')::timestamptz<clock_timestamp()+interval '7 days';
  UPDATE private.trial_required_notices n SET status='support_required',last_error_code='recipient_owner_unavailable'
    WHERE n.status='pending' AND n.user_id IS NULL;
  RETURN QUERY WITH due AS (
    SELECT n.id FROM private.trial_required_notices n WHERE n.status='pending'
      ORDER BY n.created_at,n.id FOR UPDATE SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE private.trial_required_notices n SET status='sending',attempt_id=gen_random_uuid(),
      lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=n.attempts+1
      FROM due WHERE n.id=due.id RETURNING n.id,n.attempt_id,n.user_id,n.kind,n.snapshot
  ) SELECT * FROM claimed;
END;
$$;

CREATE FUNCTION public.complete_trial_required_notice(p_notice_id uuid,p_attempt_id uuid,p_outcome text,
  p_error_code text,p_provider_delivery_id text,p_provider_queued_at text,p_subject text,p_receipt_text text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('queued','support_required')
    OR (p_error_code<>'' AND p_error_code!~'^[a-z0-9_]{1,80}$')
    OR (p_outcome='queued' AND (coalesce(length(p_provider_delivery_id),0)=0 OR coalesce(length(p_provider_queued_at),0)=0
      OR coalesce(length(p_subject),0)=0 OR coalesce(length(p_receipt_text),0)=0))
    THEN RAISE EXCEPTION 'Invalid notice completion'; END IF;
  UPDATE private.trial_required_notices SET status=p_outcome,attempt_id=NULL,lease_expires_at=NULL,
    last_error_code=NULLIF(p_error_code,''),provider_delivery_id=NULLIF(p_provider_delivery_id,''),
    provider_queued_at=NULLIF(p_provider_queued_at,'')::timestamptz,
    subject=NULLIF(p_subject,''),receipt_text=NULLIF(p_receipt_text,'')
    WHERE id=p_notice_id AND attempt_id=p_attempt_id AND status='sending' AND lease_expires_at>clock_timestamp();
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END;
$$;

-- Only a verified provider delivery event or an operator's provider reconciliation
-- may call this. A queue ACK is not delivery and does not update the old receipt.
CREATE FUNCTION public.confirm_trial_required_notice_delivery(p_notice_id uuid,p_provider_delivery_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d uuid; affected integer;
BEGIN
  UPDATE private.trial_required_notices SET status='delivered',delivered_at=clock_timestamp()
    WHERE id=p_notice_id AND status='queued' AND provider_delivery_id=NULLIF(p_provider_delivery_id,'')
    RETURNING declaration_id INTO d;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected=1 AND d IS NOT NULL THEN
    UPDATE private.trial_cancellation_receipts SET delivery_status='sent',sent_at=clock_timestamp(),failed_at=NULL WHERE declaration_id=d;
  END IF;
  RETURN affected=1;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_trial_required_notice(),private.trial_notice_snapshot(public.trial_enrollments),
  private.enqueue_trial_contract_notice(),private.enqueue_trial_cancellation_notice(),private.enqueue_trial_payment_notice(),
  public.enqueue_due_trial_annual_notices(timestamptz),public.claim_trial_required_notices(integer,integer),
  public.complete_trial_required_notice(uuid,uuid,text,text,text,text,text,text),public.confirm_trial_required_notice_delivery(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.protect_trial_required_notice(),private.trial_notice_snapshot(public.trial_enrollments),
  private.enqueue_trial_contract_notice(),private.enqueue_trial_cancellation_notice(),private.enqueue_trial_payment_notice(),
  public.enqueue_due_trial_annual_notices(timestamptz),public.claim_trial_required_notices(integer,integer),
  public.complete_trial_required_notice(uuid,uuid,text,text,text,text,text,text),public.confirm_trial_required_notice_delivery(uuid,text)
  TO service_role;
