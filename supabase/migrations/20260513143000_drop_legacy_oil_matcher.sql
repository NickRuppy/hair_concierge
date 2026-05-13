-- Oil recommendations now use the application-side recommendation engine
-- against product_oil_eligibility. Remove the legacy embedding RPC and drop
-- the unused specs table only when it is empty.

DROP FUNCTION IF EXISTS public.match_oil_products(extensions.vector, text, text, integer, text[]);

DO $$
DECLARE
  specs_row_count bigint;
BEGIN
  IF to_regclass('public.product_oil_specs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.product_oil_specs' INTO specs_row_count;

    IF specs_row_count = 0 THEN
      DROP TABLE public.product_oil_specs;
    ELSE
      RAISE EXCEPTION
        'Refusing to drop public.product_oil_specs because it contains % rows',
        specs_row_count;
    END IF;
  END IF;
END $$;
