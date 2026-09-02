-- Extend the guarded identifier executor with the exact E20 OGX package.
-- E20 remains blocked until the separate exact disposition reversal has
-- released the obsolete identity hold and all Oil authority remains complete.
ALTER TABLE public.scanner_identifier_backfill_batches
  DROP CONSTRAINT scanner_identifier_backfill_batches_batch_name_check;
ALTER TABLE public.scanner_identifier_backfill_batches
  ADD CONSTRAINT scanner_identifier_backfill_batches_batch_name_check
  CHECK (batch_name IN (
    'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10',
    'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E19', 'E20'
  ));

DO $mapping$
DECLARE
  v_definition text;
  v_old_allowed text := $old$'E17', 'E18', 'E19')$old$;
  v_new_allowed text := $new$'E17', 'E18', 'E19', 'E20')$new$;
  v_old_shape text := $old$  ELSIF v_batch_name = 'E19' THEN
    v_expected_products := 1;
    v_expected_gtins := 3;
    v_approved_fingerprint := '5f062d6932340d504ffd796985f25e03464ada0f32c119e07572c4c8543b47b8';
  ELSE$old$;
  v_new_shape text := $new$  ELSIF v_batch_name = 'E19' THEN
    v_expected_products := 1;
    v_expected_gtins := 3;
    v_approved_fingerprint := '5f062d6932340d504ffd796985f25e03464ada0f32c119e07572c4c8543b47b8';
  ELSIF v_batch_name = 'E20' THEN
    v_expected_products := 1;
    v_expected_gtins := 1;
    v_approved_fingerprint := '043fae1462b038c8babbfafc3559aac64894852f5e571f3b8d7b44123556d034';
  ELSE$new$;
  v_old_readiness text := $old$    IF v_batch_name = 'E19' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E19 product is not scan-result-ready';
    END IF;$old$;
  v_new_readiness text := $new$    IF v_batch_name = 'E19' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E19 product is not scan-result-ready';
    END IF;
    IF v_batch_name = 'E20' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E20 product is not scan-result-ready';
    END IF;$new$;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)'::pg_catalog.regprocedure
  ) INTO v_definition;

  IF v_definition IS NULL
     OR position('SECURITY DEFINER' IN v_definition) = 0
     OR position(v_old_allowed IN v_definition) = 0
     OR position(v_old_shape IN v_definition) = 0
     OR position(v_old_readiness IN v_definition) = 0 THEN
    RAISE EXCEPTION 'E20 scanner migration cannot verify the expected executor contract';
  END IF;

  v_definition := pg_catalog.replace(v_definition, v_old_allowed, v_new_allowed);
  v_definition := pg_catalog.replace(v_definition, v_old_shape, v_new_shape);
  v_definition := pg_catalog.replace(v_definition, v_old_readiness, v_new_readiness);
  EXECUTE v_definition;
END;
$mapping$;

REVOKE ALL ON FUNCTION public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)
  TO service_role;
