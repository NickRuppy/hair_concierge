CREATE TABLE private.paypal_trial_candidate_expiry (
 agreement_id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('initial','management','paid_recovery')),
 reference_id uuid NOT NULL, enrollment_id uuid NOT NULL, app_id text NOT NULL, plan_id text NOT NULL, custom_id text NOT NULL,
 created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, start_time timestamptz NOT NULL,
 lease_token uuid, leased_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','canceled','accepted')),
 last_result text, verified_at timestamptz
);
ALTER TABLE private.paypal_trial_candidate_expiry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.paypal_trial_candidate_expiry FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.paypal_trial_candidate_expiry TO service_role;
CREATE FUNCTION public.claim_paypal_trial_candidate_expiry(p_limit integer DEFAULT 5) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Invalid PayPal expiry batch'; END IF;
 INSERT INTO private.paypal_trial_candidate_expiry(agreement_id,kind,reference_id,enrollment_id,app_id,plan_id,custom_id,created_at,expires_at,start_time)
 SELECT a.provider_reference,'initial',a.id,a.enrollment_id,a.paypal_app_id,a.paypal_plan_id,i.token,i.created_at,i.expires_at,a.request_expires_at+interval '4 days'
 FROM private.paypal_trial_checkout_attempts a JOIN public.paypal_checkout_intents i ON i.id=a.intent_id
 JOIN public.trial_enrollments e ON e.id=a.enrollment_id
 WHERE a.provider_reference IS NOT NULL AND e.admission_status<>'active' AND (i.expires_at<=now() OR a.request_expires_at+interval '4 days'<=now()+interval '10 minutes')
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
CREATE FUNCTION public.complete_paypal_trial_candidate_expiry(p_agreement_id text,p_lease_token uuid,p_result text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r private.paypal_trial_candidate_expiry; owner_id uuid; released boolean;
BEGIN
 SELECT * INTO r FROM private.paypal_trial_candidate_expiry WHERE agreement_id=p_agreement_id AND lease_token=p_lease_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_result='canceled_no_payment' THEN
 IF r.kind='initial' THEN released:=public.release_trial_enrollment(r.enrollment_id,'paypal:expired:'||r.agreement_id);
 ELSIF r.kind='management' THEN SELECT user_id INTO owner_id FROM private.trial_management_operations WHERE id=r.reference_id; released:=public.abandon_trial_management_operation(r.reference_id,owner_id,'paypal:expired:'||r.agreement_id);
 ELSE SELECT user_id INTO owner_id FROM private.trial_paid_recovery_operations WHERE id=r.reference_id; released:=public.abandon_trial_paid_recovery_operation(r.reference_id,owner_id,'paypal:expired:'||r.agreement_id); END IF;
 IF NOT coalesce(released,false) THEN RETURN false; END IF;
 END IF;
 IF p_result NOT IN ('canceled_no_payment','accepted','reconciliation_required') THEN RETURN false; END IF;
 UPDATE private.paypal_trial_candidate_expiry SET status=CASE p_result WHEN 'canceled_no_payment' THEN 'canceled' WHEN 'accepted' THEN 'accepted' ELSE 'pending' END,
 last_result=p_result,verified_at=now(),next_attempt_at=now()+interval '5 minutes',leased_until=NULL,lease_token=NULL
 WHERE agreement_id=p_agreement_id AND lease_token=p_lease_token; RETURN FOUND;
END $$;
-- Recheck local admission/commit ownership after every provider retrieval, including racing webhook completion.
CREATE FUNCTION public.read_paypal_trial_candidate_expiry_state(p_agreement_id text,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r private.paypal_trial_candidate_expiry; e public.trial_enrollments; committed boolean; user_id uuid; invalidated boolean:=false;
BEGIN
 SELECT * INTO r FROM private.paypal_trial_candidate_expiry WHERE agreement_id=p_agreement_id AND lease_token=p_lease_token AND leased_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'PayPal expiry lease unavailable'; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=r.enrollment_id;
 IF r.kind='initial' THEN committed:=e.admission_status='active'; user_id:=e.user_id;
 ELSIF r.kind='management' THEN SELECT o.status='committed',o.user_id INTO committed,user_id FROM private.trial_management_operations o WHERE o.id=r.reference_id;
 ELSE SELECT o.status='committed',o.user_id INTO committed,user_id FROM private.trial_paid_recovery_operations o WHERE o.id=r.reference_id; END IF;
 IF r.kind='management' THEN SELECT s.cancellation_version<>o.cancellation_version INTO invalidated FROM private.trial_management_operations o JOIN private.trial_management_state s ON s.enrollment_id=o.enrollment_id WHERE o.id=r.reference_id;
 ELSIF r.kind='paid_recovery' THEN SELECT s.cancellation_version<>o.cancellation_version INTO invalidated FROM private.trial_paid_recovery_operations o JOIN private.trial_management_state s ON s.enrollment_id=o.enrollment_id WHERE o.id=r.reference_id; END IF;
 RETURN jsonb_build_object('committed',coalesce(committed,false),'userId',user_id,'invalidated',coalesce(invalidated,false));
END $$;
REVOKE ALL ON FUNCTION public.claim_paypal_trial_candidate_expiry(integer),public.complete_paypal_trial_candidate_expiry(text,uuid,text),public.read_paypal_trial_candidate_expiry_state(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paypal_trial_candidate_expiry(integer),public.complete_paypal_trial_candidate_expiry(text,uuid,text),public.read_paypal_trial_candidate_expiry_state(text,uuid) TO service_role;
