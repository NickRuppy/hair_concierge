-- Stored compact-card derivatives remain separate from canonical presentation
-- images. The URL is nullable during rollout and for products without images.
ALTER TABLE public.products
  ADD COLUMN thumbnail_image_url text;

ALTER TABLE public.products
  ADD CONSTRAINT products_thumbnail_image_url_check
  CHECK (
    thumbnail_image_url IS NULL
    OR thumbnail_image_url ~ '^https://pqdkhefxsxkyeqelqegq\.supabase\.co/storage/v1/object/public/product-images/thumbnails/search-v[0-9]+/[a-f0-9]{64}\.webp$'
  );

CREATE OR REPLACE FUNCTION public.clear_stale_product_thumbnail_image_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF OLD.image_url IS DISTINCT FROM NEW.image_url THEN
    NEW.thumbnail_image_url := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER clear_stale_product_thumbnail_image_url
BEFORE UPDATE OF image_url ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.clear_stale_product_thumbnail_image_url();

REVOKE ALL ON FUNCTION public.clear_stale_product_thumbnail_image_url() FROM PUBLIC;

-- Preserve the complete reviewed-intake transaction and add only the paired
-- image validation/pointer update around it.
ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  RENAME TO product_intake_approve_reviewed_product_before_thumbnail_image;

CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product(
  p_submission_id uuid,
  p_final_payload jsonb,
  p_spec_operations jsonb,
  p_reviewed_by text,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  approval_result jsonb;
  approved_product_id uuid;
  canonical_image_url text := NULLIF(p_final_payload#>>'{product,image_url}', '');
  canonical_image_sha256 text := NULLIF(p_final_payload#>>'{product,canonical_image_sha256}', '');
  v_thumbnail_image_url text := NULLIF(p_final_payload#>>'{product,thumbnail_image_url}', '');
  expected_thumbnail_image_url text;
BEGIN
  IF canonical_image_url IS NULL THEN
    IF canonical_image_sha256 IS NOT NULL OR v_thumbnail_image_url IS NOT NULL THEN
      RAISE EXCEPTION 'thumbnail metadata requires a canonical product image';
    END IF;
  ELSE
    IF canonical_image_url !~ '^https://pqdkhefxsxkyeqelqegq\.supabase\.co/storage/v1/object/public/product-images/.+' THEN
      RAISE EXCEPTION 'canonical product image must be stored in the Chaarlie product-images bucket';
    END IF;
    -- During the additive rollout, older approved clients may omit both new
    -- fields. Once either field is supplied, require the complete matching pair.
    IF canonical_image_sha256 IS NULL AND v_thumbnail_image_url IS NULL THEN
      expected_thumbnail_image_url := NULL;
    ELSIF canonical_image_sha256 IS NULL OR canonical_image_sha256 !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'canonical_image_sha256 must be a lowercase SHA-256 hex digest';
    ELSE
      expected_thumbnail_image_url :=
        'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/'
        || canonical_image_sha256 || '.webp';
      IF v_thumbnail_image_url IS DISTINCT FROM expected_thumbnail_image_url THEN
        RAISE EXCEPTION 'thumbnail_image_url must match the canonical source hash and search-v1 contract';
      END IF;
    END IF;
  END IF;

  approval_result := public.product_intake_approve_reviewed_product_before_thumbnail_image(
    p_submission_id,
    p_final_payload,
    p_spec_operations,
    p_reviewed_by,
    p_reviewed_at,
    p_review_notes
  );
  approved_product_id := (approval_result->>'product_id')::uuid;

  IF v_thumbnail_image_url IS NOT NULL THEN
    UPDATE public.products
    SET thumbnail_image_url = v_thumbnail_image_url
    WHERE id = approved_product_id;
  END IF;

  RETURN approval_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_before_thumbnail_image(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;

-- V3 delegates every authorization, visibility, readiness, cap, and ranking
-- decision to V2 and adds only the compact presentation URL.
CREATE OR REPLACE FUNCTION public.personal_plan_search_assessment_products_v3(
  p_user_id uuid,
  p_category text,
  p_query text,
  p_context jsonb,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(
  product_id uuid,
  category_key text,
  brand_name text,
  product_line_name text,
  product_name text,
  image_url text,
  thumbnail_image_url text,
  sort_order integer,
  assessment_status text,
  assessment_reason_codes text[],
  total_capped boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    result.product_id,
    result.category_key,
    result.brand_name,
    result.product_line_name,
    result.product_name,
    result.image_url,
    product.thumbnail_image_url,
    result.sort_order,
    result.assessment_status,
    result.assessment_reason_codes,
    result.total_capped
  FROM public.personal_plan_search_assessment_products_v2(
    p_user_id,
    p_category,
    p_query,
    p_context,
    p_limit
  ) AS result
  JOIN public.products AS product ON product.id = result.product_id
  ORDER BY result.sort_order NULLS LAST, result.product_name, result.product_id;
$function$;

REVOKE ALL ON FUNCTION public.personal_plan_search_assessment_products_v3(uuid,text,text,jsonb,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_search_assessment_products_v3(uuid,text,text,jsonb,integer)
  TO service_role;
