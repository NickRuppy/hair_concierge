-- Candidate eligibility is checked after approval. Materialization of both
-- independent channels happens in one transaction, but each provider attempt
-- has its own durable lease and receipt. History deletion is irrelevant.
CREATE TABLE private.mobile_research_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.product_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  installation_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'sending', 'queued', 'unknown', 'failed_terminal', 'suppressed'
  )),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  send_attempts integer NOT NULL DEFAULT 0 CHECK (send_attempts >= 0 AND send_attempts <= 5),
  provider_delivery_id text,
  provider_queued_at text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((channel = 'email' AND installation_id IS NULL)
    OR (channel = 'push' AND installation_id IS NOT NULL)),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,80}$')
);
CREATE UNIQUE INDEX mobile_research_delivery_email_once
  ON private.mobile_research_deliveries(submission_id) WHERE channel = 'email';
CREATE UNIQUE INDEX mobile_research_delivery_push_once
  ON private.mobile_research_deliveries(submission_id, installation_id) WHERE channel = 'push';
CREATE INDEX mobile_research_deliveries_due
  ON private.mobile_research_deliveries(channel, next_attempt_at, id)
  WHERE status IN ('pending', 'processing');
ALTER TABLE private.mobile_research_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mobile_research_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.mobile_research_deliveries TO service_role;

