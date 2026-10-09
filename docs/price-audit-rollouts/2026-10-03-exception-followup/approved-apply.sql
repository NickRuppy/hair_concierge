-- Nick approved the exception recommendations on3October2026:21exact offers.
-- Original292apply is complete and excluded here.34exception rows stay held.
-- Full-row and complete identifier guards;1explicit newWella95mlalias, no schema changes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $approved_price_corrections$
DECLARE
  v_dry_run constant boolean := false;
  v_payload constant jsonb := $approved_offers_json$[{"id":"05e68c32-f096-457f-8b88-5cd3c0934873","before_product_fingerprint":"c804eedf89bc248267e403633ccb3dec","before_identifier_fingerprint":"a83edc6c5cfeb4517d69532e49ce7674","proposed":{"price_eur":3.99,"price_checked_at":"2026-10-03T13:13:44.650312+00:00","affiliate_link":"https://www.jeanlen.de/keratin-haaroel","net_content_value":100,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"29e36443-93ff-4b62-9cf0-55ad9f89f530","before_product_fingerprint":"a82e673441f0c47916455eb2c94d4e47","before_identifier_fingerprint":"ad8c9f2569d920054cfbaf0f52a3d34f","proposed":{"price_eur":6.29,"price_checked_at":"2026-10-03T13:13:44.560893+00:00","affiliate_link":"https://www.greenist.de/biogourmet-bio-disteloel-250ml.html","net_content_value":250,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"315ae9f5-ad1a-4159-b307-2413338c8052","before_product_fingerprint":"7eb2aabecaf5f770fc0c8e2427bd7d2e","before_identifier_fingerprint":"91a399bfd6c0956b075f06d15039277b","proposed":{"price_eur":5.58,"price_checked_at":"2026-10-03T13:13:43.953766+00:00","affiliate_link":"https://www.office-partner.de/herbal-essences-rose-haarmaske-300-ml-n2000020455"},"add_identifier":null,"approved_package_change":false},{"id":"663acf09-7090-40d8-9411-71154b9d60f3","before_product_fingerprint":"ab1b7e022fa64b1ba67faedcf5f4b545","before_identifier_fingerprint":"d450c0b2dce76c5ecf75021b32e50f58","proposed":{"price_eur":14.63,"price_checked_at":"2026-10-03T13:13:45.149103+00:00","affiliate_link":"https://nalda.de/products/4550516493590","net_content_value":70,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"695414e1-3435-4304-943b-76677408980c","before_product_fingerprint":"508c2734200b3f00aad96721e847109b","before_identifier_fingerprint":"ad6b60702fe332eb5d378134e3ef1360","proposed":{"price_eur":32.0,"price_checked_at":"2026-10-03T13:13:43.957451+00:00","affiliate_link":"https://www.cosmeterie.de/maria-nila/structure-repair-leave-in-cream-1","net_content_value":200,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"6dc65df2-2466-43e4-bdc2-3a05803f305c","before_product_fingerprint":"d0f2976389a3f4db654fdde1852f7cbb","before_identifier_fingerprint":"d54e167b7dbc50a71b84bbf48abd8fcf","proposed":{"price_eur":7.95,"price_checked_at":"2026-10-03T13:13:43.221511+00:00","affiliate_link":"https://www.hagel-shop.de/monday-haircare-volume-shampoo-350-ml.html","net_content_value":350,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"9f8da740-87b6-45e0-ab86-d77d63f2e22b","before_product_fingerprint":"c53511f610b8a7a3f0a7173e586ecd83","before_identifier_fingerprint":"3821767d790f0cac83f33eec5fc9a749","proposed":{"price_eur":5.99,"price_checked_at":"2026-10-03T13:13:43.221863+00:00","affiliate_link":"https://m.drogeriedepot.de/neue-produkte/guhl-conditioner-bond-reparatur-p-75039.html?active_tab=def&offset_def=96&offset_new=696","net_content_value":200,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"c320750f-6a1e-420d-8594-409f04e05319","before_product_fingerprint":"3c7c65ad445f965b27e6623c4d7eae5f","before_identifier_fingerprint":"90cdd1de9a741f26ba04dc867779a421","proposed":{"price_eur":18.68,"price_checked_at":"2026-10-03T13:13:45.117224+00:00","affiliate_link":"https://www.boozt.com/de/de/ogx/bond-repair-3-in-1-oil-mist-50-ml_32962841/231199513","net_content_value":50,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"d408aca9-cd16-4cb0-90e7-bab26a698000","before_product_fingerprint":"a44b5e74fb92d97891ba64b2ad8b0b3a","before_identifier_fingerprint":"8057c63eba1538ddea05ffde003b91d6","proposed":{"price_eur":5.59,"price_checked_at":"2026-10-03T13:13:43.221021+00:00","affiliate_link":"https://www.drogeriedepot.de/haarpflege-farben/haar-shampoo/head-shoulders-shampoo-derma-x-pro-sensitive-pflege-pr-077537/","net_content_value":250,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"11d42d9d-b8d8-42ae-a432-9a3d0f9d3504","before_product_fingerprint":"cd45ebfc9dd8f1cf9f85b1992b66d4e8","before_identifier_fingerprint":"e7a4c2b220ee24703d3ec235d5ec5e77","proposed":{"price_eur":2.8,"price_checked_at":"2026-10-03T13:15:56.683Z","affiliate_link":"https://www.iwonatec.com/de/product/%21/guhl-2-in-1-hair-treatment-conditioner-with-panthenol-repair-200-ml","net_content_value":200,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"8ef172f7-8e95-4ac7-a6a9-235ad760155b","before_product_fingerprint":"a6325a1c5cc04917b9e645bdbe75f941","before_identifier_fingerprint":"d751713988987e9331980363e24189ce","proposed":{"price_eur":2.8,"price_checked_at":"2026-10-03T13:15:56.683Z","affiliate_link":"https://www.iwonatec.com/de/product/%21/guhl-2-in-1-hair-treatment-conditioner-with-panthenol-repair-200-ml","net_content_value":200,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"4506954b-128a-473c-866f-54a300ff23f4","before_product_fingerprint":"eb3b8a8c6c6673e29e0790f23bfd6018","before_identifier_fingerprint":"6caf127b5933b1c7f455ddb0c8f6f884","proposed":{"price_eur":5.24,"price_checked_at":"2026-10-03T13:16:02.749Z","affiliate_link":"https://www.galaxus.de/de/s6/product/hair-biology-haarspuelung-full-shining-160-ml-160-ml-conditioner-13128066","net_content_value":160,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"993f0e55-2450-4557-853d-e6e23ec0d1a9","before_product_fingerprint":"727d204e5aa0a4461143e1cce59fa4ca","before_identifier_fingerprint":"deff4ef673394871307d3560a4c67428","proposed":{"price_eur":30.45,"price_checked_at":"2026-10-03T13:16:21.200Z","affiliate_link":"https://www.sephora.de/p/leave-in-conditioner-426531.html","net_content_value":140,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"cce6346c-8c92-4a17-b39b-cc7f300e84de","before_product_fingerprint":"1b1789c25b1add9073df73768aaac9fc","before_identifier_fingerprint":"47b75d248af1191d7f7d242377e06751","proposed":{"price_eur":4.99,"price_checked_at":"2026-10-03T13:16:08.529Z","affiliate_link":"https://www.rossmann.de/de/pflege-und-duft-syoss-haar-laminierungs-kur-intense-glaze/p/4015100867213","net_content_value":200,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"e859d6e0-e991-4081-84b5-b81862c82475","before_product_fingerprint":"11a83f8933317803fe74160b4460b2a0","before_identifier_fingerprint":"e208869f9cdfa524c48e52d0c421a448","proposed":{"price_eur":4.99,"price_checked_at":"2026-10-03T13:19:18.354Z","affiliate_link":"https://www.rossmann.de/de/pflege-und-duft-gliss-sealing-shampoo-sealing-miracle/p/4015100895025"},"add_identifier":null,"approved_package_change":false},{"id":"35d81c4a-dbb0-474b-a068-2e1562adb0a8","before_product_fingerprint":"828373f54d76542f77f92d12d04e4044","before_identifier_fingerprint":"b06519d4a986193f9186f54b90a09372","proposed":{"price_eur":4.95,"price_checked_at":"2026-10-03T13:16:39.025Z","affiliate_link":"https://www.dm.de/p/d/1678991/langhaarmaedchen-conditioner-beautiful-curls","net_content_value":250,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"ea88a333-b11c-45c3-bbda-c51f912ee56f","before_product_fingerprint":"5b9f9d54cd5abcb5f0ef2933e1200cb3","before_identifier_fingerprint":"b28b972d05e3b40305cdfd61d0885563","proposed":{"price_eur":2.75,"price_checked_at":"2026-10-03T13:16:40.223Z","affiliate_link":"https://www.dm.de/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer","net_content_value":100,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"7d8c0150-778d-4cb9-abf5-bfc16ad93b12","before_product_fingerprint":"5e670a6480cbe2191b1090aedcd4f1ee","before_identifier_fingerprint":"a2cdfd5c7454c235f84c7c5fa0eedfce","proposed":{"price_eur":20.95,"price_checked_at":"2026-10-03T13:17:53.719Z","affiliate_link":"https://www.hagel-shop.de/olaplex-no-7-bonding-oil-30-ml.html","net_content_value":30,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":false},{"id":"314d9881-4fcc-47b5-81e1-58e41779081e","before_product_fingerprint":"9be9a5d79b9f7ae0bb424944bd422774","before_identifier_fingerprint":"0ddac7d1b0209f624164639b6921c268","proposed":{"price_eur":2.89,"price_checked_at":"2026-10-03T13:15:35.896Z","affiliate_link":"https://www.douglas.de/de/p/5012008156","net_content_value":200,"net_content_unit":"ml"},"add_identifier":null,"approved_package_change":true},{"id":"94cf6959-a53b-421b-9f0f-05efc239171c","before_product_fingerprint":"c6d429087ab25a318e881c825443c242","before_identifier_fingerprint":"dc9efa47fad5d1b3ba3024f4cc1a8032","proposed":{"price_eur":19.38,"price_checked_at":"2026-10-03T13:14:31.294299+00:00","affiliate_link":"https://www.hagel-shop.de/wella-wp-ultimate-repair-leave-in-treatment-95-ml.html","net_content_value":95,"net_content_unit":"ml"},"add_identifier":{"type":"ean","value":"4068359081183","canonical_gtin14":"04068359081183","source":"price-audit-approved-2026-10-03"},"approved_package_change":false},{"id":"f8a63590-9d80-454a-8008-e2a56321e64c","before_product_fingerprint":"db6c9cd392ca8eee63e99b9bc41118bd","before_identifier_fingerprint":"342a83707b5e19a8db145bfe3de4517f","proposed":{"price_eur":48,"price_checked_at":"2026-10-03T13:14:31.613829+00:00","affiliate_link":"https://epres-hair.de/artikeldetails/CONSUMERKIT.aspx"},"add_identifier":null,"approved_package_change":false}]$approved_offers_json$::jsonb;
  v_expected_count constant integer := 21;
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
  -- Lock every approved new canonical identity with the same key as intake.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) WHERE value->'add_identifier'<>'null'::jsonb ORDER BY value->'add_identifier'->>'canonical_gtin14' LOOP
    v_canonical:=public.product_identifier_canonical_gtin14(v_item->'add_identifier'->>'type',v_item->'add_identifier'->>'value');
    IF v_canonical IS NULL OR v_canonical IS DISTINCT FROM v_item->'add_identifier'->>'canonical_gtin14' THEN
      RAISE EXCEPTION 'Invalid approved canonical GTIN';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('product-identifier:canonical-gtin14:'||v_canonical,0));
    IF EXISTS(SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14=v_canonical) THEN
      RAISE EXCEPTION 'Approved new GTIN already has an owner';
    END IF;
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
    IF v_item->'add_identifier'<>'null'::jsonb AND (
       v_before.id<>'94cf6959-a53b-421b-9f0f-05efc239171c'::uuid
       OR v_item->'add_identifier'->>'type'<>'ean'
       OR v_item->'add_identifier'->>'value'<>'4068359081183'
       OR v_item->'add_identifier'->>'source'<>'price-audit-approved-2026-10-03') THEN
       RAISE EXCEPTION 'Unapproved recognition alias';
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
      IF ((v_before.net_content_value IS NOT NULL OR v_before.net_content_unit IS NOT NULL)
          AND NOT(v_before.id='314d9881-4fcc-47b5-81e1-58e41779081e'::uuid
              AND v_item->>'approved_package_change'='true'
              AND v_before.net_content_value=250 AND v_before.net_content_unit='ml'
              AND (v_item->'proposed'->>'net_content_value')::numeric=200
              AND v_item->'proposed'->>'net_content_unit'='ml'))
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
        VALUES(v_before.id,v_item->'add_identifier'->>'type',v_item->'add_identifier'->>'value',v_item->'add_identifier'->>'source')
        RETURNING id INTO STRICT v_new_identifier_id;
        IF NOT EXISTS(SELECT 1 FROM public.product_identifiers WHERE id=v_new_identifier_id
          AND product_id=v_before.id AND identifier_type='ean' AND identifier_value='4068359081183'
          AND canonical_gtin14='04068359081183' AND source='price-audit-approved-2026-10-03') THEN
          RAISE EXCEPTION 'Approved new identifier did not persist exactly';
        END IF;
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
    IF v_alias_count<>1 THEN RAISE EXCEPTION 'Approved alias count mismatch'; END IF;
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
