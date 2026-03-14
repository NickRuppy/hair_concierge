-- Align conditioner matching with the live catalog category naming.
-- The catalog currently stores conditioners as "Conditioner (Drogerie)",
-- so the helper table, trigger sync, and matcher RPC must include that bucket.

CREATE OR REPLACE FUNCTION public.sync_product_conditioner_specs_from_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  DELETE FROM public.product_conditioner_specs
  WHERE product_id = NEW.id;

  IF lower(coalesce(NEW.category, '')) LIKE 'conditioner%' THEN
    INSERT INTO public.product_conditioner_specs (product_id, thickness, protein_moisture_balance)
    SELECT NEW.id, e.thickness, e.protein_moisture_balance
    FROM public.expand_conditioner_eligibility(NEW.suitable_thicknesses, NEW.suitable_concerns) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DELETE FROM public.product_conditioner_specs;

INSERT INTO public.product_conditioner_specs (product_id, thickness, protein_moisture_balance)
SELECT p.id, e.thickness, e.protein_moisture_balance
FROM public.products p
CROSS JOIN LATERAL public.expand_conditioner_eligibility(
  p.suitable_thicknesses,
  p.suitable_concerns
) AS e
WHERE lower(coalesce(p.category, '')) LIKE 'conditioner%'
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.match_conditioner_products(vector, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.match_conditioner_products(
  query_embedding vector,
  user_thickness text,
  user_protein_moisture_balance text,
  match_count integer DEFAULT 5,
  category_filter text[] DEFAULT ARRAY['Conditioner', 'Conditioner Profi', 'Conditioner (Drogerie)']
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
