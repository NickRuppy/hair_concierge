-- Supabase owns Slack delivery. pg_net starts HTTP after commit; this transaction never waits on Slack.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE private.slack_growth_edge_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.slack_growth_edge_config(singleton) VALUES (true);
CREATE TABLE private.slack_growth_edge_leases (
  delivery_id uuid PRIMARY KEY REFERENCES public.billing_analytics_deliveries(id) ON DELETE CASCADE,
  wake_until timestamptz,
  claim_token uuid,
  previous_status text,
  previous_next_attempt_at timestamptz
);
ALTER TABLE private.slack_growth_edge_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.slack_growth_edge_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.slack_growth_edge_config,private.slack_growth_edge_leases FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,UPDATE ON private.slack_growth_edge_config TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.slack_growth_edge_leases TO service_role;

CREATE FUNCTION private.slack_growth_edge_eligible(p_outbox_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.billing_analytics_outbox e
    JOIN private.slack_growth_notification_state s ON s.singleton AND s.enabled
    JOIN private.slack_growth_edge_config c ON c.singleton AND c.enabled
    WHERE e.id=p_outbox_id AND e.occurred_at>=s.enabled_at
      AND private.is_slack_growth_billing_event(e)
  )
$$;

-- Only this narrowly scoped definer reads Vault or invokes pg_net. The URL and body are fixed.
CREATE FUNCTION private.wake_slack_growth_delivery(p_delivery_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.billing_analytics_deliveries; lease private.slack_growth_edge_leases; dispatch_token text;
BEGIN
  SELECT * INTO d FROM public.billing_analytics_deliveries WHERE id=p_delivery_id AND destination='slack' FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR NOT private.slack_growth_edge_eligible(d.outbox_id) OR d.attempts>=5
    OR NOT ((d.status IN ('pending','failed') AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=clock_timestamp()))
      OR (d.status='processing' AND coalesce(d.processing_started_at,d.updated_at)<=clock_timestamp()-interval '15 minutes'))
    THEN RETURN false; END IF;
  INSERT INTO private.slack_growth_edge_leases(delivery_id) VALUES(d.id) ON CONFLICT DO NOTHING;
  SELECT * INTO lease FROM private.slack_growth_edge_leases WHERE delivery_id=d.id FOR UPDATE;
  IF lease.wake_until>clock_timestamp() THEN RETURN false; END IF;
  SELECT decrypted_secret INTO dispatch_token FROM vault.decrypted_secrets WHERE name='slack_growth_dispatch_token';
  IF dispatch_token IS NULL OR length(dispatch_token)<16 THEN RETURN false; END IF;
  UPDATE private.slack_growth_edge_leases SET wake_until=clock_timestamp()+interval '60 seconds' WHERE delivery_id=d.id;
  PERFORM net.http_post(
    url:='https://pqdkhefxsxkyeqelqegq.supabase.co/functions/v1/slack-growth',
    body:=jsonb_build_object('delivery_id',d.id),
    headers:=jsonb_build_object('Content-Type','application/json','x-slack-growth-token',dispatch_token),
    timeout_milliseconds:=10000
  );
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Includes rollback of wake lease so a later sweep can recover. Never expose Vault/network details.
  RAISE WARNING 'Slack growth webhook wake failed; database sweep will retry';
  RETURN false;
END $$;

