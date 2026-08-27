BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.personal_plan_test_enrollments
  ADD COLUMN IF NOT EXISTS quiz_source_kind text NOT NULL DEFAULT 'personal_plan'
    CHECK (quiz_source_kind IN ('personal_plan', 'legacy'));

ALTER TABLE public.personal_plan_test_enrollments
  ALTER COLUMN prepared_artifact_id DROP NOT NULL;

ALTER TABLE public.personal_plan_test_enrollments
  DROP CONSTRAINT IF EXISTS personal_plan_test_enrollments_source_artifact_shape;
ALTER TABLE public.personal_plan_test_enrollments
  ADD CONSTRAINT personal_plan_test_enrollments_source_artifact_shape CHECK (
    (quiz_source_kind = 'personal_plan' AND prepared_artifact_id IS NOT NULL)
    OR (quiz_source_kind = 'legacy' AND prepared_artifact_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS personal_plan_test_enrollments_legacy_moderator_idx
  ON public.personal_plan_test_enrollments (campaign_id, user_id, lead_id)
  WHERE quiz_source_kind = 'legacy';

CREATE OR REPLACE FUNCTION private.validate_personal_plan_test_enrollment_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  campaign public.personal_plan_test_campaigns%ROWTYPE;
  member public.personal_plan_test_members%ROWTYPE;
  lead_row public.leads%ROWTYPE;
  session_row public.funnel_sessions%ROWTYPE;
BEGIN
  IF NEW.quiz_source_kind <> 'legacy' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT campaign_row.* INTO campaign
    FROM public.personal_plan_test_campaigns AS campaign_row
   WHERE campaign_row.id = NEW.campaign_id;
  IF campaign.id IS NULL
     OR campaign.flow_kind <> 'personal_plan'
     OR campaign.identity_mode <> 'email_bound' THEN
    RAISE EXCEPTION 'legacy moderator enrollment campaign is invalid' USING ERRCODE = '23514';
  END IF;

  SELECT lead_source.* INTO lead_row
    FROM public.leads AS lead_source
   WHERE lead_source.id = NEW.lead_id;
  IF lead_row.id IS NULL
     OR lead_row.quiz_kind <> 'legacy'
     OR lead_row.user_id IS DISTINCT FROM NEW.user_id
     OR lead_row.moderator_campaign_id IS DISTINCT FROM NEW.campaign_id THEN
    RAISE EXCEPTION 'legacy moderator enrollment lead is invalid' USING ERRCODE = '23514';
  END IF;

  SELECT session_source.* INTO session_row
    FROM public.funnel_sessions AS session_source
   WHERE session_source.id = NEW.funnel_session_id;
  IF session_row.id IS NULL
     OR session_row.package_key <> 'default_organic'
     OR session_row.test_kind <> 'field_test'
     OR session_row.field_test_campaign_id IS DISTINCT FROM NEW.campaign_id
     OR session_row.lead_id IS DISTINCT FROM NEW.lead_id
     OR session_row.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'legacy moderator enrollment session is invalid' USING ERRCODE = '23514';
  END IF;

  SELECT member_row.* INTO member
    FROM public.personal_plan_test_members AS member_row
   WHERE member_row.campaign_id = NEW.campaign_id
     AND member_row.user_id = NEW.user_id;
  IF member.id IS NULL
     OR member.normalized_email <> lower(btrim(lead_row.email))
     OR member.status NOT IN ('ready', 'activated')
     OR member.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'legacy moderator enrollment member is invalid' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_personal_plan_test_enrollment_source()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_personal_plan_test_enrollment_source
  ON public.personal_plan_test_enrollments;
CREATE TRIGGER validate_personal_plan_test_enrollment_source
BEFORE INSERT OR UPDATE OF quiz_source_kind, status, campaign_id, funnel_session_id, lead_id, user_id, prepared_artifact_id
ON public.personal_plan_test_enrollments
FOR EACH ROW
EXECUTE FUNCTION private.validate_personal_plan_test_enrollment_source();

CREATE OR REPLACE FUNCTION public.save_personal_plan_moderator_organic_lead(
  p_campaign_id uuid,
  p_user_id uuid,
  p_confirmed_email text,
  p_funnel_session_id uuid,
  p_name text,
  p_marketing_consent boolean,
  p_quiz_answers jsonb
)
RETURNS TABLE (lead_id uuid, reused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  campaign public.personal_plan_test_campaigns%ROWTYPE;
  member public.personal_plan_test_members%ROWTYPE;
  auth_user auth.users%ROWTYPE;
  existing_enrollment public.personal_plan_test_enrollments%ROWTYPE;
  session_row public.funnel_sessions%ROWTYPE;
  lead_row public.leads%ROWTYPE;
  v_email text := lower(btrim(p_confirmed_email));
  v_name text := COALESCE(p_name, '');
  v_lead_id uuid;
  save_time timestamptz := pg_catalog.now();
  did_reuse boolean := false;
BEGIN
  IF p_campaign_id IS NULL OR p_user_id IS NULL OR v_email IS NULL OR v_email = ''
     OR p_funnel_session_id IS NULL OR p_quiz_answers IS NULL THEN
    RAISE EXCEPTION 'invalid moderator organic lead request' USING ERRCODE = '22023';
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

  SELECT session_source.* INTO session_row
    FROM public.funnel_sessions AS session_source
   WHERE session_source.id = p_funnel_session_id
   FOR UPDATE;
  IF session_row.id IS NULL
     OR session_row.package_key <> 'default_organic'
     OR session_row.test_kind <> 'field_test'
     OR session_row.field_test_campaign_id IS DISTINCT FROM p_campaign_id
     OR session_row.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'moderator organic funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  IF member.status = 'activated' THEN
    SELECT enrollment.* INTO existing_enrollment
      FROM public.personal_plan_test_enrollments AS enrollment
     WHERE enrollment.id = member.enrollment_id
     FOR UPDATE;
    IF existing_enrollment.id IS NULL
       OR existing_enrollment.quiz_source_kind <> 'legacy'
       OR existing_enrollment.campaign_id <> p_campaign_id
       OR existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id
       OR existing_enrollment.lead_id IS DISTINCT FROM session_row.lead_id
       OR existing_enrollment.status <> 'active'
       OR existing_enrollment.revoked_at IS NOT NULL
       OR existing_enrollment.expires_at <= save_time THEN
      RAISE EXCEPTION 'moderator organic enrollment is unavailable' USING ERRCODE = '22023';
    END IF;

    SELECT lead_source.* INTO lead_row
      FROM public.leads AS lead_source
     WHERE lead_source.id = existing_enrollment.lead_id
     FOR UPDATE;
    IF lead_row.id IS NULL
       OR lead_row.quiz_kind <> 'legacy'
       OR lead_row.user_id IS DISTINCT FROM p_user_id
       OR lead_row.moderator_campaign_id IS DISTINCT FROM p_campaign_id
       OR lower(btrim(lead_row.email)) <> v_email THEN
      RAISE EXCEPTION 'moderator organic lead owner mismatch' USING ERRCODE = '23505';
    END IF;

    -- Legacy leads do not use the Personal Plan Customer.io outbox.
    -- The durable moderator marker and API boundary suppress commercial dispatch.

    RETURN QUERY SELECT existing_enrollment.lead_id, true;
    RETURN;
  END IF;

  IF session_row.lead_id IS NULL THEN
    IF member.status <> 'ready' THEN
      RAISE EXCEPTION 'moderator organic lead cannot be restarted' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.leads (
      name, email, marketing_consent, quiz_answers, quiz_kind, status, user_id, moderator_campaign_id
    ) VALUES (
      v_name, v_email, p_marketing_consent, p_quiz_answers, 'legacy', 'linked', p_user_id, p_campaign_id
    ) RETURNING id INTO v_lead_id;

    UPDATE public.funnel_sessions AS session_update
       SET lead_id = v_lead_id
     WHERE session_update.id = p_funnel_session_id
       AND session_update.lead_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'moderator organic funnel was already linked' USING ERRCODE = '23505';
    END IF;
  ELSE
    did_reuse := true;
    SELECT lead_source.* INTO lead_row
      FROM public.leads AS lead_source
     WHERE lead_source.id = session_row.lead_id
     FOR UPDATE;
    IF lead_row.id IS NULL
       OR lead_row.quiz_kind <> 'legacy'
       OR lead_row.user_id IS DISTINCT FROM p_user_id
       OR lead_row.moderator_campaign_id IS DISTINCT FROM p_campaign_id
       OR lower(btrim(lead_row.email)) <> v_email THEN
      RAISE EXCEPTION 'moderator organic lead owner mismatch' USING ERRCODE = '23505';
    END IF;
    v_lead_id := lead_row.id;
    UPDATE public.leads AS lead_update
       SET name = v_name,
           marketing_consent = p_marketing_consent,
           quiz_answers = p_quiz_answers,
           status = 'linked'
     WHERE lead_update.id = v_lead_id;
  END IF;

  -- Legacy leads do not use the Personal Plan Customer.io outbox.
  -- The durable moderator marker and API boundary suppress commercial dispatch.

  RETURN QUERY SELECT v_lead_id, did_reuse;
END;
$$;

REVOKE ALL ON FUNCTION public.save_personal_plan_moderator_organic_lead(
  uuid, uuid, text, uuid, text, boolean, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_personal_plan_moderator_organic_lead(
  uuid, uuid, text, uuid, text, boolean, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION private.activate_personal_plan_moderator_organic_test(
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
    RAISE EXCEPTION 'invalid moderator organic activation request' USING ERRCODE = '22023';
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
  IF member.id IS NULL OR member.normalized_email <> v_email THEN
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
       OR existing_enrollment.quiz_source_kind <> 'legacy'
       OR existing_enrollment.campaign_id <> p_campaign_id
       OR existing_enrollment.user_id <> p_user_id
       OR existing_enrollment.lead_id <> p_lead_id
       OR existing_enrollment.funnel_session_id <> p_funnel_session_id
       OR existing_enrollment.prepared_artifact_id IS NOT NULL
       OR existing_enrollment.status <> 'active'
       OR existing_enrollment.revoked_at IS NOT NULL
       OR existing_enrollment.expires_at <= activation_time
       OR access_grant.id IS NULL
       OR access_grant.user_id <> p_user_id
       OR access_grant.reason <> 'tester'
       OR access_grant.revoked_at IS NOT NULL
       OR access_grant.expires_at IS NULL
       OR access_grant.expires_at <= activation_time THEN
      RAISE EXCEPTION 'moderator organic enrollment is unavailable' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY SELECT existing_enrollment.id,
                        existing_enrollment.manual_access_grant_id,
                        NULL::uuid,
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
     AND session.package_key = 'default_organic'
     AND session.lead_id = p_lead_id
     AND session.test_kind = 'field_test'
     AND session.field_test_campaign_id = p_campaign_id
     AND session.user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderator organic funnel context is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.leads AS lead
   WHERE lead.id = p_lead_id
     AND lead.quiz_kind = 'legacy'
     AND lead.email = v_email
     AND lead.moderator_campaign_id = p_campaign_id
     AND lead.user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderator organic lead is invalid' USING ERRCODE = '22023';
  END IF;

  enrollment_expiry := activation_time + pg_catalog.make_interval(hours => campaign.access_duration_hours);

  INSERT INTO public.manual_access_grants (user_id, reason, expires_at)
  VALUES (p_user_id, 'tester', enrollment_expiry)
  RETURNING * INTO access_grant;

  INSERT INTO public.personal_plan_test_enrollments (
    campaign_id,
    funnel_session_id,
    lead_id,
    user_id,
    manual_access_grant_id,
    prepared_artifact_id,
    quiz_source_kind,
    activated_at,
    expires_at
  )
  VALUES (
    p_campaign_id,
    p_funnel_session_id,
    p_lead_id,
    p_user_id,
    access_grant.id,
    NULL,
    'legacy',
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
    'default_organic',
    'field_test_activated',
    activation_time,
    p_lead_id,
    pg_catalog.jsonb_build_object(
      'campaign_id', p_campaign_id,
      'test_kind', 'field_test',
      'identity_mode', 'email_bound',
      'quiz_source_kind', 'legacy'
    )
  )
  ON CONFLICT (event_id) DO NOTHING;

  RETURN QUERY SELECT existing_enrollment.id,
                      existing_enrollment.manual_access_grant_id,
                      NULL::uuid,
                      existing_enrollment.activated_at,
                      existing_enrollment.expires_at,
                      false;
END;
$$;

REVOKE ALL ON FUNCTION private.activate_personal_plan_moderator_organic_test(
  uuid, uuid, uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.activate_personal_plan_moderator_organic_test(
  uuid, uuid, uuid, uuid, text, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_personal_plan_moderator_organic_test(
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
    FROM private.activate_personal_plan_moderator_organic_test(
      p_campaign_id,
      p_funnel_session_id,
      p_lead_id,
      p_user_id,
      p_confirmed_email,
      p_activation_event_id
    );
$$;

REVOKE ALL ON FUNCTION public.activate_personal_plan_moderator_organic_test(
  uuid, uuid, uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_personal_plan_moderator_organic_test(
  uuid, uuid, uuid, uuid, text, text
) TO service_role;

CREATE OR REPLACE FUNCTION private.personal_plan_get_own_routing_source()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source_id uuid;
  v_qualified_at timestamptz;
  v_lead_id uuid;
  v_quiz_source_kind text;
  v_source_kind text;
  v_plan jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT source.id, source.qualified_at, source.lead_id, source.quiz_source_kind, source.source_kind
    INTO v_source_id, v_qualified_at, v_lead_id, v_quiz_source_kind, v_source_kind
  FROM (
    SELECT
      purchase.id,
      purchase.paid_at AS qualified_at,
      consent.lead_id,
      lead.quiz_kind AS quiz_source_kind,
      'paid'::text AS source_kind
    FROM public.billing_one_time_purchases AS purchase
    JOIN public.personal_plan_one_time_checkout_consents AS consent
      ON consent.id = purchase.consent_id
    JOIN public.leads AS lead ON lead.id = consent.lead_id
    WHERE purchase.user_id = v_user_id
      AND consent.user_id = v_user_id
      AND lead.user_id = v_user_id
      AND lead.quiz_kind IN ('legacy', 'personal_plan')
      AND purchase.product_kind = 'personal_plan_once'
      AND purchase.status = 'paid'
      AND consent.confirmation_status IN ('sent', 'delivered')
      AND consent.generation_started_at IS NOT NULL
      AND consent.generation_completed_at IS NOT NULL
      AND consent.generated_content_sha256 IS NOT NULL
      AND consent.delivery_provider IS NOT NULL
      AND consent.delivery_reference IS NOT NULL
      AND consent.delivered_at IS NOT NULL

    UNION ALL

    SELECT
      subscription.id,
      session.purchase_completed_at AS qualified_at,
      session.lead_id,
      lead.quiz_kind AS quiz_source_kind,
      'paid'::text AS source_kind
    FROM public.billing_subscriptions AS subscription
    JOIN public.funnel_sessions AS session
      ON session.user_id = v_user_id
     AND session.purchase_provider = subscription.provider
     AND session.purchase_reference = CASE
       WHEN subscription.provider = 'paypal' THEN subscription.provider_subscription_id
       ELSE subscription.metadata ->> 'checkout_session_id'
     END
    JOIN public.leads AS lead ON lead.id = session.lead_id AND lead.user_id = v_user_id
    WHERE subscription.user_id = v_user_id
      AND subscription.metadata ->> 'pricing_catalog' = 'personal_plan_launch_v1'
      AND session.purchase_completed_at IS NOT NULL
      AND lead.quiz_kind IN ('legacy', 'personal_plan')
      AND (
        subscription.entitlement_status IN ('active', 'past_due')
        OR (
          subscription.entitlement_status = 'canceled'
          AND subscription.current_period_end > pg_catalog.now()
        )
      )
  ) AS source
  ORDER BY source.qualified_at DESC, source.id DESC
  LIMIT 1;

  IF v_source_id IS NULL THEN
    SELECT source.id, source.qualified_at, source.lead_id, source.quiz_source_kind, source.source_kind
      INTO v_source_id, v_qualified_at, v_lead_id, v_quiz_source_kind, v_source_kind
    FROM (
      SELECT
        enrollment.id,
        enrollment.activated_at AS qualified_at,
        enrollment.lead_id,
        lead.quiz_kind AS quiz_source_kind,
        'field_test'::text AS source_kind
      FROM public.personal_plan_test_enrollments AS enrollment
      JOIN public.manual_access_grants AS access_grant
        ON access_grant.id = enrollment.manual_access_grant_id
      JOIN public.leads AS lead ON lead.id = enrollment.lead_id
      WHERE enrollment.user_id = v_user_id
        AND access_grant.user_id = v_user_id
        AND lead.user_id = v_user_id
        AND enrollment.quiz_source_kind = 'personal_plan'
        AND enrollment.prepared_artifact_id IS NOT NULL
        AND lead.quiz_kind = 'personal_plan'
        AND enrollment.status = 'active'
        AND enrollment.revoked_at IS NULL
        AND enrollment.expires_at > pg_catalog.now()
        AND access_grant.reason = 'tester'
        AND access_grant.revoked_at IS NULL
        AND access_grant.expires_at > pg_catalog.now()

      UNION ALL

      SELECT
        enrollment.id,
        enrollment.activated_at AS qualified_at,
        enrollment.lead_id,
        lead.quiz_kind AS quiz_source_kind,
        'field_test'::text AS source_kind
      FROM public.personal_plan_test_enrollments AS enrollment
      JOIN public.manual_access_grants AS access_grant
        ON access_grant.id = enrollment.manual_access_grant_id
      JOIN public.personal_plan_test_members AS member
        ON member.enrollment_id = enrollment.id
       AND member.campaign_id = enrollment.campaign_id
       AND member.user_id = enrollment.user_id
      JOIN public.leads AS lead ON lead.id = enrollment.lead_id
      WHERE enrollment.user_id = v_user_id
        AND access_grant.user_id = v_user_id
        AND lead.user_id = v_user_id
        AND enrollment.quiz_source_kind = 'legacy'
        AND enrollment.prepared_artifact_id IS NULL
        AND lead.quiz_kind = 'legacy'
        AND lead.moderator_campaign_id = enrollment.campaign_id
        AND member.status = 'activated'
        AND member.revoked_at IS NULL
        AND enrollment.status = 'active'
        AND enrollment.revoked_at IS NULL
        AND enrollment.expires_at > pg_catalog.now()
        AND access_grant.reason = 'tester'
        AND access_grant.revoked_at IS NULL
        AND access_grant.expires_at > pg_catalog.now()

      UNION ALL

      SELECT
        enrollment.id,
        enrollment.activated_at AS qualified_at,
        enrollment.lead_id,
        lead.quiz_kind AS quiz_source_kind,
        'field_test'::text AS source_kind
      FROM public.regular_quiz_test_enrollments AS enrollment
      JOIN public.manual_access_grants AS access_grant
        ON access_grant.id = enrollment.manual_access_grant_id
      JOIN public.leads AS lead ON lead.id = enrollment.lead_id
      WHERE enrollment.user_id = v_user_id
        AND access_grant.user_id = v_user_id
        AND lead.user_id = v_user_id
        AND lead.quiz_kind = 'legacy'
        AND enrollment.status = 'active'
        AND enrollment.revoked_at IS NULL
        AND enrollment.expires_at > pg_catalog.now()
        AND access_grant.reason = 'tester'
        AND access_grant.revoked_at IS NULL
        AND access_grant.expires_at > pg_catalog.now()
    ) AS source
    ORDER BY source.qualified_at DESC, source.id DESC
    LIMIT 1;
  END IF;

  IF v_source_id IS NULL OR v_qualified_at IS NULL OR v_lead_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
      'current_initial_need_version_id', plan.current_initial_need_version_id,
      'current_refined_need_version_id', plan.current_refined_need_version_id,
      'pending_routine_proposal_id', plan.pending_routine_proposal_id,
      'active_routine_version_id', plan.active_routine_version_id
    )
    INTO v_plan
  FROM public.personal_plans AS plan
  WHERE plan.user_id = v_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'source_id', v_source_id,
    'qualified_at', v_qualified_at,
    'lead_id', v_lead_id,
    'quiz_source_kind', v_quiz_source_kind,
    'source_kind', v_source_kind,
    'plan', v_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_get_own_routing_source()
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_get_own_routing_source()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_get_own_routing_source()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.personal_plan_get_own_routing_source();
$$;

REVOKE ALL ON FUNCTION public.personal_plan_get_own_routing_source()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.personal_plan_get_own_routing_source()
  TO authenticated, service_role;

COMMENT ON COLUMN public.personal_plan_test_enrollments.quiz_source_kind IS
  'Source quiz contract for service-only Personal Plan field-test enrollment rows.';
COMMENT ON FUNCTION public.save_personal_plan_moderator_organic_lead(uuid, uuid, text, uuid, text, boolean, jsonb) IS
  'Service-only save boundary for email-bound moderator tests that answer the organic legacy quiz.';
COMMENT ON FUNCTION public.activate_personal_plan_moderator_organic_test(uuid, uuid, uuid, uuid, text, text) IS
  'Service-only activation boundary for email-bound moderator organic legacy quiz Personal Plan tests.';

COMMIT;
