-- Verified commerce maintenance under Nick's existing pricing authorization,2026-10-04.
-- No identifiers, category facts, protocols, lifecycle or recommendation changes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $commerce_refresh$
DECLARE
 v_dry_run constant boolean := true;
 v_payload constant jsonb := $commerce_payload$[{"id":"efaff579-e411-41eb-972a-2734a8517356","gtin":"4015100894141","price":4.95,"size":200,"url":"https://www.dm.de/p/d/1267310/got2b-hitzeschutzspray-schutzengel","checked_at":"2026-10-04T08:09:34.503Z","name":"Hitzeschutzspray Schutzengel","before_product_fingerprint":"2e1ca904f0c14c5c260cd395fe1a9e17","before_identifier_fingerprint":"218ec07ae1804b3fbf928109159c1d43"},{"id":"4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6","gtin":"8700216210546","price":3.95,"size":250,"url":"https://www.dm.de/p/d/1409620/herbal-essences-conditioner-feuchtigkeit-aloe-vera","checked_at":"2026-10-04T08:00:31.287Z","name":"Herbal Essences Aloe Vera Conditioner","before_product_fingerprint":"6f101d76d6455d069d8e58ff0a8ffa0d","before_identifier_fingerprint":"6b18e1ae6bd1d61dc6e081eca0e0a114"}]$commerce_payload$::jsonb;
 v_ids constant uuid[] := ARRAY['efaff579-e411-41eb-972a-2734a8517356'::uuid,'4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6'::uuid];
 v_item jsonb;
 v_before public.products%rowtype;
 v_after public.products%rowtype;
 v_identifiers jsonb;
 v_support_before jsonb;
 v_support_after jsonb;
 v_updated integer := 0;
 v_rolled_back boolean := false;
BEGIN
 IF jsonb_array_length(v_payload)<>2 OR
    (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(v_payload) item)<>2 OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(v_payload) item WHERE NOT((item->>'id')::uuid=ANY(v_ids))) THEN
  RAISE EXCEPTION 'Commerce payload outside exact reviewed scope';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply',0));
 PERFORM 1 FROM public.products p WHERE p.id=ANY(v_ids) ORDER BY p.id FOR UPDATE;
 IF (SELECT count(*) FROM public.products p WHERE p.id=ANY(v_ids))<>2 THEN RAISE EXCEPTION 'Missing commerce target'; END IF;
 PERFORM 1 FROM public.product_identifiers i WHERE i.product_id=ANY(v_ids) ORDER BY i.id FOR SHARE;
 PERFORM 1 FROM public.product_application_protocols a WHERE a.product_id=ANY(v_ids) ORDER BY a.id FOR SHARE;
 SELECT jsonb_build_object(
  'heat',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.product_id),'[]'::jsonb) FROM public.product_heat_protectant_specs s WHERE s.product_id=ANY(v_ids)),
  'conditioner',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.product_id,s.thickness),'[]'::jsonb) FROM public.product_conditioner_specs s WHERE s.product_id=ANY(v_ids)),
  'rerank',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.product_id),'[]'::jsonb) FROM public.product_conditioner_rerank_specs s WHERE s.product_id=ANY(v_ids)),
  'protocols',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) FROM public.product_application_protocols a WHERE a.product_id=ANY(v_ids))
 ) INTO v_support_before;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
  SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=v_before.id;
  IF md5(to_jsonb(v_before)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint' OR
     md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN
   RAISE EXCEPTION 'Commerce baseline drift for %',v_before.id;
  END IF;
 END LOOP;
 BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
   SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
   UPDATE public.products SET
    affiliate_link=v_item->>'url', price_eur=(v_item->>'price')::numeric,currency='EUR',
    net_content_value=(v_item->>'size')::numeric,net_content_unit='ml',
    purchase_link_status='available',
    price_checked_at=(v_item->>'checked_at')::timestamptz,
    purchase_link_checked_at=(v_item->>'checked_at')::timestamptz
   WHERE id=v_before.id RETURNING * INTO STRICT v_after;
   IF (to_jsonb(v_after)-ARRAY['affiliate_link','price_eur','currency','net_content_value','net_content_unit','purchase_link_status','price_checked_at','purchase_link_checked_at','updated_at']) IS DISTINCT FROM
      (to_jsonb(v_before)-ARRAY['affiliate_link','price_eur','currency','net_content_value','net_content_unit','purchase_link_status','price_checked_at','purchase_link_checked_at','updated_at']) OR
      v_after.affiliate_link IS DISTINCT FROM v_item->>'url' OR
      v_after.price_eur IS DISTINCT FROM (v_item->>'price')::numeric OR
      v_after.currency IS DISTINCT FROM 'EUR' OR
      v_after.net_content_value IS DISTINCT FROM (v_item->>'size')::numeric OR
      v_after.net_content_unit IS DISTINCT FROM 'ml' OR
      v_after.purchase_link_status IS DISTINCT FROM 'available' OR
      v_after.price_checked_at IS DISTINCT FROM (v_item->>'checked_at')::timestamptz OR
      v_after.purchase_link_checked_at IS DISTINCT FROM (v_item->>'checked_at')::timestamptz THEN
    RAISE EXCEPTION 'Commerce protected-field or expected-value mismatch';
   END IF;
   v_updated:=v_updated+1;
  END LOOP;
  SET CONSTRAINTS ALL IMMEDIATE;
  SELECT jsonb_build_object(
   'heat',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.product_id),'[]'::jsonb) FROM public.product_heat_protectant_specs s WHERE s.product_id=ANY(v_ids)),
   'conditioner',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.product_id,s.thickness),'[]'::jsonb) FROM public.product_conditioner_specs s WHERE s.product_id=ANY(v_ids)),
   'rerank',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.product_id),'[]'::jsonb) FROM public.product_conditioner_rerank_specs s WHERE s.product_id=ANY(v_ids)),
   'protocols',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) FROM public.product_application_protocols a WHERE a.product_id=ANY(v_ids))
  ) INTO v_support_after;
  IF v_support_after IS DISTINCT FROM v_support_before THEN RAISE EXCEPTION 'Commerce changed category or protocol facts'; END IF;
  IF v_updated<>2 THEN RAISE EXCEPTION 'Commerce count mismatch'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) LOOP
   SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers FROM public.product_identifiers i WHERE i.product_id=(v_item->>'id')::uuid;
   IF md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN RAISE EXCEPTION 'Commerce changed identifiers'; END IF;
  END LOOP;
  IF v_dry_run THEN RAISE EXCEPTION USING ERRCODE='ZP002',MESSAGE='Rollback commerce dry run'; END IF;
 EXCEPTION WHEN SQLSTATE 'ZP002' THEN
  IF NOT v_dry_run THEN RAISE; END IF;
  v_rolled_back:=true;
 END;
 IF v_dry_run AND NOT v_rolled_back THEN RAISE EXCEPTION 'Commerce dry run not rolled back'; END IF;
 IF v_dry_run THEN
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) LOOP
   SELECT * INTO STRICT v_after FROM public.products WHERE id=(v_item->>'id')::uuid;
   IF md5(to_jsonb(v_after)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint' THEN RAISE EXCEPTION 'Commerce dry run not fully restored'; END IF;
  END LOOP;
 END IF;
END
$commerce_refresh$;

