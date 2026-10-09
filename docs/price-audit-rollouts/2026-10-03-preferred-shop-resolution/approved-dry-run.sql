-- Nick approved preferred purchasable sources with flexible exact-product package/price on3October2026.
-- Only freshly reverified approved rows are included; held rows remain excluded.
-- Strict full-row and complete identifier guards. No schema or identifier writes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $approved_price_corrections$
DECLARE
  v_dry_run constant boolean := true;
  v_payload constant jsonb := $approved_offers_json$[{"id":"bc6ab308-7b6e-4d72-92aa-313a43c9c77d","before_product_fingerprint":"edbbbe2835c6882443d11d3d817e40ac","before_identifier_fingerprint":"0d810fa097a077d655246e3176a73dfc","proposed":{"price_eur":9.95,"price_checked_at":"2026-10-03T14:25:22.708501+00:00","affiliate_link":"https://neqi-hair.com/products/treatment-treasure-build-boost?variant=49565683122522","net_content_value":100,"net_content_unit":"ml"}},{"id":"78e6f1b2-7262-46af-b689-a92af6702739","before_product_fingerprint":"408b0f1654be54752d26757d6b665ffd","before_identifier_fingerprint":"8b5c8223a5531de1155c571d69a92e61","proposed":{"price_eur":24.99,"price_checked_at":"2026-10-03T14:25:22.728884+00:00","affiliate_link":"https://www.nutreeoil.com/products/nutreeoil-cacay-ol-30ml?variant=39805169467440","net_content_value":15,"net_content_unit":"ml"}}]$approved_offers_json$::jsonb;
  v_expected_count constant integer := 2;
  v_item jsonb;
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_identifiers jsonb;
  v_after_identifiers jsonb;
  v_allowed text[];
  v_updated integer := 0;
  v_result jsonb;
BEGIN
  IF jsonb_array_length(v_payload)<>v_expected_count OR v_expected_count=0
     OR (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(v_payload) AS item)<>v_expected_count THEN
    RAISE EXCEPTION 'Approved offer payload is empty, duplicated, or incomplete';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply',0));
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
      SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb)
        INTO v_after_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id;
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
    v_result:=jsonb_build_object('mode',CASE WHEN v_dry_run THEN 'rolled_back_dry_run' ELSE 'apply' END,
        'rows_verified',v_updated,'committed_product_writes',CASE WHEN v_dry_run THEN 0 ELSE v_updated END,
        'identifier_writes',0,'noncommercial_changes',0,'checked_at',clock_timestamp());
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
