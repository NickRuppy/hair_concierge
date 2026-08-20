-- Persist the scanned barcode when a scan submission is resolved.
--
-- Produkt-Scan stores the barcode the user scanned on the submission row
-- (product_submissions.scanned_identifier_type/value, migration 20260820100100),
-- but neither review resolution path wrote it back to product_identifiers:
--
--   * approve  -- only inserts what the reviewer put in p_final_payload -> 'identifiers'
--   * link-existing -- never touches product_identifiers at all
--
-- So a reviewer could catalog the exact product the user scanned and the very
-- same barcode would still resolve to "unknown_product" on the next scan --
-- forever, for every user. These two wrappers close that loop by carrying the
-- submission's own scanned identifier into the catalog, following the repo's
-- rename-and-wrap pattern (see 20260815074148_product_image_thumbnails.sql):
-- the existing function is renamed and kept verbatim, and the new function of
-- the same name adds one concern and delegates.

-- ---------------------------------------------------------------- approve ---
-- Appends the scanned identifier to the reviewer's payload when it is missing,
-- then delegates. Deliberately does NOT bypass the base function's collision
-- guard ("identifier already exists; use link-existing"): if the scanned EAN is
-- already attached to another active product, approving a NEW product for it is
-- exactly the mistake that guard exists to stop.

ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  RENAME TO product_intake_approve_reviewed_product_before_scanned_identifier;

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

    -- Skip when the reviewer already listed this barcode (under any of the
    -- interchangeable barcode types -- they all share one normalization).
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
        COALESCE(p_final_payload -> 'identifiers', '[]'::jsonb)
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

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_before_scanned_identifier(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;

-- ---------------------------------------------------------- link-existing ---
-- Runs the base transition FIRST so every authorization/status/category check
-- still decides whether anything happens at all, then attaches the scanned
-- barcode to the linked product. Unlike approve, a collision here is not an
-- error: the reviewer's link decision stands either way. The identifier is
-- simply skipped (with a NOTICE for operator follow-up) when it already belongs
-- to a different active product -- attaching the same barcode to two products
-- would make lookupCatalogProductByIdentifier ambiguous.

ALTER FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  RENAME TO product_intake_link_existing_product_before_scanned_identifier;

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
  v_normalized_value text;
  v_owner_product_id uuid;
BEGIN
  SELECT submission.scanned_identifier_type, submission.scanned_identifier_value
  INTO v_scanned_type, v_scanned_value
  FROM public.product_submissions AS submission
  WHERE submission.id = p_submission_id;

  link_result := public.product_intake_link_existing_product_before_scanned_identifier(
    p_submission_id,
    p_product_id,
    p_reviewed_by,
    p_reviewed_at,
    p_review_notes
  );

  IF v_scanned_type IS NOT NULL AND v_scanned_value IS NOT NULL THEN
    v_normalized_value := public.product_intake_review_normalize_identifier_value(
      v_scanned_type,
      v_scanned_value
    );

    IF v_normalized_value <> '' THEN
      SELECT existing.product_id
      INTO v_owner_product_id
      FROM public.product_identifiers AS existing
      JOIN public.products AS product ON product.id = existing.product_id
      WHERE existing.identifier_type IN ('ean', 'gtin', 'barcode')
        AND existing.normalized_identifier_value = v_normalized_value
        AND product.is_active = true
      LIMIT 1;

      IF v_owner_product_id IS NULL THEN
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
        )
        ON CONFLICT (product_id, identifier_type, normalized_identifier_value) DO NOTHING;
      ELSIF v_owner_product_id <> p_product_id THEN
        RAISE NOTICE 'scanned identifier % already belongs to product %; not attached to linked product %',
          v_normalized_value, v_owner_product_id, p_product_id;
      END IF;
    END IF;
  END IF;

  RETURN link_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_link_existing_product_before_scanned_identifier(uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_link_existing_product(uuid, uuid, text, timestamptz, text)
  TO service_role;
