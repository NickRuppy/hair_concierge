BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.personal_plans
  ADD COLUMN IF NOT EXISTS legacy_prefill_v1 jsonb
    CHECK (legacy_prefill_v1 IS NULL OR pg_catalog.jsonb_typeof(legacy_prefill_v1) = 'object');

COMMENT ON COLUMN public.personal_plans.legacy_prefill_v1 IS
  'One-time legacy onboarding prefill receipts. stage2 records the optional refinement entry outcome so old quiz facts are consumed at most once.';

CREATE OR REPLACE FUNCTION public.personal_plan_open_optional_refinement_v1(
  p_user_id uuid,
  p_module text,
  p_expected_personal_plan_id uuid,
  p_expected_base_initial_need_version_id uuid,
  p_expected_parent_draft_id uuid,
  p_expected_parent_revision bigint,
  p_seed_outcome text,
  p_seed_answers jsonb,
  p_seed_completed_question_ids text[],
  p_seed_answer_provenance jsonb,
  p_source_fingerprint text,
  p_source_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_current public.personal_plan_refinement_drafts%ROWTYPE;
  v_parent public.personal_plan_refinement_drafts%ROWTYPE;
  v_result public.personal_plan_refinement_drafts%ROWTYPE;
  v_enrollment public.personal_plan_migration_enrollments%ROWTYPE;
  v_outcome text;
  v_receipt jsonb;
  v_has_current_paid_authority boolean := false;
  v_parent_fully_assumed boolean := false;
BEGIN
  IF p_user_id IS NULL
     OR p_module NOT IN ('products', 'habits')
     OR p_expected_personal_plan_id IS NULL
     OR p_expected_base_initial_need_version_id IS NULL
     OR p_seed_outcome NOT IN ('applied', 'nothing_usable', 'skipped_existing_state')
     OR pg_catalog.jsonb_typeof(p_seed_answers) <> 'object'
     OR pg_catalog.jsonb_typeof(p_seed_answer_provenance) <> 'object'
     OR p_seed_completed_question_ids IS NULL
     OR p_source_fingerprint IS NULL
     OR pg_catalog.length(p_source_fingerprint) = 0
     OR p_source_ids IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;

  SELECT * INTO v_plan
    FROM public.personal_plans AS plan
   WHERE plan.id = p_expected_personal_plan_id
     AND plan.user_id = p_user_id
   FOR UPDATE;

  IF v_plan.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;

  SELECT * INTO v_current
    FROM public.personal_plan_refinement_drafts AS draft
   WHERE draft.personal_plan_id = v_plan.id
     AND draft.user_id = p_user_id
     AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
     AND draft.status = 'in_progress'
   FOR UPDATE;

  IF v_plan.current_initial_need_version_id IS DISTINCT FROM p_expected_base_initial_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'outcome', 'stale_source',
      'currentInitialNeedVersionId', v_plan.current_initial_need_version_id
    );
  END IF;

  IF v_plan.legacy_prefill_v1 ? 'stage2' THEN
    IF v_current.id IS NOT NULL THEN
      v_result := v_current;
    ELSE
      SELECT * INTO v_result
        FROM public.personal_plan_refinement_drafts AS draft
       WHERE draft.id = p_expected_parent_draft_id
         AND draft.personal_plan_id = v_plan.id
         AND draft.user_id = p_user_id;
    END IF;

    IF v_result.id IS NULL THEN
      SELECT * INTO v_result
        FROM public.personal_plan_refinement_drafts AS draft
       WHERE draft.personal_plan_id = v_plan.id
         AND draft.user_id = p_user_id
         AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
         AND draft.status = 'complete'
       ORDER BY draft.updated_at DESC, draft.id DESC
       LIMIT 1;
    END IF;

    RETURN pg_catalog.jsonb_build_object('outcome', 'already_consumed', 'draft', pg_catalog.to_jsonb(v_result));
  END IF;

  SELECT * INTO v_enrollment
    FROM public.personal_plan_migration_enrollments AS enrollment
   WHERE enrollment.id = v_plan.enrollment_purchase_source_id
     AND enrollment.user_id = p_user_id;

  IF v_enrollment.id IS NULL
     OR v_enrollment.status <> 'ready'
     OR v_plan.active_routine_version_id IS NULL THEN
    IF v_current.id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('outcome', 'skip_not_eligible', 'draft', pg_catalog.to_jsonb(v_current));
    END IF;

    SELECT * INTO v_parent
      FROM public.personal_plan_refinement_drafts AS draft
     WHERE draft.id = p_expected_parent_draft_id
       AND draft.personal_plan_id = v_plan.id
       AND draft.user_id = p_user_id
       AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
     FOR UPDATE;

    IF v_parent.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
    END IF;
    IF v_parent.status <> 'complete'
       OR v_parent.revision IS DISTINCT FROM p_expected_parent_revision THEN
      RETURN pg_catalog.jsonb_build_object(
        'outcome', 'revision_conflict',
        'currentRevision', v_parent.revision
      );
    END IF;

    INSERT INTO public.personal_plan_refinement_drafts(
      user_id,
      personal_plan_id,
      base_initial_need_version_id,
      schema_version,
      answers,
      completed_question_ids,
      answer_provenance,
      revision,
      status
    ) VALUES (
      p_user_id,
      v_plan.id,
      p_expected_base_initial_need_version_id,
      v_parent.schema_version,
      v_parent.answers,
      v_parent.completed_question_ids,
      v_parent.answer_provenance,
      v_parent.revision,
      'in_progress'
    )
    ON CONFLICT (personal_plan_id, base_initial_need_version_id) WHERE status = 'in_progress'
    DO NOTHING
    RETURNING * INTO v_result;

    IF v_result.id IS NULL THEN
      SELECT * INTO v_result
        FROM public.personal_plan_refinement_drafts AS draft
       WHERE draft.personal_plan_id = v_plan.id
         AND draft.user_id = p_user_id
         AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
         AND draft.status = 'in_progress'
       FOR UPDATE;
    END IF;

    RETURN pg_catalog.jsonb_build_object('outcome', 'skip_not_eligible', 'draft', pg_catalog.to_jsonb(v_result));
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM private.personal_plan_current_paid_migration_authority(p_user_id)
  ) INTO v_has_current_paid_authority;

  IF NOT v_has_current_paid_authority THEN
    IF v_current.id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('outcome', 'skip_not_eligible', 'draft', pg_catalog.to_jsonb(v_current));
    END IF;

    SELECT * INTO v_parent
      FROM public.personal_plan_refinement_drafts AS draft
     WHERE draft.id = p_expected_parent_draft_id
       AND draft.personal_plan_id = v_plan.id
       AND draft.user_id = p_user_id
       AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
     FOR UPDATE;

    IF v_parent.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
    END IF;
    IF v_parent.status <> 'complete'
       OR v_parent.revision IS DISTINCT FROM p_expected_parent_revision THEN
      RETURN pg_catalog.jsonb_build_object(
        'outcome', 'revision_conflict',
        'currentRevision', v_parent.revision
      );
    END IF;

    INSERT INTO public.personal_plan_refinement_drafts(
      user_id,
      personal_plan_id,
      base_initial_need_version_id,
      schema_version,
      answers,
      completed_question_ids,
      answer_provenance,
      revision,
      status
    ) VALUES (
      p_user_id,
      v_plan.id,
      p_expected_base_initial_need_version_id,
      v_parent.schema_version,
      v_parent.answers,
      v_parent.completed_question_ids,
      v_parent.answer_provenance,
      v_parent.revision,
      'in_progress'
    )
    ON CONFLICT (personal_plan_id, base_initial_need_version_id) WHERE status = 'in_progress'
    DO NOTHING
    RETURNING * INTO v_result;

    IF v_result.id IS NULL THEN
      SELECT * INTO v_result
        FROM public.personal_plan_refinement_drafts AS draft
       WHERE draft.personal_plan_id = v_plan.id
         AND draft.user_id = p_user_id
         AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
         AND draft.status = 'in_progress'
       FOR UPDATE;
    END IF;

    RETURN pg_catalog.jsonb_build_object('outcome', 'skip_not_eligible', 'draft', pg_catalog.to_jsonb(v_result));
  END IF;

  IF v_current.id IS NOT NULL THEN
    v_outcome := 'skipped_existing_state';
    v_result := v_current;
  ELSE
    SELECT * INTO v_parent
      FROM public.personal_plan_refinement_drafts AS draft
     WHERE draft.id = p_expected_parent_draft_id
       AND draft.personal_plan_id = v_plan.id
       AND draft.user_id = p_user_id
       AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
     FOR UPDATE;

    IF v_parent.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
    END IF;

    IF v_parent.status <> 'complete'
       OR v_parent.revision IS DISTINCT FROM p_expected_parent_revision THEN
      RETURN pg_catalog.jsonb_build_object(
        'outcome', 'revision_conflict',
        'currentRevision', v_parent.revision
      );
    END IF;

    SELECT (
      pg_catalog.cardinality(v_parent.completed_question_ids) > 0
      AND NOT EXISTS (
        SELECT 1
          FROM pg_catalog.unnest(v_parent.completed_question_ids) AS completed(question_id)
         WHERE v_parent.answer_provenance ->> completed.question_id IS DISTINCT FROM 'assumed'
      )
    ) INTO v_parent_fully_assumed;

    IF NOT v_parent_fully_assumed OR p_seed_outcome = 'skipped_existing_state' THEN
      v_outcome := 'skipped_existing_state';
      v_result := v_parent;
    ELSIF p_seed_outcome = 'nothing_usable' THEN
      v_outcome := 'nothing_usable';
      v_result := v_parent;
    ELSE
      INSERT INTO public.personal_plan_refinement_drafts(
        user_id,
        personal_plan_id,
        base_initial_need_version_id,
        schema_version,
        answers,
        completed_question_ids,
        answer_provenance,
        revision,
        status
      ) VALUES (
        p_user_id,
        v_plan.id,
        p_expected_base_initial_need_version_id,
        v_parent.schema_version,
        p_seed_answers,
        p_seed_completed_question_ids,
        p_seed_answer_provenance,
        v_parent.revision,
        'in_progress'
      )
      ON CONFLICT (personal_plan_id, base_initial_need_version_id) WHERE status = 'in_progress'
      DO NOTHING
      RETURNING * INTO v_result;

      IF v_result.id IS NULL THEN
        SELECT * INTO v_result
          FROM public.personal_plan_refinement_drafts AS draft
         WHERE draft.personal_plan_id = v_plan.id
           AND draft.user_id = p_user_id
           AND draft.base_initial_need_version_id = p_expected_base_initial_need_version_id
           AND draft.status = 'in_progress'
         FOR UPDATE;
      END IF;

      IF v_result.id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
      END IF;
      v_outcome := 'applied';
    END IF;
  END IF;

  v_receipt := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'module', p_module,
    'outcome', v_outcome,
    'seedOutcome', p_seed_outcome,
    'draftId', v_result.id,
    'parentDraftId', p_expected_parent_draft_id,
    'parentRevision', p_expected_parent_revision,
    'sourceFingerprint', p_source_fingerprint,
    'sourceIds', p_source_ids,
    'consumedAt', pg_catalog.now()
  );

  UPDATE public.personal_plans AS plan
     SET legacy_prefill_v1 = pg_catalog.jsonb_set(
           COALESCE(plan.legacy_prefill_v1, '{}'::jsonb),
           ARRAY['stage2'],
           v_receipt,
           true
         ),
         updated_at = pg_catalog.now()
   WHERE plan.id = v_plan.id;

  RETURN pg_catalog.jsonb_build_object(
    'outcome', v_outcome,
    'draft', pg_catalog.to_jsonb(v_result)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_open_optional_refinement_v1(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text[],jsonb,text,text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_open_optional_refinement_v1(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text[],jsonb,text,text[])
  TO service_role;

COMMIT;
