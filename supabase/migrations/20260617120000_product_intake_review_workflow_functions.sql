-- Product intake review workflow helpers.
-- These functions keep approval/link/reject/request-info state transitions
-- trigger-safe while the script layer handles review UX and audit files.

CREATE OR REPLACE FUNCTION public.product_intake_review_normalize_identity_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_review_normalize_identifier_value(
  p_type text,
  p_value text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN lower(btrim(coalesce(p_type, ''))) IN ('ean', 'gtin', 'barcode')
      THEN lower(regexp_replace(btrim(coalesce(p_value, '')), '[^[:alnum:]]+', '', 'g'))
    ELSE lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', '', 'g'))
  END;
$function$;

DROP INDEX IF EXISTS public.idx_product_identifiers_product_type_value;
DROP INDEX IF EXISTS public.idx_product_identifiers_lookup;

ALTER TABLE public.product_identifiers
  DROP COLUMN IF EXISTS normalized_identifier_value;

ALTER TABLE public.product_identifiers
  ADD COLUMN normalized_identifier_value text GENERATED ALWAYS AS (
    public.product_intake_review_normalize_identifier_value(identifier_type, identifier_value)
  ) STORED;

WITH ranked_identifiers AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY product_id, identifier_type, normalized_identifier_value
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.product_identifiers
)
DELETE FROM public.product_identifiers identifier
USING ranked_identifiers ranked
WHERE identifier.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_identifiers_product_type_value
  ON public.product_identifiers (product_id, identifier_type, normalized_identifier_value);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_lookup
  ON public.product_identifiers (identifier_type, normalized_identifier_value);

