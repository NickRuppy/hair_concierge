-- Task 5 (routine refinement nudge): owner-scoped RPCs for
-- (1) snoozing the nudge and (2) clearing `unrefined_direct_accept` once a
-- refinement-produced Routine proposal is accepted. Both follow the existing
-- Stage-4 convention of owner-scoped SECURITY DEFINER RPCs rather than raw
-- table writes from the application layer.

CREATE OR REPLACE FUNCTION public.personal_plan_dismiss_routine_nudge(
  p_user_id uuid, p_personal_plan_id uuid, p_dismissed_until timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE;
BEGIN
  UPDATE public.personal_plans
    SET nudge_dismissed_until = p_dismissed_until, updated_at = pg_catalog.now()
    WHERE id = p_personal_plan_id AND user_id = p_user_id
    RETURNING * INTO v_plan;
  IF v_plan.id IS NULL THEN RETURN jsonb_build_object('outcome','invalid_source'); END IF;
  RETURN jsonb_build_object(
    'outcome','dismissed',
    'nudgeDismissedUntil', v_plan.nudge_dismissed_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_dismiss_routine_nudge(uuid,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_dismiss_routine_nudge(uuid,uuid,timestamptz) TO service_role;

-- Called from proposal-service.ts `resolve({action:"accept"})` immediately
-- after `personal_plan_confirm_routine_proposal` reports 'accepted'. Any
-- accepted proposal supersedes the unrefined-direct-accept state, so the
-- clear is unconditional and idempotent (repeat calls are harmless).
CREATE OR REPLACE FUNCTION public.personal_plan_clear_unrefined_direct_accept(
  p_user_id uuid, p_personal_plan_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE;
BEGIN
  UPDATE public.personal_plans
    SET unrefined_direct_accept = false, updated_at = pg_catalog.now()
    WHERE id = p_personal_plan_id AND user_id = p_user_id
    RETURNING * INTO v_plan;
  IF v_plan.id IS NULL THEN RETURN jsonb_build_object('outcome','invalid_source'); END IF;
  RETURN jsonb_build_object('outcome','cleared');
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_clear_unrefined_direct_accept(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_clear_unrefined_direct_accept(uuid,uuid) TO service_role;
