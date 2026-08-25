-- Stage-2 module completion: project a new refined Need version from a
-- PARTIALLY completed refinement draft.
--
-- The refinement path is split into two modules (`products` | `habits`, see
-- src/lib/personal-plan/refinement/question-path.ts). Finishing one module must
-- already update the user's plan, while the draft stays open for the other one.
-- Today's terminal completion RPC (`personal_plan_complete_refinement_draft`,
-- 20260808062602_personal_plan_stage1_3_foundation.sql:293-322) closes the
-- draft and can express only ONE result version, so it cannot represent
-- "module 1 done, module 2 open, plan already updated".
--
-- Additive only. DEPLOY ORDER: apply this migration FIRST, then deploy the
-- code. Old code ignores the new column and the new function (safe); new code
-- without the migration breaks Stage-2 draft loads.

-- Projection lineage per module: module -> {needVersionId, projectedAtRevision,
-- stage3Handoff}. It is both the audit trail ("which refined version came from
-- which module state") and the replay key of the RPC below.
ALTER TABLE public.personal_plan_refinement_drafts
  ADD COLUMN IF NOT EXISTS module_projections jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (pg_catalog.jsonb_typeof(module_projections) = 'object');

COMMENT ON COLUMN public.personal_plan_refinement_drafts.module_projections IS
  'Stage-2 module id (''products''|''habits'') -> {needVersionId, projectedAtRevision, stage3Handoff}. Written by personal_plan_complete_stage2_module. `stage3Handoff` is the persisted Modul-1 handoff marker (true only for ''products''), so the Stage-3 entry survives a reload while the draft is still in_progress. Empty on drafts that were only ever completed in full.';

-- Atomic module completion.
--
--   a. Replay: completing the SAME module again from the SAME draft revision
--      returns the version already written instead of writing a second one
--      (`already_projected`) — the lost-response case.
--   b. CAS on the draft revision, same conflict shape as the draft save.
--   c. The draft stays `in_progress` and its revision is NOT bumped: the
--      caller's session revision stays valid, so the user can keep answering
--      the other module without a reload. Draft answers are untouched — the
--      resolver's assumptions live only in the projected version's input
--      snapshot, never as stored answers.
--   d. Advances `current_refined_need_version_id`, stales active Stage-3
--      product drafts of the previous version (deliberate; reconciliation is
--      task 1.6) and enqueues the routine source change — same mechanisms as
--      the full completion.
--
-- Full completion (BOTH modules answered) keeps running through
-- `personal_plan_complete_refinement_draft`; the service delegates to it, so
-- today's terminal behavior stays byte-identical for existing clients.
CREATE OR REPLACE FUNCTION public.personal_plan_complete_stage2_module(
  p_user_id uuid, p_personal_plan_id uuid, p_draft_id uuid, p_module text,
  p_expected_revision bigint, p_schema_version integer, p_computation_version text,
  p_input_hash text, p_input_snapshot jsonb, p_output_snapshot jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_draft public.personal_plan_refinement_drafts%ROWTYPE;
  v_projection jsonb;
  v_need_id uuid;
  v_stage3_handoff boolean;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans WHERE id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_draft FROM public.personal_plan_refinement_drafts WHERE id=p_draft_id AND personal_plan_id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  IF v_plan.id IS NULL OR v_draft.id IS NULL THEN RETURN jsonb_build_object('outcome','invalid_source'); END IF;
  IF p_module NOT IN ('products','habits') THEN RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_module'); END IF;

  -- The Modul-1 handoff marker is a property of the module, never of the
  -- caller: only `products` hands off into Stage 3.
  v_stage3_handoff := p_module = 'products';

  -- (a) Replay of a lost response: the draft revision is unchanged by a module
  -- completion, so an identical retry matches the recorded lineage entry.
  v_projection := v_draft.module_projections -> p_module;
  IF v_projection IS NOT NULL
     AND (v_projection ->> 'needVersionId') IS NOT NULL
     AND (v_projection ->> 'projectedAtRevision')::bigint = p_expected_revision THEN
    RETURN jsonb_build_object(
      'outcome','already_projected',
      'refinedNeedVersionId', v_projection ->> 'needVersionId',
      'stage3Handoff', COALESCE((v_projection ->> 'stage3Handoff')::boolean, v_stage3_handoff)
    );
  END IF;

  -- (b) A closed or superseded draft is a reloadable conflict, not a silent write.
  IF v_draft.status <> 'in_progress' OR v_draft.revision <> p_expected_revision THEN
    RETURN jsonb_build_object('outcome','revision_conflict','currentRevision',v_draft.revision);
  END IF;
  IF v_plan.current_initial_need_version_id IS DISTINCT FROM v_draft.base_initial_need_version_id THEN
    RETURN jsonb_build_object('outcome','stale_source','currentInitialNeedVersionId',v_plan.current_initial_need_version_id);
  END IF;
  IF p_schema_version<=0 OR p_computation_version='' OR p_input_hash !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_input_snapshot)<>'object' OR pg_catalog.jsonb_typeof(p_output_snapshot)<>'object' THEN
    RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_refined_need');
  END IF;

  INSERT INTO public.personal_plan_need_versions(user_id,personal_plan_id,kind,parent_need_version_id,schema_version,computation_version,input_hash,input_snapshot,output_snapshot)
  VALUES(p_user_id,p_personal_plan_id,'refined',v_draft.base_initial_need_version_id,p_schema_version,p_computation_version,p_input_hash,p_input_snapshot,p_output_snapshot)
  ON CONFLICT (personal_plan_id,parent_need_version_id,input_hash) WHERE kind='refined' DO NOTHING RETURNING id INTO v_need_id;
  IF v_need_id IS NULL THEN
    SELECT id INTO v_need_id FROM public.personal_plan_need_versions
      WHERE personal_plan_id=p_personal_plan_id AND parent_need_version_id=v_draft.base_initial_need_version_id
        AND kind='refined' AND input_hash=p_input_hash;
  END IF;

  -- (c) Lineage only: status stays 'in_progress', revision stays put, answers untouched.
  UPDATE public.personal_plan_refinement_drafts
     SET module_projections = module_projections || pg_catalog.jsonb_build_object(
           p_module,
           pg_catalog.jsonb_build_object(
             'needVersionId', v_need_id,
             'projectedAtRevision', v_draft.revision,
             'projectedAt', pg_catalog.now(),
             'stage3Handoff', v_stage3_handoff
           )
         ),
         updated_at=pg_catalog.now()
   WHERE id=v_draft.id;

  -- (d) Same head-advance mechanics as the full completion.
  UPDATE public.personal_plan_product_drafts
    SET status='stale', updated_at=pg_catalog.now()
    WHERE personal_plan_id=v_plan.id AND status='active'
      AND refined_need_version_id IS DISTINCT FROM v_need_id;
  UPDATE public.personal_plans
    SET current_refined_need_version_id=v_need_id,
        revision=revision+1
    WHERE id=v_plan.id;
  PERFORM public.personal_plan_enqueue_routine_source_change(
    p_user_id, v_plan.id, 'refined_need', v_need_id::text
  );

  RETURN jsonb_build_object(
    'outcome','completed',
    'refinedNeedVersionId',v_need_id,
    'stage3Handoff',v_stage3_handoff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_complete_stage2_module(uuid,uuid,uuid,text,bigint,integer,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_complete_stage2_module(uuid,uuid,uuid,text,bigint,integer,text,text,jsonb,jsonb) TO service_role;
