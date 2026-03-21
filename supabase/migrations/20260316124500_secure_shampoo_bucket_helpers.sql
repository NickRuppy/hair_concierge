-- Security hardening for shampoo helper objects introduced by the
-- bucket realignment migration.

CREATE OR REPLACE FUNCTION public.expand_shampoo_eligibility(
  p_thicknesses text[],
  p_concerns text[]
)
RETURNS TABLE(
  thickness text,
  shampoo_bucket text
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'extensions'
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
      IF c NOT IN ('schuppen', 'irritationen', 'normal', 'dehydriert-fettig', 'trocken') THEN
        CONTINUE;
      END IF;

      thickness := t;
      shampoo_bucket := c;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$function$;

ALTER TABLE public.product_shampoo_specs ENABLE ROW LEVEL SECURITY;
