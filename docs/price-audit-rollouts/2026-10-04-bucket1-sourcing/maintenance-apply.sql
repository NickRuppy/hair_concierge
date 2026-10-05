-- Nick-authorized existing-product commerce maintenance and barcode coverage, 2026-10-04.
-- Preserve all recommendation/lifecycle/category/protocol fields and old identifiers.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $bucket1_maintenance$
DECLARE
 v_dry_run constant boolean := false;
 v_payload constant jsonb := $payload$[{"id":"007a0b35-2372-4836-9aa5-fd089cd588d4","name":"Balea Natural Beauty Hibiskus","before_product_fingerprint":"333868d23f5a457c728f387eeee48a40","before_identifier_fingerprint":"c214855261cfb80e70c834768de553d7","commerce":null,"aliases":[{"id":"007a0b35-2372-4836-9aa5-fd089cd588d4","gtin":"4058172926181","source":"https://www.dm.de/p/d/1625969/balea-conditioner-natural-beauty-bio-hibiskus-extrakt-und-cocosmilch"}]},{"id":"1f3920fe-c91e-4298-a40e-99dccd13ea30","name":"Balea Professional Glow & Shine","before_product_fingerprint":"05dc63385baa5618acd88fb6045bdec5","before_identifier_fingerprint":"067df1adb58f914b7404e990057adea5","commerce":{"id":"1f3920fe-c91e-4298-a40e-99dccd13ea30","url":"https://www.dm.de/p/d/3050111/balea-professional-haarkur-glow-und-shine-laminier-kur","price":2.75,"size":200,"checked_at":"2026-10-04T08:44:40.711Z"},"aliases":[{"id":"1f3920fe-c91e-4298-a40e-99dccd13ea30","gtin":"4070765006483","source":"https://www.dm.de/p/d/3050111/balea-professional-haarkur-glow-und-shine-laminier-kur"}]},{"id":"4c3e1a63-4696-406a-be67-f2aacc678b0c","name":"Garnier Hair Food Macadamia","before_product_fingerprint":"4cad685263c0a10c28b89a7615bf1db0","before_identifier_fingerprint":"d751713988987e9331980363e24189ce","commerce":{"id":"4c3e1a63-4696-406a-be67-f2aacc678b0c","url":"https://www.amazon.de/dp/B0BH7ZW2T4","price":5.95,"size":400,"checked_at":"2026-10-04T08:44:12.402Z"},"aliases":[]},{"id":"a72d630d-547a-465f-9846-3006b38af0a2","name":"Garnier Hair Food Macadamia","before_product_fingerprint":"b6616363d402ea53854985cbd9de938d","before_identifier_fingerprint":"9c32fcb01c41dfe1b2232db855741205","commerce":{"id":"a72d630d-547a-465f-9846-3006b38af0a2","url":"https://www.amazon.de/dp/B0BH7ZW2T4","price":5.95,"size":400,"checked_at":"2026-10-04T08:44:12.402Z"},"aliases":[]},{"id":"7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9","name":"Gliss Aqua Revive","before_product_fingerprint":"5d695b7881d86e9146fe88ac093abfe3","before_identifier_fingerprint":"d751713988987e9331980363e24189ce","commerce":{"id":"7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9","url":"https://www.nutritienda.com/de/gliss/gliss-aqua-revive-4-in-1-maske-400-ml","price":4.5,"size":400,"checked_at":"2026-10-04T08:47:43.291Z"},"aliases":[{"id":"7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9","gtin":"8410436457873","source":"https://www.nutritienda.com/de/gliss/gliss-aqua-revive-4-in-1-maske-400-ml"}]}]$payload$::jsonb;
 v_ids constant uuid[] := ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid];
 v_item jsonb; v_alias jsonb; v_canonical text;
 v_before public.products%rowtype; v_after public.products%rowtype;
 v_identifiers jsonb; v_old_identifiers jsonb := '{}'::jsonb; v_old_products jsonb := '{}'::jsonb;
 v_support_before jsonb; v_support_after jsonb;
 v_commerce_count integer := 0; v_identifier_count integer := 0;
 v_rolled_back boolean := false;
