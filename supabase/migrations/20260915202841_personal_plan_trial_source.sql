-- An unpaid, admitted trial is an enrollment source, not a paid purchase.
-- Keep checkout provenance independent of analytics and replacement agreements.
CREATE OR REPLACE FUNCTION private.personal_plan_resolve_trial_source(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH eligible AS (
    SELECT e.* FROM public.trial_enrollments AS e
    WHERE e.user_id = p_user_id
      AND e.cohort = 'trial_v1'
      AND e.admission_status = 'active'
      AND NOT e.neutralization_required
      AND e.authorization_succeeded_at <= pg_catalog.now()
      AND pg_catalog.isfinite(e.authorization_succeeded_at)
      AND public.trial_enrollment_has_access(e, pg_catalog.now())
      AND EXISTS (
        SELECT 1 FROM public.billing_subscriptions AS b
        WHERE b.trial_enrollment_id = e.id
          AND b.user_id = p_user_id AND b.provider = e.provider
          AND (b.metadata -> 'trial_cohort' IS NULL
            OR b.metadata -> 'trial_cohort' IN ('null'::jsonb, '"trial_v1"'::jsonb))
      )
  ), sources AS (
    SELECT e.id, lead.id AS lead_id, lead.quiz_kind, e.authorization_succeeded_at
    FROM eligible AS e
    JOIN public.trial_checkout_attempts AS attempt ON attempt.enrollment_id = e.id
    JOIN public.leads AS lead ON lead.id = CASE
      WHEN attempt.stripe_params #>> '{metadata,lead_id}'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (attempt.stripe_params #>> '{metadata,lead_id}')::uuid
      ELSE NULL END
    WHERE e.provider = 'stripe' AND attempt.provider = 'stripe'
      AND attempt.status = 'provider_created' AND attempt.provider_reference IS NOT NULL
      AND attempt.stripe_params #>> '{metadata,trial_enrollment_id}' = e.id::text
      AND attempt.stripe_params #>> '{metadata,trial_cohort}' = 'trial_v1'
      AND ((attempt.scope_kind = 'lead' AND attempt.scope_id = lead.id)
        OR (attempt.scope_kind = 'user' AND attempt.scope_id = p_user_id))
      AND lead.user_id = p_user_id AND lead.quiz_kind IN ('legacy', 'personal_plan')
    UNION ALL
    SELECT e.id, lead.id, lead.quiz_kind, e.authorization_succeeded_at
    FROM eligible AS e
    JOIN private.paypal_trial_checkout_attempts AS attempt ON attempt.enrollment_id = e.id
    JOIN public.paypal_checkout_intents AS intent ON intent.id = attempt.intent_id
    JOIN public.leads AS lead ON lead.id = intent.lead_id
    WHERE e.provider = 'paypal'
      AND attempt.status = 'provider_created'
      AND attempt.provider_reference = e.provider_agreement_id
      AND intent.provider_subscription_id = attempt.provider_reference
      AND intent.metadata ->> 'trial_enrollment_id' = e.id::text
      AND intent.metadata ->> 'trial_cohort' = 'trial_v1'
      AND (intent.user_id IS NULL OR intent.user_id = p_user_id)
      AND ((attempt.scope_kind = 'lead' AND attempt.scope_id = lead.id)
        OR (attempt.scope_kind = 'user' AND attempt.scope_id = p_user_id))
      AND lead.user_id = p_user_id AND lead.quiz_kind IN ('legacy', 'personal_plan')
  ), distinct_sources AS (SELECT DISTINCT * FROM sources)
  SELECT CASE WHEN count(*) = 1 THEN (jsonb_agg(jsonb_build_object(
    'enrollment_id', id, 'lead_id', lead_id, 'quiz_source_kind', quiz_kind,
    'qualified_at', authorization_succeeded_at
  )) -> 0) ELSE NULL END FROM distinct_sources;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_resolve_trial_source(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.personal_plan_resolve_trial_source(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_resolve_trial_source(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.personal_plan_resolve_trial_source(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.personal_plan_resolve_trial_source(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_resolve_trial_source(uuid) TO service_role;

-- Preserve established paid/field-test/migration precedence and auth.uid scope.
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
  v_migration_status text;
  v_admission_kind text;
  v_admission_source_id uuid;
  v_plan jsonb;
  v_authority record;
  v_trial jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_authority
    FROM private.personal_plan_current_paid_migration_authority(v_user_id);

  IF v_authority.admission_source_id IS NOT NULL THEN
    SELECT
      enrollment.id,
      enrollment.admitted_at,
      enrollment.lead_id,
      lead.quiz_kind,
      'migration',
      enrollment.status,
      v_authority.admission_kind,
      v_authority.admission_source_id
      INTO v_source_id, v_qualified_at, v_lead_id, v_quiz_source_kind,
           v_source_kind, v_migration_status, v_admission_kind, v_admission_source_id
      FROM public.personal_plan_migration_enrollments AS enrollment
      LEFT JOIN public.leads AS lead
        ON lead.id = enrollment.lead_id
       AND lead.user_id = v_user_id
     WHERE enrollment.user_id = v_user_id
       AND enrollment.status = 'ready';
  END IF;

  IF v_source_id IS NULL THEN
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
  END IF;

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

  IF v_source_id IS NULL THEN
    v_trial := private.personal_plan_resolve_trial_source(v_user_id);
    IF v_trial IS NOT NULL THEN
      v_source_id := (v_trial ->> 'enrollment_id')::uuid;
      v_qualified_at := (v_trial ->> 'qualified_at')::timestamptz;
      v_lead_id := (v_trial ->> 'lead_id')::uuid;
      v_quiz_source_kind := v_trial ->> 'quiz_source_kind';
      v_source_kind := 'trial';
    END IF;
  END IF;

  IF v_source_id IS NULL THEN
    IF v_authority.admission_source_id IS NOT NULL THEN
      SELECT
        enrollment.id,
        enrollment.admitted_at,
        enrollment.lead_id,
        lead.quiz_kind,
        enrollment.status,
        enrollment.admission_kind,
        enrollment.admission_source_id
        INTO v_source_id, v_qualified_at, v_lead_id, v_quiz_source_kind,
             v_migration_status, v_admission_kind, v_admission_source_id
        FROM public.personal_plan_migration_enrollments AS enrollment
        LEFT JOIN public.leads AS lead
          ON lead.id = enrollment.lead_id
         AND lead.user_id = v_user_id
       WHERE enrollment.user_id = v_user_id;

      IF v_source_id IS NULL THEN
        v_source_id := v_authority.admission_source_id;
        v_qualified_at := v_authority.qualified_at;
        v_source_kind := 'migration';
        v_migration_status := 'candidate';
        v_admission_kind := v_authority.admission_kind;
        v_admission_source_id := v_authority.admission_source_id;
      ELSE
        v_source_kind := 'migration';
      END IF;
    END IF;
  END IF;

  IF v_source_id IS NULL OR v_qualified_at IS NULL THEN
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
    'migration_status', v_migration_status,
    'admission_kind', v_admission_kind,
    'admission_source_id', v_admission_source_id,
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

