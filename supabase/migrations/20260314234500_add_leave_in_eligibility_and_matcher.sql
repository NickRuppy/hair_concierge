-- Add strict leave-in eligibility triples and exact-match leave-in RPC.
-- Requirement: leave-in recommendations are only valid when thickness +
-- leave_in_need_bucket + styling_context are all present and jointly matched.

CREATE TABLE IF NOT EXISTS public.product_leave_in_eligibility (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL CHECK (thickness IN ('fine', 'normal', 'coarse')),
  need_bucket text NOT NULL CHECK (
    need_bucket IN (
      'heat_protect',
      'curl_definition',
      'repair',
      'moisture_anti_frizz',
      'shine_protect'
    )
  ),
  styling_context text NOT NULL CHECK (
    styling_context IN ('air_dry', 'non_heat_style', 'heat_style')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, need_bucket, styling_context)
);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_eligibility_lookup
  ON public.product_leave_in_eligibility (thickness, need_bucket, styling_context);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_eligibility_product_id
  ON public.product_leave_in_eligibility (product_id);

CREATE OR REPLACE FUNCTION public.expand_leave_in_eligibility(
  p_thicknesses text[],
  p_roles text[],
  p_care_benefits text[],
  p_application_stage text[],
  p_provides_heat_protection boolean,
  p_heat_activation_required boolean
)
RETURNS TABLE(
  thickness text,
  need_bucket text,
  styling_context text
)
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  t text;
  bucket text;
  context text;
  buckets text[] := ARRAY[]::text[];
  contexts text[] := ARRAY[]::text[];
BEGIN
  IF p_heat_activation_required OR p_provides_heat_protection THEN
    buckets := array_append(buckets, 'heat_protect');
  END IF;

  IF 'curl_definition' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'curl_definition');
  END IF;

  IF
    'repair' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'protein' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'repair');
  END IF;

  IF
    'moisture' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'anti_frizz' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'detangling' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'moisture_anti_frizz');
  END IF;

  IF 'shine' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'shine_protect');
  END IF;

  IF p_heat_activation_required THEN
    contexts := ARRAY['heat_style'];
  ELSE
    IF
      p_provides_heat_protection
      OR 'pre_heat' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'heat_style');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'air_dry');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'post_style' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'styling_prep' = ANY(COALESCE(p_roles, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'non_heat_style');
    END IF;
  END IF;

  IF array_length(contexts, 1) IS NULL THEN
    contexts := ARRAY['air_dry', 'non_heat_style'];
  END IF;

  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    FOREACH bucket IN ARRAY buckets LOOP
      IF bucket = 'heat_protect' THEN
        thickness := t;
        need_bucket := bucket;
        styling_context := 'heat_style';
        RETURN NEXT;
        CONTINUE;
      END IF;

      FOREACH context IN ARRAY contexts LOOP
        IF context = 'heat_style' THEN
          CONTINUE;
        END IF;

        thickness := t;
        need_bucket := bucket;
        styling_context := context;
        RETURN NEXT;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rebuild_product_leave_in_eligibility(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  product_row public.products%ROWTYPE;
  spec_row public.product_leave_in_specs%ROWTYPE;
BEGIN
  DELETE FROM public.product_leave_in_eligibility
  WHERE product_id = p_product_id;

  SELECT *
  INTO product_row
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF lower(trim(COALESCE(product_row.category, ''))) NOT IN ('leave-in', 'leave in', 'leave_in') THEN
    RETURN;
  END IF;

  SELECT *
  INTO spec_row
  FROM public.product_leave_in_specs
  WHERE product_id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.product_leave_in_eligibility (
    product_id,
    thickness,
    need_bucket,
    styling_context
  )
  SELECT p_product_id, e.thickness, e.need_bucket, e.styling_context
  FROM public.expand_leave_in_eligibility(
    product_row.suitable_thicknesses,
    spec_row.roles,
    spec_row.care_benefits,
    spec_row.application_stage,
    spec_row.provides_heat_protection,
    spec_row.heat_activation_required
  ) AS e
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_product_leave_in_eligibility_from_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  PERFORM public.rebuild_product_leave_in_eligibility(NEW.id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_product_leave_in_eligibility_from_specs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  PERFORM public.rebuild_product_leave_in_eligibility(COALESCE(NEW.product_id, OLD.product_id));
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_product_leave_in_eligibility_from_products ON public.products;
CREATE TRIGGER trg_sync_product_leave_in_eligibility_from_products
AFTER INSERT OR UPDATE OF category, suitable_thicknesses
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_leave_in_eligibility_from_products();

DROP TRIGGER IF EXISTS trg_sync_product_leave_in_eligibility_from_specs ON public.product_leave_in_specs;
CREATE TRIGGER trg_sync_product_leave_in_eligibility_from_specs
AFTER INSERT OR UPDATE OR DELETE
ON public.product_leave_in_specs
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_leave_in_eligibility_from_specs();

DELETE FROM public.product_leave_in_eligibility;

INSERT INTO public.product_leave_in_eligibility (
  product_id,
  thickness,
  need_bucket,
  styling_context
)
SELECT p.id, e.thickness, e.need_bucket, e.styling_context
FROM public.products p
JOIN public.product_leave_in_specs s
  ON s.product_id = p.id
CROSS JOIN LATERAL public.expand_leave_in_eligibility(
  p.suitable_thicknesses,
  s.roles,
  s.care_benefits,
  s.application_stage,
  s.provides_heat_protection,
  s.heat_activation_required
) AS e
WHERE lower(trim(COALESCE(p.category, ''))) IN ('leave-in', 'leave in', 'leave_in')
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.match_leave_in_products(vector, text, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.match_leave_in_products(
  query_embedding vector,
  user_thickness text,
  user_need_bucket text,
  user_styling_context text,
  match_count integer DEFAULT 10,
  category_filter text[] DEFAULT ARRAY['Leave-in', 'Leave-In', 'Leave in', 'leave_in']
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
  IF user_thickness IS NULL OR user_need_bucket IS NULL OR user_styling_context IS NULL THEN
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
  JOIN public.product_leave_in_eligibility e
    ON e.product_id = p.id
   AND e.thickness = user_thickness
   AND e.need_bucket = user_need_bucket
   AND e.styling_context = user_styling_context
  WHERE
    p.is_active = true
    AND p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = ANY(category_filter))
  ORDER BY combined_score DESC, p.sort_order ASC
  LIMIT match_count;
END;
$function$;
