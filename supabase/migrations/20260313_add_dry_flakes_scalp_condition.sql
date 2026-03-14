-- Add 'dry_flakes' as a scalp condition for users with dry scalp flaking
-- (distinct from dandruff — requires hydration, not antifungal treatment).

-- 1. Widen the CHECK constraint on product_shampoo_specs.
ALTER TABLE public.product_shampoo_specs
  DROP CONSTRAINT IF EXISTS product_shampoo_specs_scalp_condition_check;

ALTER TABLE public.product_shampoo_specs
  ADD CONSTRAINT product_shampoo_specs_scalp_condition_check
  CHECK (scalp_condition IN ('none', 'dandruff', 'irritated', 'dry_flakes'));

-- 2. Update expand_shampoo_eligibility() — add dry_flakes triples for 'trocken' concern.
CREATE OR REPLACE FUNCTION public.expand_shampoo_eligibility(
  p_thicknesses text[],
  p_concerns text[]
)
RETURNS TABLE(
  thickness text,
  scalp_type text,
  scalp_condition text
)
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  t text;
  c text;
BEGIN
  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    FOREACH c IN ARRAY COALESCE(p_concerns, ARRAY[]::text[]) LOOP
      IF c = 'dehydriert-fettig' THEN
        thickness := t;
        scalp_type := 'oily';
        scalp_condition := 'none';
        RETURN NEXT;
      ELSIF c = 'trocken' THEN
        -- existing: balanced dry-scalp user with no specific condition
        thickness := t;
        scalp_type := 'dry';
        scalp_condition := 'none';
        RETURN NEXT;
        -- NEW: user who reported dry flakes (any scalp type)
        thickness := t;
        scalp_type := 'oily';
        scalp_condition := 'dry_flakes';
        RETURN NEXT;
        thickness := t;
        scalp_type := 'balanced';
        scalp_condition := 'dry_flakes';
        RETURN NEXT;
        thickness := t;
        scalp_type := 'dry';
        scalp_condition := 'dry_flakes';
        RETURN NEXT;
      ELSIF c = 'normal' THEN
        thickness := t;
        scalp_type := 'balanced';
        scalp_condition := 'none';
        RETURN NEXT;
      ELSIF c = 'schuppen' THEN
        thickness := t;
        scalp_type := 'oily';
        scalp_condition := 'dandruff';
        RETURN NEXT;
        thickness := t;
        scalp_type := 'balanced';
        scalp_condition := 'dandruff';
        RETURN NEXT;
        thickness := t;
        scalp_type := 'dry';
        scalp_condition := 'dandruff';
        RETURN NEXT;
      ELSIF c = 'irritationen' THEN
        thickness := t;
        scalp_type := 'oily';
        scalp_condition := 'irritated';
        RETURN NEXT;
        thickness := t;
        scalp_type := 'balanced';
        scalp_condition := 'irritated';
        RETURN NEXT;
        thickness := t;
        scalp_type := 'dry';
        scalp_condition := 'irritated';
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- 3. Backfill: regenerate all shampoo eligibility triples (includes new dry_flakes rows).
DELETE FROM public.product_shampoo_specs;

INSERT INTO public.product_shampoo_specs (product_id, thickness, scalp_type, scalp_condition)
SELECT p.id, e.thickness, e.scalp_type, e.scalp_condition
FROM public.products p
CROSS JOIN LATERAL public.expand_shampoo_eligibility(
  p.suitable_thicknesses,
  p.suitable_concerns
) AS e
WHERE p.category = ANY(ARRAY['Shampoo', 'Shampoo Profi'])
ON CONFLICT DO NOTHING;
