CREATE TABLE private.paypal_trial_management_requests (
 operation_id uuid PRIMARY KEY, enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
 app_id text NOT NULL, product_id text NOT NULL, source_plan_id text NOT NULL, target_plan_id text NOT NULL,
 request_id text NOT NULL UNIQUE, request_expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '72 hours',
 return_url text NOT NULL, cancel_url text NOT NULL, request_sent_at timestamptz,
 target_agreement_id text, approval_url text, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.paypal_trial_management_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.paypal_trial_management_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.paypal_trial_management_requests TO service_role;

CREATE FUNCTION public.get_paypal_trial_management_request(p_operation_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; r private.paypal_trial_management_requests;
BEGIN
 o:=public.load_trial_management_operation(p_operation_id,p_user_id);
 IF o->>'provider'<>'paypal' THEN RAISE EXCEPTION 'PayPal management provider mismatch'; END IF;
 SELECT * INTO r FROM private.paypal_trial_management_requests WHERE operation_id=p_operation_id;
 IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.freeze_paypal_trial_management_request(p_operation_id uuid,p_user_id uuid,p_source_plan_id text,p_target_plan_id text,p_return_url text,p_cancel_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; a private.paypal_trial_checkout_attempts; r private.paypal_trial_management_requests;
BEGIN
 o:=public.load_trial_management_operation(p_operation_id,p_user_id);
 IF o->>'provider'<>'paypal' OR o->>'status'<>'pending' OR (o->>'originalTrialEndAt')::timestamptz<=clock_timestamp()
  OR p_source_plan_id IS NULL OR p_source_plan_id !~ '^\S{1,255}$' OR p_target_plan_id IS NULL OR p_target_plan_id !~ '^\S{1,255}$'
  OR p_return_url IS NULL OR length(p_return_url) NOT BETWEEN 1 AND 2000 OR p_cancel_url IS NULL OR length(p_cancel_url) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'PayPal management operation unavailable'; END IF;
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE enrollment_id=(o->>'enrollmentId')::uuid;
 IF NOT FOUND OR a.paypal_app_id IS NULL OR a.paypal_product_id IS NULL OR a.provider_reference IS DISTINCT FROM o->>'originalAgreementId'
 THEN RAISE EXCEPTION 'PayPal original management authority unavailable'; END IF;
 INSERT INTO private.paypal_trial_management_requests(operation_id,enrollment_id,app_id,product_id,source_plan_id,target_plan_id,request_id,return_url,cancel_url)
 VALUES(p_operation_id,a.enrollment_id,a.paypal_app_id,a.paypal_product_id,p_source_plan_id,p_target_plan_id,'paypal-trial-management:'||p_operation_id::text,p_return_url,p_cancel_url)
 ON CONFLICT(operation_id) DO NOTHING;
 SELECT * INTO r FROM private.paypal_trial_management_requests WHERE operation_id=p_operation_id;
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.claim_paypal_trial_management_request(p_operation_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb;
BEGIN
 o:=public.load_trial_management_operation(p_operation_id,p_user_id);
 IF o->>'provider'<>'paypal' OR o->>'status'<>'pending' OR (o->>'originalTrialEndAt')::timestamptz<=clock_timestamp() THEN RETURN false; END IF;
 UPDATE private.paypal_trial_management_requests SET request_sent_at=clock_timestamp()
 WHERE operation_id=p_operation_id AND request_sent_at IS NULL AND request_expires_at>clock_timestamp();
 RETURN FOUND;
END $$;
CREATE FUNCTION public.bind_paypal_trial_management_response(p_operation_id uuid,p_user_id uuid,p_target_agreement_id text,p_approval_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; r private.paypal_trial_management_requests;
BEGIN
 o:=public.load_trial_management_operation(p_operation_id,p_user_id);
 SELECT * INTO r FROM private.paypal_trial_management_requests WHERE operation_id=p_operation_id FOR UPDATE;
 IF NOT FOUND OR o->>'provider'<>'paypal' OR o->>'status'<>'pending' OR r.request_sent_at IS NULL
  OR p_target_agreement_id IS NULL OR p_target_agreement_id !~ '^\S{1,255}$'
  OR (p_approval_url IS NOT NULL AND length(p_approval_url) NOT BETWEEN 1 AND 4000)
  OR (r.target_agreement_id IS NOT NULL AND r.target_agreement_id<>p_target_agreement_id)
 THEN RAISE EXCEPTION 'PayPal management response mismatch'; END IF;
 UPDATE private.paypal_trial_management_requests SET target_agreement_id=p_target_agreement_id,approval_url=coalesce(approval_url,p_approval_url)
 WHERE operation_id=p_operation_id RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.get_paypal_trial_management_request(uuid,uuid),public.freeze_paypal_trial_management_request(uuid,uuid,text,text,text,text),public.claim_paypal_trial_management_request(uuid,uuid),public.bind_paypal_trial_management_response(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paypal_trial_management_request(uuid,uuid),public.freeze_paypal_trial_management_request(uuid,uuid,text,text,text,text),public.claim_paypal_trial_management_request(uuid,uuid),public.bind_paypal_trial_management_response(uuid,uuid,text,text) TO service_role;

CREATE TABLE private.paypal_trial_plan_catalogs (
 enrollment_id uuid PRIMARY KEY REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
 app_id text NOT NULL,product_id text NOT NULL,month_plan_id text NOT NULL,year_plan_id text NOT NULL
);
ALTER TABLE private.paypal_trial_plan_catalogs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.paypal_trial_plan_catalogs FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.paypal_trial_plan_catalogs TO service_role;
CREATE FUNCTION public.get_paypal_trial_plan_catalog(p_enrollment_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(c) FROM private.paypal_trial_plan_catalogs c WHERE enrollment_id=p_enrollment_id;
$$;
CREATE FUNCTION public.freeze_paypal_trial_plan_catalog(p_enrollment_id uuid,p_app_id text,p_product_id text,p_month_plan_id text,p_year_plan_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments; c private.paypal_trial_plan_catalogs;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND OR e.provider<>'paypal' OR p_app_id IS NULL OR p_app_id !~ '^\S{1,255}$' OR p_product_id IS NULL OR p_product_id !~ '^\S{1,255}$'
  OR p_month_plan_id IS NULL OR p_month_plan_id !~ '^\S{1,255}$' OR p_year_plan_id IS NULL OR p_year_plan_id !~ '^\S{1,255}$' OR p_month_plan_id=p_year_plan_id
 THEN RAISE EXCEPTION 'Invalid PayPal frozen catalog'; END IF;
 SELECT * INTO c FROM private.paypal_trial_plan_catalogs WHERE enrollment_id=p_enrollment_id;
 IF FOUND THEN
  IF c.app_id<>p_app_id OR c.product_id<>p_product_id OR c.month_plan_id<>p_month_plan_id OR c.year_plan_id<>p_year_plan_id THEN RAISE EXCEPTION 'PayPal frozen catalog conflict'; END IF;
  RETURN to_jsonb(c);
 END IF;
 IF e.admission_status<>'reserved' OR e.authorization_succeeded_at IS NOT NULL THEN RAISE EXCEPTION 'PayPal catalog must precede authorization'; END IF;
 INSERT INTO private.paypal_trial_plan_catalogs VALUES(p_enrollment_id,p_app_id,p_product_id,p_month_plan_id,p_year_plan_id) RETURNING * INTO c;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.get_paypal_trial_plan_catalog(uuid),public.freeze_paypal_trial_plan_catalog(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paypal_trial_plan_catalog(uuid),public.freeze_paypal_trial_plan_catalog(uuid,text,text,text,text) TO service_role;
CREATE FUNCTION public.get_paypal_trial_checkout_attempt_by_scope(p_scope_kind text,p_scope_id uuid,p_client_attempt_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.paypal_trial_attempt_row(a) FROM private.paypal_trial_checkout_attempts a WHERE scope_kind=p_scope_kind AND scope_id=p_scope_id AND client_attempt_id=p_client_attempt_id;
$$;
REVOKE ALL ON FUNCTION public.get_paypal_trial_checkout_attempt_by_scope(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paypal_trial_checkout_attempt_by_scope(text,uuid,uuid) TO service_role;
CREATE FUNCTION public.find_paypal_trial_checkout_intent_for_agreement(p_agreement_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(i) FROM private.paypal_trial_checkout_attempts a JOIN public.paypal_checkout_intents i ON i.id=a.intent_id
 WHERE a.provider_reference=p_agreement_id OR EXISTS(SELECT 1 FROM private.trial_offer_revisions r WHERE r.enrollment_id=a.enrollment_id AND r.provider='paypal' AND r.provider_agreement_id=p_agreement_id) LIMIT 1;
$$;
CREATE FUNCTION public.find_paypal_trial_management_callback(p_agreement_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('operationId',o.id,'authenticatedUserId',o.user_id)
 FROM private.paypal_trial_management_requests r JOIN private.trial_management_operations o ON o.id=r.operation_id
 WHERE o.status IN ('pending','committed') AND (r.target_agreement_id=p_agreement_id OR (o.kind='switch' AND o.source_agreement_id=p_agreement_id AND r.request_sent_at IS NOT NULL))
 ORDER BY o.created_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_paypal_trial_checkout_intent_for_agreement(text),public.find_paypal_trial_management_callback(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.find_paypal_trial_checkout_intent_for_agreement(text),public.find_paypal_trial_management_callback(text) TO service_role;
CREATE FUNCTION public.record_paypal_trial_cancellation(p_enrollment_id uuid,p_agreement_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments; c jsonb;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND OR e.provider<>'paypal' THEN RETURN false; END IF;
 c:=public.read_trial_effective_contract(e.id);
 IF c->>'provider_agreement_id' IS DISTINCT FROM p_agreement_id THEN RETURN false; END IF;
 UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_paypal_trial_cancellation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_paypal_trial_cancellation(uuid,text) TO service_role;
CREATE TRIGGER paypal_trial_plan_catalog_immutable BEFORE UPDATE OR DELETE ON private.paypal_trial_plan_catalogs
FOR EACH ROW EXECUTE FUNCTION private.reject_trial_management_immutable_write();
CREATE FUNCTION private.prevent_paypal_trial_management_request_rewrite() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.operation_id IS DISTINCT FROM OLD.operation_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id
 OR NEW.app_id IS DISTINCT FROM OLD.app_id OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.source_plan_id IS DISTINCT FROM OLD.source_plan_id OR NEW.target_plan_id IS DISTINCT FROM OLD.target_plan_id
 OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.request_expires_at IS DISTINCT FROM OLD.request_expires_at OR NEW.return_url IS DISTINCT FROM OLD.return_url OR NEW.cancel_url IS DISTINCT FROM OLD.cancel_url
 OR (OLD.request_sent_at IS NOT NULL AND NEW.request_sent_at IS DISTINCT FROM OLD.request_sent_at)
 OR (OLD.target_agreement_id IS NOT NULL AND NEW.target_agreement_id IS DISTINCT FROM OLD.target_agreement_id)
 OR (OLD.approval_url IS NOT NULL AND NEW.approval_url IS DISTINCT FROM OLD.approval_url)
 THEN RAISE EXCEPTION 'PayPal trial management request immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER paypal_trial_management_request_immutable BEFORE UPDATE ON private.paypal_trial_management_requests FOR EACH ROW EXECUTE FUNCTION private.prevent_paypal_trial_management_request_rewrite();
REVOKE ALL ON FUNCTION private.prevent_paypal_trial_management_request_rewrite() FROM PUBLIC,anon,authenticated;
