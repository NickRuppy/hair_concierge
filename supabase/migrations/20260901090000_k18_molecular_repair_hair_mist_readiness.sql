-- K18 Molecular Repair Hair Mist readiness fingerprint: 4a6694959985138baf17701025e479387c827bd4f89948cd12f58aae29efe4dd
--
-- This is a deliberately bounded, one-shot correction for one already curated
-- 300 ml package. It writes only the reviewed readiness/identity fields, a
-- provenance record, and the replay receipt; it does not create an identifier.
BEGIN;

DO $k18_molecular_repair_hair_mist_readiness$
DECLARE
  v_product_id constant uuid := '8f84eae5-222d-4bbf-9ab0-f30361882a95';
  v_batch_id constant text := 'S5R-02-k18-mist-readiness';
  v_fingerprint constant text := '4a6694959985138baf17701025e479387c827bd4f89948cd12f58aae29efe4dd';
  v_old_description constant text := 'K18 Hair Professional Molecular Repair Hair Mist ist ein Leave-in von K18, empfohlen für feines Haar bei Proteinbedarf.';
  v_old_disposition_reason constant text := 'Exact product is a professional-service mist and is not compatible with the consumer Personal Plan leave-in role.';
  v_receipt public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  SELECT * INTO v_receipt
  FROM public.catalog_enrichment_applied_items
  WHERE batch_id = v_batch_id
    AND product_key = 'k18-readiness:' || v_product_id::text;

  IF FOUND THEN
    IF v_receipt.batch_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_receipt.content_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_receipt.product_id IS DISTINCT FROM v_product_id
       OR v_receipt.reviewed_by IS DISTINCT FROM 'nick'
       OR EXISTS (
         SELECT 1
         FROM public.personal_plan_product_search_dispositions
         WHERE product_id = v_product_id
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.products
         WHERE id = v_product_id
           AND description = 'K18 Hair Professional Molecular Repair Hair Mist ist ein leichtes Leave-in für Längen und Spitzen bei Proteinbedarf.'
           AND suitable_thicknesses = ARRAY['fine', 'normal', 'coarse']::text[]
           AND net_content_value = 300
           AND net_content_unit = 'ml'
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.product_leave_in_specs
         WHERE product_id = v_product_id
           AND category_key = 'leave_in'
           AND weight = 'light'
           AND application_stage = ARRAY['towel_dry']::text[]
           AND ingredient_flags = ARRAY['humectants', 'proteins', 'polymers']::text[]
           AND care_direction = 'protein'
           AND repair_support_level = 'medium'
           AND roles = ARRAY['styling_prep']::text[]
           AND care_benefits = ARRAY['repair']::text[]
           AND plan_roles = ARRAY['post_wash_leave_in']::text[]
           AND functional_benefits = ARRAY['repair_support']::text[]
           AND provides_heat_protection = false
       )
       OR (SELECT count(*) FROM public.product_leave_in_eligibility WHERE product_id = v_product_id) <> 6
       OR EXISTS (
         SELECT 1
         FROM public.product_leave_in_eligibility
         WHERE product_id = v_product_id
           AND (thickness, need_bucket, styling_context) NOT IN (
             ('fine', 'repair', 'air_dry'),
             ('fine', 'repair', 'non_heat_style'),
             ('normal', 'repair', 'air_dry'),
             ('normal', 'repair', 'non_heat_style'),
             ('coarse', 'repair', 'air_dry'),
             ('coarse', 'repair', 'non_heat_style')
           )
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.product_application_protocols
         WHERE product_id = v_product_id
           AND category = 'leave_in'
           AND category_key = 'leave_in'
           AND role = 'post_wash_leave_in'
           AND application_family = 'post_wash_damp_conditioning'
           AND contact_time_seconds = 240
           AND rinse_action = 'leave_in'
           AND guidance_payload#>>'{schemaVersion}' = '1'
           AND guidance_payload#>>'{scope,productId}' = v_product_id::text
           AND guidance_payload#>>'{scope,category}' = 'leave_in'
           AND guidance_payload#>>'{role}' = 'leave_in'
           AND guidance_payload#>>'{applicationFamily}' = 'post_wash_damp_conditioning'
           AND guidance_payload#>>'{protocolFacts,contactTimeSeconds}' = '240'
           AND guidance_payload_v2#>>'{contractKind}' = 'product_pointer'
           AND guidance_payload_v2#>>'{scope,productId}' = v_product_id::text
           AND guidance_payload_v2#>>'{scope,category}' = 'leave_in'
           AND guidance_payload_v2#>'{runtimeBlockerCode}' = 'null'::jsonb
       )
       OR (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product_id AND fact_key = 'leave_in.authority_facts' AND batch_id = v_batch_id AND batch_fingerprint = v_fingerprint) <> 2
       OR NOT EXISTS (
         SELECT 1
         FROM public.personal_plan_catalog_fact_evidence
         WHERE product_id = v_product_id
           AND fact_key = 'leave_in.consumer_role_decision'
           AND source_type = 'internal_verified'
           AND batch_id = v_batch_id
           AND batch_fingerprint = v_fingerprint
       ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist readiness receipt conflicts with current state';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.products
      WHERE id = v_product_id
        AND brand = 'K18'
        AND name = 'K18 Hair Professional Molecular Repair Hair Mist'
        AND category_key = 'leave_in'
        AND origin = 'curated'
        AND is_active = true
        AND lifecycle_status = 'active'
        AND description = v_old_description
        AND suitable_thicknesses = ARRAY['fine']::text[]
        AND net_content_value IS NULL
        AND net_content_unit IS NULL
    ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist product identity or preimage changed';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.product_leave_in_specs
      WHERE product_id = v_product_id
        AND category_key = 'leave_in'
        AND weight = 'light'
        AND application_stage = ARRAY['towel_dry']::text[]
        AND ingredient_flags = ARRAY[]::text[]
        AND care_direction IS NULL
        AND repair_support_level IS NULL
        AND roles = ARRAY['styling_prep']::text[]
        AND care_benefits = ARRAY['repair']::text[]
        AND plan_roles IS NULL
        AND functional_benefits IS NULL
        AND provides_heat_protection = false
    ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist Leave-in spec preimage changed';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions
      WHERE product_id = v_product_id
        AND disposition = 'retired_from_personal_plan'
        AND reason_code = 'wrong_category'
        AND reason = v_old_disposition_reason
        AND source_batch = 'S5-21-product-search-dispositions'
        AND source_fingerprint = 'dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6'
        AND reviewed_by = 'nick'
    ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist prior disposition changed';
    END IF;

    IF (SELECT count(*) FROM public.product_leave_in_eligibility WHERE product_id = v_product_id) <> 2
       OR EXISTS (
         SELECT 1
         FROM public.product_leave_in_eligibility
         WHERE product_id = v_product_id
           AND (thickness, need_bucket, styling_context) NOT IN (
             ('fine', 'repair', 'air_dry'),
             ('fine', 'repair', 'non_heat_style')
           )
       ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist eligibility preimage changed';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.product_application_protocols
      WHERE product_id = v_product_id
        AND category = 'leave_in'
        AND role = 'post_wash_leave_in'
        AND application_family = 'post_wash_damp_conditioning'
    ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist protocol already exists';
    END IF;

    UPDATE public.products
    SET description = 'K18 Hair Professional Molecular Repair Hair Mist ist ein leichtes Leave-in für Längen und Spitzen bei Proteinbedarf.',
        suitable_thicknesses = ARRAY['fine', 'normal', 'coarse']::text[],
        net_content_value = 300,
        net_content_unit = 'ml'
    WHERE id = v_product_id;

    UPDATE public.product_leave_in_specs
    SET ingredient_flags = ARRAY['humectants', 'proteins', 'polymers']::text[],
        care_direction = 'protein',
        repair_support_level = 'medium',
        plan_roles = ARRAY['post_wash_leave_in']::text[],
        functional_benefits = ARRAY['repair_support']::text[],
        provides_heat_protection = false
    WHERE product_id = v_product_id;

    INSERT INTO public.product_leave_in_eligibility (
      product_id, category_key, thickness, need_bucket, styling_context
    ) VALUES
      (v_product_id, 'leave_in', 'normal', 'repair', 'air_dry'),
      (v_product_id, 'leave_in', 'normal', 'repair', 'non_heat_style'),
      (v_product_id, 'leave_in', 'coarse', 'repair', 'air_dry'),
      (v_product_id, 'leave_in', 'coarse', 'repair', 'non_heat_style');

    INSERT INTO public.product_application_protocols (
      product_id, category, role, cadence, application_stage,
      application_state, placement, contact_time_seconds, rinse_action,
      reapplication, instruction_modifiers, source_label, source_url, source_text,
      guidance_payload, guidance_payload_v2
    ) VALUES (
      v_product_id, 'leave_in', 'post_wash_leave_in',
      NULL, 'damp_leave_on', 'damp', 'lengths_ends', 240, 'leave_in', 'not_stated',
      '[]'::jsonb,
      'Chaarlie consumer-role decision',
      'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale',
      'Nick approved the hairdresser-informed decision to use this lighter K18 mist as an ordinary lightweight consumer leave-in. Official K18 evidence supports identity and timing, but not this consumer-role decision.',
      jsonb_build_object(
        'schemaVersion', 1,
        'guidanceKey', 'product-leave-in-8f84eae5-222d-4bbf-9ab0-f30361882a95-post-wash',
        'protocolVersion', 1,
        'locale', 'de',
        'scope', jsonb_build_object('kind', 'product', 'category', 'leave_in', 'productId', v_product_id::text),
        'role', 'leave_in',
        'applicationFamily', 'post_wash_damp_conditioning',
        'compatibleDayTypes', jsonb_build_array('wash_day', 'intensive_care_day', 'styling_day'),
        'exactGuidanceRequired', true,
        'sequence', jsonb_build_object('anchor', 'damp_leave_on', 'before', jsonb_build_array(), 'after', jsonb_build_array('post_rinse_towel_dry'), 'conflictsWith', jsonb_build_array()),
        'requirements', jsonb_build_object('requiredCatalogFacts', jsonb_build_array('leave_in.plan_roles'), 'requiredProtocolFacts', jsonb_build_array(), 'requiredProfileFacts', jsonb_build_array()),
        'protocolFacts', jsonb_build_object('applicationArea', 'lengths_ends', 'rinse', 'leave_in', 'contactTimeSeconds', 240, 'conditionerRelationship', 'not_applicable', 'reapplication', 'none', 'amount', jsonb_build_object('kind', 'qualitative', 'copyDe', 'Gleichmäßig in Längen und Spitzen sprühen.'), 'cautions', jsonb_build_array()),
        'steps', jsonb_build_array(
          jsonb_build_object('stepKey', 'apply-k18-mist', 'action', 'apply_product', 'copyTemplateDe', 'Nach dem Waschen gleichmäßig ins handtuchtrockene Haar sprühen.'),
          jsonb_build_object('stepKey', 'wait-k18-mist', 'action', 'wait', 'copyTemplateDe', 'Vier Minuten einwirken lassen.'),
          jsonb_build_object('stepKey', 'finish-k18-mist', 'action', 'dry', 'copyTemplateDe', 'Nicht ausspülen und danach wie gewohnt weiter stylen.')
        ),
        'evidence', jsonb_build_array(
          jsonb_build_object('sourceUrl', 'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale', 'sourceType', 'manufacturer', 'checkedAt', '2026-09-01'),
          jsonb_build_object('sourceUrl', 'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale', 'sourceType', 'internal_authority', 'checkedAt', '2026-09-01')
        )
      ),
      jsonb_build_object(
        'schemaVersion', 2,
        'contractKind', 'product_pointer',
        'scope', jsonb_build_object('kind', 'product', 'category', 'leave_in', 'productId', v_product_id::text),
        'sourceRole', 'post_wash_leave_in',
        'role', 'leave_in',
        'applicationFamily', 'post_wash_damp_conditioning',
        'facts', jsonb_build_object(
          'applicationState', 'damp_hair',
          'applicationArea', 'hair_lengths_ends',
          'rinse', 'leave_in',
          'contactTime', jsonb_build_object('kind', 'seconds', 'seconds', 240),
          'amount', NULL,
          'heat', NULL,
          'conditionerPolicy', 'not_applicable'
        ),
        'workflowId', NULL,
        'requiredCompanionProductId', NULL,
        'runtimeBlockerCode', NULL,
        'exactSteps', jsonb_build_array(),
        'cautionCodes', jsonb_build_array(),
        'evidence', jsonb_build_array(
          jsonb_build_object('sourceUrl', 'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale', 'sourceType', 'manufacturer', 'checkedAt', '2026-09-01'),
          jsonb_build_object('sourceUrl', 'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale', 'sourceType', 'internal_authority', 'checkedAt', '2026-09-01')
        )
      )
    );

    IF (SELECT count(*) FROM public.product_leave_in_eligibility WHERE product_id = v_product_id) <> 6
       OR EXISTS (
         SELECT 1
         FROM public.product_leave_in_eligibility
         WHERE product_id = v_product_id
           AND (thickness, need_bucket, styling_context) NOT IN (
             ('fine', 'repair', 'air_dry'),
             ('fine', 'repair', 'non_heat_style'),
             ('normal', 'repair', 'air_dry'),
             ('normal', 'repair', 'non_heat_style'),
             ('coarse', 'repair', 'air_dry'),
             ('coarse', 'repair', 'non_heat_style')
           )
       ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist eligibility target is incomplete';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.product_leave_in_specs
      WHERE product_id = v_product_id
        AND weight = 'light'
        AND application_stage = ARRAY['towel_dry']::text[]
        AND care_direction = 'protein'
        AND repair_support_level = 'medium'
        AND plan_roles = ARRAY['post_wash_leave_in']::text[]
        AND functional_benefits = ARRAY['repair_support']::text[]
        AND provides_heat_protection = false
    ) OR NOT EXISTS (
      SELECT 1
      FROM public.product_application_protocols
      WHERE product_id = v_product_id
        AND category = 'leave_in'
        AND category_key = 'leave_in'
        AND role = 'post_wash_leave_in'
        AND application_family = 'post_wash_damp_conditioning'
        AND contact_time_seconds = 240
        AND rinse_action = 'leave_in'
        AND guidance_payload#>>'{schemaVersion}' = '1'
        AND guidance_payload#>>'{scope,productId}' = v_product_id::text
        AND guidance_payload#>>'{scope,category}' = 'leave_in'
        AND guidance_payload#>>'{role}' = 'leave_in'
        AND guidance_payload#>>'{applicationFamily}' = 'post_wash_damp_conditioning'
        AND guidance_payload#>>'{protocolFacts,contactTimeSeconds}' = '240'
        AND guidance_payload_v2#>>'{contractKind}' = 'product_pointer'
        AND guidance_payload_v2#>>'{scope,productId}' = v_product_id::text
        AND guidance_payload_v2#>>'{scope,category}' = 'leave_in'
        AND guidance_payload_v2#>'{runtimeBlockerCode}' = 'null'::jsonb
    ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist readiness target is incomplete';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = v_product_id
        AND fact_key = 'leave_in.authority_facts'
    ) THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist fact provenance already exists';
    END IF;

    INSERT INTO public.personal_plan_catalog_fact_evidence (
      product_id, fact_key, fact_value, source_label, source_url, source_text,
      source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint
    ) VALUES
      (v_product_id, 'leave_in.authority_facts',
       '{"format":"lightweight_leave_in_mist","contact_time_seconds":240,"rinse":"leave_in","official_positioning":"professional_service"}'::jsonb,
       'K18 Professional Molecular Repair Hair Mist',
       'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale',
       'Official evidence supports the exact professional 300 ml Molecular Repair Hair Mist, lightweight leave-in format, formula, and four-minute/no-rinse timing. It frames the product as a professional service and does not itself establish the ordinary consumer Personal Plan role.',
       'manufacturer', DATE '2026-09-01', v_batch_id, v_fingerprint, v_fingerprint),
      (v_product_id, 'leave_in.authority_facts',
       '{"net_content_value":300,"net_content_unit":"ml"}'::jsonb,
       'CosmoProf K18 Molecular Repair Hair Mist',
       'https://www.cosmoprofbeauty.com/USA-040285.html',
       'Exact 10 fl oz / 300 ml professional mist package identity supports the scoped net-content correction.',
       'retailer', DATE '2026-09-01', v_batch_id, v_fingerprint, v_fingerprint),
      (v_product_id, 'leave_in.consumer_role_decision',
       '{"care_direction":"protein","repair_support_level":"medium","plan_roles":["post_wash_leave_in"],"functional_benefits":["repair_support"],"provides_heat_protection":false,"decision":"ordinary_lightweight_consumer_leave_in_not_primary_bondbuilder"}'::jsonb,
       'Chaarlie consumer-role decision',
       'https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale',
       'Nick approved the hairdresser-informed decision to treat this lighter K18 mist as an ordinary lightweight consumer leave-in, not as the primary bondbuilder. Official K18 evidence remains limited to product identity, formula, and timing.',
       'internal_verified', DATE '2026-09-01', v_batch_id, v_fingerprint, v_fingerprint);

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      v_batch_id, 'k18-readiness:' || v_product_id::text, v_fingerprint, v_fingerprint,
      v_product_id, 'nick'
    );

    DELETE FROM public.personal_plan_product_search_dispositions
    WHERE product_id = v_product_id
      AND disposition = 'retired_from_personal_plan'
      AND reason_code = 'wrong_category'
      AND reason = v_old_disposition_reason
      AND source_batch = 'S5-21-product-search-dispositions'
      AND source_fingerprint = 'dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6'
      AND reviewed_by = 'nick';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'K18 Molecular Repair Hair Mist prior disposition was not removed';
    END IF;
  END IF;
END;
$k18_molecular_repair_hair_mist_readiness$;

COMMIT;
