-- Add a second, flow-scoped field-test consumer without changing the historic
-- Personal Plan campaign or enrollment contract.
ALTER TABLE public.personal_plan_test_campaigns
  ADD COLUMN IF NOT EXISTS flow_kind text NOT NULL DEFAULT 'personal_plan' CHECK (flow_kind IN ('personal_plan', 'regular_quiz'));

CREATE OR REPLACE FUNCTION private.prevent_field_test_campaign_flow_kind_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.flow_kind IS DISTINCT FROM OLD.flow_kind THEN
    RAISE EXCEPTION 'field-test campaign flow_kind is immutable' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personal_plan_test_campaigns_flow_kind_immutable
  ON public.personal_plan_test_campaigns;
CREATE TRIGGER personal_plan_test_campaigns_flow_kind_immutable
  BEFORE UPDATE ON public.personal_plan_test_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.prevent_field_test_campaign_flow_kind_change();

REVOKE ALL ON FUNCTION private.prevent_field_test_campaign_flow_kind_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prevent_field_test_campaign_flow_kind_change()
  TO service_role;

CREATE TABLE IF NOT EXISTS public.regular_quiz_test_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.personal_plan_test_campaigns(id) ON DELETE RESTRICT,
  funnel_session_id uuid NOT NULL REFERENCES public.funnel_sessions(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  manual_access_grant_id uuid NOT NULL REFERENCES public.manual_access_grants(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT regular_quiz_test_enrollments_campaign_lead_key UNIQUE (campaign_id, lead_id),
  CONSTRAINT regular_quiz_test_enrollments_time_order CHECK (
    expires_at > activated_at
    AND (revoked_at IS NULL OR revoked_at >= activated_at)
  ),
  CONSTRAINT regular_quiz_test_enrollments_revocation_status CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS regular_quiz_test_enrollments_campaign_status_idx
  ON public.regular_quiz_test_enrollments (campaign_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS regular_quiz_test_enrollments_user_status_idx
  ON public.regular_quiz_test_enrollments (user_id, expires_at)
  WHERE status = 'active';

ALTER TABLE public.regular_quiz_test_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.regular_quiz_test_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.regular_quiz_test_enrollments TO service_role;

CREATE OR REPLACE FUNCTION public.bind_regular_quiz_field_test_funnel(
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

  SELECT campaign_row.* INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;

  IF campaign.id IS NULL
     OR campaign.flow_kind <> 'regular_quiz'
     OR campaign.status <> 'active'
     OR campaign.revoked_at IS NOT NULL
     OR campaign.starts_at > pg_catalog.now()
     OR campaign.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.funnel_sessions AS session
   WHERE session.id = p_funnel_session_id
     AND session.package_key = 'default_organic'
     AND session.lead_id = p_lead_id
     AND (
       session.test_kind IS NULL
       OR (session.test_kind = 'field_test' AND session.field_test_campaign_id = p_campaign_id)
     )
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'field-test funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.leads AS lead
   WHERE lead.id = p_lead_id
     AND lead.quiz_kind = 'legacy'
     AND lead.user_id IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'field-test lead is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.funnel_sessions AS session
     SET test_kind = 'field_test', field_test_campaign_id = p_campaign_id
   WHERE session.id = p_funnel_session_id;

  RETURN QUERY SELECT campaign.id, campaign.access_duration_hours;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_regular_quiz_field_test_funnel(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_regular_quiz_field_test_funnel(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION private.activate_regular_quiz_field_test(
  p_campaign_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_activation_event_id text
)
RETURNS TABLE (
  enrollment_id uuid,
  manual_access_grant_id uuid,
  activated_at timestamptz,
  expires_at timestamptz,
  reused boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  campaign public.personal_plan_test_campaigns%ROWTYPE;
  existing_enrollment public.regular_quiz_test_enrollments%ROWTYPE;
  access_grant public.manual_access_grants%ROWTYPE;
  activation_time timestamptz := pg_catalog.now();
  enrollment_expiry timestamptz;
  active_enrollment_count integer;
BEGIN
  IF p_campaign_id IS NULL OR p_funnel_session_id IS NULL OR p_lead_id IS NULL
     OR p_user_id IS NULL OR p_activation_event_id IS NULL OR btrim(p_activation_event_id) = '' THEN
    RAISE EXCEPTION 'invalid field-test activation request' USING ERRCODE = '22023';
  END IF;

  SELECT campaign_row.* INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = p_campaign_id
   FOR UPDATE;
  IF campaign.id IS NULL
     OR campaign.flow_kind <> 'regular_quiz'
     OR campaign.status <> 'active'
     OR campaign.revoked_at IS NOT NULL
     OR campaign.starts_at > activation_time
     OR campaign.expires_at <= activation_time THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT enrollment.* INTO existing_enrollment
    FROM public.regular_quiz_test_enrollments AS enrollment
   WHERE enrollment.campaign_id = p_campaign_id AND enrollment.lead_id = p_lead_id
   FOR UPDATE;
  IF existing_enrollment.id IS NOT NULL THEN
    IF existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id THEN
      RAISE EXCEPTION 'field-test enrollment conflicts with this guest' USING ERRCODE = '23505';
    END IF;
    SELECT grant_row.* INTO access_grant
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
    RETURN QUERY SELECT existing_enrollment.id, existing_enrollment.manual_access_grant_id,
                        existing_enrollment.activated_at, existing_enrollment.expires_at, true;
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer INTO active_enrollment_count
    FROM public.regular_quiz_test_enrollments AS enrollment
   WHERE enrollment.campaign_id = p_campaign_id;
  IF active_enrollment_count >= campaign.max_activations THEN
    RAISE EXCEPTION 'field-test campaign is unavailable' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.funnel_sessions AS session
   WHERE session.id = p_funnel_session_id
     AND session.package_key = 'default_organic'
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
     AND lead.quiz_kind = 'legacy'
     AND (lead.user_id IS NULL OR lead.user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'field-test lead is invalid' USING ERRCODE = '22023';
  END IF;

  enrollment_expiry := activation_time + pg_catalog.make_interval(hours => campaign.access_duration_hours);
  -- A campaign owns its grant lifecycle. Never reuse a generic tester grant:
  -- revoking this campaign must not terminate another campaign or support grant.
  INSERT INTO public.manual_access_grants (user_id, reason, expires_at)
  VALUES (p_user_id, 'tester', enrollment_expiry)
  RETURNING * INTO access_grant;

  UPDATE public.leads AS lead SET user_id = p_user_id, status = 'linked'
   WHERE lead.id = p_lead_id;
  UPDATE public.funnel_sessions AS session SET user_id = COALESCE(session.user_id, p_user_id)
   WHERE session.id = p_funnel_session_id;

  INSERT INTO public.regular_quiz_test_enrollments (
    campaign_id, funnel_session_id, lead_id, user_id, manual_access_grant_id, activated_at, expires_at
  ) VALUES (
    p_campaign_id, p_funnel_session_id, p_lead_id, p_user_id, access_grant.id, activation_time, enrollment_expiry
  ) ON CONFLICT (campaign_id, lead_id) DO NOTHING RETURNING * INTO existing_enrollment;

  IF existing_enrollment.id IS NULL THEN
    SELECT enrollment.* INTO existing_enrollment
      FROM public.regular_quiz_test_enrollments AS enrollment
     WHERE enrollment.campaign_id = p_campaign_id AND enrollment.lead_id = p_lead_id;
    IF existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id THEN
      RAISE EXCEPTION 'field-test enrollment conflicts with this guest' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.funnel_events (
      event_id, funnel_session_id, package_key, event_name, occurred_at, lead_id, properties
    ) VALUES (
      p_activation_event_id, p_funnel_session_id, 'default_organic', 'field_test_activated', activation_time,
      p_lead_id, pg_catalog.jsonb_build_object('campaign_id', p_campaign_id, 'test_kind', 'field_test')
    ) ON CONFLICT (event_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT existing_enrollment.id, existing_enrollment.manual_access_grant_id,
                      existing_enrollment.activated_at, existing_enrollment.expires_at, false;
END;
$$;

REVOKE ALL ON FUNCTION private.activate_regular_quiz_field_test(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.activate_regular_quiz_field_test(uuid, uuid, uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.activate_regular_quiz_field_test(
  p_campaign_id uuid, p_funnel_session_id uuid, p_lead_id uuid, p_user_id uuid, p_activation_event_id text
)
RETURNS TABLE (enrollment_id uuid, manual_access_grant_id uuid, activated_at timestamptz, expires_at timestamptz, reused boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM private.activate_regular_quiz_field_test(
    p_campaign_id, p_funnel_session_id, p_lead_id, p_user_id, p_activation_event_id
  );
$$;

REVOKE ALL ON FUNCTION public.activate_regular_quiz_field_test(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_regular_quiz_field_test(uuid, uuid, uuid, uuid, text)
  TO service_role;

-- Preserve the historic RPC name for operators while revoking the enrollment
-- shape actually associated with the immutable campaign flow.
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
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_personal_plan_field_test_campaign(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_personal_plan_field_test_campaign(uuid)
  TO service_role;

COMMENT ON COLUMN public.personal_plan_test_campaigns.flow_kind IS
  'Immutable campaign journey selector. Existing campaigns default to personal_plan.';
COMMENT ON TABLE public.regular_quiz_test_enrollments IS
  'Service-only non-commercial regular quiz access records for exact field-test campaign, session, lead, guest, and grant bindings.';
