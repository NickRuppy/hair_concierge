-- Notice-only integration after the independent management foundation. Existing
-- queued confirmations remain frozen; future notices use the committed revision.
ALTER TABLE private.trial_required_notices DROP CONSTRAINT trial_required_notices_kind_check;
ALTER TABLE private.trial_required_notices ADD CONSTRAINT trial_required_notices_kind_check
  CHECK(kind IN ('contract_confirmation','contract_change','cancellation_receipt','payment_receipt','annual_renewal'));
CREATE OR REPLACE FUNCTION private.trial_notice_snapshot(e public.trial_enrollments) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE effective jsonb; offer jsonb;
BEGIN
  effective:=public.read_trial_effective_contract(e.id);
  IF effective IS NULL THEN RAISE EXCEPTION 'Required notice contract unavailable'; END IF;
  offer:=effective->'accepted_offer';
  RETURN jsonb_build_object('version','trial_required_notices_v1','contractId',e.id,
    'provider',effective->>'provider','termsVersion',offer->>'offerVersion','revision',effective->'revision',
    'interval',offer->>'interval','currency',offer->>'currency',
    'firstAmountMinor',offer->'firstAmountMinor','renewalAmountMinor',offer->'renewalAmountMinor',
    'cancelAtPeriodEnd',e.cancel_at_period_end,'authorizedAt',e.authorization_succeeded_at,'trialEndAt',e.original_trial_end_at,'taxBehavior',offer->>'taxBehavior');
END;
$$;
CREATE FUNCTION private.enqueue_trial_contract_change_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM public.trial_enrollments WHERE id=NEW.enrollment_id;
  INSERT INTO private.trial_required_notices(enrollment_id,user_id,event_key,kind,snapshot)
    VALUES(e.id,NEW.user_id,'change:'||NEW.id,'contract_change',private.trial_notice_snapshot(e)||
      jsonb_build_object('operationId',NEW.id,'changeKind',NEW.kind,'committedAt',NEW.completed_at))
    ON CONFLICT(event_key) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enqueue_trial_contract_change_notice AFTER UPDATE OF status ON private.trial_management_operations
  FOR EACH ROW WHEN (NEW.status='committed' AND OLD.status IS DISTINCT FROM 'committed')
  EXECUTE FUNCTION private.enqueue_trial_contract_change_notice();
REVOKE ALL ON FUNCTION private.enqueue_trial_contract_change_notice() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.enqueue_trial_contract_change_notice() TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_due_trial_annual_notices(p_now timestamptz DEFAULT clock_timestamp()) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE count_inserted integer;
BEGIN
  IF p_now IS NULL OR NOT isfinite(p_now) THEN RAISE EXCEPTION 'Invalid notice clock'; END IF;
  INSERT INTO private.trial_required_notices(enrollment_id,user_id,event_key,kind,snapshot,status,last_error_code)
    SELECT e.id,e.user_id,'annual:'||e.id||':'||extract(epoch FROM e.paid_through_at)::text,'annual_renewal',
      private.trial_notice_snapshot(e)||jsonb_build_object('renewalAt',e.paid_through_at,'amountMinor',private.trial_notice_snapshot(e)->'renewalAmountMinor'),
      CASE WHEN e.paid_through_at<p_now+interval '7 days' THEN 'support_required'
        WHEN EXISTS(SELECT 1 FROM private.trial_payment_continuation_reconciliations c WHERE c.enrollment_id=e.id AND c.status<>'resolved') THEN 'support_required'
        ELSE 'pending' END,
      CASE WHEN e.paid_through_at<p_now+interval '7 days' THEN 'annual_notice_window_missed'
        WHEN EXISTS(SELECT 1 FROM private.trial_payment_continuation_reconciliations c WHERE c.enrollment_id=e.id AND c.status<>'resolved') THEN 'annual_provider_date_unconfirmed'
        ELSE NULL END
    FROM public.trial_enrollments e
    WHERE e.admission_status='active' AND e.user_id IS NOT NULL AND NOT e.cancel_at_period_end AND NOT e.access_revoked
      AND e.first_payment_succeeded_at IS NOT NULL AND private.trial_notice_snapshot(e)->>'interval'='year'
      AND e.paid_through_at<=p_now+interval '30 days'
    ON CONFLICT(event_key) DO NOTHING;
  GET DIAGNOSTICS count_inserted=ROW_COUNT;
  RETURN count_inserted;
END;
$$;
