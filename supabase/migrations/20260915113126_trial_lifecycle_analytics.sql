-- Atomic analytics facts. No provider HTTP calls or entitlement decisions occur here.
CREATE TABLE private.trial_analytics_contexts (
 enrollment_id uuid PRIMARY KEY REFERENCES public.trial_enrollments(id) ON DELETE CASCADE,
 acquisition jsonb NOT NULL,
 marketing_consent boolean NOT NULL DEFAULT false,
 meta_context jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(marketing_consent OR meta_context='{}'::jsonb)
);
ALTER TABLE private.trial_analytics_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_analytics_contexts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.trial_analytics_contexts TO service_role;
CREATE FUNCTION private.protect_trial_analytics_context() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Original trial analytics context is immutable'; END $$;
CREATE TRIGGER trial_analytics_context_immutable BEFORE UPDATE ON private.trial_analytics_contexts
 FOR EACH ROW EXECUTE FUNCTION private.protect_trial_analytics_context();

-- Called by the server before provider creation. Frozen predecessors recover only
-- their exact original source, never the current browser's acquisition or consent.
CREATE FUNCTION public.freeze_trial_analytics_context(p_enrollment_id uuid,p_session_id uuid,p_meta jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments; snapshot jsonb; matching jsonb:='{}';
 historical boolean:=false; consent boolean:=false; session_id uuid; original text; params jsonb;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trial analytics enrollment missing'; END IF;
 IF EXISTS(SELECT 1 FROM private.trial_analytics_contexts WHERE enrollment_id=e.id) THEN RETURN; END IF;
 session_id:=p_session_id;
 IF e.provider='stripe' THEN
  SELECT stripe_params INTO params FROM public.trial_checkout_attempts WHERE enrollment_id=e.id;
  IF FOUND AND params IS NOT NULL THEN historical:=true; original:=params->'metadata'->>'funnel_session_id'; END IF;
 ELSE
  SELECT i.metadata,a.request_id IS NOT NULL INTO params,historical
   FROM private.paypal_trial_checkout_attempts a JOIN public.paypal_checkout_intents i ON i.id=a.intent_id WHERE a.enrollment_id=e.id;
  IF historical THEN original:=params->>'funnel_session_id'; END IF;
 END IF;
 historical:=coalesce(historical,false) OR e.authorization_succeeded_at IS NOT NULL;
 IF historical THEN
  session_id:=CASE WHEN original ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN original::uuid ELSE NULL END;
 END IF;
 SELECT jsonb_build_object('funnel_session_id',f.id,'funnel_package_key',f.package_key,
  'landing_variant',f.landing_variant,'quiz_variant',f.quiz_variant,'offer_variant',f.offer_variant,
  'is_internal_test',f.is_internal_test,'test_kind',f.test_kind,'funnel_attribution_status','resolved') INTO snapshot
  FROM public.funnel_sessions f WHERE f.id=session_id;
 IF snapshot IS NULL THEN snapshot:=jsonb_build_object('funnel_attribution_status','missing','funnel_attribution_issue','original_session_unavailable'); END IF;
 consent:=NOT historical AND p_meta->'marketing_consent'='true'::jsonb;
 IF coalesce(consent,false) THEN
  matching:=jsonb_strip_nulls(jsonb_build_object(
   'fbp',CASE WHEN length(p_meta->>'fbp')<=512 AND p_meta->>'fbp' ~ '^fb\.1\.[0-9]{10,16}\.[0-9]+$' THEN p_meta->>'fbp' END,
   'fbc',CASE WHEN length(p_meta->>'fbc')<=512 AND p_meta->>'fbc' ~ '^fb\.1\.[0-9]{10,16}\.[A-Za-z0-9._~-]+$' THEN p_meta->>'fbc' END,
   'client_user_agent',CASE WHEN length(p_meta->>'client_user_agent') BETWEEN 1 AND 1024 THEN p_meta->>'client_user_agent' END));
 END IF;
 INSERT INTO private.trial_analytics_contexts(enrollment_id,acquisition,marketing_consent,meta_context)
 VALUES(e.id,snapshot,coalesce(consent,false),matching);
 -- PayPal's original intent must have acquisition before its provider request too.
 IF e.provider='paypal' AND NOT historical AND snapshot->>'funnel_session_id' IS NOT NULL THEN
  UPDATE public.paypal_checkout_intents SET metadata=metadata||jsonb_build_object(
   'funnel_session_id',snapshot->'funnel_session_id','funnel_package_key',snapshot->'funnel_package_key')
  WHERE id IN (SELECT intent_id FROM private.paypal_trial_checkout_attempts WHERE enrollment_id=e.id);
 END IF;
END $$;
CREATE FUNCTION public.read_trial_analytics_meta_context(p_enrollment_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN marketing_consent THEN meta_context||jsonb_build_object('marketing_consent',true) ELSE jsonb_build_object('marketing_consent',false) END
 FROM private.trial_analytics_contexts WHERE enrollment_id=p_enrollment_id;
$$;

ALTER TABLE public.billing_analytics_outbox DROP CONSTRAINT billing_analytics_outbox_event_name_check;
ALTER TABLE public.billing_analytics_outbox ADD CONSTRAINT billing_analytics_outbox_event_name_check CHECK(event_name IN (
 'trial_started','trial_cancellation_requested','trial_cancellation_confirmed','trial_cancellation_restored',
 'trial_cancellation_observed','trial_first_payment_failed','purchase_completed','payment_completed',
 'subscription_started','subscription_updated','subscription_cancelled','subscription_expired','payment_failed','refund_completed')) NOT VALID;
ALTER TABLE public.billing_analytics_outbox VALIDATE CONSTRAINT billing_analytics_outbox_event_name_check;

GRANT SELECT,INSERT ON public.billing_analytics_outbox,public.billing_analytics_deliveries TO service_role;

CREATE FUNCTION private.capture_trial_analytics(p_enrollment_id uuid,p_name text,p_anchor text,p_occurred_at timestamptz,p_properties jsonb DEFAULT '{}')
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
  'cancel_at_period_end',e.cancel_at_period_end)||p_properties;
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

CREATE FUNCTION private.capture_trial_activation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.admission_status='active' AND NEW.authorization_succeeded_at IS NOT NULL
  AND (TG_OP='INSERT' OR OLD.authorization_succeeded_at IS NULL OR OLD.admission_status<>'active') THEN
  PERFORM private.capture_trial_analytics(NEW.id,'trial_started',NEW.id::text,NEW.authorization_succeeded_at,
   jsonb_build_object('lifecycle_source','verified_activation','value',0,'currency','EUR'));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_trial_activation AFTER INSERT OR UPDATE ON public.trial_enrollments
 FOR EACH ROW EXECUTE FUNCTION private.capture_trial_activation();

ALTER TABLE private.trial_payment_events ADD COLUMN attempt_phase text CHECK(attempt_phase IN ('first_paid','renewal'));
COMMENT ON COLUMN private.trial_payment_events.attempt_phase IS 'Frozen on first transition into applied. Historical unclassified failures stay NULL.';
CREATE FUNCTION private.classify_trial_payment_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE first_paid timestamptz;
BEGIN
 IF TG_OP='UPDATE' AND OLD.result='applied' THEN NEW.attempt_phase:=OLD.attempt_phase; RETURN NEW; END IF;
 IF NEW.result='applied' THEN
  IF NEW.outcome='succeeded' THEN NEW.attempt_phase:=nullif(NEW.phase,'none');
  ELSE
   SELECT first_payment_succeeded_at INTO first_paid FROM public.trial_enrollments WHERE id=NEW.enrollment_id FOR UPDATE;
   NEW.attempt_phase:=CASE WHEN first_paid IS NULL THEN 'first_paid' ELSE 'renewal' END;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER classify_trial_payment_attempt BEFORE INSERT OR UPDATE ON private.trial_payment_events
 FOR EACH ROW EXECUTE FUNCTION private.classify_trial_payment_attempt();
CREATE FUNCTION private.capture_trial_payment() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE name text; anchor text; agreement text; recovered boolean;
BEGIN
 IF NEW.result<>'applied' OR (TG_OP='UPDATE' AND OLD.result='applied') THEN RETURN NEW; END IF;
 IF NEW.outcome='failed' THEN
  IF NEW.attempt_phase<>'first_paid' OR NEW.attempt_phase IS NULL THEN RETURN NEW; END IF;
  name:='trial_first_payment_failed';anchor:=NEW.source_object_id;
 ELSE
  name:=CASE WHEN NEW.phase='first_paid' THEN 'purchase_completed' WHEN NEW.phase='renewal' THEN 'payment_completed' END;
  IF name IS NULL THEN RETURN NEW; END IF;
  agreement:=public.read_trial_effective_contract(NEW.enrollment_id)->>'provider_agreement_id';
  anchor:=CASE WHEN NEW.provider='paypal' AND NEW.phase='first_paid' THEN agreement ELSE NEW.source_object_id END;
 END IF;
 SELECT EXISTS(SELECT 1 FROM private.trial_payment_events WHERE enrollment_id=NEW.enrollment_id
  AND outcome='failed' AND result='applied' AND attempt_phase='first_paid') INTO recovered;
 PERFORM private.capture_trial_analytics(NEW.enrollment_id,name,anchor,NEW.occurred_at,
  jsonb_build_object('lifecycle_source','verified_payment_ledger','source_event_id',NEW.source_event_id,
   'payment_source_object_id',NEW.source_object_id,'attempt_phase',NEW.attempt_phase,
   'value',CASE WHEN NEW.outcome='succeeded' THEN NEW.amount_minor/100.0 ELSE 0 END,
   'currency',NEW.currency,'first_payment_recovered',NEW.phase='first_paid' AND recovered,
   'meta_event_id',NEW.source_object_id,'checkout_reference',coalesce(agreement,NEW.source_object_id),'subscription_status','active'));
 RETURN NEW;
END $$;
CREATE TRIGGER capture_trial_payment AFTER INSERT OR UPDATE ON private.trial_payment_events
 FOR EACH ROW EXECUTE FUNCTION private.capture_trial_payment();

CREATE FUNCTION private.capture_trial_cancellation_declaration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM private.capture_trial_analytics(NEW.enrollment_id,'trial_cancellation_requested',NEW.id::text,NEW.submitted_at,
  jsonb_build_object('lifecycle_source','customer_declaration','cancellation_declaration_id',NEW.id,'effective_end_at',NEW.effective_end_at));
 RETURN NEW;
END $$;
CREATE TRIGGER capture_trial_cancellation_declaration AFTER INSERT ON private.trial_cancellation_declarations
 FOR EACH ROW EXECUTE FUNCTION private.capture_trial_cancellation_declaration();
CREATE FUNCTION private.capture_trial_cancellation_confirmation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d private.trial_cancellation_declarations;
BEGIN
 IF NEW.status='confirmed' AND (TG_OP='INSERT' OR OLD.status<>'confirmed') THEN
  SELECT * INTO d FROM private.trial_cancellation_declarations WHERE id=NEW.declaration_id;
  PERFORM private.capture_trial_analytics(d.enrollment_id,'trial_cancellation_confirmed',d.id::text,NEW.reconciled_at,
   jsonb_build_object('lifecycle_source','provider_confirmation','cancellation_declaration_id',d.id,'effective_end_at',d.effective_end_at));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_trial_cancellation_confirmation AFTER INSERT OR UPDATE ON private.trial_cancellation_provider_operations
 FOR EACH ROW EXECUTE FUNCTION private.capture_trial_cancellation_confirmation();
CREATE FUNCTION private.capture_trial_restore() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.kind='restore' AND NEW.status='committed' AND OLD.status<>'committed' THEN
  PERFORM private.capture_trial_analytics(NEW.enrollment_id,'trial_cancellation_restored',NEW.id::text,NEW.completed_at,
   jsonb_build_object('lifecycle_source','committed_restore','management_operation_id',NEW.id));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_trial_restore AFTER UPDATE ON private.trial_management_operations
 FOR EACH ROW EXECUTE FUNCTION private.capture_trial_restore();

-- Provider-only observations are captured at the guarded RPC seams, not from a
-- generic cancellation-boolean trigger (declarations also write that boolean).
CREATE FUNCTION private.capture_trial_provider_cancellation(p_enrollment_id uuid,p_agreement_id text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE version bigint;
BEGIN
 SELECT cancellation_version INTO version FROM private.trial_management_state WHERE enrollment_id=p_enrollment_id;
 PERFORM private.capture_trial_analytics(p_enrollment_id,'trial_cancellation_observed',
  p_enrollment_id::text||':'||p_agreement_id||':'||coalesce(version,0)::text,clock_timestamp(),
  jsonb_build_object('lifecycle_source','provider_observation','observed_agreement_id',p_agreement_id));
END $$;

CREATE OR REPLACE FUNCTION public.confirm_stripe_trial_cancellation(
 p_enrollment_id uuid,p_agreement_id text,p_customer_id text,p_user_id uuid,
 p_expected_revision integer,p_expected_cancellation_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE; fence jsonb;
BEGIN
 -- Match the management commit/declaration lock order.
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id FOR UPDATE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM p_expected_revision
  OR s.cancellation_version IS DISTINCT FROM p_expected_cancellation_version THEN RETURN NULL; END IF;
 fence:=public.read_stripe_trial_cancellation_fence(e.id,p_agreement_id,p_customer_id,p_user_id);
 IF fence IS NULL THEN RETURN NULL; END IF;
 -- Never clear a declaration. The existing trigger advances cancellation_version.
 UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id
  RETURNING * INTO e;
 PERFORM private.capture_trial_provider_cancellation(e.id,p_agreement_id);
 RETURN to_jsonb(e);
END;
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
 PERFORM private.capture_trial_provider_cancellation(e.id,p_agreement_id);
 RETURN true;
END $$;


REVOKE ALL ON FUNCTION private.protect_trial_analytics_context(),
 public.freeze_trial_analytics_context(uuid,uuid,jsonb),
 public.read_trial_analytics_meta_context(uuid),
 private.capture_trial_analytics(uuid,text,text,timestamptz,jsonb),
 private.capture_trial_activation(),
 private.classify_trial_payment_attempt(),
 private.capture_trial_payment(),
 private.capture_trial_cancellation_declaration(),
 private.capture_trial_cancellation_confirmation(),
 private.capture_trial_restore(),
 private.capture_trial_provider_cancellation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_trial_analytics_context(),
 public.freeze_trial_analytics_context(uuid,uuid,jsonb),
 public.read_trial_analytics_meta_context(uuid),
 private.capture_trial_analytics(uuid,text,text,timestamptz,jsonb),
 private.capture_trial_activation(),
 private.classify_trial_payment_attempt(),
 private.capture_trial_payment(),
 private.capture_trial_cancellation_declaration(),
 private.capture_trial_cancellation_confirmation(),
 private.capture_trial_restore(),
 private.capture_trial_provider_cancellation(uuid,text) TO service_role;

-- During migration-first rollout an older webhook can find the new atomic
-- event and try to add its legacy default destinations. Skip forbidden rows
-- without aborting billing or losing the already-recorded PostHog fact.
CREATE FUNCTION private.guard_trial_analytics_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.billing_analytics_outbox; c private.trial_analytics_contexts;
BEGIN
 SELECT * INTO e FROM public.billing_analytics_outbox WHERE id=NEW.outbox_id;
 IF e.payload->'trial_analytics_version' IS DISTINCT FROM '1'::jsonb THEN RETURN NEW; END IF;
 IF NEW.destination='posthog' THEN RETURN NEW; END IF;
 IF e.event_name NOT IN ('trial_started','purchase_completed','payment_completed') THEN RETURN NULL; END IF;
 IF NEW.destination='meta' THEN
  SELECT * INTO c FROM private.trial_analytics_contexts WHERE enrollment_id::text=e.payload->>'trial_enrollment_id';
  IF NOT FOUND OR NOT c.marketing_consent
   OR coalesce((c.acquisition->>'is_internal_test')::boolean,false)
   OR coalesce(c.acquisition->>'test_kind','') IN ('field_test','partner') THEN RETURN NULL; END IF;
  RETURN NEW;
 END IF;
 IF NEW.destination='customerio' AND e.provider='paypal' AND e.event_name IN ('purchase_completed','payment_completed') THEN RETURN NEW; END IF;
 IF NEW.destination='funnel' AND e.event_name='purchase_completed' AND e.payload->>'funnel_session_id' IS NOT NULL THEN RETURN NEW; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER guard_trial_analytics_delivery BEFORE INSERT ON public.billing_analytics_deliveries
 FOR EACH ROW EXECUTE FUNCTION private.guard_trial_analytics_delivery();
REVOKE ALL ON FUNCTION private.guard_trial_analytics_delivery() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_trial_analytics_delivery() TO service_role;
