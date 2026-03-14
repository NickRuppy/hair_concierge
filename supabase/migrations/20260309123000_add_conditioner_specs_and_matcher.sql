-- Add strict conditioner eligibility pairs and exact-match conditioner RPC.
-- Goal: use user profile values directly (thickness + protein_moisture_balance)
-- without runtime mapping to generic concern codes.

CREATE TABLE IF NOT EXISTS public.product_conditioner_specs (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL CHECK (thickness IN ('fine', 'normal', 'coarse')),
  protein_moisture_balance text NOT NULL CHECK (
    protein_moisture_balance IN ('snaps', 'stretches_bounces', 'stretches_stays')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, protein_moisture_balance)
);

CREATE INDEX IF NOT EXISTS idx_product_conditioner_specs_lookup
  ON public.product_conditioner_specs (thickness, protein_moisture_balance);

CREATE INDEX IF NOT EXISTS idx_product_conditioner_specs_product_id
  ON public.product_conditioner_specs (product_id);

CREATE OR REPLACE FUNCTION public.expand_conditioner_eligibility(
  p_thicknesses text[],
  p_concerns text[]
)
RETURNS TABLE(
  thickness text,
  protein_moisture_balance text
)
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  t text;
  c text;
  emitted boolean;
BEGIN
  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    emitted := false;

    FOREACH c IN ARRAY COALESCE(p_concerns, ARRAY[]::text[]) LOOP
      IF c = 'feuchtigkeit' THEN
        thickness := t;
        protein_moisture_balance := 'snaps';
        RETURN NEXT;
        emitted := true;
      ELSIF c = 'protein' THEN
        thickness := t;
        protein_moisture_balance := 'stretches_stays';
        RETURN NEXT;
        emitted := true;
      ELSIF c = 'performance' THEN
        thickness := t;
        protein_moisture_balance := 'stretches_bounces';
        RETURN NEXT;
        emitted := true;
      END IF;
    END LOOP;

    -- Fallback: if concerns are missing/unknown, keep product eligible
    -- for all balances at this thickness.
    IF NOT emitted THEN
      thickness := t;
      protein_moisture_balance := 'snaps';
      RETURN NEXT;

      thickness := t;
      protein_moisture_balance := 'stretches_bounces';
      RETURN NEXT;

      thickness := t;
      protein_moisture_balance := 'stretches_stays';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_product_conditioner_specs_from_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  DELETE FROM public.product_conditioner_specs
  WHERE product_id = NEW.id;

  IF NEW.category = ANY(ARRAY['Conditioner', 'Conditioner Profi']) THEN
    INSERT INTO public.product_conditioner_specs (product_id, thickness, protein_moisture_balance)
    SELECT NEW.id, e.thickness, e.protein_moisture_balance
    FROM public.expand_conditioner_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_product_conditioner_specs ON public.products;
CREATE TRIGGER trg_sync_product_conditioner_specs
AFTER INSERT OR UPDATE OF category, suitable_thicknesses, suitable_concerns
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_conditioner_specs_from_products();

-- Backfill existing conditioner products.
DELETE FROM public.product_conditioner_specs;

INSERT INTO public.product_conditioner_specs (product_id, thickness, protein_moisture_balance)
SELECT p.id, e.thickness, e.protein_moisture_balance
FROM public.products p
CROSS JOIN LATERAL public.expand_conditioner_eligibility(
  p.suitable_thicknesses,
  p.suitable_concerns
) AS e
WHERE p.category = ANY(ARRAY['Conditioner', 'Conditioner Profi'])
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.match_conditioner_products(vector, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.match_conditioner_products(
  query_embedding vector,
  user_thickness text,
  user_protein_moisture_balance text,
  match_count integer DEFAULT 5,
  category_filter text[] DEFAULT ARRAY['Conditioner', 'Conditioner Profi']
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
  IF user_thickness IS NULL OR user_protein_moisture_balance IS NULL THEN
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
  JOIN public.product_conditioner_specs c
    ON c.product_id = p.id
   AND c.thickness = user_thickness
   AND c.protein_moisture_balance = user_protein_moisture_balance
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.sort_order ASC
  LIMIT match_count;
END;
$function$;
