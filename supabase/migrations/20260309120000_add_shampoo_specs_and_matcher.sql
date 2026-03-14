-- Add strict shampoo eligibility triples and exact-match shampoo RPC.
-- Requirement: shampoo recommendations are only valid when thickness +
-- scalp_type + scalp_condition are all present and jointly matched.

CREATE TABLE IF NOT EXISTS public.product_shampoo_specs (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL CHECK (thickness IN ('fine', 'normal', 'coarse')),
  scalp_type text NOT NULL CHECK (scalp_type IN ('oily', 'balanced', 'dry')),
  scalp_condition text NOT NULL CHECK (scalp_condition IN ('none', 'dandruff', 'irritated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, scalp_type, scalp_condition)
);

CREATE INDEX IF NOT EXISTS idx_product_shampoo_specs_lookup
  ON public.product_shampoo_specs (thickness, scalp_type, scalp_condition);

CREATE INDEX IF NOT EXISTS idx_product_shampoo_specs_product_id
  ON public.product_shampoo_specs (product_id);

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
        thickness := t;
        scalp_type := 'dry';
        scalp_condition := 'none';
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

CREATE OR REPLACE FUNCTION public.sync_product_shampoo_specs_from_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  DELETE FROM public.product_shampoo_specs
  WHERE product_id = NEW.id;

  IF NEW.category = ANY(ARRAY['Shampoo', 'Shampoo Profi']) THEN
    INSERT INTO public.product_shampoo_specs (product_id, thickness, scalp_type, scalp_condition)
    SELECT NEW.id, e.thickness, e.scalp_type, e.scalp_condition
    FROM public.expand_shampoo_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_product_shampoo_specs ON public.products;
CREATE TRIGGER trg_sync_product_shampoo_specs
AFTER INSERT OR UPDATE OF category, suitable_thicknesses, suitable_concerns
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_shampoo_specs_from_products();

-- Backfill existing shampoo products into eligibility triples.
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

DROP FUNCTION IF EXISTS public.match_shampoo_products(vector, text, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.match_shampoo_products(
  query_embedding vector,
  user_thickness text,
  user_scalp_type text,
  user_scalp_condition text,
  match_count integer DEFAULT 5,
  category_filter text[] DEFAULT ARRAY['Shampoo', 'Shampoo Profi']
)
RETURNS TABLE(
  id uuid,
  name text,
  brand text,
  description text,
  short_description text,
  tom_take text,
  category text,
  affiliate_link text,
  image_url text,
  price_eur numeric,
  tags text[],
  suitable_thicknesses text[],
  suitable_concerns text[],
  is_active boolean,
  sort_order integer,
  similarity double precision,
  profile_score double precision,
  combined_score double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF user_thickness IS NULL OR user_scalp_type IS NULL OR user_scalp_condition IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.description,
    p.short_description,
    p.tom_take,
    p.category,
    p.affiliate_link,
    p.image_url,
    p.price_eur,
    p.tags,
    p.suitable_thicknesses,
    p.suitable_concerns,
    p.is_active,
    p.sort_order,
    (1 - (p.embedding <=> query_embedding))::float AS similarity,
    1.0::float AS profile_score,
    (1 - (p.embedding <=> query_embedding))::float AS combined_score
  FROM public.products p
  JOIN public.product_shampoo_specs s
    ON s.product_id = p.id
   AND s.thickness = user_thickness
   AND s.scalp_type = user_scalp_type
   AND s.scalp_condition = user_scalp_condition
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.sort_order ASC
  LIMIT match_count;
END;
$function$;
