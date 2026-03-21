-- Realign shampoo matching to explicit matrix buckets instead of
-- synthetic scalp_type + scalp_condition triples.

DROP TRIGGER IF EXISTS trg_sync_product_shampoo_specs ON public.products;

DROP FUNCTION IF EXISTS public.sync_product_shampoo_specs_from_products();
DROP FUNCTION IF EXISTS public.expand_shampoo_eligibility(text[], text[]);
DROP FUNCTION IF EXISTS public.match_shampoo_products(vector, text, text, text, integer, text[]);
DROP FUNCTION IF EXISTS public.match_shampoo_products(vector, text, text, integer, text[]);

DROP TABLE IF EXISTS public.product_shampoo_specs;

CREATE TABLE public.product_shampoo_specs (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL CHECK (thickness IN ('fine', 'normal', 'coarse')),
  shampoo_bucket text NOT NULL CHECK (
    shampoo_bucket IN ('schuppen', 'irritationen', 'normal', 'dehydriert-fettig', 'trocken')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, shampoo_bucket)
);

CREATE INDEX idx_product_shampoo_specs_lookup
  ON public.product_shampoo_specs (thickness, shampoo_bucket);

CREATE INDEX idx_product_shampoo_specs_product_id
  ON public.product_shampoo_specs (product_id);

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
    -- Some shampoos belong to multiple exact matrix cells without forming a
    -- complete thickness x bucket cross-product. Keep these explicit pairs
    -- hard-coded here so helper-table eligibility stays faithful to the matrix.
    -- TODO: Replace this name-gate once exact shampoo_bucket_pairs are persisted
    -- generically. Today only Neqi Moisture Mystery needs a non-Cartesian match.
    IF NEW.name = 'Neqi Moisture Mystery' THEN
      INSERT INTO public.product_shampoo_specs (product_id, thickness, shampoo_bucket)
      VALUES
        (NEW.id, 'fine', 'trocken'),
        (NEW.id, 'normal', 'normal')
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.product_shampoo_specs (product_id, thickness, shampoo_bucket)
      SELECT NEW.id, e.thickness, e.shampoo_bucket
      FROM public.expand_shampoo_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_sync_product_shampoo_specs
AFTER INSERT OR UPDATE OF category, suitable_thicknesses, suitable_concerns
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_shampoo_specs_from_products();

DELETE FROM public.product_shampoo_specs;

INSERT INTO public.product_shampoo_specs (product_id, thickness, shampoo_bucket)
SELECT p.id, exact_specs.thickness, exact_specs.shampoo_bucket
FROM public.products p
CROSS JOIN (
  VALUES
    ('fine'::text, 'trocken'::text),
    ('normal'::text, 'normal'::text)
) AS exact_specs(thickness, shampoo_bucket)
WHERE p.category = ANY(ARRAY['Shampoo', 'Shampoo Profi'])
  -- TODO: Keep this backfill aligned with the temporary trigger exception above
  -- until explicit shampoo_bucket_pairs are stored in the database.
  AND p.name = 'Neqi Moisture Mystery'
ON CONFLICT DO NOTHING;

INSERT INTO public.product_shampoo_specs (product_id, thickness, shampoo_bucket)
SELECT p.id, e.thickness, e.shampoo_bucket
FROM public.products p
CROSS JOIN LATERAL public.expand_shampoo_eligibility(
  p.suitable_thicknesses,
  p.suitable_concerns
) AS e
WHERE p.category = ANY(ARRAY['Shampoo', 'Shampoo Profi'])
  AND p.name <> 'Neqi Moisture Mystery'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.match_shampoo_products(
  query_embedding vector,
  user_thickness text,
  user_shampoo_bucket text,
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
  IF user_thickness IS NULL OR user_shampoo_bucket IS NULL THEN
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
   AND s.shampoo_bucket = user_shampoo_bucket
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.sort_order ASC
  LIMIT match_count;
END;
$function$;
