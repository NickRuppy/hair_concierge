-- Coverage-gap fix: the active recommended shampoo catalog had zero coverage
-- for (thickness=coarse, shampoo_bucket=dehydriert-fettig, scalp_route=oily),
-- so every coarse+oily user saw the generic Stage-1 fallback card instead of a
-- concrete shampoo recommendation.
--
-- Decision (Nick, 2026-08-17): extend Monday Haircare Volume Kraft & Fülle
-- (already the ideal pick for normal+oily) to coarse. This is a product
-- decision without external coarse-suitability evidence; treat the coarse row
-- as preliminary if domain review revisits shampoo thickness suitability.

INSERT INTO public.product_shampoo_specs
  (product_id, category_key, thickness, shampoo_bucket, scalp_route, cleansing_intensity)
SELECT
  '6dc65df2-2466-43e4-bdc2-3a05803f305c', 'shampoo', 'coarse', 'dehydriert-fettig', 'oily', 'regular'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_shampoo_specs
  WHERE product_id = '6dc65df2-2466-43e4-bdc2-3a05803f305c'
    AND category_key = 'shampoo'
    AND thickness = 'coarse'
    AND shampoo_bucket = 'dehydriert-fettig'
);

-- The Stage-3 authority's thickness guard reads the legacy
-- products.suitable_thicknesses array (the spec-insert trigger only syncs
-- product_thickness_eligibility), so it must be extended explicitly.
UPDATE public.products
SET suitable_thicknesses = suitable_thicknesses || ARRAY['coarse']
WHERE id = '6dc65df2-2466-43e4-bdc2-3a05803f305c'
  AND NOT ('coarse' = ANY (suitable_thicknesses));

UPDATE public.products
SET description = 'Monday Haircare Volume Kraft & Fülle Shampoo ist ein Shampoo von Monday Haircare, empfohlen für mittelstarkes und dickes Haar bei dehydriert-fettiger Kopfhaut.'
WHERE id = '6dc65df2-2466-43e4-bdc2-3a05803f305c';
