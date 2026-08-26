-- Make the existing product-intake/catalog writers canonical-GTIN aware before
-- the global ownership invariant is enforced.

CREATE OR REPLACE FUNCTION public.product_identifier_assert_canonical_owner_available(
  p_type text,
  p_value text,
  p_allowed_product_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_type text := lower(btrim(coalesce(p_type, '')));
  v_canonical_gtin14 text;
  v_existing public.product_identifiers%ROWTYPE;
BEGIN
  IF v_type NOT IN ('ean', 'gtin', 'barcode') THEN
    RETURN NULL;
  END IF;

  v_canonical_gtin14 := public.product_identifier_canonical_gtin14(p_type, p_value);
  IF v_canonical_gtin14 IS NULL THEN
    RAISE EXCEPTION 'invalid GTIN identifier: % %', p_type, p_value;
  END IF;

  SELECT existing.*
  INTO v_existing
  FROM public.product_identifiers AS existing
  WHERE existing.canonical_gtin14 = v_canonical_gtin14
    AND (p_allowed_product_id IS NULL OR existing.product_id <> p_allowed_product_id)
  ORDER BY existing.created_at, existing.id
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'canonical GTIN % already belongs to product %; use link-existing or resolve ownership',
      v_canonical_gtin14, v_existing.product_id;
  END IF;

  RETURN v_canonical_gtin14;
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_identifier_prepare_final_payload_identifiers(
  p_final_payload jsonb,
  p_allowed_product_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_identifier jsonb;
  v_identifiers jsonb := '[]'::jsonb;
  v_seen_canonical_gtins text[] := ARRAY[]::text[];
  v_canonical_gtin14 text;
BEGIN
  FOR v_identifier IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb))
  LOOP
    IF v_identifier ->> 'type' IN ('ean', 'gtin', 'barcode') THEN
      v_canonical_gtin14 := public.product_identifier_assert_canonical_owner_available(
        v_identifier ->> 'type',
        v_identifier ->> 'value',
        p_allowed_product_id
      );

      IF v_canonical_gtin14 = ANY(v_seen_canonical_gtins) THEN
        CONTINUE;
      END IF;
      v_seen_canonical_gtins := array_append(v_seen_canonical_gtins, v_canonical_gtin14);
    END IF;

    v_identifiers := v_identifiers || jsonb_build_array(v_identifier);
  END LOOP;

  RETURN jsonb_set(p_final_payload, '{identifiers}', v_identifiers, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.product_identifier_assert_canonical_owner_available(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_identifier_assert_canonical_owner_available(text, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.product_identifier_prepare_final_payload_identifiers(jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_identifier_prepare_final_payload_identifiers(jsonb, uuid)
  TO service_role;

ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  RENAME TO product_intake_approve_reviewed_product_before_canonical_gtin;

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
  v_scanned_type text;
  v_scanned_value text;
  v_normalized_value text;
  v_final_payload jsonb := p_final_payload;
BEGIN
  SELECT submission.scanned_identifier_type, submission.scanned_identifier_value
  INTO v_scanned_type, v_scanned_value
  FROM public.product_submissions AS submission
  WHERE submission.id = p_submission_id;

  IF v_scanned_type IS NOT NULL AND v_scanned_value IS NOT NULL THEN
    v_normalized_value := public.product_intake_review_normalize_identifier_value(
      v_scanned_type,
      v_scanned_value
    );

    IF v_normalized_value <> '' AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb)
      ) AS incoming(identifier)
      WHERE incoming.identifier ->> 'type' IN ('ean', 'gtin', 'barcode')
        AND public.product_intake_review_normalize_identifier_value(
              incoming.identifier ->> 'type',
              incoming.identifier ->> 'value'
            ) = v_normalized_value
    ) THEN
      v_final_payload := jsonb_set(
        v_final_payload,
        '{identifiers}',
        COALESCE(v_final_payload -> 'identifiers', '[]'::jsonb)
          || jsonb_build_array(
               jsonb_build_object(
                 'type', v_scanned_type,
                 'value', v_scanned_value,
                 'source', 'scan'
               )
             ),
        true
      );
    END IF;
  END IF;

  v_final_payload := public.product_identifier_prepare_final_payload_identifiers(
    v_final_payload,
    NULL
  );

  RETURN public.product_intake_approve_reviewed_product_before_scanned_identifier(
    p_submission_id,
    v_final_payload,
    p_spec_operations,
    p_reviewed_by,
    p_reviewed_at,
    p_review_notes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_before_canonical_gtin(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;

ALTER FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  RENAME TO product_intake_link_existing_product_before_canonical_gtin;

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
SET search_path = ''
AS $function$
DECLARE
  link_result jsonb;
  v_scanned_type text;
  v_scanned_value text;
  v_canonical_gtin14 text;
BEGIN
  SELECT submission.scanned_identifier_type, submission.scanned_identifier_value
  INTO v_scanned_type, v_scanned_value
  FROM public.product_submissions AS submission
  WHERE submission.id = p_submission_id;

  IF v_scanned_type IS NOT NULL AND v_scanned_value IS NOT NULL THEN
    v_canonical_gtin14 := public.product_identifier_assert_canonical_owner_available(
      v_scanned_type,
      v_scanned_value,
      p_product_id
    );
  END IF;

  link_result := public.product_intake_link_existing_product_before_scanned_identifier(
    p_submission_id,
    p_product_id,
    p_reviewed_by,
    p_reviewed_at,
    p_review_notes
  );

  IF v_canonical_gtin14 IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.product_identifiers AS existing
       WHERE existing.product_id = p_product_id
         AND existing.canonical_gtin14 = v_canonical_gtin14
     ) THEN
    INSERT INTO public.product_identifiers (
      product_id,
      identifier_type,
      identifier_value,
      source
    )
    VALUES (
      p_product_id,
      v_scanned_type,
      v_scanned_value,
      'scan'
    );
  END IF;

  RETURN link_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_link_existing_product_before_canonical_gtin(uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  TO service_role;

-- These launch-cohort executors were built before canonical GTIN ownership and
-- compare identifier rows by raw type/value. Retire replay instead of letting an
-- old batch path write around the new global invariant.
REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_personal_plan_heat_v1(text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_personal_plan_scalp_v1(text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
