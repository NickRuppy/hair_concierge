DROP FUNCTION IF EXISTS public.match_products(vector, text, text[], integer, text[], text);

CREATE OR REPLACE FUNCTION public.match_products(
    query_embedding vector,
    user_hair_texture text DEFAULT NULL,
    user_concerns text[] DEFAULT '{}',
    match_count integer DEFAULT 5,
    category_filter text[] DEFAULT NULL,
    user_thickness text DEFAULT NULL
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
    currency text,
    tags text[],
    suitable_thicknesses text[],
    suitable_concerns text[],
    is_active boolean,
    lifecycle_status text,
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
    effective_thickness text := COALESCE(user_thickness, user_hair_texture);
BEGIN
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
        p.currency,
        p.tags,
        p.suitable_thicknesses,
        p.suitable_concerns,
        p.is_active,
        p.lifecycle_status,
        p.sort_order,
        (1 - (p.embedding <=> query_embedding))::float AS similarity,
        (
            COALESCE(
                CASE
                    WHEN effective_thickness IS NOT NULL
                         AND array_length(p.suitable_thicknesses, 1) > 0
                         AND effective_thickness = ANY(p.suitable_thicknesses)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS profile_score,
        (
            0.6 * (1 - (p.embedding <=> query_embedding))::float
            +
            0.4 * COALESCE(
                CASE
                    WHEN effective_thickness IS NOT NULL
                         AND array_length(p.suitable_thicknesses, 1) > 0
                         AND effective_thickness = ANY(p.suitable_thicknesses)
                    THEN 0.5
                    ELSE 0.0
                END
                +
                CASE
                    WHEN array_length(user_concerns, 1) > 0
                         AND array_length(p.suitable_concerns, 1) > 0
                    THEN 0.5 * (
                        (SELECT count(*)::float
                         FROM unnest(user_concerns) uc
                         WHERE uc = ANY(p.suitable_concerns)
                        ) / greatest(array_length(user_concerns, 1)::float, 1.0)
                    )
                    ELSE 0.0
                END,
                0.0
            )
        )::float AS combined_score
    FROM products p
    WHERE
        p.is_active = true
        AND p.lifecycle_status = 'active'
        AND p.embedding IS NOT NULL
        AND (category_filter IS NULL OR p.category = ANY(category_filter))
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$function$;
