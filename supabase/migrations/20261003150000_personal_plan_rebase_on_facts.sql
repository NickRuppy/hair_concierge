-- Central user profile, PR2 task 2 (plans/2026-10-03-central-user-profile-pr2.md §4a, Rev. 4):
-- `public.personal_plan_rebase_on_facts_v1`, the "facts rebase". When the profile facts
-- (`hair_profiles`) produce a Stage-1 source whose hash differs from the plan's current initial
-- Need version, the TypeScript lane (`syncPlanWithFacts`) computes the new initial version AND
-- the re-projected refined version and commits everything here, in ONE transaction:
--
--   care-habits facts (through the door) → new initial version (or the existing row with that
--   hash) → pending routine proposals superseded → refined version on the new parent → open
--   refinement drafts staled → clone of the source draft on the new parent → plan heads,
--   revision, applied_facts_revision → `refined_need` routine source change.
--
-- There is no half-rebased plan: a failure before the commit leaves everything untouched (the
-- next trigger sees the same hash difference); after it only the routine recompute is left,
-- which the `refined_need` outbox row recovers. `pending_facts_revision` /
-- `pending_facts_draft_id` (20260929231200) stay unused and are written NULL.
--
-- LOCK ORDER: `personal_plans` row (FOR UPDATE) → EVERY refinement draft of the plan (FOR UPDATE,
-- ordered by id) → the `hair_profiles` row (FOR UPDATE).
--   * Module completion (20260825130000) and terminal completion lock plan → draft; this
--     function extends that order, never reverses it.
--   * The door `user_facts_save_v1` (20260929231300) locks draft → hair_profiles; same relative
--     order. hair_profiles is taken FOR UPDATE — the lock the door takes — so the nested door
--     call in step 4a never upgrades a lock (no SHARE → EXCLUSIVE upgrade deadlock).
--   * Locking all drafts of the plan, not just the source, is what makes "stale every
--     in-progress draft" (step 7) and "the source draft is X at revision N" (step 4) one
--     consistent view. A Feinschliff `reopen` INSERT racing this function is not blocked by row
--     locks; it either lands before (and is staled here) or after (on the then-old base, staled
--     by the next rebase). The lane retries 40P01 / 40001 once (R14).
--
-- This function never writes `hair_profiles` itself: the only facts write is the door call of
-- step 4a, which satisfies the lock guard of 20261003120000.
--
-- STATUSES (key `status` in the returned jsonb):
--   rebased                  {initialNeedVersionId, refinedNeedVersionId|null, cloneDraftId|null,
--                             revision, factsRevision}
--   unchanged                {initialNeedVersionId, revision} — the only write is
--                             applied_facts_revision = greatest(coalesce(applied, 0), expected)
--   plan_revision_conflict   {currentRevision}                 — writes nothing
--   facts_revision_conflict  {currentRevision}                 — writes nothing
--   draft_conflict           {currentDraftId, currentDraftRevision} — writes nothing
--   initial_conflict         {existingId}                      — writes nothing; retry with that id
--   invalid_source           {reasonCode}                      — writes nothing
-- A door rejection inside step 4a (any door status other than `ok`) RAISEs: the whole call rolls
-- back and the caller sees an error (message `personal_plan_rebase_on_facts_v1: care_habits facts
-- write rejected: status=<s> reason=<r>`). It cannot happen after the checks above unless the
-- caller sends a patch / provenance the door refuses.
--
-- Additive only: a new function, no schema change. DEPLOY ORDER: migration before code (the old
-- code never calls it).
--
-- ROLLBACK:
--   DROP FUNCTION public.personal_plan_rebase_on_facts_v1(uuid,uuid,bigint,integer,uuid,integer,text,text,jsonb,jsonb,uuid,bigint,jsonb,text[],jsonb,jsonb,jsonb,integer,text,text,jsonb,jsonb);
-- A plan already rebased stays valid under the old code (it reads the plan's own versions),
-- except for the scanner multiplicity after A→B→A (plan §9, R13).

CREATE OR REPLACE FUNCTION public.personal_plan_rebase_on_facts_v1(
  p_user_id uuid,
  p_personal_plan_id uuid,
  p_expected_plan_revision bigint,
  p_expected_facts_revision integer,
  p_initial_id uuid,
  p_schema_version integer,
  p_computation_version text,
  p_initial_input_hash text,
  p_initial_input_snapshot jsonb,
  p_initial_output_snapshot jsonb,
  p_source_draft_id uuid DEFAULT NULL,
  p_expected_draft_revision bigint DEFAULT NULL,
  p_clone_answers jsonb DEFAULT NULL,
  p_clone_completed_question_ids text[] DEFAULT NULL,
  p_clone_answer_provenance jsonb DEFAULT NULL,
  p_care_habits_patch jsonb DEFAULT NULL,
  p_care_habits_provenance jsonb DEFAULT NULL,
  p_refined_schema_version integer DEFAULT NULL,
  p_refined_computation_version text DEFAULT NULL,
  p_refined_input_hash text DEFAULT NULL,
  p_refined_input_snapshot jsonb DEFAULT NULL,
  p_refined_output_snapshot jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_current_initial public.personal_plan_need_versions%ROWTYPE;
  v_source public.personal_plan_refinement_drafts%ROWTYPE;
  v_facts_revision integer;
  v_applied_facts_revision integer;
  v_has_clone boolean;
  v_has_care_habits boolean;
  v_has_refined boolean;
  v_existing_initial_id uuid;
  v_door jsonb;
  v_refined_id uuid;
  v_clone_id uuid;
  v_projections jsonb;
  v_new_revision bigint;
BEGIN
  -- (0) Parameter shape. Nothing is read or written before this passes.
  IF p_user_id IS NULL OR p_personal_plan_id IS NULL OR p_initial_id IS NULL
     OR p_expected_plan_revision IS NULL OR p_expected_facts_revision IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_parameters');
  END IF;
  IF p_schema_version IS NULL OR p_schema_version <= 0
     OR p_computation_version IS NULL OR p_computation_version = ''
     OR p_initial_input_hash IS NULL OR p_initial_input_hash !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_initial_input_snapshot) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_initial_output_snapshot) IS DISTINCT FROM 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_initial_need');
  END IF;
  IF (p_source_draft_id IS NULL) <> (p_expected_draft_revision IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_source_draft');
  END IF;

  v_has_clone := p_clone_answers IS NOT NULL OR p_clone_completed_question_ids IS NOT NULL
                 OR p_clone_answer_provenance IS NOT NULL;
  IF v_has_clone AND (
       pg_catalog.jsonb_typeof(p_clone_answers) IS DISTINCT FROM 'object'
       OR p_clone_completed_question_ids IS NULL
       OR pg_catalog.jsonb_typeof(p_clone_answer_provenance) IS DISTINCT FROM 'object') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_clone');
  END IF;

  -- The care-habits pair is only checked for presence: its content is the door's to judge
  -- (step 4a), so a refused patch / provenance surfaces as the door's own rejection.
  v_has_care_habits := p_care_habits_patch IS NOT NULL OR p_care_habits_provenance IS NOT NULL;
  IF v_has_care_habits AND (p_care_habits_patch IS NULL OR p_care_habits_provenance IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_care_habits');
  END IF;

  v_has_refined := p_refined_schema_version IS NOT NULL OR p_refined_computation_version IS NOT NULL
                   OR p_refined_input_hash IS NOT NULL OR p_refined_input_snapshot IS NOT NULL
                   OR p_refined_output_snapshot IS NOT NULL;
  IF v_has_refined AND (
       p_refined_schema_version IS NULL OR p_refined_schema_version <= 0
       OR p_refined_computation_version IS NULL OR p_refined_computation_version = ''
       OR p_refined_input_hash IS NULL OR p_refined_input_hash !~ '^[0-9a-f]{64}$'
       OR pg_catalog.jsonb_typeof(p_refined_input_snapshot) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(p_refined_output_snapshot) IS DISTINCT FROM 'object') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_refined_need');
  END IF;

  -- (1) Locks: plan → every refinement draft of the plan → hair_profiles.
  SELECT * INTO v_plan
    FROM public.personal_plans
   WHERE id = p_personal_plan_id AND user_id = p_user_id
     FOR UPDATE;
  IF v_plan.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'plan_not_found');
  END IF;

  PERFORM 1
     FROM public.personal_plan_refinement_drafts
    WHERE personal_plan_id = v_plan.id
    ORDER BY id
      FOR UPDATE;

  SELECT facts_revision INTO v_facts_revision
    FROM public.hair_profiles
   WHERE user_id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'facts_not_found');
  END IF;

  SELECT * INTO v_current_initial
    FROM public.personal_plan_need_versions
   WHERE id = v_plan.current_initial_need_version_id
     AND user_id = p_user_id
     AND personal_plan_id = v_plan.id
     AND kind = 'initial';
  IF v_current_initial.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'initial_not_found');
  END IF;

  -- (2) The caller's view of the plan and of the facts.
  IF v_plan.revision <> p_expected_plan_revision THEN
    RETURN pg_catalog.jsonb_build_object('status', 'plan_revision_conflict', 'currentRevision', v_plan.revision);
  END IF;
  IF v_facts_revision <> p_expected_facts_revision THEN
    RETURN pg_catalog.jsonb_build_object('status', 'facts_revision_conflict', 'currentRevision', v_facts_revision);
  END IF;

  -- (3) Nothing to rebase: record that the plan already matches these facts.
  IF v_current_initial.input_hash = p_initial_input_hash THEN
    IF v_plan.applied_facts_revision IS DISTINCT FROM
       GREATEST(COALESCE(v_plan.applied_facts_revision, 0), p_expected_facts_revision) THEN
      UPDATE public.personal_plans
         SET applied_facts_revision = GREATEST(COALESCE(applied_facts_revision, 0), p_expected_facts_revision)
       WHERE id = v_plan.id;
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'unchanged',
      'initialNeedVersionId', v_current_initial.id,
      'revision', v_plan.revision
    );
  END IF;

  -- (4) Source draft, decided here exactly as `loadExistingFromSource`
  -- (stage2-refinement-supabase.ts): the open draft on the current initial version, else its
  -- latest completed one, else none. Must match what the caller computed from.
  SELECT * INTO v_source
    FROM public.personal_plan_refinement_drafts
   WHERE personal_plan_id = v_plan.id
     AND base_initial_need_version_id = v_current_initial.id
     AND status = 'in_progress';
  IF v_source.id IS NULL THEN
    SELECT * INTO v_source
      FROM public.personal_plan_refinement_drafts
     WHERE personal_plan_id = v_plan.id
       AND base_initial_need_version_id = v_current_initial.id
       AND status = 'complete'
     ORDER BY updated_at DESC, id DESC
     LIMIT 1;
  END IF;
  IF v_source.id IS DISTINCT FROM p_source_draft_id
     OR (v_source.id IS NOT NULL AND v_source.revision <> p_expected_draft_revision) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'draft_conflict',
      'currentDraftId', v_source.id,
      'currentDraftRevision', v_source.revision
    );
  END IF;

  IF v_has_refined <> (v_plan.current_refined_need_version_id IS NOT NULL) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'invalid_source',
      'reasonCode', CASE WHEN v_has_refined THEN 'refined_parameters_forbidden'
                         ELSE 'refined_parameters_required' END
    );
  END IF;
  IF v_has_care_habits <> v_has_refined THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'invalid_source',
      'reasonCode', CASE WHEN v_has_care_habits THEN 'care_habits_parameters_forbidden'
                         ELSE 'care_habits_parameters_required' END
    );
  END IF;
  IF v_plan.current_refined_need_version_id IS NOT NULL AND v_source.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'refined_head_without_draft');
  END IF;
  IF v_has_clone <> (v_source.id IS NOT NULL) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'invalid_source',
      'reasonCode', CASE WHEN v_has_clone THEN 'clone_parameters_forbidden'
                         ELSE 'clone_parameters_required' END
    );
  END IF;
  IF v_source.status = 'complete' AND NOT v_has_refined THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'complete_source_without_refined');
  END IF;

  -- (5, check part) The new initial version's id. Checked BEFORE step 4a so that a conflict
  -- still writes nothing.
  SELECT id INTO v_existing_initial_id
    FROM public.personal_plan_need_versions
   WHERE personal_plan_id = v_plan.id
     AND kind = 'initial'
     AND input_hash = p_initial_input_hash;
  IF v_existing_initial_id IS NOT NULL AND v_existing_initial_id <> p_initial_id THEN
    RETURN pg_catalog.jsonb_build_object('status', 'initial_conflict', 'existingId', v_existing_initial_id);
  END IF;
  IF v_existing_initial_id IS NULL
     AND EXISTS (SELECT 1 FROM public.personal_plan_need_versions WHERE id = p_initial_id) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'initial_id_taken');
  END IF;

  -- Every non-`rebased` exit lies above this line. From here on: writes only.

  -- (4a) Facts first, same transaction (I1, R16, R17): a published refined version always has
  -- its care habits in the profile. The door re-locks the row this transaction already holds
  -- FOR UPDATE and re-checks the revision CAS verified in step 2.
  v_applied_facts_revision := p_expected_facts_revision;
  IF v_has_refined THEN
    v_door := public.user_facts_save_v1(
      p_user_id => p_user_id,
      p_domain => 'care_habits',
      p_patch => p_care_habits_patch,
      p_provenance => p_care_habits_provenance,
      p_expected_revision => p_expected_facts_revision
    );
    IF v_door ->> 'status' IS DISTINCT FROM 'ok' THEN
      RAISE EXCEPTION 'personal_plan_rebase_on_facts_v1: care_habits facts write rejected: status=% reason=%',
        COALESCE(v_door ->> 'status', '<none>'), COALESCE(v_door ->> 'reason', '<none>')
        USING ERRCODE = 'P0001';
    END IF;
    v_applied_facts_revision := (v_door ->> 'revision')::integer;
  END IF;

  -- (5, write part) Insert the initial version under the caller's id, source identity copied
  -- from the current initial version (A→B→A returns to the existing row instead).
  IF v_existing_initial_id IS NULL THEN
    INSERT INTO public.personal_plan_need_versions(
      id, user_id, personal_plan_id, kind, prepared_artifact_source_id,
      stage1_source_kind, stage1_source_lead_id,
      schema_version, computation_version, input_hash, input_snapshot, output_snapshot
    ) VALUES (
      p_initial_id, p_user_id, v_plan.id, 'initial', v_current_initial.prepared_artifact_source_id,
      v_current_initial.stage1_source_kind, v_current_initial.stage1_source_lead_id,
      p_schema_version, p_computation_version, p_initial_input_hash,
      p_initial_input_snapshot, p_initial_output_snapshot
    );
  END IF;

  -- (6) A rebase always supersedes a pending routine proposal (R2 / R08); the pointer is
  -- cleared in step 9.
  UPDATE public.personal_plan_routine_proposals
     SET status = 'superseded', updated_at = pg_catalog.now()
   WHERE personal_plan_id = v_plan.id AND status = 'pending';

  -- (7) Refined version FIRST (R10): the clone's status/result CHECK and FK are immediate.
  IF v_has_refined THEN
    INSERT INTO public.personal_plan_need_versions(
      user_id, personal_plan_id, kind, parent_need_version_id,
      schema_version, computation_version, input_hash, input_snapshot, output_snapshot
    ) VALUES (
      p_user_id, v_plan.id, 'refined', p_initial_id,
      p_refined_schema_version, p_refined_computation_version, p_refined_input_hash,
      p_refined_input_snapshot, p_refined_output_snapshot
    )
    ON CONFLICT (personal_plan_id, parent_need_version_id, input_hash) WHERE kind = 'refined'
    DO NOTHING
    RETURNING id INTO v_refined_id;
    IF v_refined_id IS NULL THEN
      SELECT id INTO v_refined_id
        FROM public.personal_plan_need_versions
       WHERE personal_plan_id = v_plan.id
         AND parent_need_version_id = p_initial_id
         AND kind = 'refined'
         AND input_hash = p_refined_input_hash;
    END IF;
    IF v_refined_id IS NULL THEN
      -- Unreachable under the plan lock; RAISE rather than return so the writes above roll back.
      RAISE EXCEPTION 'personal_plan_rebase_on_facts_v1: refined need version unavailable'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Every open refinement draft of the plan, on ANY base (R01); completed drafts stay (F18).
  UPDATE public.personal_plan_refinement_drafts
     SET status = 'stale', updated_at = pg_catalog.now()
   WHERE personal_plan_id = v_plan.id AND status = 'in_progress';
  -- Stage-3 drafts of any other refined version (with no new refined version: all of them).
  UPDATE public.personal_plan_product_drafts
     SET status = 'stale', updated_at = pg_catalog.now()
   WHERE personal_plan_id = v_plan.id AND status = 'active'
     AND refined_need_version_id IS DISTINCT FROM v_refined_id;

  -- (8) The clone: the caller's content, the source's status / revision / schema version.
  IF v_source.id IS NOT NULL THEN
    IF v_has_refined THEN
      SELECT pg_catalog.jsonb_object_agg(
               module_key,
               pg_catalog.jsonb_build_object(
                 'needVersionId', v_refined_id,
                 'projectedAtRevision', v_source.revision,
                 'projectedAt', pg_catalog.now(),
                 'stage3Handoff', module_key = 'products'
                   AND COALESCE(v_source.module_projections -> 'products' -> 'stage3Handoff' = 'true'::jsonb, false),
                 'origin', 'facts_rebase'
               )
             )
        INTO v_projections
        FROM pg_catalog.unnest(ARRAY['products', 'habits']) AS module_key
       WHERE pg_catalog.jsonb_typeof(v_source.module_projections -> module_key) = 'object';
      IF v_projections IS NULL THEN
        v_projections := pg_catalog.jsonb_build_object(
          'habits', pg_catalog.jsonb_build_object(
            'needVersionId', v_refined_id,
            'projectedAtRevision', v_source.revision,
            'projectedAt', pg_catalog.now(),
            'stage3Handoff', false,
            'origin', 'facts_rebase'
          )
        );
      END IF;
    ELSE
      v_projections := '{}'::jsonb;
    END IF;

    INSERT INTO public.personal_plan_refinement_drafts(
      user_id, personal_plan_id, base_initial_need_version_id, schema_version,
      answers, completed_question_ids, answer_provenance, revision, status,
      result_refined_need_version_id, module_projections, origin
    ) VALUES (
      p_user_id, v_plan.id, p_initial_id, v_source.schema_version,
      p_clone_answers, p_clone_completed_question_ids, p_clone_answer_provenance,
      v_source.revision, v_source.status,
      CASE WHEN v_source.status = 'complete' THEN v_refined_id ELSE NULL END,
      v_projections, 'facts_rebase'
    )
    RETURNING id INTO v_clone_id;
  END IF;

  -- (9) Plan heads, revision, cursor.
  UPDATE public.personal_plans
     SET current_initial_need_version_id = p_initial_id,
         current_refined_need_version_id = v_refined_id,
         pending_routine_proposal_id = NULL,
         revision = revision + 1,
         applied_facts_revision = v_applied_facts_revision,
         pending_facts_revision = NULL,
         pending_facts_draft_id = NULL
   WHERE id = v_plan.id
  RETURNING revision INTO v_new_revision;

  -- (10) Routine source change, after the lineage is written (F20).
  IF v_refined_id IS NOT NULL THEN
    PERFORM public.personal_plan_enqueue_routine_source_change(
      p_user_id, v_plan.id, 'refined_need', v_refined_id::text
    );
  END IF;

  -- (11)
  RETURN pg_catalog.jsonb_build_object(
    'status', 'rebased',
    'initialNeedVersionId', p_initial_id,
    'refinedNeedVersionId', v_refined_id,
    'cloneDraftId', v_clone_id,
    'revision', v_new_revision,
    'factsRevision', v_applied_facts_revision
  );
END;
$$;

COMMENT ON FUNCTION public.personal_plan_rebase_on_facts_v1(uuid,uuid,bigint,integer,uuid,integer,text,text,jsonb,jsonb,uuid,bigint,jsonb,text[],jsonb,jsonb,jsonb,integer,text,text,jsonb,jsonb) IS
  'Service-only facts rebase (central user profile PR2, plan §4a): moves a Personal Plan to a new initial Need version computed from hair_profiles facts, with the re-projected refined version, the source-draft clone, care-habits facts written through user_facts_save_v1 and the refined_need routine source change, in one transaction. Statuses: rebased | unchanged | plan_revision_conflict | facts_revision_conflict | draft_conflict | initial_conflict | invalid_source.';

REVOKE ALL ON FUNCTION public.personal_plan_rebase_on_facts_v1(uuid,uuid,bigint,integer,uuid,integer,text,text,jsonb,jsonb,uuid,bigint,jsonb,text[],jsonb,jsonb,jsonb,integer,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_rebase_on_facts_v1(uuid,uuid,bigint,integer,uuid,integer,text,text,jsonb,jsonb,uuid,bigint,jsonb,text[],jsonb,jsonb,jsonb,integer,text,text,jsonb,jsonb) TO service_role;
