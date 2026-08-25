-- Per-answer provenance on the Stage-2 refinement draft: was a canonical
-- question id answered directly by the user ('user'), or written by direct
-- acceptance's synthetic Stage-2 defaults ('assumed')? Progress ("X von 4")
-- and module status must derive from `user`-only answers, so an auto-accepted
-- user never reads as "everything answered"; projection completeness derives
-- from user ∪ assumed. See src/lib/personal-plan/refinement/answer-provenance.ts
-- for the read-path derivation and src/lib/personal-plan/direct-acceptance/accept.ts
-- (~180-196, ~238-280) for the synthetic write this backfill mirrors.
ALTER TABLE public.personal_plan_refinement_drafts
  ADD COLUMN IF NOT EXISTS answer_provenance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (pg_catalog.jsonb_typeof(answer_provenance) = 'object');

COMMENT ON COLUMN public.personal_plan_refinement_drafts.answer_provenance IS
  'Canonical Stage-2 question id -> ''user'' | ''assumed''. A completed id with no entry is legacy data written before this column existed and is treated as ''user'' by userAnsweredQuestionIds() (never silently downgrade old real progress to "assumed").';

-- Backfill for existing rows. Test users only, no production traffic yet, so
-- the coarse mapping below is accepted rather than reconstructing exact
-- per-answer history.
--
-- Heuristic: `unrefined_direct_accept` on personal_plans (added by
-- 20260817085000_personal_plan_direct_acceptance_provenance.sql) is set true
-- exactly while the plan's active Routine came from direct acceptance's
-- synthetic Stage-2 defaults and has not yet been superseded by a real Stage-2
-- refinement. There is no equivalent per-draft marker, so this backfill reads
-- that plan-level flag: every completed_question_ids entry on a draft
-- belonging to such a plan backfills to 'assumed'; every draft on a plan
-- without the flag backfills to 'user'.
--
-- Known imprecision: the flag is plan-level, not draft-level. A plan that was
-- direct-accepted and never refined again maps its one draft correctly. A
-- plan with more than one historical refinement draft (e.g. a superseded
-- in_progress row left over from an interrupted synthetic save, per
-- accept.ts's "interrupted synthetic save resumes" guard) would have every
-- one of its drafts swept into the same bucket by this join, even if an
-- older draft actually held different provenance. With a handful of test
-- users this coarse mapping is accepted; a later real Stage-2 answer save
-- still corrects any misclassified id going forward (saveAnswer always marks
-- the id it writes 'user').
UPDATE public.personal_plan_refinement_drafts AS draft
SET answer_provenance = COALESCE(
  (SELECT jsonb_object_agg(id, 'assumed') FROM unnest(draft.completed_question_ids) AS id),
  '{}'::jsonb
)
FROM public.personal_plans AS plan
WHERE draft.personal_plan_id = plan.id
  AND plan.unrefined_direct_accept = true;

UPDATE public.personal_plan_refinement_drafts AS draft
SET answer_provenance = COALESCE(
  (SELECT jsonb_object_agg(id, 'user') FROM unnest(draft.completed_question_ids) AS id),
  '{}'::jsonb
)
FROM public.personal_plans AS plan
WHERE draft.personal_plan_id = plan.id
  AND plan.unrefined_direct_accept = false;

-- personal_plan_save_refinement_draft gains the provenance payload in the
-- same write it already performs. The parameter list changes, so the old
-- overload is dropped rather than replaced in place.
DROP FUNCTION IF EXISTS public.personal_plan_save_refinement_draft(uuid, uuid, bigint, jsonb, text[]);

CREATE OR REPLACE FUNCTION public.personal_plan_save_refinement_draft(
  p_user_id uuid, p_draft_id uuid, p_expected_revision bigint, p_answers jsonb,
  p_completed_question_ids text[], p_answer_provenance jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_draft public.personal_plan_refinement_drafts%ROWTYPE;
BEGIN
  IF pg_catalog.jsonb_typeof(p_answers) <> 'object' THEN RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_answers'); END IF;
  IF pg_catalog.jsonb_typeof(p_answer_provenance) <> 'object' THEN RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_answer_provenance'); END IF;
  UPDATE public.personal_plan_refinement_drafts
     SET answers=p_answers,
         completed_question_ids=p_completed_question_ids,
         answer_provenance=p_answer_provenance,
         revision=revision+1,
         updated_at=pg_catalog.now()
   WHERE id=p_draft_id
     AND user_id=p_user_id
     AND status='in_progress'
     AND revision=p_expected_revision
   RETURNING * INTO v_draft;
  IF v_draft.id IS NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_refinement_drafts
      WHERE id=p_draft_id AND user_id=p_user_id;
    IF v_draft.id IS NULL OR v_draft.status <> 'in_progress' THEN
      RETURN jsonb_build_object('outcome','invalid_source');
    END IF;
    RETURN jsonb_build_object('outcome','revision_conflict','currentRevision',v_draft.revision);
  END IF;
  RETURN jsonb_build_object('outcome','saved','revision',v_draft.revision);
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[],jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[],jsonb) TO service_role;
