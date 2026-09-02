-- Extend the guarded product-disposition reversal lane with the exact OGX
-- identity-resolution cohort. This does not change the product or its Oil
-- authority; it only permits the obsolete identity hold to be released after
-- the existing product-level Oil protocols pass the publication gate.
ALTER TABLE public.personal_plan_product_search_disposition_reversal_batches
  DROP CONSTRAINT pp_disposition_reversal_batch_count_check;
ALTER TABLE public.personal_plan_product_search_disposition_reversal_batches
  ADD CONSTRAINT pp_disposition_reversal_batch_count_check
  CHECK (item_count IN (1, 6, 7));

ALTER TABLE public.personal_plan_product_search_disposition_reversal_items
  DROP CONSTRAINT pp_disposition_reversal_prior_disposition_check;
ALTER TABLE public.personal_plan_product_search_disposition_reversal_items
  ADD CONSTRAINT pp_disposition_reversal_prior_disposition_check
  CHECK (prior_disposition IN (
    'retired_from_personal_plan',
    'awaiting_exact_analysis',
    'identity_ambiguous'
  ));

ALTER TABLE public.personal_plan_product_search_disposition_reversal_items
  DROP CONSTRAINT pp_disposition_reversal_prior_reason_check;
ALTER TABLE public.personal_plan_product_search_disposition_reversal_items
  ADD CONSTRAINT pp_disposition_reversal_prior_reason_check
  CHECK (prior_reason_code IN (
    'wrong_category',
    'non_hair_product',
    'insufficient_executable_directions',
    'insufficient_finished_product_evidence',
    'identity_ambiguous'
  ));

DO $mapping$
DECLARE
  v_definition text;
  v_old_batch text := $old$    WHEN 'S5R-03-e18-oil-reentry' THEN 6
    ELSE NULL$old$;
  v_new_batch text := $new$    WHEN 'S5R-03-e18-oil-reentry' THEN 6
    WHEN 'S5R-04-ogx-identity-resolution' THEN 1
    ELSE NULL$new$;
  v_old_cohort_tail text := $old$  ) THEN
    RAISE EXCEPTION 'product disposition reversal product is outside the approved oil cohort';$old$;
  v_new_cohort_tail text := $new$  ) OR (
    v_batch_id = 'S5R-04-ogx-identity-resolution'
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
      WHERE item->>'product_id' IS DISTINCT FROM '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf'
    )
  ) THEN
    RAISE EXCEPTION 'product disposition reversal product is outside the approved oil cohort';$new$;
  v_old_disposition text := $old$    v_expected_disposition := CASE v_product_id::text
      WHEN '19aea9c4-4b90-4ec4-8cb6-90cb270010f7' THEN 'awaiting_exact_analysis'$old$;
  v_new_disposition text := $new$    v_expected_disposition := CASE v_product_id::text
      WHEN '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf' THEN 'identity_ambiguous'
      WHEN '19aea9c4-4b90-4ec4-8cb6-90cb270010f7' THEN 'awaiting_exact_analysis'$new$;
  v_old_reason text := $old$    v_expected_reason_code := CASE v_product_id::text
      WHEN '19aea9c4-4b90-4ec4-8cb6-90cb270010f7' THEN 'insufficient_executable_directions'$old$;
  v_new_reason text := $new$    v_expected_reason_code := CASE v_product_id::text
      WHEN '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf' THEN 'identity_ambiguous'
      WHEN '19aea9c4-4b90-4ec4-8cb6-90cb270010f7' THEN 'insufficient_executable_directions'$new$;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_product_search_disposition_reversal_v1(text,text,text,text,boolean)'::pg_catalog.regprocedure
  ) INTO v_definition;

  IF v_definition IS NULL
     OR position('SECURITY DEFINER' IN v_definition) = 0
     OR position(v_old_batch IN v_definition) = 0
     OR position(v_old_cohort_tail IN v_definition) = 0
     OR position(v_old_disposition IN v_definition) = 0
     OR position(v_old_reason IN v_definition) = 0 THEN
    RAISE EXCEPTION 'OGX disposition reversal migration cannot verify the expected executor contract';
  END IF;

  v_definition := pg_catalog.replace(v_definition, v_old_batch, v_new_batch);
  v_definition := pg_catalog.replace(v_definition, v_old_cohort_tail, v_new_cohort_tail);
  v_definition := pg_catalog.replace(v_definition, v_old_disposition, v_new_disposition);
  v_definition := pg_catalog.replace(v_definition, v_old_reason, v_new_reason);
  EXECUTE v_definition;
END;
$mapping$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_product_search_disposition_reversal_v1(text,text,text,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_product_search_disposition_reversal_v1(text,text,text,text,boolean)
  TO service_role;