CREATE FUNCTION private.wake_inserted_slack_growth_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.destination='slack' AND coalesce(current_setting('app.slack_growth_defer_wake',true),'')<>'on' THEN
    PERFORM private.wake_slack_growth_delivery(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Slack growth webhook wake failed; database sweep will retry';
  RETURN NEW;
END $$;
CREATE TRIGGER wake_inserted_slack_growth_delivery AFTER INSERT ON public.billing_analytics_deliveries
  FOR EACH ROW EXECUTE FUNCTION private.wake_inserted_slack_growth_delivery();

CREATE FUNCTION public.claim_slack_growth_delivery(p_delivery_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d public.billing_analytics_deliveries; claim_token uuid; e public.billing_analytics_outbox; profile jsonb;
BEGIN
  SELECT * INTO d FROM public.billing_analytics_deliveries WHERE id=p_delivery_id AND destination='slack' FOR UPDATE;
  IF NOT FOUND OR NOT private.slack_growth_edge_eligible(d.outbox_id)
    OR NOT ((d.status IN ('pending','failed') AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=clock_timestamp()))
      OR (d.status='processing' AND coalesce(d.processing_started_at,d.updated_at)<=clock_timestamp()-interval '15 minutes'))
    THEN RETURN NULL; END IF;
  IF d.attempts>=5 THEN
    UPDATE public.billing_analytics_deliveries SET status='failed_permanent',processing_started_at=NULL,next_attempt_at=NULL,
      last_error='slack_attempt_limit_reached',updated_at=clock_timestamp() WHERE id=d.id;
    DELETE FROM private.slack_growth_edge_leases WHERE delivery_id=d.id;
    RETURN NULL;
  END IF;
  claim_token:=gen_random_uuid();
  INSERT INTO private.slack_growth_edge_leases(delivery_id,claim_token,previous_status,previous_next_attempt_at)
    VALUES(d.id,claim_token,CASE WHEN d.status='processing' THEN 'pending' ELSE d.status END,d.next_attempt_at)
    ON CONFLICT(delivery_id) DO UPDATE SET claim_token=EXCLUDED.claim_token,
      previous_status=EXCLUDED.previous_status,previous_next_attempt_at=EXCLUDED.previous_next_attempt_at;
  UPDATE public.billing_analytics_deliveries SET status='processing',attempts=attempts+1,
    processing_started_at=clock_timestamp(),next_attempt_at=NULL,updated_at=clock_timestamp() WHERE id=d.id;
  SELECT * INTO e FROM public.billing_analytics_outbox WHERE id=d.outbox_id;
  SELECT jsonb_build_object('full_name',p.full_name,'email',p.email) INTO profile FROM public.profiles p WHERE p.id=e.user_id;
  RETURN jsonb_build_object('token',claim_token,'event',to_jsonb(e),'profile',profile);
END $$;

CREATE FUNCTION public.check_slack_growth_claim(p_delivery_id uuid,p_token uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.billing_analytics_deliveries d
    JOIN private.slack_growth_edge_leases l ON l.delivery_id=d.id AND l.claim_token=p_token
    WHERE d.id=p_delivery_id AND d.destination='slack' AND d.status='processing'
      AND d.processing_started_at>statement_timestamp()-interval '15 minutes'
      AND private.slack_growth_edge_eligible(d.outbox_id)
  )
$$;

CREATE FUNCTION public.complete_slack_growth_delivery(
  p_delivery_id uuid,p_token uuid,p_outcome text,p_error text DEFAULT NULL,p_retry_after_seconds integer DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d public.billing_analytics_deliveries; lease private.slack_growth_edge_leases; safe_error text; terminal boolean;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('delivered','retry','permanent','skipped','paused') THEN
    RAISE EXCEPTION 'invalid Slack completion outcome';
  END IF;
  SELECT * INTO d FROM public.billing_analytics_deliveries WHERE id=p_delivery_id AND destination='slack' FOR UPDATE;
  IF NOT FOUND OR d.status<>'processing' THEN RETURN false; END IF;
  SELECT * INTO lease FROM private.slack_growth_edge_leases WHERE delivery_id=d.id FOR UPDATE;
  IF NOT FOUND OR p_token IS NULL OR lease.claim_token IS DISTINCT FROM p_token THEN RETURN false; END IF;
  safe_error:=CASE WHEN p_error IN ('slack_delivery_failed','slack_rate_limited','slack_temporarily_unavailable',
    'slack_rejected_notification','slack_webhook_configuration_invalid','slack_invalid_growth_event','slack_invalid_event_timestamp')
    THEN p_error ELSE 'slack_delivery_failed' END;
  IF p_outcome='paused' THEN
    UPDATE public.billing_analytics_deliveries SET status=coalesce(lease.previous_status,'pending'),
      attempts=greatest(0,attempts-1),processing_started_at=NULL,next_attempt_at=lease.previous_next_attempt_at,
      updated_at=clock_timestamp() WHERE id=d.id;
  ELSIF p_outcome='delivered' THEN
    UPDATE public.billing_analytics_deliveries SET status='delivered',delivered_at=clock_timestamp(),
      processing_started_at=NULL,next_attempt_at=NULL,last_error=NULL,updated_at=clock_timestamp() WHERE id=d.id;
  ELSE
    terminal:=p_outcome IN ('permanent','skipped') OR d.attempts>=5;
    UPDATE public.billing_analytics_deliveries SET status=CASE WHEN p_outcome='skipped' THEN 'skipped' WHEN terminal THEN 'failed_permanent' ELSE 'failed' END,
      processing_started_at=NULL,last_error=safe_error,
      next_attempt_at=CASE WHEN terminal THEN NULL ELSE clock_timestamp()+
        CASE WHEN p_retry_after_seconds IS NOT NULL THEN make_interval(secs=>greatest(1,least(3600,p_retry_after_seconds)))
          ELSE make_interval(mins=>least(60,d.attempts*d.attempts)) END END,
      updated_at=clock_timestamp() WHERE id=d.id;
  END IF;
  DELETE FROM private.slack_growth_edge_leases WHERE delivery_id=d.id;
  RETURN true;
END $$;

-- Database-only while idle. Reconciliation creates at most100 rows; only25 due rows wake per sweep.
CREATE FUNCTION public.sweep_slack_growth_deliveries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate record; woken integer:=0; previous_defer text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.slack_growth_edge_config WHERE singleton AND enabled)
    OR NOT EXISTS(SELECT 1 FROM private.slack_growth_notification_state WHERE singleton AND enabled)
    THEN RETURN 0; END IF;
  previous_defer:=coalesce(current_setting('app.slack_growth_defer_wake',true),'');
  PERFORM set_config('app.slack_growth_defer_wake','on',true);
  PERFORM public.reconcile_slack_growth_deliveries(100);
  PERFORM set_config('app.slack_growth_defer_wake',previous_defer,true);
  -- Count worker crashes at claim time. A fifth abandoned claim is terminal without another HTTP call.
  WITH exhausted AS (
    UPDATE public.billing_analytics_deliveries SET status='failed_permanent',processing_started_at=NULL,next_attempt_at=NULL,
      last_error='slack_attempt_limit_reached',updated_at=clock_timestamp()
    WHERE destination='slack' AND attempts>=5 AND (status IN ('pending','failed') OR
      (status='processing' AND coalesce(processing_started_at,updated_at)<=clock_timestamp()-interval '15 minutes'))
    RETURNING id
  ) DELETE FROM private.slack_growth_edge_leases l USING exhausted e WHERE l.delivery_id=e.id;
  FOR candidate IN
    SELECT d.id FROM public.billing_analytics_deliveries d
    LEFT JOIN private.slack_growth_edge_leases l ON l.delivery_id=d.id
    WHERE d.destination='slack' AND d.attempts<5
      AND ((d.status IN ('pending','failed') AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=clock_timestamp()))
        OR (d.status='processing' AND coalesce(d.processing_started_at,d.updated_at)<=clock_timestamp()-interval '15 minutes'))
      AND (l.wake_until IS NULL OR l.wake_until<=clock_timestamp())
      AND private.slack_growth_edge_eligible(d.outbox_id)
    ORDER BY d.created_at,d.id LIMIT 25
  LOOP
    IF private.wake_slack_growth_delivery(candidate.id) THEN woken:=woken+1; END IF;
  END LOOP;
  RETURN woken;
END $$;

REVOKE ALL ON FUNCTION private.slack_growth_edge_eligible(uuid),private.wake_slack_growth_delivery(uuid),
  private.wake_inserted_slack_growth_delivery(),public.claim_slack_growth_delivery(uuid),
  public.check_slack_growth_claim(uuid,uuid),public.complete_slack_growth_delivery(uuid,uuid,text,text,integer),
  public.sweep_slack_growth_deliveries() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.slack_growth_edge_eligible(uuid),private.wake_slack_growth_delivery(uuid),
  public.claim_slack_growth_delivery(uuid),public.check_slack_growth_claim(uuid,uuid),
  public.complete_slack_growth_delivery(uuid,uuid,text,text,integer),public.sweep_slack_growth_deliveries() TO service_role;

SELECT cron.schedule('slack-growth-due-deliveries','* * * * *','SELECT public.sweep_slack_growth_deliveries();');
COMMIT;