CREATE FUNCTION public.materialize_mobile_research_deliveries(
  p_submission_id uuid, p_candidate_lease_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c private.mobile_research_delivery_candidates%ROWTYPE;
BEGIN
  SELECT * INTO c FROM private.mobile_research_delivery_candidates
    WHERE submission_id = p_submission_id AND lease_token = p_candidate_lease_token
      AND lease_until > clock_timestamp() AND state = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO private.mobile_research_deliveries(submission_id, user_id, channel)
    VALUES (c.submission_id, c.user_id, 'email') ON CONFLICT DO NOTHING;
  INSERT INTO private.mobile_research_deliveries(submission_id, user_id, channel, installation_id)
    SELECT c.submission_id, c.user_id, 'push', i.installation_id
    FROM private.mobile_push_installations i
    WHERE i.user_id = c.user_id AND i.lease_expires_at > clock_timestamp()
    ON CONFLICT DO NOTHING;
  UPDATE private.mobile_research_delivery_candidates SET state = 'complete',
    lease_token = NULL, lease_until = NULL, last_error = NULL
    WHERE submission_id = c.submission_id;
  RETURN true;
END $$;

CREATE FUNCTION public.claim_mobile_research_deliveries(
  p_channel text, p_limit integer DEFAULT 5
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF p_channel NOT IN ('email', 'push') OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid mobile delivery claim';
  END IF;
  WITH due AS (
    SELECT d.id FROM private.mobile_research_deliveries d
    WHERE d.channel = p_channel AND d.next_attempt_at <= clock_timestamp()
      AND (d.status = 'pending' OR
        (d.status = 'processing' AND d.lease_until < clock_timestamp()))
    ORDER BY d.next_attempt_at, d.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE private.mobile_research_deliveries d
      SET status = 'processing', lease_token = gen_random_uuid(),
        lease_until = clock_timestamp() + interval '5 minutes', updated_at = clock_timestamp()
      FROM due WHERE d.id = due.id RETURNING d.*
  ) SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_rows FROM claimed d;
  RETURN v_rows;
END $$;

-- A worker calls this immediately before the network request. If it dies after
-- this point, status stays `sending`: automatic claims cannot resend it.
CREATE FUNCTION public.begin_mobile_research_delivery_send(p_delivery_id uuid, p_lease_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE private.mobile_research_deliveries d SET status = 'sending',
    send_attempts = d.send_attempts + 1, updated_at = clock_timestamp()
    WHERE d.id = p_delivery_id AND d.lease_token = p_lease_token
      AND d.lease_until > clock_timestamp() AND d.status = 'processing'
      AND d.send_attempts < 5 RETURNING d.id INTO v_id;
  RETURN v_id IS NOT NULL;
END $$;

-- Private APNs addresses never enter the public Data API. Only the service
-- worker can retrieve one current owner-bound binding for a claimed row.
CREATE FUNCTION public.mobile_research_push_installation(p_user_id uuid, p_installation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('token', i.apns_token, 'environment', i.environment,
    'topic', i.topic, 'bindingVersion', i.binding_version)
  FROM private.mobile_push_installations i
  WHERE i.user_id = p_user_id AND i.installation_id = p_installation_id
    AND i.lease_expires_at > clock_timestamp()
$$;
CREATE FUNCTION public.mobile_research_invalidate_push_token(
  p_user_id uuid, p_installation_id uuid, p_apns_token text, p_binding_version uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  DELETE FROM private.mobile_push_installations i
  WHERE i.user_id = p_user_id AND i.installation_id = p_installation_id
    AND i.apns_token = p_apns_token AND i.binding_version = p_binding_version;
  RETURN FOUND;
END $$;

-- Error codes, never provider bodies or profile data, are persisted. A definite
-- provider refusal may retry up to five sends; an unknown outcome is held.
CREATE FUNCTION public.finish_mobile_research_delivery(
  p_delivery_id uuid, p_lease_token uuid, p_action text,
  p_next_attempt_at timestamptz DEFAULT NULL,
  p_provider_delivery_id text DEFAULT NULL,
  p_provider_queued_at text DEFAULT NULL,
  p_error_code text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE d private.mobile_research_deliveries%ROWTYPE;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('queued','unknown','retry','failed_terminal','suppressed')
    OR (p_action = 'retry' AND (p_next_attempt_at IS NULL OR p_next_attempt_at <= clock_timestamp()))
    OR (p_action <> 'retry' AND p_next_attempt_at IS NOT NULL)
    OR (p_error_code IS NOT NULL AND p_error_code !~ '^[a-z0-9_]{1,80}$')
    OR length(COALESCE(p_provider_delivery_id,'')) > 200
    OR length(COALESCE(p_provider_queued_at,'')) > 80 THEN
    RAISE EXCEPTION 'invalid mobile delivery settlement';
  END IF;
  SELECT * INTO d FROM private.mobile_research_deliveries
    WHERE id = p_delivery_id AND lease_token = p_lease_token
      AND status IN ('processing','sending') FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (d.status = 'processing' AND p_action NOT IN ('retry','suppressed'))
    OR (d.status = 'sending' AND p_action = 'suppressed')
    OR (p_action = 'queued' AND p_provider_delivery_id IS NULL) THEN
    RAISE EXCEPTION 'invalid mobile delivery transition';
  END IF;
  UPDATE private.mobile_research_deliveries SET
    status = CASE WHEN p_action = 'retry' AND d.send_attempts >= 5
      THEN 'failed_terminal' ELSE CASE WHEN p_action = 'retry' THEN 'pending' ELSE p_action END END,
    next_attempt_at = COALESCE(p_next_attempt_at, next_attempt_at),
    lease_token = NULL, lease_until = NULL,
    provider_delivery_id = p_provider_delivery_id,
    provider_queued_at = p_provider_queued_at,
    last_error_code = p_error_code,
    updated_at = clock_timestamp()
    WHERE id = d.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.materialize_mobile_research_deliveries(uuid, uuid),
  public.claim_mobile_research_deliveries(text, integer),
  public.begin_mobile_research_delivery_send(uuid, uuid),
  public.mobile_research_push_installation(uuid, uuid),
  public.mobile_research_invalidate_push_token(uuid, uuid, text, uuid),
  public.finish_mobile_research_delivery(uuid, uuid, text, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_mobile_research_deliveries(uuid, uuid),
  public.claim_mobile_research_deliveries(text, integer),
  public.begin_mobile_research_delivery_send(uuid, uuid),
  public.mobile_research_push_installation(uuid, uuid),
  public.mobile_research_invalidate_push_token(uuid, uuid, text, uuid),
  public.finish_mobile_research_delivery(uuid, uuid, text, timestamptz, text, text, text)
  TO service_role;
