BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.personal_plan_test_campaigns
  ADD COLUMN IF NOT EXISTS identity_mode text NOT NULL DEFAULT 'guest' CHECK (identity_mode IN ('guest', 'email_bound'));

-- A funnel can move to a later quiz submission. Keep account-only result
-- classification on every lead so an earlier result never becomes public.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS moderator_campaign_id uuid
  REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT;

ALTER TABLE public.personal_plan_test_campaigns
  DROP CONSTRAINT IF EXISTS personal_plan_test_campaigns_email_bound_shape;
ALTER TABLE public.personal_plan_test_campaigns
  ADD CONSTRAINT personal_plan_test_campaigns_email_bound_shape CHECK (
    identity_mode = 'guest'
    OR (
      identity_mode = 'email_bound'
      AND flow_kind = 'personal_plan'
      AND access_duration_hours = 2160
    )
  );

CREATE TABLE IF NOT EXISTS public.personal_plan_test_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  normalized_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'activated', 'revoked')),
  reset_receipt_ref text,
  enrollment_id uuid REFERENCES public.personal_plan_test_enrollments(id) ON DELETE RESTRICT,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT personal_plan_test_members_email_normalized CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND normalized_email LIKE '%@%'
  ),
  CONSTRAINT personal_plan_test_members_ready_receipt CHECK (
    status <> 'ready'
    OR (reset_receipt_ref IS NOT NULL AND btrim(reset_receipt_ref) <> '')
  ),
  CONSTRAINT personal_plan_test_members_activation_shape CHECK (
    (status = 'activated' AND enrollment_id IS NOT NULL AND activated_at IS NOT NULL AND revoked_at IS NULL)
    OR (status <> 'activated' AND (status = 'revoked' OR enrollment_id IS NULL))
  ),
  CONSTRAINT personal_plan_test_members_revocation_shape CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR (status <> 'revoked' AND revoked_at IS NULL)
  ),
  UNIQUE (campaign_id, user_id),
  UNIQUE (campaign_id, normalized_email)
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_plan_test_members_enrollment_key
  ON public.personal_plan_test_members(enrollment_id)
  WHERE enrollment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS personal_plan_test_members_user_status_idx
  ON public.personal_plan_test_members(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS personal_plan_test_members_campaign_status_idx
  ON public.personal_plan_test_members(campaign_id, status);

ALTER TABLE public.personal_plan_test_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_test_members FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_plan_test_members TO service_role;

CREATE OR REPLACE FUNCTION public.create_personal_plan_moderator_test_campaign(
  p_name text,
  p_token_hash text,
  p_roster jsonb,
  p_starts_at timestamptz DEFAULT pg_catalog.now(),
  p_expires_at timestamptz DEFAULT pg_catalog.now() + interval '30 days'
)
RETURNS TABLE (
  campaign_id uuid,
  max_activations integer,
  access_duration_hours integer,
  member_count integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_campaign_id uuid;
  v_member_count integer;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = ''
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_roster IS NULL OR pg_catalog.jsonb_typeof(p_roster) <> 'array'
     OR p_starts_at IS NULL OR p_expires_at IS NULL OR p_expires_at <= p_starts_at THEN
    RAISE EXCEPTION 'invalid moderator campaign request' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_member_count
    FROM pg_catalog.jsonb_array_elements(p_roster) AS roster(member);
  IF v_member_count < 1 OR v_member_count > 5 THEN
    RAISE EXCEPTION 'moderator roster must contain one to five members' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.personal_plan_test_campaigns (
    name,
    token_hash,
    starts_at,
    expires_at,
    max_activations,
    access_duration_hours,
    flow_kind,
    identity_mode
  )
  VALUES (
    p_name,
    p_token_hash,
    p_starts_at,
    p_expires_at,
    v_member_count,
    2160,
    'personal_plan',
    'email_bound'
  )
  RETURNING id INTO v_campaign_id;

  INSERT INTO public.personal_plan_test_members (
    campaign_id,
    user_id,
    normalized_email,
    status,
    reset_receipt_ref
  )
  SELECT
    v_campaign_id,
    (member->>'user_id')::uuid,
    lower(btrim(member->>'email')),
    'pending',
    NULLIF(btrim(member->>'reset_receipt_ref'), '')
  FROM pg_catalog.jsonb_array_elements(p_roster) AS roster(member);

  IF (SELECT pg_catalog.count(*)::integer FROM public.personal_plan_test_members AS member_row WHERE member_row.campaign_id = v_campaign_id) <> v_member_count THEN
    RAISE EXCEPTION 'moderator roster insert mismatch' USING ERRCODE = '23505';
  END IF;

  RETURN QUERY SELECT v_campaign_id, v_member_count, 2160, v_member_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personal_plan_moderator_test_campaign(
  text, text, jsonb, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_personal_plan_moderator_test_campaign(
  text, text, jsonb, timestamptz, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION private.activate_personal_plan_moderator_test(
  p_campaign_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_confirmed_email text,
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
  member public.personal_plan_test_members%ROWTYPE;
  existing_enrollment public.personal_plan_test_enrollments%ROWTYPE;
  artifact public.personal_plan_prepared_artifacts%ROWTYPE;
  access_grant public.manual_access_grants%ROWTYPE;
  auth_user auth.users%ROWTYPE;
  activation_time timestamptz := pg_catalog.now();
  enrollment_expiry timestamptz;
  active_member_count integer;
  v_email text := lower(btrim(p_confirmed_email));
BEGIN
  IF p_campaign_id IS NULL OR p_funnel_session_id IS NULL OR p_lead_id IS NULL
     OR p_user_id IS NULL OR v_email IS NULL OR v_email = ''
     OR p_activation_event_id IS NULL OR btrim(p_activation_event_id) = '' THEN
    RAISE EXCEPTION 'invalid moderator activation request' USING ERRCODE = '22023';
  END IF;

  SELECT campaign_row.* INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;

  IF campaign.id IS NULL
     OR campaign.flow_kind <> 'personal_plan'
     OR campaign.identity_mode <> 'email_bound' THEN
    RAISE EXCEPTION 'moderator campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT member_row.* INTO member
    FROM public.personal_plan_test_members AS member_row
   WHERE member_row.campaign_id = p_campaign_id
     AND member_row.user_id = p_user_id
   FOR UPDATE;

  IF member.id IS NULL THEN
    RAISE EXCEPTION 'moderator member is unavailable' USING ERRCODE = '22023';
  END IF;
  IF member.normalized_email <> v_email THEN
    RAISE EXCEPTION 'moderator member email mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user_row.* INTO auth_user
    FROM auth.users AS auth_user_row
   WHERE auth_user_row.id = p_user_id
   FOR UPDATE;

  IF auth_user.id IS NULL
     OR lower(btrim(auth_user.email)) <> v_email
     OR auth_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'moderator auth identity mismatch' USING ERRCODE = '22023';
  END IF;

  IF member.status = 'activated' AND member.enrollment_id IS NOT NULL THEN
    SELECT enrollment.* INTO existing_enrollment
      FROM public.personal_plan_test_enrollments AS enrollment
     WHERE enrollment.id = member.enrollment_id
     FOR UPDATE;
    SELECT grant_row.* INTO access_grant
      FROM public.manual_access_grants AS grant_row
     WHERE grant_row.id = existing_enrollment.manual_access_grant_id
     FOR UPDATE;

    IF existing_enrollment.id IS NULL
       OR existing_enrollment.campaign_id <> p_campaign_id
       OR existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.lead_id <> p_lead_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id
       OR existing_enrollment.status <> 'active'
       OR existing_enrollment.revoked_at IS NOT NULL
       OR existing_enrollment.expires_at <= activation_time
       OR access_grant.id IS NULL
       OR access_grant.user_id <> p_user_id
       OR access_grant.reason <> 'tester'
       OR access_grant.revoked_at IS NOT NULL
       OR access_grant.expires_at IS NULL
       OR access_grant.expires_at <= activation_time THEN
      RAISE EXCEPTION 'moderator enrollment is unavailable' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY SELECT existing_enrollment.id,
                        existing_enrollment.manual_access_grant_id,
                        existing_enrollment.prepared_artifact_id,
                        existing_enrollment.activated_at,
                        existing_enrollment.expires_at,
                        true;
    RETURN;
  END IF;

  IF member.status <> 'ready'
     OR member.reset_receipt_ref IS NULL
     OR btrim(member.reset_receipt_ref) = ''
     OR member.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'moderator member is not ready' USING ERRCODE = '22023';
  END IF;

  IF campaign.status <> 'active'
     OR campaign.revoked_at IS NOT NULL
     OR campaign.starts_at > activation_time
     OR campaign.expires_at <= activation_time THEN
    RAISE EXCEPTION 'moderator campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO active_member_count
    FROM public.personal_plan_test_members AS member_row
   WHERE member_row.campaign_id = p_campaign_id
     AND member_row.status = 'activated';
  IF active_member_count >= campaign.max_activations THEN
    RAISE EXCEPTION 'moderator campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.personal_plan_test_enrollments AS enrollment
    JOIN public.manual_access_grants AS grant_row
      ON grant_row.id = enrollment.manual_access_grant_id
   WHERE enrollment.user_id = p_user_id
     AND enrollment.status = 'active'
     AND enrollment.revoked_at IS NULL
     AND enrollment.expires_at > activation_time
     AND grant_row.reason = 'tester'
     AND grant_row.revoked_at IS NULL
     AND grant_row.expires_at IS NOT NULL
     AND grant_row.expires_at > activation_time
   FOR UPDATE OF enrollment, grant_row;
  IF FOUND THEN
    RAISE EXCEPTION 'moderator user already has active test access' USING ERRCODE = '23505';
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
    RAISE EXCEPTION 'moderator funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.leads AS lead
   WHERE lead.id = p_lead_id
     AND lead.quiz_kind = 'personal_plan'
     AND lead.email = v_email
     AND lead.moderator_campaign_id = p_campaign_id
     AND (lead.user_id IS NULL OR lead.user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderator lead is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT artifact_row.* INTO artifact
    FROM public.personal_plan_prepared_artifacts AS artifact_row
   WHERE artifact_row.lead_id = p_lead_id
     AND artifact_row.status = 'attached'
   FOR UPDATE;
  IF artifact.id IS NULL OR artifact.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'moderator artifact is unavailable' USING ERRCODE = '23505';
  END IF;

  enrollment_expiry := activation_time + pg_catalog.make_interval(hours => campaign.access_duration_hours);

  INSERT INTO public.manual_access_grants (user_id, reason, expires_at)
  VALUES (p_user_id, 'tester', enrollment_expiry)
  RETURNING * INTO access_grant;

  UPDATE public.personal_plan_prepared_artifacts AS artifact_row
     SET user_id = p_user_id,
         user_attached_at = COALESCE(artifact_row.user_attached_at, activation_time)
   WHERE artifact_row.id = artifact.id;

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
  RETURNING * INTO existing_enrollment;

  UPDATE public.personal_plan_test_members AS member_row
     SET status = 'activated',
         enrollment_id = existing_enrollment.id,
         activated_at = activation_time,
         updated_at = activation_time
   WHERE member_row.id = member.id;

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
    pg_catalog.jsonb_build_object('campaign_id', p_campaign_id, 'test_kind', 'field_test', 'identity_mode', 'email_bound')
  )
  ON CONFLICT (event_id) DO NOTHING;

  RETURN QUERY SELECT existing_enrollment.id,
                      existing_enrollment.manual_access_grant_id,
                      existing_enrollment.prepared_artifact_id,
                      existing_enrollment.activated_at,
                      existing_enrollment.expires_at,
                      false;
END;
$$;

REVOKE ALL ON FUNCTION private.activate_personal_plan_moderator_test(
  uuid, uuid, uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.activate_personal_plan_moderator_test(
  uuid, uuid, uuid, uuid, text, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_personal_plan_moderator_test(
  p_campaign_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_confirmed_email text,
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
    FROM private.activate_personal_plan_moderator_test(
      p_campaign_id,
      p_funnel_session_id,
      p_lead_id,
      p_user_id,
      p_confirmed_email,
      p_activation_event_id
    );
$$;

REVOKE ALL ON FUNCTION public.activate_personal_plan_moderator_test(
  uuid, uuid, uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_personal_plan_moderator_test(
  uuid, uuid, uuid, uuid, text, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.save_personal_plan_moderator_lead_with_artifact(
  p_campaign_id uuid,
  p_user_id uuid,
  p_confirmed_email text,
  p_funnel_session_id uuid,
  p_marketing_consent boolean,
  p_quiz_answers jsonb,
  p_artifact_id uuid,
  p_claim_token_hash text,
  p_answer_hash text
)
RETURNS TABLE (lead_id uuid, reused boolean, artifact_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  campaign public.personal_plan_test_campaigns%ROWTYPE;
  member public.personal_plan_test_members%ROWTYPE;
  auth_user auth.users%ROWTYPE;
  artifact public.personal_plan_prepared_artifacts%ROWTYPE;
  lead_row public.leads%ROWTYPE;
  v_lead_id uuid;
  v_email text := lower(btrim(p_confirmed_email));
  save_time timestamptz := pg_catalog.now();
  did_reuse boolean := true;
BEGIN
  IF p_campaign_id IS NULL OR p_user_id IS NULL OR v_email IS NULL OR v_email = ''
     OR p_funnel_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid moderator lead request' USING ERRCODE = '22023';
  END IF;

  SELECT campaign_row.* INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;
  IF campaign.id IS NULL
     OR campaign.flow_kind <> 'personal_plan'
     OR campaign.identity_mode <> 'email_bound'
     OR campaign.status <> 'active'
     OR campaign.revoked_at IS NOT NULL
     OR campaign.starts_at > save_time
     OR campaign.expires_at <= save_time THEN
    RAISE EXCEPTION 'moderator campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT member_row.* INTO member
    FROM public.personal_plan_test_members AS member_row
   WHERE member_row.campaign_id = p_campaign_id
     AND member_row.user_id = p_user_id
   FOR UPDATE;
  IF member.id IS NULL
     OR member.normalized_email <> v_email
     OR member.status NOT IN ('ready', 'activated')
     OR member.revoked_at IS NOT NULL
     OR (member.status = 'ready' AND (
       member.reset_receipt_ref IS NULL OR btrim(member.reset_receipt_ref) = ''
     )) THEN
    RAISE EXCEPTION 'moderator member is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user_row.* INTO auth_user
    FROM auth.users AS auth_user_row
   WHERE auth_user_row.id = p_user_id
   FOR UPDATE;
  IF auth_user.id IS NULL
     OR lower(btrim(auth_user.email)) <> v_email
     OR auth_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'moderator auth identity mismatch' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.funnel_sessions AS session
   WHERE session.id = p_funnel_session_id
     AND session.package_key = 'meta_personal_plan_v1'
     AND session.test_kind = 'field_test'
     AND session.field_test_campaign_id = p_campaign_id
     AND session.user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderator funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT artifact_row.* INTO artifact
    FROM public.personal_plan_prepared_artifacts AS artifact_row
   WHERE artifact_row.id = p_artifact_id
   FOR UPDATE;
  IF artifact.id IS NULL
     OR artifact.user_id IS DISTINCT FROM p_user_id
     OR artifact.status NOT IN ('prepared', 'attached')
     OR (artifact.status = 'prepared' AND artifact.expires_at <= save_time)
     OR artifact.claim_token_hash IS DISTINCT FROM p_claim_token_hash
     OR artifact.answer_hash IS DISTINCT FROM p_answer_hash
     OR artifact.quiz_answers IS DISTINCT FROM p_quiz_answers THEN
    RAISE EXCEPTION 'moderator artifact is unavailable' USING ERRCODE = '22023';
  END IF;

  IF artifact.status = 'prepared' THEN
    IF artifact.lead_id IS NOT NULL OR member.status <> 'ready' THEN
      RAISE EXCEPTION 'moderator artifact is already linked' USING ERRCODE = '23505';
    END IF;
    did_reuse := false;
    INSERT INTO public.leads AS new_lead (
      name, email, marketing_consent, quiz_answers, quiz_kind, status, user_id, moderator_campaign_id
    ) VALUES (
      '', v_email, p_marketing_consent, p_quiz_answers, 'personal_plan', 'linked', p_user_id, p_campaign_id
    ) RETURNING new_lead.id INTO v_lead_id;
  ELSE
    SELECT existing_lead.* INTO lead_row
      FROM public.leads AS existing_lead
     WHERE existing_lead.id = artifact.lead_id
     FOR UPDATE;
    IF lead_row.id IS NULL
       OR lead_row.quiz_kind <> 'personal_plan'
       OR lower(btrim(lead_row.email)) IS DISTINCT FROM v_email
       OR lead_row.user_id IS DISTINCT FROM p_user_id
       OR lead_row.moderator_campaign_id IS DISTINCT FROM p_campaign_id
       OR lead_row.quiz_answers IS DISTINCT FROM p_quiz_answers THEN
      RAISE EXCEPTION 'moderator lead owner mismatch' USING ERRCODE = '23505';
    END IF;
    v_lead_id := lead_row.id;
    UPDATE public.leads AS mutable_lead
       SET marketing_consent = p_marketing_consent
     WHERE mutable_lead.id = v_lead_id
       AND mutable_lead.marketing_consent IS DISTINCT FROM p_marketing_consent;
  END IF;

  UPDATE public.personal_plan_prepared_artifacts AS artifact_row
     SET user_id = p_user_id,
         lead_id = v_lead_id,
         status = 'attached',
         attached_at = COALESCE(artifact_row.attached_at, save_time),
         user_attached_at = COALESCE(artifact_row.user_attached_at, save_time)
   WHERE artifact_row.id = artifact.id
     AND artifact_row.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderator canonical artifact owner mismatch' USING ERRCODE = '23505';
  END IF;

  UPDATE public.funnel_sessions AS session
     SET test_kind = 'field_test',
         field_test_campaign_id = p_campaign_id,
         lead_id = v_lead_id,
         user_id = p_user_id
   WHERE session.id = p_funnel_session_id
     AND session.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderator funnel owner mismatch' USING ERRCODE = '23505';
  END IF;

  UPDATE public.customerio_profile_sync_outbox AS outbox
     SET completion_event_eligible = false,
         send_completion_event = false,
         updated_at = save_time
   WHERE outbox.lead_id = v_lead_id;
  IF NOT FOUND THEN
    INSERT INTO public.customerio_profile_sync_outbox (
      lead_id,
      completion_event_eligible,
      send_completion_event,
      updated_at
    )
    VALUES (v_lead_id, false, false, save_time);
  END IF;

  RETURN QUERY SELECT v_lead_id, did_reuse, artifact.id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_personal_plan_moderator_lead_with_artifact(
  uuid, uuid, text, uuid, boolean, jsonb, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_personal_plan_moderator_lead_with_artifact(
  uuid, uuid, text, uuid, boolean, jsonb, uuid, text, text
) TO service_role;

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
     OR campaign.identity_mode <> 'guest'
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

ALTER FUNCTION private.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  RENAME TO activate_personal_plan_field_test_guest_v1;

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
BEGIN
  SELECT campaign_row.* INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;
  IF campaign.id IS NULL OR campaign.identity_mode <> 'guest' THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT *
      FROM private.activate_personal_plan_field_test_guest_v1(
        p_campaign_id,
        p_funnel_session_id,
        p_lead_id,
        p_user_id,
        p_activation_event_id
      );
END;
$$;

REVOKE ALL ON FUNCTION private.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.activate_personal_plan_field_test(uuid, uuid, uuid, uuid, text)
  TO service_role;

COMMENT ON COLUMN public.personal_plan_test_campaigns.identity_mode IS
  'Campaign identity boundary. guest keeps the synthetic tester flow; email_bound requires an exact service-only roster member.';
COMMENT ON TABLE public.personal_plan_test_members IS
  'Service-only exact-account roster for email-bound moderator Personal Plan field tests.';

-- Keep campaign, roster, enrollment and exact tester grant revocation atomic.
CREATE OR REPLACE FUNCTION public.revoke_personal_plan_field_test_campaign(p_campaign_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  revocation_time timestamptz := pg_catalog.now();
  campaign_state public.personal_plan_test_campaigns%ROWTYPE;
BEGIN
  UPDATE public.personal_plan_test_campaigns AS target_campaign
     SET status = 'revoked', revoked_at = revocation_time
   WHERE target_campaign.id = p_campaign_id AND target_campaign.status = 'active'
  RETURNING target_campaign.* INTO campaign_state;
  IF campaign_state.id IS NULL THEN RETURN false; END IF;

  IF campaign_state.flow_kind = 'personal_plan' THEN
    UPDATE public.manual_access_grants AS grant_row SET revoked_at = revocation_time
     WHERE grant_row.id IN (
       SELECT enrollment.manual_access_grant_id FROM public.personal_plan_test_enrollments AS enrollment
        WHERE enrollment.campaign_id = p_campaign_id AND enrollment.status = 'active'
     ) AND grant_row.revoked_at IS NULL;
    UPDATE public.personal_plan_test_enrollments AS enrollment
       SET status = 'revoked', revoked_at = revocation_time
     WHERE enrollment.campaign_id = p_campaign_id AND enrollment.status = 'active';
  ELSIF campaign_state.flow_kind = 'regular_quiz' THEN
    UPDATE public.manual_access_grants AS grant_row SET revoked_at = revocation_time
     WHERE grant_row.id IN (
       SELECT enrollment.manual_access_grant_id FROM public.regular_quiz_test_enrollments AS enrollment
        WHERE enrollment.campaign_id = p_campaign_id AND enrollment.status = 'active'
     ) AND grant_row.revoked_at IS NULL;
    UPDATE public.regular_quiz_test_enrollments AS enrollment
       SET status = 'revoked', revoked_at = revocation_time
     WHERE enrollment.campaign_id = p_campaign_id AND enrollment.status = 'active';
  END IF;
  IF campaign_state.identity_mode = 'email_bound' THEN
    UPDATE public.personal_plan_test_members AS member
       SET status = 'revoked', revoked_at = revocation_time, updated_at = revocation_time
     WHERE member.campaign_id = p_campaign_id AND member.status <> 'revoked';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_personal_plan_field_test_campaign(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_personal_plan_field_test_campaign(uuid)
  TO service_role;

COMMIT;
