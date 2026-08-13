-- Extend the owner-scoped routing source with the regular-quiz field-test
-- enrollment. Paid legacy sources remain distinguishable so the application
-- can keep enforcing its customer cohort and rollout gates.
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

COMMENT ON FUNCTION public.personal_plan_get_own_routing_source() IS
  'Returns the authenticated owner current paid or field-test Personal Plan routing source and minimal frontier.';
