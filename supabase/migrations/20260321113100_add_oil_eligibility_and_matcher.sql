-- Add strict oil eligibility pairs and exact-match oil RPC.
-- Source of truth remains public.products.suitable_thicknesses + suitable_concerns.

CREATE TABLE IF NOT EXISTS public.product_oil_eligibility (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL CHECK (thickness IN ('fine', 'normal', 'coarse')),
  oil_subtype text NOT NULL CHECK (
    oil_subtype IN ('natuerliches-oel', 'styling-oel', 'trocken-oel')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, oil_subtype)
);

CREATE INDEX IF NOT EXISTS idx_product_oil_eligibility_lookup
  ON public.product_oil_eligibility (thickness, oil_subtype);

CREATE INDEX IF NOT EXISTS idx_product_oil_eligibility_product_id
  ON public.product_oil_eligibility (product_id);

CREATE OR REPLACE FUNCTION public.expand_oil_eligibility(
  p_thicknesses text[],
  p_concerns text[]
)
RETURNS TABLE(
  thickness text,
  oil_subtype text
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
      IF c IN ('natuerliches-oel', 'styling-oel', 'trocken-oel') THEN
        thickness := t;
        oil_subtype := c;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_product_oil_eligibility_from_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  DELETE FROM public.product_oil_eligibility
  WHERE product_id = NEW.id;

  IF NEW.category = 'Öle' THEN
    INSERT INTO public.product_oil_eligibility (product_id, thickness, oil_subtype)
    SELECT NEW.id, e.thickness, e.oil_subtype
    FROM public.expand_oil_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_product_oil_eligibility ON public.products;
CREATE TRIGGER trg_sync_product_oil_eligibility
AFTER INSERT OR UPDATE OF category, suitable_thicknesses, suitable_concerns
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_oil_eligibility_from_products();

DELETE FROM public.product_oil_eligibility;

INSERT INTO public.product_oil_eligibility (product_id, thickness, oil_subtype)
SELECT p.id, e.thickness, e.oil_subtype
FROM public.products p
CROSS JOIN LATERAL public.expand_oil_eligibility(
  p.suitable_thicknesses,
  p.suitable_concerns
) AS e
WHERE p.category = 'Öle'
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.match_oil_products(vector, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.match_oil_products(
  query_embedding vector,
  user_thickness text,
  user_oil_subtype text,
  match_count integer DEFAULT 5,
  category_filter text[] DEFAULT ARRAY['Öle']
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
  IF user_thickness IS NULL OR user_oil_subtype IS NULL THEN
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
  JOIN public.product_oil_eligibility o
    ON o.product_id = p.id
   AND o.thickness = user_thickness
   AND o.oil_subtype = user_oil_subtype
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.sort_order ASC
  LIMIT match_count;
END;
$function$;

ALTER TABLE public.product_oil_eligibility ENABLE ROW LEVEL SECURITY;
