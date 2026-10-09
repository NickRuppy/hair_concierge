-- Direct-acceptance draft ownership as explicit state.
--
-- „Plan übernehmen" (direct acceptance) now builds its Stage-2 answers on the member's stored
-- care answers, so its drafts no longer share one fixed content. A retry therefore cannot
-- recognise its own interrupted draft by content, and cannot tell it from a draft the member
-- has since edited in the Feinschliff (Codex review 2026-10-06). Ownership becomes a column:
--
--   * NULL  — the row predates this column. Only these rows may still be recognised by content
--             (the fixed all-assumed defaults every direct accept wrote until now).
--   * true  — `personal_plan_save_direct_acceptance_draft`, the ONLY writer that sets it.
--   * false — every new row (create, reopen, facts-rebase clone, optional entry: column default)
--             and every successful interactive save (`personal_plan_save_refinement_draft`, and
--             the 5-arg wrapper that delegates to it). A false draft is never re-claimed by
--             content, even when her answers equal the defaults (Codex review 2026-10-06).
--   * Completion RPCs leave it untouched, so a completed direct-acceptance draft stays marked.
--
-- Change to `personal_plan_save_refinement_draft` (6-arg): one SET line; otherwise
-- byte-identical to 20260825120000 (production md5(prosrc) d155bdef994c630e44c4093510893ee4
-- verified 2026-10-06). Deploy order: this migration BEFORE the code that calls the new RPC.
-- Rollback: roll back the CODE only and keep this migration — the old code calls the 6-arg save,
-- which keeps clearing the mark. Never restore the 20260825120000 save body while the column
-- exists: interactive edits would then leave stale `true` marks behind. If the database itself
-- must be rolled back, first run
--   UPDATE public.personal_plan_refinement_drafts SET direct_acceptance_owned = false;

-- Added WITHOUT a default so existing rows stay NULL ("predates the column"); the default then
-- applies to new rows only.
ALTER TABLE public.personal_plan_refinement_drafts
  ADD COLUMN IF NOT EXISTS direct_acceptance_owned boolean;
ALTER TABLE public.personal_plan_refinement_drafts
  ALTER COLUMN direct_acceptance_owned SET DEFAULT false;

COMMENT ON COLUMN public.personal_plan_refinement_drafts.direct_acceptance_owned IS
  'True while this draft holds exactly what direct acceptance („Plan übernehmen") last saved (set only by personal_plan_save_direct_acceptance_draft); false for new rows and after any interactive save (personal_plan_save_refinement_draft); NULL only for rows that predate 20261006180100.';

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
         direct_acceptance_owned=false,
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

CREATE OR REPLACE FUNCTION public.personal_plan_save_direct_acceptance_draft(
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
         direct_acceptance_owned=true,
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

COMMENT ON FUNCTION public.personal_plan_save_direct_acceptance_draft(uuid,uuid,bigint,jsonb,text[],jsonb) IS
  'personal_plan_save_refinement_draft for direct acceptance: same CAS and writes, and marks the draft direct_acceptance_owned. See 20261006180100.';

REVOKE ALL ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[],jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[],jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.personal_plan_save_direct_acceptance_draft(uuid,uuid,bigint,jsonb,text[],jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_direct_acceptance_draft(uuid,uuid,bigint,jsonb,text[],jsonb) TO service_role;
