-- Exact, atomic executor for Nick's reviewed Oil authority repair manifest.

CREATE OR REPLACE FUNCTION public.apply_catalog_authority_oil_repair_v1(
  p_manifest_json text,
  p_expected_manifest_fingerprint text,
  p_reviewed_by text
)
RETURNS TABLE(product_id uuid, applied_roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_approved_manifest_fingerprint constant text := 'bc2cca3c68ae4eea4dd337fcbbd5f02be5d7ac1d42635a26bd68a74255929b2b';
  v_manifest jsonb;
  v_entry jsonb;
  v_target jsonb;
  v_protocol jsonb;
  v_evidence jsonb;
  v_current jsonb;
  v_computed_fingerprint text;
  v_product_id uuid;
  v_item_fingerprint text;
  v_affected integer;
  v_existing public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  -- Keep this explicit even after approval. SQL NULL comparison is unknown
  -- and a later pin-removal migration must remain fail-closed.
  IF v_approved_manifest_fingerprint IS NULL THEN
    RAISE EXCEPTION 'Oil authority repair manifest is not approved';
  END IF;
  IF p_reviewed_by IS DISTINCT FROM 'nick' THEN
    RAISE EXCEPTION 'Oil authority repair reviewer must be nick';
  END IF;
  IF p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Oil authority repair fingerprint must be lowercase sha256';
  END IF;
  v_computed_fingerprint := encode(
    extensions.digest(pg_catalog.convert_to(p_manifest_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_computed_fingerprint IS DISTINCT FROM p_expected_manifest_fingerprint THEN
    RAISE EXCEPTION 'Oil authority repair manifest fingerprint mismatch';
  END IF;
  IF p_expected_manifest_fingerprint IS DISTINCT FROM v_approved_manifest_fingerprint THEN
    RAISE EXCEPTION 'Oil authority repair manifest fingerprint is not approved';
  END IF;

  BEGIN
    v_manifest := p_manifest_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Oil authority repair manifest is invalid JSON';
  END;
  IF v_manifest->>'schemaVersion' IS DISTINCT FROM '1'
     OR v_manifest->>'slice' IS DISTINCT FROM 'leave_in_oil'
     OR pg_catalog.jsonb_typeof(v_manifest->'entries') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_manifest->'entries') <> 15 THEN
    RAISE EXCEPTION 'Oil authority repair manifest header is invalid';
  END IF;
  IF (
    SELECT pg_catalog.count(DISTINCT item->>'productId')
    FROM pg_catalog.jsonb_array_elements(v_manifest->'entries') AS entries(item)
  ) <> 15 OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_manifest->'entries') AS entries(item)
    WHERE item->>'categoryKey' IS DISTINCT FROM 'oil'
      OR item->'expectedCurrentAuthority' IS NULL
      OR item->'intendedAuthority' IS NULL
  ) THEN
    RAISE EXCEPTION 'Oil authority repair cohort is invalid';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-authority:oil-authority-enrichment-v1', 0)
  );

  FOR v_entry IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(v_manifest->'entries') AS entries(item)
    ORDER BY item->>'productId'
  LOOP
    v_product_id := (v_entry->>'productId')::uuid;
    v_target := v_entry->'intendedAuthority';
    v_item_fingerprint := v_entry->>'expectedNewFingerprint';

    -- Row locks plus a full semantic prestate prevent partial or stale repair.
    PERFORM 1 FROM public.products AS product WHERE product.id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Oil authority repair product is missing: %', v_product_id;
    END IF;
    PERFORM 1 FROM public.product_oil_specs AS spec WHERE spec.product_id = v_product_id FOR UPDATE;
    PERFORM 1 FROM public.product_oil_eligibility AS eligibility WHERE eligibility.product_id = v_product_id FOR UPDATE;
    PERFORM 1 FROM public.product_application_protocols AS protocol WHERE protocol.product_id = v_product_id FOR UPDATE;
    PERFORM 1 FROM public.personal_plan_catalog_fact_evidence AS evidence WHERE evidence.product_id = v_product_id FOR UPDATE;

    SELECT pg_catalog.jsonb_build_object(
      'identity', pg_catalog.jsonb_build_object(
        'productId', product.id::text,
        'name', product.name,
        'brand', product.brand,
        'categoryKey', product.category_key,
        'affiliateLink', product.affiliate_link,
        'origin', product.origin,
        'isActive', product.is_active,
        'lifecycleStatus', product.lifecycle_status,
        'isChaarlieRecommended', product.is_chaarlie_recommended,
        'suitableThicknesses', pg_catalog.to_jsonb(product.suitable_thicknesses),
        'normalizedThicknesses', COALESCE((
          SELECT pg_catalog.jsonb_agg(thickness.thickness ORDER BY thickness.thickness)
          FROM public.product_thickness_eligibility AS thickness
          WHERE thickness.product_id = product.id AND thickness.category_key = 'oil'
        ), '[]'::jsonb)
      ),
      'productOilSpec', (
        SELECT pg_catalog.jsonb_build_object(
          'weight', spec.weight,
          'roleSupport', pg_catalog.to_jsonb(spec.role_support),
          'providesHeatProtection', spec.provides_heat_protection
        )
        FROM public.product_oil_specs AS spec
        WHERE spec.product_id = product.id AND spec.category_key = 'oil'
      ),
      'productOilEligibility', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'thickness', eligibility.thickness,
          'oilSubtype', eligibility.oil_subtype,
          'oilPurpose', eligibility.oil_purpose,
          'ingredientFlags', pg_catalog.to_jsonb(eligibility.ingredient_flags)
        ) ORDER BY eligibility.thickness, eligibility.oil_subtype)
        FROM public.product_oil_eligibility AS eligibility
        WHERE eligibility.product_id = product.id AND eligibility.category_key = 'oil'
      ), '[]'::jsonb),
      'protocols', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'role', protocol.role,
          'applicationFamily', protocol.application_family,
          'cadence', protocol.cadence,
          'applicationStage', protocol.application_stage,
          'applicationState', protocol.application_state,
          'placement', protocol.placement,
          'contactTimeSeconds', protocol.contact_time_seconds,
          'rinseAction', protocol.rinse_action,
          'reapplication', protocol.reapplication,
          'instructionModifiers', protocol.instruction_modifiers,
          'sourceLabel', protocol.source_label,
          'sourceUrl', protocol.source_url,
          'sourceText', protocol.source_text,
          'guidancePayload', protocol.guidance_payload
        ) ORDER BY protocol.role, protocol.application_family)
        FROM public.product_application_protocols AS protocol
        WHERE protocol.product_id = product.id AND protocol.category_key = 'oil'
      ), '[]'::jsonb),
      'factEvidence', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'factKey', evidence.fact_key,
          'factValue', evidence.fact_value,
          'sourceLabel', evidence.source_label,
          'sourceUrl', evidence.source_url,
          'sourceText', evidence.source_text,
          'sourceType', evidence.source_type,
          'checkedAt', evidence.checked_at::text
        ) ORDER BY evidence.source_url)
        FROM public.personal_plan_catalog_fact_evidence AS evidence
        WHERE evidence.product_id = product.id AND evidence.fact_key = 'oil.authority_facts'
      ), '[]'::jsonb)
    ) INTO v_current
    FROM public.products AS product
    WHERE product.id = v_product_id;

    SELECT applied.* INTO v_existing
    FROM public.catalog_enrichment_applied_items AS applied
    WHERE applied.batch_id = 'OIL-20260901-authority-enrichment-v1'
      AND applied.product_key = 'oil-authority:' || v_product_id::text;
    IF FOUND THEN
      IF v_existing.batch_fingerprint IS DISTINCT FROM v_computed_fingerprint
         OR v_existing.content_fingerprint IS DISTINCT FROM v_item_fingerprint
         OR v_existing.product_id IS DISTINCT FROM v_product_id
         OR v_existing.reviewed_by IS DISTINCT FROM 'nick' THEN
        RAISE EXCEPTION 'Oil authority repair ledger conflicts with retry: %', v_product_id;
      END IF;
      IF v_current IS DISTINCT FROM v_target THEN
        RAISE EXCEPTION 'Oil authority repair applied target drift: %', v_product_id;
      END IF;
      product_id := v_product_id;
      applied_roles := ARRAY(
        SELECT pg_catalog.jsonb_array_elements_text(v_target#>'{productOilSpec,roleSupport}')
      );
      RETURN NEXT;
      CONTINUE;
    END IF;
    IF v_current IS DISTINCT FROM v_entry->'expectedCurrentAuthority' THEN
      RAISE EXCEPTION 'Oil authority repair live prestate drift: %', v_product_id;
    END IF;

    INSERT INTO public.product_oil_specs (
      product_id, category_key, weight, role_support, provides_heat_protection
    ) VALUES (
      v_product_id,
      'oil',
      v_target#>>'{productOilSpec,weight}',
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_target#>'{productOilSpec,roleSupport}')),
      (v_target#>>'{productOilSpec,providesHeatProtection}')::boolean
    )
    ON CONFLICT ON CONSTRAINT product_oil_specs_pkey DO UPDATE SET
      weight = EXCLUDED.weight,
      role_support = EXCLUDED.role_support,
      provides_heat_protection = EXCLUDED.provides_heat_protection;

    UPDATE public.product_oil_eligibility AS eligibility SET
      oil_purpose = v_target#>>'{productOilEligibility,0,oilPurpose}',
      ingredient_flags = ARRAY(
        SELECT pg_catalog.jsonb_array_elements_text(v_target#>'{productOilEligibility,0,ingredientFlags}')
      )
    WHERE eligibility.product_id = v_product_id
      AND eligibility.category_key = 'oil'
      AND eligibility.thickness = v_target#>>'{productOilEligibility,0,thickness}'
      AND eligibility.oil_subtype = v_target#>>'{productOilEligibility,0,oilSubtype}';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'Oil authority repair eligibility identity drift: %', v_product_id;
    END IF;

    FOR v_protocol IN
      SELECT item FROM pg_catalog.jsonb_array_elements(v_target->'protocols') AS protocols(item)
      ORDER BY item->>'role', item->>'applicationFamily'
    LOOP
      INSERT INTO public.product_application_protocols (
        product_id, category, role, cadence, application_stage,
        application_state, placement, contact_time_seconds, rinse_action,
        reapplication, instruction_modifiers, source_label, source_url,
        source_text, guidance_payload
      ) VALUES (
        v_product_id, 'oil', v_protocol->>'role', v_protocol->'cadence',
        v_protocol->>'applicationStage', v_protocol->>'applicationState',
        v_protocol->>'placement', NULLIF(v_protocol->>'contactTimeSeconds', '')::integer,
        v_protocol->>'rinseAction', v_protocol->>'reapplication',
        v_protocol->'instructionModifiers', v_protocol->>'sourceLabel',
        v_protocol->>'sourceUrl', v_protocol->>'sourceText', v_protocol->'guidancePayload'
      )
      ON CONFLICT (product_id, category, role, application_family) DO UPDATE SET
        cadence = EXCLUDED.cadence,
        application_stage = EXCLUDED.application_stage,
        application_state = EXCLUDED.application_state,
        placement = EXCLUDED.placement,
        contact_time_seconds = EXCLUDED.contact_time_seconds,
        rinse_action = EXCLUDED.rinse_action,
        reapplication = EXCLUDED.reapplication,
        instruction_modifiers = EXCLUDED.instruction_modifiers,
        source_label = EXCLUDED.source_label,
        source_url = EXCLUDED.source_url,
        source_text = EXCLUDED.source_text,
        guidance_payload = EXCLUDED.guidance_payload;
    END LOOP;

    FOR v_evidence IN
      SELECT item FROM pg_catalog.jsonb_array_elements(v_target->'factEvidence') AS evidence(item)
      ORDER BY item->>'sourceUrl'
    LOOP
      INSERT INTO public.personal_plan_catalog_fact_evidence (
        product_id, fact_key, fact_value, source_label, source_url, source_text,
        source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint
      ) VALUES (
        v_product_id, v_evidence->>'factKey', v_evidence->'factValue',
        v_evidence->>'sourceLabel', v_evidence->>'sourceUrl', v_evidence->>'sourceText',
        v_evidence->>'sourceType', (v_evidence->>'checkedAt')::date,
        'OIL-20260901-authority-enrichment-v1', v_computed_fingerprint, v_item_fingerprint
      )
      ON CONFLICT ON CONSTRAINT personal_plan_catalog_fact_evidence_pkey DO UPDATE SET
        fact_value = EXCLUDED.fact_value,
        source_label = EXCLUDED.source_label,
        source_text = EXCLUDED.source_text,
        source_type = EXCLUDED.source_type,
        checked_at = EXCLUDED.checked_at,
        batch_id = EXCLUDED.batch_id,
        batch_fingerprint = EXCLUDED.batch_fingerprint,
        content_fingerprint = EXCLUDED.content_fingerprint;
    END LOOP;

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      'OIL-20260901-authority-enrichment-v1',
      'oil-authority:' || v_product_id::text,
      v_computed_fingerprint,
      v_item_fingerprint,
      v_product_id,
      'nick'
    );

    product_id := v_product_id;
    applied_roles := ARRAY(
      SELECT pg_catalog.jsonb_array_elements_text(v_target#>'{productOilSpec,roleSupport}')
    );
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_catalog_authority_oil_repair_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_authority_oil_repair_v1(text, text, text)
  TO service_role;
