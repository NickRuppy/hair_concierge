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
-- a heuristic is accepted rather than reconstructing exact per-answer history.
--
-- Why the plan flag alone is NOT enough. `unrefined_direct_accept` on
-- personal_plans (20260817085000_personal_plan_direct_acceptance_provenance.sql)
-- is true only while the plan's active Routine still comes from direct
-- acceptance's synthetic Stage-2 defaults;
-- `personal_plan_clear_unrefined_direct_accept` (20260817090000) clears it
-- unconditionally on ANY accepted Routine proposal. A plan can therefore hold a
-- fully synthetic draft with the flag already false, and labelling that draft
-- 'user' would make the module-status API report a false "4 von 4" — silencing
-- the refinement entry point for exactly the people it exists for.
--
-- Traces investigated and rejected: the Routine/portfolio/need-version rows
-- written by `personal_plan_complete_draft_activate_v2` (20260811154526,
-- 20260825140000) carry no acceptance-source column — the whole reason
-- 20260817085000 added a separate plan flag was that "the resulting Routine is
-- indistinguishable from an interactively refined one". The outbox rows carry
-- source kinds, not acceptance provenance. Timestamps do not separate the
-- cohorts either: `reopen` copies a completed draft's answers into the
-- successor row, so a resumed synthetic draft looks freshly edited.
--
-- The strongest durable trace is the draft content itself. Direct acceptance
-- writes exactly `buildDirectAcceptanceStage2Defaults()` =
-- `resolveAssumedAnswers({answers:{}})` (direct-acceptance/defaults.ts,
-- refinement/assumed-defaults.ts), a fixed value set: no owned products,
-- weekly_2x, mikrofaser + gentle_press, air_dry, no heat tools, no night
-- protection, and — where the trigger context opens them — scalp `normal` and
-- dry-shampoo bridge `decline`. That row survives the flag clear: `reopen`
-- inserts a NEW in_progress row and leaves the completed synthetic draft in
-- place.
--
-- Heuristic, in two steps:
--   1. Plan-level cohort. A plan shows direct-acceptance evidence when
--      `unrefined_direct_accept` is still true OR any of its drafts matches the
--      synthetic signature above. Plans with no such evidence were never
--      direct-accepted, so every completed id on their drafts stays 'user' and
--      purely interactive users are untouched.
--   2. Per-id labelling inside the cohort. `reopen` copies the synthetic
--      answers forward, so a resumed draft is a MIX: ids the user has since
--      answered plus untouched defaults. A whole-draft rule would mislabel it,
--      so each completed id is compared against the assumed value its rule in
--      STAGE2_ASSUMPTION_RULES writes. An id is 'user' only where the stored
--      answer provably deviates from that assumed value.
--
-- Error direction (ruled): where the comparison genuinely cannot distinguish —
-- a user who freely chose exactly the assumed value, a missing or unknown
-- answer — the id is labelled 'assumed', never 'user'. False-incomplete costs a
-- genuinely refined user one unnecessary banner; false-complete would leave a
-- synthetic user permanently unrefined with no entry point. Hence the
-- `COALESCE(..., true)` and the `ELSE true` below. A later real Stage-2 answer
-- save corrects any over-labelled id (saveAnswer always writes 'user').
UPDATE public.personal_plan_refinement_drafts AS draft
SET answer_provenance = COALESCE(backfill.provenance, '{}'::jsonb)
FROM (
  SELECT
    d.id AS draft_id,
    (
      SELECT jsonb_object_agg(
        q.question_id,
        CASE
          WHEN evidence.direct_accepted
            AND COALESCE(
              CASE
                WHEN q.question_id = 'current_product_categories'
                  THEN d.answers->'currentProductCategories' = '[]'::jsonb
                WHEN q.question_id = 'wet_wash_frequency'
                  THEN d.answers->>'wetWashFrequency' = 'weekly_2x'
                WHEN q.question_id = 'scalp_irritation_detail'
                  THEN d.answers->>'scalpIrritationDetail' = 'normal'
                WHEN q.question_id = 'dry_shampoo_bridge_preference'
                  THEN d.answers->>'dryShampooBridgePreference' = 'decline'
                WHEN q.question_id = 'dry_shampoo_visible_hair_color'
                  THEN d.answers->>'dryShampooVisibleHairColor' = 'light_blonde'
                WHEN q.question_id = 'oil_purposes'
                  THEN d.answers->'oilPurposes' = '["prewash_lengths"]'::jsonb
                -- Both towel rules end at `gentle_press`; the material half can
                -- be the user's own (assume:towel_technique:gentle_press), so
                -- the technique is the only half this can compare.
                WHEN q.question_id = 'towel_handling'
                  THEN d.answers->'towel'->>'technique' = 'gentle_press'
                WHEN q.question_id = 'drying_routes'
                  THEN d.answers->'dryingRoutes' = '["air_dry"]'::jsonb
                WHEN q.question_id = 'additional_heat_tools'
                  THEN d.answers->'additionalHeatTools' = '[]'::jsonb
                WHEN q.question_id = 'night_protection'
                  THEN d.answers->'nightProtection' = '[]'::jsonb
                WHEN q.question_id LIKE 'heat:%'
                  THEN d.answers->'heatEvents'->q.question_id->>'frequency'
                         = 'less_than_monthly'
                    AND COALESCE(
                      d.answers->'heatEvents'->q.question_id->>'protectionConsistency',
                      'unsure'
                    ) = 'unsure'
                ELSE true
              END,
              true
            )
          THEN 'assumed'::text
          ELSE 'user'
        END
      )
      FROM unnest(d.completed_question_ids) AS q(question_id)
    ) AS provenance
  FROM public.personal_plan_refinement_drafts AS d
  JOIN LATERAL (
    SELECT (
      plan.unrefined_direct_accept
      OR EXISTS (
        SELECT 1
        FROM public.personal_plan_refinement_drafts AS synthetic
        WHERE synthetic.personal_plan_id = d.personal_plan_id
          AND synthetic.answers->'currentProductCategories' = '[]'::jsonb
          AND synthetic.answers->>'wetWashFrequency' = 'weekly_2x'
          AND synthetic.answers->'towel'
                = '{"material":"mikrofaser","technique":"gentle_press"}'::jsonb
          AND synthetic.answers->'dryingRoutes' = '["air_dry"]'::jsonb
          AND synthetic.answers->'additionalHeatTools' = '[]'::jsonb
          AND synthetic.answers->'nightProtection' = '[]'::jsonb
          AND COALESCE(synthetic.answers->>'scalpIrritationDetail', 'normal') = 'normal'
          AND COALESCE(synthetic.answers->>'dryShampooBridgePreference', 'decline') = 'decline'
          AND COALESCE(synthetic.answers->'heatEvents', '{}'::jsonb) = '{}'::jsonb
      )
    ) AS direct_accepted
    FROM public.personal_plans AS plan
    WHERE plan.id = d.personal_plan_id
  ) AS evidence ON true
) AS backfill
WHERE draft.id = backfill.draft_id;