BEGIN
 IF jsonb_array_length(v_payload)<>5 OR
    (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(v_payload) item)<>5 OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(v_payload) item WHERE NOT((item->>'id')::uuid=ANY(v_ids))) THEN
  RAISE EXCEPTION 'Bucket1 payload outside exact reviewed scope';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply',0));
 FOR v_canonical IN SELECT DISTINCT public.product_identifier_canonical_gtin14('gtin',a->>'gtin')
    FROM jsonb_array_elements(v_payload) p CROSS JOIN LATERAL jsonb_array_elements(p->'aliases') a
    ORDER BY 1 LOOP
  IF v_canonical IS NULL THEN RAISE EXCEPTION 'Invalid canonical GTIN'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('product-identifier:canonical-gtin14:'||v_canonical,0));
 END LOOP;
 PERFORM 1 FROM public.products p WHERE p.id=ANY(v_ids) ORDER BY p.id FOR UPDATE;
 IF (SELECT count(*) FROM public.products p WHERE p.id=ANY(v_ids))<>5 THEN RAISE EXCEPTION 'Missing maintenance target'; END IF;
 PERFORM 1 FROM public.product_identifiers i WHERE i.product_id=ANY(v_ids) ORDER BY i.id FOR SHARE;
 PERFORM 1 FROM public.product_mask_specs s WHERE s.product_id=ANY(v_ids) ORDER BY s.product_id FOR SHARE;
 PERFORM 1 FROM public.product_leave_in_specs s WHERE s.product_id=ANY(v_ids) ORDER BY s.product_id FOR SHARE;
 PERFORM 1 FROM public.product_conditioner_specs s WHERE s.product_id=ANY(v_ids) ORDER BY s.product_id,s.thickness FOR SHARE;
 PERFORM 1 FROM public.product_conditioner_rerank_specs s WHERE s.product_id=ANY(v_ids) ORDER BY s.product_id FOR SHARE;
 PERFORM 1 FROM public.product_application_protocols a WHERE a.product_id=ANY(v_ids) ORDER BY a.id FOR SHARE;
 SELECT jsonb_build_object('mask',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_mask_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'leave_in',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_leave_in_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'conditioner',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_conditioner_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'rerank',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_conditioner_rerank_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'protocols',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_application_protocols s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid]))) INTO v_support_before;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
  SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id;
  IF md5(to_jsonb(v_before)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint' OR
     md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN
   RAISE EXCEPTION 'Maintenance baseline drift for %',v_before.id;
  END IF;
  v_old_identifiers:=v_old_identifiers||jsonb_build_object(v_before.id::text,v_identifiers);
  v_old_products:=v_old_products||jsonb_build_object(v_before.id::text,to_jsonb(v_before));
 END LOOP;
 BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
   SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
   IF v_item->'commerce' IS DISTINCT FROM 'null'::jsonb THEN
    UPDATE public.products SET
     affiliate_link=v_item->'commerce'->>'url',price_eur=(v_item->'commerce'->>'price')::numeric,currency='EUR',
     net_content_value=(v_item->'commerce'->>'size')::numeric,net_content_unit='ml',purchase_link_status='available',
     price_checked_at=(v_item->'commerce'->>'checked_at')::timestamptz,
     purchase_link_checked_at=(v_item->'commerce'->>'checked_at')::timestamptz
    WHERE id=v_before.id RETURNING * INTO STRICT v_after;
    IF (to_jsonb(v_after)-ARRAY['affiliate_link','price_eur','currency','net_content_value','net_content_unit','purchase_link_status','price_checked_at','purchase_link_checked_at','updated_at']) IS DISTINCT FROM
       (to_jsonb(v_before)-ARRAY['affiliate_link','price_eur','currency','net_content_value','net_content_unit','purchase_link_status','price_checked_at','purchase_link_checked_at','updated_at']) OR
       v_after.affiliate_link IS DISTINCT FROM v_item->'commerce'->>'url' OR
       v_after.price_eur IS DISTINCT FROM (v_item->'commerce'->>'price')::numeric OR
       v_after.currency IS DISTINCT FROM 'EUR' OR
       v_after.net_content_value IS DISTINCT FROM (v_item->'commerce'->>'size')::numeric OR
       v_after.net_content_unit IS DISTINCT FROM 'ml' OR v_after.purchase_link_status IS DISTINCT FROM 'available' OR
       v_after.price_checked_at IS DISTINCT FROM (v_item->'commerce'->>'checked_at')::timestamptz OR
       v_after.purchase_link_checked_at IS DISTINCT FROM (v_item->'commerce'->>'checked_at')::timestamptz THEN
     RAISE EXCEPTION 'Protected commerce field or expected-value mismatch';
    END IF;
    v_commerce_count:=v_commerce_count+1;
   END IF;
   FOR v_alias IN SELECT value FROM jsonb_array_elements(v_item->'aliases') LOOP
    v_canonical:=public.product_identifier_canonical_gtin14('gtin',v_alias->>'gtin');
    IF EXISTS(SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14=v_canonical) THEN
     RAISE EXCEPTION 'New alias unexpectedly already owned: %',v_canonical;
    END IF;
    PERFORM public.product_identifier_assert_canonical_owner_available('gtin',v_alias->>'gtin',v_before.id);
    INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source)
      VALUES(v_before.id,'gtin',v_alias->>'gtin',v_alias->>'source');
    IF NOT EXISTS(SELECT 1 FROM public.product_identifiers i WHERE i.product_id=v_before.id
      AND i.identifier_type='gtin' AND i.identifier_value=v_alias->>'gtin'
      AND i.canonical_gtin14=v_canonical AND i.source=v_alias->>'source') THEN
     RAISE EXCEPTION 'New barcode expected-value mismatch';
    END IF;
    v_identifier_count:=v_identifier_count+1;
   END LOOP;
   SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id;
   IF NOT(v_identifiers @> (v_old_identifiers->v_before.id::text)) OR
      jsonb_array_length(v_identifiers)<>jsonb_array_length(v_old_identifiers->v_before.id::text)+jsonb_array_length(v_item->'aliases') THEN
    RAISE EXCEPTION 'Prior identifier changed or unexpected new identifier';
   END IF;
   SELECT * INTO STRICT v_after FROM public.products WHERE id=v_before.id;
   IF v_item->'commerce'='null'::jsonb AND to_jsonb(v_after) IS DISTINCT FROM to_jsonb(v_before) THEN
    RAISE EXCEPTION 'Alias-only maintenance changed product';
   END IF;
  END LOOP;
  SET CONSTRAINTS ALL IMMEDIATE;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) LOOP
   SELECT * INTO STRICT v_after FROM public.products WHERE id=(v_item->>'id')::uuid;
   IF v_item->'commerce'='null'::jsonb THEN
    IF to_jsonb(v_after) IS DISTINCT FROM v_old_products->v_after.id::text THEN RAISE EXCEPTION 'Alias-only product changed after constraint flush'; END IF;
   ELSE
    IF (to_jsonb(v_after)-'updated_at') IS DISTINCT FROM
      (((v_old_products->v_after.id::text)||jsonb_build_object(
       'affiliate_link',v_item->'commerce'->>'url','price_eur',(v_item->'commerce'->>'price')::numeric,'currency','EUR',
       'net_content_value',(v_item->'commerce'->>'size')::numeric,'net_content_unit','ml','purchase_link_status','available',
       'price_checked_at',(v_item->'commerce'->>'checked_at')::timestamptz,
       'purchase_link_checked_at',(v_item->'commerce'->>'checked_at')::timestamptz))-'updated_at') THEN
     RAISE EXCEPTION 'Final product diverged from exact commerce-only expectation';
    END IF;
   END IF;
  END LOOP;
  SELECT jsonb_build_object('mask',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_mask_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'leave_in',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_leave_in_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'conditioner',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_conditioner_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'rerank',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_conditioner_rerank_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'protocols',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_application_protocols s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid]))) INTO v_support_after;
  IF v_support_after IS DISTINCT FROM v_support_before THEN RAISE EXCEPTION 'Maintenance changed category or protocol facts'; END IF;
  IF v_commerce_count<>4 OR v_identifier_count<>3 THEN RAISE EXCEPTION 'Maintenance count mismatch'; END IF;
  IF v_dry_run THEN RAISE EXCEPTION USING ERRCODE='ZP004',MESSAGE='Rollback bucket1 dry run'; END IF;
 EXCEPTION WHEN SQLSTATE 'ZP004' THEN
  IF NOT v_dry_run THEN RAISE; END IF;
  v_rolled_back:=true;
 END;
 IF v_dry_run AND NOT v_rolled_back THEN RAISE EXCEPTION 'Dry run not rolled back'; END IF;
 IF v_dry_run THEN
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) LOOP
   SELECT * INTO STRICT v_after FROM public.products WHERE id=(v_item->>'id')::uuid;
   SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=v_after.id;
   IF md5(to_jsonb(v_after)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint' OR
      md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN
    RAISE EXCEPTION 'Dry run did not fully restore product/identifiers';
   END IF;
  END LOOP;
  SELECT jsonb_build_object('mask',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_mask_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'leave_in',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_leave_in_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'conditioner',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_conditioner_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'rerank',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_conditioner_rerank_specs s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid])),'protocols',(select coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text),'[]'::jsonb) from public.product_application_protocols s where s.product_id=ANY(ARRAY['007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,'1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,'4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,'7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid]))) INTO v_support_after;
  IF v_support_after IS DISTINCT FROM v_support_before THEN RAISE EXCEPTION 'Dry run did not restore support'; END IF;
 END IF;
END
$bucket1_maintenance$;
