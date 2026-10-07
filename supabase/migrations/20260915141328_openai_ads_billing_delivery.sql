-- New destinations apply only to fresh canonical events; never backfill historical events.
BEGIN;
ALTER TABLE public.billing_analytics_deliveries DROP CONSTRAINT billing_analytics_deliveries_destination_check;
ALTER TABLE public.billing_analytics_deliveries ADD CONSTRAINT billing_analytics_deliveries_destination_check
 CHECK(destination IN ('customerio','meta','posthog','funnel','openai')) NOT VALID;
ALTER TABLE public.billing_analytics_deliveries VALIDATE CONSTRAINT billing_analytics_deliveries_destination_check;
ALTER TABLE public.billing_analytics_deliveries DROP CONSTRAINT billing_analytics_deliveries_status_check;
ALTER TABLE public.billing_analytics_deliveries ADD CONSTRAINT billing_analytics_deliveries_status_check
 CHECK(status IN ('pending','processing','delivered','failed','failed_permanent','skipped')) NOT VALID;
ALTER TABLE public.billing_analytics_deliveries VALIDATE CONSTRAINT billing_analytics_deliveries_status_check;

CREATE FUNCTION private.is_openai_ads_billing_event(e public.billing_analytics_outbox)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(
  e.payload->'is_internal_test' IS DISTINCT FROM 'true'::jsonb
  AND coalesce(e.payload->>'test_kind','') NOT IN ('field_test','partner')
  AND jsonb_typeof(e.payload->'funnel_session_id')='string'
  AND (e.payload->>'funnel_session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND ((e.event_name='trial_started' AND e.payload->'trial_analytics_version'='1'::jsonb
        AND e.payload->'value'='0'::jsonb AND jsonb_typeof(e.payload->'trial_authorized_at')='string')
    OR (e.event_name='purchase_completed' AND coalesce(e.payload->>'attempt_phase','')<>'renewal'
        AND (e.payload->'trial_analytics_version' IS DISTINCT FROM '1'::jsonb
             OR e.payload->>'attempt_phase'='first_paid'))),false)
$$;
REVOKE ALL ON FUNCTION private.is_openai_ads_billing_event(public.billing_analytics_outbox) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.is_openai_ads_billing_event(public.billing_analytics_outbox) TO service_role;

CREATE OR REPLACE FUNCTION private.guard_trial_analytics_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.billing_analytics_outbox; c private.trial_analytics_contexts;
BEGIN
 SELECT * INTO e FROM public.billing_analytics_outbox WHERE id=NEW.outbox_id;
 IF NEW.destination='openai' THEN
  IF private.is_openai_ads_billing_event(e) THEN RETURN NEW; END IF;
  RETURN NULL;
 END IF;
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

-- Covers SQL trial triggers and JS producers at their common atomic insert boundary.
CREATE FUNCTION private.capture_openai_ads_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF private.is_openai_ads_billing_event(NEW) THEN
  INSERT INTO public.billing_analytics_deliveries(outbox_id,destination)
  VALUES(NEW.id,'openai') ON CONFLICT(outbox_id,destination) DO NOTHING;
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- Optional advertising bookkeeping must never roll back a successful billing event.
 RAISE WARNING 'OpenAI advertising delivery could not be queued';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.capture_openai_ads_delivery() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.capture_openai_ads_delivery() TO service_role;
CREATE TRIGGER capture_openai_ads_delivery AFTER INSERT ON public.billing_analytics_outbox
 FOR EACH ROW EXECUTE FUNCTION private.capture_openai_ads_delivery();
COMMIT;
