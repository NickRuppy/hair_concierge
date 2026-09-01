-- Reconcile the one non-null V2 pointer superseded by the approved Oil
-- authority repair. The other 17 repaired Oil protocols have null V2 pointers
-- and remain owned by the regular Stage 5 V2 artifact executor.
DO $reconcile_garnier_oil_v2$
DECLARE
  v_product_id constant uuid := 'c574ee6f-ad22-45c0-b936-57b847d93433'::uuid;
  v_expected_source_url constant text := 'https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum';
  v_expected_v1 constant jsonb := $json${"schemaVersion":1,"guidanceKey":"product-oil-c574ee6f-ad22-45c0-b936-57b847d93433-heat","protocolVersion":1,"locale":"de","scope":{"kind":"product","category":"oil","productId":"c574ee6f-ad22-45c0-b936-57b847d93433"},"role":"heat_protection","applicationFamily":"pre_heat_damp","compatibleDayTypes":["styling_day"],"exactGuidanceRequired":true,"sequence":{"anchor":"damp_leave_on","before":["heat_tool"],"after":["post_rinse_towel_dry"],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":["oil.v2.weight","oil.v2.role_support"],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"lengths_ends","rinse":"leave_in","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"each_separate_heat_event","amount":{"kind":"qualitative","copyDe":"Einen Pumpstoß verwenden."},"cautions":[]},"steps":[{"stepKey":"dose-garnier-heat","action":"apply_product","copyTemplateDe":"Einen Pumpstoß gleichmäßig in die feuchten Längen und Spitzen geben."},{"stepKey":"tool-garnier-heat","action":"tool","copyTemplateDe":"Nicht ausspülen; anschließend föhnen oder glätten."}],"evidence":[{"sourceUrl":"https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum","sourceType":"manufacturer","checkedAt":"2026-09-01"}]}$json$::jsonb;
  v_expected_old_v2 constant jsonb := $json${"schemaVersion":2,"contractKind":"product_pointer","scope":{"kind":"product","category":"oil","productId":"c574ee6f-ad22-45c0-b936-57b847d93433"},"sourceRole":"pre_heat_protection","role":"heat_protection","applicationFamily":"pre_heat_damp","facts":{"applicationState":"damp_hair","applicationArea":"hair_lengths_ends","rinse":"leave_in","contactTime":null,"amount":null,"heat":{"supportedStates":["damp_hair"],"activationRequired":false,"maximumClaimedTemperatureC":230,"reapplication":"each_separate_heat_event"},"conditionerPolicy":"not_applicable"},"workflowId":null,"requiredCompanionProductId":null,"runtimeBlockerCode":null,"exactSteps":[],"cautionCodes":[],"evidence":[{"sourceUrl":"https://www.garnierusa.com/about-our-brands/fructis/sleek-and-shine/sleek-and-shine-sleek-and-stay","sourceType":"manufacturer","checkedAt":"2026-08-11"},{"sourceUrl":"https://www.garnier.com.au/about-our-brands/fructis/sleek-and-shine/sleek-and-shine-sleek-and-stay","sourceType":"manufacturer","checkedAt":"2026-08-11"}]}$json$::jsonb;
  v_expected_new_v2 constant jsonb := $json${"schemaVersion":2,"contractKind":"product_pointer","scope":{"kind":"product","category":"oil","productId":"c574ee6f-ad22-45c0-b936-57b847d93433"},"sourceRole":"pre_heat_protection","role":"heat_protection","applicationFamily":"pre_heat_damp","facts":{"applicationState":"damp_hair","applicationArea":"hair_lengths_ends","rinse":"leave_in","contactTime":null,"amount":null,"heat":{"supportedStates":["damp_hair"],"activationRequired":false,"maximumClaimedTemperatureC":null,"reapplication":"each_separate_heat_event"},"conditionerPolicy":"not_applicable"},"workflowId":null,"requiredCompanionProductId":null,"runtimeBlockerCode":null,"exactSteps":[],"cautionCodes":[],"evidence":[{"sourceUrl":"https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum","sourceType":"manufacturer","checkedAt":"2026-09-01"}]}$json$::jsonb;
  v_protocol public.product_application_protocols%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-stage5-v2-oil-authority-reconciliation', 0)
  );

  SELECT protocol.* INTO v_protocol
  FROM public.product_application_protocols protocol
  WHERE protocol.product_id = v_product_id
    AND protocol.category = 'oil'
    AND protocol.role = 'pre_heat_protection'
    AND protocol.application_family = 'pre_heat_damp'
  FOR UPDATE;
  IF NOT FOUND THEN
    -- A fresh install has neither the repaired Oil protocol nor its authority
    -- receipt, so there is no legacy V2 pointer to reconcile. Once the repair
    -- receipt exists, however, a missing target is authoritative drift.
    IF EXISTS (
      SELECT 1
      FROM public.catalog_enrichment_applied_items AS applied
      WHERE applied.batch_id = 'OIL-20260901-authority-enrichment-v1'
        AND applied.product_key = 'oil-authority:' || v_product_id::text
    ) THEN
      RAISE EXCEPTION 'Garnier Oil V2 reconciliation requires exact approved V1 authority';
    END IF;
    RETURN;
  END IF;
  IF v_protocol.source_url IS DISTINCT FROM v_expected_source_url
     OR v_protocol.guidance_payload IS DISTINCT FROM v_expected_v1 THEN
    RAISE EXCEPTION 'Garnier Oil V2 reconciliation requires exact approved V1 authority';
  END IF;

  IF v_protocol.guidance_payload_v2 IS DISTINCT FROM v_expected_new_v2 THEN
    IF v_protocol.guidance_payload_v2 IS DISTINCT FROM v_expected_old_v2 THEN
      RAISE EXCEPTION 'Garnier Oil V2 reconciliation conflicts with current pointer';
    END IF;
    UPDATE public.product_application_protocols protocol
    SET guidance_payload_v2 = v_expected_new_v2,
        updated_at = pg_catalog.clock_timestamp()
    WHERE protocol.product_id = v_product_id
      AND protocol.category = 'oil'
      AND protocol.role = 'pre_heat_protection'
      AND protocol.application_family = 'pre_heat_damp'
      AND protocol.source_url IS NOT DISTINCT FROM v_expected_source_url
      AND protocol.guidance_payload IS NOT DISTINCT FROM v_expected_v1
      AND protocol.guidance_payload_v2 IS NOT DISTINCT FROM v_expected_old_v2;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Garnier Oil V2 authority changed during reconciliation';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_application_protocols protocol
    WHERE protocol.product_id = v_product_id
      AND protocol.category = 'oil'
      AND protocol.role = 'pre_heat_protection'
      AND protocol.application_family = 'pre_heat_damp'
      AND protocol.source_url IS NOT DISTINCT FROM v_expected_source_url
      AND protocol.guidance_payload IS NOT DISTINCT FROM v_expected_v1
      AND protocol.guidance_payload_v2 IS NOT DISTINCT FROM v_expected_new_v2
  ) THEN
    RAISE EXCEPTION 'Garnier Oil V2 reconciliation verification failed';
  END IF;
END;
$reconcile_garnier_oil_v2$;
