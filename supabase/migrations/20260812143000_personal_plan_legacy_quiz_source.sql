-- Preserve the historic prepared-artifact source while admitting an exact
-- regular-quiz lead as the immutable initial Stage-1 authority.
ALTER TABLE public.personal_plan_need_versions
  ADD COLUMN stage1_source_kind text,
  ADD COLUMN stage1_source_lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT;

UPDATE public.personal_plan_need_versions
  SET stage1_source_kind = 'personal_plan_artifact'
  WHERE kind = 'initial';

ALTER TABLE public.personal_plan_need_versions
  ADD CONSTRAINT personal_plan_need_versions_initial_stage1_source_check CHECK (
    kind <> 'initial' OR (
      (stage1_source_kind = 'personal_plan_artifact'
        AND prepared_artifact_source_id IS NOT NULL
        AND stage1_source_lead_id IS NULL)
      OR
      (stage1_source_kind = 'legacy_quiz_lead'
        AND prepared_artifact_source_id IS NULL
        AND stage1_source_lead_id IS NOT NULL)
    )
  );

CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_initial_need(
  p_user_id uuid, p_enrollment_purchase_source_id uuid, p_prepared_artifact_source_id uuid,
  p_schema_version integer, p_computation_version text, p_input_hash text,
  p_input_snapshot jsonb, p_output_snapshot jsonb,
  p_stage1_source_kind text, p_stage1_source_lead_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE; v_need_id uuid; v_output_snapshot jsonb;
BEGIN
  INSERT INTO public.personal_plans(user_id,enrollment_purchase_source_id)
  VALUES(p_user_id,p_enrollment_purchase_source_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_plan FROM public.personal_plans WHERE user_id=p_user_id FOR UPDATE;
  IF v_plan.enrollment_purchase_source_id IS DISTINCT FROM p_enrollment_purchase_source_id THEN
    RETURN jsonb_build_object('outcome','invalid_source','reasonCode','enrollment_mismatch');
  END IF;
  IF p_schema_version <= 0 OR p_computation_version='' OR p_input_hash !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_input_snapshot) <> 'object' OR pg_catalog.jsonb_typeof(p_output_snapshot) <> 'object'
     OR NOT ((p_stage1_source_kind = 'personal_plan_artifact' AND p_prepared_artifact_source_id IS NOT NULL AND p_stage1_source_lead_id IS NULL)
          OR (p_stage1_source_kind = 'legacy_quiz_lead' AND p_prepared_artifact_source_id IS NULL AND p_stage1_source_lead_id IS NOT NULL)) THEN
    RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_initial_need');
  END IF;
  IF (p_stage1_source_kind = 'personal_plan_artifact' AND NOT EXISTS (
        SELECT 1 FROM public.personal_plan_prepared_artifacts
        WHERE id=p_prepared_artifact_source_id AND user_id=p_user_id AND status='attached'
      )) OR (p_stage1_source_kind = 'legacy_quiz_lead' AND NOT EXISTS (
        SELECT 1 FROM public.leads
        WHERE id=p_stage1_source_lead_id AND user_id=p_user_id AND quiz_kind='legacy'
      )) THEN
    RETURN jsonb_build_object('outcome','invalid_source','reasonCode','source_owner_mismatch');
  END IF;
  INSERT INTO public.personal_plan_need_versions(user_id,personal_plan_id,kind,prepared_artifact_source_id,stage1_source_kind,stage1_source_lead_id,schema_version,computation_version,input_hash,input_snapshot,output_snapshot)
  VALUES(p_user_id,v_plan.id,'initial',p_prepared_artifact_source_id,p_stage1_source_kind,p_stage1_source_lead_id,p_schema_version,p_computation_version,p_input_hash,p_input_snapshot,p_output_snapshot)
  ON CONFLICT (personal_plan_id,input_hash) WHERE kind='initial' DO NOTHING RETURNING id INTO v_need_id;
  IF v_need_id IS NULL THEN SELECT id INTO v_need_id FROM public.personal_plan_need_versions WHERE personal_plan_id=v_plan.id AND kind='initial' AND input_hash=p_input_hash; END IF;
  IF v_plan.current_initial_need_version_id IS DISTINCT FROM v_need_id THEN
    UPDATE public.personal_plan_refinement_drafts SET status='stale', updated_at=pg_catalog.now() WHERE personal_plan_id=v_plan.id AND status='in_progress';
    UPDATE public.personal_plan_product_drafts SET status='stale', updated_at=pg_catalog.now() WHERE personal_plan_id=v_plan.id AND status='active';
    UPDATE public.personal_plans SET current_initial_need_version_id=v_need_id,current_refined_need_version_id=NULL,revision=revision+1 WHERE id=v_plan.id;
  END IF;
  SELECT output_snapshot INTO v_output_snapshot FROM public.personal_plan_need_versions WHERE id=v_need_id AND user_id=p_user_id AND personal_plan_id=v_plan.id;
  RETURN jsonb_build_object('outcome','completed','personalPlanId',v_plan.id,'needVersionId',v_need_id,'outputSnapshot',v_output_snapshot);
END;
$$;

-- Keep the old code-before-migration call shape working during a guarded
-- migration-first deploy while forcing it through the new provenance checks.
CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_initial_need(
  p_user_id uuid, p_enrollment_purchase_source_id uuid, p_prepared_artifact_source_id uuid,
  p_schema_version integer, p_computation_version text, p_input_hash text,
  p_input_snapshot jsonb, p_output_snapshot jsonb
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.personal_plan_create_or_reuse_initial_need(
    p_user_id, p_enrollment_purchase_source_id, p_prepared_artifact_source_id,
    p_schema_version, p_computation_version, p_input_hash,
    p_input_snapshot, p_output_snapshot, 'personal_plan_artifact', NULL
  );
$$;

REVOKE ALL ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb) TO service_role;

-- The authenticated middleware cannot read private checkout consent or funnel
-- attribution rows directly. Return only the current owner's exact paid source
-- and minimal durable frontier; all release decisions remain in TypeScript.
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
  v_plan jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT source.id, source.qualified_at, source.lead_id, source.quiz_source_kind
    INTO v_source_id, v_qualified_at, v_lead_id, v_quiz_source_kind
  FROM (
    SELECT
      purchase.id,
      purchase.paid_at AS qualified_at,
      consent.lead_id,
      lead.quiz_kind AS quiz_source_kind
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
      lead.quiz_kind AS quiz_source_kind
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
    SELECT enrollment.id, enrollment.activated_at, enrollment.lead_id, lead.quiz_kind
      INTO v_source_id, v_qualified_at, v_lead_id, v_quiz_source_kind
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
    ORDER BY enrollment.activated_at DESC
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
    'plan', v_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_get_own_routing_source()
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_get_own_routing_source()
  TO authenticated, service_role;

-- PostgREST exposes only this invoker wrapper. The RLS-bypassing lookup stays
-- in the private schema and derives ownership exclusively from auth.uid().
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
