-- The shareable Personal Plan field-test campaign is the supported production
-- QA path. Retire the unused fixed-owner preparation surface without rewriting
-- the already-applied migration that originally introduced it.
DROP FUNCTION IF EXISTS public.prepare_personal_plan_test_owner(uuid, jsonb, jsonb);
