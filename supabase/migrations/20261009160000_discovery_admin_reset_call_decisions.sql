-- Cockpit call-ready A2 (plans/cockpit-call-ready/plan.md): „Testlauf zurücksetzen".
--
-- One locked write that deletes every call decision of one intake, so a test run (or a call
-- re-done from scratch) starts from the Idealplan again. It takes the same intake row lock as
-- discovery_admin_set_call_decision and discovery_admin_set_intake_item_usage, so it
-- serialises with them and with finalising; a finalised call is frozen, like every other
-- decision write. Draft and submitted intakes reset alike. The call sheet (score, brief,
-- commitments, feedback) is a separate table and is not touched.
--
-- Outcomes (jsonb `outcome`): not_found | finalized | reset (with `deleted`, the row count).
--
-- Additive: a new function only.
-- Reverse: DROP FUNCTION public.discovery_admin_reset_call_decisions(uuid);

CREATE FUNCTION public.discovery_admin_reset_call_decisions(target_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  finalized_at timestamptz;
  deleted_count integer;
BEGIN
  SELECT intake.call_finalized_at INTO finalized_at
    FROM public.discovery_intakes AS intake
   WHERE intake.id = target_intake_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;
  IF finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'finalized');
  END IF;

  DELETE FROM public.discovery_call_decisions AS decision
   WHERE decision.intake_id = target_intake_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('outcome', 'reset', 'deleted', deleted_count);
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_admin_reset_call_decisions(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discovery_admin_reset_call_decisions(uuid) TO service_role;

COMMENT ON FUNCTION public.discovery_admin_reset_call_decisions(uuid) IS
  'Cockpit „Testlauf zurücksetzen": deletes every call decision of one intake until it is finalised, under the intake row lock.';