-- personal_plan_save_refinement_draft gains the provenance payload in the
-- same write it already performs. The parameter list changes, so the old
-- overload is dropped rather than replaced in place; a 5-argument
-- compatibility overload delegating to the new one is re-created below.
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

-- Deploy-order compatibility overload — TEMPORARY, dropped in a later cleanup
-- migration (deliberately NOT written now, so it cannot be applied before the
-- 6-argument caller is live everywhere).
--
-- Migrations run before the new build is serving. Without this overload the
-- still-live previous build's `save()` — which passes five arguments — would
-- fail with "function does not exist" for the whole migrate→deploy window,
-- breaking every Stage-2 answer save and every direct acceptance (both go
-- through this RPC).
--
-- It must be NON-DESTRUCTIVE. The 6-argument body REPLACES answer_provenance
-- outright (new code depends on that: it recomputes the whole map per save), so
-- delegating with an empty map would let one straggler save from the old build
-- wipe the provenance this migration just backfilled — resurrecting the false
-- "4 von 4" for exactly the auto-accepted cohort the backfill exists to protect.
--
-- Instead the overload carries the stored map forward, filtered to the ids the
-- caller still reports as completed. That mirrors `pruneAnswerProvenance()`
-- (refinement/answer-provenance.ts): entries for ids that dropped off the path
-- go away, entries for surviving ids keep their label, and nothing is invented
-- for a newly completed id — a completed id with no entry is read as 'user'
-- (legacy data) by `userAnsweredQuestionIds()`, which is exactly what a write
-- from the pre-provenance build means.
--
-- The subquery reads the pre-update row (arguments are evaluated before the
-- call) and the 6-argument body's revision CAS still guards the write, so a
-- concurrent save cannot be silently overwritten — it returns revision_conflict.
CREATE OR REPLACE FUNCTION public.personal_plan_save_refinement_draft(
  p_user_id uuid, p_draft_id uuid, p_expected_revision bigint, p_answers jsonb,
  p_completed_question_ids text[]
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.personal_plan_save_refinement_draft(
    p_user_id, p_draft_id, p_expected_revision, p_answers, p_completed_question_ids,
    COALESCE(
      (
        SELECT pg_catalog.jsonb_object_agg(entry.key, entry.value)
          FROM public.personal_plan_refinement_drafts AS draft,
               LATERAL pg_catalog.jsonb_each(draft.answer_provenance) AS entry
         WHERE draft.id = p_draft_id
           AND draft.user_id = p_user_id
           AND entry.key = ANY(p_completed_question_ids)
      ),
      '{}'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[]) TO service_role;
