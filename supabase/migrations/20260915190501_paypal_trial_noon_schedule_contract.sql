-- A PayPal `start_time` is a provider scheduling input, distinct from the
-- customer-facing trial end.  Keep both immutable once a v2 request freezes.
ALTER TABLE private.paypal_trial_checkout_attempts
  ADD COLUMN trial_end_at timestamptz,
  ADD COLUMN provider_start_time timestamptz,
  ADD CONSTRAINT paypal_trial_checkout_schedule_pair CHECK (
    (trial_end_at IS NULL) = (provider_start_time IS NULL)
    AND (CASE WHEN trial_end_at IS NOT NULL THEN
      request_id IS NOT DISTINCT FROM ('paypal-trial:'||id::text||':v2')
      AND provider_start_time=trial_end_at+interval '12 hours'
      AND trial_end_at=private.paypal_trial_frozen_start(request_expires_at)
      ELSE request_id IS NULL OR request_id=('paypal-trial:'||id::text||':v1') END)
    AND (trial_end_at IS NULL OR (isfinite(trial_end_at) AND isfinite(provider_start_time)))
  );

-- Version existing readers before fencing their public v1 names.  A delayed
-- deployment can still create/replay v1 rows, but cannot read a v2 row and
-- accidentally POST a midnight payload for it.
ALTER FUNCTION public.create_paypal_trial_checkout_attempt(text,uuid,uuid,jsonb,text,uuid,text)
  RENAME TO create_paypal_trial_checkout_attempt_v2;
ALTER FUNCTION public.get_paypal_trial_checkout_attempt(text)
  RENAME TO get_paypal_trial_checkout_attempt_v2;
ALTER FUNCTION public.get_paypal_trial_checkout_attempt_by_scope(text,uuid,uuid)
  RENAME TO get_paypal_trial_checkout_attempt_by_scope_v2;

