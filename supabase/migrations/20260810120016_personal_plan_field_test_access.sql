-- Service-only field-test campaign access. Raw campaign credentials never persist.
CREATE TABLE IF NOT EXISTS public.personal_plan_test_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  max_activations integer NOT NULL CHECK (max_activations > 0),
  access_duration_hours integer NOT NULL CHECK (access_duration_hours > 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  revoked_at timestamptz,
  CONSTRAINT personal_plan_test_campaigns_time_order CHECK (
    expires_at > starts_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  ),
  CONSTRAINT personal_plan_test_campaigns_revocation_status CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

ALTER TABLE public.funnel_sessions
  ADD COLUMN IF NOT EXISTS test_kind text,
  ADD COLUMN IF NOT EXISTS field_test_campaign_id uuid
    REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT;

ALTER TABLE public.funnel_sessions
  DROP CONSTRAINT IF EXISTS funnel_sessions_field_test_context_check;
ALTER TABLE public.funnel_sessions
  ADD CONSTRAINT funnel_sessions_field_test_context_check CHECK (
    (test_kind IS NULL AND field_test_campaign_id IS NULL)
    OR (test_kind = 'field_test' AND field_test_campaign_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS funnel_sessions_field_test_campaign_lead_idx
  ON public.funnel_sessions (field_test_campaign_id, lead_id)
  WHERE test_kind = 'field_test';

CREATE TABLE IF NOT EXISTS public.personal_plan_test_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id) ON DELETE RESTRICT,
  prepared_artifact_id uuid NOT NULL REFERENCES public.personal_plan_prepared_artifacts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT personal_plan_test_enrollments_campaign_lead_key UNIQUE (campaign_id, lead_id),
  CONSTRAINT personal_plan_test_enrollments_time_order CHECK (
    expires_at > activated_at
    AND (revoked_at IS NULL OR revoked_at >= activated_at)
  ),
  CONSTRAINT personal_plan_test_enrollments_revocation_status CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS personal_plan_test_enrollments_campaign_status_idx
  ON public.personal_plan_test_enrollments (campaign_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS personal_plan_test_enrollments_user_status_idx
  ON public.personal_plan_test_enrollments (user_id, expires_at)
  WHERE status = 'active';

ALTER TABLE public.personal_plan_test_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_test_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_test_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.personal_plan_test_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_plan_test_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_plan_test_enrollments TO service_role;

-- Historic schema grants exposed write privileges even though RLS had no
-- matching policies. Remove the browser-role privilege as a second boundary;
-- tester grants are written only inside the service-role activation RPC.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.manual_access_grants
  FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.activate_personal_plan_field_test(
  p_campaign_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_activation_event_id text
)
RETURNS TABLE (
  enrollment_id uuid,
  manual_access_grant_id uuid,
  prepared_artifact_id uuid,
  activated_at timestamptz,
  expires_at timestamptz,
  reused boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  campaign public.personal_plan_test_campaigns%ROWTYPE;
  existing_enrollment public.personal_plan_test_enrollments%ROWTYPE;
  artifact public.personal_plan_prepared_artifacts%ROWTYPE;
  access_grant public.manual_access_grants%ROWTYPE;
  activation_time timestamptz := pg_catalog.now();
  enrollment_expiry timestamptz;
  active_enrollment_count integer;
BEGIN
  IF p_campaign_id IS NULL OR p_funnel_session_id IS NULL OR p_lead_id IS NULL
     OR p_user_id IS NULL OR p_activation_event_id IS NULL OR btrim(p_activation_event_id) = '' THEN
    RAISE EXCEPTION 'invalid field-test activation request' USING ERRCODE = '22023';
  END IF;

  SELECT campaign_row.*
    INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;

  IF campaign.id IS NULL
     OR campaign.status <> 'active'
     OR campaign.revoked_at IS NOT NULL
     OR campaign.starts_at > activation_time
     OR campaign.expires_at <= activation_time THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT enrollment.*
    INTO existing_enrollment
    FROM public.personal_plan_test_enrollments AS enrollment
   WHERE enrollment.campaign_id = p_campaign_id
     AND enrollment.lead_id = p_lead_id
   FOR UPDATE;

  IF existing_enrollment.id IS NOT NULL THEN
    IF existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id THEN
      RAISE EXCEPTION 'field-test enrollment conflicts with this guest' USING ERRCODE = '23505';
    END IF;

    SELECT grant_row.*
      INTO access_grant
      FROM public.manual_access_grants AS grant_row
     WHERE grant_row.id = existing_enrollment.manual_access_grant_id
     FOR UPDATE;

    IF existing_enrollment.status <> 'active'
       OR existing_enrollment.revoked_at IS NOT NULL
       OR existing_enrollment.expires_at <= activation_time
       OR access_grant.id IS NULL
       OR access_grant.user_id <> p_user_id
       OR access_grant.reason <> 'tester'
       OR access_grant.revoked_at IS NOT NULL
       OR access_grant.expires_at IS NULL
       OR access_grant.expires_at <= activation_time THEN
      RAISE EXCEPTION 'field-test enrollment is unavailable' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
      SELECT existing_enrollment.id,
             existing_enrollment.manual_access_grant_id,
             existing_enrollment.prepared_artifact_id,
             existing_enrollment.activated_at,
             existing_enrollment.expires_at,
             true;
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO active_enrollment_count
    FROM public.personal_plan_test_enrollments AS enrollment
   WHERE enrollment.campaign_id = p_campaign_id;

  IF active_enrollment_count >= campaign.max_activations THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.funnel_sessions AS session
   WHERE session.id = p_funnel_session_id
     AND session.package_key = 'meta_personal_plan_v1'
     AND session.lead_id = p_lead_id
     AND session.test_kind = 'field_test'
     AND session.field_test_campaign_id = p_campaign_id
     AND (session.user_id IS NULL OR session.user_id = p_user_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'field-test funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.leads AS lead
   WHERE lead.id = p_lead_id
     AND lead.quiz_kind = 'personal_plan'
     AND (lead.user_id IS NULL OR lead.user_id = p_user_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'field-test lead is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT artifact_row.*
    INTO artifact
    FROM public.personal_plan_prepared_artifacts AS artifact_row
   WHERE artifact_row.lead_id = p_lead_id
     AND artifact_row.status = 'attached'
   FOR UPDATE;

  IF artifact.id IS NULL OR (artifact.user_id IS NOT NULL AND artifact.user_id <> p_user_id) THEN
    RAISE EXCEPTION 'field-test artifact is unavailable' USING ERRCODE = '23505';
  END IF;

  enrollment_expiry := activation_time + pg_catalog.make_interval(hours => campaign.access_duration_hours);

  SELECT grant_row.*
    INTO access_grant
    FROM public.manual_access_grants AS grant_row
   WHERE grant_row.user_id = p_user_id
     AND grant_row.reason = 'tester'
     AND grant_row.revoked_at IS NULL
   ORDER BY grant_row.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF access_grant.id IS NULL THEN
    INSERT INTO public.manual_access_grants (user_id, reason, expires_at)
    VALUES (p_user_id, 'tester', enrollment_expiry)
    RETURNING * INTO access_grant;
  ELSE
    UPDATE public.manual_access_grants AS grant_row
       SET expires_at = enrollment_expiry
     WHERE grant_row.id = access_grant.id
    RETURNING * INTO access_grant;
  END IF;

  UPDATE public.personal_plan_prepared_artifacts AS artifact_row
     SET user_id = p_user_id,
         user_attached_at = COALESCE(artifact_row.user_attached_at, activation_time)
   WHERE artifact_row.id = artifact.id;

  -- The normal /plan-bereit recovery projects canonical quiz diagnostics only
  -- from a lead already owned by the authenticated user. Bind that exact lead
  -- in the same transaction as its campaign, funnel, artifact, and enrollment.
  UPDATE public.leads AS lead
     SET user_id = p_user_id,
         status = 'linked'
   WHERE lead.id = p_lead_id;

  UPDATE public.funnel_sessions AS session
     SET user_id = COALESCE(session.user_id, p_user_id)
   WHERE session.id = p_funnel_session_id;

  INSERT INTO public.personal_plan_test_enrollments (
    campaign_id,
    funnel_session_id,
    lead_id,
    user_id,
    manual_access_grant_id,
    prepared_artifact_id,
    activated_at,
    expires_at
  )
  VALUES (
    p_campaign_id,
    p_funnel_session_id,
    p_lead_id,
    p_user_id,
    access_grant.id,
    artifact.id,
    activation_time,
    enrollment_expiry
  )
  ON CONFLICT (campaign_id, lead_id) DO NOTHING
  RETURNING * INTO existing_enrollment;

  IF existing_enrollment.id IS NULL THEN
    SELECT enrollment.*
      INTO existing_enrollment
      FROM public.personal_plan_test_enrollments AS enrollment
     WHERE enrollment.campaign_id = p_campaign_id
       AND enrollment.lead_id = p_lead_id;
    IF existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id THEN
      RAISE EXCEPTION 'field-test enrollment conflicts with this guest' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.funnel_events (
      event_id,
      funnel_session_id,
      package_key,
      event_name,
      occurred_at,
      lead_id,
      properties
    )
    VALUES (
      p_activation_event_id,
      p_funnel_session_id,
      'meta_personal_plan_v1',
      'field_test_activated',
      activation_time,
      p_lead_id,
      pg_catalog.jsonb_build_object('campaign_id', p_campaign_id, 'test_kind', 'field_test')
    )
    ON CONFLICT (event_id) DO NOTHING;
  END IF;

  RETURN QUERY
    SELECT existing_enrollment.id,
           existing_enrollment.manual_access_grant_id,
           existing_enrollment.prepared_artifact_id,
           existing_enrollment.activated_at,
           existing_enrollment.expires_at,
           false;
END;
$$;

REVOKE ALL ON FUNCTION private.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  TO service_role;

-- PostgREST exposes public, not private. This service-role-only adapter keeps
-- the transaction implementation private while providing the server route a
-- callable RPC boundary.
CREATE OR REPLACE FUNCTION public.activate_personal_plan_field_test(
  p_campaign_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_activation_event_id text
)
RETURNS TABLE (
  enrollment_id uuid,
  manual_access_grant_id uuid,
  prepared_artifact_id uuid,
  activated_at timestamptz,
  expires_at timestamptz,
  reused boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT *
    FROM private.activate_personal_plan_field_test(
      p_campaign_id,
      p_funnel_session_id,
      p_lead_id,
      p_user_id,
      p_activation_event_id
    );
$$;

REVOKE ALL ON FUNCTION public.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.bind_personal_plan_field_test_funnel(
  p_campaign_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid
)
RETURNS TABLE (campaign_id uuid, access_duration_hours integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  campaign public.personal_plan_test_campaigns%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL OR p_funnel_session_id IS NULL OR p_lead_id IS NULL THEN
    RAISE EXCEPTION 'invalid field-test funnel binding request' USING ERRCODE = '22023';
  END IF;

  SELECT campaign_row.*
    INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;

  IF campaign.id IS NULL
     OR campaign.status <> 'active'
     OR campaign.revoked_at IS NOT NULL
     OR campaign.starts_at > pg_catalog.now()
     OR campaign.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.funnel_sessions AS session
   WHERE session.id = p_funnel_session_id
     AND session.package_key = 'meta_personal_plan_v1'
     AND session.lead_id = p_lead_id
     AND (
       session.test_kind IS NULL
       OR (
         session.test_kind = 'field_test'
         AND session.field_test_campaign_id = p_campaign_id
       )
     )
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'field-test funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.funnel_sessions AS session
     SET test_kind = 'field_test',
         field_test_campaign_id = p_campaign_id
   WHERE session.id = p_funnel_session_id;

  RETURN QUERY SELECT campaign.id, campaign.access_duration_hours;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_personal_plan_field_test_funnel(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_personal_plan_field_test_funnel(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_personal_plan_field_test_campaign(
  p_campaign_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  revocation_time timestamptz := pg_catalog.now();
  updated_campaign_id uuid;
BEGIN
  UPDATE public.personal_plan_test_campaigns AS campaign
     SET status = 'revoked', revoked_at = revocation_time
   WHERE campaign.id = p_campaign_id
     AND campaign.status = 'active'
  RETURNING campaign.id INTO updated_campaign_id;

  IF updated_campaign_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.manual_access_grants AS grant_row
     SET revoked_at = revocation_time
   WHERE grant_row.id IN (
     SELECT enrollment.manual_access_grant_id
       FROM public.personal_plan_test_enrollments AS enrollment
      WHERE enrollment.campaign_id = p_campaign_id
        AND enrollment.status = 'active'
   )
     AND grant_row.revoked_at IS NULL;

  UPDATE public.personal_plan_test_enrollments AS enrollment
     SET status = 'revoked', revoked_at = revocation_time
   WHERE enrollment.campaign_id = p_campaign_id
     AND enrollment.status = 'active';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_personal_plan_field_test_campaign(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_personal_plan_field_test_campaign(uuid)
  TO service_role;

COMMENT ON TABLE public.personal_plan_test_campaigns IS
  'Service-only field-test campaign credentials; only SHA-256 token hashes are persisted.';
COMMENT ON TABLE public.personal_plan_test_enrollments IS
  'Service-only non-commercial Personal Plan access records for exact field-test campaign, session, lead, guest, grant, and artifact bindings.';
