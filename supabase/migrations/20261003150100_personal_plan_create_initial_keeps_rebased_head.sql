-- Central user profile, PR2 — whole-branch review finding W01
-- (plans/2026-10-03-central-user-profile-pr2.md §2, §4a): a plan the facts lane has rebased must
-- never be re-pointed by `public.personal_plan_create_or_reuse_initial_need`.
--
-- WHAT: `CREATE OR REPLACE` of the 10-argument `personal_plan_create_or_reuse_initial_need`
-- only. The body is byte-for-byte the one from 20260828104243_personal_plan_paid_migration_admission
-- .sql plus ONE guard, placed right after the migration-enrolment short-circuit (so after the
-- migration admission checks and the `enrollment_mismatch` check) and before the parameter
-- validation:
--
--   current_initial_need_version_id IS NOT NULL AND applied_facts_revision IS NOT NULL
--     → return the plan's CURRENT initial version ({outcome 'completed', personalPlanId,
--       needVersionId, outputSnapshot}) exactly as the migration short-circuit does, writing
--       nothing, whatever hash was passed.
--
-- WHY: once the facts lane has rebased a plan (`personal_plan_rebase_on_facts_v1`, 20261003150000,
-- sets `applied_facts_revision`), the lane is the only thing that moves it. The creator's last
-- branch ("hash differs" → insert/reuse a version for that hash, stale every in-progress
-- refinement draft and active product draft, re-point the initial head and NULL the refined
-- head) would otherwise destroy the rebase:
--   * Race: a Stage-1 request computes hash H_old from the facts at T0 and sees the plan on
--     H_old, so it proceeds to the creator; a concurrent profile edit rebases the plan to H_new
--     and commits before the creator takes the plan lock; the creator then sees "hash differs",
--     restores the old initial version, NULLs the refined head and stales the clone.
--   * Code rollback: the previous application code computes Stage 1 from the original quiz
--     artifact, so after a rollback every Stage-1 load of a rebased plan would hit that branch.
-- Plans that were never rebased (`applied_facts_revision` NULL) keep today's behaviour unchanged.
-- The 8-argument overload delegates to this function and is not touched; it inherits the guard.
--
-- DEPLOY ORDER: additive in behaviour for existing code — safe to apply before the code deploy.
-- Only `personal_plan_rebase_on_facts_v1` writes `applied_facts_revision` (no backfill, no
-- default), so until the new code's facts lane rebases a plan the guard never fires and the
-- function behaves exactly as 20260828104243. For a rebased plan the new code only reaches the
-- creator with the plan's own hash, which already returned the current version without a write.
--
-- ROLLBACK: re-apply the 10-argument function body and its REVOKE / GRANT from
-- 20260828104243_personal_plan_paid_migration_admission.sql (lines 625–735, 749, 751).

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
  -- W01 (20261003150100): a plan the facts lane has rebased is moved only by that lane. Return its
  -- current initial version exactly as the migration short-circuit above does, whatever hash was
  -- passed, and write nothing.
  IF v_plan.current_initial_need_version_id IS NOT NULL AND v_plan.applied_facts_revision IS NOT NULL THEN
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

REVOKE ALL ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid) TO service_role;
