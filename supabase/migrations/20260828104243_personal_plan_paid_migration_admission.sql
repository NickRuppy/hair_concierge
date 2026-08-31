BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.personal_plan_migration_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_kind text NOT NULL CHECK (
    admission_kind IN ('billing_subscription', 'one_time_purchase', 'legacy_profile')
  ),
  admission_source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_source' CHECK (status IN ('pending_source', 'ready')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  admitted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  bound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT personal_plan_migration_enrollments_ready_source_check CHECK (
    (status = 'ready' AND lead_id IS NOT NULL AND bound_at IS NOT NULL)
    OR (status = 'pending_source' AND lead_id IS NULL AND bound_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS personal_plan_migration_enrollments_authority_idx
  ON public.personal_plan_migration_enrollments(admission_kind, admission_source_id);
CREATE INDEX IF NOT EXISTS personal_plan_migration_enrollments_lead_idx
  ON public.personal_plan_migration_enrollments(lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.personal_plan_migration_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_migration_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_plan_migration_enrollments
  TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_personal_plan_migration_enrollments
  ON public.personal_plan_migration_enrollments;
CREATE TRIGGER set_updated_at_personal_plan_migration_enrollments
  BEFORE UPDATE ON public.personal_plan_migration_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.personal_plan_current_paid_migration_authority(
  p_user_id uuid
)
RETURNS TABLE (
  admission_kind text,
  admission_source_id uuid,
  qualified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT candidate.admission_kind, candidate.admission_source_id, candidate.qualified_at
  FROM (
    SELECT
      'billing_subscription'::text AS admission_kind,
      subscription.id AS admission_source_id,
      COALESCE(subscription.current_period_end, subscription.updated_at, subscription.created_at) AS qualified_at,
      1 AS source_rank,
      CASE subscription.entitlement_status
        WHEN 'active' THEN 1
        WHEN 'past_due' THEN 2
        WHEN 'canceled' THEN 3
        ELSE 4
      END AS status_rank,
      subscription.current_period_end AS period_sort,
      subscription.updated_at AS updated_sort
    FROM public.billing_subscriptions AS subscription
    WHERE subscription.user_id = p_user_id
      AND (
        (
          subscription.entitlement_status IN ('active', 'past_due')
          AND (
            subscription.current_period_end IS NULL
            OR subscription.current_period_end >= pg_catalog.now() - interval '1 day'
          )
        )
        OR (
          subscription.entitlement_status = 'canceled'
          AND subscription.cancel_at_period_end
          AND subscription.current_period_end > pg_catalog.now()
        )
      )

    UNION ALL

    SELECT
      'one_time_purchase'::text AS admission_kind,
      purchase.id AS admission_source_id,
      purchase.paid_at AS qualified_at,
      2 AS source_rank,
      1 AS status_rank,
      purchase.paid_at AS period_sort,
      purchase.updated_at AS updated_sort
    FROM public.billing_one_time_purchases AS purchase
    JOIN public.personal_plan_one_time_checkout_consents AS consent
      ON consent.id = purchase.consent_id
    WHERE purchase.user_id = p_user_id
      AND consent.user_id = p_user_id
      AND purchase.consent_id = consent.id
      AND purchase.product_kind = 'personal_plan_once'
      AND purchase.status = 'paid'
      AND consent.product_kind = 'personal_plan_once'
      AND consent.confirmation_status IN ('sent', 'delivered')
      AND consent.generation_started_at IS NOT NULL
      AND consent.generation_completed_at IS NOT NULL
      AND consent.generated_content_sha256 IS NOT NULL
      AND consent.delivery_provider IS NOT NULL
      AND consent.delivery_reference IS NOT NULL
      AND consent.delivered_at IS NOT NULL

    UNION ALL

    SELECT
      'legacy_profile'::text AS admission_kind,
      profile.id AS admission_source_id,
      COALESCE(profile.current_period_end, profile.updated_at, profile.created_at) AS qualified_at,
      3 AS source_rank,
      CASE profile.subscription_status
        WHEN 'active' THEN 1
        WHEN 'past_due' THEN 2
        WHEN 'canceled' THEN 3
        ELSE 4
      END AS status_rank,
      profile.current_period_end AS period_sort,
      profile.updated_at AS updated_sort
    FROM public.profiles AS profile
    WHERE profile.id = p_user_id
      AND (
        (
          profile.subscription_status IN ('active', 'past_due')
          AND (
            profile.current_period_end IS NULL
            OR profile.current_period_end >= pg_catalog.now() - interval '1 day'
          )
        )
        OR (
          profile.subscription_status = 'canceled'
          AND profile.current_period_end > pg_catalog.now()
        )
      )
  ) AS candidate
  ORDER BY
    candidate.source_rank,
    candidate.status_rank,
    candidate.period_sort DESC NULLS LAST,
    candidate.updated_sort DESC NULLS LAST,
    candidate.admission_source_id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_current_paid_migration_authority(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_current_paid_migration_authority(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION private.personal_plan_migration_exact_paid_lead(
  p_user_id uuid,
  p_admission_kind text,
  p_admission_source_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lead_id uuid;
  v_lead_count integer;
BEGIN
  IF p_admission_kind = 'one_time_purchase' THEN
    SELECT lead.id INTO v_lead_id
      FROM public.billing_one_time_purchases AS purchase
      JOIN public.personal_plan_one_time_checkout_consents AS consent
        ON consent.id = purchase.consent_id
      JOIN public.leads AS lead
        ON lead.id = consent.lead_id
     WHERE purchase.id = p_admission_source_id
       AND purchase.user_id = p_user_id
       AND consent.user_id = p_user_id
       AND lead.user_id = p_user_id
       AND lead.quiz_kind IN ('legacy', 'personal_plan')
     LIMIT 1;
    RETURN v_lead_id;
  END IF;

  IF p_admission_kind = 'billing_subscription' THEN
    WITH correlated_leads AS (
      SELECT DISTINCT lead.id
        FROM public.billing_subscriptions AS subscription
        JOIN public.funnel_sessions AS session
          ON session.user_id = p_user_id
         AND session.purchase_provider = subscription.provider
         AND session.purchase_reference = CASE
           WHEN subscription.provider = 'paypal' THEN subscription.provider_subscription_id
           ELSE subscription.metadata ->> 'checkout_session_id'
         END
        JOIN public.leads AS lead
          ON lead.id = session.lead_id
         AND lead.user_id = p_user_id
         AND lead.quiz_kind IN ('legacy', 'personal_plan')
       WHERE subscription.id = p_admission_source_id
         AND subscription.user_id = p_user_id
         AND session.purchase_completed_at IS NOT NULL
       LIMIT 2
    )
    SELECT pg_catalog.count(*)::integer, (array_agg(id ORDER BY id))[1]
      INTO v_lead_count, v_lead_id
      FROM correlated_leads;

    IF v_lead_count = 1 THEN
      RETURN v_lead_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_migration_exact_paid_lead(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_migration_exact_paid_lead(uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION private.personal_plan_select_migration_lead(
  p_user_id uuid,
  p_admission_kind text,
  p_admission_source_id uuid,
  p_requested_lead_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lead_id uuid;
  v_lead_count integer;
BEGIN
  IF p_requested_lead_id IS NOT NULL THEN
    SELECT lead.id INTO v_lead_id
      FROM public.leads AS lead
     WHERE lead.id = p_requested_lead_id
       AND lead.user_id = p_user_id
       AND lead.quiz_kind IN ('legacy', 'personal_plan');
    RETURN v_lead_id;
  END IF;

  v_lead_id := private.personal_plan_migration_exact_paid_lead(
    p_user_id,
    p_admission_kind,
    p_admission_source_id
  );
  IF v_lead_id IS NOT NULL THEN
    RETURN v_lead_id;
  END IF;

  WITH owned_candidates AS (
    SELECT candidate.id
      FROM public.leads AS candidate
     WHERE candidate.user_id = p_user_id
       AND candidate.quiz_kind IN ('legacy', 'personal_plan')
       AND candidate.status = 'linked'
     ORDER BY candidate.created_at DESC, candidate.id DESC
     LIMIT 2
  )
  SELECT pg_catalog.count(*)::integer, (array_agg(id ORDER BY id))[1]
    INTO v_lead_count, v_lead_id
    FROM owned_candidates;

  IF v_lead_count = 1 THEN
    RETURN v_lead_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_select_migration_lead(uuid, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_select_migration_lead(uuid, text, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_resolve_migration_admission(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_authority record;
  v_enrollment public.personal_plan_migration_enrollments%ROWTYPE;
  v_quiz_source_kind text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT * INTO v_authority
    FROM private.personal_plan_current_paid_migration_authority(p_user_id);

  IF v_authority.admission_source_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT * INTO v_enrollment
    FROM public.personal_plan_migration_enrollments AS enrollment
   WHERE enrollment.user_id = p_user_id;

  IF v_enrollment.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'candidate',
      'admission_kind', v_authority.admission_kind,
      'admission_source_id', v_authority.admission_source_id
    );
  END IF;

  SELECT lead.quiz_kind INTO v_quiz_source_kind
    FROM public.leads AS lead
   WHERE lead.id = v_enrollment.lead_id
     AND lead.user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', v_enrollment.status,
    'enrollment_id', v_enrollment.id,
    'admission_kind', v_authority.admission_kind,
    'admission_source_id', v_authority.admission_source_id,
    'lead_id', v_enrollment.lead_id,
    'admitted_at', v_enrollment.admitted_at,
    'quiz_source_kind', v_quiz_source_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_resolve_migration_admission(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_resolve_migration_admission(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_begin_or_bind_migration(
  p_user_id uuid,
  p_requested_lead_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_authority record;
  v_enrollment public.personal_plan_migration_enrollments%ROWTYPE;
  v_selected_lead_id uuid;
  v_has_stage1 boolean;
  v_quiz_source_kind text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'ineligible');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal_plan_migration:' || p_user_id::text, 0)
  );

  SELECT * INTO v_authority
    FROM private.personal_plan_current_paid_migration_authority(p_user_id);

  IF v_authority.admission_source_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT * INTO v_enrollment
    FROM public.personal_plan_migration_enrollments AS enrollment
   WHERE enrollment.user_id = p_user_id
   FOR UPDATE;

  IF v_enrollment.id IS NULL AND EXISTS (
    SELECT 1
      FROM public.personal_plans AS plan
     WHERE plan.user_id = p_user_id
       AND plan.current_initial_need_version_id IS NOT NULL
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'ineligible');
  END IF;

  IF v_enrollment.id IS NULL THEN
    INSERT INTO public.personal_plan_migration_enrollments(
      user_id, admission_kind, admission_source_id
    ) VALUES (
      p_user_id, v_authority.admission_kind, v_authority.admission_source_id
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_enrollment;

    IF v_enrollment.id IS NULL THEN
      SELECT * INTO v_enrollment
        FROM public.personal_plan_migration_enrollments AS enrollment
       WHERE enrollment.user_id = p_user_id
       FOR UPDATE;
    END IF;
  END IF;

  IF v_enrollment.admission_kind IS DISTINCT FROM v_authority.admission_kind
     OR v_enrollment.admission_source_id IS DISTINCT FROM v_authority.admission_source_id THEN
    UPDATE public.personal_plan_migration_enrollments AS enrollment
       SET admission_kind = v_authority.admission_kind,
           admission_source_id = v_authority.admission_source_id,
           admitted_at = pg_catalog.now()
     WHERE enrollment.id = v_enrollment.id
     RETURNING * INTO v_enrollment;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.personal_plans AS plan
     WHERE plan.user_id = p_user_id
       AND plan.enrollment_purchase_source_id = v_enrollment.id
       AND plan.current_initial_need_version_id IS NOT NULL
  ) INTO v_has_stage1;

  v_selected_lead_id := private.personal_plan_select_migration_lead(
    p_user_id,
    v_enrollment.admission_kind,
    v_enrollment.admission_source_id,
    CASE
      WHEN v_has_stage1 THEN NULL
      ELSE p_requested_lead_id
    END
  );

  IF v_selected_lead_id IS NOT NULL
     AND (
       v_enrollment.lead_id IS NULL
       OR (NOT v_has_stage1 AND v_enrollment.lead_id IS DISTINCT FROM v_selected_lead_id)
     ) THEN
    UPDATE public.personal_plan_migration_enrollments AS enrollment
       SET lead_id = v_selected_lead_id,
           status = 'ready',
           bound_at = COALESCE(enrollment.bound_at, pg_catalog.now())
     WHERE enrollment.id = v_enrollment.id
     RETURNING * INTO v_enrollment;
  END IF;

  SELECT lead.quiz_kind INTO v_quiz_source_kind
    FROM public.leads AS lead
   WHERE lead.id = v_enrollment.lead_id
     AND lead.user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', v_enrollment.status,
    'enrollment_id', v_enrollment.id,
    'admission_kind', v_enrollment.admission_kind,
    'admission_source_id', v_enrollment.admission_source_id,
    'lead_id', v_enrollment.lead_id,
    'admitted_at', v_enrollment.admitted_at,
    'quiz_source_kind', v_quiz_source_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_begin_or_bind_migration(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_begin_or_bind_migration(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_save_migration_quiz_lead(
  p_user_id uuid,
  p_enrollment_id uuid,
  p_name text,
  p_email text,
  p_marketing_consent boolean,
  p_quiz_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_authority record;
  v_enrollment public.personal_plan_migration_enrollments%ROWTYPE;
  v_auth_user auth.users%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_existing_lead public.leads%ROWTYPE;
  v_lead_id uuid;
  v_email text := lower(btrim(p_email));
  v_name text := COALESCE(p_name, '');
BEGIN
  IF p_user_id IS NULL
     OR p_enrollment_id IS NULL
     OR v_email IS NULL
     OR v_email = ''
     OR btrim(v_name) = ''
     OR p_marketing_consent IS NULL
     OR p_quiz_answers IS NULL
     OR pg_catalog.jsonb_typeof(p_quiz_answers) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal_plan_migration:' || p_user_id::text, 0)
  );

  SELECT auth_user_row.* INTO v_auth_user
    FROM auth.users AS auth_user_row
   WHERE auth_user_row.id = p_user_id
   FOR UPDATE;

  IF v_auth_user.id IS NULL
     OR lower(btrim(v_auth_user.email)) <> v_email
     OR v_auth_user.email_confirmed_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
  END IF;

  SELECT profile.* INTO v_profile
    FROM public.profiles AS profile
   WHERE profile.id = p_user_id
   FOR UPDATE;

  IF v_profile.id IS NULL
     OR (v_profile.email IS NOT NULL AND lower(btrim(v_profile.email)) <> v_email) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
  END IF;

  SELECT * INTO v_authority
    FROM private.personal_plan_current_paid_migration_authority(p_user_id);

  IF v_authority.admission_source_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
  END IF;

  SELECT * INTO v_enrollment
    FROM public.personal_plan_migration_enrollments AS enrollment
   WHERE enrollment.id = p_enrollment_id
   FOR UPDATE;

  IF v_enrollment.id IS NULL
     OR v_enrollment.user_id IS DISTINCT FROM p_user_id THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.personal_plans AS plan
     WHERE plan.user_id = p_user_id
       AND (
         plan.current_initial_need_version_id IS NOT NULL
         OR (plan.enrollment_purchase_source_id IS NOT NULL
             AND plan.enrollment_purchase_source_id IS DISTINCT FROM p_enrollment_id)
       )
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
  END IF;

  IF v_enrollment.admission_kind IS DISTINCT FROM v_authority.admission_kind
     OR v_enrollment.admission_source_id IS DISTINCT FROM v_authority.admission_source_id THEN
    UPDATE public.personal_plan_migration_enrollments AS enrollment
       SET admission_kind = v_authority.admission_kind,
           admission_source_id = v_authority.admission_source_id,
           admitted_at = pg_catalog.now()
     WHERE enrollment.id = v_enrollment.id
     RETURNING * INTO v_enrollment;
  END IF;

  IF v_enrollment.lead_id IS NOT NULL THEN
    SELECT lead.* INTO v_existing_lead
      FROM public.leads AS lead
     WHERE lead.id = v_enrollment.lead_id
     FOR UPDATE;

    IF v_existing_lead.id IS NULL
       OR v_existing_lead.user_id IS DISTINCT FROM p_user_id
       OR v_existing_lead.quiz_kind NOT IN ('legacy', 'personal_plan') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_context');
    END IF;

    IF v_existing_lead.quiz_kind = 'legacy'
       AND lower(btrim(v_existing_lead.email)) = v_email
       AND COALESCE(v_existing_lead.name, '') = v_name
       AND v_existing_lead.marketing_consent IS NOT DISTINCT FROM p_marketing_consent
       AND v_existing_lead.quiz_answers = p_quiz_answers THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'saved',
        'lead_id', v_existing_lead.id
      );
    END IF;
  END IF;

  INSERT INTO public.leads (
    name, email, marketing_consent, quiz_answers, quiz_kind, status, user_id
  ) VALUES (
    v_name, v_email, p_marketing_consent, p_quiz_answers, 'legacy', 'linked', p_user_id
  ) RETURNING id INTO v_lead_id;

  UPDATE public.personal_plan_migration_enrollments AS enrollment
     SET lead_id = v_lead_id,
         status = 'ready',
         bound_at = COALESCE(enrollment.bound_at, pg_catalog.now())
   WHERE enrollment.id = v_enrollment.id
   RETURNING * INTO v_enrollment;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'saved',
    'lead_id', v_lead_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_save_migration_quiz_lead(
  uuid, uuid, text, text, boolean, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_migration_quiz_lead(
  uuid, uuid, text, text, boolean, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_initial_need(
  p_user_id uuid, p_enrollment_purchase_source_id uuid, p_prepared_artifact_source_id uuid,
  p_schema_version integer, p_computation_version text, p_input_hash text,
  p_input_snapshot jsonb, p_output_snapshot jsonb,
  p_stage1_source_kind text, p_stage1_source_lead_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_need_id uuid;
  v_output_snapshot jsonb;
  v_migration public.personal_plan_migration_enrollments%ROWTYPE;
  v_has_current_paid_authority boolean;
  v_migration_lead_quiz_kind text;
BEGIN
  SELECT * INTO v_migration
    FROM public.personal_plan_migration_enrollments AS enrollment
   WHERE enrollment.id = p_enrollment_purchase_source_id
   FOR UPDATE;

  IF v_migration.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM private.personal_plan_current_paid_migration_authority(p_user_id)
    ) INTO v_has_current_paid_authority;

    SELECT lead.quiz_kind INTO v_migration_lead_quiz_kind
      FROM public.leads AS lead
     WHERE lead.id = v_migration.lead_id
       AND lead.user_id = p_user_id
       AND lead.quiz_kind IN ('legacy', 'personal_plan');

    IF NOT v_has_current_paid_authority
       OR v_migration.user_id IS DISTINCT FROM p_user_id
       OR v_migration.status <> 'ready'
       OR v_migration_lead_quiz_kind IS NULL
       OR NOT (
         (
           p_stage1_source_kind = 'legacy_quiz_lead'
           AND v_migration.lead_id IS NOT DISTINCT FROM p_stage1_source_lead_id
           AND p_stage1_source_lead_id IS NOT NULL
           AND p_prepared_artifact_source_id IS NULL
         )
         OR (
           p_stage1_source_kind = 'personal_plan_artifact'
           AND p_stage1_source_lead_id IS NULL
           AND p_prepared_artifact_source_id IS NOT NULL
           AND EXISTS (
             SELECT 1
               FROM public.personal_plan_prepared_artifacts AS artifact
              WHERE artifact.id = p_prepared_artifact_source_id
                AND artifact.user_id = p_user_id
                AND artifact.lead_id = v_migration.lead_id
                AND artifact.status = 'attached'
           )
         )
       ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'outcome', 'invalid_source',
        'reasonCode', 'migration_source_mismatch'
      );
    END IF;
  END IF;

  INSERT INTO public.personal_plans(user_id,enrollment_purchase_source_id)
  VALUES(p_user_id,p_enrollment_purchase_source_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_plan FROM public.personal_plans WHERE user_id=p_user_id FOR UPDATE;
  IF v_plan.enrollment_purchase_source_id IS DISTINCT FROM p_enrollment_purchase_source_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','enrollment_mismatch');
  END IF;
  IF v_migration.id IS NOT NULL AND v_plan.current_initial_need_version_id IS NOT NULL THEN
    SELECT output_snapshot INTO v_output_snapshot
      FROM public.personal_plan_need_versions
      WHERE id=v_plan.current_initial_need_version_id
        AND user_id=p_user_id
        AND personal_plan_id=v_plan.id;
    RETURN pg_catalog.jsonb_build_object(
      'outcome','completed',
      'personalPlanId',v_plan.id,
      'needVersionId',v_plan.current_initial_need_version_id,
      'outputSnapshot',v_output_snapshot
    );
  END IF;
  IF p_schema_version <= 0 OR p_computation_version='' OR p_input_hash !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_input_snapshot) <> 'object' OR pg_catalog.jsonb_typeof(p_output_snapshot) <> 'object'
     OR NOT ((p_stage1_source_kind = 'personal_plan_artifact' AND p_prepared_artifact_source_id IS NOT NULL AND p_stage1_source_lead_id IS NULL)
          OR (p_stage1_source_kind = 'legacy_quiz_lead' AND p_prepared_artifact_source_id IS NULL AND p_stage1_source_lead_id IS NOT NULL)) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','invalid_initial_need');
  END IF;
  IF v_migration.id IS NULL AND (
    (p_stage1_source_kind = 'personal_plan_artifact' AND NOT EXISTS (
      SELECT 1 FROM public.personal_plan_prepared_artifacts
      WHERE id=p_prepared_artifact_source_id AND user_id=p_user_id AND status='attached'
    )) OR (p_stage1_source_kind = 'legacy_quiz_lead' AND NOT EXISTS (
      SELECT 1 FROM public.leads
      WHERE id=p_stage1_source_lead_id AND user_id=p_user_id AND quiz_kind='legacy'
    ))
  ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','source_owner_mismatch');
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
  RETURN pg_catalog.jsonb_build_object('outcome','completed','personalPlanId',v_plan.id,'needVersionId',v_need_id,'outputSnapshot',v_output_snapshot);
END;
$$;

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

COMMENT ON TABLE public.personal_plan_migration_enrollments IS
  'Admission/source binding ledger for current paid users entering the Personal Plan after the legacy onboarding cutoff. This table does not grant access.';
COMMENT ON FUNCTION public.personal_plan_resolve_migration_admission(uuid) IS
  'Service-only read boundary for current paid migration admission; performs no writes.';
COMMENT ON FUNCTION public.personal_plan_begin_or_bind_migration(uuid, uuid) IS
  'Service-only current paid migration enrollment and owned quiz-source binding boundary.';
COMMENT ON FUNCTION public.personal_plan_save_migration_quiz_lead(uuid, uuid, text, text, boolean, jsonb) IS
  'Service-only save boundary for authenticated paid migration quiz completion; creates fresh owned legacy leads without funnel or payment attribution.';

COMMIT;
