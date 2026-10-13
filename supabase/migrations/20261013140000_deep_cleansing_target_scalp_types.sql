-- S2 profile-based picks (plans/catalog-completeness-fill/s2-profile-picks.md §2.1, decisions.md D-a).
-- Additive, schema only: a soft scalp-target positioning for deep-cleansing shampoos, projected from
-- Shampoo v1.6 §13.5 on each formula. NULL = not engine-assessed (no soft rank); '{}' = assessed,
-- no explicit target. Values arrive in a separate, per-batch approved backfill (S2b). The curated
-- publication gate is unchanged: the column is soft and nullable.

-- Postgres forbids subqueries in CHECK constraints, hence the immutable helper.
CREATE OR REPLACE FUNCTION public.deep_cleansing_scalp_types_valid(v text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT v IS NULL OR (
    v <@ ARRAY['oily', 'balanced', 'dry']::text[]
    AND array_position(v, NULL) IS NULL
    AND cardinality(v) = (SELECT count(DISTINCT x) FROM unnest(v) AS x)
    -- Shampoo v1.6 S-SECONDARY: never oily together with dry.
    AND NOT (v @> ARRAY['oily', 'dry']::text[])
  )
$$;

ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ADD COLUMN IF NOT EXISTS target_scalp_types text[] NULL;

ALTER TABLE public.product_deep_cleansing_shampoo_specs
  DROP CONSTRAINT IF EXISTS product_deep_cleansing_target_scalp_types_check;

ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ADD CONSTRAINT product_deep_cleansing_target_scalp_types_check
  CHECK (public.deep_cleansing_scalp_types_valid(target_scalp_types));

COMMENT ON COLUMN public.product_deep_cleansing_shampoo_specs.target_scalp_types IS
  'Soft scalp-target positioning. NULL = not engine-assessed; {} = assessed, no explicit target. Source: Shampoo v1.6 §13.5 (decisions.md D-a).';
