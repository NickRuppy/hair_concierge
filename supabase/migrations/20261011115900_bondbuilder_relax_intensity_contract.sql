-- Step 1 of retiring product_bondbuilder_specs.bond_repair_intensity (Nick, 2026-10-09).
-- Apply BEFORE deploying the app that stops writing the field: legacy rows without a
-- research profile no longer need it, so new code can create them against the old schema
-- while old code (which still writes it) keeps working. The column and its value CHECK
-- stay until 20261011120000_bondbuilder_retire_bond_repair_intensity.sql.
BEGIN;

ALTER TABLE public.product_bondbuilder_specs DROP CONSTRAINT bondbuilder_research_contract_v1;
ALTER TABLE public.product_bondbuilder_specs ADD CONSTRAINT bondbuilder_research_contract_v1 CHECK (
 CASE WHEN research_profile IS NULL THEN
 technology_family IS NULL AND claim_trust_level IS NULL AND trust_basis IS NULL
 AND application_mode IS NOT NULL AND bond_repair_axis IS NOT NULL
 AND treatment_mode IS NOT NULL AND product_format IS NOT NULL AND usage_protocol IS NOT NULL
 AND usage_protocol<>'verified_product_protocol'
 ELSE
 public.bondbuilder_profile_valid_v1(research_profile)
 AND technology_family IS NOT NULL AND claim_trust_level IS NOT NULL AND trust_basis IS NOT NULL
 AND technology_family=research_profile#>>'{assessment,technology_family}'
 AND claim_trust_level=research_profile#>>'{assessment,claim_trust_level}'
 AND trust_basis=research_profile#>>'{assessment,trust_basis}'
 AND research_profile#>>'{identity,product_id}' IS NOT NULL
 AND product_id::text=research_profile#>>'{identity,product_id}'
 END
);

COMMIT;
