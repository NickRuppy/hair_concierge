-- ROLLBACK for S5R-03-km-young-again-oil-recategorization (fingerprint 3b9410d5031f552f1c1a69ee529f828268c8ec963c9a721fdf6b1d8fcfa4bda1).
-- PREPARED, NOT A MIGRATION. Restores the exact 2026-09-29 Leave-in preimage
-- (original row ids and timestamps) captured in prestate-2026-09-29.json.
-- Run only on Nick's instruction, as one transaction, and only while the
-- product still carries exactly this migration's Oil target (guarded below).
BEGIN;

SET LOCAL lock_timeout = '5s';

SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);

DO $rollback$
DECLARE
  v_product_id constant uuid := '6ad82861-d68e-4e70-a976-78c0f35d087b';
  v_fingerprint constant text := '3b9410d5031f552f1c1a69ee529f828268c8ec963c9a721fdf6b1d8fcfa4bda1';
  v_rows integer;
BEGIN
  PERFORM 1 FROM public.products WHERE id = v_product_id AND category_key = 'oil' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback: product is not an Oil'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_enrichment_applied_items
    WHERE batch_id = 'S5R-03-km-young-again-oil-recategorization' AND product_key = 'oil-recategorization:6ad82861-d68e-4e70-a976-78c0f35d087b'
      AND batch_fingerprint = v_fingerprint AND product_id = v_product_id
  ) THEN
    RAISE EXCEPTION 'rollback: forward receipt missing; refusing to guess the state';
  END IF;

  -- Refuse if a Personal Plan / owner captured the product as an Oil meanwhile.
  IF EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = v_product_id)
       OR EXISTS (SELECT 1 FROM public.user_product_usage WHERE product_id = v_product_id)
       OR EXISTS (SELECT 1 FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_refinement_drafts WHERE to_jsonb(personal_plan_refinement_drafts)::text LIKE '%' || v_product_id::text || '%') THEN
    RAISE EXCEPTION 'rollback: product is referenced by a plan/owner as an Oil; needs a reference migration';
  END IF;

  DELETE FROM public.product_application_protocols WHERE product_id = v_product_id AND category = 'oil';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN RAISE EXCEPTION 'rollback: oil protocol count %', v_rows; END IF;
  DELETE FROM public.product_oil_eligibility WHERE product_id = v_product_id;
  DELETE FROM public.product_oil_specs WHERE product_id = v_product_id;
  DELETE FROM public.product_concern_eligibility WHERE product_id = v_product_id AND category_key = 'oil';
  DELETE FROM public.product_thickness_eligibility WHERE product_id = v_product_id AND category_key = 'oil';
  DELETE FROM public.personal_plan_catalog_fact_evidence
  WHERE product_id = v_product_id AND fact_key = 'oil.authority_facts' AND batch_fingerprint = v_fingerprint;
  DELETE FROM public.catalog_enrichment_applied_items
  WHERE batch_id = 'S5R-03-km-young-again-oil-recategorization' AND product_key = 'oil-recategorization:6ad82861-d68e-4e70-a976-78c0f35d087b';

  UPDATE public.products
  SET category_key = 'leave_in',
      category = 'Leave-in',
      tags = ARRAY['leave-in']::text[],
      suitable_thicknesses = ARRAY['normal']::text[],
      suitable_concerns = ARRAY['performance', 'tangling']::text[],
      description = 'Kevin Murphy Young Again (Silikone) ist ein Leave-in von Kevin Murphy, empfohlen für mittelstarkes Haar bei Performance-Pflege.',
      net_content_value = NULL,
      net_content_unit = NULL,
      updated_at = '2026-08-15T07:47:38.210968+00:00'::timestamptz
  WHERE id = v_product_id;

  INSERT INTO public.product_leave_in_specs (product_id, format, weight, roles, provides_heat_protection, heat_protection_max_c, heat_activation_required, care_benefits, ingredient_flags, application_stage, care_direction, repair_support_level, plan_roles, functional_benefits, category_key, conditioner_relationship, created_at, updated_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'serum'::text, 'medium'::text, ARRAY['oil_replacement']::text[], false, NULL::integer, false, ARRAY['anti_frizz', 'shine']::text[], ARRAY['silicones', 'oils']::text[], ARRAY['towel_dry', 'dry_hair', 'post_style']::text[], 'balanced'::text, 'medium'::text, ARRAY['post_wash_leave_in']::text[], ARRAY['moisture_softness', 'repair_support', 'shine_support', 'smooth_anti_frizz']::text[], 'leave_in'::text, 'booster_only'::text, '2026-04-15T20:40:50.488342+00:00'::timestamptz, '2026-08-12T07:43:26.372624+00:00'::timestamptz);
  INSERT INTO public.product_leave_in_fit_specs (product_id, weight, conditioner_relationship, care_benefits, created_at, updated_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'medium'::text, 'booster_only'::text, ARRAY['detangle_smooth']::text[], '2026-04-16T07:56:37.825859+00:00'::timestamptz, '2026-04-16T07:56:37.825859+00:00'::timestamptz);
  INSERT INTO public.product_thickness_eligibility (product_id, category_key, thickness, created_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'normal'::text, '2026-08-15T08:56:39.94203+00:00'::timestamptz)
  ON CONFLICT (product_id, category_key, thickness) DO UPDATE SET created_at = EXCLUDED.created_at;
  INSERT INTO public.product_concern_eligibility (product_id, category_key, concern_key, created_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'performance'::text, '2026-08-15T08:56:39.94203+00:00'::timestamptz)
  ON CONFLICT (product_id, category_key, concern_key) DO UPDATE SET created_at = EXCLUDED.created_at;
  INSERT INTO public.product_concern_eligibility (product_id, category_key, concern_key, created_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'tangling'::text, '2026-08-15T08:56:39.94203+00:00'::timestamptz)
  ON CONFLICT (product_id, category_key, concern_key) DO UPDATE SET created_at = EXCLUDED.created_at;
  INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context, category_key, created_at, updated_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'normal'::text, 'moisture_anti_frizz'::text, 'air_dry'::text, 'leave_in'::text, '2026-08-12T07:43:26.372624+00:00'::timestamptz, '2026-08-12T07:43:26.372624+00:00'::timestamptz);
  INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context, category_key, created_at, updated_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'normal'::text, 'moisture_anti_frizz'::text, 'non_heat_style'::text, 'leave_in'::text, '2026-08-12T07:43:26.372624+00:00'::timestamptz, '2026-08-12T07:43:26.372624+00:00'::timestamptz);
  INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context, category_key, created_at, updated_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'normal'::text, 'shine_protect'::text, 'air_dry'::text, 'leave_in'::text, '2026-08-12T07:43:26.372624+00:00'::timestamptz, '2026-08-12T07:43:26.372624+00:00'::timestamptz);
  INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context, category_key, created_at, updated_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'normal'::text, 'shine_protect'::text, 'non_heat_style'::text, 'leave_in'::text, '2026-08-12T07:43:26.372624+00:00'::timestamptz, '2026-08-12T07:43:26.372624+00:00'::timestamptz);
  INSERT INTO public.product_application_protocols (id, product_id, category, role, cadence, application_stage, application_state, placement, contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label, source_url, source_text, guidance_payload, guidance_payload_v2, created_at, updated_at)
  VALUES ('058cd3f2-be57-40a1-8fc5-9f09c1b6ea7f'::uuid, '6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'post_wash_leave_in'::text, NULL::jsonb, 'damp_leave_on'::text, NULL::text, 'lengths_ends'::text, NULL::integer, 'leave_in'::text, 'not_stated'::text, $json$[]$json$::jsonb, 'Kevin Murphy Produktseite'::text, 'https://kevinmurphy.com.au/th/en/products/by-benefit/rejuvenate/YOUNG-AGAIN.html'::text, 'Use as a leave-in treatment before styling for moisture and shine.'::text, $json${"role":"leave_in","scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"steps":[{"action":"apply_product","stepKey":"dose-kevin-murphy-young-again","copyTemplateDe":"Eine kleine Menge in den Handflächen verteilen."},{"action":"apply_product","stepKey":"apply-kevin-murphy-young-again","copyTemplateDe":"In Längen und Spitzen einarbeiten und danach wie gewünscht stylen."}],"locale":"de","evidence":[{"checkedAt":"2026-08-11","sourceUrl":"https://kevinmurphy.com.au/th/en/products/by-benefit/rejuvenate/YOUNG-AGAIN.html","sourceType":"manufacturer"}],"sequence":{"after":["post_cleanse_rinse_off"],"anchor":"damp_leave_on","before":[],"conflictsWith":[]},"guidanceKey":"product-leave-in-6ad82861-d68e-4e70-a976-78c0f35d087b-post-wash","requirements":{"requiredCatalogFacts":["leave_in.plan_roles"],"requiredProfileFacts":[],"requiredProtocolFacts":[]},"protocolFacts":{"rinse":"leave_in","amount":{"kind":"qualitative","copyDe":"Mit einer kleinen Menge starten."},"cautions":[],"reapplication":"none","applicationArea":"lengths_ends","contactTimeSeconds":null,"conditionerRelationship":"not_applicable"},"schemaVersion":1,"protocolVersion":1,"applicationFamily":"post_wash_damp_conditioning","compatibleDayTypes":["wash_day","intensive_care_day","styling_day"],"exactGuidanceRequired":true}$json$::jsonb, $json${"role":"leave_in","facts":{"heat":null,"rinse":"leave_in","amount":null,"contactTime":null,"applicationArea":"hair_lengths_ends","applicationState":"damp_hair","conditionerPolicy":"not_applicable"},"scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"evidence":[{"checkedAt":"2026-08-11","sourceUrl":"https://kevinmurphy.com.au/th/en/products/by-benefit/rejuvenate/YOUNG-AGAIN.html","sourceType":"manufacturer"}],"exactSteps":[],"sourceRole":"post_wash_leave_in","workflowId":null,"cautionCodes":[],"contractKind":"product_pointer","schemaVersion":2,"applicationFamily":"post_wash_damp_conditioning","runtimeBlockerCode":null,"requiredCompanionProductId":null}$json$::jsonb, '2026-08-12T07:43:26.372624+00:00'::timestamptz, '2026-08-13T06:58:13.851968+00:00'::timestamptz);
  INSERT INTO public.product_application_protocols (id, product_id, category, role, cadence, application_stage, application_state, placement, contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label, source_url, source_text, guidance_payload, guidance_payload_v2, created_at, updated_at)
  VALUES ('f013b935-cf01-4e48-b817-0eae91ec8390'::uuid, '6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'post_wash_leave_in'::text, NULL::jsonb, 'dry_hair'::text, 'dry'::text, 'lengths_ends'::text, NULL::integer, 'do_not_rinse'::text, 'not_stated'::text, $json$[]$json$::jsonb, 'Hersteller'::text, 'https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html'::text, 'Auf feuchtem oder trockenem Haar und zwischen Haarwäschen anwenden.'::text, $json${"role":"leave_in","scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"steps":[{"action":"apply_product","stepKey":"dry-care","copyTemplateDe":"Mit einer sehr kleinen Menge in trockenen Längen und Spitzen beginnen und nur bei Bedarf ergänzen."}],"locale":"de","evidence":[{"checkedAt":"2026-08-14","sourceUrl":"https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html","sourceType":"manufacturer"}],"sequence":{"after":[],"anchor":"dry_finish","before":[],"conflictsWith":[]},"guidanceKey":"leave-in-use-case-2026-08-14-6ad82861-d68e-4e70-a976-78c0f35d087b-between_wash_dry_care","requirements":{"requiredCatalogFacts":[],"requiredProfileFacts":[],"requiredProtocolFacts":[]},"protocolFacts":{"rinse":"leave_in","amount":null,"cautions":[],"reapplication":"none","applicationArea":"lengths_ends","contactTimeSeconds":null,"conditionerRelationship":"not_applicable"},"schemaVersion":1,"protocolVersion":1,"applicationFamily":"between_wash_dry_care","compatibleDayTypes":["refresh_day","between_wash_care_day"],"exactGuidanceRequired":true}$json$::jsonb, $json${"role":"leave_in","facts":{"heat":null,"rinse":"leave_in","amount":null,"contactTime":null,"applicationArea":"hair_lengths_ends","applicationState":"dry_hair","conditionerPolicy":"not_applicable"},"scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"evidence":[{"checkedAt":"2026-08-14","sourceUrl":"https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html","sourceType":"manufacturer"}],"exactSteps":[],"sourceRole":"post_wash_leave_in","workflowId":null,"cautionCodes":[],"contractKind":"product_pointer","schemaVersion":2,"applicationFamily":"between_wash_dry_care","runtimeBlockerCode":null,"requiredCompanionProductId":null}$json$::jsonb, '2026-08-14T15:13:15.562182+00:00'::timestamptz, '2026-08-14T15:13:15.562182+00:00'::timestamptz);
  INSERT INTO public.product_application_protocols (id, product_id, category, role, cadence, application_stage, application_state, placement, contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label, source_url, source_text, guidance_payload, guidance_payload_v2, created_at, updated_at)
  VALUES ('40edd227-6ae7-4ab4-b5a5-fe243cfc3a9e'::uuid, '6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'post_wash_leave_in'::text, NULL::jsonb, 'post_style'::text, 'dry'::text, 'lengths_ends'::text, NULL::integer, 'do_not_rinse'::text, 'not_stated'::text, $json$[]$json$::jsonb, 'Hersteller'::text, 'https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html'::text, 'Auf trockenem Haar als Finish anwenden.'::text, $json${"role":"leave_in","scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"steps":[{"action":"apply_product","stepKey":"post-style-finish","copyTemplateDe":"Mit einer sehr kleinen Menge beginnen und nach dem Styling sparsam über Längen und Spitzen geben."}],"locale":"de","evidence":[{"checkedAt":"2026-08-14","sourceUrl":"https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html","sourceType":"manufacturer"}],"sequence":{"after":[],"anchor":"dry_finish","before":[],"conflictsWith":[]},"guidanceKey":"leave-in-use-case-2026-08-14-6ad82861-d68e-4e70-a976-78c0f35d087b-post_style_finish","requirements":{"requiredCatalogFacts":[],"requiredProfileFacts":[],"requiredProtocolFacts":[]},"protocolFacts":{"rinse":"leave_in","amount":null,"cautions":[],"reapplication":"none","applicationArea":"lengths_ends","contactTimeSeconds":null,"conditionerRelationship":"not_applicable"},"schemaVersion":1,"protocolVersion":1,"applicationFamily":"post_style_finish","compatibleDayTypes":["styling_day"],"exactGuidanceRequired":true}$json$::jsonb, $json${"role":"leave_in","facts":{"heat":null,"rinse":"leave_in","amount":null,"contactTime":null,"applicationArea":"hair_lengths_ends","applicationState":"dry_hair","conditionerPolicy":"not_applicable"},"scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"evidence":[{"checkedAt":"2026-08-14","sourceUrl":"https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html","sourceType":"manufacturer"}],"exactSteps":[],"sourceRole":"post_wash_leave_in","workflowId":null,"cautionCodes":[],"contractKind":"product_pointer","schemaVersion":2,"applicationFamily":"post_style_finish","runtimeBlockerCode":null,"requiredCompanionProductId":null}$json$::jsonb, '2026-08-14T15:13:15.562182+00:00'::timestamptz, '2026-08-14T15:13:15.562182+00:00'::timestamptz);
  INSERT INTO public.product_application_protocols (id, product_id, category, role, cadence, application_stage, application_state, placement, contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label, source_url, source_text, guidance_payload, guidance_payload_v2, created_at, updated_at)
  VALUES ('4a4e0bd1-2140-492b-b4f7-e0fe33f46850'::uuid, '6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in'::text, 'pre_heat_protection'::text, NULL::jsonb, 'pre_heat'::text, 'either'::text, 'all_hair'::text, NULL::integer, 'do_not_rinse'::text, 'not_stated'::text, $json$[]$json$::jsonb, 'Hersteller'::text, 'https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html'::text, 'Vor Luft- oder Hitzestyling auf feuchtem oder trockenem Haar anwenden.'::text, $json${"role":"heat_protection","scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"steps":[{"action":"apply_product","stepKey":"apply","copyTemplateDe":"Gleichmäßig auf dem vom Hersteller genannten Haarzustand verteilen. Erst danach föhnen oder stylen."}],"locale":"de","evidence":[{"checkedAt":"2026-08-14","sourceUrl":"https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html","sourceType":"manufacturer"}],"sequence":{"after":[],"anchor":"damp_leave_on","before":[],"conflictsWith":[]},"guidanceKey":"leave-in-use-case-2026-08-14-6ad82861-d68e-4e70-a976-78c0f35d087b-either_state_protection","requirements":{"requiredCatalogFacts":[],"requiredProfileFacts":["heatEvents"],"requiredProtocolFacts":[]},"protocolFacts":{"rinse":"leave_in","amount":null,"cautions":[],"reapplication":"none","applicationArea":"all_hair","contactTimeSeconds":null,"conditionerRelationship":"not_applicable"},"schemaVersion":1,"protocolVersion":1,"applicationFamily":"either_state_protection","compatibleDayTypes":["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day","refresh_day","between_wash_care_day","styling_day"],"exactGuidanceRequired":true}$json$::jsonb, $json${"role":"heat_protection","facts":{"heat":{"reapplication":"none","supportedStates":["damp_hair","dry_hair"],"activationRequired":false,"maximumClaimedTemperatureC":null},"rinse":"leave_in","amount":null,"contactTime":null,"applicationArea":"root_to_tip_hair","applicationState":"damp_or_dry_hair","conditionerPolicy":"not_applicable"},"scope":{"kind":"product","category":"leave_in","productId":"6ad82861-d68e-4e70-a976-78c0f35d087b"},"evidence":[{"checkedAt":"2026-08-14","sourceUrl":"https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html","sourceType":"manufacturer"}],"exactSteps":[],"sourceRole":"pre_heat_protection","workflowId":null,"cautionCodes":[],"contractKind":"product_pointer","schemaVersion":2,"applicationFamily":"either_state_protection","runtimeBlockerCode":null,"requiredCompanionProductId":null}$json$::jsonb, '2026-08-14T15:13:15.562182+00:00'::timestamptz, '2026-08-14T15:13:15.562182+00:00'::timestamptz);
  INSERT INTO public.personal_plan_catalog_fact_evidence (product_id, fact_key, fact_value, source_label, source_url, source_text, source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint, created_at)
  VALUES ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'leave_in.authority_facts'::text, $json${"plan_roles":["post_wash_leave_in"],"care_direction":"balanced","functional_benefits":["moisture_softness","repair_support","shine_support","smooth_anti_frizz"],"repair_support_level":"medium"}$json$::jsonb, 'Kevin Murphy Produktseite'::text, 'https://kevinmurphy.com.au/th/en/products/by-benefit/rejuvenate/YOUNG-AGAIN.html'::text, 'Weightless leave-in oil; supports softness, nourishment, protection, shine and stronger-feeling hair.'::text, 'manufacturer'::text, '2026-08-11'::date, 'S5-15-leave-in-exact-02'::text, 'c37af5e2935e39b74216422683730000e97d4cebb4aa1264f15c546245408492'::text, '8e6f7dfbabb63fe395d0feb24f2efd9285f3623f326cf7ef4921f70398e94693'::text, '2026-08-12T07:43:26.372624+00:00'::timestamptz);
END;
$rollback$;

SET CONSTRAINTS ALL IMMEDIATE;

DO $rollback_verify$
BEGIN
  PERFORM public.assert_personal_plan_curated_publication('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid);
  IF (SELECT count(*) FROM public.product_application_protocols WHERE product_id = '6ad82861-d68e-4e70-a976-78c0f35d087b' AND category = 'leave_in') <> 4
     OR (SELECT count(*) FROM public.product_leave_in_eligibility WHERE product_id = '6ad82861-d68e-4e70-a976-78c0f35d087b') <> 4
     OR NOT EXISTS (SELECT 1 FROM public.product_leave_in_specs WHERE product_id = '6ad82861-d68e-4e70-a976-78c0f35d087b')
     OR EXISTS (SELECT 1 FROM public.product_oil_specs WHERE product_id = '6ad82861-d68e-4e70-a976-78c0f35d087b') THEN
    RAISE EXCEPTION 'rollback verification failed';
  END IF;
END;
$rollback_verify$;

COMMIT;
