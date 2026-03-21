-- Temporary compatibility wrapper so older app code that still calls
-- match_shampoo_products(query_embedding, user_thickness, user_scalp_type,
-- user_scalp_condition, ...) continues to work until the new app code is deployed.

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
DECLARE
  derived_bucket text;
BEGIN
  IF user_scalp_condition IS NOT NULL AND user_scalp_condition <> 'none' THEN
    IF user_scalp_condition = 'dandruff' THEN
      derived_bucket := 'schuppen';
    ELSIF user_scalp_condition = 'irritated' THEN
      derived_bucket := 'irritationen';
    ELSIF user_scalp_condition = 'dry_flakes' THEN
      derived_bucket := 'trocken';
    END IF;
  END IF;

  IF derived_bucket IS NULL THEN
    IF user_scalp_type = 'balanced' THEN
      derived_bucket := 'normal';
    ELSIF user_scalp_type = 'oily' THEN
      derived_bucket := 'dehydriert-fettig';
    ELSIF user_scalp_type = 'dry' THEN
      derived_bucket := 'trocken';
    END IF;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.match_shampoo_products(
    query_embedding := query_embedding,
    user_thickness := user_thickness,
    user_shampoo_bucket := derived_bucket,
    match_count := match_count,
    category_filter := category_filter
  );
END;
$function$;
