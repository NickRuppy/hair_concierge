-- PayPal trial candidate expiry keyed to the frozen trial start.
--
-- The PayPal subscription is created with start_time = frozen trial start
-- (SQL twin of frozenPayPalTrialStart): the next UTC midnight strictly after
-- checkout freeze + 8 days, where freeze = request_expires_at - 72 hours. The
-- initial-lane expiry candidate carries that same clock instead of the retired
-- provisional start (request_expires_at + 4 days).
CREATE FUNCTION private.paypal_trial_frozen_start(p_request_expires_at timestamptz) RETURNS timestamptz
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 -- Convert to a UTC wall clock BEFORE adding days: day arithmetic on timestamptz
 -- follows the session time zone (DST), which would move the midnight.
 SELECT (date_trunc('day', (p_request_expires_at AT TIME ZONE 'UTC') - interval '72 hours' + interval '8 days') + interval '1 day') AT TIME ZONE 'UTC'
$$;
REVOKE ALL ON FUNCTION private.paypal_trial_frozen_start(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.paypal_trial_frozen_start(timestamptz) TO service_role;

-- Body verbatim from the candidate-expiry migration except for the frozen start.
CREATE OR REPLACE FUNCTION public.claim_paypal_trial_candidate_expiry(p_limit integer DEFAULT 5) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Invalid PayPal expiry batch'; END IF;
 INSERT INTO private.paypal_trial_candidate_expiry(agreement_id,kind,reference_id,enrollment_id,app_id,plan_id,custom_id,created_at,expires_at,start_time)
 SELECT a.provider_reference,'initial',a.id,a.enrollment_id,a.paypal_app_id,a.paypal_plan_id,i.token,i.created_at,i.expires_at,private.paypal_trial_frozen_start(a.request_expires_at)
 FROM private.paypal_trial_checkout_attempts a JOIN public.paypal_checkout_intents i ON i.id=a.intent_id
 JOIN public.trial_enrollments e ON e.id=a.enrollment_id
 WHERE a.provider_reference IS NOT NULL AND e.admission_status<>'active' AND (i.expires_at<=now() OR private.paypal_trial_frozen_start(a.request_expires_at)<=now()+interval '10 minutes')
 ON CONFLICT DO NOTHING;
 INSERT INTO private.paypal_trial_candidate_expiry(agreement_id,kind,reference_id,enrollment_id,app_id,plan_id,custom_id,created_at,expires_at,start_time)
 SELECT r.target_agreement_id,'management',r.operation_id,r.enrollment_id,r.app_id,r.target_plan_id,'trial-management:'||r.operation_id::text,r.created_at,r.request_expires_at,o.original_trial_end_at
 FROM private.paypal_trial_management_requests r JOIN private.trial_management_operations o ON o.id=r.operation_id
 JOIN private.trial_management_state state ON state.enrollment_id=o.enrollment_id
 WHERE o.kind='restore' AND o.status='pending' AND r.target_agreement_id IS NOT NULL
 AND (r.request_expires_at<=now() OR o.original_trial_end_at<=now()+interval '10 minutes' OR state.cancellation_version<>o.cancellation_version) ON CONFLICT DO NOTHING;
 INSERT INTO private.paypal_trial_candidate_expiry(agreement_id,kind,reference_id,enrollment_id,app_id,plan_id,custom_id,created_at,expires_at,start_time)
 SELECT r.target_agreement_id,'paid_recovery',r.operation_id,r.enrollment_id,r.app_id,r.target_plan_id,'trial-paid-recovery:'||r.operation_id::text,r.created_at,r.request_expires_at,r.start_time
 FROM private.paypal_trial_paid_recovery_requests r JOIN private.trial_paid_recovery_operations o ON o.id=r.operation_id
 JOIN private.trial_management_state state ON state.enrollment_id=o.enrollment_id
 WHERE o.status='pending' AND r.target_agreement_id IS NOT NULL AND (r.request_expires_at<=now() OR r.start_time<=now()+interval '10 minutes' OR state.cancellation_version<>o.cancellation_version) ON CONFLICT DO NOTHING;
 RETURN QUERY WITH due AS (SELECT agreement_id FROM private.paypal_trial_candidate_expiry WHERE status='pending' AND next_attempt_at<=now() AND (leased_until IS NULL OR leased_until<=now()) ORDER BY next_attempt_at,start_time,expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
 UPDATE private.paypal_trial_candidate_expiry r SET lease_token=gen_random_uuid(),leased_until=now()+interval '120 seconds'
 FROM due WHERE r.agreement_id=due.agreement_id RETURNING to_jsonb(r);
END $$;

-- Read-only operator report: how long PayPal customers take from tapping
-- "Mit PayPal" (checkout freeze) to approving the agreement. Decides whether the
-- 24-hour approval window can be shortened later. Aggregates only; no payer data.
CREATE FUNCTION public.report_paypal_trial_approval_latency(p_since timestamptz DEFAULT clock_timestamp() - interval '90 days') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH frozen AS (
   SELECT a.request_expires_at - interval '72 hours' AS frozen_at, a.authorization_succeeded_at
   FROM private.paypal_trial_checkout_attempts a
   WHERE a.request_expires_at IS NOT NULL AND a.request_expires_at - interval '72 hours' >= p_since
 ), approved AS (
   SELECT extract(epoch FROM (authorization_succeeded_at - frozen_at)) / 60 AS minutes FROM frozen WHERE authorization_succeeded_at IS NOT NULL
 )
 SELECT jsonb_build_object(
   'since', p_since,
   'frozen', (SELECT count(*) FROM frozen),
   'approved', (SELECT count(*) FROM approved),
   'p50Minutes', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes))::numeric, 1) FROM approved),
   'p90Minutes', (SELECT round((percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes))::numeric, 1) FROM approved),
   'maxMinutes', (SELECT round(max(minutes)::numeric, 1) FROM approved),
   'approvedAfter3h', (SELECT count(*) FROM approved WHERE minutes > 180),
   'approvedAfter6h', (SELECT count(*) FROM approved WHERE minutes > 360)
 )
$$;
REVOKE ALL ON FUNCTION public.report_paypal_trial_approval_latency(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_paypal_trial_approval_latency(timestamptz) TO service_role;
