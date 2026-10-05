-- Reviewed Bondbuilder packages may be visible in catalogue search while fit and
-- executable application evidence remains unknown. This is deliberately not a
-- recommendation path: the existing inner publication assertion is unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.bondbuilder_catalogue_available_v1(p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_profile jsonb;
  v_request jsonb;
  v_admission_readback jsonb;
  v_current_readback jsonb;
  v_batch text;
  v_ledger public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF v_product.id IS NULL
    OR v_product.origin IS DISTINCT FROM 'curated'
    OR v_product.category_key IS DISTINCT FROM 'bondbuilder'
    OR v_product.lifecycle_status IS DISTINCT FROM 'active'
    OR v_product.is_chaarlie_recommended IS DISTINCT FROM false
  THEN
    RETURN false;
  END IF;

  SELECT research_profile INTO v_profile
  FROM public.product_bondbuilder_specs
  WHERE product_id = p_product_id;
  IF v_profile IS NULL
    OR NOT public.bondbuilder_profile_valid_v1(v_profile)
    OR NOT public.bondbuilder_profile_catalogue_identity_valid_v1(v_profile, p_product_id)
    OR v_profile #>> '{assessment,boundary_status}' IS DISTINCT FROM 'in_scope'
    OR v_profile #>> '{identity,status}' IS DISTINCT FROM 'resolved'
  THEN
    RETURN false;
  END IF;

  SELECT fact_value, batch_id INTO v_request, v_batch
  FROM public.personal_plan_catalog_fact_evidence
  WHERE product_id = p_product_id
    AND fact_key = 'bondbuilder_internal_admission_request';
  SELECT fact_value INTO v_admission_readback
  FROM public.personal_plan_catalog_fact_evidence
  WHERE product_id = p_product_id
    AND fact_key = 'bondbuilder_internal_admission_readback'
    AND batch_id = v_batch;
  SELECT * INTO v_ledger
  FROM public.catalog_enrichment_applied_items
  WHERE batch_id = v_batch AND product_key = replace(v_batch, 'bondbuilder-internal-admission-v1:', '');

  IF v_request IS NULL OR v_admission_readback IS NULL OR v_ledger.product_id IS DISTINCT FROM p_product_id
    OR v_ledger.reviewed_by IS DISTINCT FROM 'nick'
    -- Admission fingerprints bind the original unbound request. The spec writer
    -- subsequently binds the product UUID and recalculates the stored profile hash.
    OR v_ledger.batch_fingerprint IS DISTINCT FROM encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_request), 'UTF8')), 'hex')
    OR v_ledger.content_fingerprint IS DISTINCT FROM v_request #>> '{review,profile_sha256}'
    OR v_request #>> '{review,profile_sha256}' IS DISTINCT FROM v_request #>> '{category_specs,product_bondbuilder_specs,research_profile,review,profile_sha256}'
    OR (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence evidence
        WHERE evidence.product_id = p_product_id
          AND evidence.batch_id = v_batch
          AND evidence.fact_key IN ('bondbuilder_internal_admission_request', 'bondbuilder_internal_admission_readback')) <> 2
    OR NOT EXISTS (
      SELECT 1 FROM public.personal_plan_catalog_fact_evidence evidence
      WHERE evidence.product_id = p_product_id AND evidence.batch_id = v_batch
        AND evidence.fact_key = 'bondbuilder_internal_admission_request'
        AND evidence.fact_value = v_request
        AND evidence.source_label = 'Reviewed internal Bondbuilder admission'
        AND evidence.source_url = v_request #>> '{image,source_page_url}'
        AND evidence.source_text = 'Exact approved request.'
        AND evidence.source_type = 'internal_verified'
        AND evidence.checked_at = (v_profile #>> '{review,checked_date}')::date
        AND evidence.batch_fingerprint = v_ledger.batch_fingerprint
        AND evidence.content_fingerprint = v_ledger.content_fingerprint
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.personal_plan_catalog_fact_evidence evidence
      WHERE evidence.product_id = p_product_id AND evidence.batch_id = v_batch
        AND evidence.fact_key = 'bondbuilder_internal_admission_readback'
        AND evidence.fact_value = v_admission_readback
        AND evidence.source_label = 'Reviewed internal Bondbuilder readback'
        AND evidence.source_url = v_request #>> '{image,source_page_url}'
        AND evidence.source_text = 'Exact staged catalogue bundle.'
        AND evidence.source_type = 'internal_verified'
        AND evidence.checked_at = (v_profile #>> '{review,checked_date}')::date
        AND evidence.batch_fingerprint = v_ledger.batch_fingerprint
        AND evidence.content_fingerprint = v_ledger.content_fingerprint
    )
    OR v_product.image_url IS DISTINCT FROM v_request #>> '{product,image_url}'
    OR v_product.thumbnail_image_url IS DISTINCT FROM v_request #>> '{product,thumbnail_image_url}'
    OR NOT EXISTS (
      SELECT 1 FROM public.product_image_assets asset
      WHERE asset.product_id = p_product_id
        AND asset.public_url = v_product.image_url
        AND asset.asset_sha256 = v_request #>> '{product,canonical_image_sha256}'
        AND asset.user_approved = true
    )
  THEN
    RETURN false;
  END IF;

  SELECT public.bondbuilder_internal_admission_readback_v1(p_product_id) INTO v_current_readback;
  RETURN v_current_readback #- '{product,is_active}' #- '{product,updated_at}'
    = v_admission_readback #- '{product,is_active}' #- '{product,updated_at}';
END;
$function$;

DO $outer_publication$
DECLARE
  body text;
  needle text := E'BEGIN\n  PERFORM public.assert_personal_plan_curated_publication_v1_without_v2(p_product_id);';
  replacement text := E'BEGIN\n  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;\n  IF v_product.origin = ''curated''\n    AND v_product.category_key = ''bondbuilder''\n    AND v_product.is_chaarlie_recommended = false\n    AND v_product.lifecycle_status = ''active''\n    AND v_product.is_active = true\n  THEN\n    IF NOT public.bondbuilder_catalogue_available_v1(p_product_id) THEN\n      RAISE EXCEPTION ''curated Bondbuilder catalogue availability requires an exact reviewed admission bundle'';\n    END IF;\n    RETURN;\n  END IF;\n\n  PERFORM public.assert_personal_plan_curated_publication_v1_without_v2(p_product_id);';
BEGIN
  SELECT prosrc INTO body
  FROM pg_catalog.pg_proc
  WHERE oid = 'public.assert_personal_plan_curated_publication(uuid)'::regprocedure;
  IF encode(sha256(convert_to(body, 'UTF8')), 'hex')
    IS DISTINCT FROM 'f3d47d3afb5d53358ea9626b5db577d3f7e55fbe7dff014b8870bb91790ca839'
    OR strpos(body, needle) = 0
  THEN
    RAISE EXCEPTION 'Bondbuilder outer curated assertion lineage changed';
  END IF;
  body := replace(body, needle, replacement);
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.assert_personal_plan_curated_publication(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS %L',
    body
  );
END;
$outer_publication$;

CREATE OR REPLACE FUNCTION public.validate_bondbuilder_recommendation_transition_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.assert_personal_plan_curated_publication(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_bondbuilder_recommendation_transition_v1 ON public.products;
CREATE CONSTRAINT TRIGGER validate_bondbuilder_recommendation_transition_v1
AFTER UPDATE OF is_chaarlie_recommended ON public.products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (
  OLD.category_key = 'bondbuilder'
  AND OLD.origin = 'curated'
  AND OLD.is_chaarlie_recommended = false
  AND NEW.is_chaarlie_recommended = true
)
EXECUTE FUNCTION public.validate_bondbuilder_recommendation_transition_v1();

CREATE OR REPLACE FUNCTION public.bondbuilder_catalogue_activate_v1(
  p_product_id uuid,
  p_expected_preimage jsonb,
  p_request_id uuid,
  p_reviewed_by text,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_preimage jsonb;
  v_postimage jsonb;
  v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_stored_preimage jsonb;
  v_stored_postimage jsonb;
  v_batch text;
  v_admission_batch text;
  v_preimage_hash text;
  v_postimage_hash text;
BEGIN
  IF p_product_id IS NULL OR p_request_id IS NULL OR p_reviewed_by IS DISTINCT FROM 'nick'
    OR p_dry_run IS NULL OR jsonb_typeof(p_expected_preimage) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Bondbuilder catalogue activation requires exact reviewed binding';
  END IF;
  v_batch := 'bondbuilder-catalogue-activation-v1:' || p_request_id::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(hashtextextended(v_batch, 0));

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL THEN RAISE EXCEPTION 'Bondbuilder catalogue activation product not found'; END IF;
  PERFORM 1 FROM public.product_bondbuilder_specs WHERE product_id = p_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_image_assets WHERE product_id = p_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_identifiers WHERE product_id = p_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_application_protocols WHERE product_id = p_product_id FOR UPDATE;
  PERFORM 1 FROM public.personal_plan_catalog_fact_evidence
    WHERE product_id = p_product_id
      AND fact_key IN ('bondbuilder_internal_admission_request', 'bondbuilder_internal_admission_readback',
        'bondbuilder_catalogue_activation_preimage', 'bondbuilder_catalogue_activation_postimage')
    FOR UPDATE;
  SELECT batch_id INTO v_admission_batch FROM public.personal_plan_catalog_fact_evidence
    WHERE product_id = p_product_id AND fact_key = 'bondbuilder_internal_admission_request';
  PERFORM 1 FROM public.catalog_enrichment_applied_items WHERE batch_id = v_admission_batch FOR UPDATE;
  PERFORM 1 FROM public.catalog_enrichment_applied_items WHERE batch_id = v_batch FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.catalog_enrichment_applied_items
    WHERE batch_id = v_batch AND product_id IS DISTINCT FROM p_product_id
  ) THEN
    RAISE EXCEPTION 'Bondbuilder catalogue activation request is already bound to another product';
  END IF;

  SELECT * INTO v_existing FROM public.catalog_enrichment_applied_items
  WHERE batch_id = v_batch AND product_key = p_product_id::text FOR UPDATE;
  IF FOUND THEN
    SELECT fact_value INTO v_stored_preimage FROM public.personal_plan_catalog_fact_evidence
    WHERE product_id = p_product_id AND fact_key = 'bondbuilder_catalogue_activation_preimage' AND batch_id = v_batch;
    SELECT fact_value INTO v_stored_postimage FROM public.personal_plan_catalog_fact_evidence
    WHERE product_id = p_product_id AND fact_key = 'bondbuilder_catalogue_activation_postimage' AND batch_id = v_batch;
    SELECT public.bondbuilder_internal_admission_readback_v1(p_product_id) INTO v_postimage;
    IF v_existing.reviewed_by IS DISTINCT FROM 'nick'
      OR v_stored_preimage IS DISTINCT FROM p_expected_preimage
      OR v_stored_postimage IS NULL
      OR v_postimage IS DISTINCT FROM v_stored_postimage
      OR v_product.is_active IS DISTINCT FROM true
      OR v_existing.batch_fingerprint IS DISTINCT FROM encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_stored_preimage), 'UTF8')), 'hex')
      OR v_existing.content_fingerprint IS DISTINCT FROM encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_stored_postimage), 'UTF8')), 'hex')
      OR (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence evidence
          WHERE evidence.product_id = p_product_id AND evidence.batch_id = v_batch
            AND evidence.fact_key IN ('bondbuilder_catalogue_activation_preimage', 'bondbuilder_catalogue_activation_postimage')) <> 2
      OR NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence evidence
          WHERE evidence.product_id = p_product_id AND evidence.batch_id = v_batch
            AND evidence.fact_key = 'bondbuilder_catalogue_activation_preimage'
            AND evidence.fact_value = v_stored_preimage
            AND evidence.source_label = 'Reviewed Bondbuilder catalogue activation preimage'
            AND evidence.source_url = v_stored_preimage #>> '{product,image_url}'
            AND evidence.source_text = 'Exact reviewed state before activation.'
            AND evidence.source_type = 'internal_verified'
            AND evidence.batch_fingerprint = v_existing.batch_fingerprint
            AND evidence.content_fingerprint = v_existing.content_fingerprint)
      OR NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence evidence
          WHERE evidence.product_id = p_product_id AND evidence.batch_id = v_batch
            AND evidence.fact_key = 'bondbuilder_catalogue_activation_postimage'
            AND evidence.fact_value = v_stored_postimage
            AND evidence.source_label = 'Reviewed Bondbuilder catalogue activation postimage'
            AND evidence.source_url = v_stored_preimage #>> '{product,image_url}'
            AND evidence.source_text = 'Exact state after activation.'
            AND evidence.source_type = 'internal_verified'
            AND evidence.batch_fingerprint = v_existing.batch_fingerprint
            AND evidence.content_fingerprint = v_existing.content_fingerprint)
    THEN
      RAISE EXCEPTION 'Bondbuilder catalogue activation retry drift';
    END IF;
    RETURN jsonb_build_object('outcome', 'already_applied', 'product_id', p_product_id, 'postimage', v_postimage);
  END IF;

  SELECT public.bondbuilder_internal_admission_readback_v1(p_product_id) INTO v_preimage;
  IF v_preimage IS DISTINCT FROM p_expected_preimage
    OR v_product.is_active IS DISTINCT FROM false
    OR NOT public.bondbuilder_catalogue_available_v1(p_product_id)
  THEN
    RAISE EXCEPTION 'Bondbuilder catalogue activation preimage or reviewed admission drift';
  END IF;
  IF p_dry_run THEN
    RETURN jsonb_build_object('outcome', 'ready', 'product_id', p_product_id, 'preimage', v_preimage);
  END IF;

  UPDATE public.products SET is_active = true WHERE id = p_product_id AND is_active = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bondbuilder catalogue activation state changed'; END IF;
  SELECT public.bondbuilder_internal_admission_readback_v1(p_product_id) INTO v_postimage;
  v_preimage_hash := encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_preimage), 'UTF8')), 'hex');
  v_postimage_hash := encode(sha256(convert_to(public.bondbuilder_json_canonical_v1(v_postimage), 'UTF8')), 'hex');
  INSERT INTO public.personal_plan_catalog_fact_evidence(
    product_id, fact_key, fact_value, source_label, source_url, source_text, source_type,
    checked_at, batch_id, batch_fingerprint, content_fingerprint
  ) VALUES
    (p_product_id, 'bondbuilder_catalogue_activation_preimage', v_preimage,
      'Reviewed Bondbuilder catalogue activation preimage', v_product.image_url,
      'Exact reviewed state before activation.', 'internal_verified', current_date,
      v_batch, v_preimage_hash, v_postimage_hash),
    (p_product_id, 'bondbuilder_catalogue_activation_postimage', v_postimage,
      'Reviewed Bondbuilder catalogue activation postimage', v_product.image_url,
      'Exact state after activation.', 'internal_verified', current_date,
      v_batch, v_preimage_hash, v_postimage_hash);
  INSERT INTO public.catalog_enrichment_applied_items(
    batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
  ) VALUES (v_batch, p_product_id::text, v_preimage_hash, v_postimage_hash, p_product_id, 'nick');
  RETURN jsonb_build_object('outcome', 'applied', 'product_id', p_product_id, 'postimage', v_postimage);
END;
$function$;

REVOKE ALL ON FUNCTION public.bondbuilder_catalogue_available_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bondbuilder_catalogue_activate_v1(uuid, jsonb, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bondbuilder_internal_admission_readback_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bondbuilder_catalogue_available_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bondbuilder_catalogue_activate_v1(uuid, jsonb, uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.bondbuilder_internal_admission_readback_v1(uuid) TO service_role;

COMMIT;
