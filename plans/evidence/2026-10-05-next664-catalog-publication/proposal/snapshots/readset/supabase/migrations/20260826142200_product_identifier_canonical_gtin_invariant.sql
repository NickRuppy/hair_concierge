-- Enforce one valid canonical GTIN across the catalog only after the expand and
-- writer-compatibility migrations have made the active paths fail closed.

DO $$
DECLARE
  v_collision record;
BEGIN
  SELECT
    canonical_gtin14,
    array_agg(DISTINCT product_id ORDER BY product_id) AS product_ids,
    count(*) AS row_count
  INTO v_collision
  FROM public.product_identifiers
  WHERE canonical_gtin14 IS NOT NULL
  GROUP BY canonical_gtin14
  HAVING count(*) > 1
     AND count(DISTINCT product_id) > 1
  ORDER BY canonical_gtin14
  LIMIT 1;

  IF v_collision.canonical_gtin14 IS NOT NULL THEN
    RAISE EXCEPTION 'product identifier canonical GTIN collision: % owned by products %',
      v_collision.canonical_gtin14, v_collision.product_ids;
  END IF;
END $$;

DO $$
DECLARE
  v_duplicate record;
BEGIN
  SELECT
    canonical_gtin14,
    array_agg(id ORDER BY created_at, id) AS identifier_ids,
    count(*) AS row_count
  INTO v_duplicate
  FROM public.product_identifiers
  WHERE canonical_gtin14 IS NOT NULL
  GROUP BY canonical_gtin14
  HAVING count(*) > 1
  ORDER BY canonical_gtin14
  LIMIT 1;

  IF v_duplicate.canonical_gtin14 IS NOT NULL THEN
    RAISE EXCEPTION 'product identifier canonical GTIN duplicate rows require cleanup: % rows %',
      v_duplicate.canonical_gtin14, v_duplicate.identifier_ids;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_identifiers_canonical_gtin14_owner
  ON public.product_identifiers (canonical_gtin14)
  WHERE canonical_gtin14 IS NOT NULL;

-- The unique index serves the same lookup shape as the temporary expand-phase
-- index, so keep only one write-maintained structure after enforcement.
DROP INDEX IF EXISTS public.idx_product_identifiers_canonical_gtin14_lookup;
