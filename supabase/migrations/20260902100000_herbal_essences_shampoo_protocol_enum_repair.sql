-- Herbal Essences shampoo protocol enum repair fingerprint: cba6ffa29cd67cdffec51cd464677fba9c650a7dbc2a307a0bc5bfc6c2a60a27
--
-- One bounded, replay-safe correction for one exact protocol row. The
-- Herbal Essences Tiefenreinigung & Glanz Limettenduft shampoo_everyday
-- protocol landed with German prose in the three indexed enum-code columns
-- (application_stage 'Haarwäsche', placement 'Haar', rinse_action 'Ausspülen')
-- while both canonical guidance payloads were already correct. This rewrites
-- only those three indexed columns to the codes every comparable
-- shampoo_everyday row uses and that the row's own guidance_payload already
-- encodes (protocolFacts.applicationArea 'all_hair', rinse 'rinse_out',
-- sequence anchor wet cleanse). It writes nothing else.
BEGIN;

DO $herbal_essences_shampoo_protocol_enum_repair$
DECLARE
  v_protocol_id constant uuid := '224bee35-2815-42d9-9f9f-b03d89947d88';
  v_product_id constant uuid := '41b99629-5a1c-402f-a486-d41780e89e66';
  v_batch_id constant text := 'S5R-05-herbal-essences-protocol-enum-repair';
  v_fingerprint constant text := 'cba6ffa29cd67cdffec51cd464677fba9c650a7dbc2a307a0bc5bfc6c2a60a27';
  v_receipt public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  SELECT * INTO v_receipt
  FROM public.catalog_enrichment_applied_items
  WHERE batch_id = v_batch_id
    AND product_key = 'protocol-enum-repair:' || v_protocol_id::text;

  IF FOUND THEN
    IF v_receipt.batch_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_receipt.content_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_receipt.product_id IS DISTINCT FROM v_product_id
       OR v_receipt.reviewed_by IS DISTINCT FROM 'nick'
       OR NOT EXISTS (
         SELECT 1
         FROM public.product_application_protocols
         WHERE id = v_protocol_id
           AND product_id = v_product_id
           AND category = 'shampoo'
           AND role = 'shampoo_everyday'
           AND application_stage = 'wet_cleanse'
           AND placement = 'all_hair'
           AND rinse_action = 'rinse_out'
       ) THEN
      RAISE EXCEPTION 'Herbal Essences protocol enum repair receipt conflicts with current state';
    END IF;
  ELSE
    -- Fresh or preview databases never contain this user-submitted product;
    -- there is nothing to repair there, so the correction is a clean no-op.
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.product_application_protocols WHERE id = v_protocol_id
       ) THEN
      RETURN;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.products
      WHERE id = v_product_id
        AND brand = 'Herbal Essences'
        AND name = 'Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft'
        AND category_key = 'shampoo'
        AND is_active = true
        AND lifecycle_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Herbal Essences protocol enum repair product identity preimage changed';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.product_application_protocols
      WHERE id = v_protocol_id
        AND product_id = v_product_id
        AND category = 'shampoo'
        AND role = 'shampoo_everyday'
        AND application_family = 'standard_rinse_out_cleanse'
        AND application_stage = 'Haarwäsche'
        AND placement = 'Haar'
        AND rinse_action = 'Ausspülen'
        AND application_state IS NULL
        AND contact_time_seconds IS NULL
        AND reapplication = 'not_stated'
        AND guidance_payload#>>'{schemaVersion}' = '1'
        AND guidance_payload#>>'{scope,productId}' = v_product_id::text
        AND guidance_payload#>>'{scope,category}' = 'shampoo'
        AND guidance_payload#>>'{guidanceKey}' = 'herbal-essences-tiefenreinigung-glanz-limettenduft-shampoo-everyday'
        AND guidance_payload#>>'{applicationFamily}' = 'standard_rinse_out_cleanse'
        AND guidance_payload#>>'{protocolFacts,rinse}' = 'rinse_out'
        AND guidance_payload#>>'{protocolFacts,applicationArea}' = 'all_hair'
        AND guidance_payload_v2#>>'{contractKind}' = 'product_pointer'
        AND guidance_payload_v2#>>'{scope,productId}' = v_product_id::text
        AND guidance_payload_v2#>>'{facts,rinse}' = 'rinse_out'
        AND guidance_payload_v2#>>'{facts,applicationArea}' = 'scalp_roots'
        AND guidance_payload_v2#>'{runtimeBlockerCode}' = 'null'::jsonb
    ) THEN
      RAISE EXCEPTION 'Herbal Essences protocol enum repair protocol preimage changed';
    END IF;

    -- Repeat the mutable preimage predicates so a concurrent write between the
    -- guard and this statement fails the repair instead of being overwritten.
    UPDATE public.product_application_protocols
    SET application_stage = 'wet_cleanse',
        placement = 'all_hair',
        rinse_action = 'rinse_out'
    WHERE id = v_protocol_id
      AND product_id = v_product_id
      AND category = 'shampoo'
      AND role = 'shampoo_everyday'
      AND application_stage = 'Haarwäsche'
      AND placement = 'Haar'
      AND rinse_action = 'Ausspülen';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Herbal Essences protocol enum repair preimage drifted during apply';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.product_application_protocols
      WHERE id = v_protocol_id
        AND product_id = v_product_id
        AND category = 'shampoo'
        AND role = 'shampoo_everyday'
        AND application_family = 'standard_rinse_out_cleanse'
        AND application_stage = 'wet_cleanse'
        AND placement = 'all_hair'
        AND rinse_action = 'rinse_out'
        AND guidance_payload#>>'{protocolFacts,applicationArea}' = 'all_hair'
    ) THEN
      RAISE EXCEPTION 'Herbal Essences protocol enum repair target is incomplete';
    END IF;

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      v_batch_id, 'protocol-enum-repair:' || v_protocol_id::text, v_fingerprint, v_fingerprint,
      v_product_id, 'nick'
    );
  END IF;
END;
$herbal_essences_shampoo_protocol_enum_repair$;

COMMIT;
