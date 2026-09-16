-- Current server-verified ACTIVE status can confirm a fresh v2 trial without
-- waiting for webhook delivery. This clock is confirmation, not an assertion
-- about first-ever provider activation. Frozen end and billing rules are intact.
ALTER TABLE private.paypal_trial_checkout_attempts
 ADD COLUMN authorization_proof_kind text,
 ADD COLUMN api_confirmation_id uuid,
 ADD COLUMN api_confirmed_at timestamptz;
UPDATE private.paypal_trial_checkout_attempts SET authorization_proof_kind='webhook'
 WHERE authorization_succeeded_at IS NOT NULL;
ALTER TABLE private.paypal_trial_checkout_attempts
 DROP CONSTRAINT paypal_trial_activation_evidence_pair,
 ADD CONSTRAINT paypal_trial_activation_evidence_pair CHECK (CASE
  WHEN authorization_proof_kind IS NULL THEN authorization_succeeded_at IS NULL
   AND activation_event_id IS NULL AND api_confirmation_id IS NULL AND api_confirmed_at IS NULL
  WHEN authorization_proof_kind='webhook' THEN authorization_succeeded_at IS NOT NULL
   AND isfinite(authorization_succeeded_at) AND activation_event_id IS NOT NULL
   AND length(btrim(activation_event_id)) BETWEEN 1 AND 255
   AND api_confirmation_id IS NULL AND api_confirmed_at IS NULL
  WHEN authorization_proof_kind='api_confirmation' THEN authorization_succeeded_at IS NOT NULL
   AND isfinite(authorization_succeeded_at) AND activation_event_id IS NULL
   AND api_confirmation_id IS NOT NULL AND api_confirmed_at IS NOT NULL
   AND isfinite(api_confirmed_at) AND api_confirmed_at=authorization_succeeded_at
  ELSE false END),
 ADD CONSTRAINT paypal_trial_api_confirmation_id_unique UNIQUE(api_confirmation_id);
COMMENT ON COLUMN private.paypal_trial_checkout_attempts.authorization_succeeded_at IS
 'Immutable admission clock: original verified event time for webhook proof, database confirmation time for api_confirmation. See authorization_proof_kind.';

CREATE OR REPLACE FUNCTION private.prevent_paypal_trial_activation_clock_rewrite()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.authorization_succeeded_at IS NOT NULL AND (
  NEW.authorization_succeeded_at IS DISTINCT FROM OLD.authorization_succeeded_at
  OR NEW.activation_event_id IS DISTINCT FROM OLD.activation_event_id
  OR NEW.authorization_proof_kind IS DISTINCT FROM OLD.authorization_proof_kind
  OR NEW.api_confirmation_id IS DISTINCT FROM OLD.api_confirmation_id
  OR NEW.api_confirmed_at IS DISTINCT FROM OLD.api_confirmed_at)
 THEN RAISE EXCEPTION 'PayPal trial activation evidence immutable'; END IF;
 RETURN NEW;
END $$;

CREATE TABLE private.paypal_trial_activation_evidence (
 event_id text PRIMARY KEY CHECK(length(btrim(event_id)) BETWEEN 1 AND 255),
 attempt_id uuid NOT NULL REFERENCES private.paypal_trial_checkout_attempts(id) ON DELETE RESTRICT,
 agreement_id text NOT NULL CHECK(length(btrim(agreement_id)) BETWEEN 1 AND 255),
 resource_status_updated_at timestamptz NOT NULL CHECK(isfinite(resource_status_updated_at)),
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(verified_at))
);
COMMENT ON TABLE private.paypal_trial_activation_evidence IS
 'Verified ACTIVATED observations. A later reactivation event is not relabeled as the original activation; winning admission provenance stays on the attempt.';
ALTER TABLE private.paypal_trial_activation_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.paypal_trial_activation_evidence FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON private.paypal_trial_activation_evidence TO service_role;
CREATE INDEX paypal_trial_activation_evidence_attempt_idx ON private.paypal_trial_activation_evidence(attempt_id);
CREATE FUNCTION private.prevent_paypal_trial_activation_evidence_rewrite() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'PayPal verified activation observation immutable'; END $$;
CREATE TRIGGER paypal_trial_activation_evidence_immutable BEFORE UPDATE OR DELETE
 ON private.paypal_trial_activation_evidence FOR EACH ROW
 EXECUTE FUNCTION private.prevent_paypal_trial_activation_evidence_rewrite();
