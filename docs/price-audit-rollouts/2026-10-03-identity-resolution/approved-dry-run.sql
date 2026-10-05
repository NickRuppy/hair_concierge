-- Nick approved continuation of the current catalog pricing pass on3October2026.
-- Only exact recovered commerce and three evidenced recognition aliases; other rows excluded.
-- Strict full-row and complete identifier guards; no schema/formula/category/lifecycle writes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $approved_price_corrections$
DECLARE
  v_dry_run constant boolean := true;
  v_payload constant jsonb := $approved_offers_json$[{"id":"27fe4310-c1b8-4b02-a59e-cb9aa1f3314a","before_product_fingerprint":"cc5d7a6280aaee692cfc070e6f574bcb","before_identifier_fingerprint":"eeb4c651b2ca968f2619f94e5a644c43","proposed":{"price_eur":1.45,"price_checked_at":"2026-10-03T13:47:19.545Z","affiliate_link":"https://www.dm.de/p/d/2974661/balea-trockenshampoo-schaum-kopfhaut-sensitive","net_content_value":150,"net_content_unit":"ml"},"add_identifier":{"type":"ean","value":"4066447989540","canonical_gtin14":"04066447989540","source":"price-audit-approved-2026-10-03-identity"}},{"id":"a6730d6f-df2f-4ebf-8013-eb39162f15df","before_product_fingerprint":"6c163aef0cae1c20db6c33d8532b4e33","before_identifier_fingerprint":"8314a38a3fc7964fd56df1e7f277980f","proposed":{"price_eur":1.25,"price_checked_at":"2026-10-03T13:47:21.503Z","affiliate_link":"https://www.dm.de/p/d/1675522/balea-professional-conditioner-aqua-hyaluron","net_content_value":200,"net_content_unit":"ml"},"add_identifier":{"type":"ean","value":"4070765001662","canonical_gtin14":"04070765001662","source":"price-audit-approved-2026-10-03-identity"}},{"id":"3d94c017-9edb-4ba0-accd-4772e262f012","before_product_fingerprint":"cc81194fb70deea86b901e001e1ecaeb","before_identifier_fingerprint":"ae549fdf0bf6c0e68cbdbeff54a3b86f","proposed":{"price_eur":5.45,"price_checked_at":"2026-10-03T13:47:23.673Z","affiliate_link":"https://www.dm.de/p/d/3133400/lavera-naturkosmetik-shampoo-basis-sensitive-hydrate-und-care","net_content_value":250,"net_content_unit":"ml"},"add_identifier":null},{"id":"e5cfad78-ea22-49a5-911a-cb1f3109fa1c","before_product_fingerprint":"be22d6709e5ed50009013207d48252bb","before_identifier_fingerprint":"921ed1e758f33c0e6810d4418e1e5d22","proposed":{"price_eur":7.99,"price_checked_at":"2026-10-03T13:48:16.042418+00:00","affiliate_link":"https://www.jeanlen.de/haarmaske-feuchtigkeit-rosemary-ginger","net_content_value":200,"net_content_unit":"ml"},"add_identifier":{"type":"ean","value":"4262401735639","canonical_gtin14":"04262401735639","source":"price-audit-approved-2026-10-03-identity"}},{"id":"38886b62-2c45-4b34-9a24-7d831e97946e","before_product_fingerprint":"cf323a52e5f366ab0316c5f2b2c7f772","before_identifier_fingerprint":"11b6b9bc93a7472c50df819b5363092e","proposed":{"price_eur":12.37,"price_checked_at":"2026-10-03T14:03:38Z","affiliate_link":"https://www.moriveda.com/product-page/moringa-oel-premium-schonendgepresst-100ml","net_content_value":100,"net_content_unit":"ml"},"add_identifier":null}]$approved_offers_json$::jsonb;
  v_expected_count constant integer := 5;
  v_item jsonb;
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_identifiers jsonb;
  v_after_identifiers jsonb;
  v_allowed text[];
  v_updated integer := 0;
  v_alias_count integer := 0;
  v_new_identifier_id uuid;
  v_canonical text;
  v_result jsonb;
