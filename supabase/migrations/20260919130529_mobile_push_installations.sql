-- APNs device addresses are private operational data. They are never exposed
-- through the Data API; the authenticated mobile API uses the service role.
CREATE TABLE private.mobile_push_installations (
  installation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  apns_token text NOT NULL UNIQUE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  topic text NOT NULL,
  binding_version uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_expires_at timestamptz NOT NULL
);
CREATE INDEX mobile_push_installations_owner_lease
  ON private.mobile_push_installations(user_id, lease_expires_at DESC);
ALTER TABLE private.mobile_push_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mobile_push_installations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.mobile_push_installations TO service_role;

-- The token is the continuity key: APNs can rotate it and the same device can
-- subsequently sign into another account. Serialize both identities so a
-- rebind cannot leave duplicate addresses or a stale owner behind.
CREATE FUNCTION public.mobile_push_installation_register(
  p_user_id uuid,
  p_installation_id uuid,
  p_apns_token text,
  p_environment text,
  p_topic text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_installation_id IS NULL
    OR p_apns_token IS NULL OR p_apns_token !~ '^[0-9a-f]+$'
    OR p_environment NOT IN ('sandbox', 'production')
    OR p_topic IS NULL OR p_topic = '' THEN
    RAISE EXCEPTION 'invalid_push_installation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-push-token:' || p_apns_token, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-push-installation:' || p_installation_id::text, 0));

  -- A stable installation UUID can survive both a token rotation and an
  -- account switch. Remove its obsolete address before rebinding the new
  -- address, while the installation lock prevents a split registration.
  DELETE FROM private.mobile_push_installations
    WHERE installation_id = p_installation_id AND apns_token <> p_apns_token;

  INSERT INTO private.mobile_push_installations(
    installation_id, user_id, apns_token, environment, topic, lease_expires_at
  ) VALUES (
    p_installation_id, p_user_id, p_apns_token, p_environment, p_topic,
    clock_timestamp() + interval '90 days'
  ) ON CONFLICT (apns_token) DO UPDATE
    SET installation_id = EXCLUDED.installation_id,
        user_id = EXCLUDED.user_id,
        environment = EXCLUDED.environment,
        topic = EXCLUDED.topic,
        binding_version = gen_random_uuid(),
        last_seen_at = clock_timestamp(),
        lease_expires_at = clock_timestamp() + interval '90 days';
  RETURN true;
END $$;

CREATE FUNCTION public.mobile_push_installation_revoke(
  p_user_id uuid,
  p_installation_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_installation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_push_installation';
  END IF;
  DELETE FROM private.mobile_push_installations
    WHERE user_id = p_user_id AND installation_id = p_installation_id;
  -- Idempotent by design: a local logout may be retried after token rotation.
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.mobile_push_installation_register(uuid, uuid, text, text, text),
  public.mobile_push_installation_revoke(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_push_installation_register(uuid, uuid, text, text, text),
  public.mobile_push_installation_revoke(uuid, uuid) TO service_role;