-- Existing pins were already verified; preserve their evidence without changing
-- the pinned event, authorization time, enrollment, notice or analytics payload.
INSERT INTO private.paypal_trial_activation_evidence(event_id,attempt_id,agreement_id,resource_status_updated_at,verified_at)
 SELECT activation_event_id,id,provider_reference,authorization_succeeded_at,updated_at
 FROM private.paypal_trial_checkout_attempts WHERE authorization_proof_kind='webhook';

CREATE OR REPLACE FUNCTION public.pin_paypal_trial_activation(
 p_token text,p_agreement_id text,p_event_id text,p_authorized_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts; i public.paypal_checkout_intents;
 e public.trial_enrollments; evidence private.paypal_trial_activation_evidence;
BEGIN
 -- Shared with identity rights/admission; never acquire it after a row lock.
 PERFORM pg_advisory_xact_lock(74144351);
 SELECT a0.* INTO a FROM private.paypal_trial_checkout_attempts a0
 JOIN public.paypal_checkout_intents i0 ON i0.id=a0.intent_id WHERE i0.token=p_token FOR UPDATE OF a0;
 IF NOT FOUND THEN RAISE EXCEPTION 'PayPal trial activation evidence mismatch'; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=a.enrollment_id FOR UPDATE;
 SELECT * INTO i FROM public.paypal_checkout_intents WHERE id=a.intent_id;
 IF a.provider_reference IS DISTINCT FROM p_agreement_id OR i.provider_subscription_id IS DISTINCT FROM p_agreement_id
  OR a.status<>'provider_created' OR p_event_id IS NULL OR length(btrim(p_event_id)) NOT BETWEEN 1 AND 255
  OR p_authorized_at IS NULL OR NOT isfinite(p_authorized_at) OR p_authorized_at<i.created_at
  OR p_authorized_at>clock_timestamp()
 THEN RAISE EXCEPTION 'PayPal trial activation evidence mismatch'; END IF;
 INSERT INTO private.paypal_trial_activation_evidence(event_id,attempt_id,agreement_id,resource_status_updated_at)
 VALUES(p_event_id,a.id,p_agreement_id,p_authorized_at) ON CONFLICT(event_id) DO NOTHING;
 SELECT * INTO evidence FROM private.paypal_trial_activation_evidence WHERE event_id=p_event_id;
 IF evidence.attempt_id IS DISTINCT FROM a.id OR evidence.agreement_id IS DISTINCT FROM p_agreement_id
  OR evidence.resource_status_updated_at IS DISTINCT FROM p_authorized_at
 THEN RAISE EXCEPTION 'PayPal trial activation evidence conflict'; END IF;
 IF a.authorization_succeeded_at IS NOT NULL THEN RETURN private.paypal_trial_attempt_row(a); END IF;
 -- Decide late initial denial under the same locks as API confirmation. A JS
 -- read followed by cancellation could otherwise defeat a concurrent API pin.
 IF p_authorized_at>i.expires_at THEN
  IF e.admission_status='reserved' THEN
   IF e.provider_agreement_id IS NOT NULL AND e.provider_agreement_id<>p_agreement_id
   THEN RAISE EXCEPTION 'PayPal trial activation owner mismatch'; END IF;
   UPDATE public.trial_enrollments SET admission_status='blocked',
    provider_agreement_id=p_agreement_id,neutralization_required=true WHERE id=e.id;
  END IF;
  RETURN private.paypal_trial_attempt_row(a);
 END IF;
 IF e.admission_status IN ('blocked','released') OR e.access_revoked
 THEN RETURN private.paypal_trial_attempt_row(a); END IF;
 UPDATE private.paypal_trial_checkout_attempts
 SET authorization_succeeded_at=p_authorized_at,activation_event_id=p_event_id,
  authorization_proof_kind='webhook',updated_at=clock_timestamp()
 WHERE id=a.id RETURNING * INTO a;
 RETURN private.paypal_trial_attempt_row(a);
END $$;

CREATE FUNCTION public.confirm_paypal_trial_activation(
 p_token text,p_agreement_id text,p_confirmation_id uuid,p_app_id text,p_plan_id text,
 p_provider_start_time timestamptz,p_next_billing_time timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.paypal_trial_checkout_attempts; i public.paypal_checkout_intents;
 e public.trial_enrollments; confirmed_at timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(74144351);
 SELECT a0.* INTO a FROM private.paypal_trial_checkout_attempts a0
 JOIN public.paypal_checkout_intents i0 ON i0.id=a0.intent_id WHERE i0.token=p_token FOR UPDATE OF a0;
 IF NOT FOUND THEN RAISE EXCEPTION 'PayPal trial confirmation binding mismatch'; END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=a.enrollment_id FOR UPDATE;
 -- Binding writes lock the attempt. Do not lock intent here: analytics uses
 -- enrollment->intent. Do not lock expiry candidates: completion uses candidate->enrollment.
 SELECT * INTO i FROM public.paypal_checkout_intents WHERE id=a.intent_id;
 confirmed_at:=clock_timestamp();
 IF p_confirmation_id IS NULL OR p_agreement_id IS NULL OR length(btrim(p_agreement_id)) NOT BETWEEN 1 AND 255
  OR p_app_id IS NULL OR p_plan_id IS NULL OR p_provider_start_time IS NULL OR p_next_billing_time IS NULL
  OR NOT isfinite(p_provider_start_time) OR NOT isfinite(p_next_billing_time)
  OR a.provider_reference IS DISTINCT FROM p_agreement_id OR i.provider_subscription_id IS DISTINCT FROM p_agreement_id
  OR a.paypal_app_id IS DISTINCT FROM p_app_id OR a.paypal_plan_id IS DISTINCT FROM p_plan_id
  OR i.metadata->>'paypal_app_id' IS DISTINCT FROM a.paypal_app_id
  OR i.metadata->>'paypal_plan_id' IS DISTINCT FROM a.paypal_plan_id
  OR i.metadata->>'paypal_product_id' IS DISTINCT FROM a.paypal_product_id
  OR i.metadata->>'trial_enrollment_id' IS DISTINCT FROM a.enrollment_id::text
  OR i.metadata->>'trial_cohort' IS DISTINCT FROM 'trial_v1'
  OR e.provider IS DISTINCT FROM 'paypal' OR e.accepted_offer IS DISTINCT FROM a.accepted_offer
  OR i.metadata->'accepted_offer' IS DISTINCT FROM a.accepted_offer
  OR (a.scope_kind='user' AND (a.scope_id IS DISTINCT FROM e.user_id OR i.user_id IS DISTINCT FROM a.scope_id))
  OR (a.scope_kind='lead' AND (i.lead_id IS DISTINCT FROM a.scope_id
   OR (e.user_id IS NOT NULL AND i.user_id IS NOT NULL AND e.user_id<>i.user_id)))
  OR i.interval IS DISTINCT FROM a.accepted_offer->>'interval'
 THEN RAISE EXCEPTION 'PayPal trial confirmation contract mismatch'; END IF;
 -- Existing authority is completed by the ordinary admission path, independent
 -- of flag or elapsed window. This RPC never grants or resurrects access itself.
 IF a.authorization_succeeded_at IS NOT NULL THEN RETURN private.paypal_trial_attempt_row(a); END IF;
 IF a.status<>'provider_created' OR a.request_id IS DISTINCT FROM ('paypal-trial:'||a.id::text||':v2')
  OR a.trial_end_at IS NULL OR a.provider_start_time IS NULL OR e.admission_status<>'reserved'
  OR e.authorization_succeeded_at IS NOT NULL OR e.access_revoked OR e.neutralization_required
  OR e.cancel_at_period_end OR e.first_payment_succeeded_at IS NOT NULL
  OR (e.provider_agreement_id IS NOT NULL AND e.provider_agreement_id<>p_agreement_id)
  OR i.status NOT IN ('approved','activated') OR i.expires_at<=confirmed_at OR i.created_at>confirmed_at
  OR a.request_expires_at<=confirmed_at
  OR EXISTS(SELECT 1 FROM private.trial_management_state WHERE enrollment_id=e.id AND revision<>0)
  OR EXISTS(SELECT 1 FROM private.trial_management_operations WHERE enrollment_id=e.id)
  OR EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations WHERE enrollment_id=e.id)
  OR EXISTS(SELECT 1 FROM private.paypal_trial_candidate_expiry WHERE agreement_id=p_agreement_id)
  OR a.trial_end_at<confirmed_at+interval '604800 seconds'
  OR a.trial_end_at>confirmed_at+interval '864000 seconds'
 THEN RETURN private.paypal_trial_attempt_row(a); END IF;
 IF a.provider_start_time IS DISTINCT FROM p_provider_start_time
  OR a.trial_end_at IS DISTINCT FROM private.paypal_trial_frozen_start(a.request_expires_at)
  OR a.provider_start_time IS DISTINCT FROM a.trial_end_at+interval '12 hours'
  OR p_next_billing_time<a.trial_end_at OR p_next_billing_time>=a.trial_end_at+interval '48 hours'
 THEN RAISE EXCEPTION 'PayPal trial confirmation billing schedule mismatch'; END IF;
 UPDATE private.paypal_trial_checkout_attempts SET authorization_succeeded_at=confirmed_at,
  authorization_proof_kind='api_confirmation',api_confirmation_id=p_confirmation_id,
  api_confirmed_at=confirmed_at,updated_at=confirmed_at
 WHERE id=a.id RETURNING * INTO a;
 RETURN private.paypal_trial_attempt_row(a);
END $$;

CREATE FUNCTION private.trial_authorization_provenance(p_enrollment_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce((SELECT jsonb_build_object(
  'authorization_proof_kind',a.authorization_proof_kind,
  'authorization_clock_kind',CASE a.authorization_proof_kind WHEN 'api_confirmation' THEN 'server_confirmation' ELSE 'provider_event' END)
  || CASE WHEN a.authorization_proof_kind='api_confirmation'
   THEN jsonb_build_object('authorization_confirmed_at',a.api_confirmed_at) ELSE '{}'::jsonb END
 FROM private.paypal_trial_checkout_attempts a WHERE a.enrollment_id=p_enrollment_id
 AND a.authorization_proof_kind IS NOT NULL),'{}'::jsonb)
$$;
REVOKE ALL ON FUNCTION private.prevent_paypal_trial_activation_evidence_rewrite(),
 private.trial_authorization_provenance(uuid),
 public.confirm_paypal_trial_activation(text,text,uuid,text,text,timestamptz,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.prevent_paypal_trial_activation_evidence_rewrite(),
 private.trial_authorization_provenance(uuid),
 public.confirm_paypal_trial_activation(text,text,uuid,text,text,timestamptz,timestamptz)
 TO service_role;

-- Only new snapshots/events receive provenance; historical outbox facts stay immutable.
CREATE OR REPLACE FUNCTION private.capture_trial_analytics(p_enrollment_id uuid,p_name text,p_anchor text,p_occurred_at timestamptz,p_properties jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments; c private.trial_analytics_contexts; b public.billing_subscriptions;
 event_id uuid; v_event_key text; contract jsonb; payload jsonb; agreement text;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id;
 IF NOT FOUND OR e.user_id IS NULL OR e.authorization_succeeded_at IS NULL THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.trial_analytics_contexts WHERE enrollment_id=e.id) THEN
  PERFORM public.freeze_trial_analytics_context(e.id,NULL,'{}');
 END IF;
 SELECT * INTO c FROM private.trial_analytics_contexts WHERE enrollment_id=e.id;
 contract:=public.read_trial_effective_contract(e.id);
 agreement:=coalesce(contract->>'provider_agreement_id',e.provider_agreement_id);
 SELECT * INTO b FROM public.billing_subscriptions WHERE trial_enrollment_id=e.id AND provider=e.provider
  ORDER BY (provider_subscription_id=e.provider_agreement_id) DESC LIMIT 1;
 v_event_key:=e.provider||':'||p_name||':'||p_anchor;
 payload:=c.acquisition||jsonb_build_object('trial_analytics_version',1,'trial_enrollment_id',e.id,
  'trial_authorized_at',e.authorization_succeeded_at,'authorization_succeeded_at',e.authorization_succeeded_at,
  'trial_end_at',e.original_trial_end_at,'trial_cohort',e.cohort,
  'trial_offer_version',e.accepted_offer->>'offerVersion',
  'interval',coalesce(contract->'accepted_offer'->>'interval',e.accepted_offer->>'interval'),
  'trial_age_seconds',extract(epoch FROM p_occurred_at-e.authorization_succeeded_at),
  'was_paid',e.first_payment_succeeded_at IS NOT NULL,
  'cancel_at_period_end',e.cancel_at_period_end)||p_properties||private.trial_authorization_provenance(e.id);
 INSERT INTO public.billing_analytics_outbox(event_key,event_name,user_id,provider,provider_customer_id,
  provider_subscription_id,source_event_id,source_object_id,occurred_at,payload)
 VALUES(v_event_key,p_name,e.user_id,e.provider,b.provider_customer_id,agreement,
  p_properties->>'source_event_id',coalesce(p_properties->>'payment_source_object_id',p_anchor),p_occurred_at,payload)
 ON CONFLICT(event_key) DO NOTHING RETURNING id INTO event_id;
 -- Never attach fresh destinations to a historical event with an old payload.
 IF event_id IS NULL THEN RETURN; END IF;
 INSERT INTO public.billing_analytics_deliveries(outbox_id,destination) VALUES(event_id,'posthog');
 IF p_name IN ('trial_started','purchase_completed','payment_completed') AND c.marketing_consent
  AND coalesce((c.acquisition->>'is_internal_test')::boolean,false)=false
  AND coalesce(c.acquisition->>'test_kind','') NOT IN ('field_test','partner') THEN
  INSERT INTO public.billing_analytics_deliveries(outbox_id,destination) VALUES(event_id,'meta');
 END IF;
 IF p_name IN ('purchase_completed','payment_completed') AND e.provider='paypal' THEN
  INSERT INTO public.billing_analytics_deliveries(outbox_id,destination) VALUES(event_id,'customerio');
 END IF;
 IF p_name='purchase_completed' AND c.acquisition->>'funnel_session_id' IS NOT NULL THEN
  INSERT INTO public.billing_analytics_deliveries(outbox_id,destination) VALUES(event_id,'funnel');
 END IF;
END $$;

CREATE OR REPLACE FUNCTION private.capture_trial_activation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.admission_status='active' AND NEW.authorization_succeeded_at IS NOT NULL
  AND (TG_OP='INSERT' OR OLD.authorization_succeeded_at IS NULL OR OLD.admission_status<>'active') THEN
  PERFORM private.capture_trial_analytics(NEW.id,'trial_started',NEW.id::text,NEW.authorization_succeeded_at,
   jsonb_build_object('lifecycle_source',CASE WHEN private.trial_authorization_provenance(NEW.id)->>'authorization_proof_kind'='api_confirmation' THEN 'verified_api_confirmation' ELSE 'verified_activation' END,'value',0,'currency','EUR'));
 END IF;
 RETURN NEW;
END $$;

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
    'cancelAtPeriodEnd',e.cancel_at_period_end,'authorizedAt',e.authorization_succeeded_at,'trialEndAt',e.original_trial_end_at,'taxBehavior',offer->>'taxBehavior')||private.trial_authorization_provenance(e.id);
END;
$$;

-- Preserve the old percentile keys as provider-event-only metrics, explicitly
-- labeled. API confirmation latency is reported in its own clock segment.
CREATE OR REPLACE FUNCTION public.report_paypal_trial_approval_latency(p_since timestamptz DEFAULT clock_timestamp() - interval '90 days') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH frozen AS (
  SELECT a.request_expires_at - interval '72 hours' AS frozen_at,a.authorization_succeeded_at,
   CASE a.authorization_proof_kind WHEN 'api_confirmation' THEN 'server_confirmation' ELSE 'provider_event' END AS clock_kind
  FROM private.paypal_trial_checkout_attempts a
  WHERE a.request_expires_at IS NOT NULL AND a.request_expires_at - interval '72 hours'>=p_since
 ), observed AS (
  SELECT clock_kind,extract(epoch FROM (authorization_succeeded_at-frozen_at))/60 AS minutes
  FROM frozen WHERE authorization_succeeded_at IS NOT NULL
 ), segments AS (
  SELECT clock_kind,jsonb_build_object(
   'count',count(*),'p50Minutes',round((percentile_cont(0.5) WITHIN GROUP(ORDER BY minutes))::numeric,1),
   'p90Minutes',round((percentile_cont(0.9) WITHIN GROUP(ORDER BY minutes))::numeric,1),
   'maxMinutes',round(max(minutes)::numeric,1),'after3h',count(*) FILTER(WHERE minutes>180),
   'after6h',count(*) FILTER(WHERE minutes>360)) AS metrics
  FROM observed GROUP BY clock_kind
 ), approved AS (SELECT minutes FROM observed WHERE clock_kind='provider_event')
 SELECT jsonb_build_object('since',p_since,'frozen',(SELECT count(*) FROM frozen),
  'clockKind','provider_event','approved',(SELECT count(*) FROM approved),
  'p50Minutes',(SELECT round((percentile_cont(0.5) WITHIN GROUP(ORDER BY minutes))::numeric,1) FROM approved),
  'p90Minutes',(SELECT round((percentile_cont(0.9) WITHIN GROUP(ORDER BY minutes))::numeric,1) FROM approved),
  'maxMinutes',(SELECT round(max(minutes)::numeric,1) FROM approved),
  'approvedAfter3h',(SELECT count(*) FROM approved WHERE minutes>180),
  'approvedAfter6h',(SELECT count(*) FROM approved WHERE minutes>360),
  'byClockKind',coalesce((SELECT jsonb_object_agg(clock_kind,metrics) FROM segments),'{}'::jsonb))
$$;