CREATE FUNCTION public.create_paypal_trial_checkout_attempt(p_scope_kind text,p_scope_id uuid,p_client_attempt_id uuid,p_offer jsonb,p_email text,p_lead_id uuid,p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 r:=public.create_paypal_trial_checkout_attempt_v2(p_scope_kind,p_scope_id,p_client_attempt_id,p_offer,p_email,p_lead_id,p_source);
 IF r->>'trial_end_at' IS NOT NULL OR r->>'provider_start_time' IS NOT NULL THEN
  RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader';
 END IF;
 RETURN r;
END $$;
CREATE FUNCTION public.get_paypal_trial_checkout_attempt(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 r:=public.get_paypal_trial_checkout_attempt_v2(p_token);
 IF r->>'trial_end_at' IS NOT NULL OR r->>'provider_start_time' IS NOT NULL THEN
  RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader';
 END IF;
 RETURN r;
END $$;
CREATE FUNCTION public.get_paypal_trial_checkout_attempt_by_scope(p_scope_kind text,p_scope_id uuid,p_client_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 r:=public.get_paypal_trial_checkout_attempt_by_scope_v2(p_scope_kind,p_scope_id,p_client_attempt_id);
 IF r->>'trial_end_at' IS NOT NULL OR r->>'provider_start_time' IS NOT NULL THEN
  RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader';
 END IF;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_checkout_attempt_rewrite() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (NEW.trial_end_at IS NULL) <> (NEW.provider_start_time IS NULL)
  OR (NEW.trial_end_at IS NOT NULL AND (NOT isfinite(NEW.trial_end_at) OR NOT isfinite(NEW.provider_start_time)))
  OR (NEW.trial_end_at IS NOT NULL AND (NEW.provider_start_time<>NEW.trial_end_at+interval '12 hours' OR NEW.trial_end_at<>private.paypal_trial_frozen_start(NEW.request_expires_at)))
  OR (OLD.trial_end_at IS NOT NULL AND (NEW.trial_end_at IS DISTINCT FROM OLD.trial_end_at OR NEW.provider_start_time IS DISTINCT FROM OLD.provider_start_time))
  OR (OLD.trial_end_at IS NULL AND NEW.trial_end_at IS NOT NULL AND (OLD.request_id IS NOT NULL OR NEW.request_id !~ '^paypal-trial:[0-9a-f-]{36}:v2$' OR NEW.status<>'frozen'))
  OR NEW.scope_kind IS DISTINCT FROM OLD.scope_kind OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR NEW.client_attempt_id IS DISTINCT FROM OLD.client_attempt_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.intent_id IS DISTINCT FROM OLD.intent_id OR NEW.accepted_offer IS DISTINCT FROM OLD.accepted_offer
  OR (OLD.paypal_app_id IS NOT NULL AND NEW.paypal_app_id IS DISTINCT FROM OLD.paypal_app_id)
  OR (OLD.paypal_product_id IS NOT NULL AND NEW.paypal_product_id IS DISTINCT FROM OLD.paypal_product_id)
  OR (OLD.paypal_plan_id IS NOT NULL AND NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id)
  OR (OLD.request_id IS NOT NULL AND NEW.request_id IS DISTINCT FROM OLD.request_id)
  OR (OLD.request_expires_at IS NOT NULL AND NEW.request_expires_at IS DISTINCT FROM OLD.request_expires_at)
  OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
 THEN RAISE EXCEPTION 'PayPal trial checkout attempt immutable'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.freeze_paypal_trial_checkout_attempt_v2(p_attempt_id uuid,p_app_id text,p_product_id text,p_plan_id text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts; expiry timestamptz; trial_end timestamptz;
BEGIN
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.status IN ('provider_created','reconciliation_required') OR p_app_id IS NULL OR p_product_id IS NULL OR p_plan_id IS NULL OR p_app_id !~ '^\S{1,255}$' OR p_product_id !~ '^\S{1,255}$' OR p_plan_id !~ '^\S{1,255}$'
  OR p_request_id IS DISTINCT FROM ('paypal-trial:'||a.id::text||':v2') THEN
  RAISE EXCEPTION 'PayPal trial checkout reconciliation required';
 END IF;
 IF a.request_id IS NOT NULL THEN
  IF a.paypal_app_id<>p_app_id OR a.paypal_product_id<>p_product_id OR a.paypal_plan_id<>p_plan_id THEN
   RAISE EXCEPTION 'PayPal trial checkout attempt conflict';
  END IF;
  -- A v1 request won the race.  Its frozen idempotency payload is authoritative.
  IF a.request_id='paypal-trial:'||a.id::text||':v1' AND a.trial_end_at IS NULL AND a.provider_start_time IS NULL THEN
   RETURN private.paypal_trial_attempt_row(a);
  END IF;
  IF a.request_id<>p_request_id OR a.trial_end_at IS NULL OR a.provider_start_time IS NULL
   OR a.provider_start_time<>a.trial_end_at+interval '12 hours' THEN
   RAISE EXCEPTION 'PayPal trial checkout schedule conflict';
  END IF;
  IF a.request_expires_at<=clock_timestamp() THEN
   UPDATE private.paypal_trial_checkout_attempts SET status='reconciliation_required',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
  END IF;
  RETURN private.paypal_trial_attempt_row(a);
 END IF;
 expiry:=clock_timestamp()+interval '72 hours';
 trial_end:=private.paypal_trial_frozen_start(expiry);
 UPDATE private.paypal_trial_checkout_attempts
 SET paypal_app_id=p_app_id,paypal_product_id=p_product_id,paypal_plan_id=p_plan_id,request_id=p_request_id,
     request_expires_at=expiry,trial_end_at=trial_end,provider_start_time=trial_end+interval '12 hours',status='frozen',updated_at=clock_timestamp()
 WHERE id=a.id RETURNING * INTO a;
 UPDATE public.paypal_checkout_intents
 SET metadata=metadata||jsonb_build_object('paypal_app_id',p_app_id,'paypal_product_id',p_product_id,'paypal_plan_id',p_plan_id,'paypal_request_id',p_request_id),updated_at=clock_timestamp()
 WHERE id=a.intent_id;
 RETURN private.paypal_trial_attempt_row(a);
END $$;

-- Management revisions persist both sides of the provider schedule.  Restore
-- makes a new provider agreement; switch retains the existing exact start.
ALTER TABLE private.paypal_trial_management_requests
 ADD COLUMN source_start_time timestamptz,
 ADD COLUMN target_start_time timestamptz,
 ADD CONSTRAINT paypal_trial_management_schedule_pair CHECK (
  (source_start_time IS NULL) = (target_start_time IS NULL)
  AND (source_start_time IS NULL OR (isfinite(source_start_time) AND isfinite(target_start_time)))
  AND request_id=CASE WHEN source_start_time IS NULL
    THEN 'paypal-trial-management:'||operation_id::text
    ELSE 'paypal-trial-management:'||operation_id::text||':v2' END
 );
ALTER FUNCTION public.get_paypal_trial_management_request(uuid,uuid)
 RENAME TO get_paypal_trial_management_request_v2;
ALTER FUNCTION public.freeze_paypal_trial_management_request(uuid,uuid,text,text,text,text)
 RENAME TO freeze_paypal_trial_management_request_v1_impl;
ALTER FUNCTION public.freeze_paypal_trial_management_request_v1_impl(uuid,uuid,text,text,text,text)
 SET SCHEMA private;

CREATE FUNCTION public.get_paypal_trial_management_request(p_operation_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 r:=public.get_paypal_trial_management_request_v2(p_operation_id,p_user_id);
 IF r->>'source_start_time' IS NOT NULL OR r->>'target_start_time' IS NOT NULL THEN
  RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader';
 END IF;
 RETURN r;
END $$;
CREATE FUNCTION public.freeze_paypal_trial_management_request(p_operation_id uuid,p_user_id uuid,p_source_plan_id text,p_target_plan_id text,p_return_url text,p_cancel_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE existing private.paypal_trial_management_requests; operation private.trial_management_operations;
BEGIN
 -- Lock an existing authority row even before a request exists. Both deployment
 -- versions take this lock, so the first inserted payload wins atomically.
 SELECT * INTO operation FROM private.trial_management_operations WHERE id=p_operation_id FOR UPDATE;
 -- A legacy original may already have been restored with a noon schedule.
 -- Fence new old-version operations on that lineage too, before they can
 -- insert a midnight payload without explicit persisted schedule evidence.
 IF EXISTS(SELECT 1 FROM private.paypal_trial_checkout_attempts a
   WHERE a.enrollment_id=operation.enrollment_id AND a.provider_start_time IS NOT NULL)
 OR EXISTS(SELECT 1 FROM private.paypal_trial_management_requests r
   JOIN private.trial_management_operations o ON o.id=r.operation_id
   WHERE o.enrollment_id=operation.enrollment_id AND o.kind='restore' AND o.status='committed'
     AND r.target_agreement_id=operation.source_agreement_id AND r.target_start_time IS NOT NULL)
 THEN RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader'; END IF;
 SELECT * INTO existing FROM private.paypal_trial_management_requests WHERE operation_id=p_operation_id;
 IF FOUND AND (existing.source_start_time IS NOT NULL OR existing.target_start_time IS NOT NULL) THEN
  RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader';
 END IF;
 PERFORM private.freeze_paypal_trial_management_request_v1_impl(p_operation_id,p_user_id,p_source_plan_id,p_target_plan_id,p_return_url,p_cancel_url);
 SELECT * INTO existing FROM private.paypal_trial_management_requests WHERE operation_id=p_operation_id;
 IF existing.source_start_time IS NOT NULL OR existing.target_start_time IS NOT NULL THEN RAISE EXCEPTION 'PayPal trial v2 schedule requires a v2 reader'; END IF;
 RETURN to_jsonb(existing);
END $$;
CREATE FUNCTION private.paypal_trial_legacy_restore_start(p_trial_end timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT (date_trunc('day',(p_trial_end-interval '1 microsecond') AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC'
$$;
CREATE FUNCTION public.freeze_paypal_trial_management_request_v2(p_operation_id uuid,p_user_id uuid,p_source_plan_id text,p_target_plan_id text,p_return_url text,p_cancel_url text,p_source_start_time timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o jsonb; a private.paypal_trial_checkout_attempts; r private.paypal_trial_management_requests;
        source_start timestamptz; target_start timestamptz; restored_start timestamptz; restored_found boolean:=false;
BEGIN
 PERFORM 1 FROM private.trial_management_operations WHERE id=p_operation_id FOR UPDATE;
 o:=public.load_trial_management_operation(p_operation_id,p_user_id);
 IF o IS NULL OR o->>'provider' IS DISTINCT FROM 'paypal' OR o->>'status' IS DISTINCT FROM 'pending' OR (o->>'originalTrialEndAt')::timestamptz<=clock_timestamp()
  OR p_source_plan_id IS NULL OR p_source_plan_id !~ '^\S{1,255}$' OR p_target_plan_id IS NULL OR p_target_plan_id !~ '^\S{1,255}$'
  OR p_return_url IS NULL OR length(p_return_url) NOT BETWEEN 1 AND 2000 OR p_cancel_url IS NULL OR length(p_cancel_url) NOT BETWEEN 1 AND 2000
  OR p_source_start_time IS NULL OR NOT isfinite(p_source_start_time)
 THEN RAISE EXCEPTION 'PayPal management operation unavailable'; END IF;
 SELECT * INTO r FROM private.paypal_trial_management_requests WHERE operation_id=p_operation_id FOR UPDATE;
 IF FOUND THEN
  IF r.source_start_time IS NULL OR r.target_start_time IS NULL THEN
   -- Existing v1 request wins; never mutate its idempotent payload.
   RETURN to_jsonb(r);
  END IF;
  IF r.source_plan_id<>p_source_plan_id OR r.target_plan_id<>p_target_plan_id OR r.return_url<>p_return_url OR r.cancel_url<>p_cancel_url OR r.source_start_time<>p_source_start_time THEN
   RAISE EXCEPTION 'PayPal management request conflict';
  END IF;
  RETURN to_jsonb(r);
 END IF;
 SELECT * INTO a FROM private.paypal_trial_checkout_attempts WHERE enrollment_id=(o->>'enrollmentId')::uuid;
 IF NOT FOUND OR a.paypal_app_id IS NULL OR a.paypal_product_id IS NULL THEN
  RAISE EXCEPTION 'PayPal original management authority unavailable';
 END IF;
 SELECT true,r2.target_start_time INTO restored_found,restored_start
 FROM private.paypal_trial_management_requests r2 JOIN private.trial_management_operations o2 ON o2.id=r2.operation_id
 WHERE o2.enrollment_id=(o->>'enrollmentId')::uuid AND o2.status='committed' AND o2.kind='restore' AND r2.target_agreement_id=o->>'sourceAgreementId'
 ORDER BY o2.completed_at DESC LIMIT 1;
 IF restored_found AND restored_start IS NOT NULL THEN source_start:=restored_start;
 ELSIF restored_found THEN source_start:=private.paypal_trial_legacy_restore_start((o->>'originalTrialEndAt')::timestamptz);
 ELSIF a.provider_reference=o->>'sourceAgreementId' AND a.provider_start_time IS NOT NULL THEN source_start:=a.provider_start_time;
 ELSIF a.provider_reference=o->>'sourceAgreementId' AND p_source_start_time IN ((o->>'originalTrialEndAt')::timestamptz,private.paypal_trial_legacy_restore_start((o->>'originalTrialEndAt')::timestamptz)) THEN source_start:=p_source_start_time;
 ELSE RAISE EXCEPTION 'PayPal original management schedule unavailable'; END IF;
 IF p_source_start_time<>source_start THEN RAISE EXCEPTION 'PayPal management source schedule mismatch'; END IF;
 target_start:=CASE WHEN o->>'kind'='restore' THEN private.paypal_trial_legacy_restore_start((o->>'originalTrialEndAt')::timestamptz)+interval '12 hours' ELSE source_start END;
 INSERT INTO private.paypal_trial_management_requests(operation_id,enrollment_id,app_id,product_id,source_plan_id,target_plan_id,request_id,return_url,cancel_url,source_start_time,target_start_time)
 VALUES(p_operation_id,a.enrollment_id,a.paypal_app_id,a.paypal_product_id,p_source_plan_id,p_target_plan_id,'paypal-trial-management:'||p_operation_id::text||':v2',p_return_url,p_cancel_url,source_start,target_start)
 RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_management_request_rewrite() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (NEW.source_start_time IS NULL) <> (NEW.target_start_time IS NULL)
 OR (NEW.source_start_time IS NOT NULL AND (NOT isfinite(NEW.source_start_time) OR NOT isfinite(NEW.target_start_time)))
 OR (OLD.source_start_time IS NOT NULL AND (NEW.source_start_time IS DISTINCT FROM OLD.source_start_time OR NEW.target_start_time IS DISTINCT FROM OLD.target_start_time))
 OR (OLD.source_start_time IS NULL AND NEW.source_start_time IS NOT NULL)
 OR NEW.operation_id IS DISTINCT FROM OLD.operation_id OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id
 OR NEW.app_id IS DISTINCT FROM OLD.app_id OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.source_plan_id IS DISTINCT FROM OLD.source_plan_id OR NEW.target_plan_id IS DISTINCT FROM OLD.target_plan_id
 OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.request_expires_at IS DISTINCT FROM OLD.request_expires_at OR NEW.return_url IS DISTINCT FROM OLD.return_url OR NEW.cancel_url IS DISTINCT FROM OLD.cancel_url
 OR (OLD.request_sent_at IS NOT NULL AND NEW.request_sent_at IS DISTINCT FROM OLD.request_sent_at)
 OR (OLD.target_agreement_id IS NOT NULL AND NEW.target_agreement_id IS DISTINCT FROM OLD.target_agreement_id)
 OR (OLD.approval_url IS NOT NULL AND NEW.approval_url IS DISTINCT FROM OLD.approval_url)
 THEN RAISE EXCEPTION 'PayPal trial management request immutable'; END IF;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.create_paypal_trial_checkout_attempt(text,uuid,uuid,jsonb,text,uuid,text),public.get_paypal_trial_checkout_attempt(text),public.get_paypal_trial_checkout_attempt_by_scope(text,uuid,uuid),public.create_paypal_trial_checkout_attempt_v2(text,uuid,uuid,jsonb,text,uuid,text),public.get_paypal_trial_checkout_attempt_v2(text),public.get_paypal_trial_checkout_attempt_by_scope_v2(text,uuid,uuid),public.freeze_paypal_trial_checkout_attempt_v2(uuid,text,text,text,text),public.get_paypal_trial_management_request(uuid,uuid),public.freeze_paypal_trial_management_request(uuid,uuid,text,text,text,text),public.get_paypal_trial_management_request_v2(uuid,uuid),public.freeze_paypal_trial_management_request_v2(uuid,uuid,text,text,text,text,timestamptz),private.paypal_trial_legacy_restore_start(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_paypal_trial_checkout_attempt(text,uuid,uuid,jsonb,text,uuid,text),public.get_paypal_trial_checkout_attempt(text),public.get_paypal_trial_checkout_attempt_by_scope(text,uuid,uuid),public.create_paypal_trial_checkout_attempt_v2(text,uuid,uuid,jsonb,text,uuid,text),public.get_paypal_trial_checkout_attempt_v2(text),public.get_paypal_trial_checkout_attempt_by_scope_v2(text,uuid,uuid),public.freeze_paypal_trial_checkout_attempt_v2(uuid,text,text,text,text),public.get_paypal_trial_management_request(uuid,uuid),public.freeze_paypal_trial_management_request(uuid,uuid,text,text,text,text),public.get_paypal_trial_management_request_v2(uuid,uuid),public.freeze_paypal_trial_management_request_v2(uuid,uuid,text,text,text,text,timestamptz),private.paypal_trial_legacy_restore_start(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION private.prevent_paypal_trial_checkout_attempt_rewrite(),private.prevent_paypal_trial_management_request_rewrite(),private.paypal_trial_legacy_restore_start(timestamptz) FROM PUBLIC,anon,authenticated;
