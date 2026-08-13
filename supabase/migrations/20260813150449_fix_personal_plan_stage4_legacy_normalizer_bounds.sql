-- Complete the production correction: GREATEST and LEAST, like COALESCE, are
-- PostgreSQL syntax forms and cannot be schema-qualified.
CREATE OR REPLACE FUNCTION public.personal_plan_stage4_normalize_legacy_initial_proposals_v1(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
  v_updated integer := 0;
BEGIN
  WITH eligible AS (
    SELECT
      plan.id AS personal_plan_id,
      plan.pending_routine_proposal_id AS proposal_id,
      proposal.candidate_routine_version_id AS candidate_routine_version_id
    FROM public.personal_plans AS plan
    JOIN public.personal_plan_routine_proposals AS proposal
      ON proposal.id = plan.pending_routine_proposal_id
     AND proposal.personal_plan_id = plan.id
     AND proposal.user_id = plan.user_id
    JOIN public.personal_plan_routine_versions AS candidate
      ON candidate.id = proposal.candidate_routine_version_id
     AND candidate.personal_plan_id = plan.id
     AND candidate.user_id = plan.user_id
    JOIN public.personal_plan_portfolio_versions AS portfolio
      ON portfolio.id = candidate.source_portfolio_version_id
     AND portfolio.personal_plan_id = plan.id
     AND portfolio.user_id = plan.user_id
     AND portfolio.refined_need_version_id = candidate.source_refined_need_version_id
    WHERE plan.active_routine_version_id IS NULL
      AND plan.pending_routine_proposal_id IS NOT NULL
      AND proposal.status = 'pending'
      AND proposal.origin = 'stage3_completion'
      AND proposal.base_routine_version_id IS NULL
      AND proposal.source_revision = plan.source_revision
      AND proposal.source_fingerprint = candidate.source_fingerprint
      AND candidate.source_refined_need_version_id = plan.current_refined_need_version_id
    ORDER BY plan.updated_at ASC NULLS LAST, plan.id
    LIMIT v_limit
    FOR UPDATE OF plan, proposal
  ),
  accepted AS (
    UPDATE public.personal_plan_routine_proposals AS proposal
       SET status = 'accepted',
           updated_at = pg_catalog.now()
      FROM eligible
     WHERE proposal.id = eligible.proposal_id
       AND proposal.status = 'pending'
     RETURNING eligible.personal_plan_id, eligible.proposal_id, eligible.candidate_routine_version_id
  ),
  activated AS (
    UPDATE public.personal_plans AS plan
       SET active_routine_version_id = accepted.candidate_routine_version_id,
           pending_routine_proposal_id = NULL,
           revision = plan.revision + 1,
           updated_at = pg_catalog.now()
      FROM accepted
     WHERE plan.id = accepted.personal_plan_id
       AND plan.active_routine_version_id IS NULL
       AND plan.pending_routine_proposal_id = accepted.proposal_id
     RETURNING plan.id
  )
  SELECT pg_catalog.count(*)::integer INTO v_updated FROM activated;

  RETURN pg_catalog.jsonb_build_object('normalized', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_stage4_normalize_legacy_initial_proposals_v1(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_stage4_normalize_legacy_initial_proposals_v1(integer)
  TO service_role;
