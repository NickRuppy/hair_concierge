-- Restore service APIs after the compatible application is re-enabled.
-- Keep all retained profile data and strict schema checks.
BEGIN;
GRANT EXECUTE ON FUNCTION public.bondbuilder_research_preimage_v1(uuid), public.bondbuilder_research_enrich_v1(uuid,jsonb,jsonb,uuid,text), public.product_intake_approve_bondbuilder_owner_v1(uuid,uuid,jsonb,jsonb,text,timestamptz,text) TO service_role;
COMMIT;
