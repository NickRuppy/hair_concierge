-- Restore bucket1 flags after Nick rejected the restore decision, 2026-10-04.
-- Only is_chaarlie_recommended may change; no price, URL, status, formula, lifecycle or identifier writes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $bucket1_restore$
DECLARE
 v_dry_run constant boolean := false;
 v_payload constant jsonb := $approved_pause_payload$[{"id":"7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9","name":"Gliss Aqua Revive","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"c59332b685e94ea489adb9185423a603","before_identifier_fingerprint":"d751713988987e9331980363e24189ce"},{"id":"41e09958-5a1f-4997-b99b-f8384b7a8c0c","name":"Trockenshampoo Kopfhaut Sensitive","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"ac2bec13dffcfee87b6616ed51e5d880","before_identifier_fingerprint":"d5f08b33628be5241f91ad3b0c501e6e"},{"id":"d01de47e-e360-4b31-9924-e3e5bc31ccdc","name":"Balea Professional Ultimate Volume","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"5068e3b527b1d15301aa914f5903bb65","before_identifier_fingerprint":"ae2c9d19bf8f3575bbd95dd83d9dbf4d"},{"id":"a06cfc4d-c4f5-457e-a94e-26559f96f0e9","name":"Hair Biology Revitalize & Soothe","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"f0dfc9d7b7ee3c44015bbb66932af5b6","before_identifier_fingerprint":"a6d2c9ed2c68a34b13e079a780e7aa67"},{"id":"007a0b35-2372-4836-9aa5-fd089cd588d4","name":"Balea Natural Beauty Hibiskus","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"a5b864486c1a27f01c5256ec7282d6ba","before_identifier_fingerprint":"c214855261cfb80e70c834768de553d7"},{"id":"4c3e1a63-4696-406a-be67-f2aacc678b0c","name":"Garnier Hair Food Macadamia","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"bceb1e50125157220e54c658f6a48846","before_identifier_fingerprint":"d751713988987e9331980363e24189ce"},{"id":"26985fdd-1b41-46e3-9c9a-94b98f92310a","name":"Nivea Volumen & Kraft","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"c99f1b7571ad1752853ac46778215a3f","before_identifier_fingerprint":"e9f580f94c060bbfdda11deb9ad2ea5b"},{"id":"1568b623-f411-4ed6-a89f-e797bb1b48f5","name":"Alterra Intensiv Repair Haarmaske Feuchtigkeit","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"caf173ea708d14948d91d46a2403b810","before_identifier_fingerprint":"186bc48370dfd24166e1d06a70a228d2"},{"id":"f212a8ff-0a03-404a-aad5-773d5bb6f7c9","name":"Balea Natural Beauty 3in1 Locken","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"47d20fade23c6afd7c53060c5d76affd","before_identifier_fingerprint":"d751713988987e9331980363e24189ce"},{"id":"1f3920fe-c91e-4298-a40e-99dccd13ea30","name":"Balea Professional Glow & Shine","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"28ce9234f5d8937556214ac59b33de77","before_identifier_fingerprint":"067df1adb58f914b7404e990057adea5"},{"id":"55727898-2a5e-4f01-ace1-bd91521d98ab","name":"Balea Aqua Hyaluron 3 in 1","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"dc6150a93cd7b1535ee375bbe7393f0f","before_identifier_fingerprint":"7f0a733ebe47e33b0c18b242fae58236"},{"id":"17c50884-3c17-479a-848a-10447464e086","name":"Garnier Wahre Schätze Haarmaske Aktivkohle","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"3bfa2fda7c99f2f5cd618232f56afa64","before_identifier_fingerprint":"02e6d00b2e164cba70dc3c8231609b06"},{"id":"47795618-40e7-4ef6-8034-0fd8eb747575","name":"Isana 3in1 Milchprotein & Mandel","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"a79a5f474bfc9d403963a3b4c17abdec","before_identifier_fingerprint":"65d9546581882f31c7ebbdae7d3fdeaa"},{"id":"869abd97-a499-4f39-97e5-2722773e46ae","name":"Sante Intense Hydration","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"215db9c5b530b3a605c3e985c9177e30","before_identifier_fingerprint":"8e10407423f2aeb1310ab1f4dc4aab3f"},{"id":"c6e80f39-20ba-401e-b041-6ee7c89a5996","name":"Balea Aqua Hyaluron 3in1","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"285cacf3b11fb5d91fee248ced2dacac","before_identifier_fingerprint":"d751713988987e9331980363e24189ce"},{"id":"a72d630d-547a-465f-9846-3006b38af0a2","name":"Garnier Hair Food Macadamia","before_recommended":false,"restore_recommended":true,"before_product_fingerprint":"a527a84d593adc52d174217849a5877d","before_identifier_fingerprint":"9c32fcb01c41dfe1b2232db855741205"}]$approved_pause_payload$::jsonb;
 v_expected_count constant integer := 16;
 v_approved_ids constant uuid[] := ARRAY['7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid, '41e09958-5a1f-4997-b99b-f8384b7a8c0c'::uuid, 'd01de47e-e360-4b31-9924-e3e5bc31ccdc'::uuid, 'a06cfc4d-c4f5-457e-a94e-26559f96f0e9'::uuid, '007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid, '4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid, '26985fdd-1b41-46e3-9c9a-94b98f92310a'::uuid, '1568b623-f411-4ed6-a89f-e797bb1b48f5'::uuid, 'f212a8ff-0a03-404a-aad5-773d5bb6f7c9'::uuid, '1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid, '55727898-2a5e-4f01-ace1-bd91521d98ab'::uuid, '17c50884-3c17-479a-848a-10447464e086'::uuid, '47795618-40e7-4ef6-8034-0fd8eb747575'::uuid, '869abd97-a499-4f39-97e5-2722773e46ae'::uuid, 'c6e80f39-20ba-401e-b041-6ee7c89a5996'::uuid, 'a72d630d-547a-465f-9846-3006b38af0a2'::uuid];
 v_item jsonb;
 v_before public.products%rowtype;
 v_after public.products%rowtype;
 v_identifiers jsonb;
 v_updated integer := 0;
 v_rolled_back boolean := false;
BEGIN
 IF jsonb_array_length(v_payload)<>v_expected_count OR
    (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(v_payload) item)<>v_expected_count OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(v_payload) item WHERE NOT ((item->>'id')::uuid=ANY(v_approved_ids))) THEN
  RAISE EXCEPTION 'Restore payload is empty, duplicated, or outside reviewed scope';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply',0));
 PERFORM 1 FROM public.products p WHERE p.id=ANY(v_approved_ids) ORDER BY p.id FOR UPDATE;
 IF (SELECT count(*) FROM public.products p WHERE p.id=ANY(v_approved_ids))<>v_expected_count THEN
  RAISE EXCEPTION 'An approved product no longer exists';
 END IF;
 PERFORM 1 FROM public.product_identifiers i WHERE i.product_id=ANY(v_approved_ids) ORDER BY i.id FOR SHARE;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
  SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers
   FROM public.product_identifiers i WHERE i.product_id=v_before.id;
  IF md5(to_jsonb(v_before)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint' OR
     md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' OR
     v_before.is_active IS DISTINCT FROM true OR v_before.lifecycle_status IS DISTINCT FROM 'active' OR
     v_before.is_chaarlie_recommended IS DISTINCT FROM false THEN
   RAISE EXCEPTION 'Reviewed baseline or eligibility changed for %',v_before.id;
  END IF;
 END LOOP;
 BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
   SELECT * INTO STRICT v_before FROM public.products WHERE id=(v_item->>'id')::uuid;
   UPDATE public.products SET is_chaarlie_recommended=true WHERE id=v_before.id RETURNING * INTO STRICT v_after;
   IF v_after.is_chaarlie_recommended IS DISTINCT FROM true OR
      (to_jsonb(v_after)-ARRAY['is_chaarlie_recommended','updated_at']) IS DISTINCT FROM
      (to_jsonb(v_before)-ARRAY['is_chaarlie_recommended','updated_at']) THEN
    RAISE EXCEPTION 'Restore changed a protected field for %',v_before.id;
   END IF;
   v_updated:=v_updated+1;
  END LOOP;
  SET CONSTRAINTS ALL IMMEDIATE;
  IF v_updated<>v_expected_count THEN RAISE EXCEPTION 'Restore count mismatch'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
   SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_identifiers
    FROM public.product_identifiers i WHERE i.product_id=(v_item->>'id')::uuid;
   IF md5(v_identifiers::text) IS DISTINCT FROM v_item->>'before_identifier_fingerprint' THEN
    RAISE EXCEPTION 'Restore changed recognition identifiers';
   END IF;
  END LOOP;
  IF v_dry_run THEN RAISE EXCEPTION USING ERRCODE='ZP001',MESSAGE='Rollback approved restore dry run'; END IF;
 EXCEPTION WHEN SQLSTATE 'ZP001' THEN
  IF NOT v_dry_run THEN RAISE; END IF;
  v_rolled_back:=true;
 END;
 IF v_dry_run AND NOT v_rolled_back THEN RAISE EXCEPTION 'Dry run did not roll back'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload) ORDER BY value->>'id' LOOP
  SELECT * INTO STRICT v_after FROM public.products WHERE id=(v_item->>'id')::uuid;
  IF v_dry_run AND md5(to_jsonb(v_after)::text) IS DISTINCT FROM v_item->>'before_product_fingerprint' THEN
   RAISE EXCEPTION 'Dry run did not restore complete product state';
  END IF;
  IF NOT v_dry_run AND v_after.is_chaarlie_recommended IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Restore was not persisted';
  END IF;
 END LOOP;
 RAISE NOTICE '%',jsonb_build_object('dry_run',v_dry_run,'updated',v_updated,'rolled_back',v_rolled_back);
END
$bucket1_restore$;

