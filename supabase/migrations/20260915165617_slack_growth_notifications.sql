-- Operational notifications use canonical billing truth, independent of marketing consent.
-- Disabled until explicitly enabled; the first activation timestamp is never reset on resume.
BEGIN;

ALTER TABLE public.billing_analytics_deliveries
  DROP CONSTRAINT billing_analytics_deliveries_destination_check;
ALTER TABLE public.billing_analytics_deliveries
  ADD CONSTRAINT billing_analytics_deliveries_destination_check
  CHECK (destination IN ('customerio','meta','posthog','funnel','openai','slack')) NOT VALID;
ALTER TABLE public.billing_analytics_deliveries
  VALIDATE CONSTRAINT billing_analytics_deliveries_destination_check;

CREATE TABLE private.slack_growth_notification_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  CHECK (NOT enabled OR enabled_at IS NOT NULL)
);
INSERT INTO private.slack_growth_notification_state(singleton) VALUES (true);
ALTER TABLE private.slack_growth_notification_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.slack_growth_notification_state FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,UPDATE ON TABLE private.slack_growth_notification_state TO service_role;

CREATE FUNCTION public.read_slack_growth_notification_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('enabled',enabled,'enabled_at',enabled_at)
  FROM private.slack_growth_notification_state WHERE singleton
$$;

CREATE FUNCTION public.configure_slack_growth_notifications(p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'enabled must be boolean'; END IF;
  UPDATE private.slack_growth_notification_state
    SET enabled=p_enabled,
        enabled_at=CASE WHEN p_enabled THEN coalesce(enabled_at,clock_timestamp()) ELSE enabled_at END
    WHERE singleton
    RETURNING jsonb_build_object('enabled',enabled,'enabled_at',enabled_at) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION private.is_slack_growth_billing_event(e public.billing_analytics_outbox)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE context private.trial_analytics_contexts;
BEGIN
  IF e.provider NOT IN ('stripe','paypal') OR e.payload IS NULL THEN RETURN false; END IF;
  IF e.event_name='trial_started' THEN
    IF e.payload->'trial_analytics_version' IS DISTINCT FROM '1'::jsonb
      OR e.payload->'value' IS DISTINCT FROM '0'::jsonb
      OR jsonb_typeof(e.payload->'trial_authorized_at') IS DISTINCT FROM 'string'
      OR length(trim(e.payload->>'trial_authorized_at'))=0 THEN RETURN false; END IF;
    BEGIN
      IF NOT isfinite((e.payload->>'trial_authorized_at')::timestamptz) THEN RETURN false; END IF;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
    END;
  ELSIF e.event_name='purchase_completed' THEN
    IF jsonb_typeof(e.payload->'value') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    IF (e.payload->>'value')::numeric<=0
      OR coalesce(e.payload->>'attempt_phase','')='renewal'
      OR (e.payload->'trial_analytics_version'='1'::jsonb
          AND coalesce(e.payload->>'attempt_phase','')<>'first_paid') THEN RETURN false; END IF;
  ELSE RETURN false;
  END IF;

  IF e.payload->'is_internal_test'='true'::jsonb
    OR coalesce(e.payload->>'test_kind','') IN ('field_test','partner') THEN RETURN false; END IF;
  SELECT * INTO context FROM private.trial_analytics_contexts
    WHERE enrollment_id=CASE WHEN e.payload->>'trial_enrollment_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (e.payload->>'trial_enrollment_id')::uuid ELSE NULL END;
  IF context.acquisition->'is_internal_test'='true'::jsonb
    OR coalesce(context.acquisition->>'test_kind','') IN ('field_test','partner') THEN RETURN false; END IF;
  -- Missing/unknown attribution is permitted; only known canonical tests are excluded.
  IF EXISTS (
    SELECT 1 FROM public.funnel_sessions f
    WHERE f.id IN (
      CASE WHEN e.payload->>'funnel_session_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (e.payload->>'funnel_session_id')::uuid ELSE NULL END,
      CASE WHEN context.acquisition->>'funnel_session_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (context.acquisition->>'funnel_session_id')::uuid ELSE NULL END)
      AND (f.is_internal_test OR f.test_kind IN ('field_test','partner'))
  ) THEN RETURN false; END IF;
  RETURN true;
END $$;

-- Preserve all existing destination branches; Slack has its own operational eligibility.
CREATE OR REPLACE FUNCTION private.guard_trial_analytics_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.billing_analytics_outbox; c private.trial_analytics_contexts;
BEGIN
 SELECT * INTO e FROM public.billing_analytics_outbox WHERE id=NEW.outbox_id;
 IF NEW.destination='slack' THEN
  IF EXISTS (SELECT 1 FROM private.slack_growth_notification_state s
    WHERE s.singleton AND s.enabled AND e.occurred_at>=s.enabled_at)
    AND private.is_slack_growth_billing_event(e) THEN RETURN NEW; END IF;
  RETURN NULL;
 END IF;
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

CREATE FUNCTION private.capture_slack_growth_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.slack_growth_notification_state s
    WHERE s.singleton AND s.enabled AND NEW.occurred_at>=s.enabled_at)
    AND private.is_slack_growth_billing_event(NEW) THEN
    INSERT INTO public.billing_analytics_deliveries(outbox_id,destination)
      VALUES(NEW.id,'slack') ON CONFLICT(outbox_id,destination) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No exception details: they can include billing payload or customer identity.
  -- The scheduled reconcile RPC repairs missed rows after the original activation cutoff.
  RAISE WARNING 'Slack growth delivery could not be queued; reconciliation required';
  RETURN NEW;
END $$;
CREATE TRIGGER capture_slack_growth_delivery AFTER INSERT ON public.billing_analytics_outbox
  FOR EACH ROW EXECUTE FUNCTION private.capture_slack_growth_delivery();

CREATE FUNCTION public.reconcile_slack_growth_deliveries(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE inserted integer;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000';
  END IF;
  INSERT INTO public.billing_analytics_deliveries(outbox_id,destination)
    SELECT e.id,'slack'
    FROM public.billing_analytics_outbox e
    JOIN private.slack_growth_notification_state s ON s.singleton AND s.enabled
    WHERE e.occurred_at>=s.enabled_at
      AND e.event_name IN ('trial_started','purchase_completed')
      AND NOT EXISTS (SELECT 1 FROM public.billing_analytics_deliveries d WHERE d.outbox_id=e.id AND d.destination='slack')
      AND private.is_slack_growth_billing_event(e)
    ORDER BY e.occurred_at,e.id LIMIT p_limit
    ON CONFLICT(outbox_id,destination) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN inserted;
END $$;

REVOKE ALL ON FUNCTION public.read_slack_growth_notification_state(),public.configure_slack_growth_notifications(boolean),
  public.reconcile_slack_growth_deliveries(integer),private.is_slack_growth_billing_event(public.billing_analytics_outbox),
  private.capture_slack_growth_delivery() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_slack_growth_notification_state(),public.configure_slack_growth_notifications(boolean),
  public.reconcile_slack_growth_deliveries(integer),private.is_slack_growth_billing_event(public.billing_analytics_outbox),
  private.capture_slack_growth_delivery() TO service_role;
COMMIT;
