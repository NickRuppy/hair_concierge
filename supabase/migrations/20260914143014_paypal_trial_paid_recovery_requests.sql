CREATE TABLE private.paypal_trial_paid_recovery_requests (
 operation_id uuid PRIMARY KEY, enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL, app_id text NOT NULL, product_id text NOT NULL, source_plan_id text NOT NULL, target_plan_id text NOT NULL,
 request_id text NOT NULL UNIQUE, request_expires_at timestamptz NOT NULL, start_time timestamptz NOT NULL,
 return_url text NOT NULL, cancel_url text NOT NULL, request_sent_at timestamptz, source_neutralization_requested_at timestamptz,
 target_agreement_id text UNIQUE, approval_url text, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.paypal_trial_paid_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.paypal_trial_paid_recovery_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.paypal_trial_paid_recovery_requests TO service_role;
CREATE FUNCTION public.get_paypal_trial_paid_recovery_request(p_operation_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; r private.paypal_trial_paid_recovery_requests;
BEGIN
 o:=public.load_trial_paid_recovery_operation(p_operation_id,p_user_id);
 IF o->>'provider'<>'paypal' THEN RAISE EXCEPTION 'PayPal recovery provider mismatch'; END IF;
 SELECT * INTO r FROM private.paypal_trial_paid_recovery_requests WHERE operation_id=p_operation_id AND user_id=p_user_id;
 RETURN CASE WHEN FOUND THEN to_jsonb(r) ELSE 'null'::jsonb END;
END $$;
CREATE FUNCTION public.freeze_paypal_trial_paid_recovery_request(p_operation_id uuid,p_user_id uuid,p_source_plan_id text,p_target_plan_id text,p_return_url text,p_cancel_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; a private.paypal_trial_checkout_attempts; r private.paypal_trial_paid_recovery_requests; t timestamptz:=date_trunc('second',clock_timestamp()); s timestamptz;
BEGIN
 o:=public.load_trial_paid_recovery_operation(p_operation_id,p_user_id);
 IF o->>'provider'<>'paypal' OR o->>'status'<>'pending' OR NOT public.guard_trial_paid_recovery_operation(p_operation_id,p_user_id)
 OR p_source_plan_id IS NULL OR p_source_plan_id !~ '^\S{1,255}$' OR p_target_plan_id IS NULL OR p_target_plan_id !~ '^\S{1,255}$'
 OR p_return_url IS NULL OR length(p_return_url) NOT BETWEEN 1 AND 2000 OR p_cancel_url IS NULL OR length(p_cancel_url) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'PayPal recovery unavailable'; END IF;
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE enrollment_id=(o->>'enrollmentId')::uuid;
 IF NOT FOUND OR a.provider_reference IS DISTINCT FROM o->>'originalAgreementId' OR a.paypal_app_id IS NULL OR a.paypal_product_id IS NULL
 THEN RAISE EXCEPTION 'PayPal original recovery authority unavailable'; END IF;
 s:=CASE WHEN o->>'kind'='repair_paid' THEN (o->>'paidThroughAt')::timestamptz
 ELSE ((t AT TIME ZONE 'UTC') + CASE WHEN o->'offer'->>'interval'='month' THEN interval '1 month' ELSE interval '1 year' END) AT TIME ZONE 'UTC' END;
 IF s<=t THEN RAISE EXCEPTION 'PayPal recovery boundary elapsed'; END IF;
 INSERT INTO private.paypal_trial_paid_recovery_requests(operation_id,enrollment_id,user_id,app_id,product_id,source_plan_id,target_plan_id,request_id,request_expires_at,start_time,return_url,cancel_url)
 VALUES(p_operation_id,a.enrollment_id,p_user_id,a.paypal_app_id,a.paypal_product_id,p_source_plan_id,p_target_plan_id,'paypal-paid-recovery:'||p_operation_id::text,t+interval '72 hours',s,p_return_url,p_cancel_url)
 ON CONFLICT(operation_id) DO NOTHING;
 SELECT * INTO r FROM private.paypal_trial_paid_recovery_requests WHERE operation_id=p_operation_id;
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.claim_paypal_trial_paid_recovery_request(p_operation_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.guard_trial_paid_recovery_operation(p_operation_id,p_user_id) THEN RETURN false; END IF;
 UPDATE private.paypal_trial_paid_recovery_requests SET request_sent_at=clock_timestamp()
 WHERE operation_id=p_operation_id AND user_id=p_user_id AND request_sent_at IS NULL AND request_expires_at>clock_timestamp() AND start_time>clock_timestamp();
 RETURN FOUND;
END $$;
CREATE FUNCTION public.bind_paypal_trial_paid_recovery_response(p_operation_id uuid,p_user_id uuid,p_target_agreement_id text,p_approval_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; r private.paypal_trial_paid_recovery_requests;
BEGIN
 o:=public.load_trial_paid_recovery_operation(p_operation_id,p_user_id);
 SELECT * INTO r FROM private.paypal_trial_paid_recovery_requests WHERE operation_id=p_operation_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR o->>'provider'<>'paypal' OR r.request_sent_at IS NULL OR p_target_agreement_id IS NULL OR p_target_agreement_id !~ '^\S{1,255}$'
 OR p_target_agreement_id=o->>'sourceAgreementId' OR (r.target_agreement_id IS NOT NULL AND r.target_agreement_id<>p_target_agreement_id)
 THEN RAISE EXCEPTION 'PayPal recovery response mismatch'; END IF;
 UPDATE private.paypal_trial_paid_recovery_requests SET target_agreement_id=p_target_agreement_id,approval_url=coalesce(approval_url,p_approval_url)
 WHERE operation_id=p_operation_id RETURNING * INTO r; RETURN to_jsonb(r);
END $$;
-- Every retrieved source transaction must be terminal and every successful collection already recognized by the same enrollment ledger.
CREATE FUNCTION public.verify_paypal_trial_paid_recovery_source_transactions(p_operation_id uuid,p_user_id uuid,p_transactions jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; t jsonb;
BEGIN
 o:=public.load_trial_paid_recovery_operation(p_operation_id,p_user_id);
 IF o->>'provider'<>'paypal' OR jsonb_typeof(p_transactions)<>'array' THEN RETURN false; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(p_transactions) LOOP
  IF t->>'status' IN ('FAILED','DENIED','DECLINED') THEN CONTINUE; END IF;
  IF t->>'status' IS DISTINCT FROM 'COMPLETED' OR NOT EXISTS (
   SELECT 1 FROM private.trial_payment_events e WHERE e.enrollment_id=(o->>'enrollmentId')::uuid AND e.provider='paypal'
   AND e.source_object_id=t->>'id' AND e.outcome='succeeded' AND e.result IN ('applied','duplicate')
   AND e.occurred_at=(t->>'time')::timestamptz AND e.currency=t->'amount_with_breakdown'->'gross_amount'->>'currency_code'
   AND e.amount_minor=((t->'amount_with_breakdown'->'gross_amount'->>'value')::numeric*100)
  ) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE FUNCTION public.find_paypal_trial_paid_recovery_callback(p_agreement_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r private.paypal_trial_paid_recovery_requests; o jsonb;
BEGIN
 SELECT * INTO r FROM private.paypal_trial_paid_recovery_requests WHERE target_agreement_id=p_agreement_id;
 IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
 o:=public.load_trial_paid_recovery_operation(r.operation_id,r.user_id);
 RETURN jsonb_build_object('operationId',r.operation_id,'authenticatedUserId',r.user_id,'status',o->>'status','targetPlanId',r.target_plan_id,'productId',r.product_id,'kind',o->>'kind','payment',(SELECT x.payment FROM private.trial_paid_recovery_operations x WHERE x.id=r.operation_id));
END $$;
CREATE FUNCTION private.prevent_paypal_trial_paid_recovery_request_rewrite() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['request_sent_at','target_agreement_id','approval_url','source_neutralization_requested_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['request_sent_at','target_agreement_id','approval_url','source_neutralization_requested_at'])
 OR (OLD.source_neutralization_requested_at IS NOT NULL AND NEW.source_neutralization_requested_at IS DISTINCT FROM OLD.source_neutralization_requested_at)
 OR (OLD.request_sent_at IS NOT NULL AND NEW.request_sent_at IS DISTINCT FROM OLD.request_sent_at)
 OR (OLD.target_agreement_id IS NOT NULL AND NEW.target_agreement_id IS DISTINCT FROM OLD.target_agreement_id)
 OR (OLD.approval_url IS NOT NULL AND NEW.approval_url IS DISTINCT FROM OLD.approval_url)
 THEN RAISE EXCEPTION 'PayPal paid recovery request immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER paypal_trial_paid_recovery_request_immutable BEFORE UPDATE ON private.paypal_trial_paid_recovery_requests FOR EACH ROW EXECUTE FUNCTION private.prevent_paypal_trial_paid_recovery_request_rewrite();
REVOKE ALL ON FUNCTION public.get_paypal_trial_paid_recovery_request(uuid,uuid),public.freeze_paypal_trial_paid_recovery_request(uuid,uuid,text,text,text,text),public.claim_paypal_trial_paid_recovery_request(uuid,uuid),public.bind_paypal_trial_paid_recovery_response(uuid,uuid,text,text),public.verify_paypal_trial_paid_recovery_source_transactions(uuid,uuid,jsonb),public.find_paypal_trial_paid_recovery_callback(text),private.prevent_paypal_trial_paid_recovery_request_rewrite() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paypal_trial_paid_recovery_request(uuid,uuid),public.freeze_paypal_trial_paid_recovery_request(uuid,uuid,text,text,text,text),public.claim_paypal_trial_paid_recovery_request(uuid,uuid),public.bind_paypal_trial_paid_recovery_response(uuid,uuid,text,text),public.verify_paypal_trial_paid_recovery_source_transactions(uuid,uuid,jsonb),public.find_paypal_trial_paid_recovery_callback(text) TO service_role;
CREATE OR REPLACE FUNCTION public.find_paypal_trial_checkout_intent_for_agreement(p_agreement_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(i) FROM private.paypal_trial_checkout_attempts a JOIN public.paypal_checkout_intents i ON i.id=a.intent_id
 WHERE a.provider_reference=p_agreement_id OR EXISTS(SELECT 1 FROM private.trial_offer_revisions r WHERE r.enrollment_id=a.enrollment_id AND r.provider='paypal' AND r.provider_agreement_id=p_agreement_id)
 OR EXISTS(SELECT 1 FROM private.paypal_trial_paid_recovery_requests r WHERE r.enrollment_id=a.enrollment_id AND r.target_agreement_id=p_agreement_id) LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.record_paypal_trial_cancellation(p_enrollment_id uuid,p_agreement_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments; c jsonb;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND OR e.provider<>'paypal' THEN RETURN false; END IF;
 -- This cancellation is prerequisite neutralization of the old agreement, not a cancellation of the approved paid operation.
 IF EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations o JOIN private.paypal_trial_paid_recovery_requests r ON r.operation_id=o.id
 WHERE o.enrollment_id=e.id AND o.source_agreement_id=p_agreement_id AND o.status='pending' AND r.source_neutralization_requested_at IS NOT NULL) THEN RETURN false; END IF;
 c:=public.read_trial_effective_contract(e.id);
 IF c->>'provider_agreement_id' IS DISTINCT FROM p_agreement_id THEN RETURN false; END IF;
 UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id;
 RETURN true;
END $$;

CREATE FUNCTION public.claim_paypal_trial_paid_recovery_source_neutralization(p_operation_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.guard_trial_paid_recovery_operation(p_operation_id,p_user_id) THEN RETURN false; END IF;
 UPDATE private.paypal_trial_paid_recovery_requests SET source_neutralization_requested_at=coalesce(source_neutralization_requested_at,clock_timestamp())
 WHERE operation_id=p_operation_id AND user_id=p_user_id; RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_paypal_trial_paid_recovery_source_neutralization(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paypal_trial_paid_recovery_source_neutralization(uuid,uuid) TO service_role;
