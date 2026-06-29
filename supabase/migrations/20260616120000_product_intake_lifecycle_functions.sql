-- Product intake lifecycle helpers.
-- These keep user_product_usage/product_submissions cross-row state changes
-- trigger-safe and atomic while storage cleanup remains app-side.

CREATE OR REPLACE FUNCTION public.product_intake_cancel_usage_for_category(
  p_user_id uuid,
  p_category text,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS TABLE(category text, usage_id uuid, submission_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  usage_row public.user_product_usage%ROWTYPE;
BEGIN
  SELECT *
  INTO usage_row
  FROM public.user_product_usage AS usage
  WHERE usage.user_id = p_user_id
    AND usage.category = p_category
  FOR UPDATE;

  category := p_category;
  usage_id := usage_row.id;
  submission_id := usage_row.product_submission_id;

  IF usage_row.id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF submission_id IS NOT NULL THEN
    PERFORM 1
    FROM public.product_submissions AS submission
    WHERE submission.id = submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
    FOR UPDATE;
  END IF;

  DELETE FROM public.user_product_usage
  WHERE id = usage_row.id;

  IF submission_id IS NOT NULL THEN
    UPDATE public.product_submissions AS submission
    SET status = 'cancelled_by_user',
        user_product_usage_id = NULL,
        cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
        updated_at = p_updated_at
    WHERE submission.id = submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
      AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
  END IF;

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_replace_usage_with_matched_product(
  p_user_id uuid,
  p_category text,
  p_existing_usage_id uuid,
  p_product_id uuid,
  p_product_name text,
  p_frequency_range text,
  p_brand_text text,
  p_intake_method text,
  p_source text,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  usage_row public.user_product_usage%ROWTYPE;
  old_submission_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = p_product_id
      AND product.category_key = p_category
  ) THEN
    RAISE EXCEPTION 'matched product must belong to usage category';
  END IF;

  IF p_existing_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage AS usage
    WHERE usage.id = p_existing_usage_id
      AND usage.user_id = p_user_id
      AND usage.category = p_category
    FOR UPDATE;

    IF usage_row.id IS NULL THEN
      RAISE EXCEPTION 'existing product usage not found for matched replacement';
    END IF;

    old_submission_id := usage_row.product_submission_id;

    UPDATE public.user_product_usage AS usage
    SET product_name = p_product_name,
        frequency_range = p_frequency_range,
        brand_text = p_brand_text,
        product_id = p_product_id,
        product_submission_id = NULL,
        match_status = 'matched',
        intake_method = p_intake_method,
        source = p_source,
        front_image_path = NULL,
        updated_at = p_updated_at
    WHERE usage.id = usage_row.id
    RETURNING * INTO usage_row;
  ELSE
    INSERT INTO public.user_product_usage (
      user_id,
      category,
      product_name,
      frequency_range,
      brand_text,
      product_id,
      product_submission_id,
      match_status,
      intake_method,
      source,
      front_image_path,
      updated_at
    )
    VALUES (
      p_user_id,
      p_category,
      p_product_name,
      p_frequency_range,
      p_brand_text,
      p_product_id,
      NULL,
      'matched',
      p_intake_method,
      p_source,
      NULL,
      p_updated_at
    )
    RETURNING * INTO usage_row;
  END IF;

  IF old_submission_id IS NOT NULL THEN
    UPDATE public.product_submissions AS submission
    SET status = 'cancelled_by_user',
        user_product_usage_id = NULL,
        cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
        updated_at = p_updated_at
    WHERE submission.id = old_submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
      AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
  END IF;

  RETURN to_jsonb(usage_row);
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_replace_usage_with_pending_submission(
  p_user_id uuid,
  p_category text,
  p_existing_usage_id uuid,
  p_submission_id uuid,
  p_product_name text,
  p_frequency_range text,
  p_brand_text text,
  p_intake_method text,
  p_source text,
  p_front_image_path text,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  usage_row public.user_product_usage%ROWTYPE;
  submission_row public.product_submissions%ROWTYPE;
  old_submission_id uuid;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions AS submission
  WHERE submission.id = p_submission_id
    AND submission.user_id = p_user_id
    AND submission.category = p_category
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'pending product submission not found for usage replacement';
  END IF;

  IF submission_row.status <> 'pending_review' THEN
    RAISE EXCEPTION 'usage replacement requires a pending product submission';
  END IF;

  IF p_existing_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage AS usage
    WHERE usage.id = p_existing_usage_id
      AND usage.user_id = p_user_id
      AND usage.category = p_category
    FOR UPDATE;

    IF usage_row.id IS NULL THEN
      RAISE EXCEPTION 'existing product usage not found for pending replacement';
    END IF;

    old_submission_id := usage_row.product_submission_id;

    UPDATE public.user_product_usage AS usage
    SET product_name = p_product_name,
        frequency_range = p_frequency_range,
        brand_text = p_brand_text,
        product_id = NULL,
        product_submission_id = p_submission_id,
        match_status = 'pending_review',
        intake_method = p_intake_method,
        source = p_source,
        front_image_path = p_front_image_path,
        updated_at = p_updated_at
    WHERE usage.id = usage_row.id
    RETURNING * INTO usage_row;
  ELSE
    INSERT INTO public.user_product_usage (
      user_id,
      category,
      product_name,
      frequency_range,
      brand_text,
      product_id,
      product_submission_id,
      match_status,
      intake_method,
      source,
      front_image_path,
      updated_at
    )
    VALUES (
      p_user_id,
      p_category,
      p_product_name,
      p_frequency_range,
      p_brand_text,
      NULL,
      p_submission_id,
      'pending_review',
      p_intake_method,
      p_source,
      p_front_image_path,
      p_updated_at
    )
    RETURNING * INTO usage_row;
  END IF;

  IF old_submission_id IS NOT NULL
      AND old_submission_id IS DISTINCT FROM p_submission_id THEN
    UPDATE public.product_submissions AS submission
    SET status = 'cancelled_by_user',
        user_product_usage_id = NULL,
        cleanup_after = COALESCE(cleanup_after, p_updated_at + interval '30 days'),
        updated_at = p_updated_at
    WHERE submission.id = old_submission_id
      AND submission.user_id = p_user_id
      AND submission.category = p_category
      AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
  END IF;

  UPDATE public.product_submissions AS submission
  SET user_product_usage_id = usage_row.id,
      updated_at = p_updated_at
  WHERE submission.id = p_submission_id
    AND submission.user_id = p_user_id
    AND submission.category = p_category
  RETURNING * INTO submission_row;

  RETURN jsonb_build_object(
    'usage', to_jsonb(usage_row),
    'submission', to_jsonb(submission_row)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_cancel_usage_for_category(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_replace_usage_with_matched_product(uuid, text, uuid, uuid, text, text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_replace_usage_with_pending_submission(uuid, text, uuid, uuid, text, text, text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_intake_cancel_usage_for_category(uuid, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_replace_usage_with_matched_product(uuid, text, uuid, uuid, text, text, text, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_replace_usage_with_pending_submission(uuid, text, uuid, uuid, text, text, text, text, text, text, timestamptz)
  TO service_role;
