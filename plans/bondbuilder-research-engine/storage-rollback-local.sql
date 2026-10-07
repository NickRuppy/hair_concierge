-- Application rollback only; additive schema and profiles are retained.
-- Local replay artifact, not authorization for a live change.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.bondbuilder_research_preimage_v1(uuid), public.bondbuilder_research_enrich_v1(uuid,jsonb,jsonb,uuid,text), public.product_intake_approve_bondbuilder_owner_v1(uuid,uuid,jsonb,jsonb,text,timestamptz,text) FROM service_role;
COMMIT;
