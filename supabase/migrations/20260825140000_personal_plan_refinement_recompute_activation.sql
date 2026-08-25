-- Task 1.6 (b) + (d): Stage-3 completion wrapper that
--   (b) ACTIVATES the successor Routine immediately when the completion's
--       refined Need version came out of a Stage-2 MODULE projection
--       (plan decision 12: "✓ Plan aktualisiert" must be honest), and
--   (d) writes the direct-accept provenance INSIDE the same transaction
--       instead of the previous best-effort write after activation.
--
-- Additive: `personal_plan_complete_draft_activate_initial_v1` and the legacy
-- successor staging keep their behavior verbatim; this function only wraps
-- them. DEPLOY ORDER: apply this migration to prod BEFORE deploying the code
-- that calls it — new code selects `personal_plan_complete_draft_activate_v2`
-- unconditionally.
--
-- Scope of the immediate activation, deliberately narrow:
--   * no active Routine        → unchanged (v1 already activates the first one)
--   * active Routine, module-driven refined version → proposal is staged AND
--     confirmed in this transaction; the caller sees `routineProposalId: null`
--   * active Routine, anything else (today's linear refinement, the Stage-3
--     Routine-authority repair, editor edits, source reconciliation)
--     → unchanged pending proposal.
-- "Module-driven" is derived from server state only, from TWO conditions:
--   1. the refinement draft that produced the completion's refined Need version
--      carries a non-empty `module_projections` lineage (written exclusively by
--      `personal_plan_complete_stage2_module`), and
--   2. this completion is the FIRST Routine compiled from that refined version.
-- Condition 2 is what keeps the immediate activation to the recompute the
-- module completion actually caused. The lineage marks a VERSION, not a single
-- completion, so without it every later Stage-3 completion against the same
-- version — a product edit, the Routine-authority repair, a source
-- reconciliation — would silently auto-activate too and quietly delete the
-- proposal step for the rest of that version's life.
-- Nothing writes that lineage before PR 2, so this migration changes no live
-- behavior on its own.
CREATE OR REPLACE FUNCTION public.personal_plan_complete_draft_activate_v2(
  p_user_id uuid, p_personal_plan_id uuid, p_product_draft_id uuid, p_expected_draft_revision bigint, p_expected_source_revision bigint,
  p_portfolio_schema_version integer, p_portfolio_snapshot jsonb, p_routine_schema_version integer,
  p_routine_compiler_version text, p_routine_authority_versions jsonb, p_routine_source_fingerprint text,
  p_routine_payload jsonb, p_proposal_delta jsonb,
  p_mark_unrefined_direct_accept boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_result jsonb;
  v_confirm jsonb;
  v_refined_id uuid;
  v_routine_id uuid;
  v_module_driven boolean := false;
  v_proposal public.personal_plan_routine_proposals%ROWTYPE;
BEGIN
  v_result := public.personal_plan_complete_draft_activate_initial_v1(
    p_user_id, p_personal_plan_id, p_product_draft_id, p_expected_draft_revision,
    p_expected_source_revision, p_portfolio_schema_version, p_portfolio_snapshot,
    p_routine_schema_version, p_routine_compiler_version, p_routine_authority_versions,
    p_routine_source_fingerprint, p_routine_payload, p_proposal_delta
  );

  -- Every non-completion outcome (conflict, invalid source, too large) is
  -- returned verbatim; a NULL status counts as one.
  IF (v_result->>'status') IS NULL
     OR (v_result->>'status') NOT IN ('completed', 'already_completed') THEN
    RETURN v_result;
  END IF;

  IF (v_result->>'routineProposalId') IS NOT NULL THEN
    SELECT draft.refined_need_version_id INTO v_refined_id
      FROM public.personal_plan_product_drafts draft
     WHERE draft.id = p_product_draft_id
       AND draft.personal_plan_id = p_personal_plan_id
       AND draft.user_id = p_user_id;
    v_routine_id := (v_result->>'routineVersionId')::uuid;

    v_module_driven := v_refined_id IS NOT NULL
    -- Condition 2: no Routine other than this completion's own was ever
    -- compiled from this refined version. On a replay `v_routine_id` is that
    -- same pre-existing row, so it excludes itself and the replay still reads
    -- as the module-driven activation it was.
    AND NOT EXISTS (
      SELECT 1
        FROM public.personal_plan_routine_versions prior
       WHERE prior.personal_plan_id = p_personal_plan_id
         AND prior.user_id = p_user_id
         AND prior.source_refined_need_version_id = v_refined_id
         AND prior.id <> v_routine_id
    )
    -- Condition 1: module lineage.
    AND EXISTS (
      SELECT 1
        FROM public.personal_plan_refinement_drafts refinement
       WHERE refinement.personal_plan_id = p_personal_plan_id
         AND refinement.user_id = p_user_id
         AND refinement.module_projections <> '{}'::jsonb
         AND (
           refinement.result_refined_need_version_id = v_refined_id
           OR EXISTS (
             SELECT 1
               FROM pg_catalog.jsonb_each(refinement.module_projections) AS projection(key, value)
              WHERE projection.value->>'needVersionId' = v_refined_id::text
           )
         )
    );
  END IF;

  IF v_module_driven THEN
    SELECT * INTO v_proposal
      FROM public.personal_plan_routine_proposals
     WHERE id = (v_result->>'routineProposalId')::uuid
       AND personal_plan_id = p_personal_plan_id
       AND user_id = p_user_id
     FOR UPDATE;

    IF v_proposal.id IS NOT NULL AND v_proposal.status = 'pending' THEN
      v_confirm := public.personal_plan_confirm_routine_proposal(
        p_user_id, p_personal_plan_id, v_proposal.id, (v_result->>'revision')::bigint
      );
      -- This function holds the plan row lock for the whole transaction, so a
      -- non-accepted outcome is an invariant violation, not a race. Fail loudly
      -- instead of leaving a "pending proposal" the caller already reported as
      -- an activation.
      IF v_confirm->>'outcome' <> 'accepted' THEN
        RAISE EXCEPTION 'refinement recompute could not activate its successor: %',
          COALESCE(v_confirm->>'outcome', 'unknown');
      END IF;
      v_result := v_result || pg_catalog.jsonb_build_object(
        'revision', (v_confirm->>'revision')::bigint,
        'routineProposalId', NULL
      );
    ELSIF v_proposal.id IS NOT NULL AND v_proposal.status = 'accepted' THEN
      -- Replay of a lost response: this transaction's predecessor already
      -- activated the successor.
      v_result := v_result || pg_catalog.jsonb_build_object('routineProposalId', NULL);
    END IF;
  END IF;

  -- Atomic direct-accept provenance. Deliberately does NOT bump `revision`:
  -- the caller's freshly returned revision has to stay valid.
  IF p_mark_unrefined_direct_accept THEN
    UPDATE public.personal_plans
       SET unrefined_direct_accept = true,
           nudge_dismissed_until = NULL,
           updated_at = pg_catalog.now()
     WHERE id = p_personal_plan_id AND user_id = p_user_id;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.personal_plan_complete_draft_activate_v2(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_complete_draft_activate_v2(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb,boolean)
  TO service_role;