CREATE OR REPLACE FUNCTION public.product_intake_get_or_create_brand(p_canonical_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized text := public.product_intake_review_normalize_identity_text(p_canonical_name);
  brand_id uuid;
BEGIN
  IF normalized = '' THEN
    RAISE EXCEPTION 'canonical brand is required';
  END IF;

  INSERT INTO public.brands (canonical_name, normalized_name)
  VALUES (btrim(p_canonical_name), normalized)
  ON CONFLICT (normalized_name) DO UPDATE
    SET canonical_name = EXCLUDED.canonical_name,
        updated_at = now()
  RETURNING id INTO brand_id;

  RETURN brand_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_get_or_create_product_line(
  p_brand_id uuid,
  p_canonical_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized text := public.product_intake_review_normalize_identity_text(p_canonical_name);
  line_id uuid;
BEGIN
  IF p_canonical_name IS NULL OR normalized = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.product_lines (brand_id, canonical_name, normalized_name)
  VALUES (p_brand_id, btrim(p_canonical_name), normalized)
  ON CONFLICT (brand_id, normalized_name) DO UPDATE
    SET canonical_name = EXCLUDED.canonical_name,
        updated_at = now()
  RETURNING id INTO line_id;

  RETURN line_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_link_existing_product(
  p_submission_id uuid,
  p_product_id uuid,
  p_reviewed_by text,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for link-existing action';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products product
    WHERE product.id = p_product_id
      AND product.category_key = submission_row.category
      AND product.is_active = true
      AND product.lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'existing product must be active and match submission category';
  END IF;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    FOR UPDATE;
  END IF;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = NULL,
        product_submission_id = NULL,
        match_status = 'text_only',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id;
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'matched_existing',
	      approved_product_id = p_product_id,
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      notification_sent_at = NULL,
	      updated_at = p_reviewed_at
	  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = p_product_id,
        product_submission_id = submission_row.id,
        match_status = 'matched',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id
    RETURNING * INTO usage_row;
  END IF;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'usage', CASE WHEN usage_row.id IS NULL THEN NULL ELSE to_jsonb(usage_row) END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_request_more_info(
  p_submission_id uuid,
  p_reviewed_by text,
  p_reason text,
  p_next_step text,
  p_missing_fields jsonb DEFAULT '[]'::jsonb,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for request-info action';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'user-facing reason is required';
  END IF;

  IF p_next_step IS NULL OR btrim(p_next_step) = '' THEN
    RAISE EXCEPTION 'user-facing next step is required';
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'needs_more_info',
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      user_facing_resolution_reason = p_reason,
	      user_facing_next_step = p_next_step,
	      user_facing_missing_fields = COALESCE(p_missing_fields, '[]'::jsonb),
	      notification_sent_at = NULL,
	      updated_at = p_reviewed_at
	  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET match_status = 'needs_more_info',
        product_id = NULL,
        product_submission_id = submission_row.id,
        updated_at = p_reviewed_at
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    RETURNING * INTO usage_row;
  END IF;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'usage', CASE WHEN usage_row.id IS NULL THEN NULL ELSE to_jsonb(usage_row) END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_intake_reject_submission(
  p_submission_id uuid,
  p_reviewed_by text,
  p_reason text,
  p_next_step text DEFAULT NULL,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
  deleted_usage_id uuid;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status NOT IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info') THEN
    RAISE EXCEPTION 'product submission is not open for rejection';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'user-facing rejection reason is required';
  END IF;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    FOR UPDATE;
  END IF;

  IF usage_row.id IS NOT NULL AND usage_row.product_id IS NULL THEN
    deleted_usage_id := usage_row.id;
    DELETE FROM public.user_product_usage
    WHERE id = usage_row.id;
  ELSIF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_submission_id = NULL,
        match_status = CASE WHEN product_id IS NULL THEN 'text_only' ELSE 'matched' END,
        updated_at = p_reviewed_at
    WHERE id = usage_row.id;
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'rejected',
	      user_product_usage_id = NULL,
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      user_facing_resolution_reason = p_reason,
	      user_facing_next_step = p_next_step,
	      notification_sent_at = NULL,
	      cleanup_after = COALESCE(cleanup_after, p_reviewed_at + interval '30 days'),
	      updated_at = p_reviewed_at
  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'deleted_usage_id', deleted_usage_id
  );
END;
$function$;

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
SET search_path TO 'public'
AS $function$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  usage_row public.user_product_usage%ROWTYPE;
  product_payload jsonb := p_final_payload -> 'product';
  brand_id uuid;
  line_id uuid;
  category_label text;
  new_product_id uuid;
  operation jsonb;
  operation_table text;
  identifier_row jsonb;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  IF submission_row.status <> 'ready_for_review' THEN
    RAISE EXCEPTION 'approval requires ready_for_review submission';
  END IF;

  IF product_payload ->> 'category_key' IS DISTINCT FROM submission_row.category THEN
    RAISE EXCEPTION 'approved product category must match submission category';
  END IF;

  brand_id := public.product_intake_get_or_create_brand(product_payload ->> 'canonical_brand');
  line_id := public.product_intake_get_or_create_product_line(brand_id, product_payload ->> 'product_line');

  SELECT display_name_de
  INTO category_label
  FROM public.product_categories
  WHERE key = submission_row.category
    AND is_intake_supported = true;

  IF category_label IS NULL THEN
    RAISE EXCEPTION 'unsupported product intake category';
  END IF;

	  IF EXISTS (
	    SELECT 1
	    FROM public.products product
	    WHERE product.is_active = true
	      AND product.category_key = submission_row.category
	      AND product.brand_id = brand_id
	      AND product.product_line_id IS NOT DISTINCT FROM line_id
	      AND public.product_intake_review_normalize_identity_text(product.name)
	        IN (
	          public.product_intake_review_normalize_identity_text(product_payload ->> 'clean_name'),
	          public.product_intake_review_normalize_identity_text(
	            concat_ws(' ', product_payload ->> 'canonical_brand', product_payload ->> 'clean_name')
	          ),
	          public.product_intake_review_normalize_identity_text(
	            concat_ws(
	              ' ',
	              product_payload ->> 'canonical_brand',
	              product_payload ->> 'product_line',
	              product_payload ->> 'clean_name'
	            )
	          ),
	          public.product_intake_review_normalize_identity_text(
	            concat_ws(' ', product_payload ->> 'product_line', product_payload ->> 'clean_name')
	          )
	        )
	  ) THEN
	    RAISE EXCEPTION 'exact product already exists; use link-existing';
	  END IF;

  IF EXISTS (
    SELECT 1
	    FROM jsonb_array_elements(COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb)) AS incoming(identifier)
	    JOIN public.product_identifiers existing
	      ON (
	        existing.identifier_type = incoming.identifier ->> 'type'
	        OR (
	          existing.identifier_type IN ('ean', 'gtin', 'barcode')
	          AND incoming.identifier ->> 'type' IN ('ean', 'gtin', 'barcode')
	        )
	      )
	     AND existing.normalized_identifier_value =
	       public.product_intake_review_normalize_identifier_value(
	         incoming.identifier ->> 'type',
	         incoming.identifier ->> 'value'
	       )
    JOIN public.products product
      ON product.id = existing.product_id
    WHERE product.is_active = true
  ) THEN
    RAISE EXCEPTION 'identifier already exists; use link-existing';
  END IF;

  INSERT INTO public.products (
    name,
    brand,
    category,
    affiliate_link,
    image_url,
    price_eur,
    currency,
    tags,
    suitable_thicknesses,
    suitable_concerns,
    is_active,
    lifecycle_status,
    category_key,
    brand_id,
    product_line_id,
    origin,
    is_chaarlie_recommended,
    purchase_link_status,
    purchase_link_checked_at,
    price_checked_at
	  )
	  VALUES (
	    concat_ws(' ', product_payload ->> 'canonical_brand', product_payload ->> 'clean_name'),
	    product_payload ->> 'canonical_brand',
    category_label,
    product_payload ->> 'affiliate_link',
    product_payload ->> 'image_url',
    (product_payload ->> 'price_eur')::numeric,
    COALESCE(product_payload ->> 'currency', 'EUR'),
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    true,
    'active',
    submission_row.category,
    brand_id,
    line_id,
    'user_submitted',
    false,
    product_payload ->> 'purchase_link_status',
    (product_payload ->> 'purchase_link_checked_at')::timestamptz,
    (product_payload ->> 'price_checked_at')::timestamptz
  )
  RETURNING id INTO new_product_id;

  FOR operation IN SELECT * FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb)) LOOP
    operation_table := operation ->> 'table';

    IF operation_table = 'product_shampoo_specs' THEN
      INSERT INTO public.product_shampoo_specs (
        product_id,
        thickness,
        shampoo_bucket,
        scalp_route,
        cleansing_intensity
      )
      SELECT
        new_product_id,
        row_data.thickness,
        row_data.shampoo_bucket,
        row_data.scalp_route,
        row_data.cleansing_intensity
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        shampoo_bucket text,
        scalp_route text,
        cleansing_intensity text
      )
      ON CONFLICT (product_id, thickness, shampoo_bucket) DO UPDATE
        SET scalp_route = EXCLUDED.scalp_route,
            cleansing_intensity = EXCLUDED.cleansing_intensity,
            updated_at = now();
    ELSIF operation_table = 'product_conditioner_specs' THEN
      INSERT INTO public.product_conditioner_specs (
        product_id,
        thickness,
        protein_moisture_balance
      )
      SELECT new_product_id, row_data.thickness, row_data.protein_moisture_balance
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        protein_moisture_balance text
      )
      ON CONFLICT (product_id, thickness, protein_moisture_balance) DO NOTHING;
    ELSIF operation_table = 'product_conditioner_rerank_specs' THEN
      INSERT INTO public.product_conditioner_rerank_specs (
        product_id,
        weight,
        repair_level,
        balance_direction,
        ingredient_flags
      )
      SELECT
        new_product_id,
        row_data.weight,
        row_data.repair_level,
        row_data.balance_direction,
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        weight text,
        repair_level text,
        balance_direction text,
        ingredient_flags text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET weight = EXCLUDED.weight,
            repair_level = EXCLUDED.repair_level,
            balance_direction = EXCLUDED.balance_direction,
            ingredient_flags = EXCLUDED.ingredient_flags,
            updated_at = now();
    ELSIF operation_table = 'product_mask_specs' THEN
      INSERT INTO public.product_mask_specs (
        product_id,
        weight,
        concentration,
        balance_direction,
        ingredient_flags
      )
      SELECT
        new_product_id,
        row_data.weight,
        row_data.concentration,
        row_data.balance_direction,
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        weight text,
        concentration text,
        balance_direction text,
        ingredient_flags text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET weight = EXCLUDED.weight,
            concentration = EXCLUDED.concentration,
            balance_direction = EXCLUDED.balance_direction,
            ingredient_flags = EXCLUDED.ingredient_flags,
            updated_at = now();
    ELSIF operation_table = 'product_leave_in_specs' THEN
      INSERT INTO public.product_leave_in_specs (
        product_id,
        format,
        weight,
        roles,
        provides_heat_protection,
        heat_protection_max_c,
        heat_activation_required,
        care_benefits,
        ingredient_flags,
        application_stage
      )
      SELECT
        new_product_id,
        row_data.format,
        row_data.weight,
        COALESCE(row_data.roles, ARRAY[]::text[]),
        row_data.provides_heat_protection,
        row_data.heat_protection_max_c,
        row_data.heat_activation_required,
        COALESCE(row_data.care_benefits, ARRAY[]::text[]),
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[]),
        COALESCE(row_data.application_stage, ARRAY['towel_dry']::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        format text,
        weight text,
        roles text[],
        provides_heat_protection boolean,
        heat_protection_max_c integer,
        heat_activation_required boolean,
        care_benefits text[],
        ingredient_flags text[],
        application_stage text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET format = EXCLUDED.format,
            weight = EXCLUDED.weight,
            roles = EXCLUDED.roles,
            provides_heat_protection = EXCLUDED.provides_heat_protection,
            heat_protection_max_c = EXCLUDED.heat_protection_max_c,
            heat_activation_required = EXCLUDED.heat_activation_required,
            care_benefits = EXCLUDED.care_benefits,
            ingredient_flags = EXCLUDED.ingredient_flags,
            application_stage = EXCLUDED.application_stage,
            updated_at = now();
    ELSIF operation_table = 'product_leave_in_fit_specs' THEN
      INSERT INTO public.product_leave_in_fit_specs (
        product_id,
        weight,
        conditioner_relationship,
        care_benefits
      )
      SELECT
        new_product_id,
        row_data.weight,
        row_data.conditioner_relationship,
        COALESCE(row_data.care_benefits, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        weight text,
        conditioner_relationship text,
        care_benefits text[]
      )
      ON CONFLICT (product_id) DO UPDATE
        SET weight = EXCLUDED.weight,
            conditioner_relationship = EXCLUDED.conditioner_relationship,
            care_benefits = EXCLUDED.care_benefits,
            updated_at = now();
    ELSIF operation_table = 'product_leave_in_eligibility' THEN
      INSERT INTO public.product_leave_in_eligibility (
        product_id,
        thickness,
        need_bucket,
        styling_context
      )
      SELECT new_product_id, row_data.thickness, row_data.need_bucket, row_data.styling_context
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        need_bucket text,
        styling_context text
      )
      ON CONFLICT (product_id, thickness, need_bucket, styling_context) DO NOTHING;
    ELSIF operation_table = 'product_oil_eligibility' THEN
      INSERT INTO public.product_oil_eligibility (
        product_id,
        thickness,
        oil_subtype,
        oil_purpose,
        ingredient_flags
      )
      SELECT
        new_product_id,
        row_data.thickness,
        row_data.oil_subtype,
        row_data.oil_purpose,
        COALESCE(row_data.ingredient_flags, ARRAY[]::text[])
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        thickness text,
        oil_subtype text,
        oil_purpose text,
        ingredient_flags text[]
      )
      ON CONFLICT (product_id, thickness, oil_subtype) DO UPDATE
        SET oil_purpose = EXCLUDED.oil_purpose,
            ingredient_flags = EXCLUDED.ingredient_flags,
            updated_at = now();
    ELSIF operation_table = 'product_dry_shampoo_specs' THEN
      INSERT INTO public.product_dry_shampoo_specs (
        product_id,
        primary_effect,
        hair_color_fit,
        scalp_sensitivity_fit,
        format
      )
      SELECT
        new_product_id,
        row_data.primary_effect,
        row_data.hair_color_fit,
        row_data.scalp_sensitivity_fit,
        row_data.format
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        primary_effect text,
        hair_color_fit text,
        scalp_sensitivity_fit text,
        format text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET primary_effect = EXCLUDED.primary_effect,
            hair_color_fit = EXCLUDED.hair_color_fit,
            scalp_sensitivity_fit = EXCLUDED.scalp_sensitivity_fit,
            format = EXCLUDED.format,
            updated_at = now();
    ELSIF operation_table = 'product_deep_cleansing_shampoo_specs' THEN
      INSERT INTO public.product_deep_cleansing_shampoo_specs (
        product_id,
        scalp_type_focus,
        reset_intensity,
        reset_focus,
        color_treated_suitability
      )
      SELECT
        new_product_id,
        row_data.scalp_type_focus,
        row_data.reset_intensity,
        row_data.reset_focus,
        row_data.color_treated_suitability
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        scalp_type_focus text,
        reset_intensity text,
        reset_focus text,
        color_treated_suitability text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET scalp_type_focus = EXCLUDED.scalp_type_focus,
            reset_intensity = EXCLUDED.reset_intensity,
            reset_focus = EXCLUDED.reset_focus,
            color_treated_suitability = EXCLUDED.color_treated_suitability,
            updated_at = now();
    ELSIF operation_table = 'product_bondbuilder_specs' THEN
      INSERT INTO public.product_bondbuilder_specs (
        product_id,
        bond_repair_intensity,
        application_mode,
        bond_repair_axis,
        treatment_mode,
        product_format,
        usage_protocol
      )
      SELECT
        new_product_id,
        row_data.bond_repair_intensity,
        row_data.application_mode,
        row_data.bond_repair_axis,
        row_data.treatment_mode,
        row_data.product_format,
        row_data.usage_protocol
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        bond_repair_intensity text,
        application_mode text,
        bond_repair_axis text,
        treatment_mode text,
        product_format text,
        usage_protocol text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET bond_repair_intensity = EXCLUDED.bond_repair_intensity,
            application_mode = EXCLUDED.application_mode,
            bond_repair_axis = EXCLUDED.bond_repair_axis,
            treatment_mode = EXCLUDED.treatment_mode,
            product_format = EXCLUDED.product_format,
            usage_protocol = EXCLUDED.usage_protocol,
            updated_at = now();
    ELSE
      RAISE EXCEPTION 'unsupported product intake spec operation table: %', operation_table;
    END IF;
  END LOOP;

  FOR identifier_row IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb))
  LOOP
    INSERT INTO public.product_identifiers (
      product_id,
      identifier_type,
      identifier_value,
      source
    )
    VALUES (
      new_product_id,
      identifier_row ->> 'type',
      identifier_row ->> 'value',
      COALESCE(identifier_row ->> 'source', 'user_submitted')
    )
    ON CONFLICT (product_id, identifier_type, normalized_identifier_value) DO NOTHING;
  END LOOP;

  IF submission_row.user_product_usage_id IS NOT NULL THEN
    SELECT *
    INTO usage_row
    FROM public.user_product_usage
    WHERE id = submission_row.user_product_usage_id
      AND user_id = submission_row.user_id
      AND category = submission_row.category
    FOR UPDATE;
  END IF;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = NULL,
        product_submission_id = NULL,
        match_status = 'text_only',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id;
  END IF;

	  UPDATE public.product_submissions
	  SET status = 'approved',
	      approved_product_id = new_product_id,
	      researched_payload = jsonb_set(researched_payload, '{final}', p_final_payload, true),
	      reviewed_at = p_reviewed_at,
	      reviewed_by = p_reviewed_by,
	      review_notes = p_review_notes,
	      notification_sent_at = NULL,
	      updated_at = p_reviewed_at
  WHERE id = submission_row.id
  RETURNING * INTO submission_row;

  IF usage_row.id IS NOT NULL THEN
    UPDATE public.user_product_usage
    SET product_id = new_product_id,
        product_submission_id = submission_row.id,
        match_status = 'matched',
        updated_at = p_reviewed_at
    WHERE id = usage_row.id
    RETURNING * INTO usage_row;
  END IF;

  RETURN jsonb_build_object(
    'submission', to_jsonb(submission_row),
    'usage', CASE WHEN usage_row.id IS NULL THEN NULL ELSE to_jsonb(usage_row) END,
    'product_id', new_product_id,
    'brand_id', brand_id,
    'product_line_id', line_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_review_normalize_identity_text(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_get_or_create_brand(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_get_or_create_product_line(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_request_more_info(uuid, text, text, text, jsonb, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_reject_submission(uuid, text, text, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_request_more_info(uuid, text, text, text, jsonb, timestamptz, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_reject_submission(uuid, text, text, text, timestamptz, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;
