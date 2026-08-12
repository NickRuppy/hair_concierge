-- Portfolio completion already owns portfolio and included-product settlement.
-- Activation closes only the matching refinement event that was compiled into
-- the accepted Routine. Processing leases and later revisions remain owned by
-- their worker instead of being revoked by an unrelated acceptance transaction.
CREATE OR REPLACE FUNCTION public.personal_plan_settle_accepted_routine_refinement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_routine public.personal_plan_routine_versions%ROWTYPE;
BEGIN
  IF NEW.active_routine_version_id IS NULL
     OR NEW.active_routine_version_id IS NOT DISTINCT FROM OLD.active_routine_version_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO STRICT v_routine
    FROM public.personal_plan_routine_versions
   WHERE id = NEW.active_routine_version_id
     AND user_id = NEW.user_id
     AND personal_plan_id = NEW.id;

  UPDATE public.personal_plan_routine_source_change_outbox
     SET processed_revision = observed_revision,
         available_at = 'infinity'::timestamptz,
         last_error_code = NULL,
         processed_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   WHERE user_id = NEW.user_id
     AND personal_plan_id = NEW.id
     AND status = 'pending'
     AND observed_revision <= NEW.source_revision
     AND source_kind = 'refined_need'
     AND source_key = v_routine.source_refined_need_version_id::text;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS personal_plan_settle_accepted_routine_refinement ON public.personal_plans;
CREATE TRIGGER personal_plan_settle_accepted_routine_refinement
AFTER UPDATE OF active_routine_version_id ON public.personal_plans
FOR EACH ROW
WHEN (
  NEW.active_routine_version_id IS NOT NULL
  AND NEW.active_routine_version_id IS DISTINCT FROM OLD.active_routine_version_id
)
EXECUTE FUNCTION public.personal_plan_settle_accepted_routine_refinement();

REVOKE ALL ON FUNCTION public.personal_plan_settle_accepted_routine_refinement()
  FROM PUBLIC, anon, authenticated;
