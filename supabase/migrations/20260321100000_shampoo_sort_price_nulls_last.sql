-- Sort shampoo product matches by price (cheapest first) instead of sort_order.
-- NULL prices sort last so priced products always appear before unpriced ones.

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
  ORDER BY combined_score DESC, p.price_eur ASC NULLS LAST
  LIMIT match_count;
END;
$function$;