BEGIN
  IF jsonb_array_length(v_payload)<>v_expected_count OR v_expected_count=0
     OR (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(v_payload) AS item)<>v_expected_count THEN
    RAISE EXCEPTION 'Approved offer payload is empty, duplicated, or incomplete';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply',0));
  -- Lock approved canonical identities using the same advisory key as intake.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) WHERE value->'add_identifier'<>'null'::jsonb ORDER BY value->'add_identifier'->>'canonical_gtin14' LOOP
    v_canonical:=public.product_identifier_canonical_gtin14(v_item->'add_identifier'->>'type',v_item->'add_identifier'->>'value');
    IF v_canonical IS NULL OR v_canonical IS DISTINCT FROM v_item->'add_identifier'->>'canonical_gtin14' THEN RAISE EXCEPTION 'Invalid approved GTIN'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('product-identifier:canonical-gtin14:'||v_canonical,0));
    IF EXISTS(SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14=v_canonical) THEN RAISE EXCEPTION 'Approved barcode already owned'; END IF;
  END LOOP;
  -- Lock target product rows in stable order. Their immediate FK prevents a
  -- concurrent new recognition-identifier insert; existing identifiers lock below.
  PERFORM 1 FROM public.products p
    WHERE p.id IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(v_payload) AS item)
    ORDER BY p.id FOR UPDATE;
  IF (SELECT count(*) FROM public.products p
      WHERE p.id IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(v_payload) AS item))<>v_expected_count THEN
    RAISE EXCEPTION 'An approved product no longer exists';
  END IF;
  PERFORM 1 FROM public.product_identifiers i
    WHERE i.product_id IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(v_payload) AS item)
    ORDER BY i.id FOR SHARE;
  -- Validate every expected-before guard before the first update.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
    SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
    SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
      INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id;
    IF md5(to_jsonb(v_before)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint'
       OR md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN
      RAISE EXCEPTION 'Approved baseline changed for product %',v_before.id;
    END IF;
    IF v_item->'add_identifier'<>'null'::jsonb AND (v_item->'add_identifier'->>'type'<>'ean' OR v_item->'add_identifier'->>'source'<>'price-audit-approved-2026-10-03-identity' OR NOT((v_before.id='27fe4310-c1b8-4b02-a59e-cb9aa1f3314a'::uuid AND v_item->'add_identifier'->>'value'='4066447989540') OR (v_before.id='a6730d6f-df2f-4ebf-8013-eb39162f15df'::uuid AND v_item->'add_identifier'->>'value'='4070765001662') OR (v_before.id='e5cfad78-ea22-49a5-911a-cb1f3109fa1c'::uuid AND v_item->'add_identifier'->>'value'='4262401735639'))) THEN RAISE EXCEPTION 'Unapproved recognition alias'; END IF;
    SELECT array_agg(key ORDER BY key) INTO v_allowed FROM jsonb_object_keys(v_item->'proposed') AS key;
    IF NOT (v_allowed<@ARRAY['price_eur','price_checked_at','affiliate_link','net_content_value','net_content_unit']::text[])
       OR NOT (ARRAY['price_eur','price_checked_at']::text[]<@v_allowed)
       OR (v_item->'proposed'->>'price_eur')::numeric<=0
       OR (v_item->'proposed'->>'price_checked_at')::timestamptz IS NULL
       OR NOT v_before.is_active OR v_before.currency IS DISTINCT FROM 'EUR'
       OR (v_item->'proposed' ? 'net_content_value')<>(v_item->'proposed' ? 'net_content_unit') THEN
      RAISE EXCEPTION 'Invalid approved fields for product %',v_before.id;
    END IF;
    IF v_item->'proposed' ? 'net_content_value' THEN
      IF v_before.net_content_value IS NOT NULL OR v_before.net_content_unit IS NOT NULL
         OR (v_item->'proposed'->>'net_content_value')::numeric<=0
         OR (v_item->'proposed'->>'net_content_unit') NOT IN ('ml','g','l') THEN
        RAISE EXCEPTION 'Approved package fill would overwrite a known package for %',v_before.id;
      END IF;
    END IF;
  END LOOP;
  BEGIN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
      SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
      SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
        INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id;
      SELECT array_agg(key ORDER BY key) INTO v_allowed FROM jsonb_object_keys(v_item->'proposed') AS key;
      UPDATE public.products p SET
        price_eur=(v_item->'proposed'->>'price_eur')::numeric,
        price_checked_at=(v_item->'proposed'->>'price_checked_at')::timestamptz,
        affiliate_link=CASE WHEN v_item->'proposed' ? 'affiliate_link' THEN v_item->'proposed'->>'affiliate_link' ELSE p.affiliate_link END,
        net_content_value=CASE WHEN v_item->'proposed' ? 'net_content_value' THEN (v_item->'proposed'->>'net_content_value')::numeric ELSE p.net_content_value END,
        net_content_unit=CASE WHEN v_item->'proposed' ? 'net_content_unit' THEN v_item->'proposed'->>'net_content_unit' ELSE p.net_content_unit END
        WHERE p.id=v_before.id RETURNING * INTO STRICT v_after;
      v_new_identifier_id:=NULL;
      IF v_item->'add_identifier'<>'null'::jsonb THEN
        INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source)
        VALUES(v_before.id,v_item->'add_identifier'->>'type',v_item->'add_identifier'->>'value',v_item->'add_identifier'->>'source') RETURNING id INTO STRICT v_new_identifier_id;
        IF NOT EXISTS(SELECT 1 FROM public.product_identifiers WHERE id=v_new_identifier_id AND product_id=v_before.id
          AND identifier_type='ean' AND identifier_value=v_item->'add_identifier'->>'value'
          AND canonical_gtin14=v_item->'add_identifier'->>'canonical_gtin14' AND source=v_item->'add_identifier'->>'source') THEN RAISE EXCEPTION 'Barcode persistence mismatch'; END IF;
        v_alias_count:=v_alias_count+1;
      END IF;
      SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
        INTO v_after_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id AND (v_new_identifier_id IS NULL OR i.id<>v_new_identifier_id);
      IF v_after.price_eur IS DISTINCT FROM (v_item->'proposed'->>'price_eur')::numeric
         OR v_after.price_checked_at IS DISTINCT FROM (v_item->'proposed'->>'price_checked_at')::timestamptz
         OR (v_item->'proposed' ? 'affiliate_link' AND v_after.affiliate_link IS DISTINCT FROM v_item->'proposed'->>'affiliate_link')
         OR (v_item->'proposed' ? 'net_content_value' AND v_after.net_content_value IS DISTINCT FROM (v_item->'proposed'->>'net_content_value')::numeric)
         OR (v_item->'proposed' ? 'net_content_unit' AND v_after.net_content_unit IS DISTINCT FROM v_item->'proposed'->>'net_content_unit')
         OR (to_jsonb(v_before)-(v_allowed||ARRAY['updated_at'])) IS DISTINCT FROM (to_jsonb(v_after)-(v_allowed||ARRAY['updated_at']))
         OR v_identifiers IS DISTINCT FROM v_after_identifiers THEN
        RAISE EXCEPTION 'Approved write or preservation verification failed for %',v_before.id;
      END IF;
      v_updated:=v_updated+1;
    END LOOP;
    IF v_updated<>v_expected_count THEN RAISE EXCEPTION 'Approved update count mismatch'; END IF;
    IF v_alias_count<>3 THEN RAISE EXCEPTION 'Approved alias count mismatch'; END IF;
    v_result:=jsonb_build_object('mode',CASE WHEN v_dry_run THEN 'rolled_back_dry_run' ELSE 'apply' END,
        'rows_verified',v_updated,'committed_product_writes',CASE WHEN v_dry_run THEN 0 ELSE v_updated END,
        'identifier_writes',CASE WHEN v_dry_run THEN 0 ELSE v_alias_count END,'aliases_exercised',v_alias_count,'noncommercial_changes',0,'checked_at',clock_timestamp());
    IF v_dry_run THEN
      -- Roll back this nested subtransaction after exercising all real UPDATEs
      -- and triggers; the local receipt variable survives the caught rollback.
      RAISE EXCEPTION USING ERRCODE='PAP01',MESSAGE='Intentional approved-price dry-run rollback';
    END IF;
  EXCEPTION WHEN SQLSTATE 'PAP01' THEN
    IF NOT v_dry_run OR v_result IS NULL THEN RAISE; END IF;
  END;
  IF v_dry_run THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) LOOP
      SELECT * INTO STRICT v_after FROM public.products WHERE id=(v_item->>'id')::uuid;
      SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
        INTO v_after_identifiers FROM public.product_identifiers i WHERE i.product_id=v_after.id;
      IF md5(to_jsonb(v_after)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint'
         OR md5(v_after_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN
        RAISE EXCEPTION 'Dry-run rollback verification failed for %',v_after.id;
      END IF;
    END LOOP;
  END IF;
  PERFORM set_config('chaarlie.approved_price_apply_receipt',v_result::text,true);
END
$approved_price_corrections$;
SELECT current_setting('chaarlie.approved_price_apply_receipt')::jsonb AS receipt;
