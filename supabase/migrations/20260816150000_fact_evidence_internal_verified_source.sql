-- Allow internally verified curation as an explicit evidence source type.
-- The catalogue-authority repair contract already models this source type;
-- the table check predates it. No data changes.

ALTER TABLE public.personal_plan_catalog_fact_evidence
  DROP CONSTRAINT personal_plan_catalog_fact_evidence_source_type_check;

ALTER TABLE public.personal_plan_catalog_fact_evidence
  ADD CONSTRAINT personal_plan_catalog_fact_evidence_source_type_check
    CHECK (
      source_type IN ('manufacturer', 'retailer', 'professional_authority', 'internal_verified')
    );
